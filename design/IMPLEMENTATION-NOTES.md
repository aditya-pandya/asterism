# Paper implementation notes

## Changed

- Replaced the previous multi-mode interface with the Paper two-pane editor, centered micro-wordmark, focus-revealed nine-glyph toolbar, Markdown syntax render layer, reader, settings surface, drag/drop state, and footer command bar.
- Added synchronous rich-text ↔ Markdown editing with the bundled Marked, Turndown, Turndown GFM, and highlight.js libraries. GFM/CommonMark now rebuilds both converter configurations; smart quotes are applied only to reader text nodes outside code.
- Added Paper preferences and document persistence under `inkdown.prefs` and `inkdown.doc`, with migration from `inkdown_settings`/`inkdown_content` and `rtmd_settings`/`rtmd_content`.
- Rewired browser file input/download and Electron/Tauri open, save, menu-action, and open-file flows to the new document handlers.
- Kept the macOS overlay titlebar and traffic-light position, enabled Tauri window transparency/private API support, exposed `startDragging`, added its capability permission, and added a Tauri-only titlebar inset. Removed Electron vibrancy so the shell obeys Paper's no-blur/no-glass rule.

## Implementation choices and deviations

- The Markdown syntax colors use a non-interactive layer beneath a transparent `contenteditable` surface. This matches the prototype's render-layer behavior while preserving a plain editable DOM, native caret, selection, and undo history.
- No visual or interaction behavior was intentionally omitted. The prototype's hand-written Markdown converters were intentionally not carried over, as required by the implementation spec.

## Verification

- Passed `node --check` for `app.js`, both desktop bridges, Electron main/preload, and the Tauri runner.
- Parsed the edited JSON configs, ran `git diff --check`, confirmed every `getElementById` reference exists with no duplicate IDs, and confirmed the Tauri drag permission is present in the generated capability schema.
- Did not run Cargo/Tauri builds, per instruction. A graphical capture could not run in this sandbox: the in-app browser has no available backend, the installed Electron package lacks its binary and cannot download it, and macOS Quick Look is blocked by the sandbox. Visual verification is therefore limited to source/spec review here.

## Surgical polish fixes

- Overrode Turndown's list-item rule so unordered and ordered markers use one following space (`- item` and `1. item`) while retaining four-space indentation for continuation lines and nested lists.
- Added a Turndown rule that converts every `pre` element, including bare `pre` elements without an inner `code`, to a triple-backtick fenced block.
- Removed eager highlight.js script and theme stylesheet tags. The app now injects the bundled local assets on the first rendered `pre code`, lets conversion/rendering continue immediately, and highlights the current code blocks when the script finishes loading.

## October 2026 usability pass

Goal: keep Paper's quiet look but make every action findable without prior knowledge.

- Top bar replaces the centered micro-wordmark: wordmark and open file name on the left, an Edit/Read switch in the middle, Open, appearance and Settings on the right. The bar is still the window drag region (buttons opt out), with a left inset for the macOS traffic lights in both Electron and Tauri.
- Footer is now a status bar: word and character count, a plain-language status line (converts as you type, saved or auto-save off, copied), and Clear. Clear keeps the two-step confirm and the 8 second Undo, and now also restores the file name.
- Formatting toolbar is always visible, dimmed until the rich pane is focused, with 28px targets, icons for code, quote, lists and divider, and grouping rules.
- First-run empty state in the rich pane: what Inkdown does, a primary Paste button, Open file, and the drop hint. The Markdown placeholder says it can be edited too, and a small sync mark on the divider shows the panes are linked.
- Copy is the only filled button and is disabled with Save when the document is empty. The Markdown pane has a light tint so source and rendered sides read differently.
- Contrast and size raised: labels 12px in sentence case, tertiary text darkened, the heavy focus outline on the editors removed in favour of the pane label brightening.
- Settings is an opaque sheet with segmented controls, a close button and a shortcuts list. Visible toasts confirm open, save, download and cleared data.
- Deviation from the Paper spec: segmented controls use a 1px inset ring for the active option (no drop shadows were added).
