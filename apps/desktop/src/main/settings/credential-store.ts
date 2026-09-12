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
  private writable = true;
  constructor(userDataPath: string) {
    this.file = join(userDataPath, 'agent-credentials.json');
    this.load();
  }
  private load() {
    if (!existsSync(this.file)) return;
    try {
      const data = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, string>;
      if (!safeStorage.isEncryptionAvailable()) { this.writable = false; return; }
      for (const [provider, encoded] of Object.entries(data)) this.values[provider as AgentProviderId] = safeStorage.decryptString(Buffer.from(encoded, 'base64'));
    } catch { this.writable = false; }
  }
  private persist() {
    if (!this.writable || !safeStorage.isEncryptionAvailable()) throw new Error('Credential encryption is unavailable; existing credentials were not changed');
    mkdirSync(join(this.file, '..'), { recursive: true });
    const data: Record<string, string> = {};
    for (const [provider, value] of Object.entries(this.values)) if (value) data[provider] = safeStorage.encryptString(value).toString('base64');
    writeFileSync(this.file, JSON.stringify(data, null, 2), 'utf8');
  }
  has(provider: AgentProviderId) { return Boolean(this.values[provider]); }
  get(provider: AgentProviderId) { return this.values[provider]; }
  set(provider: AgentProviderId, value: string) {
    const previous = this.values[provider];
    this.values[provider] = value.trim();
    try { this.persist(); } catch (error) { if (previous) this.values[provider] = previous; else delete this.values[provider]; throw error; }
  }
  clear(provider: AgentProviderId) {
    const previous = this.values[provider];
    delete this.values[provider];
    try { this.persist(); } catch (error) { if (previous) this.values[provider] = previous; throw error; }
  }
}
