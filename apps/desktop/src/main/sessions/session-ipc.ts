import { ipcMain } from 'electron';
import type { SessionService } from './session-service.js';
export function registerSessionIpc(service: SessionService) {
  ipcMain.removeHandler('session:list');
  ipcMain.handle('session:list', () => service.list());
  ipcMain.handle('session:create', (_event, input: { provider: 'claude' | 'cursor' | 'codex' | 'pi' | 'opencode'; scope: 'personal' | 'project'; projectId?: string }) => service.create(input));
  ipcMain.handle('session:get', (_event, sessionId: string) => service.get(sessionId));
  ipcMain.handle('session:messages', (_event, sessionId: string) => service.replayTranscript(sessionId));
}
