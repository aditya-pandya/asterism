// Run with: ./node_modules/.bin/electron tests/ui-polish-smoke.js
// Exercises theme/font preferences, find/replace, and shortcut routing in an
// isolated Electron profile. DOM KeyboardEvents test renderer handlers only;
// they do not prove native OS menu key dispatch.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const repoRoot = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'asterism-ui-polish-'));
app.setPath('userData', profile);
app.on('window-all-closed', () => {});
const isMac = process.platform === 'darwin';

function evaluate(win, js) { return win.webContents.executeJavaScript(js); }
function key(win, key, { shift = false, alt = false, target = 'markdownEditor' } = {}) {
  return evaluate(win, `(() => {
    const input = document.getElementById(${JSON.stringify(target)});
    input.focus();
    const event = new KeyboardEvent('keydown', { key: ${JSON.stringify(key)},
      code: ${JSON.stringify(/^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : '')},
      bubbles: true, cancelable: true, ${isMac ? 'metaKey: true' : 'ctrlKey: true'},
      shiftKey: ${shift}, altKey: ${alt} });
    document.dispatchEvent(event);
    return { prevented: event.defaultPrevented, findOpen: state.findOpen,
      replaceOpen: state.replaceOpen, markdown: state.markdown };
  })()`);
}

async function main() {
  await app.whenReady();
  const win = new BrowserWindow({ show: false, width: 1200, height: 900,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.on('console-message', (_event, level, message, line, source) => {
    if (level >= 2) console.error(`[renderer ${source}:${line}] ${message}`);
  });
  try {
    await win.loadFile(path.join(repoRoot, 'index.html'));

    const initial = await evaluate(win, `({ mode: document.documentElement.dataset.mode,
      palette: document.documentElement.dataset.palette, appearance: state.preferences.appearance,
      size: getComputedStyle(document.getElementById('app')).getPropertyValue('--document-text-size').trim() })`);
    assert.equal(initial.appearance, 'light', 'fresh profile should use Light appearance');
    assert.equal(initial.mode, 'light', 'Light should resolve to light mode');
    assert.equal(initial.palette, 'light-default', 'Light should initially use the default palette');
    assert.equal(initial.size, '16px', 'fresh profile should use 16px document text');

    await evaluate(win, `document.getElementById('settingsButton').click()`);
    async function choose(keyName, value) {
      return evaluate(win, `(() => { const option = [...document.querySelectorAll('.setting-option')]
        .find(button => button.dataset.settingKey === ${JSON.stringify(keyName)} &&
          button.dataset.settingValue === ${JSON.stringify(value)});
        if (!option) throw new Error('Missing setting option ' + ${JSON.stringify(keyName)} + '=' + ${JSON.stringify(value)});
        option.click(); return { preference: state.preferences[${JSON.stringify(keyName)}],
          mode: document.documentElement.dataset.mode, palette: document.documentElement.dataset.palette,
          size: getComputedStyle(document.getElementById('app')).getPropertyValue('--document-text-size').trim(),
          stored: JSON.parse(localStorage.getItem('inkdown.prefs'))[${JSON.stringify(keyName)}] }; })()`);
    }
    for (const [value, expectedPalette] of [['paper', 'light-paper'], ['sage', 'light-sage']]) {
      const result = await choose('lightTheme', value);
      assert.equal(result.mode, 'light', `${value} should leave Light mode active`);
      assert.equal(result.palette, expectedPalette, `${value} palette should apply in Light mode`);
      assert.equal(result.stored, value, `${value} preference should persist`);
    }
    const dark = await choose('appearance', 'dark');
    assert.equal(dark.mode, 'dark', 'Dark appearance should resolve to dark mode');
    assert.equal(dark.palette, 'dark-midnight', 'Dark should use Midnight as its fresh-profile default palette');
    const midnight = await choose('darkTheme', 'midnight');
    assert.equal(midnight.palette, 'dark-midnight', 'Midnight should apply in Dark mode');
    const light = await choose('appearance', 'light');
    assert.equal(light.mode, 'light', 'Light appearance should resolve to light mode');
    assert.equal(light.palette, 'light-sage', 'selected Sage palette should apply in Light mode');
    const auto = await choose('appearance', 'auto');
    assert.ok(['light', 'dark'].includes(auto.mode), 'Auto should resolve to a concrete system mode');
    assert.equal(auto.palette, auto.mode === 'light' ? 'light-sage' : 'dark-midnight',
      'Auto should use the selected palette for its resolved mode');
    for (const value of ['14', '18', '16']) {
      const result = await choose('textSize', value);
      assert.equal(result.size, `${value}px`, `text size ${value}px should apply immediately`);
      assert.equal(result.stored, value, `text size ${value}px should persist`);
    }
    await evaluate(win, `closeSettings()`);
    await evaluate(win, `new Promise(resolve => setTimeout(resolve, 180))`);

    async function capture(name) {
      await evaluate(win, `new Promise(resolve => setTimeout(resolve, 320))`);
      await evaluate(win, `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
      const pageState = await evaluate(win, `({ mode: document.documentElement.dataset.mode,
        palette: document.documentElement.dataset.palette, view: state.view })`);
      assert.equal(pageState.view, name.startsWith('read-') ? 'reader' : 'edit', `${name} capture should show the requested view`);
      if (name.endsWith('paper')) {
        assert.equal(pageState.mode, 'light', `${name} capture should use Light mode`);
        assert.equal(pageState.palette, 'light-paper', `${name} capture should use Paper palette`);
      } else if (name.endsWith('midnight')) {
        assert.equal(pageState.mode, 'dark', `${name} capture should use Dark mode`);
        assert.equal(pageState.palette, 'dark-midnight', `${name} capture should use Midnight palette`);
      }
      const image = await win.webContents.capturePage();
      fs.writeFileSync(path.join(os.tmpdir(), `asterism-qa-${name}.png`), image.toPNG());
    }
    const visualFixture = '# Asterism UI Preview\n\n## Editing\n\nA clear Markdown editing surface.\n\n## Reading\n\nA formatted Reader section for theme review.\n\n## Themes\n\nPaper, Sage, and Midnight are available.';
    await evaluate(win, `setDocumentFromMarkdown(${JSON.stringify(visualFixture)}); setPreference('appearance', 'light'); setPreference('lightTheme', 'paper'); closeReader();`);
    await evaluate(win, `new Promise(resolve => setTimeout(resolve, 320))`);
    await capture('edit-paper');
    await evaluate(win, `openReader()`);
    await capture('read-paper');
    await evaluate(win, `setPreference('appearance', 'dark'); setPreference('darkTheme', 'midnight');`);
    await evaluate(win, `new Promise(resolve => setTimeout(resolve, 320))`);
    await capture('read-midnight');
    await evaluate(win, `closeReader()`);
    await capture('edit-midnight');
    await evaluate(win, `setPreference('appearance', 'auto')`);

    const fixture = 'alpha alpha ALPHA alpha';
    await evaluate(win, `closeReader(); setDocumentFromMarkdown(${JSON.stringify(fixture)}); document.getElementById('markdownEditor').focus(); setMarkdownSelection(0, 0);`);
    const openFind = await key(win, 'f');
    assert.equal(openFind.prevented, true, 'Cmd/Ctrl+F should be handled by the renderer');
    assert.equal(openFind.findOpen, true, 'Cmd/Ctrl+F should open Find');
    const findState = await evaluate(win, `(() => {
      const input = document.getElementById('findInput'); input.value = 'alpha';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { count: document.getElementById('findCount').textContent,
        scope: document.getElementById('findScope').textContent,
        index: state.findIndex, matches: state.findMatches.length };
    })()`);
    assert.equal(findState.count, '1 of 4', 'Find should count case-insensitive source occurrences');
    assert.equal(findState.scope, 'Formatted', 'Find scope should identify the active formatted editor');
    assert.equal(findState.matches, 4, 'all four source occurrences should be indexed');
    const next = await key(win, 'g', { target: 'findInput' });
    assert.equal(next.prevented, true, 'Cmd/Ctrl+G should be handled while Find is focused');
    assert.equal(await evaluate(win, 'state.findIndex'), 1, 'Cmd/Ctrl+G should advance to the next result');
    const previous = await key(win, 'g', { shift: true, target: 'findInput' });
    assert.equal(previous.prevented, true, 'Cmd/Ctrl+Shift+G should be handled while Find is focused');
    assert.equal(await evaluate(win, 'state.findIndex'), 0, 'Cmd/Ctrl+Shift+G should return to the previous result');
    const replaceShortcut = await key(win, 'f', { alt: true });
    assert.equal(replaceShortcut.replaceOpen, true, 'Cmd/Ctrl+Alt+F should open Find and Replace');
    await evaluate(win, `document.getElementById('replaceInput').value = 'beta'; document.getElementById('replaceOne').click()`);
    assert.equal(await evaluate(win, 'state.markdown'), 'beta alpha ALPHA alpha', 'Replace should update only the selected occurrence');
    assert.equal(await evaluate(win, 'document.getElementById("replaceUndo").hidden'), false, 'Replace should expose its one-step Undo action');
    await evaluate(win, `document.getElementById('replaceUndo').click()`);
    assert.equal(await evaluate(win, 'state.markdown'), fixture, 'Replace Undo should restore the exact prior Markdown');
    await evaluate(win, `document.getElementById('replaceAll').click()`);
    assert.equal(await evaluate(win, 'state.markdown'), 'beta beta beta beta', 'Replace all should update every case-insensitive match');
    await evaluate(win, `document.getElementById('findClose').click()`);
    assert.equal(await evaluate(win, `document.getElementById('findBar').hidden`), true, 'close button should dismiss Find');

    await evaluate(win, `setDocumentFromMarkdown('shortcut check');`);
    const read = await key(win, 'e');
    assert.equal(read.prevented, true, 'Cmd/Ctrl+E should be handled by the renderer');
    assert.equal(await evaluate(win, 'state.view'), 'reader', 'Cmd/Ctrl+E should open Reader');
    const back = await key(win, 'e', { target: 'viewReadButton' });
    assert.equal(back.prevented, true, 'Cmd/Ctrl+E should toggle back from Reader');
    assert.equal(await evaluate(win, 'state.view'), 'edit', 'Cmd/Ctrl+E should return to Edit');

    const outlineFixture = [
      '# Same', '', '## Café guide', '', '### Same', '', '### 東京', '',
      'Setext title', '---', '', '```markdown', '# fenced example', '```', '',
      '## Same', '', 'Repeated section content.'
    ].join('\n');
    await evaluate(win, `setDocumentFromMarkdown(${JSON.stringify(outlineFixture)});`);
    await evaluate(win, `new Promise(resolve => setTimeout(resolve, 220))`);
    const outline = await evaluate(win, `({ visible: !document.getElementById('outlinePanel').hidden,
      labels: [...document.querySelectorAll('.outline-item')].map(button => button.textContent),
      levels: [...document.querySelectorAll('.outline-item')].map(button => button.dataset.level),
      depths: [...document.querySelectorAll('.outline-item')].map(button => button.dataset.depth) })`);
    assert.equal(outline.visible, true, 'desktop outline should appear when the document has headings');
    assert.deepEqual(outline.labels, ['Same', 'Café guide', 'Same', '東京', 'Setext title', 'Same'],
      'outline should preserve duplicate, Unicode, and Setext headings while excluding fenced code');
    assert.deepEqual(outline.levels, ['1', '2', '3', '3', '2', '2'], 'outline rows should retain heading levels');
    assert.deepEqual(outline.depths, ['0', '1', '2', '2', '1', '1'], 'outline rows should expose hierarchy depth');
    const outlineKeys = await evaluate(win, `(() => { const rows = [...document.querySelectorAll('.outline-item')];
      rows[0].focus(); const down = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }); rows[0].dispatchEvent(down);
      const afterDown = document.activeElement.dataset.index;
      const end = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }); document.activeElement.dispatchEvent(end);
      const afterEnd = document.activeElement.dataset.index;
      const home = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }); document.activeElement.dispatchEvent(home);
      return { downPrevented: down.defaultPrevented, afterDown, afterEnd, afterHome: document.activeElement.dataset.index }; })()`);
    assert.equal(outlineKeys.downPrevented, true, 'outline ArrowDown should be handled');
    assert.equal(outlineKeys.afterDown, '1', 'outline ArrowDown should advance focus');
    assert.equal(outlineKeys.afterEnd, '5', 'outline End should focus the final heading');
    assert.equal(outlineKeys.afterHome, '0', 'outline Home should focus the first heading');

    await evaluate(win, `openReader();`);
    await evaluate(win, `document.querySelectorAll('.outline-item')[2].click()`);
    const readerJump = await evaluate(win, `({ activeText: document.activeElement.textContent,
      activeTag: document.activeElement.tagName, view: state.view })`);
    assert.equal(readerJump.view, 'reader', 'outline navigation should preserve Reader mode');
    assert.equal(readerJump.activeTag, 'H3', 'outline selection should focus the exact Reader heading');
    assert.equal(readerJump.activeText, 'Same', 'duplicate heading selection should jump to the requested Reader occurrence');
    await evaluate(win, `closeReader(); document.querySelectorAll('.outline-item')[5].click()`);
    assert.equal(await evaluate(win, 'getSelection().toString()'), '## Same',
      'outline selection in Edit should select the exact duplicate Markdown heading line');

    const editedOutlineFixture = outlineFixture.replace('Setext title', 'Updated title');
    await evaluate(win, `setDocumentFromMarkdown(${JSON.stringify(editedOutlineFixture)});`);
    await evaluate(win, `new Promise(resolve => setTimeout(resolve, 220))`);
    assert.deepEqual(await evaluate(win, `([...document.querySelectorAll('.outline-item')].map(button => button.textContent))`),
      ['Same', 'Café guide', 'Same', '東京', 'Updated title', 'Same'],
      'editing headings should update the outline list');

    await evaluate(win, `document.getElementById('outlineButton').focus(); document.getElementById('outlineButton').click()`);
    assert.equal(await evaluate(win, `document.getElementById('outlinePanel').hidden`), true,
      'desktop outline button should hide the panel');
    assert.equal(await evaluate(win, `JSON.parse(localStorage.getItem('inkdown.prefs')).outlineHidden`), true,
      'desktop outline visibility should persist as a preference');
    await new Promise(resolve => {
      win.webContents.once('did-finish-load', resolve);
      win.webContents.reload();
    });
    const restoredOutline = await evaluate(win, `({ hidden: document.getElementById('outlinePanel').hidden,
      preference: state.preferences.outlineHidden, headings: document.querySelectorAll('.outline-item').length })`);
    assert.equal(restoredOutline.preference, true, 'hidden outline preference should survive reload');
    assert.equal(restoredOutline.hidden, true, 'reloaded desktop window should keep the outline hidden');
    const outlineToggle = await key(win, 'o', { alt: true, target: 'markdownEditor' });
    assert.equal(outlineToggle.prevented, true, 'Cmd/Ctrl+Alt+O should toggle the outline');
    assert.equal(await evaluate(win, `document.getElementById('outlinePanel').hidden`), false,
      'outline shortcut should restore the panel');

    await evaluate(win, `setDocumentFromMarkdown('Plain text with no headings.'); new Promise(resolve => setTimeout(resolve, 220))`);
    await evaluate(win, `if (!document.getElementById('outlinePanel').hidden) document.getElementById('outlineButton').click()`);
    await evaluate(win, `document.getElementById('outlineButton').click()`);
    const emptyOutline = await evaluate(win, `({ visible: !document.getElementById('outlinePanel').hidden,
      empty: !document.getElementById('outlineEmpty').hidden, count: document.querySelectorAll('.outline-item').length })`);
    assert.deepEqual(emptyOutline, { visible: true, empty: true, count: 0 },
      'manually opening the desktop outline for a headingless document should show its empty state');

    // At narrow widths the outline becomes a modal drawer with a backdrop,
    // inert background, and bounded keyboard focus.
    win.setSize(800, 900);
    await evaluate(win, `new Promise(resolve => setTimeout(resolve, 80))`);
    await evaluate(win, `setDocumentFromMarkdown(${JSON.stringify(outlineFixture)}); new Promise(resolve => setTimeout(resolve, 220))`);
    await evaluate(win, `document.getElementById('outlineButton').focus(); document.getElementById('outlineButton').click()`);
    await capture('mobile-outline');
    const mobileDrawer = await evaluate(win, `({ visible: !document.getElementById('outlinePanel').hidden,
      role: document.getElementById('outlinePanel').getAttribute('role'), modal: document.getElementById('outlinePanel').getAttribute('aria-modal'),
      backdrop: !document.getElementById('outlineBackdrop').hidden,
      inert: document.getElementById('wordmarkStrip').inert,
      position: getComputedStyle(document.getElementById('outlinePanel')).position,
      width: document.getElementById('outlinePanel').getBoundingClientRect().width,
      viewport: window.innerWidth })`);
    assert.equal(mobileDrawer.visible, true, 'narrow layout should open the outline drawer');
    assert.equal(mobileDrawer.role, 'dialog', 'narrow outline should be exposed as a dialog');
    assert.equal(mobileDrawer.modal, 'true', 'narrow outline should be modal');
    assert.equal(mobileDrawer.backdrop, true, 'narrow drawer should display its backdrop');
    assert.equal(mobileDrawer.inert, true, 'narrow drawer should make the underlying app inert');
    assert.equal(mobileDrawer.position, 'absolute', 'narrow outline should use drawer positioning');
    assert.ok(mobileDrawer.width <= Math.min(280, mobileDrawer.viewport * 0.86) + 1,
      'narrow outline drawer should fit its responsive width limit');
    const drawerFocus = await evaluate(win, `(() => { const rows = [...document.querySelectorAll('.outline-item')];
      const last = rows.at(-1); last.focus(); const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      document.getElementById('outlinePanel').dispatchEvent(event);
      return { prevented: event.defaultPrevented, active: document.activeElement.id, close: document.getElementById('outlineClose').id }; })()`);
    assert.equal(drawerFocus.prevented, true, 'Tab on the last drawer control should be trapped');
    assert.equal(drawerFocus.active, drawerFocus.close, 'Tab should wrap to the first drawer control');
    const escapeDrawer = await evaluate(win, `(() => { const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      document.dispatchEvent(event); return { prevented: event.defaultPrevented,
        hidden: document.getElementById('outlinePanel').hidden, active: document.activeElement.id }; })()`);
    assert.equal(escapeDrawer.prevented, true, 'Escape should close the outline drawer');
    assert.equal(escapeDrawer.hidden, true, 'Escape should hide the drawer');
    assert.equal(escapeDrawer.active, 'outlineButton', 'closing the drawer should restore focus to its trigger');

    win.setSize(1200, 900);
    await evaluate(win, `new Promise(resolve => setTimeout(resolve, 80))`);

    await evaluate(win, `setDocumentFromMarkdown(${JSON.stringify('# Print heading\n\nA paragraph in the Reader preview.')}); openReader();`);
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
    const printLayout = await evaluate(win, `({ readerDisplay: getComputedStyle(document.getElementById('readerView')).display,
      readerOverflow: getComputedStyle(document.getElementById('readerView')).overflow,
      outlineDisplay: getComputedStyle(document.getElementById('outlinePanel')).display,
      readerText: document.getElementById('readerContent').innerText })`);
    assert.equal(printLayout.readerDisplay, 'block', 'print media should reveal Reader content');
    assert.equal(printLayout.readerOverflow, 'visible', 'print media should allow Reader content to flow across pages');
    assert.equal(printLayout.outlineDisplay, 'none', 'print media should hide the heading outline');
    assert.match(printLayout.readerText, /Print heading[\s\S]*A paragraph in the Reader preview/,
      'Reader content should remain populated for the print surface');
    await win.webContents.printToPDF({ printBackground: true, pageSize: 'Letter', margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 } })
      .then(pdf => {
        assert.ok(pdf.byteLength > 500, 'printing Reader content should produce a nonempty PDF');
        assert.equal(pdf.subarray(0, 5).toString(), '%PDF-', 'print output should be a PDF document');
        assert.ok((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length >= 1,
          'print output should contain at least one PDF page');
      });
    win.webContents.debugger.detach();

    // Active outline tracking should follow the pane the user is working in,
    // even when its scroll position was not the pane scrolled most recently.
    const tallSections = Array.from({ length: 8 }, (_, i) => `## Section ${i + 1}\n\n${'Body text.\n\n'.repeat(12)}`).join('\n');
    await evaluate(win, `setDocumentFromMarkdown(${JSON.stringify(tallSections)});`);
    await evaluate(win, `new Promise(resolve => setTimeout(resolve, 220))`);
    await evaluate(win, `(() => { const source = document.getElementById('markdownEditor'); source.focus();
      source.scrollTop = source.scrollHeight; source.dispatchEvent(new Event('scroll', { bubbles: true })); })()`);
    assert.equal(await evaluate(win, 'document.activeElement.id'), 'markdownEditor',
      'Markdown pane should own focus before its active heading is measured');
    await evaluate(win, `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    assert.equal(await evaluate(win, `document.querySelector('.outline-item[aria-current="true"]')?.textContent`),
      'Section 8', 'scrolling the Markdown pane should mark its current section');
    await evaluate(win, `(() => { const rich = document.getElementById('richEditor'); rich.scrollTop = 0; rich.focus();
      // A hidden Electron window updates activeElement but omits Chromium's
      // native focusin event; dispatch the event the app listens for.
      rich.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); })()`);
    assert.equal(await evaluate(win, 'document.activeElement.id'), 'richEditor',
      'focus should move from Markdown into Rich text before measuring the new active heading');
    await evaluate(win, `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    assert.equal(await evaluate(win, `document.querySelector('.outline-item[aria-current="true"]')?.textContent`),
      'Section 1', 'changing focus to Rich text should track that pane instead of stale Markdown scroll state');
    await evaluate(win, `(() => { const source = document.getElementById('markdownEditor'); source.focus();
      source.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); })()`);
    await evaluate(win, `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    assert.equal(await evaluate(win, `document.querySelector('.outline-item[aria-current="true"]')?.textContent`),
      'Section 1', 'switching focus back to Markdown should follow its current position at the start of the document');
    await evaluate(win, `(() => { const source = document.getElementById('markdownEditor');
      source.scrollTop = source.scrollHeight; source.dispatchEvent(new Event('scroll', { bubbles: true })); })()`);
    await evaluate(win, `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    assert.equal(await evaluate(win, `document.querySelector('.outline-item[aria-current="true"]')?.textContent`),
      'Section 8', 'scrolling Markdown after the focus switch should update its active section');

    // Rich text strips Markdown syntax before matching. Replacement offsets
    // must still map back to source without introducing empty lines.
    const richFixture = 'alpha alpha ALPHA\n\n**alpha**';
    await evaluate(win, `setDocumentFromMarkdown(${JSON.stringify(richFixture)}); document.getElementById('richEditor').focus();`);
    await key(win, 'f', { alt: true, target: 'richEditor' });
    await evaluate(win, `document.getElementById('findInput').value = 'alpha';
      document.getElementById('findInput').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('replaceInput').value = 'beta'; document.getElementById('replaceOne').click()`);
    assert.equal(await evaluate(win, 'state.markdown'), 'beta alpha ALPHA\n\n**alpha**',
      'Replace from the formatted scope must preserve source line breaks and Markdown delimiters');
  } finally {
    win.destroy();
  }
}

main().then(() => {
  console.log('PASS ui-polish-smoke');
  app.exit(0);
}, error => {
  console.error('FAIL ui-polish-smoke', error?.stack || error);
  app.exit(1);
});
