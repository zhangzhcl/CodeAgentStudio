import { describe, expect, it } from 'vitest';
import { parseProviderConfig } from './provider-config-adapters.js';

describe('provider config adapters', () => {
  it('reads Claude model and base URL without returning the token', () => {
    const result = parseProviderConfig('claude', JSON.stringify({
      env: { ANTHROPIC_BASE_URL: 'https://proxy.example/v1', ANTHROPIC_AUTH_TOKEN: 'secret' },
      model: 'sonnet',
    }), 'settings.json');
    expect(result.model).toBe('sonnet');
    expect(result.baseUrl).toBe('https://proxy.example/v1');
    expect(result.credential.present).toBe(true);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('reads Codex model and provider endpoint from TOML', () => {
    const result = parseProviderConfig('codex', [
      'model = "gpt-5.6-terra"',
      'model_provider = "custom"',
      '[model_providers.custom]',
      'base_url = "https://gateway.example/v1"',
      'env_key = "CUSTOM_API_KEY"',
    ].join('\n'), 'config.toml');
    expect(result.model).toBe('gpt-5.6-terra');
    expect(result.baseUrl).toBe('https://gateway.example/v1');
    expect(result.credential.present).toBe(true);
  });

  it('reads Pi custom provider models', () => {
    const result = parseProviderConfig('pi', JSON.stringify({
      providers: { sensenova: { baseUrl: 'https://token.example/v1', apiKey: 'secret', models: [{ id: 'flash' }] } },
    }), 'models.json');
    expect(result.baseUrl).toBe('https://token.example/v1');
    expect(result.model).toBe('flash');
    expect(result.credential.present).toBe(true);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('keeps URLs while stripping JSONC comments for OpenCode', () => {
    const result = parseProviderConfig('opencode', '{\n // comment\n "provider": { "x": { "options": { "baseURL": "https://token.example/v1" }, "models": { "m": {} } } }\n}', 'opencode.jsonc');
    expect(result.baseUrl).toBe('https://token.example/v1');
  });
});
