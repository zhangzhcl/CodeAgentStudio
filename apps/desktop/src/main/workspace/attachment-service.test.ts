import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stageAttachments } from './attachment-service.js';

describe('stageAttachments', () => {
  it('copies an external file into the project attachment sandbox', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codeagent-project-'));
    const sourceDir = await mkdtemp(join(tmpdir(), 'codeagent-source-'));
    const source = join(sourceDir, 'note.txt');
    await writeFile(source, 'hello', 'utf8');
    const [result] = await stageAttachments(root, 'session-1', [{ sourcePath: source, mimeType: 'text/plain' }]);
    expect(result?.relativePath).toMatch(/^\.codeagent\/attachments\/session-1\//);
    expect(await readFile(join(root, result!.relativePath), 'utf8')).toBe('hello');
  });
  it('rejects unsupported file types', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codeagent-project-'));
    const source = join(root, 'secret.exe');
    await writeFile(source, 'x');
    await expect(stageAttachments(root, 'session-1', [{ sourcePath: source }])).rejects.toThrow('不支持的附件类型');
  });
  it('rejects session ids with path characters', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codeagent-project-'));
    const sourceDir = await mkdtemp(join(tmpdir(), 'codeagent-source-'));
    const source = join(sourceDir, 'note.txt');
    await writeFile(source, 'hello', 'utf8');
    await expect(stageAttachments(root, '../../escape', [{ sourcePath: source }])).rejects.toThrow('非法的会话标识');
  });
  it('cleans up already copied files when a later attachment fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codeagent-project-'));
    const sourceDir = await mkdtemp(join(tmpdir(), 'codeagent-source-'));
    const good = join(sourceDir, 'a.txt');
    const bad = join(sourceDir, 'b.exe');
    await writeFile(good, 'a');
    await writeFile(bad, 'b');
    await expect(stageAttachments(root, 'session-1', [{ sourcePath: good }, { sourcePath: bad }])).rejects.toThrow('不支持的附件类型');
    expect(await readdir(join(root, '.codeagent', 'attachments', 'session-1'))).toEqual([]);
  });
});
