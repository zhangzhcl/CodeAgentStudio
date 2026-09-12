import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AgentProviderId } from './contracts.js';
import { providerConfigCandidates } from './provider-config-paths.js';

export function assertNativeWriteAllowed(provider: AgentProviderId) {
  if (provider !== 'claude') throw new Error('read_only_provider');
}

export function writeClaudeSettings(patch: { model?: string; baseUrl?: string }) {
  assertNativeWriteAllowed('claude');
  const path = providerConfigCandidates('claude')[0]!;
  const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as Record<string, any> : {};
  const next = { ...current, ...(patch.model ? { model: patch.model } : {}), env: { ...(current.env ?? {}), ...(patch.baseUrl ? { ANTHROPIC_BASE_URL: patch.baseUrl } : {}) } };
  if (existsSync(path)) copyFileSync(path, `${path}.bak-${Date.now()}`);
  const temporary = join(dirname(path), `.settings-${process.pid}-${Date.now()}.tmp`);
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  renameSync(temporary, path);
  return path;
}
