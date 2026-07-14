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
