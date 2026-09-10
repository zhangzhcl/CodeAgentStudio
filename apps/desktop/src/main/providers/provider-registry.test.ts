import { describe, expect, it } from 'vitest';
import { ProviderRegistry } from './provider-registry.js';
import { FakeProvider } from './fake-provider.js';
import { SessionService } from '../sessions/session-service.js';
describe('ProviderRegistry', () => { it('detects all registered providers', async () => { const registry = new ProviderRegistry([new FakeProvider('codex', new SessionService())]); expect((await registry.detectAll())[0].provider).toBe('codex'); expect(registry.get('codex')).toBeDefined(); }); });
