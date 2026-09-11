import { mkdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import type { AgentEvent } from '@codeagent-studio/protocol';
import type { AgentProvider, CreateSessionInput, ProviderStatus, PromptOptions } from './contracts.js';
import { resolvePiSessionsDir } from './pi-paths.js';

export type PiTransport = { createSession(input: CreateSessionInput & { sessionFile: string }): Promise<{ nativeId: string }>; resumeSession(nativeId: string, sessionFile: string): Promise<void>; prompt(nativeId: string, text: string, model?: string): Promise<void>; abort(nativeId: string): Promise<boolean>; subscribe(listener: (event: AgentEvent) => void): () => void; detect(): Promise<ProviderStatus> };

export class PiProvider implements AgentProvider {
  readonly id = 'pi' as const;
  // transport 的 prompt 不消费 PromptOptions，附件能力先声明为 false 保持与行为一致
  readonly capabilities = { maxConcurrentSessions: 4, supportsResume: true, supportsAttachments: false, supportsImages: false, supportsThinking: false, supportsWebSearch: false, supportsProjectScope: true, supportsAbort: true };
  private readonly nativeSessions = new Map<string, string>();
  private readonly appSessionsByNative = new Map<string, string>();
  constructor(private readonly transport: PiTransport, private readonly sessionsDir = resolvePiSessionsDir()) {}
  detect() { return this.transport.detect(); }
  async createSession(input: CreateSessionInput) { await mkdir(this.sessionsDir, { recursive: true }); const sessionFile = resolve(this.sessionsDir, `${crypto.randomUUID()}.jsonl`); const created = await this.transport.createSession({ ...input, sessionFile }); if (input.sessionId) { this.nativeSessions.set(input.sessionId, created.nativeId); this.appSessionsByNative.set(created.nativeId, input.sessionId); } return { ...created, nativeSessionFile: sessionFile }; }
  async resumeSession(nativeId: string, nativeSessionFile?: string, appSessionId?: string) { if (!nativeSessionFile) throw new Error('Pi resume requires native session file'); const allowed = await realpath(this.sessionsDir); const file = await realpath(resolve(nativeSessionFile)); const within = relative(allowed, file); if (!within || within === '..' || within.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(within)) throw new Error('Pi session file is outside the configured session directory'); if (!(await stat(file)).isFile()) throw new Error('Pi native session must be a file'); await this.transport.resumeSession(nativeId, file); this.nativeSessions.set(appSessionId ?? nativeId, nativeId); if (appSessionId) this.appSessionsByNative.set(nativeId, appSessionId); }
  prompt(sessionId: string, text: string, model?: string, _options?: PromptOptions) { return this.transport.prompt(this.nativeSessions.get(sessionId) ?? sessionId, text, model); }
  abort(sessionId: string) { return this.transport.abort(this.nativeSessions.get(sessionId) ?? sessionId); }
  subscribe(listener: (event: AgentEvent) => void) { return this.transport.subscribe((event) => listener({ ...event, sessionId: this.appSessionsByNative.get(event.sessionId) ?? event.sessionId })); }
}
