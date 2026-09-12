import type { SessionRecord, SessionService } from './session-service.js';
import { findNativeTranscriptFile, removeNativeSession } from './native-session-removal.js';

type NativeRemover = (session: SessionRecord) => Promise<{ removed: boolean }>;
type NativeRefresh = () => Promise<unknown>;

/**
 * Deletes the Agent-owned transcript first so discovery cannot recreate the app record.
 * A session accumulates one native transcript per prompt run; remove them all.
 */
export async function deleteSessionEverywhere(service: SessionService, sessionId: string, removeNative: NativeRemover = removeNativeSession, refreshNative?: NativeRefresh) {
  await refreshNative?.();
  const session = service.get(sessionId);
  let anyNativeRemoved = false;
  for (const run of service.listNativeRuns(sessionId)) {
    try {
      const file = run.nativeSessionFile ?? (await findNativeTranscriptFile(session.provider, run.nativeId));
      if (!file) continue;
      const outcome = await removeNative({ ...session, nativeId: run.nativeId, nativeSessionFile: file });
      anyNativeRemoved = anyNativeRemoved || outcome.removed;
    } catch { /* 单个历史 transcript 删除失败不阻断会话删除 */ }
  }
  const native = await removeNative(session);
  return { deleted: service.delete(sessionId), nativeDeleted: native.removed || anyNativeRemoved };
}
