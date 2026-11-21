(() => {
  const unsavedClock = Number.isFinite(performance.timeOrigin)
    ? performance.timeOrigin + performance.now() : Date.now();
  let unsavedRevision = Math.round(unsavedClock * 1000);
  let lastNeedsPrompt = null;
  function tauri() {
    if (!window.__TAURI__) {
      throw new Error('Tauri APIs are unavailable');
    }
    return window.__TAURI__;
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
      const file = await tauri().core.invoke('open_document');
      if (!file) return { canceled: true };
      return {
        canceled: false,
        ...file,
        kind: inferDocumentKind(file.filePath, file.content)
      };
    },
    saveFile: async (options = {}) => {
      const filePath = await tauri().core.invoke('save_document_as', {
        defaultPath: options.defaultPath || 'output.md',
        content: options.content || ''
      });
      if (!filePath) return { canceled: true };
      return { canceled: false, filePath };
    },
    writeFile: async ({ filePath, content, expectedContent, force = false }) => {
      const conflict = await tauri().core.invoke('write_document', { filePath, content, expectedContent, force });
      return conflict ? { conflict: true } : { canceled: false, filePath };
    },
    openRelativeFile: async ({ baseFilePath, href }) => {
      const file = await tauri().core.invoke('open_relative_file', { baseFilePath, href });
      return { canceled: false, ...file, kind: inferDocumentKind(file.filePath, file.content) };
    },
    readRelativeImage: ({ baseFilePath, src }) => tauri().core.invoke('read_relative_image', { baseFilePath, src }),
    setUnsavedState: ({ needsPrompt } = {}) => {
      const next = needsPrompt === true;
      if (next === lastNeedsPrompt) return;
      lastNeedsPrompt = next;
      tauri().core.invoke('set_unsaved_state', { needsPrompt: next, revision: ++unsavedRevision })
        .catch(error => {
          lastNeedsPrompt = null;
          console.error('Could not update unsaved document state:', error);
        });
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
