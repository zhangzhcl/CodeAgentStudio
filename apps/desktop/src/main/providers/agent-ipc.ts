import { BrowserWindow, ipcMain } from 'electron';
import type { AgentEvent, ProviderId, SessionScope } from '@codeagent-studio/protocol';
import { ProviderRegistry } from './provider-registry.js';
import { ProviderRuntime } from './provider-runtime.js';
import type { SessionService } from '../sessions/session-service.js';

type PromptInput = { sessionId: string; provider: ProviderId; scope: SessionScope; projectId?: string; projectRoot?: string; text: string };

export function registerAgentIpc(registry: ProviderRegistry, sessions?: SessionService): void {
  const providers = new Map(registry.list().map((provider) => [provider.id, provider]));
  const runtime = new ProviderRuntime(providers);
  for (const provider of registry.list()) provider.subscribe((event: AgentEvent) => { sessions?.appendEvent(event); for (const window of BrowserWindow.getAllWindows()) window.webContents.send('agent:event', event); });
  ipcMain.removeHandler('agent:prompt');
  ipcMain.removeHandler('agent:abort');
  ipcMain.handle('agent:prompt', async (_event, input: PromptInput) => {
    if (sessions) { try { sessions.get(input.sessionId); } catch { sessions.create({ id: input.sessionId, provider: input.provider, scope: input.scope, projectId: input.projectId }); } }
    sessions?.appendUserMessage(input.sessionId, input.text);
    if (!runtime.get(input.sessionId)) { const created = await runtime.start(input.sessionId, input.provider, { scope: input.scope, projectId: input.projectId, projectRoot: input.projectRoot }); if (created.nativeId || created.nativeSessionFile) sessions?.updateNative(input.sessionId, { nativeId: created.nativeId, nativeSessionFile: created.nativeSessionFile }); }
    const provider = providers.get(input.provider);
    if (!provider) throw new Error(`Unknown provider: ${input.provider}`);
    await provider.prompt(input.sessionId, input.text);
  });
  ipcMain.handle('agent:abort', (_event, sessionId: string) => runtime.stop(sessionId));
}
