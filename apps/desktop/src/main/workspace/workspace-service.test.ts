import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkspaceService, WorkspaceError } from './workspace-service.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createProject() {
  const directory = await mkdtemp(join(tmpdir(), 'codeagent-studio-'));
  temporaryDirectories.push(directory);
  const service = new WorkspaceService();
  const project = await service.registerProject(directory);
  return { directory, project, service };
}

describe('WorkspaceService', () => {
  it('lists and reads project-relative files', async () => {
    const { directory, project, service } = await createProject();
    await mkdir(join(directory, 'src'));
    await writeFile(join(directory, 'src', 'main.ts'), 'export const ok = true;');

    const entries = await service.listProjectFiles(project.id, '');

    expect(entries.map((entry) => entry.path)).toEqual(['src']);
    expect(await service.readTextFile(project.id, 'src/main.ts')).toBe('export const ok = true;');
  });

  it('finds only explicitly registered project roots without creating one', async () => {
    const { directory, project, service } = await createProject();

    await expect(service.findProject(directory)).resolves.toMatchObject({ id: project.id });
    await expect(service.findProject(join(directory, 'missing'))).resolves.toBeUndefined();
    await mkdir(join(directory, 'src'));
    await expect(service.findProject(join(directory, 'src'))).resolves.toMatchObject({ id: project.id });
    expect(service.listProjects()).toHaveLength(1);
  });

  it('rejects paths escaping the registered project root', async () => {
    const { project, service } = await createProject();

    await expect(service.readTextFile(project.id, '../outside.txt')).rejects.toMatchObject({ code: 'PATH_OUTSIDE_PROJECT' });
  });

  it('rejects text files larger than the preview limit', async () => {
    const { directory, project, service } = await createProject();
    await writeFile(join(directory, 'large.txt'), Buffer.alloc(512 * 1024 + 1, 'x'));

    await expect(service.readTextFile(project.id, 'large.txt')).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('creates, renames, saves, and deletes entries inside the project', async () => {
    const { project, service } = await createProject();
    await service.createEntry(project.id, '', 'notes.md', 'file');
    await service.saveTextFile(project.id, 'notes.md', '# Notes');
    await service.renameEntry(project.id, 'notes.md', 'README.md');

    expect(await service.readTextFile(project.id, 'README.md')).toBe('# Notes');
    await service.deleteEntry(project.id, 'README.md');
    await expect(readFile(join(project.rootPath, 'README.md'))).rejects.toThrow();
  });

  it('rejects symlink escapes', async () => {
    const { directory, project, service } = await createProject();
    const outside = await mkdtemp(join(tmpdir(), 'codeagent-outside-'));
    temporaryDirectories.push(outside);
    await writeFile(join(outside, 'secret.txt'), 'secret');
    await symlink(outside, join(directory, 'linked'));

    await expect(service.listProjectFiles(project.id, 'linked')).rejects.toMatchObject({ code: 'PATH_OUTSIDE_PROJECT' });
  });
});
