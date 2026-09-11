import { describe, expect, it, vi } from 'vitest';
import { ProjectRepository } from './project-repository.js';

describe('ProjectRepository', () => {
  it('rejects unknown project source values at the persistence boundary', () => {
    const run = vi.fn();
    const db = { prepare: vi.fn(() => ({ run })) } as never;
    const repository = new ProjectRepository(db);
    expect(() => repository.save({ id: 'p', name: 'Demo', rootPath: 'C:/Demo', source: 'invalid' as never })).toThrow('Invalid project source');
    expect(run).not.toHaveBeenCalled();
  });
});
