import { describe, expect, it } from 'vitest';
import type { AgentEvent, ProviderId } from '@codeagent-studio/protocol';
import { SessionService } from '../sessions/session-service.js';
import type { AgentProvider } from './contracts.js';
import { FakeProvider } from './fake-provider.js';

describe('provider and session contract', () => {
  it('replays a transcript without starting the provider', async () => {
    const sessions = new SessionService();
    const provider = new FakeProvider('pi', sessions);
    const session = sessions.create({ provider: 'pi', scope: 'project', projectId: 'p1' });
    const replay = sessions.replayTranscript(session.id);

    expect(replay).toEqual([]);
    expect(provider.promptCalls).toBe(0);
  });

  it('resumes only when the provider advertises resume support', async () => {
    const sessions = new SessionService();
    const provider = new FakeProvider('pi', sessions);
    const session = sessions.create({ provider: 'pi', scope: 'personal' });

    await provider.resumeSession(session.id);

    expect(provider.resumeCalls).toBe(1);
  });

  it('keeps events and aborts isolated per session', async () => {
    const sessions = new SessionService();
    const provider = new FakeProvider('pi', sessions);
    const first = sessions.create({ provider: 'pi', scope: 'personal' });
    const second = sessions.create({ provider: 'pi', scope: 'personal' });
    const events: AgentEvent[] = [];
    provider.subscribe((event) => events.push(event));

    await Promise.all([provider.prompt(first.id, 'one'), provider.prompt(second.id, 'two')]);
    await provider.abort(first.id);

    expect(events.map((event) => event.sessionId)).toEqual([first.id, second.id]);
    expect(new Set(events.map((event) => event.sequence))).toEqual(new Set([0, 0]));
    expect(provider.abortedSessionIds).toEqual([first.id]);
  });
});
