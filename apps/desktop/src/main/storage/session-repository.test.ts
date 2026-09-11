import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** 测试沿用 Node 内置 SQLite，生产仍使用 better-sqlite3。 */
const BetterSqliteCompat = vi.hoisted(() => class {
  private readonly database: any;
  constructor(file: string) { const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite'); this.database = new DatabaseSync(file); }
  pragma(sql: string) { this.database.exec(`PRAGMA ${sql}`); }
  exec(sql: string) { this.database.exec(sql); }
  prepare(sql: string) { const statement = this.database.prepare(sql); return { get: (...args: any[]) => statement.get(...args), all: (...args: any[]) => statement.all(...args), run: (...args: any[]) => statement.run(...args) }; }
  close() { this.database.close(); }
});
vi.mock('better-sqlite3', () => ({ default: BetterSqliteCompat }));

import { openDatabase } from './database.js';
import { SessionRepository } from './session-repository.js';
import type { SessionRecord } from '../sessions/session-service.js';

describe('SessionRepository', () => {
  it('persists scope changes on upsert so reloaded sessions keep their list', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cas-session-repo-'));
    const db = openDatabase(join(dir, 'app.db'));
    const repository = new SessionRepository(db);
    const session: SessionRecord = { id: 's1', provider: 'claude', scope: 'personal', status: 'active', createdAt: 1, updatedAt: 1 };
    repository.save(session);
    repository.save({ ...session, scope: 'project', projectId: 'p1', updatedAt: 2 });
    expect((repository.get('s1') as SessionRecord).scope).toBe('project');
    db.close();
    await rm(dir, { recursive: true, force: true });
  });
});
