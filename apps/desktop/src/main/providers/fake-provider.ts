import type { AgentEvent, ProviderId } from '@codeagent-studio/protocol';
import { SessionService } from '../sessions/session-service.js';
import type { AgentProvider, CreateSessionInput, ProviderCapabilities, ProviderStatus } from './contracts.js';

export class FakeProvider implements AgentProvider {
  readonly capabilities: ProviderCapabilities = { maxConcurrentSessions: 4, supportsResume: true, supportsAttachments: false, supportsProjectScope: true, supportsAbort: true };
  promptCalls = 0; resumeCalls = 0; abortedSessionIds: string[] = [];
  private listeners = new Set<(event: AgentEvent) => void>();
  constructor(readonly id: ProviderId, private readonly sessions: SessionService) {}
  async detect(): Promise<ProviderStatus> { return { provider: this.id, installed: true, authenticated: true, version: 'fake' }; }
  async createSession(_input: CreateSessionInput): Promise<{ nativeId: string }> { return { nativeId: crypto.randomUUID() }; }
  async resumeSession(_nativeId: string): Promise<void> { this.resumeCalls += 1; }
  async prompt(sessionId: string, text: string): Promise<void> { this.promptCalls += 1; const event: AgentEvent = { protocolVersion: 1, sessionId, messageId: crypto.randomUUID(), provider: this.id, type: 'text_delta', sequence: 0, occurredAt: new Date().toISOString(), payload: { text } }; this.sessions.appendEvent(event); for (const listener of this.listeners) listener(event); }
  async abort(sessionId: string): Promise<boolean> { this.abortedSessionIds.push(sessionId); return true; }
  subscribe(listener: (event: AgentEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
