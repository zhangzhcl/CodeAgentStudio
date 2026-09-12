export const SCHEMA_VERSION = 7;
export const MIGRATIONS: Record<number, string> = {
  1: `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);\nCREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, provider TEXT NOT NULL, scope TEXT NOT NULL, project_id TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`,
  2: `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, sequence INTEGER NOT NULL, created_at INTEGER NOT NULL);\nCREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, sequence);`,
  3: `ALTER TABLE sessions ADD COLUMN native_id TEXT;\nALTER TABLE sessions ADD COLUMN native_session_file TEXT;\nALTER TABLE sessions ADD COLUMN native_transcript_path TEXT;\nALTER TABLE sessions ADD COLUMN resume_capability TEXT NOT NULL DEFAULT 'replay_only';`,
  4: `ALTER TABLE sessions ADD COLUMN project_root TEXT;\nALTER TABLE sessions ADD COLUMN project_name TEXT;`,
  5: `ALTER TABLE sessions ADD COLUMN title TEXT;`,
  // Existing rows were created by the user-project registry before source
  // metadata existed. Preserve their visibility; native discovery never
  // creates project rows in the current model.
  6: `ALTER TABLE projects ADD COLUMN source TEXT NOT NULL DEFAULT 'user';`,
  // 一个 app 会话多轮运行会留下多份原生 transcript，登记归属避免发现时重复导入
  7: `CREATE TABLE IF NOT EXISTS session_native_runs (session_id TEXT NOT NULL, native_id TEXT NOT NULL, native_session_file TEXT, created_at INTEGER NOT NULL, PRIMARY KEY (session_id, native_id));`,
};
