import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
import { registerAgentIpc } from './providers/agent-ipc.js';
import { discoverNativeSessions } from './sessions/native-session-discovery.js';
import { AgentSettingsService } from './settings/settings-service.js';
import { registerSettingsIpc } from './settings/settings-ipc.js';
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
const mainDir = dirname(fileURLToPath(import.meta.url));
let database: Database.Database | undefined;
type WindowState = { width: number; height: number };
function windowStatePath() { return join(app.getPath('userData'), 'window-state.json'); }
function readWindowState(): WindowState | undefined { try { if (!existsSync(windowStatePath())) return undefined; const value = JSON.parse(readFileSync(windowStatePath(), 'utf8')) as Partial<WindowState>; return Number.isFinite(value.width) && Number.isFinite(value.height) ? { width: value.width!, height: value.height! } : undefined; } catch { return undefined; } }
function writeWindowState(window: BrowserWindow) { try { const [width, height] = window.getContentSize(); writeFileSync(windowStatePath(), JSON.stringify({ width, height }), 'utf8'); } catch { /* state persistence is best effort */ } }
function createWindow() { const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize; const saved = readWindowState(); const width = Math.max(960, Math.min(saved?.width ?? screenW * 0.8, screenW)); const height = Math.max(640, Math.min(saved?.height ?? screenH * 0.8, screenH)); const window = new BrowserWindow({ width: Math.floor(width), height: Math.floor(height), useContentSize: true, minWidth: 960, minHeight: 640, center: true, show: false, backgroundColor: '#08090c', webPreferences: { preload: join(mainDir, 'preload.js'), contextIsolation: true, nodeIntegration: false } }); window.once('ready-to-show', () => window.show()); window.on('close', () => writeWindowState(window)); const devUrl = (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined' && MAIN_WINDOW_VITE_DEV_SERVER_URL) || process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL || process.env.CODEAGENT_DEV_URL; if (devUrl) { console.info(`[window] loading renderer: ${devUrl}`); void window.loadURL(devUrl); } else { const rendererPath = join(mainDir, '../renderer/index.html'); console.info(`[window] loading renderer: ${rendererPath}`); void window.loadFile(rendererPath); } }
app.whenReady().then(async () => {
  // The workbench owns project/session/view actions; no duplicate native menu.
  if (process.platform !== 'darwin') app.setAboutPanelOptions?.({ applicationName: 'CodeAgent Studio' });
  const agentSettings = new AgentSettingsService(app.getPath('userData'));
  const registry = new ProviderRegistry(createCliProviders(agentSettings));
  registerProviderIpc(registry);
  registerSettingsIpc(agentSettings);

  let workspace: WorkspaceService;
  let sessions: SessionService;
  try {
    database = openDatabase(join(app.getPath('userData'), 'codeagent-studio.db'));
    workspace = new WorkspaceService(new ProjectRepository(database));
    sessions = new SessionService(new SessionRepository(database));
    console.info('[storage] SQLite session/project storage enabled');
  } catch (error) {
    console.error('[storage] SQLite unavailable, using in-memory fallback', error);
    database?.close();
    database = undefined;
    workspace = new WorkspaceService();
    sessions = new SessionService();
  }

  registerWorkspaceIpc(workspace);
  registerSessionIpc(sessions, workspace, () => discoverNativeSessions(sessions, workspace));
  registerAgentIpc(registry, sessions, workspace);

  try {
    await discoverNativeSessions(sessions, workspace);
  } catch (error) {
    console.error('[sessions] native session discovery failed; continuing without discovery', error);
  }

  createWindow();
  screen.on('display-metrics-changed', () => { for (const window of BrowserWindow.getAllWindows()) { const [width, height] = window.getContentSize(); const { width: screenW, height: screenH } = screen.getDisplayMatching(window.getBounds()).workAreaSize; if (width > screenW || height > screenH) window.setContentSize(Math.min(width, screenW), Math.min(height, screenH)); } });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('before-quit', () => { database?.close(); database = undefined; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

