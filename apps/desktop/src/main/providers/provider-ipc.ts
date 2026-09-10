import { ipcMain } from 'electron';
import { spawn } from 'node:child_process';
import { withUserBinaryPaths } from './command-resolver.js';
import type { ProviderRegistry } from './provider-registry.js';

export function registerProviderIpc(registry: ProviderRegistry): void {
  ipcMain.removeHandler('providers:detect');
  ipcMain.handle('providers:detect', async () => {
    const statuses = await registry.detectAll();
    const pi = await detectPi();
    return [...statuses, pi];
  });
}

function detectPi(): Promise<{ provider: 'pi'; command: string; installed: boolean; authenticated: boolean; version?: string; errorCode?: 'not_installed' | 'unknown' }> {
  return new Promise((resolve) => {
    const child = spawn(process.env.CODEAGENT_PI_COMMAND ?? 'pi', ['--version'], { shell: process.platform === 'win32', windowsHide: true, env: withUserBinaryPaths(process.env) });
    let output = '';
    child.stdout?.on('data', (data) => { output += data.toString(); });
    child.once('error', () => resolve({ provider: 'pi', command: process.env.CODEAGENT_PI_COMMAND ?? 'pi', installed: false, authenticated: false, errorCode: 'not_installed' }));
    child.once('close', (code) => resolve({ provider: 'pi', command: process.env.CODEAGENT_PI_COMMAND ?? 'pi', installed: code === 0, authenticated: false, version: output.trim() || undefined, errorCode: code === 0 ? undefined : 'unknown' }));
  });
}
