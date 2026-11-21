# Asterism core product audit

11 November 2026. This audit describes the v1.3.0-preview.1 source in the current checkout. The v1.2.0 release predates these changes. Browser and Electron evidence is recorded separately from untested Tauri interaction.

## Product model

`state.markdown` is the document source. **Read** renders it without editing. **Edit** presents formatted and Markdown source panes for the same document. Opening Markdown begins in Read; importing HTML or plain text converts it to Markdown. Before the first formatted edit, a source-fidelity guard detects common source-only syntax, including HTML comments and raw HTML blocks, link and footnote definitions, and YAML front matter outside code. Users can stay in Markdown or explicitly convert, with the original source restorable during that session. Exact source remains available in the Markdown pane; formatted editing can rewrite syntax the guard does not recognize.

This scope supports one local document at a time. Asterism does not need a vault, backlinks, plugins, AI writing, collaboration, or publishing integrations to meet its promise.

## Current implementation

- Read and Edit share one Markdown document source. Find works in both views with match counts, highlights, next/previous, zero-result state, and Markdown replace.
- Typography settings apply across reading and editing. Light palettes include Default, Paper, and Sage; dark palettes include Midnight, Onyx, and Ember, with Light, Dark, or Auto appearance.
- macOS supports Save in place for opened Markdown and Save As. Browser File System Access support allows opening Markdown, saving in place, and Save As where available. Before browser overwrite, disk contents are compared to the opened baseline; changed files require an explicit overwrite choice, while missing files require Save As. Browsers without the APIs fall back to downloads.
- In supported browsers, users can explicitly link a folder to resolve nearby images and Markdown links. Desktop relative images and links are supported. Read also has a searchable heading jump, and in-document heading links jump within the document.
- Read can copy rendered formatting and print. Markdown can be copied separately.
- Formatting and document shortcuts are shown in Settings. Enter continues Markdown lists and exits an empty list item.
- Task-list checkboxes are interactive in Edit, with Undo support, and disabled in Read.

## Competitor baseline

| Expectation | Focused comparison | Asterism v1.2.0 | v1.3.0-preview.1 |
| --- | --- | --- | --- |
| Find within the document | [Typora](https://support.typora.io/Search/), [iA Writer](https://ia.net/writer/support/basics/shortcuts?tab=keyboard-shortcuts-mac), [Bear](https://bear.app/faq/how-to-search-text-inside-notes-in-bear/), and reader-first [Marked 3](https://markedapp.com/help/Interface_Features) support it | Command-F absent in all builds | Find in Read/Edit; replace in Markdown |
| Understand Read and Edit | [Typora](https://support.typora.io/Quick-Start/) has formatted editing and source view; [iA Writer](https://ia.net/writer/how-to/quick-tour) has Editor and Preview; [Marked 3](https://markedapp.com/help/Live_Markdown_Preview_on_Mac) leads with reading | Opened files forced two-pane Edit | Opened and restored documents start in Read; both Edit panes act on the same source |
| Coherent typography and appearance | [Bear](https://bear.app/faq/typography-options/) uses one typography panel; iA Writer distinguishes its [preview templates](https://ia.net/writer/support/preview/modify-preview?platform=mac) | Reader, rich text, and source had unrelated sizes | Shared size setting and typography; Paper/Sage light and Midnight/Onyx/Ember dark palettes with Light/Dark/Auto appearance |
| Ordinary file Save | [Typora on macOS](https://support.typora.io/Typora-on-macOS/) and [iA Writer](https://ia.net/writer/how-to/write-with-focus) save documents in place | Every Command-S opened a dialog | Native Save and Save As; browser File System Access supports in-place Save, Save As, external-change conflict handling, and download fallback |
| Local assets and navigation | [Marked 3](https://markedapp.com/help/Opening_Files) opens file-based Markdown; [Bear's outline](https://bear.app/faq/how-to-use-the-info-panel-table-of-contents-and-backlinks-in-bear/) and [iA Writer navigation](https://ia.net/writer/support/library/navigation) support heading navigation | Nearby images and local document links failed | Desktop links and images; browser Link folder; in-document heading links and searchable heading jump |
| Task lists | [GFM](https://github.github.com/gfm/) defines rendered task items | Sanitization removed checkboxes | Interactive task checkboxes in Edit with Undo; disabled checkboxes in Read |
| Formatted copy | [Bear's Copy As](https://bear.app/faq/copy-portions-of-notes-as-html-rtf-txt-or-markdown/) supports HTML, RTF, text, or Markdown | Markdown copy only | Copy formatted text from Read; Markdown copy remains available |
| Keyboard commands | [Apple's keyboard guidance](https://developer.apple.com/design/human-interface-guidelines/keyboards) documents familiar document commands | Find and native file commands were incomplete | Formatting and document shortcuts listed in Settings; list-aware Enter and heading-jump shortcut |

## Priorities delivered

1. **P1 · Find and core reading/editing.** Find works in Read and Edit with navigation and Markdown replacement. Opened files start in Read, with a shared source across Read and both Edit panes.
2. **P1 · Source protection and conversion fixtures.** The pre-edit guard covers common source-only syntax, and representative CommonMark/GFM round-trip fixtures cover headings, nested lists, tasks, aligned tables, strike, links, images, and code. The guard is not exhaustive; the Markdown pane remains the exact-source workflow and formatted editing is an explicit conversion.
3. **P1 · File save and conflict protection.** Native and supported-browser Save/Save As flows are implemented. Browser overwrite checks compare disk content with the opened baseline and require an explicit choice on external changes.
4. **P2 · Shortcuts, outline, formatted copy, print, themes, and site.** These requested features are implemented; verification details and platform limits are listed below.

Auto-save off stops future recovery snapshots but retains the last local snapshot until **Clear all** in Settings. Recovered drafts can offer **Reconnect file** on native Markdown drafts. Reattachment proceeds only if the selected file still matches the raw stored baseline; otherwise Save As remains the route. Electron's actual Cancel/Discard dialog was exercised. Tauri implementation is compile-checked, but its desktop interaction has not been exercised.

## App polish and persistent outline

The app now uses locally bundled Newsreader for shared reading/formatted typography. A collapsible, hierarchical outline appears beside documents on desktop and uses a keyboard-contained drawer in narrow windows. It reuses the same Markdown heading parser as quick jump, supports duplicate and non-Latin headings, excludes fenced code, and follows the active editor or Reader section. The desktop visibility preference persists; the narrow drawer is temporary. Toggle it with Mod+Alt+O; searchable quick jump remains Mod+Shift+O.

Find/Replace now restores the exact requested Markdown if native contenteditable insertion produces extra blank lines, retaining replacement undo/redo. The outline caches its text-node mapper and invalidates it on editor DOM changes.

Verification for this pass: 25 unit tests and all five isolated Electron suites passed (`ui-polish`, core features, Markdown roundtrip, recovered-draft reattachment, source fidelity). The new suite covers themes/font settings, replacement undo/redo and exact whitespace, outline updates/jumps/hierarchy, preference reload, drawer focus/inert/Escape/overlay transitions, and print/PDF output. Screenshots of Paper and Midnight in Edit/Read and the narrow drawer were visually reviewed. These renderer shortcut tests do not establish physical macOS accelerator dispatch: the native inspection tool timed out before that check. Safari, Firefox and Tauri interaction remain untested.

## Verification and limits

- `npm test` passes 25/25 tests. All four Electron smoke scripts pass: core features, Markdown round-trip, source fidelity, and recovered-draft reattachment.
- Chrome verified File System Access Open into Read, in-place Save with OS permission and disk contents checked, external-change conflict cancellation preserving the external file, and Save As with the copy verified on disk. After Save As, Link folder loaded a 1280-pixel-wide PNG and relative `next.md` navigation worked. An old-handle folder lookup returned null after external change; Save As and a fresh handle restored access. These checks do not cover every permission or handle edge case.
- Browser automation did not show a visible `beforeunload` prompt when closing a tab with Auto-save off. Download fallback, formatted-copy, and print have not been exhaustively checked across browsers.
- On the packaged Mac app, physical Command-B, Command-Z, Shift-Command-9, and Command-/ were checked without duplicate dispatch.
- Isolated Electron interaction covered Open into Read, native shortcuts and menus, Save in place, empty-file Save, Save As, task checkboxes, nearby images and links, heading jumps, file conflict decisions, recovered-draft labeling, and Cancel/Discard behavior. Source-fidelity and recovered-draft smoke scripts pass, though reattachment smoke mocks the desktop bridge and does not verify native picker IPC.
- Markdown round-trip smoke coverage checks headings, nested lists, tasks, table alignment and cells, strike, links, images, and code. It does not establish universal source preservation.
- Tauri Rust tests cover relative-path validation, raster signatures, and changed/deleted file conflict detection. Tauri desktop interaction has not been runtime tested.
- The Apple Silicon DMG and ZIP were built under `dist/preview-1.3.0`. `codesign --verify --deep --strict` passed and packaged asar contents matched source. The app is ad-hoc signed and not notarized.
- Search is case-insensitive, counts all matches, and highlights at most 300 near the active match to keep long documents responsive.

## Website

The site is live over HTTPS at [asterism.adityapandya.com](https://asterism.adityapandya.com), with the browser app at [asterism.adityapandya.com/app](https://asterism.adityapandya.com/app/). The homepage and app use the same source. Chrome verification covered the homepage, editing, Read, and Find. Source-isolated layout checks passed at 720×560 for the app and 390×844 for the site. Visual FAQ review remains pending. Remote images referenced by documents may load.
