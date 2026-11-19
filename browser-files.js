(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AsterismBrowserFiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DOC_EXT = new Set(['md', 'markdown', 'txt', 'html', 'htm']);
  const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
  const extension = name => String(name).split('.').pop().toLowerCase();
  const supported = name => DOC_EXT.has(extension(name));
  function safePath(value, { reference = false } = {}) {
    const raw = reference ? String(value || '').split(/[?#]/, 1)[0] : String(value || '');
    let path;
    try { path = reference ? decodeURIComponent(raw) : raw; } catch { throw new Error('Invalid local path'); }
    if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0') || (reference && (/^[a-z][a-z\d+.-]*:/i.test(path) || path.split('/')[0].includes(':')))) throw new Error('Only relative local paths are supported');
    return path;
  }
  function normalize(basePath, reference) {
    const base = safePath(basePath), ref = safePath(reference, { reference: true }), stack = base.split('/').slice(0, -1);
    for (const part of ref.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { if (!stack.length) throw new Error('Path is outside the selected folder'); stack.pop(); }
      else stack.push(part);
    }
    return stack.join('/');
  }
  async function resolveFile(folder, path) {
    const parts = safePath(path).split('/');
    let dir = folder;
    for (const part of parts.slice(0, -1)) {
      if (!part || part === '.') continue;
      if (part === '..') throw new Error('Path is outside the selected folder');
      dir = await dir.getDirectoryHandle(part);
    }
    const leaf = parts.at(-1);
    if (!leaf || leaf === '.' || leaf === '..') throw new Error('Invalid local path');
    return dir.getFileHandle(leaf);
  }
  async function readFile(handle) { return handle.getFile(); }
  async function readText(handle) { return (await readFile(handle)).text(); }
  async function writeText(handle, value) {
    const writer = await handle.createWritable();
    try { await writer.write(value); await writer.close(); }
    catch (error) { try { await writer.abort?.(); } catch {} throw error; }
  }
  function candidate(handle, path, content, kind) {
    return { name: path.split('/').at(-1), filePath: path, content, kind, handle, expectedContent: content, browserFile: true };
  }
  async function readablePermission(handle) {
    if (typeof handle.queryPermission !== 'function') return;
    const state = await handle.queryPermission({ mode: 'read' });
    if (state !== 'granted') { const error = new Error('Permission to read this file is not granted'); error.name = 'NotAllowedError'; throw error; }
  }
  async function createWritable(handle) {
    if (typeof handle.queryPermission === 'function') {
      let state = await handle.queryPermission({ mode: 'readwrite' });
      if (state !== 'granted' && typeof handle.requestPermission === 'function') state = await handle.requestPermission({ mode: 'readwrite' });
      if (state !== 'granted') { const error = new Error('Permission to write this file is not granted'); error.name = 'NotAllowedError'; throw error; }
    }
  }
  function create(options = {}) {
    const env = options.environment || (typeof window !== 'undefined' ? window : globalThis);
    let folderHandle = null;
    return {
      supported: typeof env.showOpenFilePicker === 'function' && typeof env.showSaveFilePicker === 'function',
      async openMarkdown() {
        if (typeof env.showOpenFilePicker !== 'function') return { unavailable: true };
        let handles;
        try { handles = await env.showOpenFilePicker({ multiple: false, types: [{ description: 'Documents', accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt'], 'text/html': ['.html', '.htm'] } }] }); }
        catch (error) { if (error?.name === 'AbortError') return { canceled: true }; throw error; }
        const handle = handles?.[0]; if (!handle) return { canceled: true };
        const name = handle.name || 'document.md';
        if (!supported(name)) throw new Error('Choose a Markdown, text, or HTML file');
        const content = await readText(handle);
        const ext = extension(name);
        return candidate(handle, name, content, ext === 'md' || ext === 'markdown' ? 'markdown' : ext === 'txt' ? 'text' : 'html');
      },
      async save({ document, content, expectedContent = document?.expectedContent, force = false } = {}) {
        if (!document?.handle || !document.browserFile) return { unavailable: true };
        if (document.kind !== 'markdown' || !['md', 'markdown'].includes(extension(document.filePath))) return { unsupported: true, requiresSaveAs: true };
        await readablePermission(document.handle);
        let current;
        try { current = await readText(document.handle); }
        catch (error) {
          if (error?.name === 'NotFoundError' || error?.code === 'ENOENT') return { conflict: true, missing: true, requiresSaveAs: true };
          throw error;
        }
        if (!force && current !== expectedContent) return { conflict: true };
        await createWritable(document.handle);
        const saved = String(content ?? ''); await writeText(document.handle, saved);
        return { canceled: false, filePath: document.filePath, content: saved, expectedContent: saved };
      },
      async saveAs({ content, suggestedName = 'untitled.md' } = {}) {
        if (typeof env.showSaveFilePicker !== 'function') return { unavailable: true };
        let handle;
        try { handle = await env.showSaveFilePicker({ suggestedName, types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'] } }] }); }
        catch (error) { if (error?.name === 'AbortError') return { canceled: true }; throw error; }
        if (!handle) return { canceled: true };
        const path = handle.name || suggestedName;
        if (!['md', 'markdown'].includes(extension(path))) throw new Error('Choose a Markdown filename');
        await createWritable(handle);
        const saved = String(content ?? ''); await writeText(handle, saved);
        return candidate(handle, path, saved, 'markdown');
      },
      async chooseFolder() {
        if (typeof env.showDirectoryPicker !== 'function') return { unavailable: true };
        try { folderHandle = await env.showDirectoryPicker({ mode: 'read' }); return { canceled: false }; }
        catch (error) { if (error?.name === 'AbortError') return { canceled: true }; throw error; }
      },
      async pathForDocument(document) {
        if (!folderHandle || !document?.handle) return null;
        if (typeof folderHandle.resolve !== 'function') return null;
        const parts = await folderHandle.resolve(document.handle);
        return parts ? parts.join('/') : null;
      },
      async openRelative({ basePath, document, href } = {}) {
        if (!folderHandle) throw new Error('Choose a folder to open local links');
        const actualBase = document ? await this.pathForDocument(document) : basePath;
        if (!actualBase) throw new Error('The selected folder does not contain this document');
        const path = normalize(actualBase, href);
        if (!supported(path)) throw new Error('Only Markdown, text, and HTML files can be opened');
        const handle = await resolveFile(folderHandle, path), content = await readText(handle), ext = extension(path);
        return candidate(handle, path, content, ext === 'md' || ext === 'markdown' ? 'markdown' : ext === 'txt' ? 'text' : 'html');
      },
      async readRelativeImage({ basePath, document, src } = {}) {
        if (!folderHandle) throw new Error('Choose a folder to read local images');
        const actualBase = document ? await this.pathForDocument(document) : basePath;
        if (!actualBase) throw new Error('The selected folder does not contain this document');
        const path = normalize(actualBase, src), ext = extension(path);
        if (!IMAGE_EXT.has(ext)) throw new Error('Unsupported image type');
        const handle = await resolveFile(folderHandle, path), file = await readFile(handle);
        if (typeof file.size === 'number' && file.size > 10 * 1024 * 1024) throw new Error('Image exceeds 10 MiB');
        const bytes = new Uint8Array(await file.arrayBuffer());
        let valid = false;
        if (ext === 'png') valid = [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
        if (ext === 'jpg' || ext === 'jpeg') valid = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        if (ext === 'gif') valid = new TextDecoder().decode(bytes.slice(0,6)) === 'GIF87a' || new TextDecoder().decode(bytes.slice(0,6)) === 'GIF89a';
        if (ext === 'webp') valid = new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP';
        if (!valid) throw new Error('Image content does not match its file type');
        const blob = new Blob([bytes], { type: MIME[ext] });
        if (typeof FileReader === 'undefined') return `data:${MIME[ext]};base64,${Buffer.from(bytes).toString('base64')}`;
        return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
      }
    };
  }
  return { create, supported: name => supported(name), parseRelativePath: value => safePath(value, { reference: true }) };
});
