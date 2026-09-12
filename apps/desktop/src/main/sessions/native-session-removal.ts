import { lstat, readdir, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { SessionRecord } from './session-service.js';
import { resolvePiSessionsDir } from '../providers/pi-paths.js';

export type NativeSessionStorageRoots = Partial<{
  claudeHome: string;
  codexHome: string;
  cursorHome: string;
  piSessionsDir: string;
  opencodeDbPath: string;
}>;

const isInside = (root: string, target: string) => {
  const path = relative(resolve(root), resolve(target));
  return Boolean(path) && !path.startsWith('..') && !isAbsolute(path);
};

function rootsFor(provider: SessionRecord['provider'], overrides: NativeSessionStorageRoots): string[] {
  const claudeHome = overrides.claudeHome ?? process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
  const codexHome = overrides.codexHome ?? process.env.CODEX_HOME ?? join(homedir(), '.codex');
  const cursorHome = overrides.cursorHome ?? process.env.CURSOR_HOME ?? join(homedir(), '.cursor');
  if (provider === 'claude') return [join(claudeHome, 'projects'), join(claudeHome, 'sessions')];
  if (provider === 'codex') return [join(codexHome, 'sessions'), join(codexHome, 'archived_sessions')];
  if (provider === 'cursor') return [join(cursorHome, 'chats')];
  if (provider === 'pi') return [overrides.piSessionsDir ?? resolvePiSessionsDir()];
  return [];
}

async function openCodeDatabasePath(overrides: NativeSessionStorageRoots): Promise<string | undefined> {
  const candidates = [
    overrides.opencodeDbPath,
    process.env.OPENCODE_DB,
    process.env.XDG_DATA_HOME ? join(process.env.XDG_DATA_HOME, 'opencode', 'opencode.db') : undefined,
    join(homedir(), '.local', 'share', 'opencode', 'opencode.db'),
    join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'opencode', 'opencode.db'),
    join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'opencode', 'opencode.db'),
    join(homedir(), '.config', 'opencode', 'opencode.db'),
  ].filter((value): value is string => Boolean(value));
  for (const path of candidates) if (await lstat(path).then((info) => info.isFile()).catch(() => false)) return path;
  return undefined;
}

async function removeOpenCodeSession(nativeId: string, overrides: NativeSessionStorageRoots): Promise<{ removed: boolean }> {
  const path = await openCodeDatabasePath(overrides);
  if (!path) throw new Error('OpenCode session database was not found');
  const { default: Database } = await import('better-sqlite3');
  const database = new Database(path);
  try {
    database.exec('BEGIN IMMEDIATE');
    database.prepare('DELETE FROM part WHERE message_id IN (SELECT id FROM message WHERE session_id = ?)').run(nativeId);
    database.prepare('DELETE FROM message WHERE session_id = ?').run(nativeId);
    const result = database.prepare('DELETE FROM session WHERE id = ?').run(nativeId);
    database.exec('COMMIT');
    return { removed: result.changes > 0 };
  } catch (error) {
    try { database.exec('ROLLBACK'); } catch { /* transaction was not opened */ }
    throw error;
  } finally {
    database.close();
  }
}

/** Removes only a known file underneath the selected provider's session store. */
/** 运行期只登记了原生 session id 时，按文件名在存储根下定位 transcript 文件。 */
async function findTranscriptByName(root: string, fileName: string, depth = 0): Promise<string | undefined> {
  if (depth > 5) return undefined;
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isFile() && entry.name === fileName) return path;
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const hit = await findTranscriptByName(path, fileName, depth + 1);
      if (hit) return hit;
    }
  }
  return undefined;
}

export async function findNativeTranscriptFile(provider: SessionRecord['provider'], nativeId: string, overrides: NativeSessionStorageRoots = {}): Promise<string | undefined> {
  if (provider === 'opencode') return undefined; // OpenCode 存在数据库中，没有独立文件
  for (const root of rootsFor(provider, overrides)) {
    const hit = await findTranscriptByName(root, `${nativeId}.jsonl`);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * codex 的流式输出只上报 thread_id，而发现层使用的 nativeId 是完整的
 * rollout-<时间戳>-<thread_id> 文件名；登记前按后缀解析成完整名。
 */
async function findBySuffix(root: string, threadId: string, depth = 0): Promise<string | undefined> {
  if (depth > 5) return undefined;
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isFile() && entry.name.endsWith(`-${threadId}.jsonl`)) return entry.name.replace(/\.jsonl$/, '');
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const hit = await findBySuffix(path, threadId, depth + 1);
      if (hit) return hit;
    }
  }
  return undefined;
}

export async function resolveCodexRolloutId(threadId: string, overrides: NativeSessionStorageRoots = {}): Promise<string> {
  for (const root of rootsFor('codex', overrides)) {
    const hit = await findBySuffix(root, threadId);
    if (hit) return hit;
  }
  return threadId;
}

export async function removeNativeSession(record: SessionRecord, overrides: NativeSessionStorageRoots = {}): Promise<{ removed: boolean }> {
  if (record.provider === 'opencode' && record.nativeId) return removeOpenCodeSession(record.nativeId, overrides);
  if (!record.nativeSessionFile) {
    if (record.nativeId) throw new Error(`Cannot safely remove the native ${record.provider} session because its storage file is unknown`);
    return { removed: false };
  }
  const roots = rootsFor(record.provider, overrides);
  if (!roots.length) return { removed: false };
  if (!roots.some((root) => isInside(root, record.nativeSessionFile!))) {
    throw new Error(`Native session file is outside ${record.provider === 'claude' ? 'Claude' : record.provider} session storage`);
  }
  try {
    const info = await lstat(record.nativeSessionFile);
    if (!info.isFile() && !info.isSymbolicLink()) throw new Error('Native session path is not a file');
    await unlink(record.nativeSessionFile);
    return { removed: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { removed: false };
    throw error;
  }
}
