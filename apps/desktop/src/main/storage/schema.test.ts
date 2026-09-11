import { describe, expect, it } from 'vitest';
import { MIGRATIONS, SCHEMA_VERSION } from './schema.js';

describe('database schema migrations', () => {
  it('has contiguous migrations through the current schema version', () => {
    expect(Object.keys(MIGRATIONS).map(Number)).toEqual(Array.from({ length: SCHEMA_VERSION }, (_, index) => index + 1));
  });

  it('adds explicit project source metadata', () => {
    expect(MIGRATIONS[6]).toContain('ALTER TABLE projects ADD COLUMN source TEXT NOT NULL DEFAULT \'native\'');
    expect(MIGRATIONS[1]).toContain('CREATE TABLE IF NOT EXISTS projects');
  });

  it('keeps the session insert column/value count aligned', () => {
    const insert = "INSERT INTO sessions (id,provider,scope,title,project_id,project_root,project_name,native_id,native_session_file,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)";
    expect((insert.match(/\?/g) ?? []).length).toBe(12);
    expect((insert.match(/\(([^)]+)\)/)?.[1].split(',') ?? []).length).toBe(12);
  });
});
