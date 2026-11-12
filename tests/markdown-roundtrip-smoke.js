// Run with: ./node_modules/.bin/electron tests/markdown-roundtrip-smoke.js
// Exercises the real renderer's Markdown -> formatted edit -> Markdown path.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const repoRoot = path.resolve(__dirname, '..');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'asterism-roundtrip-')));
app.on('window-all-closed', () => {});

const source = [
  '# Roundtrip heading', '',
  '## Setext heading', '---', '',
  '- parent', '  - nested child', '    1. nested ordered', '',
  '1. ordered one', '2. ordered two', '',
  '- [x] checked task', '- [ ] unchecked task', '',
  '| Name | Value |', '| :--- | ---: |', '| alpha | beta |', '',
  'A ~~struck phrase~~ and [a link](../docs/guide.md).', '',
  '![diagram](../images/diagram.png "diagram")', '',
  '```js', 'const marker = "```";', '```', '',
  '````c++', 'auto text = "```";', '````', '',
  'Trailing paragraph stays semantic.'
].join('\n');
const unsupportedFence = '```js title="x"\nconst x = 1;\n```';

function evaluate(win, js) { return win.webContents.executeJavaScript(js); }
function waitFor(predicate, message) {
  return (async () => {
    for (let i = 0; i < 40; i += 1) {
      if (await predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.fail(message);
  })();
}

async function main() {
  await app.whenReady();
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[renderer ${sourceId}:${line}] ${message}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => console.error('Renderer process exited:', details));
  try {
    await win.loadFile(path.join(repoRoot, 'index.html'));
    await evaluate(win, `setDocumentFromMarkdown(${JSON.stringify(source)});`);
    const before = await evaluate(win, `(() => {
      const root = markdownToHtml(state.markdown);
      const box = document.createElement('div'); box.innerHTML = root;
      const describe = node => node.nodeType === Node.TEXT_NODE
        ? node.textContent.replace(/\\s+/g, ' ').trim()
        : { tag: node.tagName.toLowerCase(), attrs: [...node.attributes]
            .filter(attr => ['href', 'src', 'alt', 'title', 'start', 'type', 'checked', 'disabled', 'align'].includes(attr.name) ||
              (attr.name === 'style' && /text-align/.test(attr.value)))
            .map(attr => [attr.name, attr.value]).sort(([a], [b]) => a.localeCompare(b)),
            children: [...node.childNodes].map(describe).filter(child => child !== '') };
      const cells = [...box.querySelectorAll('th')].map(cell => cell.getAttribute('align') || cell.style.textAlign || '');
      return { semantic: JSON.stringify([...box.childNodes].map(describe)), alignments: cells };
    })()`);
    assert.deepEqual(before.alignments, ['left', 'right'], 'the parsed table should render its declared left and right header alignment before editing');

    const guardResult = await evaluate(win, `(() => {
      setDocumentFromMarkdown(${JSON.stringify(unsupportedFence)});
      const original = state.markdown;
      const event = new InputEvent('beforeinput', { inputType: 'insertText', data: '!', bubbles: true, cancelable: true });
      document.getElementById('richEditor').dispatchEvent(event);
      const unchanged = event.defaultPrevented && state.markdown === original && document.getElementById('sourceGuard').hidden === false;
      setDocumentFromMarkdown(${JSON.stringify(source)});
      return { unchanged, original };
    })()`);
    assert.equal(guardResult.unchanged, true, 'unsupported fenced-code info strings must remain exact until the user consents');
    assert.equal(guardResult.original, '```js title="x"\nconst x = 1;\n```');

    const sourceGuard = await evaluate(win, `(() => {
      const guard = document.getElementById('sourceGuard');
      const wasVisible = !guard.hidden;
      if (wasVisible) {
        const event = new InputEvent('beforeinput', { inputType: 'insertText', data: '!', bubbles: true, cancelable: true });
        document.getElementById('richEditor').dispatchEvent(event);
        const consent = [...guard.querySelectorAll('button')].find(button => button.textContent.trim() === 'Edit here anyway');
        if (!consent) throw new Error('a blocking source guard did not offer its explicit formatted-edit consent');
        consent.click();
      }
      const editor = document.getElementById('richEditor');
      const last = editor.querySelector('p:last-of-type') || [...editor.querySelectorAll('p')].at(-1);
      if (!last) throw new Error('trailing paragraph missing from rendered document');
      last.focus();
      const range = document.createRange(); range.selectNodeContents(last); range.collapse(false);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
      document.execCommand('insertText', false, ' Edited.');
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ' Edited.' }));
      return wasVisible;
    })()`);
    assert.equal(sourceGuard, false, 'supported CommonMark/GFM constructs should allow a formatted edit without the source guard');
    await waitFor(() => evaluate(win, `state.markdown.includes('Trailing paragraph stays semantic. Edited.')`), 'formatted trailing paragraph edit should serialize');
    const after = await evaluate(win, `(() => {
      const box = document.createElement('div'); box.innerHTML = markdownToHtml(state.markdown);
      const describe = node => node.nodeType === Node.TEXT_NODE
        ? node.textContent.replace(/\\s+/g, ' ').trim()
        : { tag: node.tagName.toLowerCase(), attrs: [...node.attributes]
            .filter(attr => ['href', 'src', 'alt', 'title', 'start', 'type', 'checked', 'disabled', 'align'].includes(attr.name) ||
              (attr.name === 'style' && /text-align/.test(attr.value)))
            .map(attr => [attr.name, attr.value]).sort(([a], [b]) => a.localeCompare(b)),
            children: [...node.childNodes].map(describe).filter(child => child !== '') };
      return { semantic: JSON.stringify([...box.childNodes].map(describe)), markdown: state.markdown,
        alignments: [...box.querySelectorAll('th')].map(cell => cell.getAttribute('align') || cell.style.textAlign || '') };
    })()`);
    assert.match(after.markdown, /Trailing paragraph stays semantic\. Edited\./, 'the authorized trailing paragraph edit should be present');
    assert.match(after.markdown, /````[ \t]*js/, 'serializer should lengthen the JavaScript fence around literal triple backticks');
    assert.match(after.markdown, /````[ \t]*c\+\+/, 'serializer should preserve c++ fence info and lengthen its delimiter');
    assert.match(after.markdown, /\[.*\]\(\.\.\/docs\/guide\.md\)/, 'relative link destination should survive');
    assert.match(after.markdown, /\.\.\/images\/diagram\.png/, 'relative image source should survive');
    assert.deepEqual(after.alignments, ['left', 'right'], `left and right table alignment should survive formatted editing; serialized Markdown:\n${after.markdown}`);
    const normalizedBefore = before.semantic.replace('Trailing paragraph stays semantic.', 'TRAILING');
    const normalizedAfter = after.semantic.replace('Trailing paragraph stays semantic. Edited.', 'TRAILING');
    assert.equal(normalizedAfter, normalizedBefore,
      `headings, nested lists, tasks, table alignment/cells, strike, links, images and code should render with the same semantics; serialized Markdown:\n${after.markdown}`);
  } finally {
    win.destroy();
  }
}

main().then(() => {
  console.log('PASS markdown-roundtrip-smoke');
  app.exit(0);
}, error => {
  console.error('FAIL markdown-roundtrip-smoke', error?.stack || error);
  app.exit(1);
});
