'use strict';
// SkyKerf_Studio — Electron main process (Windows, Linux; macOS builds are left to porters)
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fss = require('fs');

const APP_NAME = 'SkyKerf_Studio';
const LEGACY_NAMES = ['Kerf Studio', 'kerf-studio']; // userData folders of the 0.1–0.2 builds
const OPENABLE = /\.(kerf|skykerf|json|nc|gcode|gc|ngc|tap|svg|dxf)$/i;
const MAX_FILE = 200 * 1024 * 1024;
let win = null;
let pendingFile = null;
const savedPaths = new Set(); // "show in folder" only for files this session wrote

app.setName(APP_NAME);
app.setPath('userData', path.join(app.getPath('appData'), APP_NAME));

/* ---------- settings migration from Kerf Studio (copy once, never delete) ---------- */
function migrateLegacyUserData() {
  const target = app.getPath('userData'), marker = path.join(target, 'migrated-from-kerf-studio.json');
  try {
    if (fss.existsSync(marker)) return;
    for (const name of LEGACY_NAMES) {
      const src = path.join(app.getPath('appData'), name);
      if (!fss.existsSync(src) || path.resolve(src) === path.resolve(target)) continue;
      fss.mkdirSync(target, { recursive: true });
      const copied = [];
      for (const sub of ['Local Storage', 'IndexedDB', 'autosave']) {
        const from = path.join(src, sub), to = path.join(target, sub);
        if (fss.existsSync(from) && !fss.existsSync(to)) { fss.cpSync(from, to, { recursive: true, errorOnExist: false }); copied.push(sub) }
      }
      fss.writeFileSync(marker, JSON.stringify({ from: src, copied, at: new Date().toISOString(), note: 'The old folder was left untouched.' }, null, 1));
      return;
    }
    fss.mkdirSync(target, { recursive: true });
    fss.writeFileSync(marker, JSON.stringify({ from: null, at: new Date().toISOString() }));
  } catch (e) { console.error('migration', e) }
}

/* ---------- single instance: a second launch (double-clicked file) goes to the running app ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  migrateLegacyUserData(); // before Chromium opens the profile
  app.on('second-instance', (_e, argv) => {
    const f = fileFromArgv(argv);
    if (f) sendFile(f);
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
}
function fileFromArgv(argv) { const p = argv.slice(app.isPackaged ? 1 : 2).find(a => OPENABLE.test(a)); return p ? path.resolve(p) : null }
async function readFileForRenderer(p) {
  const st = await fs.stat(p); if (st.size > MAX_FILE) throw new Error('file too large');
  return { name: path.basename(p), path: p, data: await fs.readFile(p, 'utf8') };
}
async function sendFile(p) {
  try { const f = await readFileForRenderer(p); if (win && !win.webContents.isLoading()) win.webContents.send('skykerf:open', f); else pendingFile = f }
  catch (e) { dialog.showErrorBox(APP_NAME, `Не удалось открыть файл / Could not open file:\n${p}\n${e.message}`) }
}

/* ---------- crash recovery: a flag file exists while the app runs ---------- */
const runFlag = () => path.join(app.getPath('userData'), 'running.flag');
const autosaveFile = () => path.join(app.getPath('userData'), 'autosave', 'current.kerf');
let recovery = null;
function checkRecovery() {
  try {
    if (fss.existsSync(runFlag()) && fss.existsSync(autosaveFile())) { const st = fss.statSync(autosaveFile()); recovery = { time: st.mtimeMs, path: null, data: fss.readFileSync(autosaveFile(), 'utf8') } }
    fss.mkdirSync(app.getPath('userData'), { recursive: true }); fss.writeFileSync(runFlag(), String(process.pid));
  } catch (e) { console.error('recovery', e) }
}
async function writeAtomic(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid; await fs.writeFile(tmp, data, 'utf8'); await fs.rename(tmp, file);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 960, minHeight: 620, show: false, backgroundColor: '#121519', title: APP_NAME,
    icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Links open in the system browser; the app window never navigates away and loads nothing remote.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' } });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); if (/^https:\/\//i.test(url)) shell.openExternal(url) } });
  if (!app.isPackaged) win.webContents.on('before-input-event', (_e, input) => { if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools() });

  const ses = win.webContents.session;
  // Only what the app needs: the machine's serial port, clipboard writes, fullscreen and installed fonts.
  const ALLOWED = new Set(['serial', 'clipboard-sanitized-write', 'fullscreen', 'local-fonts']);
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED.has(permission));
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(ALLOWED.has(permission)));
  ses.setDevicePermissionHandler(details => details.deviceType === 'serial');
  ses.webRequest.onBeforeRequest((details, cb) => cb({ cancel: !/^(file|devtools|data|blob):/i.test(details.url) }));

  // Web Serial: a native list of ports. Connecting never starts a job.
  ses.on('select-serial-port', async (event, portList, _wc, callback) => {
    event.preventDefault();
    if (!portList.length) {
      await dialog.showMessageBox(win, { type: 'info', title: APP_NAME, message: 'Порты не найдены / No serial ports found', detail: 'Подключите станок по USB и проверьте драйвер (CH340, CP210x, FTDI).\nConnect the machine over USB and check the driver (CH340, CP210x, FTDI).\nLinux: sudo usermod -aG dialout $USER' });
      callback(''); return;
    }
    const labels = portList.map(p => `${p.portName || p.portId}${p.displayName ? ' — ' + p.displayName : ''}${p.vendorId ? ` [${p.vendorId}:${p.productId}]` : ''}`);
    const { response } = await dialog.showMessageBox(win, { type: 'question', title: APP_NAME, message: 'Выберите порт станка / Choose the machine port', buttons: [...labels, 'Отмена / Cancel'], cancelId: labels.length, noLink: true });
    callback(response < portList.length ? portList[response].portId : '');
  });
}

/* ---------- IPC: files ---------- */
const cleanName = n => path.basename(String(n || 'untitled.txt')).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').slice(0, 180) || 'untitled.txt';
const cleanFilters = f => Array.isArray(f) ? f.slice(0, 4).map(x => ({ name: String(x.name || 'File'), extensions: Array.isArray(x.extensions) ? x.extensions.map(e => String(e).replace(/[^a-z0-9]/gi, '')).filter(Boolean) : ['*'] })) : [];
const checkData = d => { if (typeof d !== 'string' || d.length > MAX_FILE) throw new Error('invalid data') };

ipcMain.handle('skykerf:save', async (_e, o) => {
  o = o || {}; checkData(o.data);
  const r = await dialog.showSaveDialog(win, { defaultPath: cleanName(o.name), filters: [...cleanFilters(o.filters), { name: 'All files', extensions: ['*'] }] });
  if (r.canceled || !r.filePath) return { ok: false };
  await fs.writeFile(r.filePath, o.data, 'utf8'); savedPaths.add(r.filePath);
  const side = [];
  for (const s of Array.isArray(o.sidecars) ? o.sidecars.slice(0, 6) : []) {
    checkData(s.data); const base = s.stripExt ? r.filePath.replace(/\.[^.\\/]+$/, '') : r.filePath;
    const p = base + String(s.suffix || '.txt').replace(/[\\/:*?"<>|]/g, '_'); await fs.writeFile(p, s.data, 'utf8'); savedPaths.add(p); side.push(p);
  }
  return { ok: true, path: r.filePath, sidecars: side };
});
ipcMain.handle('skykerf:saveFiles', async (_e, o) => {
  o = o || {}; const files = Array.isArray(o.files) ? o.files.slice(0, 200) : []; if (!files.length) return { ok: false };
  const r = await dialog.showOpenDialog(win, { title: 'Папка для файлов / Folder for the files', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const dir = r.filePaths[0], targets = files.map(f => { checkData(f.data); return path.join(dir, cleanName(f.name)) });
  const exists = targets.filter(p => fss.existsSync(p));
  if (exists.length) {
    const { response } = await dialog.showMessageBox(win, { type: 'warning', title: APP_NAME, message: `Файлов уже существует: ${exists.length}. Заменить? / ${exists.length} file(s) already exist. Replace them?`, detail: exists.slice(0, 8).map(p => path.basename(p)).join('\n'), buttons: ['Заменить / Replace', 'Отмена / Cancel'], cancelId: 1, noLink: true });
    if (response !== 0) return { ok: false };
  }
  for (let i = 0; i < files.length; i++) { await fs.writeFile(targets[i], files[i].data, 'utf8'); savedPaths.add(targets[i]) }
  savedPaths.add(dir); return { ok: true, dir, path: targets[0] };
});
ipcMain.handle('skykerf:saveProject', async (_e, o) => {
  o = o || {}; checkData(o.data); let p = o.path ? path.resolve(String(o.path)) : null;
  if (p && !/\.(kerf|skykerf|json)$/i.test(p)) p = null;
  if (!p) {
    const r = await dialog.showSaveDialog(win, { defaultPath: cleanName(o.name || 'project.kerf'), filters: [{ name: 'SkyKerf_Studio project', extensions: ['kerf'] }] });
    if (r.canceled || !r.filePath) return { ok: false }; p = r.filePath;
  }
  let backup = null;
  if (o.backupOld && fss.existsSync(p)) { // keep the old-format file before overwriting it
    const base = p.replace(/\.[^.\\/]+$/, ''); let k = 0; do { backup = `${base}.backup${k ? '-' + k : ''}.kerf`; k++ } while (fss.existsSync(backup));
    await fs.copyFile(p, backup);
  }
  await writeAtomic(p, o.data); savedPaths.add(p); return { ok: true, path: p, backup };
});
ipcMain.handle('skykerf:showItem', (_e, p) => { if (typeof p === 'string' && savedPaths.has(p)) shell.showItemInFolder(p); return true });
ipcMain.handle('skykerf:pending', () => { const f = pendingFile; pendingFile = null; return f });
ipcMain.handle('skykerf:autosave', async (_e, data) => { checkData(data); await writeAtomic(autosaveFile(), data); return true });
ipcMain.handle('skykerf:recovery', () => { const r = recovery; recovery = null; return r });
ipcMain.handle('skykerf:log', async (_e, line) => {
  // Error journal: stays on this computer, never sent anywhere.
  const dir = path.join(app.getPath('userData'), 'logs'), f = path.join(dir, 'skykerf.log');
  await fs.mkdir(dir, { recursive: true });
  try { const st = await fs.stat(f); if (st.size > 1024 * 1024) await fs.rename(f, f + '.1') } catch (e) { }
  await fs.appendFile(f, String(line).slice(0, 8000) + '\n', 'utf8'); return true;
});

/* ---------- fonts: every font file on the computer, not only installed ones ---------- */
const { parseFontNames, FONT_FILE_RE } = require('./src/js/fontname.js');
const zlib = require('zlib'), os = require('os');
const fontFoldersFile = () => path.join(app.getPath('userData'), 'font-folders.json');
const fontCacheFile = () => path.join(app.getPath('userData'), 'font-cache.json');
const knownFontFiles = new Set();
function systemFontDirs() {
  const h = os.homedir();
  if (process.platform === 'win32') return [path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'), path.join(process.env.LOCALAPPDATA || path.join(h, 'AppData', 'Local'), 'Microsoft', 'Windows', 'Fonts')];
  if (process.platform === 'darwin') return ['/System/Library/Fonts', '/Library/Fonts', path.join(h, 'Library', 'Fonts')];
  return ['/usr/share/fonts', '/usr/local/share/fonts', path.join(h, '.fonts'), path.join(h, '.local', 'share', 'fonts')];
}
function userFontDirs() { try { return JSON.parse(fss.readFileSync(fontFoldersFile(), 'utf8')).filter(d => typeof d === 'string') } catch (e) { return [] } }
async function walkFonts(dir, out, depth) {
  if (depth > 8 || out.length > 30000) return; let ents; try { ents = await fs.readdir(dir, { withFileTypes: true }) } catch (e) { return }
  for (const e of ents) { const p = path.join(dir, e.name); if (e.isDirectory()) await walkFonts(p, out, depth + 1); else if (FONT_FILE_RE.test(e.name)) out.push(p) }
}
/* Read only the table directory and the 'name' / 'OS/2' tables of each face. */
async function readFontFaces(p, size) {
  if (/\.woff$/i.test(p) || size < 256 * 1024) return parseFontNames(await fs.readFile(p), { inflate: x => zlib.inflateSync(x) });
  const fh = await fs.open(p, 'r');
  const rd = async (off, len) => { const b = Buffer.alloc(len); await fh.read(b, 0, len, off); return b };
  try {
    const head = await rd(0, 12), offsets = head.toString('latin1', 0, 4) === 'ttcf' ? [] : [0];
    if (!offsets.length) { const n = Math.min((await rd(8, 4)).readUInt32BE(0), 64), t = await rd(12, n * 4); for (let i = 0; i < n; i++) offsets.push(t.readUInt32BE(i * 4)) }
    const faces = [];
    for (let fi = 0; fi < offsets.length; fi++) {
      const off = offsets[fi], nt = (await rd(off + 4, 2)).readUInt16BE(0), dir = await rd(off + 12, nt * 16), want = {};
      for (let i = 0; i < nt; i++) { const tg = dir.toString('latin1', i * 16, i * 16 + 4); if (tg === 'name' || tg === 'OS/2') want[tg] = { o: dir.readUInt32BE(i * 16 + 8), l: dir.readUInt32BE(i * 16 + 12) } }
      if (!want.name || want.name.l > 4e6) continue;
      const tags = Object.keys(want), parts = []; let pos = 12 + tags.length * 16;
      for (const tg of tags) { const b = await rd(want[tg].o, want[tg].l); parts.push({ tg, b, at: pos }); pos += b.length + ((4 - b.length % 4) % 4) }
      const mini = Buffer.alloc(pos); mini.writeUInt32BE(0x00010000, 0); mini.writeUInt16BE(tags.length, 4);
      parts.forEach((q, i) => { mini.write(q.tg, 12 + i * 16, 'latin1'); mini.writeUInt32BE(q.at, 12 + i * 16 + 8); mini.writeUInt32BE(q.b.length, 12 + i * 16 + 12); q.b.copy(mini, q.at) });
      for (const f of parseFontNames(mini)) faces.push(Object.assign(f, { index: fi }));
    }
    return faces;
  } finally { await fh.close() }
}
async function scanFonts() {
  let cache = {}; try { cache = JSON.parse(await fs.readFile(fontCacheFile(), 'utf8')) } catch (e) { }
  const files = [], dirs = systemFontDirs().concat(userFontDirs()), fresh = {}, faces = [];
  for (const d of dirs) await walkFonts(d, files, 0);
  for (const p of files) {
    let st; try { st = await fs.stat(p) } catch (e) { continue }
    const key = st.size + ':' + Math.round(st.mtimeMs); let ent = cache[p];
    if (!ent || ent.key !== key) {
      let list = [];
      if (/\.woff2$/i.test(p)) list = [{ family: path.basename(p).replace(/\.[^.]+$/, '').replace(/[-_]+(regular|bold|italic|light|medium|black|thin).*$/i, '').replace(/[-_]+/g, ' '), style: 'Regular', weight: 400, italic: false, index: 0 }];
      else { try { list = await readFontFaces(p, st.size) } catch (e) { list = [] } }
      ent = { key, faces: list.map(f => ({ family: f.family, style: f.style, weight: f.weight, italic: f.italic, index: f.index || 0 })) };
    }
    fresh[p] = ent; knownFontFiles.add(p);
    for (const f of ent.faces) faces.push(Object.assign({ path: p, user: !systemFontDirs().some(d => p.startsWith(d)) }, f));
  }
  try { await fs.writeFile(fontCacheFile(), JSON.stringify(fresh)) } catch (e) { }
  return faces;
}
ipcMain.handle('skykerf:fonts', () => scanFonts());
ipcMain.handle('skykerf:fontData', async (_e, p) => { if (typeof p !== 'string' || !knownFontFiles.has(p)) throw new Error('unknown font file'); const st = await fs.stat(p); if (st.size > 64 * 1024 * 1024) throw new Error('font too large'); return new Uint8Array(await fs.readFile(p)) });
ipcMain.handle('skykerf:addFontFolder', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Папка со шрифтами / Font folder', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const list = userFontDirs(); if (!list.includes(r.filePaths[0])) list.push(r.filePaths[0]); await fs.writeFile(fontFoldersFile(), JSON.stringify(list.slice(-20)));
  return { ok: true, dir: r.filePaths[0] };
});

app.whenReady().then(async () => {
  checkRecovery();
  if (process.platform === 'win32') app.setAppUserModelId('org.kerfstudio.app'); // kept from 0.2 so updates replace the old install
  Menu.setApplicationMenu(null);
  const f = fileFromArgv(process.argv);
  if (f) { try { pendingFile = await readFileForRenderer(f) } catch (e) { dialog.showErrorBox(APP_NAME, `${f}\n${e.message}`) } }
  createWindow();
});
app.on('will-quit', () => { try { fss.rmSync(runFlag(), { force: true }) } catch (e) { } });
app.on('window-all-closed', () => app.quit());
