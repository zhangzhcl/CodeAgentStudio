import { ipcMain } from 'electron';
import { ProviderIdSchema, SessionScopeSchema } from '@codeagent-studio/protocol';
import { z } from 'zod';
import type { SessionService } from './session-service.js';
const sessionIdSchema = z.string().min(1);
const createSessionSchema = z.object({ provider: ProviderIdSchema, scope: SessionScopeSchema, projectId: z.string().min(1).optional() }).strict();
export function registerSessionIpc(service: SessionService) {
  for (const channel of ['session:list', 'session:create', 'session:get', 'session:messages', 'session:delete']) ipcMain.removeHandler(channel);
  ipcMain.handle('session:list', () => service.list());
  ipcMain.handle('session:create', (_event, input: unknown) => service.create(createSessionSchema.parse(input)));
  ipcMain.handle('session:get', (_event, sessionId: unknown) => service.get(sessionIdSchema.parse(sessionId)));
  ipcMain.handle('session:messages', (_event, sessionId: unknown) => service.replayTranscript(sessionIdSchema.parse(sessionId)));
  ipcMain.handle('session:delete', (_event, sessionId: unknown) => service.delete(sessionIdSchema.parse(sessionId)));
}
