import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { AgentEvent, ProviderId } from '@codeagent-studio/protocol';
import type { AgentProvider, CreateSessionInput, ProviderStatus } from './contracts.js';
import { parseCliEvent } from './cli-event-parser.js';
import { findAgentCommand, quoteShellArg, resolveAgentCommand as resolveCommand, withUserBinaryPaths } from './command-resolver.js';
import { PiProvider } from './pi-provider.js';
import { PiCliTransport } from './pi-cli-transport.js';

type Config = { id: ProviderId; command: string; commandArgs?: string[]; shell?: boolean; versionArgs?: string[]; promptArgs: (text: string) => string[] };
const cursorWindowsPath = join(homedir(), 'AppData', 'Local', 'cursor-agent', 'agent.ps1');
const cursorDefault = process.platform === 'win32' && existsSync(cursorWindowsPath) ? cursorWindowsPath : findAgentCommand(['agent', 'cursor-agent']);
const cursorCommand = resolveCommand(process.env.CODEAGENT_CURSOR_AGENT ?? cursorDefault);
const config = (id: ProviderId, command: string, promptArgs: Config['promptArgs']): Config => ({ id, ...resolveCommand(command), promptArgs });
const commandFromEnvOrPath = (envKey: string, candidates: string[]) => process.env[envKey] ?? findAgentCommand(candidates);
export const CLI_CONFIGS: Config[] = [
  config('claude', commandFromEnvOrPath('CODEAGENT_CLAUDE_COMMAND', ['claude']), (text) => ['-p', '--output-format', 'stream-json', '--include-partial-messages', '--verbose', text]),
  { id: 'cursor', ...cursorCommand, promptArgs: (text) => ['-p', '--output-format', 'stream-json', '--stream-partial-output', text] },
  config('codex', commandFromEnvOrPath('CODEAGENT_CODEX_COMMAND', ['codex']), (text) => ['exec', '--json', text]),
  config('opencode', commandFromEnvOrPath('CODEAGENT_OPENCODE_COMMAND', ['opencode']), (text) => ['run', '--format', 'json', '--model', process.env.CODEAGENT_OPENCODE_MODEL ?? 'sensenova/sensenova-6.8-flash-lite', text]),
];

export class CliProvider implements AgentProvider {
  readonly capabilities = { maxConcurrentSessions: 1, supportsResume: false, supportsAttachments: false, supportsProjectScope: true, supportsAbort: true };
  private readonly listeners = new Set<(event: AgentEvent) => void>();
  private readonly processes = new Map<string, ReturnType<typeof spawn>>();
  private readonly aborted = new Set<string>();
  private readonly sessionCwds = new Map<string, string>();
  constructor(private readonly config: Config) {}
  get id() { return this.config.id; }
  async detect(): Promise<ProviderStatus> {
    return new Promise((resolve) => { const child = spawn(this.config.command, [...(this.config.commandArgs ?? []), ...(this.config.versionArgs ?? ['--version'])], { shell: this.config.shell, windowsHide: true, env: withUserBinaryPaths(process.env) }); let output = ''; let settled = false; const finish = (status: ProviderStatus) => { if (settled) return; settled = true; clearTimeout(timeout); resolve(status); }; const timeout = setTimeout(() => { child.kill(); finish({ provider: this.id, command: this.config.command, installed: false, authenticated: false, errorCode: 'unknown' }); }, 5000); child.stdout?.on('data', (data) => { output += data.toString(); }); child.once('error', () => finish({ provider: this.id, command: this.config.command, installed: false, authenticated: false, errorCode: 'not_installed' })); child.once('close', (code) => finish({ provider: this.id, command: this.config.command, installed: code === 0, authenticated: code === 0, version: output.trim() || undefined, errorCode: code === 0 ? undefined : 'unknown' })); });
  }
  async createSession(input: CreateSessionInput) { if (input.projectRoot && input.sessionId) this.sessionCwds.set(input.sessionId, input.projectRoot); return {}; }
  async resumeSession(_nativeId: string) { throw new Error(`${this.id} does not support resume`); }
  async prompt(sessionId: string, text: string) {
    await new Promise<void>((resolve, reject) => {
      const rawArgs = [...(this.config.commandArgs ?? []), ...this.config.promptArgs(text)]; const args = this.config.shell ? rawArgs.map((arg) => quoteShellArg(arg)) : rawArgs; const child = spawn(this.config.command, args, { shell: this.config.shell, windowsHide: true, cwd: this.sessionCwds.get(sessionId), env: withUserBinaryPaths(process.env), stdio: ['ignore', 'pipe', 'pipe'] }); this.processes.set(sessionId, child); let sequence = 0; let pending = '';
      const consume = (data: Buffer) => { pending += data.toString(); const lines = pending.split(/\r?\n/); pending = lines.pop() ?? ''; lines.forEach((line) => { const event = parseCliEvent(line, this.id, sessionId, sequence++); if (event) this.listeners.forEach((listener) => listener(event)); }); };
      child.stdout?.on('data', consume); child.stderr?.on('data', (data) => { const line = data.toString(); if (/no api key|not logged in|authentication required|rate limit|timed out|error/i.test(line)) { const event = parseCliEvent(line, this.id, sessionId, sequence++); if (event?.type === 'error') this.listeners.forEach((listener) => listener(event)); } }); child.once('error', reject); child.once('close', (code) => { if (pending.trim()) { const event = parseCliEvent(pending, this.id, sessionId, sequence++); if (event) this.listeners.forEach((listener) => listener(event)); } this.processes.delete(sessionId); const wasAborted = this.aborted.delete(sessionId); if (!wasAborted && typeof code === 'number' && code !== 0) { const failure = parseCliEvent(JSON.stringify({ type: 'error', code: 'process_exit', message: `Agent exited with code ${code}` }), this.id, sessionId, sequence++); if (failure) this.listeners.forEach((listener) => listener(failure)); } else if (!wasAborted) { const done = parseCliEvent(JSON.stringify({ type: 'done' }), this.id, sessionId, sequence++); if (done) this.listeners.forEach((listener) => listener(done)); } resolve(); });
    });
  }
  async abort(sessionId: string) { const child = this.processes.get(sessionId); if (!child) return false; this.aborted.add(sessionId); child.kill(); this.processes.delete(sessionId); return true; }
  subscribe(listener: (event: AgentEvent) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
export const createCliProviders = () => [...CLI_CONFIGS.map((config) => new CliProvider(config)), new PiProvider(new PiCliTransport())];
