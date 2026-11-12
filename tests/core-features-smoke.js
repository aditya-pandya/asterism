// Run with: ./node_modules/.bin/electron tests/core-features-smoke.js
// Checks user-facing renderer routing, jump/focus behavior, print restoration,
// and the empty-document unsaved guard using an isolated hidden window.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const repoRoot = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'asterism-core-'));
app.setPath('userData', profile);
app.on('window-all-closed', () => {});
const isMac = process.platform === 'darwin';
const jumpDocument = '# Same\n\n## Café guide\n\n```js\n# fake heading\n```\n\nSame\n---\n';
const printCss = fs.readFileSync(path.join(repoRoot, 'styles.css'), 'utf8');

function evaluate(win, js) { return win.webContents.executeJavaScript(js); }
function key(win, { key, code, shift = false, alt = false, target = 'markdownEditor', modifier = true }) {
  return evaluate(win, `(() => {
    const target = document.getElementById(${JSON.stringify(target)});
    target.focus();
    const event = new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, code: ${JSON.stringify(code || '')},
      bubbles: true, cancelable: true, ${modifier ? (isMac ? 'metaKey: true' : 'ctrlKey: true') : 'metaKey: false, ctrlKey: false'}, shiftKey: ${shift}, altKey: ${alt} });
    document.dispatchEvent(event);
    return { prevented: event.defaultPrevented, active: document.activeElement.id };
  })()`);
}

async function main() {
  await app.whenReady();
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.on('console-message', (_event, level, message, line, source) => {
    if (level >= 2) console.error(`[renderer ${source}:${line}] ${message}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => console.error('Renderer process exited:', details));
  try {
    await win.loadFile(path.join(repoRoot, 'index.html'));
    await evaluate(win, `closeReader(); setDocumentFromMarkdown('one two');`);
    await evaluate(win, `setMarkdownSelection(0, 3);`);
    await key(win, { key: 'b', code: 'KeyB' });
    assert.equal(await evaluate(win, 'state.markdown'), '**one** two', 'Cmd/Ctrl+B should route the source selection through the source command');
    const undo = await evaluate(win, `(() => { const result = document.execCommand('undo'); syncFromMarkdown(); return { result, markdown: state.markdown }; })()`);
    assert.equal(undo.markdown, 'one two', 'native undo should restore the Markdown after a source shortcut');

    const commands = [
      [{ key: 'i', code: 'KeyI' }, 'italic', '*one* two'],
      [{ key: 'k', code: 'KeyK' }, 'link', '[one](https://) two'],
      [{ key: 'c', code: 'KeyC', alt: true }, 'code', '`one` two'],
      [{ key: '1', code: 'Digit1', alt: true }, 'heading', '# one two'],
      [{ key: '7', code: 'Digit7', shift: true }, 'ordered list', '1. one two'],
      [{ key: '8', code: 'Digit8', shift: true }, 'list', '- one two']
    ];
    for (const [shortcut, label, expected] of commands) {
      await evaluate(win, `setDocumentFromMarkdown('one two'); setMarkdownSelection(0, ${label === 'heading' || label === 'list' ? 7 : 3});`);
      await key(win, shortcut);
      assert.equal(await evaluate(win, 'state.markdown'), expected, `${label} shortcut should preserve and transform the source selection`);
    }

    await evaluate(win, `setDocumentFromMarkdown('- item'); setMarkdownSelection(6, 6);`);
    const continuedList = await key(win, { key: 'Enter', code: 'Enter', modifier: false });
    assert.equal(continuedList.prevented, true, 'Enter on a Markdown list item should be handled by list continuation');
    assert.equal(await evaluate(win, 'state.markdown'), '- item\n- ', 'Enter should continue a Markdown bullet list');
    await evaluate(win, `setDocumentFromMarkdown('- '); setMarkdownSelection(2, 2);`);
    const exitedList = await key(win, { key: 'Enter', code: 'Enter', modifier: false });
    assert.equal(exitedList.prevented, true, 'Enter on an empty Markdown list item should be handled');
    assert.equal(await evaluate(win, 'state.markdown'), '', 'Enter on an empty list item should exit the list');
    const fencedMarkdown = '```js\nconst value = 1;\n```';
    await evaluate(win, `setDocumentFromMarkdown(${JSON.stringify(fencedMarkdown)}); setMarkdownSelection(${fencedMarkdown.indexOf('const') + 'const value = 1;'.length}, ${fencedMarkdown.indexOf('const') + 'const value = 1;'.length});`);
    const fencedEnter = await key(win, { key: 'Enter', code: 'Enter', modifier: false });
    assert.equal(fencedEnter.prevented, false, 'Enter inside a fenced code block should remain normal editor input');
    assert.equal(await evaluate(win, 'state.markdown'), fencedMarkdown, 'the fenced-code Enter handler should not rewrite source before the browser inserts a newline');

    await evaluate(win, `setDocumentFromMarkdown('type normally');`);
    const question = await evaluate(win, `(() => { const editor = document.getElementById('markdownEditor');
      const e = new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true });
      editor.focus(); editor.dispatchEvent(e);
      return { prevented: e.defaultPrevented, helpOpen: !document.getElementById('settingsOverlay').hidden }; })()`);
    assert.equal(question.prevented, false, 'typing ? in the Markdown editor should remain normal text input');
    assert.equal(question.helpOpen, false, 'typing ? in the editor should not open shortcut help');

    await evaluate(win, `setDocumentFromMarkdown('protected source'); setMarkdownSelection(0, 9); document.getElementById('jumpButton').click();`);
    const jumpShortcut = await evaluate(win, `(() => { const before = state.markdown; const event = new KeyboardEvent('keydown', {
      key: 'b', code: 'KeyB', bubbles: true, cancelable: true, ${isMac ? 'metaKey: true' : 'ctrlKey: true'} });
      document.getElementById('jumpInput').dispatchEvent(event); return { before, after: state.markdown, prevented: event.defaultPrevented }; })()`);
    assert.equal(jumpShortcut.after, jumpShortcut.before, 'format shortcuts must not mutate the source while typing in the heading filter');
    await evaluate(win, `document.getElementById('jumpBackdrop').click(); document.getElementById('settingsButton').click();`);
    const settingsShortcut = await evaluate(win, `(() => { const before = state.markdown; const target = document.querySelector('#settingsRows button, #settingsRows [tabindex]');
      if (target) target.focus(); const event = new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', bubbles: true, cancelable: true,
      ${isMac ? 'metaKey: true' : 'ctrlKey: true'} }); document.dispatchEvent(event); return { before, after: state.markdown }; })()`);
    assert.equal(settingsShortcut.after, settingsShortcut.before, 'format shortcuts must not run while Settings is open');
    await evaluate(win, `document.getElementById('settingsButton').click();`);

    await evaluate(win, `setDocumentFromMarkdown(${JSON.stringify(jumpDocument)});`);
    const jumpState = await evaluate(win, `(() => {
      const before = state.markdown; document.getElementById('jumpButton').click();
      const items = jumpItems.map(item => ({ label: item.label, line: item.line }));
      document.getElementById('jumpInput').value = 'cafe';
      document.getElementById('jumpInput').dispatchEvent(new Event('input', { bubbles: true }));
      const matches = [...document.querySelectorAll('.jump-item')].map(x => x.textContent);
      document.getElementById('jumpInput').value = 'not a heading';
      document.getElementById('jumpInput').dispatchEvent(new Event('input', { bubbles: true }));
      const noResults = !document.getElementById('jumpEmpty').hidden;
      document.getElementById('jumpInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      const escapeClosed = document.getElementById('jumpOverlay').hidden;
      document.getElementById('jumpButton').click();
      document.getElementById('jumpInput').value = 'same';
      document.getElementById('jumpInput').dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('.jump-item').click();
      const selection = getSelection();
      const selected = selection.toString();
      return { before, after: state.markdown, items, matches, noResults, escapeClosed, selected, focus: document.activeElement.id };
    })()`);
    assert.deepEqual(jumpState.items.map(x => x.label), ['Same', 'Café guide', 'Same'], 'heading jump should include setext headings and exclude code-fence examples');
    assert.equal(jumpState.items[1].line, 2, 'heading jump should retain the source line for Unicode headings');
    assert.deepEqual(jumpState.matches, ['Café guide'], 'heading filter should ignore accents');
    assert.equal(jumpState.noResults, true, 'heading filter should show its empty state');
    assert.equal(jumpState.escapeClosed, true, 'Escape should close the jump overlay');
    assert.equal(jumpState.selected, '# Same', 'choosing a duplicate heading should select its exact source line');
    assert.equal(jumpState.after, jumpState.before, 'jumping must not mutate Markdown');

    await evaluate(win, `setDocumentFromMarkdown('Print me'); closeReader(); window.__printCalls = 0; window.print = () => { window.__printCalls += 1; }; printDocument();`);
    const printDuring = await evaluate(win, `({ calls: window.__printCalls, view: state.view })`);
    assert.equal(printDuring.calls, 1, 'print action should invoke the native print surface');
    assert.equal(printDuring.view, 'edit', 'printing should preserve the app view state');
    assert.match(await evaluate(win, `document.getElementById('readerContent').textContent`), /Print me/, 'print should populate the Reader content');
    assert.match(printCss, /\.reader-view, \.reader-view\[hidden\]\s*\{\s*display:\s*block\s*!important/s,
      'print CSS should reveal Reader even while the app remains in Edit');
    assert.match(printCss, /\.topbar, \.statusbar, \.find-bar, #editView[^}]*display:\s*none\s*!important/s,
      'print CSS should hide editor controls');
    assert.match(printCss, /\.outline, \.outline-backdrop, \.reader-actions[^}]*display:\s*none\s*!important/s,
      'print CSS should hide the outline and Reader actions');
    await evaluate(win, `window.dispatchEvent(new Event('afterprint'));`);
    assert.equal(await evaluate(win, 'state.view'), 'edit', 'afterprint should restore the prior Edit view');

    // Exercise the native menu bridge callback exactly once per action.
    const menu = await evaluate(win, `(() => {
      window.__menuCallbackCount = 0; window.__menuCallback = null;
      window.desktopBridge = { onMenuAction(callback) { window.__menuCallbackCount += 1; window.__menuCallback = callback; } };
      setupDesktopIntegration();
      setDocumentFromMarkdown('menu text'); closeReader(); document.getElementById('markdownEditor').focus(); setMarkdownSelection(0, 4);
      window.__menuCallback('format-bold');
      return { registrations: window.__menuCallbackCount, markdown: state.markdown };
    })()`);
    assert.equal(menu.registrations, 1, 'desktop menu callback should register exactly once');
    assert.equal(menu.markdown, '**menu** text', 'native format action should dispatch to the active source editor');

    // Duplicate labels verify that custom rich-link editing preserves the
    // exact selected occurrence and rejects executable URL schemes.
    await evaluate(win, `(() => { setDocumentFromMarkdown('Repeat and Repeat'); closeReader();
      const editor = document.getElementById('richEditor'); editor.focus();
      const text = editor.querySelector('p').firstChild; const range = document.createRange();
      range.setStart(text, 11); range.setEnd(text, 17); getSelection().removeAllRanges(); getSelection().addRange(range); })()`);
    await key(win, { key: 'k', code: 'KeyK', target: 'richEditor' });
    const linkOpened = await evaluate(win, `({ open: !document.getElementById('linkDialog').hidden,
      focused: document.activeElement.id, markdown: state.markdown })`);
    assert.equal(linkOpened.open, true, 'Cmd/Ctrl+K in the formatted editor should open the custom link dialog');
    assert.equal(linkOpened.focused, 'linkInput', 'link dialog should focus its address input');
    await evaluate(win, `document.getElementById('linkInput').value = 'javascript:alert(1)'; document.getElementById('linkInsert').click();`);
    const rejectedLink = await evaluate(win, `({ open: !document.getElementById('linkDialog').hidden,
      error: document.getElementById('linkError').textContent, errorVisible: !document.getElementById('linkError').hidden,
      markdown: state.markdown })`);
    assert.equal(rejectedLink.open, true, 'invalid URL should leave the link dialog open');
    assert.equal(rejectedLink.errorVisible, true, 'invalid URL should show inline validation');
    assert.match(rejectedLink.error, /not allowed/i, 'javascript URL should be rejected explicitly');
    assert.equal(rejectedLink.markdown, 'Repeat and Repeat', 'rejecting an unsafe URL must not change the document');
    await evaluate(win, `document.getElementById('linkInput').value = 'https://example.com'; document.getElementById('linkInsert').click();`);
    const linked = await evaluate(win, `({ markdown: state.markdown, links: [...document.querySelectorAll('#richEditor a')].map(a => ({ text: a.textContent, href: a.getAttribute('href') })) })`);
    assert.equal(linked.markdown, 'Repeat and [Repeat](https://example.com)', 'safe link should wrap only the selected duplicate text');
    assert.deepEqual(linked.links, [{ text: 'Repeat', href: 'https://example.com' }], 'only the selected occurrence should become a rendered link');
    const linkUndo = await evaluate(win, `(() => { document.getElementById('richEditor').focus();
      const result = document.execCommand('undo'); return { result, markdown: state.markdown }; })()`);
    assert.equal(linkUndo.markdown, 'Repeat and Repeat', 'native undo should reverse custom link insertion');

    // Task conversion from a paragraph, live checkbox updates, Reader
    // disabled state, and undo behavior all run through actual renderer UI.
    await evaluate(win, `(() => { setDocumentFromMarkdown('First item'); closeReader();
      const editor = document.getElementById('richEditor'); editor.focus();
      const text = editor.querySelector('p').firstChild; const range = document.createRange();
      range.setStart(text, 0); range.setEnd(text, text.textContent.length); getSelection().removeAllRanges(); getSelection().addRange(range); })()`);
    await key(win, { key: '9', code: 'Digit9', shift: true, target: 'richEditor' });
    const taskCreated = await evaluate(win, `({ markdown: state.markdown, boxes: [...document.querySelectorAll('#richEditor li > input[type="checkbox"]')].map(box => ({ disabled: box.disabled, checked: box.checked })) })`);
    assert.match(taskCreated.markdown, /- \[ \] First item/, 'task-list shortcut on a paragraph should create a Markdown task');
    assert.deepEqual(taskCreated.boxes, [{ disabled: false, checked: false }], 'rich task checkboxes should be enabled');
    await evaluate(win, `openReader();`);
    const readerTasks = await evaluate(win, `([...document.querySelectorAll('#readerContent li > input[type="checkbox"]')].map(box => ({ disabled: box.disabled, checked: box.checked })))`);
    assert.deepEqual(readerTasks, [{ disabled: true, checked: false }], 'Reader task checkboxes should be disabled');
    await evaluate(win, `closeReader(); document.querySelector('#richEditor li > input[type="checkbox"]').click();`);
    const checkedTask = await evaluate(win, `state.markdown`);
    assert.match(checkedTask, /- \[x\] First item/, 'clicking an enabled rich task checkbox should update Markdown to checked');
    const taskUndo = await evaluate(win, `(() => { document.getElementById('richEditor').focus();
      const result = document.execCommand('undo'); return { result, markdown: state.markdown,
        boxes: [...document.querySelectorAll('#richEditor li > input[type="checkbox"]')].map(box => ({ checked: box.checked, attribute: box.hasAttribute('checked') })) }; })()`);
    assert.match(taskUndo.markdown, /- \[ \] First item/,
      `native undo should restore the task checkbox to unchecked; execCommand=${taskUndo.result}, markdown=${JSON.stringify(taskUndo.markdown)}, boxes=${JSON.stringify(taskUndo.boxes)}`);

    const copied = await evaluate(win, `(async () => {
      window.__clipboardWrites = []; window.__clipboardData = null;
      class MockClipboardItem { constructor(data) { window.__clipboardData = data; } }
      Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: MockClipboardItem });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async items => window.__clipboardWrites.push(items.length) } });
      setDocumentFromMarkdown('A [link](../guide.md).\\n\\n![pic](../images/pic.png)');
      const before = state.markdown; await copyFormatted();
      const html = await window.__clipboardData['text/html'].text();
      const text = await window.__clipboardData['text/plain'].text();
      return { before, after: state.markdown, count: window.__clipboardWrites.length,
        types: Object.keys(window.__clipboardData || {}), html: window.__clipboardData?.['text/html']?.size || 0,
        text: window.__clipboardData?.['text/plain']?.size || 0, htmlText: html, plainText: text };
    })()`);
    assert.equal(copied.count, 1, 'formatted Copy should write one clipboard item');
    assert.deepEqual(copied.types, ['text/html', 'text/plain'], 'formatted Copy should provide both sanitized HTML and plain text');
    assert.ok(copied.html > 0 && copied.text > 0, 'clipboard formats should contain document content');
    assert.match(copied.htmlText, /href="\.\.\/guide\.md"/, 'HTML clipboard should retain the relative link');
    assert.match(copied.htmlText, /\.\.\/images\/pic\.png/, 'HTML clipboard should retain a relative image path');
    assert.match(copied.plainText, /link/, 'plain-text clipboard should contain readable document text');
    assert.equal(copied.after, copied.before, 'formatted Copy must not mutate the Markdown source');

    const fallback = await evaluate(win, `(() => {
      openReader(); const content = document.getElementById('readerContent'); content.tabIndex = -1; content.focus();
      const textNode = content.querySelector('a').firstChild;
      const range = document.createRange(); range.setStart(textNode, 0); range.setEnd(textNode, 4);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
      window.__oldExecCommand = document.execCommand; window.__copyFallbackCalled = false;
      document.execCommand = command => { if (command === 'copy') window.__copyFallbackCalled = true; return command === 'copy'; };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => { throw new Error('mock rich clipboard failure'); } } });
      return copyFormatted().then(() => ({ fallbackCalled: window.__copyFallbackCalled, selected: getSelection().toString(), focus: document.activeElement.id }))
        .finally(() => { document.execCommand = window.__oldExecCommand; });
    })()`);
    assert.equal(fallback.fallbackCalled, true, 'clipboard failure should use the browser copy fallback');
    assert.equal(fallback.selected, 'link', 'fallback copy should restore the previous selection');
    assert.equal(fallback.focus, 'readerContent', 'fallback copy should keep focus on its prior reader target');

    // Regression: deleting a previously opened nonempty document while
    // Auto-save is off must still trigger the unsaved-document guard.
    const openedFile = path.join(profile, 'opened.md');
    fs.writeFileSync(openedFile, '# Opened file\n', 'utf8');
    await evaluate(win, `window.__confirmCalls = 0; window.confirm = () => { window.__confirmCalls += 1; return true; };
      loadDocumentData({ name: 'opened.md', filePath: ${JSON.stringify(openedFile)}, content: '# Opened file\\n', kind: 'markdown' });
      state.preferences.autoSave = false; setDocumentFromMarkdown('');`);
    const emptyGuard = await evaluate(win, `({ prompt: hasUnpersistedDocument(), markdown: state.markdown, saved: state.lastSavedMarkdown })`);
    assert.equal(emptyGuard.prompt, true, 'deleting all content in an opened file must still require an unsaved-change prompt');
  } finally {
    win.destroy();
  }
}

main().then(() => {
  console.log('PASS core-features-smoke');
  app.exit(0);
}, error => {
  console.error('FAIL core-features-smoke', error?.stack || error);
  app.exit(1);
});
