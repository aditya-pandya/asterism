const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage, shell } = require('electron');
const pkg = require('../package.json');
const isMac = process.platform === 'darwin';
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'mailto:']);
const ALLOWED_RENDERER_PERMISSIONS = new Set(['clipboard-read']);

let deferredFilePath = null;

function getPrimaryWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

function sendMenuAction(action) {
  const targetWindow = getPrimaryWindow();
  if (!targetWindow || targetWindow.isDestroyed()) return;
  targetWindow.webContents.send('menu:action', action);
}

function isAppUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'file:') return false;

    const appRoot = path.normalize(app.getAppPath());
    const targetPath = path.normalize(decodeURIComponent(parsedUrl.pathname));
    return targetPath === appRoot || targetPath.startsWith(`${appRoot}${path.sep}`);
  } catch {
    return false;
  }
}

function openExternalUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsedUrl.protocol)) return;
    shell.openExternal(parsedUrl.toString()).catch(err => {
      console.error('Failed to open external URL:', err);
    });
  } catch {
    // Ignore malformed URLs from renderer content.
  }
}

function lockDownRendererSession(mainWindow) {
  const rendererSession = mainWindow.webContents.session;
  const allowPermission = webContents =>
    Boolean(webContents && isAppUrl(webContents.getURL()));

  rendererSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(allowPermission(webContents) && ALLOWED_RENDERER_PERMISSIONS.has(permission));
  });

  if (typeof rendererSession.setPermissionCheckHandler === 'function') {
    rendererSession.setPermissionCheckHandler((webContents, permission) =>
      allowPermission(webContents) && ALLOWED_RENDERER_PERMISSIONS.has(permission)
    );
  }

  if (typeof rendererSession.setDevicePermissionHandler === 'function') {
    rendererSession.setDevicePermissionHandler(() => false);
  }
}

function inferDocumentKind(filePath, content) {
  const extension = path.extname(filePath).toLowerCase();
  if (['.md', '.markdown'].includes(extension)) return 'markdown';
  if (['.html', '.htm'].includes(extension)) return 'html';
  if (extension === '.txt') return 'text';
  if (/<(html|body|p|div|h1|h2|blockquote|ul|ol)\b/i.test(content)) return 'html';
  return 'text';
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: isMac ? '#00000000' : '#050505',
    title: pkg.productName,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 20 },
    show: false,
    ...(isMac && {
      vibrancy: 'under-window',
      visualEffectState: 'active'
    }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });

  lockDownRendererSession(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (currentUrl && url !== currentUrl) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });

  mainWindow.loadFile(path.join(app.getAppPath(), 'index.html'));

  mainWindow.webContents.on('did-finish-load', async () => {
    if (deferredFilePath) {
      try {
        const content = await fs.readFile(deferredFilePath, 'utf8');
        mainWindow.webContents.send('open-file', {
          filePath: deferredFilePath,
          name: path.basename(deferredFilePath),
          content
        });
      } catch (err) {
        console.error('Failed to read deferred file:', err);
      }
      deferredFilePath = null;
    }
  });
}

function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: 'CommandOrControl+,',
          click: () => sendMenuAction('open-settings')
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CommandOrControl+N',
          click: () => sendMenuAction('new-document')
        },
        {
          label: 'Open…',
          accelerator: 'CommandOrControl+O',
          click: () => sendMenuAction('open-document')
        },
        { type: 'separator' },
        {
          label: 'Save Output…',
          accelerator: 'CommandOrControl+S',
          click: () => sendMenuAction('save-output')
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpcHandlers() {
  ipcMain.handle('desktop:open-file', async () => {
    const targetWindow = getPrimaryWindow();
    const result = await dialog.showOpenDialog(targetWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Supported Documents', extensions: ['md', 'markdown', 'html', 'htm', 'txt'] },
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: 'HTML', extensions: ['html', 'htm'] },
        { name: 'Text', extensions: ['txt'] }
      ]
    });

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf8');

    return {
      canceled: false,
      filePath,
      name: path.basename(filePath),
      kind: inferDocumentKind(filePath, content),
      content
    };
  });

  ipcMain.handle('desktop:save-file', async (_event, options = {}) => {
    const targetWindow = getPrimaryWindow();
    const result = await dialog.showSaveDialog(targetWindow, {
      defaultPath: options.defaultPath || 'output.txt',
      filters: options.filters || []
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    await fs.writeFile(result.filePath, options.content || '', 'utf8');
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.on('desktop:set-app-icon-theme', (_event, dataUrl) => {
    if (!dataUrl || typeof dataUrl !== 'string') return;

    const iconImage = nativeImage.createFromDataURL(dataUrl);
    if (iconImage.isEmpty()) return;

    const targetWindow = getPrimaryWindow();
    if (targetWindow && process.platform !== 'darwin') {
      targetWindow.setIcon(iconImage);
    }

    if (isMac && app.dock) {
      app.dock.setIcon(iconImage);
    }
  });
}

app.on('open-file', async (event, filePath) => {
  event.preventDefault();
  const win = getPrimaryWindow();
  if (win && !win.isDestroyed()) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      win.webContents.send('open-file', { filePath, name: path.basename(filePath), content });
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  } else {
    deferredFilePath = filePath;
  }
});

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: pkg.productName,
    applicationVersion: '1.1',
    version: '',
    copyright: '© 2026 Aditya Pandya • https://aditya.pandya.co/'
  });

  registerIpcHandlers();
  buildMenu();

  // Check for file argument from CLI / Finder
  const fileArg = process.argv.find(arg =>
    !arg.startsWith('-') && /\.(md|markdown|txt|html|htm)$/i.test(arg)
  );
  if (fileArg) {
    deferredFilePath = path.resolve(fileArg);
  }

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
