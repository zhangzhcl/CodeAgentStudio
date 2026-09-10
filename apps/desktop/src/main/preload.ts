import { contextBridge, ipcRenderer } from 'electron';
const workspace = {
  projects: () => ipcRenderer.invoke('workspace:projects'),
  registerProject: (rootPath: string) => ipcRenderer.invoke('workspace:register-project', rootPath),
  chooseProject: () => ipcRenderer.invoke('workspace:choose-project'),
  list: (projectId: string, path?: string) => ipcRenderer.invoke('workspace:list', projectId, path),
  browse: (projectId: string, path?: string) => ipcRenderer.invoke('workspace:browse', projectId, path),
  read: (projectId: string, path: string) => ipcRenderer.invoke('workspace:read', projectId, path),
  write: (projectId: string, path: string, content: string) => ipcRenderer.invoke('workspace:write', projectId, path, content),
  create: (projectId: string, parent: string, name: string, directory?: boolean) => ipcRenderer.invoke('workspace:create', projectId, parent, name, directory),
  rename: (projectId: string, path: string, nextName: string) => ipcRenderer.invoke('workspace:rename', projectId, path, nextName),
  delete: (projectId: string, path: string) => ipcRenderer.invoke('workspace:delete', projectId, path),
};
contextBridge.exposeInMainWorld('codeagent', { protocolVersion: 1, ready: true, workspace, providers: { detect: () => ipcRenderer.invoke('providers:detect') } });
contextBridge.exposeInMainWorld('codeagentAgent', { prompt: (input: unknown) => ipcRenderer.invoke('agent:prompt', input), abort: (sessionId: string) => ipcRenderer.invoke('agent:abort', sessionId), subscribe: (listener: (event: unknown) => void) => { const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload); ipcRenderer.on('agent:event', handler); return () => ipcRenderer.removeListener('agent:event', handler); } });
contextBridge.exposeInMainWorld('codeagentSessions', { create: (input: unknown) => ipcRenderer.invoke('session:create', input), list: () => ipcRenderer.invoke('session:list'), get: (id: string) => ipcRenderer.invoke('session:get', id), messages: (id: string) => ipcRenderer.invoke('session:messages', id), delete: (id: string) => ipcRenderer.invoke('session:delete', id) });
