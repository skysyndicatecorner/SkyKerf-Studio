'use strict';
// Exposes a minimal, safe API to the app page (no Node.js access in the renderer).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kerfDesktop', {
  platform: process.platform,
  // { name, data, filters } → { ok, path }
  saveFile: (opts) => ipcRenderer.invoke('kerf:save', opts),
  // file passed on the command line / via double-click before the page was ready
  pendingFile: () => ipcRenderer.invoke('kerf:pending'),
  // files opened while the app is already running
  onOpenFile: (cb) => ipcRenderer.on('kerf:open', (_e, f) => cb(f)),
});
