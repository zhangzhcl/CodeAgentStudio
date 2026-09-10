import { ipcMain } from 'electron';
import type { WorkspaceService } from './workspace-service.js';

export function registerWorkspaceIpc(service: WorkspaceService) {
  ipcMain.handle('workspace:projects', () => service.listProjects());
  ipcMain.handle('workspace:register-project', (_event, rootPath: string) => service.registerProject(rootPath));
  ipcMain.handle('workspace:list', (_event, projectId: string, relativePath = '.') => service.listProjectFiles(projectId, relativePath));
  ipcMain.handle('workspace:read', (_event, projectId: string, relativePath: string) => service.readTextFile(projectId, relativePath));
  ipcMain.handle('workspace:write', (_event, projectId: string, relativePath: string, content: string) => service.saveTextFile(projectId, relativePath, content));
  ipcMain.handle('workspace:create', (_event, projectId: string, parentPath: string, name: string, directory = false) => service.createEntry(projectId, parentPath, name, directory ? 'directory' : 'file'));
  ipcMain.handle('workspace:rename', (_event, projectId: string, relativePath: string, nextName: string) => service.renameEntry(projectId, relativePath, nextName));
  ipcMain.handle('workspace:delete', (_event, projectId: string, relativePath: string) => service.deleteEntry(projectId, relativePath));
}
