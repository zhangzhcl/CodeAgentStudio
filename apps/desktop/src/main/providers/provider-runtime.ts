import type { AgentProvider } from './contracts.js';

export type RuntimeState = 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
export type RuntimeSession = { sessionId: string; provider: AgentProvider['id']; state: RuntimeState };

export class ProviderRuntime {
  private readonly active = new Map<string, RuntimeSession>();
  constructor(private readonly providers: Map<AgentProvider['id'], AgentProvider>) {}
  get(sessionId: string) { return this.active.get(sessionId); }
  async start(sessionId: string, providerId: AgentProvider['id'], input: Parameters<AgentProvider['createSession']>[0]) {
    const provider = this.providers.get(providerId); if (!provider) throw new Error(`Unknown provider: ${providerId}`);
    const count = [...this.active.values()].filter((item) => item.provider === providerId && (item.state === 'starting' || item.state === 'running')).length;
    if (count >= provider.capabilities.maxConcurrentSessions) throw new Error(`Provider ${providerId} concurrency limit reached`);
    this.active.set(sessionId, { sessionId, provider: providerId, state: 'starting' });
    try { const created = await provider.createSession({ ...input, sessionId }); this.active.set(sessionId, { sessionId, provider: providerId, state: 'running' }); return created; } catch (error) { this.active.set(sessionId, { sessionId, provider: providerId, state: 'error' }); throw error; }
  }
  async stop(sessionId: string) { const current = this.active.get(sessionId); if (!current) return false; const provider = this.providers.get(current.provider); if (!provider) return false; this.active.set(sessionId, { ...current, state: 'stopping' }); const stopped = await provider.abort(sessionId); this.active.set(sessionId, { ...current, state: 'stopped' }); return stopped; }
}
