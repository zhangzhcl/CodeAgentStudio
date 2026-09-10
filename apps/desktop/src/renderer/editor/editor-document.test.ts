import { describe, expect, it } from 'vitest';
import { EditorDocument } from './editor-document.js';

describe('EditorDocument', () => {
  it('tracks dirty state and accepts a save with the same disk version', () => {
    const document = new EditorDocument('README.md', 'hello', { mtime: 1, size: 5, hash: 'a' });
    document.update('hello world');
    expect(document.dirty).toBe(true);
    expect(document.prepareSave({ mtime: 1, size: 5, hash: 'a' })).toEqual({ ok: true, content: 'hello world' });
  });

  it('reports a conflict when disk content changed since loading', () => {
    const document = new EditorDocument('README.md', 'hello', { mtime: 1, size: 5, hash: 'a' });
    document.update('changed locally');
    expect(document.prepareSave({ mtime: 2, size: 7, hash: 'b' })).toEqual({ ok: false, reason: 'CONFLICT' });
  });
});
