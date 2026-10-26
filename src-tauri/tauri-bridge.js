(() => {
  function tauri() {
    if (!window.__TAURI__) {
      throw new Error('Tauri APIs are unavailable');
    }
    return window.__TAURI__;
  }

  function basename(filePath) {
    return filePath.split(/[\\/]/).pop();
  }

  function inferDocumentKind(filePath, content) {
    const extension = (filePath.match(/\.[^.]+$/)?.[0] || '').toLowerCase();
    if (['.md', '.markdown'].includes(extension)) return 'markdown';
    if (['.html', '.htm'].includes(extension)) return 'html';
    if (extension === '.txt') return 'text';
    if (/<(html|body|p|div|h1|h2|blockquote|ul|ol)\b/i.test(content)) return 'html';
    return 'text';
  }

  function subscribe(eventName, callback) {
    if (typeof callback !== 'function') return () => {};

    let disposed = false;
    let unlisten = null;
    tauri().event.listen(eventName, (event) => callback(event.payload)).then((stop) => {
      if (disposed) {
        stop();
      } else {
        unlisten = stop;
      }
    });

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }

  window.desktopBridge = {
    isElectron: true,
    isTauri: true,
    openFile: async () => {
      const { dialog, fs } = tauri();
      const filePath = await dialog.open({
        multiple: false,
        directory: false,
        filters: [
          { name: 'Supported Documents', extensions: ['md', 'markdown', 'html', 'htm', 'txt'] },
          { name: 'Markdown', extensions: ['md', 'markdown'] },
          { name: 'HTML', extensions: ['html', 'htm'] },
          { name: 'Text', extensions: ['txt'] }
        ]
      });

      if (!filePath || Array.isArray(filePath)) return { canceled: true };

      const content = await fs.readTextFile(filePath);
      return {
        canceled: false,
        filePath,
        name: basename(filePath),
        kind: inferDocumentKind(filePath, content),
        content
      };
    },
    saveFile: async (options = {}) => {
      const { dialog, fs } = tauri();
      const filePath = await dialog.save({
        defaultPath: options.defaultPath || 'output.txt',
        filters: options.filters || []
      });

      if (!filePath) return { canceled: true };

      await fs.writeTextFile(filePath, options.content || '');
      return { canceled: false, filePath };
    },
    startDragging: () => tauri().window.getCurrentWindow().startDragging(),
    setAppIconTheme: () => {},
    onMenuAction: (callback) => subscribe('menu-action', callback),
    onOpenFile: (callback) => {
      if (typeof callback !== 'function') return () => {};

      let disposed = false;
      let unlisten = null;
      tauri().event.listen('open-file', (event) => callback(event.payload)).then(async (stop) => {
        if (disposed) {
          stop();
          return;
        }

        unlisten = stop;
        const file = await tauri().core.invoke('take_pending_open_file');
        if (!disposed && file) callback(file);
      });

      return () => {
        disposed = true;
        if (unlisten) unlisten();
      };
    }
  };
})();
