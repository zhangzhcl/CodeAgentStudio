import type { AgentProvider, ProviderStatus } from './contracts.js';

export class ProviderRegistry {
  constructor(private readonly providers: AgentProvider[]) {}
  list() { return [...this.providers]; }
  get(id: AgentProvider['id']) { return this.providers.find((provider) => provider.id === id); }
  async detectAll(): Promise<ProviderStatus[]> {
    return Promise.all(this.providers.map(async (provider) => {
      try { return await provider.detect(); } catch { return { provider: provider.id, installed: false, authenticated: false, errorCode: 'unknown' as const }; }
    }));
  }
}
