import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
function createWindow() { const window = new BrowserWindow({ width: 1440, height: 900, minWidth: 960, minHeight: 640, webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } }); if (process.env.CODEAGENT_DEV_URL) void window.loadURL(process.env.CODEAGENT_DEV_URL); else void window.loadFile(join(__dirname, '../renderer/index.html')); }
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
