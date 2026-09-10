import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { WorkspaceService } from './workspace/workspace-service.js';
import { registerWorkspaceIpc } from './workspace/workspace-ipc.js';
import { SessionService } from './sessions/session-service.js';
import { registerSessionIpc } from './sessions/session-ipc.js';
import { openDatabase } from './storage/database.js';
import type Database from 'better-sqlite3';
import { ProjectRepository } from './storage/project-repository.js';
import { SessionRepository } from './storage/session-repository.js';
import { ProviderRegistry } from './providers/provider-registry.js';
import { createCliProviders } from './providers/cli-providers.js';
import { registerProviderIpc } from './providers/provider-ipc.js';
let database: Database.Database | undefined;
function createWindow() { const window = new BrowserWindow({ width: 1440, height: 900, minWidth: 960, minHeight: 640, webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } }); if (process.env.CODEAGENT_DEV_URL) void window.loadURL(process.env.CODEAGENT_DEV_URL); else void window.loadFile(join(__dirname, '../renderer/index.html')); }
app.whenReady().then(() => { registerProviderIpc(new ProviderRegistry(createCliProviders())); try { database = openDatabase(join(app.getPath('userData'), 'codeagent-studio.db')); registerWorkspaceIpc(new WorkspaceService(new ProjectRepository(database))); registerSessionIpc(new SessionService(new SessionRepository(database))); } catch { registerWorkspaceIpc(new WorkspaceService()); registerSessionIpc(new SessionService()); } createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('before-quit', () => { database?.close(); database = undefined; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
