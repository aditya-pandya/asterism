// Run with: ./node_modules/.bin/electron tests/recovered-draft-reattachment-smoke.js
// Boots the real renderer against an isolated profile and mocked desktop bridge.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const repoRoot = path.resolve(__dirname, '..');
const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), 'asterism-recovery-'));
const sourcePath = path.join(profilePath, 'notes.md');
const baseline = '# Original\r\n\r\nDisk source with CRLF.\r\n';
const draft = '# Recovered draft\n\nKeep these edits intact.\n';

app.setPath('userData', profilePath);

function makeWindow() {
  return new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
}

async function evaluate(window, source) {
  return window.webContents.executeJavaScript(source);
}

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.fail(message);
}

async function reload(window) {
  const loaded = new Promise(resolve => window.webContents.once('did-finish-load', resolve));
  window.webContents.reload();
  await loaded;
}

async function main() {
  await app.whenReady();
  fs.writeFileSync(sourcePath, baseline, 'utf8');
  const window = makeWindow();

  try {
    await window.loadFile(path.join(repoRoot, 'index.html'));
    await evaluate(window, `localStorage.setItem('inkdown.draftSnapshot', ${JSON.stringify(JSON.stringify({
      version: 1, markdown: draft, name: 'notes.md', filePath: sourcePath,
      kind: 'markdown', lastSavedMarkdown: baseline.replace(/\r\n/g, '\n'), lastDiskContent: baseline
    }))});`);
    await reload(window);

    await evaluate(window, `window.__openResults = [];
      window.__writeAttempts = [];
      window.desktopBridge = {
        isElectron: true,
        openFile: async () => window.__openResults.shift(),
        writeFile: async options => {
          window.__writeAttempts.push(options);
          window.__lastWrite = options;
          return options.expectedContent === ${JSON.stringify(baseline)}
            ? { filePath: options.filePath } : { conflict: true };
        },
        setUnsavedState: () => {}
      };
      renderStatusHint();`);

    async function tryAttach(result) {
      await evaluate(window, `window.__openResults.push(${JSON.stringify(result)});
        document.getElementById('reconnectFileButton').click();`);
      await waitFor(() => evaluate(window, 'window.__openResults.length === 0'), 'openFile mock should be consumed');
      await new Promise(resolve => setTimeout(resolve, 20));
      return evaluate(window, `({ text: document.getElementById('markdownEditor').textContent,
        recovered: state.recoveredDocument, filePath: state.currentFilePath,
        lastDiskContent: state.lastDiskContent, hint: document.getElementById('hintText').textContent })`);
    }

    const initial = await evaluate(window, `({ visible: !document.getElementById('reconnectFileButton').hidden,
      text: document.getElementById('markdownEditor').textContent, recovered: state.recoveredDocument })`);
    assert.equal(initial.visible, true, 'snapshot with a source path should offer reconnect');
    assert.equal(initial.recovered, true, 'snapshot should restore in detached recovered state');
    assert.equal(initial.text, draft, 'recovery should show the draft');

    const snapshotBeforeAutosaveToggle = await evaluate(window, `localStorage.getItem('inkdown.draftSnapshot')`);
    await evaluate(window, `document.getElementById('settingsButton').click();
      [...document.querySelectorAll('#settingsRows .setting-row')]
        .find(row => row.textContent.includes('Auto-save')).querySelectorAll('button')[1].click();`);
    const snapshotWithAutosaveOff = await evaluate(window, `localStorage.getItem('inkdown.draftSnapshot')`);
    assert.equal(snapshotWithAutosaveOff, snapshotBeforeAutosaveToggle,
      'turning Auto-save off must retain the existing recovered-draft snapshot unchanged');
    await evaluate(window, `document.querySelectorAll('#settingsRows .setting-row')` +
      `.length && [...document.querySelectorAll('#settingsRows .setting-row')]` +
      `.find(row => row.textContent.includes('Auto-save')).querySelectorAll('button')[0].click();`);

    let stateAfter = await tryAttach({ name: 'other.md', filePath: path.join(profilePath, 'other.md'), content: baseline, kind: 'markdown' });
    assert.equal(stateAfter.recovered, true, 'a different path must not attach the draft');
    assert.equal(stateAfter.filePath, '', 'a different path must not make the app writeable against that file');
    assert.equal(stateAfter.text, draft, 'a different path must preserve the recovered draft');
    assert.equal(await evaluate(window, 'window.__writeAttempts.length'), 0, 'wrong-path reconnect must never attempt a write');

    const otherPath = path.join(profilePath, 'other.md');
    fs.writeFileSync(otherPath, 'Other file stays intact.\n', 'utf8');
    fs.writeFileSync(sourcePath, '# Changed on disk\n', 'utf8');
    stateAfter = await tryAttach({ name: 'notes.md', filePath: sourcePath, content: fs.readFileSync(sourcePath, 'utf8'), kind: 'markdown' });
    assert.equal(stateAfter.recovered, true, 'changed disk content must leave the draft detached');
    assert.equal(stateAfter.text, draft, 'changed disk content must not replace the draft');
    assert.equal(fs.readFileSync(sourcePath, 'utf8'), '# Changed on disk\n', 'changed disk content must not be overwritten');
    assert.equal(fs.readFileSync(otherPath, 'utf8'), 'Other file stays intact.\n', 'a wrong selected file must remain untouched');
    assert.equal(await evaluate(window, 'window.__writeAttempts.length'), 0, 'changed-disk reconnect must never attempt a write');

    fs.writeFileSync(sourcePath, baseline, 'utf8');
    stateAfter = await tryAttach({ name: 'notes.md', filePath: sourcePath, content: baseline, kind: 'markdown' });
    assert.equal(stateAfter.recovered, false, 'same unchanged file should reattach');
    assert.equal(stateAfter.filePath, sourcePath, 'reattachment should restore the original path');
    assert.equal(stateAfter.text, draft, 'reattachment must keep the recovered draft text');
    assert.equal(stateAfter.lastDiskContent, baseline, 'reattachment must retain the exact raw CRLF disk baseline');

    await evaluate(window, `document.getElementById('downloadButton').click()`);
    await waitFor(() => evaluate(window, 'Boolean(window.__lastWrite)'), 'Save should call the desktop write bridge');
    const write = await evaluate(window, 'window.__lastWrite');
    assert.equal(write.filePath, sourcePath, 'Save after reattachment should target the original file');
    assert.equal(write.expectedContent, baseline, 'Save should use the raw CRLF disk baseline for conflict detection');
    assert.equal(write.content, draft, 'Save should write the recovered draft');
    assert.equal(await evaluate(window, 'window.__writeAttempts.length'), 1, 'successful Save should make one write attempt');
    const diskBeforeSave = fs.readFileSync(sourcePath, 'utf8');
    assert.equal(write.expectedContent, diskBeforeSave, 'mocked bridge should accept Save only against the current raw disk content');
    fs.writeFileSync(write.filePath, write.content, 'utf8');
    assert.equal(fs.readFileSync(sourcePath, 'utf8'), draft, 'successful Save should persist the recovered draft to disk');

    await evaluate(window, `window.confirm = () => true;
      loadBrowserFile(new File(['Fresh browser document.\\n'], 'replacement.md', { type: 'text/markdown' }));`);
    await waitFor(() => evaluate(window, `state.currentFileName === 'replacement.md'`), 'browser document should replace recovered draft');
    const replacementSnapshot = JSON.parse(await evaluate(window, `localStorage.getItem('inkdown.draftSnapshot')`));
    assert.equal(replacementSnapshot.markdown, 'Fresh browser document.\n', 'replacement browser document should become the next snapshot');
    assert.equal(replacementSnapshot.filePath, '', 'replacement snapshot must not retain the old recovered file path');
    assert.equal(replacementSnapshot.lastDiskContent, 'Fresh browser document.\n', 'replacement snapshot must not retain the old disk baseline');

    // Legacy browser recovery remains detached and has no reconnect affordance.
    await evaluate(window, `localStorage.removeItem('inkdown.draftSnapshot');
      localStorage.setItem('inkdown.doc', ${JSON.stringify(draft)});
      localStorage.setItem('inkdown.docMeta', JSON.stringify({ name: 'legacy.md' }));`);
    await reload(window);
    await evaluate(window, `window.desktopBridge = undefined; renderStatusHint();`);
    const legacy = await evaluate(window, `({ text: document.getElementById('markdownEditor').textContent,
      recovered: state.recoveredDocument, visible: !document.getElementById('reconnectFileButton').hidden })`);
    assert.equal(legacy.recovered, true, 'legacy local draft should still be marked recovered');
    assert.equal(legacy.text, draft, 'legacy fallback should keep its saved text');
    assert.equal(legacy.visible, false, 'legacy metadata without a safe baseline must not offer reconnect');

    // In a browser without the desktop bridge, opening still uses the file input.
    const browserOpen = await evaluate(window, `(() => {
      document.getElementById('openButton').click();
      return document.getElementById('fileInput').type === 'file';
    })()`);
    assert.equal(browserOpen, true, 'browser fallback should retain the file input open flow');
    console.log('Recovered-draft reattachment smoke test passed.');
  } finally {
    window.destroy();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
}

main().then(() => app.quit()).catch(error => {
  console.error(error);
  app.exit(1);
});
