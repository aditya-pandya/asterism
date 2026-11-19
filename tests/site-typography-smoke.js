// ./node_modules/.bin/electron tests/site-typography-smoke.js [site-directory] [artifact-directory]
// Uses production CSS/fonts and Chromium geometry, without network or app state.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const site = path.resolve(process.argv[2] || path.join(__dirname, '../site'));
const artifacts = path.resolve(process.argv[3] || '/private/tmp/asterism-site-typography');
// Ephemeral Chromium session: no persistent cookies, cache, or application state.
app.on('window-all-closed', () => {});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const failures = [];
function check(condition, message) { if (!condition) failures.push(message); }

// This runs in the real renderer. Ghost spans supply the native, styled advance
// positions used by the animation. Compare these and isolated native ink widths:
// italic overhang and legitimate kerning are preserved, rather than banned.
function geometry() {
  const rect = node => node.getBoundingClientRect();
  const props = ['fontFamily', 'fontStyle', 'fontWeight', 'fontVariationSettings', 'fontKerning', 'fontFeatureSettings', 'fontOpticalSizing', 'textTransform'];
  const ghosts = [...document.querySelectorAll('.g-read span')].filter(n =>
    n.children.length === 0 && /\S/.test(n.textContent) && !n.classList.contains('x') && !n.classList.contains('hrs'));
  const live = [...document.querySelectorAll('#doc .r')].filter(n => !n.classList.contains('hrs'));
  const errors = [];
  let worstWidth = null;
  let widthError = 0, positionError = 0, compared = 0, italic = 0, bold = 0;
  for (let i = 0; i < Math.min(ghosts.length, live.length); i++) {
    const g = ghosts[i], l = live[i], gs = getComputedStyle(g), ls = getComputedStyle(l);
    if (g.textContent !== l.textContent) { errors.push('glyph sequence differs at ' + i); break; }
    for (const prop of props) if (gs[prop] !== ls[prop]) errors.push(i + ' ' + g.textContent + ' ' + prop + ': ' + ls[prop] + ' != ' + gs[prop]);
    const gr = rect(g), lr = rect(l);
    // Adjacent native inline spans may kern across boundaries. An isolated
    // native glyph supplies its ink width; the ghost still supplies placement.
    const native = document.createElement('span'); native.textContent = g.textContent;
    Object.assign(native.style, {position:'absolute', visibility:'hidden', whiteSpace:'pre', fontSize:gs.fontSize, letterSpacing:gs.letterSpacing, fontVariantLigatures:'none'});
    for (const prop of props) native.style[prop] = gs[prop];
    document.body.appendChild(native); const nativeWidth = rect(native).width; native.remove();
    if (Math.abs(nativeWidth - lr.width) > widthError) worstWidth = { i, text: g.textContent, className:g.className, nativeWidth, ghostWidth:gr.width, liveWidth:lr.width, ghostSize:gs.fontSize, liveSize:ls.fontSize, ghostSpacing:gs.letterSpacing, liveSpacing:ls.letterSpacing };
    widthError = Math.max(widthError, Math.abs(nativeWidth - lr.width));
    positionError = Math.max(positionError, Math.abs(gr.left - lr.left));
    if (g.classList.contains('st-i')) italic++;
    if (g.classList.contains('st-b')) bold++;
    compared++;
  }
  const link = document.querySelector('.top .line'), label = link.querySelector('.more-label');
  const downloadRange = document.createRange(); downloadRange.selectNodeContents(link.firstChild);
  const labelRange = document.createRange(); labelRange.selectNodeContents(label);
  // Leading whitespace is collapsed by flex layout, so measure the ink boxes.
  const gap = labelRange.getBoundingClientRect().left - downloadRange.getBoundingClientRect().right;
  const labelVisible = getComputedStyle(label).display !== 'none';
  const linkStyle = getComputedStyle(link);
  const extraWidth = rect(link).width - downloadRange.getBoundingClientRect().width - parseFloat(linkStyle.paddingLeft) - parseFloat(linkStyle.paddingRight);
  return { errors, worstWidth, widthError, positionError, compared, italic, bold, gap, labelVisible, extraWidth,
    count: { ghosts: ghosts.length, live: live.length }, dpr: devicePixelRatio,
    overflow: document.documentElement.scrollWidth > innerWidth };
}
async function main() {
  await app.whenReady(); fs.mkdirSync(artifacts, { recursive: true });
  const results = [];
  for (const [width, height, dpr] of [[1483, 1109, 2], [2966, 2218, 1], [1280, 900, 1], [390, 844, 1]]) {
    const win = new BrowserWindow({ show: false, width, height, useContentSize: true,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: 'site-spacing-qa-' + Date.now() + '-' + width } });
    console.log('Checking', width, height, dpr);
    const wc = win.webContents;
    const js = source => wc.executeJavaScript(source);
    try {
      await win.loadFile(path.join(site, 'index.html'));
      await wc.debugger.attach('1.3');
      await wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false });
      await new Promise((resolve, reject) => { wc.once('did-finish-load', resolve); wc.reloadIgnoringCache(); setTimeout(() => reject(new Error('reload timed out')), 10000); });
      await js(`document.fonts.ready`);
      for (let i = 0; i < 100 && !await js(`document.documentElement.classList.contains('ready')`); i++) await wait(30);
      assert.equal(await js(`document.documentElement.classList.contains('ready')`), true, 'site should initialize');
      // Let initial delayed autoplay start, then cancel it using the real slider.
      await wait(500);
      await js(`document.querySelector('#range').value=1000; document.querySelector('#range').dispatchEvent(new Event('input',{bubbles:true}));`);
      await wait(50);
      const result = await js('(' + geometry.toString() + ')()');
      results.push({ width, height, ...result });
      const label = width + 'x' + height + '@' + dpr;
      check(result.errors.length === 0, label + ' ghost/live style mismatch: ' + result.errors.slice(0, 4).join('; '));
      check(result.compared > 100 && result.italic >= 6 && result.bold >= 5, label + ' missing styled glyph coverage');
      check(result.widthError < .55, label + ' glyph ink width error ' + result.widthError.toFixed(3) + 'px');
      check(result.positionError < .55, label + ' glyph position error ' + result.positionError.toFixed(3) + 'px');
      check(!result.overflow, label + ' page overflows horizontally');
      if (width > 600) check(result.labelVisible && result.gap >= 3, label + ' Download / for Mac gap ' + result.gap);
      else check(!result.labelVisible && Math.abs(result.extraWidth) < 1, label + ' hidden label leaves a dangling gap');
      if (width === 1483 || width === 390) fs.writeFileSync(path.join(artifacts, label + '.png'), (await wc.capturePage()).toPNG());
      // Exercise the existing controls and geometry rebuilding without changing
      // animation timing or replacing production functions with test hooks.
      for (const value of [0, 500, 1000]) {
        await js(`document.querySelector('#range').value=${value}; document.querySelector('#range').dispatchEvent(new Event('input',{bubbles:true}));`);
        const state = await js(`({value: +document.querySelector('#range').value, transform:getComputedStyle(document.querySelector('#doc .c')).transform})`);
        check(state.value === value && !/NaN|Infinity/.test(state.transform), label + ' invalid state at ' + value);
      }
      if (width === 1280) {
        await wc.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        for (const [id, expected] of [['toSrc', 0], ['toRead', 1000], ['replay', 1000]]) {
          await js(`document.getElementById('${id}').click()`);
          check(await js(`+document.querySelector('#range').value`) === expected, 'reduced-motion ' + id + ' endpoint');
        }
        await js(`document.querySelector('#editToggle').click(); document.querySelector('#editArea').value += '\\n\\nA **bold** and *italic* check.'; document.querySelector('#editArea').dispatchEvent(new Event('input',{bubbles:true}));`);
        await wait(300);
        check(await js(`document.querySelector('#static').textContent.includes('italic check.')`), 'source edit should rebuild semantic page');
        await js(`document.querySelector('#editReset').click(); document.querySelector('#editToggle').click()`);
        await wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: 1271, height, deviceScaleFactor: dpr, mobile: false });
        await wait(250);
        const resized = await js('(' + geometry.toString() + ')()');
        check(resized.positionError < .55 && resized.errors.length === 0, 'resize should rebuild matching glyph geometry');
      }
    } finally { win.destroy(); }
  }
  fs.writeFileSync(path.join(artifacts, 'metrics.json'), JSON.stringify({ site, results, failures }, null, 2));
  if (failures.length) throw new Error(failures.join('\n'));
  console.log('Site typography smoke passed: four viewports, native glyph metrics, word gap, controls, reduced motion, edit and resize. Artifacts: ' + artifacts);
}
const watchdog = setTimeout(() => { console.error('Typography QA exceeded 45 seconds'); app.exit(1); }, 45000);
main().then(() => app.quit()).catch(error => { console.error(error); app.exitCode = 1; app.exit(1); }).finally(() => clearTimeout(watchdog));
