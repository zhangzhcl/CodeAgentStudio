import type Database from 'better-sqlite3';
import type { RegisteredProject } from '../workspace/workspace-service.js';
export class ProjectRepository {
  constructor(private readonly db: Database.Database) {}
  list(): RegisteredProject[] { return this.db.prepare('SELECT id, name, root_path as rootPath FROM projects ORDER BY created_at').all() as RegisteredProject[]; }
  save(project: RegisteredProject) { this.db.prepare('INSERT INTO projects (id,name,root_path,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, root_path=excluded.root_path').run(project.id, project.name, project.rootPath, Date.now()); return project; }
  remove(id: string) { this.db.prepare('DELETE FROM projects WHERE id=?').run(id); }
}
