import { BrowserWindow, ipcMain } from 'electron';
import type { AgentEvent, ProviderId, SessionScope } from '@codeagent-studio/protocol';
import { ProviderIdSchema, SessionScopeSchema } from '@codeagent-studio/protocol';
import { z } from 'zod';
import { ProviderRegistry } from './provider-registry.js';
import { ProviderRuntime } from './provider-runtime.js';
import type { SessionService } from '../sessions/session-service.js';
import type { WorkspaceService } from '../workspace/workspace-service.js';

type PromptInput = { sessionId: string; provider: ProviderId; scope: SessionScope; projectId?: string; projectRoot?: string; text: string };
export const PromptInputSchema = z.object({ sessionId: z.string().min(1), provider: ProviderIdSchema, scope: SessionScopeSchema, projectId: z.string().min(1).optional(), projectRoot: z.string().min(1).optional(), text: z.string().min(1).max(1_000_000) }).strict().superRefine((input, context) => {
  if (input.scope === 'project' && !input.projectId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['projectId'], message: 'Project prompts require projectId' });
  if (input.scope === 'project' && !input.projectRoot) context.addIssue({ code: z.ZodIssueCode.custom, path: ['projectRoot'], message: 'Project prompts require projectRoot' });
  if (input.scope === 'personal' && (input.projectId || input.projectRoot)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['scope'], message: 'Personal prompts cannot include project fields' });
});

export function registerAgentIpc(registry: ProviderRegistry, sessions?: SessionService, workspace?: WorkspaceService): void {
  const providers = new Map(registry.list().map((provider) => [provider.id, provider]));
  const runtime = new ProviderRuntime(providers);
  for (const provider of registry.list()) provider.subscribe((event: AgentEvent) => {
    sessions?.appendEvent(event);
    if (event.type === 'done' || event.type === 'error') {
      runtime.complete(event.sessionId, event.type === 'error' ? 'error' : 'stopped');
      if (sessions) {
        try { sessions.markStatus(event.sessionId, event.type === 'done' ? 'done' : 'error'); } catch { /* the session may have been deleted while the process was closing */ }
      }
    }
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('agent:event', event);
  });
  ipcMain.removeHandler('agent:prompt');
  ipcMain.removeHandler('agent:abort');
  ipcMain.handle('agent:prompt', async (_event, rawInput: unknown) => {
    const input: PromptInput = PromptInputSchema.parse(rawInput);
    if (input.scope === 'project') {
      const project = workspace && input.projectRoot ? await workspace.findProject(input.projectRoot) : undefined;
      if (!project || project.id !== input.projectId) throw new Error('Project prompt is outside the selected registered project');
    }
    if (sessions) { try { sessions.get(input.sessionId); } catch { sessions.create({ id: input.sessionId, provider: input.provider, scope: input.scope, projectId: input.projectId }); } }
    sessions?.appendUserMessage(input.sessionId, input.text);
    if (!runtime.isActive(input.sessionId)) { const record = sessions?.get(input.sessionId); const provider = providers.get(input.provider); if (record?.nativeId && provider?.capabilities.supportsResume) { await provider.resumeSession(record.nativeId, record.nativeSessionFile, input.sessionId); runtime.activate(input.sessionId, input.provider); } else { const created = await runtime.start(input.sessionId, input.provider, { scope: input.scope, projectId: input.projectId, projectRoot: input.projectRoot }); if (created.nativeId || created.nativeSessionFile) sessions?.updateNative(input.sessionId, { nativeId: created.nativeId, nativeSessionFile: created.nativeSessionFile }); } }
    const provider = providers.get(input.provider);
    if (!provider) throw new Error(`Unknown provider: ${input.provider}`);
    await provider.prompt(input.sessionId, input.text);
  });
  ipcMain.handle('agent:abort', (_event, sessionId: unknown) => runtime.stop(z.string().min(1).parse(sessionId)));
}
