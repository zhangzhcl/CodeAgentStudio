import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { providerConfigCandidates } from './provider-config-paths.js';
import { parseProviderConfig } from './provider-config-adapters.js';
import type { AgentConfigSnapshot, AgentProviderId } from './contracts.js';

const providers: AgentProviderId[] = ['claude', 'cursor', 'codex', 'pi', 'opencode'];

export class AgentSettingsService {
  private readonly file: string;
  private readonly overrides = new Map<AgentProviderId, { model?: string; baseUrl?: string }>();
  constructor(userDataPath: string) {
    this.file = `${userDataPath}/agent-settings.json`;
    this.load();
  }
  private load() {
    try {
      const value = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, { model?: string; baseUrl?: string }>;
      for (const provider of providers) if (value[provider]) this.overrides.set(provider, value[provider]);
    } catch { /* first run */ }
  }
  private persist() {
    mkdirSync(dirname(this.file), { recursive: true });
    const value = Object.fromEntries(this.overrides.entries());
    writeFileSync(this.file, JSON.stringify(value, null, 2), 'utf8');
  }
  list(): AgentConfigSnapshot[] {
    return providers.map((provider) => this.get(provider));
  }
  get(provider: AgentProviderId): AgentConfigSnapshot {
    const path = providerConfigCandidates(provider).find((candidate) => existsSync(candidate));
    const native = path ? parseProviderConfig(provider, readFileSync(path, 'utf8'), path) : { provider, sourcePath: providerConfigCandidates(provider)[0]!, credential: { present: false } };
    const override = this.overrides.get(provider);
    return { ...native, model: override?.model ?? native.model, baseUrl: override?.baseUrl ?? native.baseUrl, sourcePath: native.sourcePath };
  }
  save(provider: AgentProviderId, patch: { model?: string; baseUrl?: string }) {
    this.overrides.set(provider, { ...this.overrides.get(provider), ...patch });
    this.persist();
    return this.get(provider);
  }
}
