import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import {
  deleteGeminiApiKey,
  getSecretStatus,
  loadGeminiApiKey,
  saveGeminiApiKey,
} from './secrets';

let mainWindow: BrowserWindow | null = null;

function resolveIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', 'fred-icon.png');
  }
  return path.resolve(__dirname, '..', 'assets', 'fred-icon.png');
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: 'Fred, der Klemmbaumeister – Gemini Edition',
    backgroundColor: '#f4f6fa',
    icon: resolveIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.resolve(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('app:getInfo', () => ({
  name: 'Fred, der Klemmbaumeister – Gemini Edition',
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
}));

ipcMain.handle('secrets:status', () => getSecretStatus());
ipcMain.handle('secrets:saveKey', (_evt, apiKey: string) => saveGeminiApiKey(apiKey));
ipcMain.handle('secrets:loadKey', () => loadGeminiApiKey());
ipcMain.handle('secrets:deleteKey', () => deleteGeminiApiKey());

app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
