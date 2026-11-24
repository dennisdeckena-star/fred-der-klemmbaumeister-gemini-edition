import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
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

function buildAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Datei',
      submenu: [
        {
          label: 'Neu laden',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.reload(),
        },
        { type: 'separator' },
        {
          label: 'Beenden',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { role: 'undo', label: 'Rückgängig' },
        { role: 'redo', label: 'Wiederholen' },
        { type: 'separator' },
        { role: 'cut', label: 'Ausschneiden' },
        { role: 'copy', label: 'Kopieren' },
        { role: 'paste', label: 'Einfügen' },
        { role: 'selectAll', label: 'Alles auswählen' },
      ],
    },
    {
      label: 'Ansicht',
      submenu: [
        { role: 'resetZoom', label: 'Standard-Zoom (100 %)' },
        { role: 'zoomIn', label: 'Vergrößern' },
        { role: 'zoomOut', label: 'Verkleinern' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Vollbild umschalten' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Entwicklertools (Konsole)' },
      ],
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'GitHub Releases & Updates öffnen',
          click: () => {
            void shell.openExternal(
              'https://github.com/dennisdeckena-star/fred-der-klemmbaumeister-gemini-edition/releases',
            );
          },
        },
        { type: 'separator' },
        {
          label: 'Über Fred, der Klemmbaumeister',
          click: () => {
            void dialog.showMessageBox({
              type: 'info',
              title: 'Über Fred, der Klemmbaumeister',
              message: `Fred, der Klemmbaumeister – Gemini Edition v${app.getVersion()}`,
              detail:
                'Lokale 3D-Klemmbaustein-CAD- & Bauanleitungs-Desktopsoftware mit Google Gemini, Nano Banana Bild-Werkzeug, 100+ LDraw-Bauteilen und BlueBrixx-ergonomischem PDF-Export.',
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: `Fred, der Klemmbaumeister – Gemini Edition v${app.getVersion()}`,
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

// CORS-freier Main-Process-Proxy für den kostenlosen schlüssellosen FLUX.1-schnell ZeroGPU Space
ipcMain.handle('image:generateFreeFlux', async (_evt, prompt: string) => {
  const spaceBase = 'https://black-forest-labs-flux-1-schnell.hf.space';
  const postRes = await fetch(`${spaceBase}/gradio_api/call/infer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [String(prompt), 0, true, 768, 512, 4] }),
  });
  if (!postRes.ok) {
    throw new Error(`FLUX.1-schnell Space POST HTTP ${postRes.status}`);
  }
  const postJson = (await postRes.json()) as { event_id?: string };
  if (!postJson.event_id) {
    throw new Error('FLUX.1-schnell Space lieferte keine event_id.');
  }
  const sseRes = await fetch(`${spaceBase}/gradio_api/call/infer/${encodeURIComponent(postJson.event_id)}`);
  if (!sseRes.ok) {
    throw new Error(`FLUX.1-schnell Space SSE HTTP ${sseRes.status}`);
  }
  const sseText = await sseRes.text();
  const urlMatch = sseText.match(/"url"\s*:\s*"(https:\/\/[^"]+)"/);
  if (!urlMatch?.[1]) {
    throw new Error('FLUX.1-schnell Space lieferte keine Bild-URL (ZeroGPU-Limit erreicht).');
  }
  const imgRes = await fetch(urlMatch[1]);
  if (!imgRes.ok) {
    throw new Error(`FLUX.1-schnell Bild-Download HTTP ${imgRes.status}`);
  }
  const mime = imgRes.headers.get('content-type')?.split(';')[0]?.trim() || 'image/webp';
  const buf = Buffer.from(await imgRes.arrayBuffer());
  return {
    imageDataUrl: `data:${mime};base64,${buf.toString('base64')}`,
    modelUsed: 'black-forest-labs/FLUX.1-schnell (ZeroGPU)',
  };
});

app.whenReady().then(() => {
  buildAppMenu();
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
