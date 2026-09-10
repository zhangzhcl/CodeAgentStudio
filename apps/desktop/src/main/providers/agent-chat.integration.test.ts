import { describe, expect, it } from 'vitest';
import { FakeProvider } from './fake-provider.js';
import { ProviderRuntime } from './provider-runtime.js';
import { SessionService } from '../sessions/session-service.js';
describe('agent chat integration', () => { it('streams provider events into replayable transcript', async () => { const sessions = new SessionService(); const provider = new FakeProvider('codex', sessions); const runtime = new ProviderRuntime(new Map([['codex', provider]])); const session = sessions.create({ provider: 'codex', scope: 'personal' }); const events: string[] = []; const unsubscribe = provider.subscribe((event) => { events.push(event.type); sessions.appendEvent(event); }); await runtime.start(session.id, 'codex', { scope: 'personal' }); await provider.prompt(session.id, 'hello'); unsubscribe(); expect(events).toEqual(['text_delta', 'done']); expect(sessions.replayTranscript(session.id)[0].content).toContain('hello'); }); });
