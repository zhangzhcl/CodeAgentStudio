import { BrowserWindow, ipcMain } from 'electron';
import type { AgentEvent, ProviderId, SessionScope } from '@codeagent-studio/protocol';
import { ProviderRegistry } from './provider-registry.js';
import { ProviderRuntime } from './provider-runtime.js';

type PromptInput = { sessionId: string; provider: ProviderId; scope: SessionScope; projectId?: string; text: string };

export function registerAgentIpc(registry: ProviderRegistry): void {
  const providers = new Map(registry.list().map((provider) => [provider.id, provider]));
  const runtime = new ProviderRuntime(providers);
  for (const provider of registry.list()) provider.subscribe((event: AgentEvent) => { for (const window of BrowserWindow.getAllWindows()) window.webContents.send('agent:event', event); });
  ipcMain.removeHandler('agent:prompt');
  ipcMain.removeHandler('agent:abort');
  ipcMain.handle('agent:prompt', async (_event, input: PromptInput) => {
    if (!runtime.get(input.sessionId)) await runtime.start(input.sessionId, input.provider, { scope: input.scope, projectId: input.projectId });
    await providers.get(input.provider)?.prompt(input.sessionId, input.text);
  });
  ipcMain.handle('agent:abort', (_event, sessionId: string) => runtime.stop(sessionId));
}
