# Rich Text ⇄ Markdown Converter

A privacy-first rich text and Markdown converter that works both as a standalone browser tool and as a packaged Electron macOS app.

---

## Features

**Bidirectional conversion** — Rich Text → Markdown and Markdown → Rich Text, with real-time output as you type.

**Full WYSIWYG toolbar** — Bold, italic, underline, strikethrough, six heading levels, bullet and numbered lists, blockquotes, links, images, inline code, and horizontal rules. All accessible via keyboard shortcuts too.

**Markdown flavor control** — Switch between GitHub Flavored Markdown (GFM) and a plainer CommonMark-style mode in Settings.

**Syntax highlighting** — Code blocks in the preview are highlighted using highlight.js, with separate light and dark themes.

**Dark mode** — Light, dark, or auto (follows your system preference). Toggle instantly from the header.

**Smarter auto-save** — Drafts are saved locally with debounced writes instead of blocking every keystroke, then restored on the next visit (up to 24 hours).

**Native desktop workflows** — The Electron build now supports native open and save dialogs from the File menu, plus `Cmd+,` for Settings.

**Works offline** — Fonts, icons, and conversion libraries are bundled locally in `vendor/`, so both the browser app and Electron app can run without internet.

---

## Getting started

### Browser mode

1. Download or clone this repository.
2. Open `index.html` in any modern browser — no build step, no server needed.
3. Pick a conversion direction from the toggle at the top, paste or type content, and copy or download the output.

### Electron macOS app

1. Install dependencies with `npm install`
2. Run the desktop app in development with `npm run dev`
3. Build a distributable macOS app with `npm run dist:mac`

For a local unpacked app bundle without creating a DMG, use `npm run pack:mac`.

---

## Keyboard shortcuts

| Action | Shortcut |
|--------|----------|
| Bold | `Ctrl+B` / `Cmd+B` |
| Italic | `Ctrl+I` / `Cmd+I` |
| Underline | `Ctrl+U` / `Cmd+U` |
| Insert link | `Ctrl+K` / `Cmd+K` |
| Settings | `Cmd+,` |

---

## Markdown syntax reference

| Element | Syntax |
|---------|--------|
| Heading 1 | `# Heading` |
| Heading 2 | `## Heading` |
| Heading 3 | `### Heading` |
| Bold | `**bold**` |
| Italic | `*italic*` |
| Strikethrough | `~~text~~` |
| Link | `[label](url)` |
| Image | `![alt](url)` |
| Unordered list | `- item` or `* item` |
| Ordered list | `1. item` |
| Blockquote | `> quote` |
| Inline code | `` `code` `` |
| Code block | ` ```lang … ``` ` |
| Horizontal rule | `---` |

---

## Settings

Open the gear icon (⚙) in the top-right corner.

| Setting | Description |
|---------|-------------|
| Real-time conversion | Convert as you type (toggle off for large documents) |
| Conversion delay | Debounce delay in ms — increase if conversion feels sluggish |
| Markdown flavor | GFM (default) or CommonMark |
| Theme | Light / Dark / Auto |
| Syntax highlighting | Highlight code blocks in the Markdown → Rich Text preview |
| Auto-save | Save content and settings to browser storage |
| Clear saved data | Wipe all stored content and reset to defaults |

---

## File structure

```
index.html      Main app structure and markup
styles.css      Design system, themes, animations
app.js          Conversion logic and UI behaviour
electron/
  main.js       Electron main process and macOS app window
  preload.js    Safe bridge for native file dialogs and menu actions
build/          macOS build resources (generated app icon)
README.md       This file

vendor/
  fonts/        Bundled local font files
  phosphor/     Bundled local icon font
  marked.min.js
  turndown.js
  turndown-plugin-gfm.js
  highlight.min.js
  highlight/
    github.min.css
    github-dark.min.css
```

---

## Dependencies

Frontend libraries are loaded locally:

| Library | Version | Purpose |
|---------|---------|---------|
| [Marked.js](https://marked.js.org/) | 11.1.1 | Markdown → HTML |
| [Turndown](https://github.com/mixmark-io/turndown) | 7.1.2 | HTML → Markdown |
| [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) | 1.0.2 | GFM table and checkbox support |
| [highlight.js](https://highlightjs.org/) | 11.9.0 | Code syntax highlighting |

Desktop packaging dependencies:

| Tool | Purpose |
|------|---------|
| [Electron](https://www.electronjs.org/) | Native desktop shell for macOS |
| [electron-builder](https://www.electron.build/) | macOS app and DMG packaging |

---

## Browser support

Chrome 90+, Firefox 88+, Safari 14+, Edge 90+. Requires JavaScript enabled.

---

## Privacy

All processing happens locally in your browser or desktop app. No content, telemetry, or usage data is sent anywhere, and the UI no longer depends on runtime CDN requests.

---

## Third-party notices

Bundled third-party libraries, fonts, and icons are documented in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). The referenced license texts are included in the [`licenses/`](./licenses) directory and are packaged with the Electron app build.

---

## License

MIT — use, modify, and distribute freely.
