import { describe, expect, it } from 'vitest';
import { providerCapabilities } from './contracts.js';

describe('agent settings capabilities', () => {
  it('allows native write-back only for Claude Code', () => {
    expect(providerCapabilities.claude.nativeWrite).toBe(true);
    expect(providerCapabilities.codex.nativeWrite).toBe(false);
  });

  it('exposes independent capability flags for model, endpoint and credentials', () => {
    for (const capability of Object.values(providerCapabilities)) {
      expect(typeof capability.model).toBe('boolean');
      expect(typeof capability.baseUrl).toBe('boolean');
      expect(typeof capability.apiKey).toBe('boolean');
    }
  });
});
