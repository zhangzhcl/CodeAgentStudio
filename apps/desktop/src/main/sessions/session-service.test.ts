import { describe, expect, it } from 'vitest';
import { SessionService, type MessageRecord, type SessionRecord } from './session-service.js';

describe('SessionService persistence hydration', () => {
  it('loads existing sessions from a repository on startup', () => {
    const session: SessionRecord = { id: 's1', provider: 'codex', scope: 'project', projectId: 'p1', status: 'active', createdAt: 1, updatedAt: 2 };
    const message: MessageRecord = { id: 's1:m1', sessionId: 's1', role: 'agent', content: '历史消息', sequence: 0, createdAt: 2 };
    const store = { list: () => [session], get: (id: string) => id === session.id ? session : undefined, listMessages: (id: string) => id === session.id ? [message] : [], save: () => undefined };
    const service = new SessionService(store);
    expect(service.list()).toEqual([session]);
    expect(service.replayTranscript('s1')).toEqual([message]);
  });
});
