import { describe, expect, it } from 'vitest';
import { FakeProvider } from './fake-provider.js';
import { ProviderRuntime } from './provider-runtime.js';
import { SessionService } from '../sessions/session-service.js';
describe('ProviderRuntime', () => { it('enforces provider concurrency and isolates stop', async () => { const provider = new FakeProvider('codex', new SessionService()); const runtime = new ProviderRuntime(new Map([['codex', provider]])); for (const id of ['a', 'b', 'c', 'd']) await runtime.start(id, 'codex', { scope: 'personal' }); await expect(runtime.start('e', 'codex', { scope: 'personal' })).rejects.toThrow('concurrency'); expect(await runtime.stop('a')).toBe(true); expect(runtime.get('a')?.state).toBe('stopped'); }); });
