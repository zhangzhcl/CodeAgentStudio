import { mkdtemp, writeFile, access, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import type { SessionRecord } from './session-service.js';

/** better-sqlite3 的 native binding 面向 Electron ABI，Node 测试进程用内置 SQLite 兼容替代。 */
const BetterSqliteCompat = vi.hoisted(() => class {
  private readonly database: any;
  constructor(file: string) { const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite'); this.database = new DatabaseSync(file); }
  exec(sql: string) { this.database.exec(sql); }
  prepare(sql: string) { const statement = this.database.prepare(sql); return { get: (...args: any[]) => statement.get(...args), all: (...args: any[]) => statement.all(...args), run: (...args: any[]) => statement.run(...args) }; }
  close() { this.database.close(); }
});
vi.mock('better-sqlite3', () => ({ default: BetterSqliteCompat }));

import { removeNativeSession, resolveCodexRolloutId } from './native-session-removal.js';

const session = (nativeSessionFile: string): SessionRecord => ({
  id: 'claude-native-session', provider: 'claude', scope: 'personal', nativeId: 'native', nativeSessionFile,
  status: 'done', createdAt: 1, updatedAt: 1,
});

describe('removeNativeSession', () => {
  it('removes a Claude native transcript only when it is inside Claude storage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cas-native-remove-'));
    const claudeHome = join(root, 'claude');
    const transcript = join(claudeHome, 'projects', 'project-a', 'native.jsonl');
    await mkdir(join(claudeHome, 'projects', 'project-a'), { recursive: true });
    await writeFile(transcript, '{"type":"message"}\n', { encoding: 'utf8', flush: true });

    await expect(removeNativeSession(session(transcript), { claudeHome })).resolves.toEqual({ removed: true });
    await expect(access(transcript)).rejects.toThrow();
  });

  it('refuses to delete a transcript outside the provider storage root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cas-native-remove-'));
    const outside = join(root, 'outside.jsonl');
    await writeFile(outside, '{}', 'utf8');

    await expect(removeNativeSession(session(outside), { claudeHome: join(root, 'claude') }))
      .rejects.toThrow('outside Claude session storage');
    await expect(access(outside)).resolves.toBeUndefined();
  });

  it('resolves a Codex thread id into the full rollout file name', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cas-native-remove-'));
    const codexHome = join(root, 'codex');
    await mkdir(join(codexHome, 'sessions', '2026', '09', '12'), { recursive: true });
    await writeFile(join(codexHome, 'sessions', '2026', '09', '12', 'rollout-2026-09-12T23-46-39-01a0964c-a198-7483-99d2-c0bd6022f901.jsonl'), '{}\n', 'utf8');

    await expect(resolveCodexRolloutId('01a0964c-a198-7483-99d2-c0bd6022f901', { codexHome })).resolves.toBe('rollout-2026-09-12T23-46-39-01a0964c-a198-7483-99d2-c0bd6022f901');
    // 找不到对应文件时原样返回，发现层仍可按 thread id 兜底
    await expect(resolveCodexRolloutId('00000000-0000-0000-0000-000000000000', { codexHome })).resolves.toBe('00000000-0000-0000-0000-000000000000');
  });

  it('removes an OpenCode native session with its messages and parts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cas-native-remove-'));
    const databasePath = join(root, 'opencode.db');
    const database = new DatabaseSync(databasePath);
    database.exec('CREATE TABLE session (id TEXT PRIMARY KEY); CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT); CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT);');
    database.prepare('INSERT INTO session (id) VALUES (?)').run('native-session');
    database.prepare('INSERT INTO message (id, session_id) VALUES (?, ?)').run('message-1', 'native-session');
    database.prepare('INSERT INTO part (id, message_id) VALUES (?, ?)').run('part-1', 'message-1');
    database.close();

    await expect(removeNativeSession({ ...session(''), provider: 'opencode', nativeId: 'native-session', nativeSessionFile: undefined }, { opencodeDbPath: databasePath })).resolves.toEqual({ removed: true });
    const verify = new DatabaseSync(databasePath, { readOnly: true });
    expect(verify.prepare('SELECT * FROM session').all()).toEqual([]);
    expect(verify.prepare('SELECT * FROM message').all()).toEqual([]);
    expect(verify.prepare('SELECT * FROM part').all()).toEqual([]);
    verify.close();
  });

});
