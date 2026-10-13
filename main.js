'use strict';
// Kerf Studio — Electron main process (Windows, Linux)
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');

const OPENABLE = /\.(kerf|json|nc|gcode|gc|ngc|tap)$/i;
const MAX_FILE = 200 * 1024 * 1024;
let win = null;
let pendingFile = null;

// Only one window: a second launch (e.g. double-clicking a .kerf file) is routed to the running app.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const f = fileFromArgv(argv);
    if (f) sendFile(f);
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
}

function fileFromArgv(argv) {
  const p = argv.slice(app.isPackaged ? 1 : 2).find(a => OPENABLE.test(a));
  return p ? path.resolve(p) : null;
}

async function readFileForRenderer(p) {
  const st = await fs.stat(p);
  if (st.size > MAX_FILE) throw new Error('file too large');
  return { name: path.basename(p), data: await fs.readFile(p, 'utf8') };
}

async function sendFile(p) {
  try {
    const f = await readFileForRenderer(p);
    if (win && !win.webContents.isLoading()) win.webContents.send('kerf:open', f);
    else pendingFile = f;
  } catch (e) {
    dialog.showErrorBox('Kerf Studio', `Не удалось открыть файл / Could not open file:\n${p}\n${e.message}`);
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    show: false,
    backgroundColor: '#121519',
    title: 'Kerf Studio',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Links open in the system browser; the app window never navigates away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); if (/^https?:\/\//i.test(url)) shell.openExternal(url); }
  });

  // Developer tools only when running from source (npm start).
  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
    });
  }

  const ses = win.webContents.session;
  // Allow only what the app needs: the machine's serial port and clipboard writes.
  const ALLOWED = new Set(['serial', 'clipboard-sanitized-write', 'fullscreen']);
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED.has(permission));
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(ALLOWED.has(permission)));
  ses.setDevicePermissionHandler(details => details.deviceType === 'serial');

  // Web Serial: show a native list of ports when the app asks for one.
  ses.on('select-serial-port', async (event, portList, _wc, callback) => {
    event.preventDefault();
    if (!portList.length) {
      await dialog.showMessageBox(win, {
        type: 'info', title: 'Kerf Studio',
        message: 'Порты не найдены / No serial ports found',
        detail: 'Подключите станок по USB и проверьте драйвер (CH340, CP210x, FTDI).\nConnect the machine over USB and check the driver (CH340, CP210x, FTDI).\nLinux: sudo usermod -aG dialout $USER',
      });
      callback('');
      return;
    }
    const labels = portList.map(p => `${p.portName || p.portId}${p.displayName ? ' — ' + p.displayName : ''}`);
    const { response } = await dialog.showMessageBox(win, {
      type: 'question', title: 'Kerf Studio',
      message: 'Выберите порт станка / Choose the machine port',
      buttons: [...labels, 'Отмена / Cancel'],
      cancelId: labels.length, noLink: true,
    });
    callback(response < portList.length ? portList[response].portId : '');
  });
}

ipcMain.handle('kerf:save', async (_e, opts) => {
  const name = path.basename(String((opts && opts.name) || 'untitled.txt'));
  const data = opts && opts.data;
  if (typeof data !== 'string' || data.length > MAX_FILE) throw new Error('invalid data');
  const filters = Array.isArray(opts.filters) ? opts.filters.slice(0, 4).map(f => ({
    name: String(f.name || 'File'),
    extensions: Array.isArray(f.extensions) ? f.extensions.map(x => String(x).replace(/[^a-z0-9]/gi, '')).filter(Boolean) : ['*'],
  })) : [];
  const r = await dialog.showSaveDialog(win, { defaultPath: name, filters: [...filters, { name: 'All files', extensions: ['*'] }] });
  if (r.canceled || !r.filePath) return { ok: false };
  await fs.writeFile(r.filePath, data, 'utf8');
  return { ok: true, path: r.filePath };
});

ipcMain.handle('kerf:pending', () => { const f = pendingFile; pendingFile = null; return f; });

app.whenReady().then(async () => {
  if (process.platform === 'win32') app.setAppUserModelId('org.kerfstudio.app');
  Menu.setApplicationMenu(null);
  const f = fileFromArgv(process.argv);
  // Read the start-up file before the page loads, so the page can pick it up at boot.
  if (f) { try { pendingFile = await readFileForRenderer(f); } catch (e) { dialog.showErrorBox('Kerf Studio', `${f}\n${e.message}`); } }
  createWindow();
});

app.on('window-all-closed', () => app.quit());
