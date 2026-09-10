import { ipcMain } from 'electron';
import type { SessionService } from './session-service.js';
export function registerSessionIpc(service: SessionService) {
  for (const channel of ['session:list', 'session:create', 'session:get', 'session:messages', 'session:delete']) ipcMain.removeHandler(channel);
  ipcMain.handle('session:list', () => service.list());
  ipcMain.handle('session:create', (_event, input: { provider: 'claude' | 'cursor' | 'codex' | 'pi' | 'opencode'; scope: 'personal' | 'project'; projectId?: string }) => service.create(input));
  ipcMain.handle('session:get', (_event, sessionId: string) => service.get(sessionId));
  ipcMain.handle('session:messages', (_event, sessionId: string) => service.replayTranscript(sessionId));
  ipcMain.handle('session:delete', (_event, sessionId: string) => service.delete(sessionId));
}
