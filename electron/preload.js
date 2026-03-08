const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  isElectron: true,
  openFile: () => ipcRenderer.invoke('desktop:open-file'),
  saveFile: (options) => ipcRenderer.invoke('desktop:save-file', options),
  onMenuAction: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const handler = (_event, action) => callback(action);
    ipcRenderer.on('menu:action', handler);

    return () => {
      ipcRenderer.removeListener('menu:action', handler);
    };
  }
});
