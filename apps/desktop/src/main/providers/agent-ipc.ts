import { BrowserWindow, ipcMain } from 'electron';
import type { AgentEvent, ProviderId, SessionScope } from '@codeagent-studio/protocol';
import { ProviderIdSchema, SessionScopeSchema } from '@codeagent-studio/protocol';
import { z } from 'zod';
import { ProviderRegistry } from './provider-registry.js';
import { ProviderRuntime } from './provider-runtime.js';
import type { SessionService } from '../sessions/session-service.js';
import type { WorkspaceService } from '../workspace/workspace-service.js';
import { stageAttachments } from '../workspace/attachment-service.js';
import type { AgentProvider, PromptOptions } from './contracts.js';

const providerUnsubscribers = new WeakMap<AgentProvider, () => void>();

type PromptInput = { sessionId: string; provider: ProviderId; scope: SessionScope; projectId?: string; projectRoot?: string; model?: string; text: string; repeat?: boolean; options?: { thinking?: boolean; webSearch?: boolean; attachments?: Array<{ sourcePath: string; name?: string; mimeType?: string }> } };
const PromptOptionsSchema = z.object({ thinking: z.boolean().optional(), webSearch: z.boolean().optional(), attachments: z.array(z.object({ sourcePath: z.string().min(1).max(4000), name: z.string().min(1).max(255).optional(), mimeType: z.string().max(200).optional() }).strict()).max(10).optional() }).strict();
export const PromptInputSchema = z.object({ sessionId: z.string().min(1), provider: ProviderIdSchema, scope: SessionScopeSchema, projectId: z.string().min(1).optional(), projectRoot: z.string().min(1).optional(), model: z.string().min(1).max(200).optional(), text: z.string().min(1).max(1_000_000), repeat: z.boolean().optional(), options: PromptOptionsSchema.optional() }).strict().superRefine((input, context) => {
  if (input.scope === 'project' && !input.projectId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['projectId'], message: 'Project prompts require projectId' });
  if (input.scope === 'project' && !input.projectRoot) context.addIssue({ code: z.ZodIssueCode.custom, path: ['projectRoot'], message: 'Project prompts require projectRoot' });
  if (input.scope === 'personal' && (input.projectId || input.projectRoot)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['scope'], message: 'Personal prompts cannot include project fields' });
});

export function registerAgentIpc(registry: ProviderRegistry, sessions?: SessionService, workspace?: WorkspaceService): void {
  const providers = new Map(registry.list().map((provider) => [provider.id, provider]));
  const runtime = new ProviderRuntime(providers);
  for (const provider of registry.list()) {
    providerUnsubscribers.get(provider)?.();
    const unsubscribe = provider.subscribe((event: AgentEvent) => {
    sessions?.appendEvent(event);
    if (event.type === 'done' || event.type === 'error') {
      runtime.complete(event.sessionId, event.type === 'error' ? 'error' : 'stopped');
      if (sessions) {
        try { sessions.markStatus(event.sessionId, event.type === 'done' ? 'done' : 'error'); } catch { /* the session may have been deleted while the process was closing */ }
      }
    }
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('agent:event', event);
    });
    providerUnsubscribers.set(provider, unsubscribe);
  }
  ipcMain.removeHandler('agent:prompt');
  ipcMain.removeHandler('agent:abort');
  ipcMain.handle('agent:prompt', async (_event, rawInput: unknown) => {
    const input: PromptInput = PromptInputSchema.parse(rawInput);
    if (input.options?.attachments?.length) {
      if (!input.projectRoot) throw new Error('附件需要项目工作区');
      const staged = await stageAttachments(input.projectRoot, input.sessionId, input.options.attachments);
      input.options = { ...input.options, attachments: staged.map((item) => ({ sourcePath: item.relativePath, name: item.name, mimeType: item.mimeType })) };
    }
    if (input.scope === 'project') {
      const project = workspace && input.projectRoot ? await workspace.findProject(input.projectRoot) : undefined;
      if (!project || project.id !== input.projectId) throw new Error('Project prompt is outside the selected registered project');
    }
    if (sessions) { try { sessions.get(input.sessionId); } catch { sessions.create({ id: input.sessionId, provider: input.provider, scope: input.scope, projectId: input.projectId }); } }
    // 重试/重新生成场景下用户消息已经落库，重复追加会在回放时出现同一提问两份记录。
    if (!input.repeat) sessions?.appendUserMessage(input.sessionId, input.text);
    if (!runtime.isActive(input.sessionId)) { const record = sessions?.get(input.sessionId); const provider = providers.get(input.provider); if (record?.nativeId && provider?.capabilities.supportsResume) { await provider.resumeSession(record.nativeId, record.nativeSessionFile, input.sessionId); runtime.activate(input.sessionId, input.provider); } else { const created = await runtime.start(input.sessionId, input.provider, { scope: input.scope, projectId: input.projectId, projectRoot: input.projectRoot }); if (created.nativeId || created.nativeSessionFile) sessions?.updateNative(input.sessionId, { nativeId: created.nativeId, nativeSessionFile: created.nativeSessionFile }); } }
    const provider = providers.get(input.provider);
    if (!provider) throw new Error(`Unknown provider: ${input.provider}`);
    try {
      const providerOptions: PromptOptions | undefined = input.options ? { thinking: input.options.thinking, webSearch: input.options.webSearch, attachments: input.options.attachments?.map((item) => ({ name: item.name ?? 'attachment', relativePath: item.sourcePath, mimeType: item.mimeType ?? 'application/octet-stream', size: 0 })) } : undefined;
      await provider.prompt(input.sessionId, input.text, input.model, providerOptions);
    } catch (error) {
      runtime.complete(input.sessionId, 'error');
      if (sessions) { try { sessions.markStatus(input.sessionId, 'error'); } catch { /* session may have been deleted */ } }
      throw error;
    }
  });
  ipcMain.handle('agent:abort', async (_event, sessionId: unknown) => { const id = z.string().min(1).parse(sessionId); const stopped = await runtime.stop(id); if (stopped && sessions) { try { sessions.markStatus(id, 'aborted'); } catch { /* session may have been deleted */ } } return stopped; });
}
