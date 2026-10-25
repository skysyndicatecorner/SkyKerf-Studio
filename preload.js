'use strict';
// SkyKerf_Studio — a minimal, safe API for the app page (no Node.js access in the renderer).
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('skykerfDesktop', {
  platform: process.platform,
  // { name, data, filters, sidecars? } → { ok, path }
  saveFile: (opts) => ipcRenderer.invoke('skykerf:save', opts),
  // { files:[{name,data}] } → asks for a folder → { ok, dir }
  saveFiles: (opts) => ipcRenderer.invoke('skykerf:saveFiles', opts),
  // { path?, name, data, backupOld } → { ok, path, backup? }
  saveProject: (opts) => ipcRenderer.invoke('skykerf:saveProject', opts),
  showItemInFolder: (p) => ipcRenderer.invoke('skykerf:showItem', p),
  // file passed on the command line / by double-click before the page was ready
  pendingFile: () => ipcRenderer.invoke('skykerf:pending'),
  // files opened while the app is already running
  onOpenFile: (cb) => ipcRenderer.on('skykerf:open', (_e, f) => cb(f)),
  // crash recovery and local error journal (never sent anywhere)
  autosave: (data) => ipcRenderer.invoke('skykerf:autosave', data),
  recovery: () => ipcRenderer.invoke('skykerf:recovery'),
  log: (line) => ipcRenderer.invoke('skykerf:log', line),
  // fonts: all font files in the system/user font folders and folders the user added
  listFonts: () => ipcRenderer.invoke('skykerf:fonts'),
  fontData: (p) => ipcRenderer.invoke('skykerf:fontData', p),
  addFontFolder: () => ipcRenderer.invoke('skykerf:addFontFolder'),
  // real path of a dropped/selected file (Electron ≥ 32 has no File.path)
  // clipboard contents for Paste (image as PNG data URL, text, html)
  readClipboard: () => ipcRenderer.invoke('skykerf:readClipboard'),
  // remember the machine's USB port so the next connection picks it without a dialog
  preferSerial: (o) => ipcRenderer.invoke('skykerf:preferSerial', o),
  pathForFile: (file) => { try { return webUtils.getPathForFile(file) || null } catch (e) { return null } },
});
