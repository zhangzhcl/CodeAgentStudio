import { ipcMain } from 'electron';
import type { ProviderRegistry } from './provider-registry.js';

export function registerProviderIpc(registry: ProviderRegistry): void {
  ipcMain.removeHandler('providers:detect');
  ipcMain.handle('providers:detect', async () => {
    const statuses = await registry.detectAll();
    return statuses;
  });
}
