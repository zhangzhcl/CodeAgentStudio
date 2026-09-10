import { describe, expect, it } from 'vitest';
import { ProviderRegistry } from './provider-registry.js';
import { FakeProvider } from './fake-provider.js';
describe('ProviderRegistry', () => { it('detects all registered providers', async () => { const registry = new ProviderRegistry([new FakeProvider()]); expect((await registry.detectAll())[0].provider).toBe('codex'); expect(registry.get('codex')).toBeDefined(); }); });
