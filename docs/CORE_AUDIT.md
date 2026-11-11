# Asterism core product audit

10 November 2026. Baseline: the v1.2.0 source on `main`, reviewed as a Markdown reader, editor, and rich text converter for browser, Electron, and experimental Tauri. The changes in this checkout are not in the v1.2.0 download. This audit distinguishes source inspection, desktop interaction, and untested behavior.

## Product model

`state.markdown` is the document source. **Read** renders it without editing. **Edit** presents a formatted editor and Markdown source editor for the same document. Opening a Markdown file should begin in Read; opening it does not convert the file. Importing HTML or plain text converts it to Markdown. A formatted edit also converts the rendered DOM back to Markdown, which can normalize or remove syntax that has no visible rendering. Exact source work belongs in the Markdown pane.

This scope supports one local document at a time. Asterism does not need a vault, backlinks, plugins, AI writing, collaboration, or publishing integrations to meet its promise.

## Competitor baseline

| Expectation | Focused comparison | Asterism v1.2.0 | This pass |
| --- | --- | --- | --- |
| Find within the document | [Typora](https://support.typora.io/Search/), [iA Writer](https://ia.net/writer/support/basics/shortcuts?tab=keyboard-shortcuts-mac), [Bear](https://bear.app/faq/how-to-search-text-inside-notes-in-bear/), and reader-first [Marked 3](https://markedapp.com/help/Interface_Features) support it | Command-F absent in all builds | Match count, highlights, next/previous, zero-result state, and Markdown replace in Read/Edit |
| Understand Read and Edit | [Typora](https://support.typora.io/Quick-Start/) has formatted editing and source view; [iA Writer](https://ia.net/writer/how-to/quick-tour) has Editor and Preview; [Marked 3](https://markedapp.com/help/Live_Markdown_Preview_on_Mac) leads with reading | Opened files forced two-pane Edit | Opened and restored documents start in Read; both Edit panes act on the same source |
| Coherent typography | [Bear](https://bear.app/faq/typography-options/) uses one typography panel; iA Writer distinguishes its [preview templates](https://ia.net/writer/support/preview/modify-preview?platform=mac) | Reader, rich text, and source had unrelated sizes | One size setting reaches all three; Read and formatted Edit share a serif face; source stays monospaced |
| Ordinary file Save | [Typora on macOS](https://support.typora.io/Typora-on-macOS/) and [iA Writer](https://ia.net/writer/how-to/write-with-focus) save documents in place | Every Command-S opened a dialog | Native Save writes an opened Markdown file; Save As creates a new file; browser Save downloads |
| Local README assets and navigation | [Marked 3](https://markedapp.com/help/Opening_Files) opens file based Markdown and [Bear](https://bear.app/faq/how-to-use-the-info-panel-table-of-contents-and-backlinks-in-bear/) navigates headings | Nearby images and local document links failed | Desktop relative images and Markdown links work; in-document heading links jump in Read |
| Task lists | [GFM](https://github.github.com/gfm/) defines rendered task items | Sanitization removed checkboxes | Sanitized, disabled task checkboxes render |
| Save conflicts | File editors should protect an external change | Direct Save did not exist | Native Save compares disk content to the opened version and asks before overwrite |

[Apple's keyboard guidance](https://developer.apple.com/design/human-interface-guidelines/keyboards) also establishes Command-F/G, Shift-Command-G, Command-O, Command-S, and Shift-Command-S as familiar document commands. Asterism now exposes these in its shared interface and desktop menus.

## Remaining work, ranked

1. **P1 · Formatted editing is a conversion, not a lossless Markdown editor.** A small formatted edit reserializes the full rendered DOM. Comments, reference definitions, and other source-only constructs can disappear. The interface and README now warn about this. Before calling the formatted pane a full Markdown editor, add round-trip coverage for representative CommonMark/GFM syntax or require an explicit conversion choice for documents with unsupported constructs. The source pane preserves exact syntax.
2. **P1 · Recovery loses the original file association.** Local drafts restore in Read and are labeled as recovered, with Save As offered. The original path is deliberately not reauthorized from local storage, so the user cannot write the restored draft directly back to the source without reopening it. A future recovery flow should compare both versions and let the user choose a destination.
3. **P1 · Browser file limitations.** Browser Save downloads a copy, and the ordinary file input gives no folder access for resolving a README's nearby images or Markdown links. The desktop bridge covers those cases. A standard `beforeunload` guard is registered for Auto-save off, but browser automation did not show a visible prompt on tab close; do not rely on it as the only protection for an unsaved browser draft. If the browser version becomes a primary offer on a website, add a scoped browser file-access flow or clearly describe these limits at the entry point.
4. **P2 · Heading outline.** In-document table-of-contents links now work, but long files without such links lack a compact heading list or jump control. [Bear's outline](https://bear.app/faq/how-to-use-the-info-panel-table-of-contents-and-backlinks-in-bear/) and [iA Writer navigation](https://ia.net/writer/support/library/navigation) show restrained options.
5. **P2 · Copy formatted text.** Asterism copies Markdown; there is no explicit formatted-copy action from Read. Add one if normal selection and Copy proves inadequate. [Bear's Copy As](https://bear.app/faq/copy-portions-of-notes-as-html-rtf-txt-or-markdown/) is a reference.

Auto-save off stops future recovery snapshots but retains the last local snapshot until **Clear all** in Settings. This protects an earlier draft from disappearing when the setting changes, and the behavior is stated in the README. The desktop shells now ask Cancel or Discard Changes before closing unsaved work while Auto-save is off; Electron's actual dialog was exercised, and Tauri's implementation is compile-checked.

## Verification and limits

- Inspected the parser, sanitizer, editor sync, persistence, file opening, Electron and Tauri bridges, menus, and security boundaries.
- In Chrome, checked Markdown editing, match navigation and zero results, replace and Undo, Reader switching, typography, opening a browser file into Read, and restored local content opening into Read.
- In an isolated Electron source run, checked Open into Read, Command-F and menu actions, Save in place, empty-file Save, Save As, and task checkboxes. A second isolated run checked nearby PNG rendering, a bare relative Markdown link, a relative image path surviving a formatted edit and Save, external edit Cancel/overwrite behavior, a heading link jumping in a long document, recovered-draft labeling, and the native Cancel/Discard dialog on both Quit and window Close.
- A final Apple Silicon Electron app directory packaged successfully with ad-hoc signing. It was not notarized or published. A Chrome run confirmed the Auto-save off status, but its automated tab close did not display a browser leave prompt.
- Tauri Rust tests cover relative-path validation, raster signatures, and changed/deleted file conflict detection. `cargo check`, `cargo fmt --check`, JavaScript syntax, and diff whitespace checks pass. Tauri desktop interaction has not been exercised on this machine.
- Search is case-insensitive. It counts all matches and highlights at most 300 near the active match to keep long documents responsive.

## Website decision

A one-page site is worthwhile after the core file behavior is verified. Today the README is the only entry point for the browser version, and it asks people to clone the repo. The page could host that same app at `/app/`, with no second copy of the source. Use a real app screenshot, **Open in browser** and **Download Mac preview** actions, and a clear unsigned Apple Silicon note. Explain Read, Edit, and rich text conversion in three short steps; note the browser file limits and that linked remote images can load. The static Cloudflare pattern used for Mornumi is sufficient. A larger marketing site would add maintenance without helping the core workflow. No website was deployed in this pass.
