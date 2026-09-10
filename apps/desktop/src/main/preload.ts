import { contextBridge } from 'electron';
contextBridge.exposeInMainWorld('codeagent', { protocolVersion: 1, ready: true });
