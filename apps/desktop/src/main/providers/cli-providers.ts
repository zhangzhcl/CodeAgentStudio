import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { AgentEvent, ProviderId } from '@codeagent-studio/protocol';
import type { AgentProvider, CreateSessionInput, ProviderStatus } from './contracts.js';
import { parseCliEvent } from './cli-event-parser.js';
import { findAgentCommand, resolveAgentCommand as resolveCommand, withUserBinaryPaths } from './command-resolver.js';
import { PiProvider } from './pi-provider.js';
import { PiCliTransport } from './pi-cli-transport.js';

type Config = { id: ProviderId; command: string; commandArgs?: string[]; shell?: boolean; versionArgs?: string[]; promptArgs: (text: string) => string[] };
const cursorWindowsPath = join(homedir(), 'AppData', 'Local', 'cursor-agent', 'agent.ps1');
const cursorDefault = process.platform === 'win32' && existsSync(cursorWindowsPath) ? cursorWindowsPath : findAgentCommand(['agent', 'cursor-agent']);
const cursorCommand = resolveCommand(process.env.CODEAGENT_CURSOR_AGENT ?? cursorDefault);
const config = (id: ProviderId, command: string, promptArgs: Config['promptArgs']): Config => ({ id, ...resolveCommand(command), promptArgs });
const commandFromEnvOrPath = (envKey: string, candidates: string[]) => process.env[envKey] ?? findAgentCommand(candidates);
export const CLI_CONFIGS: Config[] = [config('claude', commandFromEnvOrPath('CODEAGENT_CLAUDE_COMMAND', ['claude']), (text) => ['-p', text]), { id: 'cursor', ...cursorCommand, promptArgs: (text) => ['-p', '--output-format', 'text', text] }, config('codex', commandFromEnvOrPath('CODEAGENT_CODEX_COMMAND', ['codex']), (text) => ['exec', text]), config('opencode', commandFromEnvOrPath('CODEAGENT_OPENCODE_COMMAND', ['opencode']), (text) => ['run', text])];

export class CliProvider implements AgentProvider {
  readonly capabilities = { maxConcurrentSessions: 1, supportsResume: false, supportsAttachments: false, supportsProjectScope: true, supportsAbort: true };
  private readonly listeners = new Set<(event: AgentEvent) => void>();
  private readonly processes = new Map<string, ReturnType<typeof spawn>>();
  private readonly sessionCwds = new Map<string, string>();
  constructor(private readonly config: Config) {}
  get id() { return this.config.id; }
  async detect(): Promise<ProviderStatus> {
    return new Promise((resolve) => { const child = spawn(this.config.command, [...(this.config.commandArgs ?? []), ...(this.config.versionArgs ?? ['--version'])], { shell: this.config.shell, windowsHide: true, env: withUserBinaryPaths(process.env) }); let output = ''; child.stdout?.on('data', (data) => { output += data.toString(); }); child.once('error', () => resolve({ provider: this.id, command: this.config.command, installed: false, authenticated: false, errorCode: 'not_installed' })); child.once('close', (code) => resolve({ provider: this.id, command: this.config.command, installed: code === 0, authenticated: code === 0, version: output.trim() || undefined, errorCode: code === 0 ? undefined : 'unknown' })); });
  }
  async createSession(input: CreateSessionInput) { if (input.projectRoot && input.sessionId) this.sessionCwds.set(input.sessionId, input.projectRoot); return {}; }
  async resumeSession(_nativeId: string) { throw new Error(`${this.id} does not support resume`); }
  async prompt(sessionId: string, text: string) {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(this.config.command, [...(this.config.commandArgs ?? []), ...this.config.promptArgs(text)], { shell: this.config.shell, windowsHide: true, cwd: this.sessionCwds.get(sessionId), env: withUserBinaryPaths(process.env), stdio: ['ignore', 'pipe', 'pipe'] }); this.processes.set(sessionId, child); let sequence = 0;
      const consume = (data: Buffer) => data.toString().split(/\r?\n/).forEach((line) => { const event = parseCliEvent(line, this.id, sessionId, sequence++); if (event) this.listeners.forEach((listener) => listener(event)); });
      child.stdout?.on('data', consume); child.stderr?.on('data', consume); child.once('error', reject); child.once('close', () => { this.processes.delete(sessionId); const done = parseCliEvent(JSON.stringify({ type: 'done' }), this.id, sessionId, sequence++); if (done) this.listeners.forEach((listener) => listener(done)); resolve(); });
    });
  }
  async abort(sessionId: string) { const child = this.processes.get(sessionId); if (!child) return false; child.kill(); this.processes.delete(sessionId); return true; }
  subscribe(listener: (event: AgentEvent) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
export const createCliProviders = () => [...CLI_CONFIGS.map((config) => new CliProvider(config)), new PiProvider(new PiCliTransport())];
