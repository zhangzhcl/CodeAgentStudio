import type Database from 'better-sqlite3';
import type { SessionRecord } from '../sessions/session-service.js';
export class SessionRepository {
  constructor(private readonly db: Database.Database) {}
  save(session: SessionRecord) { this.db.prepare('INSERT INTO sessions (id,provider,scope,project_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at').run(session.id, session.provider, session.scope, session.projectId ?? null, session.status, session.createdAt, session.updatedAt); return session; }
  get(id: string) { return this.db.prepare('SELECT id,provider,scope,project_id as projectId,status,created_at as createdAt,updated_at as updatedAt FROM sessions WHERE id=?').get(id) as SessionRecord | undefined; }
  list() { return this.db.prepare('SELECT id,provider,scope,project_id as projectId,status,created_at as createdAt,updated_at as updatedAt FROM sessions ORDER BY updated_at DESC').all() as SessionRecord[]; }
}
