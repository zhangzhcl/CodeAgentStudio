import { describe, expect, it, vi } from 'vitest';
import { SessionService } from './session-service.js';
import { deleteSessionEverywhere } from './session-deletion.js';

describe('deleteSessionEverywhere', () => {
  it('removes native storage before removing the application record', async () => {
    const service = new SessionService();
    service.create({ id: 'remove-me', provider: 'claude', scope: 'personal', nativeSessionFile: 'C:/sessions/remove-me.jsonl' });
    const removeNative = vi.fn().mockResolvedValue({ removed: true });

    await expect(deleteSessionEverywhere(service, 'remove-me', removeNative)).resolves.toEqual({ deleted: true, nativeDeleted: true });
    expect(removeNative).toHaveBeenCalledWith(expect.objectContaining({ id: 'remove-me' }));
    expect(service.list()).toHaveLength(0);
  });

  it('keeps the application record when native deletion fails', async () => {
    const service = new SessionService();
    service.create({ id: 'keep-me', provider: 'claude', scope: 'personal', nativeSessionFile: 'C:/sessions/keep-me.jsonl' });

    await expect(deleteSessionEverywhere(service, 'keep-me', async () => { throw new Error('permission denied'); }))
      .rejects.toThrow('permission denied');
    expect(service.get('keep-me')).toMatchObject({ id: 'keep-me' });
  });

  it('refreshes native discovery before looking up the session to delete', async () => {
    const service = new SessionService();
    service.create({ id: 'newly-written', provider: 'claude', scope: 'personal' });
    const removeNative = vi.fn().mockResolvedValue({ removed: true });
    const refresh = vi.fn(async () => {
      service.updateNative('newly-written', { nativeId: 'native-1', nativeSessionFile: 'C:/sessions/native-1.jsonl' });
    });

    await deleteSessionEverywhere(service, 'newly-written', removeNative, refresh);

    expect(refresh).toHaveBeenCalledOnce();
    expect(removeNative).toHaveBeenCalledWith(expect.objectContaining({ nativeId: 'native-1' }));
  });

  it('removes every recorded historical run transcript', async () => {
    const service = new SessionService();
    service.create({ id: 'multi-run', provider: 'claude', scope: 'personal' });
    // 多轮运行各留下一份 transcript；最新一份挂在会话上，历史轮次只有归属记录
    service.updateNative('multi-run', { nativeId: 'run-latest', nativeSessionFile: 'C:/sessions/run-latest.jsonl' });
    service.recordNativeRun('multi-run', 'run-1', 'C:/sessions/run-1.jsonl');
    service.recordNativeRun('multi-run', 'run-2', 'C:/sessions/run-2.jsonl');
    const removeNative = vi.fn().mockResolvedValue({ removed: true });

    await expect(deleteSessionEverywhere(service, 'multi-run', removeNative)).resolves.toEqual({ deleted: true, nativeDeleted: true });
    const removedIds = removeNative.mock.calls.map((call) => (call[0] as { nativeId?: string }).nativeId).sort();
    expect(removedIds).toEqual(['run-1', 'run-2', 'run-latest']);
    expect(service.listNativeRuns('multi-run')).toEqual([]);
  });
});
