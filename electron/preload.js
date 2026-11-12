const { contextBridge, ipcRenderer } = require('electron');
let lastNeedsPrompt = null;

contextBridge.exposeInMainWorld('desktopBridge', {
  isElectron: true,
  openFile: () => ipcRenderer.invoke('desktop:open-file'),
  saveFile: (options) => ipcRenderer.invoke('desktop:save-file', options),
  writeFile: (options) => ipcRenderer.invoke('desktop:write-file', options),
  openRelativeFile: (options) => ipcRenderer.invoke('desktop:open-relative-file', options),
  readRelativeImage: (options) => ipcRenderer.invoke('desktop:read-relative-image', options),
  setUnsavedState: ({ needsPrompt } = {}) => {
    const next = needsPrompt === true;
    if (next === lastNeedsPrompt) return;
    ipcRenderer.sendSync('desktop:set-unsaved-state', next);
    lastNeedsPrompt = next;
  },
  setAppIconTheme: (dataUrl) => ipcRenderer.send('desktop:set-app-icon-theme', dataUrl),
  onMenuAction: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const handler = (_event, action) => callback(action);
    ipcRenderer.on('menu:action', handler);

    return () => {
      ipcRenderer.removeListener('menu:action', handler);
    };
  },
  onOpenFile: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, filePath) => callback(filePath);
    ipcRenderer.on('open-file', handler);
    return () => {
      ipcRenderer.removeListener('open-file', handler);
    };
  }
});
