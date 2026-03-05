# Rich Text ⇄ Markdown Converter

A standalone, privacy-first browser tool for converting between rich text and Markdown. No server, no signup, no tracking — just open `index.html` and go.

---

## Features

**Bidirectional conversion** — Rich Text → Markdown and Markdown → Rich Text, with real-time output as you type.

**Full WYSIWYG toolbar** — Bold, italic, underline, strikethrough, six heading levels, bullet and numbered lists, blockquotes, links, images, inline code, and horizontal rules. All accessible via keyboard shortcuts too.

**GitHub Flavored Markdown (GFM)** — Tables, fenced code blocks, strikethrough, and task lists all convert correctly. You can switch to plain CommonMark in Settings.

**Syntax highlighting** — Code blocks in the preview are highlighted using highlight.js, with separate light and dark themes.

**Dark mode** — Light, dark, or auto (follows your system preference). Toggle instantly from the header.

**Auto-save** — Your content is saved to `localStorage` every 30 seconds and restored on the next visit (up to 24 hours).

**Works offline** — CDN libraries have local fallbacks in the `vendor/` directory. After the first load, the app works without internet.

---

## Getting started

1. Download or clone this repository.
2. Open `index.html` in any modern browser — no build step, no server needed.
3. Pick a conversion direction from the toggle at the top, paste or type content, and copy or download the output.

---

## Keyboard shortcuts

| Action | Shortcut |
|--------|----------|
| Bold | `Ctrl+B` / `Cmd+B` |
| Italic | `Ctrl+I` / `Cmd+I` |
| Underline | `Ctrl+U` / `Cmd+U` |
| Insert link | `Ctrl+K` / `Cmd+K` |

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
README.md       This file

vendor/
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

All loaded from CDN with local fallbacks:

| Library | Version | Purpose |
|---------|---------|---------|
| [Marked.js](https://marked.js.org/) | 11.1.1 | Markdown → HTML |
| [Turndown](https://github.com/mixmark-io/turndown) | 7.1.2 | HTML → Markdown |
| [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) | 1.0.2 | GFM table and checkbox support |
| [highlight.js](https://highlightjs.org/) | 11.9.0 | Code syntax highlighting |

---

## Browser support

Chrome 90+, Firefox 88+, Safari 14+, Edge 90+. Requires JavaScript enabled.

---

## Privacy

All processing happens locally in your browser. No content, telemetry, or usage data is sent anywhere. The only external requests are to load the CDN libraries on first use — after that, local fallbacks in `vendor/` take over.

---

## License

MIT — use, modify, and distribute freely.
