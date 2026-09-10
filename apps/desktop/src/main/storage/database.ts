import Database from 'better-sqlite3';
import { existsSync, renameSync } from 'node:fs';
import { MIGRATIONS, SCHEMA_VERSION } from './schema.js';
function initializeDatabase(file: string) { const db = new Database(file); try { db.pragma('journal_mode = WAL'); db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)'); const current = (db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version?: number } | undefined)?.version ?? 0; for (let version = current + 1; version <= SCHEMA_VERSION; version += 1) { db.exec(MIGRATIONS[version]); db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version); } return db; } catch (error) { db.close(); throw error; } }
function isCorruptDatabase(error: unknown) { const value = error as { code?: string; message?: string }; return value.code === 'SQLITE_CORRUPT' || /database disk image is malformed/i.test(value.message ?? ''); }
export function openDatabase(file: string) {
  try { return initializeDatabase(file); } catch (error) {
    if (!isCorruptDatabase(error)) throw error;
    // Keep the damaged database for recovery/audit, then start with a clean schema.
    const backup = `${file}.corrupt-${Date.now()}`;
    for (const suffix of ['', '-wal', '-shm']) { const source = `${file}${suffix}`; if (existsSync(source)) renameSync(source, `${backup}${suffix}`); }
    return initializeDatabase(file);
  }
}
