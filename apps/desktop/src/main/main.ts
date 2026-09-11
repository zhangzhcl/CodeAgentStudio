import { app, BrowserWindow, Menu, screen } from 'electron';
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
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
const mainDir = dirname(fileURLToPath(import.meta.url));
let database: Database.Database | undefined;
function createApplicationMenu() { Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: '项目', submenu: [{ label: '选择项目', click: () => BrowserWindow.getFocusedWindow()?.webContents.send('menu:choose-project') }, { label: '刷新文件树', click: () => BrowserWindow.getFocusedWindow()?.webContents.send('menu:refresh-files') }, { type: 'separator' }, { role: 'quit', label: '退出 CodeAgent Studio' }] }, { label: '会话', submenu: [{ label: '新建项目会话' }, { label: '新建个人会话' }] }, { label: '视图', submenu: [{ role: 'toggleDevTools', label: '开发者工具' }, { role: 'reload', label: '重新加载界面' }] }, { role: 'help', label: '帮助', submenu: [{ label: '关于 CodeAgent Studio' }] }])); }
type WindowState = { width: number; height: number };
function windowStatePath() { return join(app.getPath('userData'), 'window-state.json'); }
function readWindowState(): WindowState | undefined { try { if (!existsSync(windowStatePath())) return undefined; const value = JSON.parse(readFileSync(windowStatePath(), 'utf8')) as Partial<WindowState>; return Number.isFinite(value.width) && Number.isFinite(value.height) ? { width: value.width!, height: value.height! } : undefined; } catch { return undefined; } }
function writeWindowState(window: BrowserWindow) { try { const [width, height] = window.getContentSize(); writeFileSync(windowStatePath(), JSON.stringify({ width, height }), 'utf8'); } catch { /* state persistence is best effort */ } }
function createWindow() { const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize; const saved = readWindowState(); const width = Math.max(960, Math.min(saved?.width ?? screenW * 0.8, screenW)); const height = Math.max(640, Math.min(saved?.height ?? screenH * 0.8, screenH)); const window = new BrowserWindow({ width: Math.floor(width), height: Math.floor(height), useContentSize: true, minWidth: 960, minHeight: 640, center: true, show: false, backgroundColor: '#08090c', webPreferences: { preload: join(mainDir, 'preload.js'), contextIsolation: true, nodeIntegration: false } }); window.once('ready-to-show', () => window.show()); window.on('close', () => writeWindowState(window)); const devUrl = (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined' && MAIN_WINDOW_VITE_DEV_SERVER_URL) || process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL || process.env.CODEAGENT_DEV_URL; if (devUrl) { console.info(`[window] loading renderer: ${devUrl}`); void window.loadURL(devUrl); } else { const rendererPath = join(mainDir, '../renderer/index.html'); console.info(`[window] loading renderer: ${rendererPath}`); void window.loadFile(rendererPath); } }
app.whenReady().then(async () => { createApplicationMenu(); const registry = new ProviderRegistry(createCliProviders()); registerProviderIpc(registry); try { database = openDatabase(join(app.getPath('userData'), 'codeagent-studio.db')); const workspace = new WorkspaceService(new ProjectRepository(database)); registerWorkspaceIpc(workspace); const sessions = new SessionService(new SessionRepository(database)); registerSessionIpc(sessions); registerAgentIpc(registry, sessions); await discoverNativeSessions(sessions, workspace); } catch (error) { console.error('[storage] SQLite unavailable, using in-memory fallback', error); registerWorkspaceIpc(new WorkspaceService()); const sessions = new SessionService(); registerSessionIpc(sessions); registerAgentIpc(registry, sessions); } createWindow(); screen.on('display-metrics-changed', () => { for (const window of BrowserWindow.getAllWindows()) { const [width, height] = window.getContentSize(); const { width: screenW, height: screenH } = screen.getDisplayMatching(window.getBounds()).workAreaSize; if (width > screenW || height > screenH) window.setContentSize(Math.min(width, screenW), Math.min(height, screenH)); } }); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('before-quit', () => { database?.close(); database = undefined; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

