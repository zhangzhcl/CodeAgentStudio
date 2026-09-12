import { ipcMain } from 'electron';
import { ProviderIdSchema, SessionScopeSchema } from '@codeagent-studio/protocol';
import { z } from 'zod';
import type { SessionService } from './session-service.js';
import type { WorkspaceService } from '../workspace/workspace-service.js';
import { deleteSessionEverywhere } from './session-deletion.js';
const sessionIdSchema = z.string().min(1);
export const CreateSessionSchema = z.object({ id: z.string().min(1).max(200).optional(), provider: ProviderIdSchema, scope: SessionScopeSchema, projectId: z.string().min(1).optional() }).strict().superRefine((input, context) => {
  if (input.scope === 'project' && !input.projectId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['projectId'], message: 'Project sessions require projectId' });
  if (input.scope === 'personal' && input.projectId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['projectId'], message: 'Personal sessions cannot include projectId' });
});
const DISCOVERY_REFRESH_INTERVAL_MS = 30_000;
export function registerSessionIpc(service: SessionService, workspace?: WorkspaceService, refreshDiscovery?: () => Promise<unknown>) {
  for (const channel of ['session:list', 'session:create', 'session:get', 'session:messages', 'session:delete']) ipcMain.removeHandler(channel);
  // 渲染层每 60 秒与每次窗口聚焦都会拉取会话列表；全量扫描原生会话目录开销大，
  // 常规拉取节流到 30 秒一次，进行中的扫描共享同一个 Promise，删除会话前强制刷新。
  let lastRefreshAt = Date.now();
  let inFlight: Promise<unknown> | undefined;
  const refresh = (force = false): Promise<unknown> => {
    if (!refreshDiscovery) return Promise.resolve();
    if (inFlight) return inFlight;
    if (!force && Date.now() - lastRefreshAt < DISCOVERY_REFRESH_INTERVAL_MS) return Promise.resolve();
    lastRefreshAt = Date.now();
    inFlight = refreshDiscovery().finally(() => { inFlight = undefined; });
    return inFlight;
  };
  ipcMain.handle('session:list', async () => { try { await refresh(); } catch (error) { console.warn('[sessions] native discovery refresh failed; returning cached sessions', error); } return service.list(); });
  ipcMain.handle('session:create', (_event, input: unknown) => {
    const parsed = CreateSessionSchema.parse(input);
    const project = parsed.scope === 'project' && parsed.projectId ? workspace?.listProjects().find((item) => item.id === parsed.projectId) : undefined;
    if (parsed.scope === 'project' && !project) throw new Error('Unknown registered project');
    // 落库时带上项目根目录与名称：原生会话关联（ownedAppSession）与侧栏分组都依赖它们
    return service.create({ id: parsed.id, provider: parsed.provider, scope: parsed.scope, projectId: parsed.projectId, projectRoot: project?.rootPath, projectName: project?.name });
  });
  ipcMain.handle('session:get', (_event, sessionId: unknown) => service.get(sessionIdSchema.parse(sessionId)));
  ipcMain.handle('session:messages', (_event, sessionId: unknown) => service.replayTranscript(sessionIdSchema.parse(sessionId)));
  ipcMain.handle('session:delete', (_event, sessionId: unknown) => deleteSessionEverywhere(service, sessionIdSchema.parse(sessionId), undefined, () => refresh(true)));
}
