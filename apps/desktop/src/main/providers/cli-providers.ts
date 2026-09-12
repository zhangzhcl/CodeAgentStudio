import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { AgentEvent, ProviderId } from '@codeagent-studio/protocol';
import type { AgentProvider, CreateSessionInput, ProviderStatus, PromptOptions } from './contracts.js';
import { parseCliEvent } from './cli-event-parser.js';
import { findAgentCommand, quoteShellArg, resolveAgentCommand as resolveCommand, withUserBinaryPaths, MAX_ARGV_PROMPT_CHARS } from './command-resolver.js';
import { PiProvider } from './pi-provider.js';
import { PiCliTransport } from './pi-cli-transport.js';
import { ensureAgentWorkspace } from './agent-workspace.js';

type Config = { id: ProviderId; command: string; commandArgs?: string[]; shell?: boolean; versionArgs?: string[]; promptArgs: (model?: string) => string[] };
const cursorWindowsPath = join(homedir(), 'AppData', 'Local', 'cursor-agent', 'agent.ps1');
const cursorDefault = process.platform === 'win32' && existsSync(cursorWindowsPath) ? cursorWindowsPath : findAgentCommand(['agent', 'cursor-agent']);
const cursorCommand = resolveCommand(process.env.CODEAGENT_CURSOR_AGENT ?? cursorDefault);
const config = (id: ProviderId, command: string, promptArgs: Config['promptArgs']): Config => ({ id, ...resolveCommand(command), promptArgs });
const commandFromEnvOrPath = (envKey: string, candidates: string[]) => process.env[envKey] ?? findAgentCommand(candidates);
export const CLI_CONFIGS: Config[] = [
  config('claude', commandFromEnvOrPath('CODEAGENT_CLAUDE_COMMAND', ['claude']), (model) => ['-p', '--output-format', 'stream-json', '--include-partial-messages', '--verbose', ...(model ? ['--model', model] : [])]),
  { id: 'cursor', ...cursorCommand, promptArgs: (model) => ['-p', '--output-format', 'stream-json', '--stream-partial-output', ...(model ? ['--model', model] : [])] },
  config('codex', commandFromEnvOrPath('CODEAGENT_CODEX_COMMAND', ['codex']), (model) => ['exec', '--json', ...(model ? ['-m', model] : [])]),
  config('opencode', commandFromEnvOrPath('CODEAGENT_OPENCODE_COMMAND', ['opencode']), (model) => ['run', '--format', 'json', '--model', model ? (model.includes('/') ? model : `sensenova/${model}`) : (process.env.CODEAGENT_OPENCODE_MODEL || 'sensenova/sensenova-6.8-flash-lite')]),
];

export class CliProvider implements AgentProvider {
  get capabilities() { return { maxConcurrentSessions: 1, supportsResume: false, supportsAttachments: true, supportsImages: this.config.id === 'claude', supportsThinking: false, supportsWebSearch: false, supportsProjectScope: true, supportsAbort: true }; }
  private readonly listeners = new Set<(event: AgentEvent) => void>();
  private readonly processes = new Map<string, ReturnType<typeof spawn>>();
  private readonly aborted = new Set<string>();
  private readonly sessionCwds = new Map<string, string>();
  constructor(private readonly config: Config) {}
  get id() { return this.config.id; }
  async detect(): Promise<ProviderStatus> {
    return new Promise((resolve) => { const child = spawn(this.config.command, [...(this.config.commandArgs ?? []), ...(this.config.versionArgs ?? ['--version'])], { shell: this.config.shell, windowsHide: true, env: withUserBinaryPaths(process.env) }); let output = ''; let settled = false; const finish = (status: ProviderStatus) => { if (settled) return; settled = true; clearTimeout(timeout); resolve(status); }; const timeout = setTimeout(() => { child.kill(); finish({ provider: this.id, command: this.config.command, installed: false, authenticated: false, errorCode: 'unknown' }); }, 5000); child.stdout?.on('data', (data) => { output += data.toString(); }); child.once('error', () => finish({ provider: this.id, command: this.config.command, installed: false, authenticated: false, errorCode: 'not_installed' })); child.once('close', (code) => finish({ provider: this.id, command: this.config.command, installed: code === 0, authenticated: code === 0, version: output.trim() || undefined, errorCode: code === 0 ? undefined : 'unknown' })); });
  }
  async createSession(input: CreateSessionInput) { if (input.sessionId) this.sessionCwds.set(input.sessionId, await ensureAgentWorkspace(this.id, input.projectRoot)); return {}; }
  async resumeSession(_nativeId: string) { throw new Error(`${this.id} does not support resume`); }
  async prompt(sessionId: string, text: string, model?: string, options?: PromptOptions) {
    if (options?.attachments?.length) text += `\n\n附件（请使用项目工作区工具读取）：\n${options.attachments.map((item) => `- ${item.relativePath}`).join('\n')}`;
    await new Promise<void>((resolve, reject) => {
      const runMessageId = `${sessionId}:${crypto.randomUUID()}`;
      const useStdin = text.length > MAX_ARGV_PROMPT_CHARS;
      const rawArgs = [...(this.config.commandArgs ?? []), ...this.config.promptArgs(model), ...(useStdin ? [] : [text])]; const args = this.config.shell ? rawArgs.map((arg) => quoteShellArg(arg)) : rawArgs; const child = spawn(this.config.command, args, { shell: this.config.shell, windowsHide: true, cwd: this.sessionCwds.get(sessionId), env: withUserBinaryPaths(process.env), stdio: [useStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'] }); let stderr = ''; if (useStdin && child.stdin) { // 子进程可能先退出，忽略 EPIPE 防止未处理异常
        child.stdin.on('error', () => undefined); child.stdin.end(text); } this.processes.set(sessionId, child); let sequence = 0; let pending = '';
      const consume = (data: Buffer) => { pending += data.toString(); const lines = pending.split(/\r?\n/); pending = lines.pop() ?? ''; lines.forEach((line) => { const event = parseCliEvent(line, this.id, sessionId, sequence++, runMessageId); if (event) this.listeners.forEach((listener) => listener(event)); }); };
      const flushPlainOutput = () => { const value = pending.trim(); if (!value || value.startsWith('{') && !value.endsWith('}')) return; pending = ''; const event = parseCliEvent(value, this.id, sessionId, sequence++, runMessageId); if (event) this.listeners.forEach((listener) => listener(event)); }; const flushTimer = setInterval(flushPlainOutput, 80);
      let reportedError = false; child.stdout?.on('data', consume); child.stderr?.on('data', (data) => { const line = data.toString(); stderr += line; if (/no api key|not logged in|authentication required|rate limit|timed out|error|failed|invalid|unknown option|not found/i.test(line)) { const parsed = parseCliEvent(line, this.id, sessionId, sequence++, runMessageId); const event = parsed?.type === 'error' ? parsed : parseCliEvent(JSON.stringify({ type: 'error', code: 'cli_stderr', message: line.trim() }), this.id, sessionId, sequence++, runMessageId); if (event?.type === 'error') { reportedError = true; this.listeners.forEach((listener) => listener(event)); } } }); child.once('error', (error) => { reportedError = true; clearInterval(flushTimer); const event = parseCliEvent(JSON.stringify({ type: 'error', code: 'spawn_error', message: error.message }), this.id, sessionId, sequence++, runMessageId); if (event) this.listeners.forEach((listener) => listener(event)); reject(error); }); child.once('close', (code) => { clearInterval(flushTimer); flushPlainOutput(); this.processes.delete(sessionId); const wasAborted = this.aborted.delete(sessionId); if (!wasAborted && typeof code === 'number' && code !== 0 && !reportedError) { const detail = stderr.trim(); const failure = parseCliEvent(JSON.stringify({ type: 'error', code: 'process_exit', message: detail || `Agent exited with code ${code}` }), this.id, sessionId, sequence++, runMessageId); if (failure) this.listeners.forEach((listener) => listener(failure)); } else if (!wasAborted && !reportedError) { const done = parseCliEvent(JSON.stringify({ type: 'done' }), this.id, sessionId, sequence++, runMessageId); if (done) this.listeners.forEach((listener) => listener(done)); } resolve(); });
    });
  }
  async abort(sessionId: string) { const child = this.processes.get(sessionId); if (!child) return false; this.aborted.add(sessionId); child.kill(); this.processes.delete(sessionId); return true; }
  subscribe(listener: (event: AgentEvent) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
export const createCliProviders = () => [...CLI_CONFIGS.map((config) => new CliProvider(config)), new PiProvider(new PiCliTransport())];
