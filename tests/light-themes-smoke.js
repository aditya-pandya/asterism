// Run with: ./node_modules/.bin/electron tests/light-themes-smoke.js
// Light palette AA contrast, save-state semantics, and empty-document actions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const repoRoot = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'asterism-light-themes-'));
const fixture = '# Light palette review\n\nBody text with a [contrast link](https://example.test) and **Markdown markers**.\n';
app.setPath('userData', profile);
app.on('window-all-closed', () => {});

function evaluate(win, js) { return win.webContents.executeJavaScript(js); }

function rgb(color) {
  const parts = color.match(/^rgba?\(([^)]+)\)$/);
  assert.ok(parts, `Expected a computed RGB color, received ${color}`);
  const channels = parts[1].split(',').map(Number);
  assert.ok(channels.length === 3 || channels[3] === 1, `Expected opaque color, received ${color}`);
  return channels.slice(0, 3);
}

function luminance(channels) {
  const linear = channels.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

async function main() {
  await app.whenReady();
  const win = new BrowserWindow({ show: false, width: 1200, height: 900,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const failures = [];
  try {
    await win.loadFile(path.join(repoRoot, 'index.html'));
    assert.equal(await evaluate(win, 'state.preferences.autoSave'), true);
    assert.equal(await evaluate(win, 'state.markdown'), '', 'fresh profile should have an empty document');
    assert.equal(await evaluate(win, 'elements.hintText.dataset.state'), 'saved');
    await evaluate(win, `Promise.all(elements.emptyState.getAnimations({ subtree: true })
      .map(animation => animation.finished.catch(() => {})))`);
    const actions = await evaluate(win, `['emptyPasteButton', 'emptyOpenButton'].map(id => {
      const node = document.getElementById(id);
      return { id, exists: Boolean(node), tag: node?.tagName,
        visible: Boolean(node?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
          node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0) };
    })`);
    for (const action of actions) {
      assert.equal(action.exists, true, `${action.id} should exist`);
      assert.equal(action.tag, 'BUTTON', `${action.id} should be a BUTTON`);
      assert.equal(action.visible, true, `${action.id} should be visible on an empty document`);
    }
    await evaluate(win, `setDocumentFromMarkdown(${JSON.stringify(fixture)})`);
    assert.equal(await evaluate(win, 'elements.hintText.dataset.state'), 'saved', 'fresh autosaved content should be saved');
    assert.equal(await evaluate(win, `localStorage.getItem('inkdown.doc')`), fixture, 'saved state should accompany persisted content');
    await evaluate(win, `setPreference('autoSave', false)`);
    assert.equal(await evaluate(win, 'elements.hintText.dataset.state'), 'unsaved', 'content with autosave off should be unsaved');

    for (const theme of ['default', 'paper', 'sage']) {
      await evaluate(win, `setPreference('lightTheme', ${JSON.stringify(theme)})`);
      // Let the synchronous fallback's CSS color transitions finish before sampling.
      await evaluate(win, `new Promise(resolve => setTimeout(resolve, 360))`);
      const colors = await evaluate(win, `(() => {
        const required = selector => {
          const node = document.querySelector(selector);
          if (!node) throw new Error('Missing contrast fixture: ' + selector);
          return node;
        };
        const background = node => {
          for (let current = node; current; current = current.parentElement) {
            const color = getComputedStyle(current).backgroundColor;
            if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
          }
          throw new Error('Missing opaque background');
        };
        const pair = (selector, backgroundNode) => {
          const node = required(selector);
          let opacity = 1;
          for (let current = node; current; current = current.parentElement) opacity *= Number(getComputedStyle(current).opacity);
          return { foreground: getComputedStyle(node).color, background: background(backgroundNode || node), opacity };
        };
        return { palette: document.documentElement.dataset.palette, pairs: {
          'body text': pair('#richEditor p'),
          'secondary text': pair('#markdownHighlight'),
          'links': pair('#richEditor a'),
          'Markdown syntax markers': pair('.syntax-marker', elements.markdownPane),
          'primary button text on accent': pair('.link-button.is-primary')
        } };
      })()`);
      assert.equal(colors.palette, `light-${theme}`);
      for (const [label, { foreground, background, opacity }] of Object.entries(colors.pairs)) {
        const bg = rgb(background);
        const ink = rgb(foreground).map((value, index) => value * opacity + bg[index] * (1 - opacity));
        const a = luminance(ink), b = luminance(bg);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const result = `${theme} ${label}: ${ratio.toFixed(2)}:1 (${foreground} on ${background}, opacity ${opacity})`;
        console.log(`${ratio >= 4.5 ? 'PASS' : 'FAIL'} ${result}`);
        if (ratio < 4.5) failures.push(result);
      }
    }
    assert.equal(failures.length, 0, `Contrast below 4.5:1:\n${failures.join('\n')}`);
  } finally {
    win.destroy();
  }
}

main().then(() => {
  console.log('PASS light-themes-smoke');
  app.exit(0);
}, error => {
  console.error('FAIL light-themes-smoke', error?.stack || error);
  app.exit(1);
});
