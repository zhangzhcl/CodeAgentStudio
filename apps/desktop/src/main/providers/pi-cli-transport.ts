import { spawn } from 'node:child_process';
import { quoteShellArg, withUserBinaryPaths } from './command-resolver.js';
import { parseCliEvent } from './cli-event-parser.js';
import type { AgentEvent } from '@codeagent-studio/protocol';
import type { CreateSessionInput, ProviderStatus } from './contracts.js';
import type { PiTransport } from './pi-provider.js';

export class PiCliTransport implements PiTransport {
  private readonly running = new Map<string, ReturnType<typeof spawn>>();
  private readonly listeners = new Set<(event: AgentEvent) => void>();
  private readonly resumed = new Map<string, string>();
  private readonly aborted = new Set<string>();

  constructor(private readonly command = process.env.CODEAGENT_PI_COMMAND ?? 'pi') {}

  async createSession(input: CreateSessionInput & { sessionFile: string }) {
    return { nativeId: input.sessionFile };
  }

  async resumeSession(nativeId: string, sessionFile: string) {
    this.resumed.set(nativeId, sessionFile);
  }

  async prompt(nativeId: string, text: string, selectedModel?: string) {
    await new Promise<void>((resolve, reject) => {
      const runMessageId = `${nativeId}:${crypto.randomUUID()}`;
      const provider = process.env.CODEAGENT_PI_PROVIDER ?? 'sensenova';
      const model = selectedModel || process.env.CODEAGENT_PI_MODEL || 'sensenova-6.8-flash-lite';
      const sessionTarget = this.resumed.get(nativeId) ?? nativeId;
      const resume = this.resumed.delete(nativeId);
      const rawArgs = buildPiPromptArgs(provider, model, sessionTarget, text, resume);
      const args = process.platform === 'win32' ? rawArgs.map((arg) => quoteShellArg(arg)) : rawArgs;
      const child = spawn(this.command, args, {
        shell: process.platform === 'win32',
        windowsHide: true,
        env: withUserBinaryPaths(process.env),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.running.set(nativeId, child);
      let sequence = 0;
      let pending = '';
      const consume = (data: Buffer) => {
        pending += data.toString();
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? '';
        lines.forEach((line) => {
          const event = parseCliEvent(line, 'pi', nativeId, sequence++, runMessageId);
          if (event) this.listeners.forEach((listener) => listener(event));
        });
      };
      child.stdout?.on('data', consume);
      child.stderr?.on('data', (data) => {
        const line = data.toString();
        if (/no api key|not logged in|authentication required|rate limit|timed out|error/i.test(line)) {
          const event = parseCliEvent(line, 'pi', nativeId, sequence++, runMessageId);
          if (event?.type === 'error') this.listeners.forEach((listener) => listener(event));
        }
      });
      child.once('error', reject);
      child.once('close', (code) => {
        if (pending.trim()) {
          const event = parseCliEvent(pending, 'pi', nativeId, sequence++, runMessageId);
          if (event) this.listeners.forEach((listener) => listener(event));
        }
        this.running.delete(nativeId);
        const wasAborted = this.aborted.delete(nativeId);
        if (!wasAborted && typeof code === 'number' && code !== 0) {
          const failure = parseCliEvent(
            JSON.stringify({ type: 'error', code: 'process_exit', message: `Pi exited with code ${code}` }),
            'pi',
            nativeId,
            sequence++,
            runMessageId,
          );
          if (failure) this.listeners.forEach((listener) => listener(failure));
        }
        resolve();
      });
    });
  }

  async abort(nativeId: string) {
    const child = this.running.get(nativeId);
    if (!child) return false;
    this.aborted.add(nativeId);
    child.kill();
    this.running.delete(nativeId);
    return true;
  }

  subscribe(listener: (event: AgentEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  detect(): Promise<ProviderStatus> {
    return new Promise((resolve) => {
      const child = spawn(this.command, ['--version'], {
        shell: process.platform === 'win32',
        windowsHide: true,
        env: withUserBinaryPaths(process.env),
      });
      let output = '';
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        resolve({ provider: 'pi', command: this.command, installed: false, authenticated: false, errorCode: 'unknown' });
      }, 5000);
      const finish = (status: ProviderStatus) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(status);
      };
      child.stdout?.on('data', (data) => { output += data.toString(); });
      child.once('error', () => finish({ provider: 'pi', command: this.command, installed: false, authenticated: false, errorCode: 'not_installed' }));
      child.once('close', (code) => finish({ provider: 'pi', command: this.command, installed: code === 0, authenticated: false, version: output.trim() || undefined, errorCode: code === 0 ? undefined : 'unknown' }));
    });
  }
}

export function buildPiPromptArgs(provider: string, model: string, nativeId: string, text: string, _resume: boolean): string[] {
  // Pi's exact session file is the deterministic continuation path for both first and subsequent turns.
  return ['--print', '--mode', 'json', '--provider', provider, '--model', model, '--session', nativeId, text];
}
