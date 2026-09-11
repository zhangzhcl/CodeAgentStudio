import { BrowserWindow, ipcMain } from 'electron';
import type { AgentEvent, ProviderId, SessionScope } from '@codeagent-studio/protocol';
import { ProviderIdSchema, SessionScopeSchema } from '@codeagent-studio/protocol';
import { z } from 'zod';
import { ProviderRegistry } from './provider-registry.js';
import { ProviderRuntime } from './provider-runtime.js';
import type { SessionService } from '../sessions/session-service.js';
import type { WorkspaceService } from '../workspace/workspace-service.js';
import { stageAttachments, isImageAttachment, SESSION_DIRECTORY_PATTERN } from '../workspace/attachment-service.js';
import type { AgentProvider, PromptOptions } from './contracts.js';

const providerUnsubscribers = new WeakMap<AgentProvider, () => void>();

type PromptAttachmentInput = { sourcePath: string; name?: string; mimeType?: string; size?: number };
type PromptOptionsInput = { thinking?: boolean; webSearch?: boolean; attachments?: PromptAttachmentInput[] };
type PromptInput = { sessionId: string; provider: ProviderId; scope: SessionScope; projectId?: string; projectRoot?: string; model?: string; text: string; repeat?: boolean; options?: PromptOptionsInput };
const PromptOptionsSchema = z.object({ thinking: z.boolean().optional(), webSearch: z.boolean().optional(), attachments: z.array(z.object({ sourcePath: z.string().min(1).max(4000), name: z.string().min(1).max(255).optional(), mimeType: z.string().max(200).optional(), size: z.number().int().nonnegative().optional() }).strict()).max(10).optional() }).strict();
export const PromptInputSchema = z.object({ sessionId: z.string().min(1).max(128).regex(SESSION_DIRECTORY_PATTERN, 'sessionId 含路径或非法字符'), provider: ProviderIdSchema, scope: SessionScopeSchema, projectId: z.string().min(1).optional(), projectRoot: z.string().min(1).optional(), model: z.string().min(1).max(200).optional(), text: z.string().min(1).max(1_000_000), repeat: z.boolean().optional(), options: PromptOptionsSchema.optional() }).strict().superRefine((input, context) => {
  if (input.scope === 'project' && !input.projectId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['projectId'], message: 'Project prompts require projectId' });
  if (input.scope === 'project' && !input.projectRoot) context.addIssue({ code: z.ZodIssueCode.custom, path: ['projectRoot'], message: 'Project prompts require projectRoot' });
  if (input.scope === 'personal' && (input.projectId || input.projectRoot)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['scope'], message: 'Personal prompts cannot include project fields' });
});

/** 能力位门控在任何文件复制之前执行，避免产生副作用后才失败。 */
export function assertPromptOptionsSupported(provider: AgentProvider, options?: PromptOptionsInput): void {
  if (!options) return;
  if (options.thinking && !provider.capabilities.supportsThinking) throw new Error(`${provider.id} 不支持深度思考选项`);
  if (options.webSearch && !provider.capabilities.supportsWebSearch) throw new Error(`${provider.id} 不支持联网选项`);
  if (options.attachments?.length && !provider.capabilities.supportsAttachments) throw new Error(`${provider.id} 不支持附件`);
  if (options.attachments?.some((item) => isImageAttachment(item)) && !provider.capabilities.supportsImages) throw new Error(`${provider.id} 不支持图片附件`);
}

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
    const provider = providers.get(input.provider);
    if (!provider) throw new Error(`Unknown provider: ${input.provider}`);
    assertPromptOptionsSupported(provider, input.options);
    let projectRoot: string | undefined;
    if (input.scope === 'project') {
      const project = workspace && input.projectRoot ? await workspace.findProject(input.projectRoot) : undefined;
      if (!project || project.id !== input.projectId) throw new Error('Project prompt is outside the selected registered project');
      projectRoot = project.rootPath;
    }
    // 中转必须发生在项目校验之后，且只能写入校验过的项目根目录；
    // 个人会话没有项目工作区，附件一律拒绝。
    if (input.options?.attachments?.length) {
      if (!projectRoot) throw new Error('附件需要项目工作区');
      const staged = await stageAttachments(projectRoot, input.sessionId, input.options.attachments);
      input.options = { ...input.options, attachments: staged.map((item) => ({ sourcePath: item.relativePath, name: item.name, mimeType: item.mimeType, size: item.size })) };
    }
    if (sessions) { try { sessions.get(input.sessionId); } catch { sessions.create({ id: input.sessionId, provider: input.provider, scope: input.scope, projectId: input.projectId }); } }
    // 重试/重新生成场景下用户消息已经落库，重复追加会在回放时出现同一提问两份记录。
    if (!input.repeat) sessions?.appendUserMessage(input.sessionId, input.text);
    if (!runtime.isActive(input.sessionId)) { const record = sessions?.get(input.sessionId); if (record?.nativeId && provider.capabilities.supportsResume) { await provider.resumeSession(record.nativeId, record.nativeSessionFile, input.sessionId); runtime.activate(input.sessionId, input.provider); } else { const created = await runtime.start(input.sessionId, input.provider, { scope: input.scope, projectId: input.projectId, projectRoot: input.projectRoot }); if (created.nativeId || created.nativeSessionFile) sessions?.updateNative(input.sessionId, { nativeId: created.nativeId, nativeSessionFile: created.nativeSessionFile }); } }
    try {
      const providerOptions: PromptOptions | undefined = input.options ? { thinking: input.options.thinking, webSearch: input.options.webSearch, attachments: input.options.attachments?.map((item) => ({ name: item.name ?? 'attachment', relativePath: item.sourcePath, mimeType: item.mimeType ?? 'application/octet-stream', size: item.size ?? 0 })) } : undefined;
      await provider.prompt(input.sessionId, input.text, input.model, providerOptions);
    } catch (error) {
      runtime.complete(input.sessionId, 'error');
      if (sessions) { try { sessions.markStatus(input.sessionId, 'error'); } catch { /* session may have been deleted */ } }
      throw error;
    }
  });
  ipcMain.handle('agent:abort', async (_event, rawInput: unknown) => { const input = typeof rawInput === 'string' ? { sessionId: rawInput } : z.object({ sessionId: z.string().min(1), provider: ProviderIdSchema.optional() }).parse(rawInput); const stopped = await runtime.stop(input.sessionId, input.provider); if (stopped && sessions) { try { sessions.markStatus(input.sessionId, 'aborted'); } catch { /* session may have been deleted */ } } return stopped; });
}
