import { spawn } from 'node:child_process';
import { withUserBinaryPaths } from './command-resolver.js';
import { parseCliEvent } from './cli-event-parser.js';
import type { AgentEvent } from '@codeagent-studio/protocol';
import type { CreateSessionInput, ProviderStatus } from './contracts.js';
import type { PiTransport } from './pi-provider.js';
export class PiCliTransport implements PiTransport {
  private readonly running = new Map<string, ReturnType<typeof spawn>>(); private readonly listeners = new Set<(event: AgentEvent) => void>();
  constructor(private readonly command = process.env.CODEAGENT_PI_COMMAND ?? 'pi') {}
  async createSession(input: CreateSessionInput & { sessionFile: string }) { return { nativeId: input.sessionFile }; }
  async resumeSession() {}
  async prompt(nativeId: string, text: string) { await new Promise<void>((resolve, reject) => { const provider = process.env.CODEAGENT_PI_PROVIDER ?? 'sensenova'; const model = process.env.CODEAGENT_PI_MODEL ?? 'sensenova-6.8-flash-lite'; const child = spawn(this.command, ['--print', '--mode', 'json', '--provider', provider, '--model', model, '--session', nativeId, text], { shell: process.platform === 'win32', windowsHide: true, env: withUserBinaryPaths(process.env), stdio: ['ignore', 'pipe', 'pipe'] }); this.running.set(nativeId, child); let sequence = 0; const consume = (data: Buffer) => data.toString().split(/\r?\n/).forEach((line) => { const event = parseCliEvent(line, 'pi', nativeId, sequence++); if (event) this.listeners.forEach((listener) => listener(event)); }); child.stdout?.on('data', consume); child.stderr?.on('data', consume); child.once('error', reject); child.once('close', () => { this.running.delete(nativeId); resolve(); }); }); }
  async abort(nativeId: string) { const child = this.running.get(nativeId); if (!child) return false; child.kill(); this.running.delete(nativeId); return true; }
  subscribe(listener: (event: AgentEvent) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  detect(): Promise<ProviderStatus> { return new Promise((resolve) => { const child = spawn(this.command, ['--version'], { shell: process.platform === 'win32', windowsHide: true, env: withUserBinaryPaths(process.env) }); let output = ''; let settled = false; const timeout = setTimeout(() => { if (settled) return; settled = true; child.kill(); resolve({ provider: 'pi', command: this.command, installed: false, authenticated: false, errorCode: 'unknown' }); }, 5000); const finish = (status: ProviderStatus) => { if (settled) return; settled = true; clearTimeout(timeout); resolve(status); }; child.stdout?.on('data', (data) => { output += data.toString(); }); child.once('error', () => finish({ provider: 'pi', command: this.command, installed: false, authenticated: false, errorCode: 'not_installed' })); child.once('close', (code) => finish({ provider: 'pi', command: this.command, installed: code === 0, authenticated: false, version: output.trim() || undefined, errorCode: code === 0 ? undefined : 'unknown' })); }); }
}
