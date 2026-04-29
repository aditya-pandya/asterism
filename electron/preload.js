const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  isElectron: true,
  openFile: () => ipcRenderer.invoke('desktop:open-file'),
  saveFile: (options) => ipcRenderer.invoke('desktop:save-file', options),
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
