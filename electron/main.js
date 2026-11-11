const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage, shell } = require('electron');
const pkg = require('../package.json');
const isMac = process.platform === 'darwin';
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'mailto:']);
const ALLOWED_RENDERER_PERMISSIONS = new Set(['clipboard-read']);
const SUPPORTED_DOCUMENT_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.html', '.htm']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

let deferredFilePath = null;
let needsUnsavedPrompt = false;
const openedDocumentPaths = new Set();
const writableMarkdownPaths = new Set();

function confirmDiscardChanges() {
  if (!needsUnsavedPrompt) return true;
  const options = {
    type: 'warning',
    title: 'Unsaved changes',
    message: 'Discard unsaved changes?',
    detail: 'Your edits have not been saved.',
    buttons: ['Cancel', 'Discard Changes'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  };
  const window = getPrimaryWindow();
  const choice = window ? dialog.showMessageBoxSync(window, options) : dialog.showMessageBoxSync(options);
  if (choice !== 1) return false;
  needsUnsavedPrompt = false;
  return true;
}

function authorizeDocumentPath(filePath) {
  const resolvedPath = path.resolve(filePath);
  const extension = path.extname(resolvedPath).toLowerCase();
  if (!SUPPORTED_DOCUMENT_EXTENSIONS.has(extension)) return;
  openedDocumentPaths.add(resolvedPath);
  if (extension === '.md' || extension === '.markdown') writableMarkdownPaths.add(resolvedPath);
}

function resolveRelativePath(baseFilePath, reference) {
  if (typeof baseFilePath !== 'string' || !openedDocumentPaths.has(path.resolve(baseFilePath))) {
    throw new Error('Open the document in Asterism before following local links');
  }
  if (typeof reference !== 'string') throw new TypeError('Local link must be text');
  const rawPath = reference.trim().split(/[?#]/, 1)[0];
  let relativePath;
  try {
    relativePath = decodeURIComponent(rawPath);
  } catch {
    throw new Error('Invalid local link');
  }
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.startsWith('\\') ||
      relativePath.includes('\\') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(relativePath) ||
      relativePath.includes('\0')) {
    throw new Error('Only relative local links are supported');
  }
  return path.resolve(path.dirname(baseFilePath), relativePath);
}

function imageMimeType(filePath, data) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png' && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (['.jpg', '.jpeg'].includes(extension) && data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg';
  if (extension === '.gif' && ['GIF87a', 'GIF89a'].includes(data.toString('ascii', 0, 6))) return 'image/gif';
  if (extension === '.webp' && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw new Error('Only PNG, JPEG, GIF, and WebP images are supported');
}

// Saved documents and settings live in the renderer's local storage inside the
// userData folder. Electron names that folder after the app, so an existing
// install keeps using the folder it created while the app was called Inkdown.
const LEGACY_USER_DATA = path.join(app.getPath('appData'), 'Inkdown');
if (require('node:fs').existsSync(LEGACY_USER_DATA)) {
  app.setPath('userData', LEGACY_USER_DATA);
}

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
    backgroundColor: '#fdfdfc',
    title: pkg.productName,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 20 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });

  mainWindow.on('close', event => {
    if (!confirmDiscardChanges()) event.preventDefault();
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
        authorizeDocumentPath(deferredFilePath);
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
          label: 'Save',
          accelerator: 'CommandOrControl+S',
          click: () => sendMenuAction('save-output')
        },
        {
          label: 'Save As…',
          accelerator: 'CommandOrControl+Shift+S',
          click: () => sendMenuAction('save-as')
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
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find',
          submenu: [
            {
              label: 'Find…',
              accelerator: 'CommandOrControl+F',
              click: () => sendMenuAction('find')
            },
            {
              label: 'Find and Replace…',
              accelerator: 'Alt+CommandOrControl+F',
              click: () => sendMenuAction('replace')
            },
            {
              label: 'Find Next',
              accelerator: 'CommandOrControl+G',
              click: () => sendMenuAction('find-next')
            },
            {
              label: 'Find Previous',
              accelerator: 'CommandOrControl+Shift+G',
              click: () => sendMenuAction('find-previous')
            }
          ]
        }
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
  ipcMain.on('desktop:set-unsaved-state', (event, needsPrompt) => {
    needsUnsavedPrompt = needsPrompt === true;
    event.returnValue = true;
  });

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
    authorizeDocumentPath(filePath);

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
    authorizeDocumentPath(result.filePath);
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle('desktop:write-file', async (_event, options = {}) => {
    const { filePath, content, expectedContent, force = false } = options;
    if (typeof filePath !== 'string' || !writableMarkdownPaths.has(path.resolve(filePath))) {
      throw new Error('The file must be opened or saved in Asterism first');
    }
    if (typeof content !== 'string') throw new TypeError('File content must be text');
    if (force !== true) {
      if (typeof expectedContent !== 'string') throw new TypeError('Expected file content must be text');
      let diskContent;
      try {
        diskContent = await fs.readFile(filePath, 'utf8');
      } catch (error) {
        if (error?.code === 'ENOENT') return { conflict: true };
        throw error;
      }
      if (diskContent !== expectedContent) return { conflict: true };
    }
    await fs.writeFile(filePath, content, 'utf8');
    return { canceled: false, filePath };
  });

  ipcMain.handle('desktop:open-relative-file', async (_event, { baseFilePath, href } = {}) => {
    const filePath = resolveRelativePath(baseFilePath, href);
    if (!SUPPORTED_DOCUMENT_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
      throw new Error('Only Markdown, text, and HTML documents can be opened');
    }
    const content = await fs.readFile(filePath, 'utf8');
    authorizeDocumentPath(filePath);
    return { canceled: false, filePath, name: path.basename(filePath), kind: inferDocumentKind(filePath, content), content };
  });

  ipcMain.handle('desktop:read-relative-image', async (_event, { baseFilePath, src } = {}) => {
    const filePath = resolveRelativePath(baseFilePath, src);
    const info = await fs.stat(filePath);
    if (!info.isFile() || info.size > MAX_IMAGE_BYTES) throw new Error('Image must be a file under 10 MiB');
    const data = await fs.readFile(filePath);
    if (data.length > MAX_IMAGE_BYTES) throw new Error('Image must be under 10 MiB');
    const mimeType = imageMimeType(filePath, data);
    return `data:${mimeType};base64,${data.toString('base64')}`;
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
      authorizeDocumentPath(filePath);
      win.webContents.send('open-file', { filePath, name: path.basename(filePath), content });
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  } else {
    deferredFilePath = filePath;
  }
});

app.on('before-quit', event => {
  if (!confirmDiscardChanges()) event.preventDefault();
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
