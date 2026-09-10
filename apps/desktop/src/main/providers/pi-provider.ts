import { mkdir, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { AgentEvent } from '@codeagent-studio/protocol';
import type { AgentProvider, CreateSessionInput, ProviderStatus } from './contracts.js';

export type PiTransport = { createSession(input: CreateSessionInput & { sessionFile: string }): Promise<{ nativeId: string }>; resumeSession(nativeId: string, sessionFile: string): Promise<void>; prompt(nativeId: string, text: string): Promise<void>; abort(nativeId: string): Promise<boolean>; subscribe(listener: (event: AgentEvent) => void): () => void; detect(): Promise<ProviderStatus> };

export class PiProvider implements AgentProvider {
  readonly id = 'pi' as const;
  readonly capabilities = { maxConcurrentSessions: 4, supportsResume: true, supportsAttachments: false, supportsProjectScope: true, supportsAbort: true };
  private readonly nativeSessions = new Map<string, string>();
  constructor(private readonly transport: PiTransport, private readonly sessionsDir = process.env.CODEAGENT_PI_SESSION_DIR ?? join(homedir(), '.codeagent-studio', 'pi-sessions')) {}
  detect() { return this.transport.detect(); }
  async createSession(input: CreateSessionInput) { await mkdir(this.sessionsDir, { recursive: true }); const sessionFile = resolve(this.sessionsDir, `${crypto.randomUUID()}.jsonl`); const created = await this.transport.createSession({ ...input, sessionFile }); if (input.sessionId) this.nativeSessions.set(input.sessionId, created.nativeId); return { ...created, nativeSessionFile: sessionFile }; }
  async resumeSession(nativeId: string, nativeSessionFile?: string, appSessionId?: string) { if (!nativeSessionFile) throw new Error('Pi resume requires native session file'); const allowed = await realpath(this.sessionsDir); const file = resolve(nativeSessionFile); const relative = file.slice(allowed.length); if (!relative.startsWith('/') && !relative.startsWith('\\')) throw new Error('Pi session file is outside the project session directory'); await this.transport.resumeSession(nativeId, file); this.nativeSessions.set(appSessionId ?? nativeId, nativeId); }
  prompt(sessionId: string, text: string) { return this.transport.prompt(this.nativeSessions.get(sessionId) ?? sessionId, text); }
  abort(sessionId: string) { return this.transport.abort(this.nativeSessions.get(sessionId) ?? sessionId); }
  subscribe(listener: (event: AgentEvent) => void) { return this.transport.subscribe(listener); }
}
