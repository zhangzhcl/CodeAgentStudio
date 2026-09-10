import { contextBridge, ipcRenderer } from 'electron';
const workspace = {
  projects: () => ipcRenderer.invoke('workspace:projects'),
  registerProject: (rootPath: string) => ipcRenderer.invoke('workspace:register-project', rootPath),
  chooseProject: () => ipcRenderer.invoke('workspace:choose-project'),
  list: (projectId: string, path?: string) => ipcRenderer.invoke('workspace:list', projectId, path),
  read: (projectId: string, path: string) => ipcRenderer.invoke('workspace:read', projectId, path),
  write: (projectId: string, path: string, content: string) => ipcRenderer.invoke('workspace:write', projectId, path, content),
};
contextBridge.exposeInMainWorld('codeagent', { protocolVersion: 1, ready: true, workspace });
