import Database from 'better-sqlite3';
import { MIGRATIONS } from './schema.js';
export function openDatabase(file: string) { const db = new Database(file); db.pragma('journal_mode = WAL'); db.exec(MIGRATIONS[1]); return db; }
