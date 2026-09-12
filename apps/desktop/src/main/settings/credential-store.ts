import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { safeStorage } from 'electron';
import type { AgentProviderId } from './contracts.js';

export function maskCredential(value?: string) {
  if (!value) return '';
  return `••••••••${value.slice(-3)}`;
}

export class CredentialStore {
  private readonly file: string;
  private values: Partial<Record<AgentProviderId, string>> = {};
  constructor(userDataPath: string) {
    this.file = join(userDataPath, 'agent-credentials.json');
    this.load();
  }
  private load() {
    try {
      const data = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, string>;
      if (!safeStorage.isEncryptionAvailable()) return;
      for (const [provider, encoded] of Object.entries(data)) this.values[provider as AgentProviderId] = safeStorage.decryptString(Buffer.from(encoded, 'base64'));
    } catch { /* missing or unavailable keychain */ }
  }
  private persist() {
    mkdirSync(join(this.file, '..'), { recursive: true });
    const data: Record<string, string> = {};
    if (safeStorage.isEncryptionAvailable()) for (const [provider, value] of Object.entries(this.values)) if (value) data[provider] = safeStorage.encryptString(value).toString('base64');
    writeFileSync(this.file, JSON.stringify(data, null, 2), 'utf8');
  }
  has(provider: AgentProviderId) { return Boolean(this.values[provider]); }
  get(provider: AgentProviderId) { return this.values[provider]; }
  set(provider: AgentProviderId, value: string) { this.values[provider] = value.trim(); this.persist(); }
  clear(provider: AgentProviderId) { delete this.values[provider]; this.persist(); }
}
