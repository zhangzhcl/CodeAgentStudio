import { access, lstat, mkdir, open, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createReadStream } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { WorkspaceEntry } from '@codeagent-studio/protocol';

const MAX_TEXT_PREVIEW_BYTES = 512 * 1024;

export class WorkspaceError extends Error {
  constructor(public readonly code: 'PROJECT_NOT_FOUND' | 'PATH_OUTSIDE_PROJECT' | 'FILE_NOT_FOUND' | 'FILE_TOO_LARGE' | 'INVALID_ENTRY', message: string) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

export type ProjectSource = 'user' | 'native-discovered';
export type RegisteredProject = { id: string; name: string; rootPath: string; source: ProjectSource };
type ProjectStore = { list(): RegisteredProject[]; save(project: RegisteredProject): unknown };

function isWithinRoot(rootPath: string, targetPath: string): boolean {
  const path = resolve(targetPath);
  const root = resolve(rootPath);
  return path === root || path.startsWith(`${root}${sep}`);
}

export class WorkspaceService {
  private readonly projects = new Map<string, RegisteredProject>();
  constructor(private readonly store?: ProjectStore) { for (const project of store?.list() ?? []) this.projects.set(project.id, project); }

  listProjects(): RegisteredProject[] { return [...this.projects.values()].filter((project) => project.source === 'user'); }
  /** Look up a project the user explicitly registered without creating one. */
  async findProject(rootPath: string): Promise<RegisteredProject | undefined> {
    const canonicalRoot = await realpath(rootPath).catch(() => undefined);
    if (!canonicalRoot) return undefined;
    return [...this.projects.values()]
      .filter((project) => project.source === 'user')
      .filter((project) => isWithinRoot(project.rootPath, canonicalRoot))
      .sort((a, b) => b.rootPath.length - a.rootPath.length)[0];
  }
  /** @deprecated Use registerProject for an explicit user-selected project. */
  async ensureProject(rootPath: string): Promise<RegisteredProject> { return this.registerProject(rootPath); }
  browseWorkspace(projectId: string, relativePath = '') { return this.listProjectFiles(projectId, relativePath); }
  async openFileStream(projectId: string, relativePath: string) {
    const { path } = await this.resolvePath(projectId, relativePath);
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const info = await handle.stat();
      if (!info.isFile()) throw new WorkspaceError('INVALID_ENTRY', 'Only files can be streamed');
      // The stream owns this descriptor and closes it when consumption ends.
      return createReadStream('', { fd: handle.fd, autoClose: true });
    } catch (error) {
      await handle.close().catch(() => undefined);
      throw error;
    }
  }

  async registerProject(rootPath: string): Promise<RegisteredProject> {
    const canonicalRoot = await realpath(rootPath).catch(() => {
      throw new WorkspaceError('PROJECT_NOT_FOUND', `Project does not exist: ${rootPath}`);
    });
    const metadata = await stat(canonicalRoot);
    if (!metadata.isDirectory()) {
      throw new WorkspaceError('INVALID_ENTRY', 'Project root must be a directory');
    }
    const existing = [...this.projects.values()].find((item) => resolve(item.rootPath) === resolve(canonicalRoot));
    if (existing) {
      const promoted = { ...existing, source: 'user' as const };
      this.projects.set(existing.id, promoted);
      this.store?.save(promoted);
      return promoted;
    }
    const project = { id: randomUUID(), name: basename(canonicalRoot), rootPath: canonicalRoot, source: 'user' as const };
    this.projects.set(project.id, project);
    this.store?.save(project);
    return project;
  }

  private getProject(projectId: string): RegisteredProject {
    const project = this.projects.get(projectId);
    if (!project) throw new WorkspaceError('PROJECT_NOT_FOUND', `Unknown project: ${projectId}`);
    return project;
  }

  private async resolvePath(projectId: string, relativePath: string, allowMissing = false): Promise<{ project: RegisteredProject; path: string }> {
    const project = this.getProject(projectId);
    if (relativePath.includes('\0')) throw new WorkspaceError('PATH_OUTSIDE_PROJECT', 'Invalid path');
    const candidate = resolve(project.rootPath, relativePath || '.');
    if (!isWithinRoot(project.rootPath, candidate)) throw new WorkspaceError('PATH_OUTSIDE_PROJECT', 'Path must stay inside the project');
    const canonical = await realpath(candidate).catch(async () => {
      if (!allowMissing) throw new WorkspaceError('FILE_NOT_FOUND', `Path does not exist: ${relativePath}`);
      const parent = await realpath(dirname(candidate)).catch(() => {
        throw new WorkspaceError('PATH_OUTSIDE_PROJECT', 'Parent path is invalid');
      });
      return join(parent, basename(candidate));
    });
    if (!isWithinRoot(project.rootPath, canonical)) throw new WorkspaceError('PATH_OUTSIDE_PROJECT', 'Path must stay inside the project');
    return { project, path: canonical };
  }

  async listProjectFiles(projectId: string, parentRelativePath = ''): Promise<WorkspaceEntry[]> {
    const { project, path } = await this.resolvePath(projectId, parentRelativePath);
    const info = await stat(path);
    if (!info.isDirectory()) throw new WorkspaceError('INVALID_ENTRY', 'Path is not a directory');
    const entries = await readdir(path, { withFileTypes: true });
    const result: WorkspaceEntry[] = [];
    for (const entry of entries) {
      const childPath = join(path, entry.name);
      const childInfo = await lstat(childPath);
      if (childInfo.isSymbolicLink()) continue;
      const relativePath = relative(project.rootPath, childPath).split(sep).join('/');
      result.push({ name: entry.name, path: relativePath, isDirectory: entry.isDirectory(), mtime: childInfo.mtimeMs, size: childInfo.isFile() ? childInfo.size : 0 });
    }
    return result.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
  }

  async readTextFile(projectId: string, relativePath: string): Promise<string> {
    const { path } = await this.resolvePath(projectId, relativePath);
    const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
    const handle = await open(path, flags);
    try {
      const info = await handle.stat();
      if (!info.isFile()) throw new WorkspaceError('INVALID_ENTRY', 'Only files can be read as text');
      if (info.size > MAX_TEXT_PREVIEW_BYTES) throw new WorkspaceError('FILE_TOO_LARGE', `Text preview exceeds ${MAX_TEXT_PREVIEW_BYTES} bytes`);
      return await handle.readFile('utf8');
    } finally {
      await handle.close();
    }
  }

  async saveTextFile(projectId: string, relativePath: string, content: string): Promise<void> {
    const { path } = await this.resolvePath(projectId, relativePath, true);
    const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (constants.O_NOFOLLOW ?? 0);
    const handle = await open(path, flags, 0o644);
    try {
      const info = await handle.stat();
      if (!info.isFile()) throw new WorkspaceError('INVALID_ENTRY', 'Only files can be written');
      await handle.writeFile(content, 'utf8');
    } finally {
      await handle.close();
    }
  }

  async createEntry(projectId: string, parentRelativePath: string, name: string, kind: 'file' | 'directory'): Promise<void> {
    if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) throw new WorkspaceError('INVALID_ENTRY', 'Invalid entry name');
    const { path } = await this.resolvePath(projectId, join(parentRelativePath, name), true);
    await access(path, constants.F_OK).then(() => { throw new WorkspaceError('INVALID_ENTRY', 'Entry already exists'); }).catch((error: unknown) => {
      if (error instanceof WorkspaceError) throw error;
    });
    if (kind === 'directory') await mkdir(path, { recursive: false });
    else await writeFile(path, '', { encoding: 'utf8', flag: 'wx' });
  }

  async renameEntry(projectId: string, relativePath: string, newName: string): Promise<void> {
    if (!newName || newName === '.' || newName === '..' || newName.includes('/') || newName.includes('\\')) throw new WorkspaceError('INVALID_ENTRY', 'Invalid entry name');
    const source = await this.resolvePath(projectId, relativePath);
    const destination = await this.resolvePath(projectId, join(relative(dirname(relativePath), newName)), true);
    await rename(source.path, destination.path);
  }

  async deleteEntry(projectId: string, relativePath: string): Promise<void> {
    const { path } = await this.resolvePath(projectId, relativePath);
    await rm(path, { recursive: true, force: false });
  }
}
