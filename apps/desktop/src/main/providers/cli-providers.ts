import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { AgentEvent, ProviderId } from '@codeagent-studio/protocol';
import type { AgentProvider, CreateSessionInput, ProviderStatus } from './contracts.js';
import { parseCliEvent } from './cli-event-parser.js';

type Config = { id: ProviderId; command: string; commandArgs?: string[]; versionArgs?: string[]; promptArgs: (text: string) => string[] };
const cursorWindowsPath = join(homedir(), 'AppData', 'Local', 'cursor-agent', 'agent.ps1');
const resolveAgentCommand = (envKey: string, fallback: string) => process.env[envKey] ?? fallback;
const wrapWindowsPowerShell = (command: string): Pick<Config, 'command' | 'commandArgs'> => process.platform === 'win32' && command.toLowerCase().endsWith('.ps1') ? { command: 'powershell.exe', commandArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', command] } : { command };
const cursorCommand = wrapWindowsPowerShell(resolveAgentCommand('CODEAGENT_CURSOR_AGENT', process.platform === 'win32' && existsSync(cursorWindowsPath) ? cursorWindowsPath : 'agent'));
export const CLI_CONFIGS: Config[] = [{ id: 'claude', ...wrapWindowsPowerShell(resolveAgentCommand('CODEAGENT_CLAUDE_COMMAND', 'claude')), promptArgs: (text) => ['-p', text] }, { id: 'cursor', ...cursorCommand, promptArgs: (text) => ['-p', '--output-format', 'text', text] }, { id: 'codex', ...wrapWindowsPowerShell(resolveAgentCommand('CODEAGENT_CODEX_COMMAND', 'codex')), promptArgs: (text) => ['exec', text] }, { id: 'opencode', ...wrapWindowsPowerShell(resolveAgentCommand('CODEAGENT_OPENCODE_COMMAND', 'opencode')), promptArgs: (text) => ['run', text] }];

export class CliProvider implements AgentProvider {
  readonly capabilities = { maxConcurrentSessions: 1, supportsResume: false, supportsAttachments: false, supportsProjectScope: true, supportsAbort: true };
  private readonly listeners = new Set<(event: AgentEvent) => void>();
  private readonly processes = new Map<string, ReturnType<typeof spawn>>();
  constructor(private readonly config: Config) {}
  get id() { return this.config.id; }
  async detect(): Promise<ProviderStatus> {
    return new Promise((resolve) => { const child = spawn(this.config.command, [...(this.config.commandArgs ?? []), ...(this.config.versionArgs ?? ['--version'])], { shell: process.platform === 'win32' && this.config.command !== 'powershell.exe' }); let output = ''; child.stdout?.on('data', (data) => { output += data.toString(); }); child.once('error', () => resolve({ provider: this.id, installed: false, authenticated: false, errorCode: 'not_installed' })); child.once('close', (code) => resolve({ provider: this.id, installed: code === 0, authenticated: code === 0, version: output.trim() || undefined, errorCode: code === 0 ? undefined : 'unknown' })); });
  }
  async createSession(_input: CreateSessionInput) { return {}; }
  async resumeSession(_nativeId: string) { throw new Error(`${this.id} does not support resume`); }
  async prompt(sessionId: string, text: string) {
    const child = spawn(this.config.command, [...(this.config.commandArgs ?? []), ...this.config.promptArgs(text)], { shell: process.platform === 'win32' && this.config.command !== 'powershell.exe', stdio: ['ignore', 'pipe', 'pipe'] }); this.processes.set(sessionId, child); let sequence = 0;
    const consume = (data: Buffer) => data.toString().split(/\r?\n/).forEach((line) => { const event = parseCliEvent(line, this.id, sessionId, sequence++); if (event) this.listeners.forEach((listener) => listener(event)); });
    child.stdout?.on('data', consume); child.stderr?.on('data', consume); child.once('close', () => { this.processes.delete(sessionId); });
  }
  async abort(sessionId: string) { const child = this.processes.get(sessionId); if (!child) return false; child.kill(); this.processes.delete(sessionId); return true; }
  subscribe(listener: (event: AgentEvent) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
export const createCliProviders = () => CLI_CONFIGS.map((config) => new CliProvider(config));
