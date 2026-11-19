// Run with: ./node_modules/.bin/electron tests/dark-themes-smoke.js
// Dark palette, persistence, Auto system emulation, and contrast regression.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const repoRoot = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'asterism-dark-themes-'));
const screenshots = '/private/tmp';
const fixture = [
  '# Asterism dark palette review', '', '## Contrast check', '',
  'A [contrast link](https://example.test) beside normal contrast text.', '',
  'A second contrast sentence tests normal and active Find highlights.', '',
  '```js', 'const marker = "contrast";', '```', ''
].join('\n');

app.setPath('userData', profile);
app.on('window-all-closed', () => {});

function evaluate(win, js) { return win.webContents.executeJavaScript(js); }

function luminance(color) {
  let channels;
  if (/^#[\da-f]{3,8}$/i.test(color)) {
    let hex = color.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = [...hex.slice(0, 3)].map(char => char + char).join('');
    channels = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
  } else {
    const parts = color.match(/[\d.]+/g);
    assert.ok(parts?.length >= 3, `Expected a concrete RGB color, received ${color}`);
    channels = parts.slice(0, 3).map(Number);
  }
  const linear = channels.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function assertAA(label, foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  const ratio = (lighter + 0.05) / (darker + 0.05);
  assert.ok(ratio >= 4.5, `${label} contrast ${ratio.toFixed(2)}:1 is below 4.5:1 (${foreground} on ${background})`);
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
    const initial = await evaluate(win, `({ darkTheme: state.preferences.darkTheme, values: SETTING_DEFINITIONS
      .find(row => row.key === 'darkTheme').values, labels: SETTING_DEFINITIONS
      .find(row => row.key === 'darkTheme').labels, palette: document.documentElement.dataset.palette })`);
    assert.equal(initial.darkTheme, 'midnight', 'fresh profile should choose Midnight by default');
    assert.equal(initial.palette, 'light-default', 'Light appearance should keep its default light palette');
    assert.deepEqual(initial.values, ['midnight', 'onyx', 'ember'], 'dark palette setting should contain exactly the three supported choices');
    assert.deepEqual(initial.labels, ['Midnight', 'Onyx', 'Ember'], 'dark palette names should be shown in Settings');

    async function setSetting(key, value) {
      await evaluate(win, `document.getElementById('settingsButton').click()`);
      const result = await evaluate(win, `(() => {
        const options = [...document.querySelectorAll('.setting-option')].filter(button => button.dataset.settingKey === ${JSON.stringify(key)});
        const option = options.find(button => button.dataset.settingValue === ${JSON.stringify(value)});
        if (!option) throw new Error('Missing Settings option ' + ${JSON.stringify(key)} + '=' + ${JSON.stringify(value)});
        option.click();
        const selected = [...document.querySelectorAll('.setting-option')].find(button =>
          button.dataset.settingKey === ${JSON.stringify(key)} && button.dataset.settingValue === ${JSON.stringify(value)});
        return { count: options.length, label: option.textContent, active: selected?.getAttribute('aria-pressed'),
          preference: state.preferences[${JSON.stringify(key)}], mode: document.documentElement.dataset.mode,
          palette: document.documentElement.dataset.palette,
          stored: JSON.parse(localStorage.getItem('inkdown.prefs'))[${JSON.stringify(key)}] };
      })()`);
      await evaluate(win, `closeSettings(); new Promise(resolve => setTimeout(resolve, 180))`);
      return result;
    }

    const appearance = await setSetting('appearance', 'dark');
    assert.equal(appearance.mode, 'dark', 'Settings should activate Dark appearance');
    assert.equal(appearance.palette, 'dark-midnight', 'fresh Dark appearance should use Midnight');
    await evaluate(win, `setDocumentFromMarkdown(${JSON.stringify(fixture)});`);

    async function reloadAndInspect(expectedTheme, expectedPalette) {
      await new Promise(resolve => {
        win.webContents.once('did-finish-load', resolve);
        win.webContents.reload();
      });
      return evaluate(win, `({ darkTheme: state.preferences.darkTheme, appearance: state.preferences.appearance,
        palette: document.documentElement.dataset.palette, markdown: state.markdown,
        activeLabel: [...document.querySelectorAll('.setting-option.is-active')].find(button => button.dataset.settingKey === 'darkTheme')?.textContent })`)
        .then(result => {
          assert.equal(result.darkTheme, expectedTheme, `${expectedTheme} choice should persist across reload`);
          assert.equal(result.appearance, 'dark', 'Dark appearance should persist across reload');
          assert.equal(result.palette, expectedPalette, 'reloaded page should resolve the persisted dark palette');
          assert.equal(result.markdown, fixture, 'theme reload should preserve the saved document');
          return result;
        });
    }

    async function waitForPaint() {
      await evaluate(win, `new Promise(resolve => setTimeout(resolve, 320))`);
      await evaluate(win, `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    }

    async function selectFind(query = 'contrast') {
      await evaluate(win, `(() => { openFind(); const input = document.getElementById('findInput');
        input.value = ${JSON.stringify(query)}; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await waitForPaint();
      return evaluate(win, `({ count: document.getElementById('findCount').textContent,
        normal: Boolean(CSS.highlights?.get('asterism-find')),
        active: Boolean(CSS.highlights?.get('asterism-find-active')),
        normalStyle: (() => { const s = getComputedStyle(document.getElementById('readerContent'), '::highlight(asterism-find)');
          return { color: s.color, background: s.backgroundColor }; })(),
        activeStyle: (() => { const s = getComputedStyle(document.getElementById('readerContent'), '::highlight(asterism-find-active)');
          return { color: s.color, background: s.backgroundColor }; })() })`);
    }

    async function paletteContrast(theme) {
      const colors = await evaluate(win, `(() => {
        const app = document.getElementById('app');
        const appStyle = getComputedStyle(app);
        const outline = document.getElementById('outlinePanel');
        const outlineRow = document.querySelector('.outline-item[data-level="2"]');
        const reader = document.getElementById('readerContent');
        const paragraph = reader.querySelector('p');
        const anchor = reader.querySelector('a');
        const button = document.querySelector('.link-button.is-primary');
        const marker = document.querySelector('.syntax-marker');
        const keyword = reader.querySelector('pre code .hljs-keyword');
        const get = (element, property) => element ? getComputedStyle(element)[property] : '';
        return {
          mode: document.documentElement.dataset.mode, palette: document.documentElement.dataset.palette,
          bg: appStyle.getPropertyValue('--bg-app').trim(), bgAlt: appStyle.getPropertyValue('--bg-alt').trim(),
          surface: appStyle.getPropertyValue('--surface').trim(), primary: appStyle.getPropertyValue('--text-primary').trim(),
          secondary: appStyle.getPropertyValue('--text-secondary').trim(), tertiary: appStyle.getPropertyValue('--text-tertiary').trim(),
          accent: appStyle.getPropertyValue('--accent-primary').trim(), accentInk: appStyle.getPropertyValue('--accent-contrast').trim(),
          linkToken: appStyle.getPropertyValue('--link').trim(), findBg: appStyle.getPropertyValue('--find-bg').trim(),
          findInk: appStyle.getPropertyValue('--find-ink').trim(), activeFindBg: appStyle.getPropertyValue('--find-active-bg').trim(),
          activeFindInk: appStyle.getPropertyValue('--find-active-ink').trim(),
          appText: get(app, 'color'), readerText: get(paragraph, 'color'), outlineBg: get(outline, 'backgroundColor'),
          outlineText: get(outlineRow, 'color'), outlineTextBg: get(outlineRow, 'backgroundColor'),
          tertiaryText: get(document.querySelector('.pane-header'), 'color'),
          link: get(anchor, 'color'), primaryButtonText: get(button, 'color'), primaryButtonBg: get(button, 'backgroundColor'),
          syntaxMarker: get(marker, 'color'), syntaxMarkerOpacity: get(marker, 'opacity'), markdownBg: get(document.getElementById('markdownPane'), 'backgroundColor'),
          codeKeyword: get(keyword, 'color'), codeBg: get(reader.querySelector('pre'), 'backgroundColor'),
          findScope: get(document.getElementById('findScope'), 'color'), findScopeBg: get(document.getElementById('findBar'), 'backgroundColor'),
          vars: { normal: appStyle.getPropertyValue('--find-ink').trim(), normalBg: appStyle.getPropertyValue('--find-bg').trim(),
            active: appStyle.getPropertyValue('--find-active-ink').trim(), activeBg: appStyle.getPropertyValue('--find-active-bg').trim() }
        };
      })()`);
      assert.equal(colors.mode, 'dark', `${theme} should render in Dark mode`);
      assert.equal(colors.palette, `dark-${theme}`, `${theme} palette should be active`);
      assert.ok(colors.link && colors.primaryButtonBg && colors.codeKeyword,
        `${theme} should render a link, a syntax token, and the primary button style`);
      assertAA(`${theme} body text`, colors.readerText, colors.bg);
      assertAA(`${theme} tertiary UI`, colors.tertiaryText, colors.bg);
      assertAA(`${theme} outline text`, colors.outlineText, colors.outlineBg);
      assertAA(`${theme} link`, colors.link, colors.bg);
      assertAA(`${theme} primary button`, colors.primaryButtonText, colors.primaryButtonBg);
      assertAA(`${theme} normal Find`, colors.findInk, colors.findBg);
      assertAA(`${theme} active Find`, colors.activeFindInk, colors.activeFindBg);
      assertAA(`${theme} Markdown syntax markers`, colors.syntaxMarker, colors.bgAlt);
      assert.equal(colors.syntaxMarkerOpacity, '1', `${theme} syntax markers should not be dimmed by element opacity`);
      assertAA(`${theme} code syntax token`, colors.codeKeyword, colors.codeBg);
      assertAA(`${theme} Find scope label`, colors.findScope, colors.surface);
      assert.equal(colors.findInk, colors.vars.normal, 'normal Find text should use its configured contrast token');
      assert.equal(colors.findBg, colors.vars.normalBg, 'normal Find background should use its configured palette token');
      assert.equal(colors.activeFindInk, colors.vars.active, 'active Find text should use its configured contrast token');
      assert.equal(colors.activeFindBg, colors.vars.activeBg, 'active Find background should use its configured palette token');
      return colors;
    }

    async function capture(theme, view) {
      await waitForPaint();
      const image = await win.webContents.capturePage();
      fs.writeFileSync(path.join(screenshots, `asterism-dark-${theme}-${view}.png`), image.toPNG());
    }

    for (const theme of ['midnight', 'onyx', 'ember']) {
      const selected = await setSetting('darkTheme', theme);
      assert.equal(selected.count, 3, 'Dark theme Settings row should expose three choices');
      assert.equal(selected.label, theme === 'midnight' ? 'Midnight' : theme[0].toUpperCase() + theme.slice(1));
      assert.equal(selected.active, 'true', `${theme} setting should be visibly selected`);
      assert.equal(selected.preference, theme, `${theme} should be selected by the Settings control`);
      assert.equal(selected.palette, `dark-${theme}`, `${theme} should apply immediately`);
      assert.equal(selected.stored, theme, `${theme} should persist to preferences`);

      await reloadAndInspect(theme, `dark-${theme}`);
      await evaluate(win, `setDocumentFromMarkdown(${JSON.stringify(fixture)}); openReader();`);
      await evaluate(win, `new Promise(resolve => setTimeout(resolve, 260))`);
      const find = await selectFind();
      assert.ok(find.count.endsWith('of 5'), `${theme} Find should return all five rendered matches; got ${find.count}`);
      assert.equal(find.normal, true, `${theme} should create normal Find highlights`);
      assert.equal(find.active, true, `${theme} should create an active Find highlight`);
      await paletteContrast(theme);
      await capture(theme, 'reader');

      await evaluate(win, `(() => { document.getElementById('findClose').click(); closeReader();
        document.getElementById('markdownEditor').focus(); openFind();
        const input = document.getElementById('findInput'); input.value = 'contrast'; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      assert.equal(await evaluate(win, 'state.view'), 'edit', `${theme} Edit capture should show the editor`);
      await paletteContrast(theme);
      await evaluate(win, `document.getElementById('findClose').click();`);
    }

    // Exercise browser Auto mode with explicit system color-scheme emulation.
    win.webContents.debugger.attach('1.3');
    const onyx = await setSetting('darkTheme', 'onyx');
    assert.equal(onyx.palette, 'dark-onyx');
    await setSetting('lightTheme', 'paper');
    await setSetting('appearance', 'auto');
    for (const [system, expectedMode, expectedPalette] of [
      ['light', 'light', 'light-paper'], ['dark', 'dark', 'dark-onyx']
    ]) {
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: system }]
      });
      await evaluate(win, `new Promise(resolve => setTimeout(resolve, 180))`);
      const current = await evaluate(win, `({ mode: document.documentElement.dataset.mode,
        palette: document.documentElement.dataset.palette, appearance: state.preferences.appearance })`);
      assert.equal(current.appearance, 'auto', 'Auto appearance should remain selected');
      assert.equal(current.mode, expectedMode, `Auto should follow emulated system ${system} mode`);
      assert.equal(current.palette, expectedPalette, `Auto ${system} mode should use its saved palette`);
    }
    win.webContents.debugger.detach();

    // Legacy "default" maps to Onyx, while unrelated settings and the draft survive.
    const migratedPrefs = {
      appearance: 'dark', lightTheme: 'sage', darkTheme: 'default', flavor: 'CommonMark',
      readerWidth: '60', textSize: '18', smartQuotes: false, autoSave: false, outlineHidden: true
    };
    await evaluate(win, `localStorage.setItem('inkdown.prefs', ${JSON.stringify(JSON.stringify(migratedPrefs))});
      localStorage.setItem('inkdown.doc', ${JSON.stringify(fixture)}); localStorage.removeItem('inkdown.draftSnapshot');`);
    const migrated = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Preference migration reload timed out')), 8000);
      win.webContents.once('did-finish-load', () => { clearTimeout(timeout); resolve(evaluate(win, `({ preferences: state.preferences,
        palette: document.documentElement.dataset.palette, markdown: state.markdown })`)); });
      win.webContents.reload();
    });
    assert.equal(migrated.preferences.darkTheme, 'onyx', 'legacy Default dark palette should migrate to Onyx');
    assert.equal(migrated.palette, 'dark-onyx', 'legacy dark preference should resolve to Onyx');
    assert.equal(migrated.preferences.lightTheme, 'sage', 'migration should preserve the selected light palette');
    assert.equal(migrated.preferences.flavor, 'CommonMark', 'migration should preserve Markdown flavor');
    assert.equal(migrated.preferences.readerWidth, '60', 'migration should preserve Reader width');
    assert.equal(migrated.preferences.textSize, '18', 'migration should preserve text size');
    assert.equal(migrated.preferences.smartQuotes, false, 'migration should preserve smart-quote preference');
    assert.equal(migrated.preferences.autoSave, false, 'migration should preserve Auto-save preference');
    assert.equal(migrated.preferences.outlineHidden, true, 'migration should preserve outline preference');
    assert.equal(migrated.markdown, fixture, 'legacy palette migration should preserve the current document');

    const invalid = { appearance: 'sepia', lightTheme: 'sepia', darkTheme: 'pink', flavor: '???',
      readerWidth: '99', textSize: '22', smartQuotes: 'false', autoSave: 'false', outlineHidden: 'false' };
    await evaluate(win, `localStorage.setItem('inkdown.prefs', ${JSON.stringify(JSON.stringify(invalid))});`);
    const fallback = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Invalid preference reload timed out')), 8000);
      win.webContents.once('did-finish-load', () => { clearTimeout(timeout); resolve(evaluate(win, `({ preferences: state.preferences,
        palette: document.documentElement.dataset.palette, markdown: state.markdown })`)); });
      win.webContents.reload();
    });
    assert.equal(fallback.preferences.appearance, 'light', 'invalid appearance should fall back safely');
    assert.equal(fallback.preferences.lightTheme, 'default', 'invalid light palette should fall back safely');
    assert.equal(fallback.preferences.darkTheme, 'midnight', 'invalid dark palette should fall back to Midnight');
    assert.equal(fallback.preferences.textSize, '16', 'invalid text size should fall back safely');
    assert.equal(fallback.preferences.readerWidth, '72', 'invalid Reader width should fall back safely');
    assert.equal(fallback.palette, 'light-default', 'invalid preferences should resolve to a valid appearance');
    assert.equal(fallback.markdown, fixture, 'invalid preferences should not discard the current document');
  } finally {
    if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach();
    win.destroy();
  }
}

main().then(() => {
  console.log('PASS dark-themes-smoke');
  app.exit(0);
}, error => {
  console.error('FAIL dark-themes-smoke', error?.stack || error);
  app.exit(1);
});
