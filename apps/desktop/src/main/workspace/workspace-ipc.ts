import { ipcMain, dialog } from 'electron';
import { z } from 'zod';
import type { WorkspaceService } from './workspace-service.js';

const projectIdSchema = z.string().min(1);
const relativePathSchema = z.string().max(4096);
const entryNameSchema = z.string().min(1).max(255);
const contentSchema = z.string().max(20 * 1024 * 1024);
const projectRegistrationSchema = z.string().min(1).max(32768);

export function registerWorkspaceIpc(service: WorkspaceService) {
  ipcMain.handle('workspace:projects', () => service.listProjects());
  ipcMain.handle('workspace:register-project', (_event, rootPath: unknown) => service.registerProject(projectRegistrationSchema.parse(rootPath)));
  ipcMain.handle('workspace:choose-project', async () => { const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] }); if (result.canceled || !result.filePaths[0]) return undefined; return service.registerProject(result.filePaths[0]); });
  ipcMain.handle('workspace:list', (_event, projectId: unknown, relativePath: unknown = '.') => service.listProjectFiles(projectIdSchema.parse(projectId), relativePathSchema.parse(relativePath)));
  ipcMain.handle('workspace:browse', (_event, projectId: unknown, relativePath: unknown = '.') => service.browseWorkspace(projectIdSchema.parse(projectId), relativePathSchema.parse(relativePath)));
  ipcMain.handle('workspace:read', (_event, projectId: unknown, relativePath: unknown) => service.readTextFile(projectIdSchema.parse(projectId), relativePathSchema.parse(relativePath)));
  ipcMain.handle('workspace:write', (_event, projectId: unknown, relativePath: unknown, content: unknown) => service.saveTextFile(projectIdSchema.parse(projectId), relativePathSchema.parse(relativePath), contentSchema.parse(content)));
  ipcMain.handle('workspace:create', (_event, projectId: unknown, parentPath: unknown, name: unknown, directory: unknown = false) => service.createEntry(projectIdSchema.parse(projectId), relativePathSchema.parse(parentPath), entryNameSchema.parse(name), z.boolean().parse(directory) ? 'directory' : 'file'));
  ipcMain.handle('workspace:rename', (_event, projectId: unknown, relativePath: unknown, nextName: unknown) => service.renameEntry(projectIdSchema.parse(projectId), relativePathSchema.parse(relativePath), entryNameSchema.parse(nextName)));
  ipcMain.handle('workspace:delete', (_event, projectId: unknown, relativePath: unknown) => service.deleteEntry(projectIdSchema.parse(projectId), relativePathSchema.parse(relativePath)));
}
