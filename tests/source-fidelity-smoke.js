// Run with: ./node_modules/.bin/electron tests/source-fidelity-smoke.js
// Loads the real renderer in an isolated, hidden Electron window and exercises
// the Markdown source-fidelity guard without adding test dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const repoRoot = path.resolve(__dirname, '..');
const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), 'asterism-fidelity-'));
const originalMarkdown = [
  '# Fidelity check',
  '',
  'A [reference link][guide].',
  '',
  '<!-- keep this source comment -->',
  '',
  '[guide]: https://example.com/guide "Guide"',
  ''
].join('\n');

app.setPath('userData', profilePath);

function evaluate(window, source) {
  return window.webContents.executeJavaScript(source);
}

async function main() {
  await app.whenReady();
  const sourceFile = path.join(profilePath, 'source.md');
  fs.writeFileSync(sourceFile, originalMarkdown, 'utf8');

  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  try {
    await window.loadFile(path.join(repoRoot, 'index.html'));
    await evaluate(window, `loadDocumentData({
      name: 'source.md', filePath: ${JSON.stringify(sourceFile)},
      content: ${JSON.stringify(originalMarkdown)}, kind: 'markdown'
    }); closeReader();`);

    // First normal formatted edit attempt must be canceled before it can alter
    // the editor or the exact bytes that came from disk.
    const firstAttempt = await evaluate(window, `(() => {
      const editor = document.getElementById('richEditor');
      const before = editor.innerHTML;
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      // execCommand drives Chromium's editing pipeline, including beforeinput.
      document.execCommand('insertText', false, 'X');
      const event = new InputEvent('beforeinput', {
        inputType: 'insertText', data: 'Y', bubbles: true, cancelable: true
      });
      editor.dispatchEvent(event);
      return { canceled: event.defaultPrevented, editorUnchanged: editor.innerHTML === before,
        markdownUnchanged: state.markdown === ${JSON.stringify(originalMarkdown)},
        guardVisible: !document.getElementById('sourceGuard').hidden };
    })()`);
    assert.equal(firstAttempt.canceled, true, 'formatted beforeinput should be canceled');
    assert.equal(firstAttempt.editorUnchanged, true, 'blocked input should not mutate formatted content');
    assert.equal(firstAttempt.markdownUnchanged, true, 'blocked formatted input should preserve the exact in-memory Markdown');
    assert.equal(firstAttempt.guardVisible, true, 'first formatted attempt should show the guard');
    assert.deepEqual(fs.readFileSync(sourceFile), Buffer.from(originalMarkdown));

    // Escape dismisses the warning without granting permission or changing the
    // Markdown. A second attempt can then choose the safe Markdown action.
    const afterEscape = await evaluate(window, `(() => {
      const guard = document.getElementById('sourceGuard');
      guard.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      const warningDismissed = guard.hidden;
      const editor = document.getElementById('richEditor');
      const event = new InputEvent('beforeinput', {
        inputType: 'insertText', data: 'Y', bubbles: true, cancelable: true
      });
      editor.dispatchEvent(event);
      const safe = [...guard.querySelectorAll('button')].find(button => button.textContent.trim() === 'Edit in Markdown');
      const safeActionExists = Boolean(safe);
      safe?.click();
      return { warningDismissed, secondAttemptCanceled: event.defaultPrevented,
        markdownUnchanged: state.markdown === ${JSON.stringify(originalMarkdown)},
        safeActionExists, safeActionDismissed: guard.hidden };
    })()`);
    assert.equal(afterEscape.warningDismissed, true, 'Escape should dismiss the warning');
    assert.equal(afterEscape.secondAttemptCanceled, true, 'Escape must not grant formatted edit permission');
    assert.equal(afterEscape.markdownUnchanged, true, 'Escape and another blocked attempt must preserve the Markdown');
    assert.equal(afterEscape.safeActionExists, true, 'guard should offer the Markdown safe action');
    assert.equal(afterEscape.safeActionDismissed, true, 'safe action should dismiss the guard');
    assert.deepEqual(fs.readFileSync(sourceFile), Buffer.from(originalMarkdown));

    // Verify paste/drop/composition entry points use the same guard, not only
    // keyboard beforeinput. These synthetic events are cancelable by design.
    const bypassChecks = await evaluate(window, `(() => {
      const editor = document.getElementById('richEditor');
      const drop = new DragEvent('drop', { bubbles: true, cancelable: true });
      editor.dispatchEvent(drop);
      const composition = new CompositionEvent('compositionstart', { bubbles: true, cancelable: true });
      editor.dispatchEvent(composition);
      return { dropCanceled: drop.defaultPrevented, compositionCanceled: composition.defaultPrevented,
        guardVisible: !document.getElementById('sourceGuard').hidden,
        markdownUnchanged: state.markdown === ${JSON.stringify(originalMarkdown)} };
    })()`);
    assert.equal(bypassChecks.dropCanceled, true, 'drop should be blocked before consent');
    assert.equal(bypassChecks.compositionCanceled, true, 'composition should be blocked before consent');
    assert.equal(bypassChecks.guardVisible, true, 'bypass attempts should show the guard');
    assert.equal(bypassChecks.markdownUnchanged, true, 'drop/composition attempts must preserve in-memory Markdown');
    assert.deepEqual(fs.readFileSync(sourceFile), Buffer.from(originalMarkdown));

    // Explicit consent permits a formatted edit and exposes an exact restore
    // action. Restoring must recover comments and reference definitions intact.
    const conversion = await evaluate(window, `(() => {
      const guard = document.getElementById('sourceGuard');
      const anyway = [...guard.querySelectorAll('button')].find(button => button.textContent.trim() === 'Edit here anyway');
      if (!anyway) return { anywayExists: false };
      anyway.click();
      const editor = document.getElementById('richEditor');
      editor.insertAdjacentHTML('beforeend', '<p>Authorized formatted edit</p>');
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'Authorized formatted edit' }));
      const restore = [...guard.querySelectorAll('button')].find(button => button.textContent.trim() === 'Restore original Markdown');
      return { anywayExists: true, restoreExists: Boolean(restore), convertedMarkdown: document.getElementById('markdownEditor').textContent };
    })()`);
    assert.equal(conversion.anywayExists, true, 'guard should offer explicit formatted-edit consent');
    assert.equal(conversion.restoreExists, true, 'a formatted edit after consent should offer restore');
    assert.match(conversion.convertedMarkdown, /Authorized formatted edit/);
    assert.deepEqual(fs.readFileSync(sourceFile), Buffer.from(originalMarkdown), 'editing in the app must not write to source disk implicitly');

    await evaluate(window, `(() => {
      const restore = [...document.querySelectorAll('#sourceGuard button')]
        .find(button => button.textContent.trim() === 'Restore original Markdown');
      if (!restore) throw new Error('Restore action disappeared');
      restore.click();
    })()`);
    const restored = await evaluate(window, `document.getElementById('markdownEditor').textContent`);
    assert.equal(restored, originalMarkdown, 'restore should recover exact original Markdown source');
    assert.deepEqual(fs.readFileSync(sourceFile), Buffer.from(originalMarkdown));

    // A document with no source-only syntax should remain directly editable.
    const simpleCheck = await evaluate(window, `(() => {
      setDocumentFromMarkdown('A simple paragraph without source-only syntax.');
      const editor = document.getElementById('richEditor');
      const event = new InputEvent('beforeinput', {
        inputType: 'insertText', data: '!', bubbles: true, cancelable: true
      });
      editor.dispatchEvent(event);
      return { canceled: event.defaultPrevented, guardVisible: !document.getElementById('sourceGuard').hidden };
    })()`);
    assert.equal(simpleCheck.canceled, false, 'simple Markdown should allow formatted editing');
    assert.equal(simpleCheck.guardVisible, false, 'simple Markdown should not show the source guard');

    // Reference definitions may put the destination on the next indented line.
    // They remain source-only syntax even though the definition line ends at ':'.
    const multilineReference = [
      'A [reference link][guide].',
      '',
      '[guide]:',
      '  https://example.com/guide',
      ''
    ].join('\n');
    const multilineReferenceCheck = await evaluate(window, `(() => {
      setDocumentFromMarkdown(${JSON.stringify(multilineReference)});
      const event = new InputEvent('beforeinput', {
        inputType: 'insertText', data: '!', bubbles: true, cancelable: true
      });
      document.getElementById('richEditor').dispatchEvent(event);
      return { canceled: event.defaultPrevented, guardVisible: !document.getElementById('sourceGuard').hidden };
    })()`);
    assert.equal(multilineReferenceCheck.canceled, true, 'multiline link reference definitions should block formatted editing');
    assert.equal(multilineReferenceCheck.guardVisible, true, 'multiline link reference definitions should trigger the guard');

    // A three-backtick line does not close a four-backtick fence. A later
    // comment is still fenced code and must not be mistaken for source syntax.
    const fencedComment = [
      '````markdown',
      '<!-- comment inside the four-backtick fence -->',
      '```',
      '<!-- still inside: the shorter fence did not close it -->',
      '````',
      ''
    ].join('\n');
    const fencedCommentCheck = await evaluate(window, `(() => {
      setDocumentFromMarkdown(${JSON.stringify(fencedComment)});
      const event = new InputEvent('beforeinput', {
        inputType: 'insertText', data: '!', bubbles: true, cancelable: true
      });
      document.getElementById('richEditor').dispatchEvent(event);
      return { canceled: event.defaultPrevented, guardVisible: !document.getElementById('sourceGuard').hidden };
    })()`);
    assert.equal(fencedCommentCheck.canceled, false, 'comments inside a four-backtick fence should not block formatted editing');
    assert.equal(fencedCommentCheck.guardVisible, false, 'shorter fence lines must not expose comments as source-only syntax');

    console.log('Source-fidelity smoke test passed.');
  } finally {
    window.destroy();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
}

main().then(() => app.quit()).catch((error) => {
  console.error(error);
  app.exit(1);
});
