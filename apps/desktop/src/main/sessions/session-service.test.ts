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

  it('deletes a session and its in-memory messages', () => {
    const removed: string[] = [];
    const store = { list: () => [], save: () => undefined, delete: (id: string) => removed.push(id) };
    const service = new SessionService(store);
    service.create({ id: 'remove-me', provider: 'pi', scope: 'personal' });
    service.appendUserMessage('remove-me', '待删除');
    expect(service.delete('remove-me')).toBe(true);
    expect(service.list()).toHaveLength(0);
    expect(service.replayTranscript('remove-me')).toEqual([]);
    expect(removed).toEqual(['remove-me']);
  });

  it('preserves the original timestamps while importing a native session', () => {
    const service = new SessionService();
    service.create({ id: 'native', provider: 'claude', scope: 'personal', createdAt: 100, updatedAt: 200 } as never);
    service.importMessage({ id: 'native:message', sessionId: 'native', role: 'user', content: '历史提问', sequence: 0, createdAt: 300 });

    expect(service.get('native')).toMatchObject({ createdAt: 100, updatedAt: 300 });
  });

  it('updates timestamps for a previously imported native session', () => {
    const service = new SessionService();
    service.create({ id: 'native-existing', provider: 'claude', scope: 'personal' });

    service.updateTimestamps('native-existing', 100, 200);

    expect(service.get('native-existing')).toMatchObject({ createdAt: 100, updatedAt: 200 });
  });

  it('keeps multi-turn transcripts interleaved in write order', () => {
    const service = new SessionService();
    service.create({ id: 'order', provider: 'claude', scope: 'personal' });
    const delta = (messageId: string, sequence: number, text: string) => ({ protocolVersion: 1 as const, sessionId: 'order', messageId, provider: 'claude' as const, sequence, occurredAt: new Date().toISOString(), type: 'text_delta' as const, payload: { text } });
    service.appendUserMessage('order', '第一个问题');
    service.appendEvent(delta('m1', 0, '回答一'));
    service.appendUserMessage('order', '第二个问题');
    service.appendEvent(delta('m2', 0, '回答二'));
    expect(service.replayTranscript('order').map((message) => `${message.role}:${message.content}`)).toEqual(['user:第一个问题', 'agent:回答一', 'user:第二个问题', 'agent:回答二']);
  });

  it('tracks native run ownership across restarts and clears it on delete', () => {
    const runs: Array<Record<string, unknown>> = [];
    const store = { list: () => [], save: () => undefined, saveNativeRun: (run: Record<string, unknown>) => runs.push(run), listNativeRuns: () => runs.map((run) => ({ ...run })) as never, deleteNativeRuns: (sessionId: string) => { for (let index = runs.length - 1; index >= 0; index -= 1) if (runs[index].sessionId === sessionId) runs.splice(index, 1); } };
    const service = new SessionService(store);
    service.create({ id: 'runs-session', provider: 'claude', scope: 'personal' });
    service.recordNativeRun('runs-session', 'run-a');
    service.recordNativeRun('runs-session', 'run-b', 'C:/sessions/run-b.jsonl');

    expect(service.ownsNativeId('run-a')).toBe(true);
    expect(service.ownsNativeId('run-b')).toBe(true);
    expect(service.ownsNativeId('run-c')).toBe(false);
    expect(service.listNativeRuns('runs-session').map((run) => run.nativeId).sort()).toEqual(['run-a', 'run-b']);

    // 重启后从存储恢复归属
    const rehydrated = new SessionService(store);
    expect(rehydrated.ownsNativeId('run-a')).toBe(true);

    service.delete('runs-session');
    expect(service.ownsNativeId('run-a')).toBe(false);
    expect(runs).toHaveLength(0);
  });
});
