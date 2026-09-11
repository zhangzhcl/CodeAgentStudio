import { ipcMain } from 'electron';
import { ProviderIdSchema, SessionScopeSchema } from '@codeagent-studio/protocol';
import { z } from 'zod';
import type { SessionService } from './session-service.js';
import type { WorkspaceService } from '../workspace/workspace-service.js';
const sessionIdSchema = z.string().min(1);
export const CreateSessionSchema = z.object({ id: z.string().min(1).max(200).optional(), provider: ProviderIdSchema, scope: SessionScopeSchema, projectId: z.string().min(1).optional() }).strict().superRefine((input, context) => {
  if (input.scope === 'project' && !input.projectId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['projectId'], message: 'Project sessions require projectId' });
  if (input.scope === 'personal' && input.projectId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['projectId'], message: 'Personal sessions cannot include projectId' });
});
export function registerSessionIpc(service: SessionService, workspace?: WorkspaceService, refreshDiscovery?: () => Promise<unknown>) {
  for (const channel of ['session:list', 'session:create', 'session:get', 'session:messages', 'session:delete']) ipcMain.removeHandler(channel);
  ipcMain.handle('session:list', async () => { try { await refreshDiscovery?.(); } catch (error) { console.warn('[sessions] native discovery refresh failed; returning cached sessions', error); } return service.list(); });
  ipcMain.handle('session:create', (_event, input: unknown) => { const parsed = CreateSessionSchema.parse(input); if (parsed.scope === 'project' && !workspace?.listProjects().some((project) => project.id === parsed.projectId)) throw new Error('Unknown registered project'); return service.create({ id: parsed.id, provider: parsed.provider, scope: parsed.scope, projectId: parsed.projectId }); });
  ipcMain.handle('session:get', (_event, sessionId: unknown) => service.get(sessionIdSchema.parse(sessionId)));
  ipcMain.handle('session:messages', (_event, sessionId: unknown) => service.replayTranscript(sessionIdSchema.parse(sessionId)));
  ipcMain.handle('session:delete', (_event, sessionId: unknown) => service.delete(sessionIdSchema.parse(sessionId)));
}
