const assert = require('node:assert/strict');
const { test } = require('node:test');
const { create, parseRelativePath } = require('../browser-files');

function fileHandle(name, initial) {
  let content = initial;
  return {
    name,
    async getFile() {
      if (content === null) { const error = new Error('missing'); error.name = 'NotFoundError'; throw error; }
      const bytes = Buffer.from(content);
      return { text: async () => content, size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    },
    async createWritable() { return { write: async value => { content = value; }, close: async () => {}, abort: async () => {} }; },
    change(value) { content = value; },
    value() { return content; }
  };
}
function directory(entries = {}) {
  return {
    async getDirectoryHandle(name) { if (!entries[name] || !entries[name].getFileHandle) throw new Error('missing directory'); return entries[name]; },
    async getFileHandle(name) { if (!entries[name]) throw new Error('missing file'); return entries[name]; }
  };
}
test('opened Markdown preserves empty content and raw CRLF baseline for conflict detection', async () => {
  const handle = fileHandle('note.md', '');
  const api = create({ environment: { showOpenFilePicker: async () => [handle], showSaveFilePicker: async () => handle } });
  const opened = await api.openMarkdown();
  assert.equal(opened.content, '');
  handle.change('changed\r\n');
  assert.deepEqual(await api.save({ document: opened, content: 'mine' }), { conflict: true });
  handle.change('');
  assert.equal((await api.save({ document: opened, content: 'new' })).content, 'new');
});
test('missing opened file requires Save As even when force is requested', async () => {
  const handle = fileHandle('note.markdown', 'base');
  const api = create({ environment: { showOpenFilePicker: async () => [handle] } });
  const opened = await api.openMarkdown(); handle.change(null);
  assert.deepEqual(await api.save({ document: opened, content: 'next' }), { conflict: true, missing: true, requiresSaveAs: true });
  assert.deepEqual(await api.save({ document: opened, content: 'next', force: true }), { conflict: true, missing: true, requiresSaveAs: true });
});
test('save as adopts the selected markdown handle', async () => {
  const handle = fileHandle('copy.md', null);
  const api = create({ environment: { showSaveFilePicker: async () => handle } });
  const saved = await api.saveAs({ content: 'saved' });
  assert.equal(saved.filePath, 'copy.md');
  assert.equal(handle.value(), 'saved');
  assert.equal((await api.save({ document: saved, content: 'again' })).content, 'again');
});
test('relative documents can traverse within selected folder and retain caller URL separately', async () => {
  const target = fileHandle('linked.md', '# linked');
  const folder = directory({ 'linked.md': target, sub: directory({}) });
  const api = create({ environment: { showDirectoryPicker: async () => folder } });
  await api.chooseFolder();
  const opened = await api.openRelative({ basePath: 'sub/current.md', href: '../linked.md?mode=x#part' });
  assert.equal(opened.filePath, 'linked.md');
  assert.equal(opened.content, '# linked');
  const other = fileHandle('original.md', 'original');
  const original = { handle: other, browserFile: true, kind: 'markdown', filePath: 'original.md', expectedContent: 'original' };
  const linked = await api.openRelative({ basePath: 'sub/current.md', href: '../linked.md' });
  assert.equal((await api.save({ document: linked, content: 'edited linked' })).filePath, 'linked.md');
  assert.equal(other.value(), 'original');
  assert.equal((await api.save({ document: original, content: 'edited original' })).filePath, 'original.md');
});
test('rejects absolute, scheme, backslash, null, and out-of-root paths', async () => {
  for (const value of ['/etc/passwd', 'https://x/a.md', 'C:/a.md', 'a\\b.md', 'a\0b.md']) assert.throws(() => parseRelativePath(value));
  const api = create({ environment: { showDirectoryPicker: async () => directory() } }); await api.chooseFolder();
  await assert.rejects(api.openRelative({ basePath: 'note.md', href: '../outside.md' }), /outside/);
});
test('rejects raster bytes whose signature does not match extension', async () => {
  const png = fileHandle('bad.png', 'not png');
  const api = create({ environment: { showDirectoryPicker: async () => directory({ 'bad.png': png }) } }); await api.chooseFolder();
  await assert.rejects(api.readRelativeImage({ basePath: 'note.md', src: 'bad.png' }), /does not match/);
});
test('folder association is explicit, nested image paths support ../, and GIF signatures validate', async () => {
  const outside = fileHandle('outside.md', 'x');
  const gif87 = fileHandle('pic.gif', Buffer.from('GIF87a').toString('binary'));
  const gif89 = fileHandle('other.gif', Buffer.from('GIF89a').toString('binary'));
  const sub = directory({ 'pic.gif': gif87 });
  const folder = directory({ sub, 'other.gif': gif89 });
  folder.resolve = async handle => handle === outside ? null : handle === gif87 ? ['sub', 'current.md'] : null;
  const api = create({ environment: { showDirectoryPicker: async () => folder } }); await api.chooseFolder();
  const doc = { handle: outside, browserFile: true, filePath: 'outside.md' };
  await assert.rejects(api.openRelative({ document: doc, href: 'x.md' }), /does not contain/);
  await assert.rejects(api.readRelativeImage({ basePath: 'sub/current.md', src: '../nope.gif' }));
  assert.match(await api.readRelativeImage({ basePath: 'sub/current.md', src: 'pic.gif' }), /^data:image\/gif;base64,/);
  assert.match(await api.readRelativeImage({ basePath: 'sub/current.md', src: '../other.gif' }), /^data:image\/gif;base64,/);
});
test('permission failures propagate instead of becoming missing-file conflicts', async () => {
  const handle = fileHandle('note.md', 'base'); handle.queryPermission = async () => 'denied';
  const api = create({ environment: { showOpenFilePicker: async () => [handle] } }); const opened = await api.openMarkdown();
  await assert.rejects(api.save({ document: opened, content: 'new' }), { name: 'NotAllowedError' });
});
test('open supports text and HTML but in-place save is Markdown-only', async () => {
  const txt = fileHandle('notes.txt', 'plain');
  const html = fileHandle('page.html', '<p>page</p>');
  const choices = [txt, html];
  const api = create({ environment: { showOpenFilePicker: async () => [choices.shift()] } });
  const textDoc = await api.openMarkdown();
  assert.equal(textDoc.kind, 'text');
  assert.deepEqual(await api.save({ document: textDoc, content: 'changed' }), { unsupported: true, requiresSaveAs: true });
  const htmlDoc = await api.openMarkdown();
  assert.equal(htmlDoc.kind, 'html');
  assert.deepEqual(await api.save({ document: htmlDoc, content: 'changed' }), { unsupported: true, requiresSaveAs: true });
});
test('reference decoding happens once and literal normalized names keep percent, hash, and unicode', async () => {
  const encodedHash = fileHandle('hash#name.md', 'hash');
  const percent = fileHandle('100%real.md', 'percent');
  const unicode = fileHandle('café.md', 'unicode');
  const folder = directory({ 'hash#name.md': encodedHash, '100%real.md': percent, 'café.md': unicode });
  const api = create({ environment: { showDirectoryPicker: async () => folder } }); await api.chooseFolder();
  assert.equal((await api.openRelative({ basePath: 'root.md', href: 'hash%23name.md' })).content, 'hash');
  assert.equal((await api.openRelative({ basePath: 'root.md', href: '100%25real.md' })).content, 'percent');
  assert.equal((await api.openRelative({ basePath: 'root.md', href: 'caf%C3%A9.md' })).content, 'unicode');
});
