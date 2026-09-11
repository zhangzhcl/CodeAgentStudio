import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** Use Node's built-in SQLite engine in tests while keeping better-sqlite3 in production. */
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

describe('database', () => {
  it('creates all tables and migrates an empty database to the current schema', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cas-db-')); const db = openDatabase(join(dir, 'app.db'));
    expect((db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number }).version).toBe(6);
    expect((db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>).map((item) => item.name)).toEqual(['messages', 'projects', 'schema_version', 'sessions']);
    expect((db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>).some((column) => column.name === 'source')).toBe(true);
    db.close(); await rm(dir, { recursive: true, force: true });
  });

  it('upgrades a legacy v5 database and preserves existing projects as user projects', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cas-db-')); const file = join(dir, 'legacy.db'); const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite'); const legacy = new DatabaseSync(file);
    legacy.exec("CREATE TABLE schema_version (version INTEGER NOT NULL); INSERT INTO schema_version VALUES (5); CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL); INSERT INTO projects VALUES ('p','Demo','C:/Demo',1);"); legacy.close();
    const db = openDatabase(file); expect((db.prepare('SELECT source FROM projects WHERE id=?').get('p') as { source: string }).source).toBe('user'); db.close(); await rm(dir, { recursive: true, force: true });
  });

  it('backs up a corrupt database before recreating it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cas-db-')); const file = join(dir, 'broken.db'); await writeFile(file, 'not a sqlite database');
    const db = openDatabase(file); db.close(); expect((await readFile(file)).length).toBeGreaterThan(0); expect((await readdir(dir)).filter((item) => item.startsWith('broken.db.corrupt-'))).toHaveLength(1); await rm(dir, { recursive: true, force: true });
  });
});
