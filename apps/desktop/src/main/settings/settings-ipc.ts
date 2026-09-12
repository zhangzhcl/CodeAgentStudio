import { ipcMain } from 'electron';
import { z } from 'zod';
import type { AgentSettingsService } from './settings-service.js';
import type { AgentProviderId } from './contracts.js';
import { assertNativeWriteAllowed, writeClaudeSettings } from './native-config-writer.js';

const provider = z.enum(['claude', 'cursor', 'codex', 'pi', 'opencode']);
const patch = z.object({ provider, model: z.string().trim().min(1).optional(), baseUrl: z.string().url().optional() }).strict();
const credentialPatch = z.object({ provider, value: z.string().trim().min(1) }).strict();

export function registerSettingsIpc(service: AgentSettingsService) {
  ipcMain.removeHandler('settings:list');
  ipcMain.removeHandler('settings:get');
  ipcMain.removeHandler('settings:save');
  ipcMain.removeHandler('settings:write-native');
  ipcMain.removeHandler('settings:set-credential');
  ipcMain.removeHandler('settings:clear-credential');
  ipcMain.handle('settings:list', () => service.list());
  ipcMain.handle('settings:get', (_event, value: unknown) => service.get(provider.parse(value) as AgentProviderId));
  ipcMain.handle('settings:save', (_event, value: unknown) => {
    const input = patch.parse(value);
    return service.save(input.provider, { model: input.model, baseUrl: input.baseUrl });
  });
  ipcMain.handle('settings:write-native', (_event, value: unknown) => {
    const input = patch.parse(value);
    assertNativeWriteAllowed(input.provider);
    if (input.provider !== 'claude') throw new Error('read_only_provider');
    return writeClaudeSettings({ model: input.model, baseUrl: input.baseUrl });
  });
  ipcMain.handle('settings:set-credential', (_event, value: unknown) => { const input = credentialPatch.parse(value); return service.setCredential(input.provider, input.value); });
  ipcMain.handle('settings:clear-credential', (_event, value: unknown) => { const input = provider.parse(value) as AgentProviderId; return service.clearCredential(input); });
}
