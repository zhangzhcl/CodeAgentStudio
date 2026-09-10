import { contextBridge, ipcRenderer } from 'electron';
const workspace = {
  projects: () => ipcRenderer.invoke('workspace:projects'),
  registerProject: (rootPath: string) => ipcRenderer.invoke('workspace:register-project', rootPath),
  chooseProject: () => ipcRenderer.invoke('workspace:choose-project'),
  list: (projectId: string, path?: string) => ipcRenderer.invoke('workspace:list', projectId, path),
  read: (projectId: string, path: string) => ipcRenderer.invoke('workspace:read', projectId, path),
  write: (projectId: string, path: string, content: string) => ipcRenderer.invoke('workspace:write', projectId, path, content),
  create: (projectId: string, parent: string, name: string, directory?: boolean) => ipcRenderer.invoke('workspace:create', projectId, parent, name, directory),
  rename: (projectId: string, path: string, nextName: string) => ipcRenderer.invoke('workspace:rename', projectId, path, nextName),
  delete: (projectId: string, path: string) => ipcRenderer.invoke('workspace:delete', projectId, path),
};
contextBridge.exposeInMainWorld('codeagent', { protocolVersion: 1, ready: true, workspace });
