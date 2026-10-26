# Inkdown "Paper" redesign — implementation spec

Source of truth: `design/inkdown-paper.dc.html` (exported from Claude Design project
"Inkdown", file "Inkdown Paper.dc.html"). That file is a working prototype (DC component
format: HTML template with {{placeholders}} + a React-like state class). Treat its
VISUALS and INTERACTIONS as the spec; do NOT adopt its conversion engine.

## Keep from the current app (do not regress)
- Conversion engine: vendor/marked + turndown (+ GFM plugin) stay. The prototype's
  hand-rolled htmlToMd/mdToHtml are placeholders — map its sync behavior onto the
  existing engine.
- highlight.js for code blocks where already used.
- desktopBridge integration (open/save/menu/open-file) — rewire to the new UI.
- localStorage persistence keys may migrate, but preserve users' saved doc/prefs
  (read old keys, write new).

## Layout (from prototype)
- No app header/chrome. Top: centered micro-wordmark "INKDOWN" (10px, letterspacing .34em,
  tertiary color). Bottom: single centered footer command bar (11px) with:
  words/chars (tabular-nums) · Clear/undo · Open ⌘O · hint text · Reader ⌘E · Settings ⌘, · theme cycle ◐.
- Main: two panes side by side (1fr 1px 1fr, hairline divider) — RICH TEXT (contenteditable,
  15px, line-height 1.75) and MARKDOWN (contenteditable, mono 12.5px, lh 1.85, secondary color,
  pre-wrap). Below 640px width: stacked rows instead of columns.
- Pane headers: 10px letterspaced labels; label brightens on pane focus.

## Key interactions (from prototype — replicate exactly)
- Formatting toolbar: 9 glyph-only buttons (B I U S ` ❝ • 1. —) in the RT pane header,
  hidden until RT focused; fade/slide in with 18ms stagger; run bold/italic/underline/
  strikethrough/inline-code/blockquote/ul/ol/hr.
- "Paste ⌘V" affordance shown in RT header when unfocused; reads clipboard (HTML preferred).
- Markdown pane shows dimmed syntax markers (##, **, -, >, ``` in tertiary color) via a
  render layer, while remaining editable (two-way sync).
- Copy: "Copy ⌘⇧C" underlined text-button → "Copied ✓" flash 1.4s.
- Clear: click once → "Clear — sure?" armed 3.5s → click confirms → "Undo" available 8s.
- Reader mode (⌘E): Georgia serif, 17px/1.85, max-width 42em (settings: 60/72/Full),
  esc closes.
- Settings (⌘,): full-surface overlay (bg 94% opacity), text-only option rows with
  underline on active choice: Appearance Light/Dark/Auto · Markdown GFM/CommonMark ·
  Reader width · Smart quotes On/Off · Text size 14/15/16 · Auto-save On/Off ·
  Saved data Clear all. Footer: privacy line, version, feedback mailto, "esc to close".
- Drag & drop overlay: dashed border, "Drop to open" (.md/.txt/.html).
- Theme: light (#fdfdfc paper) / dark (#0b0b0b) / auto (system); footer ◐ cycles.
- Empty state placeholders: RT "Paste anything — ⌘V", MD "Markdown appears here, instantly".
- Motion budget: 120–180ms, opacity/transform only, ease cubic-bezier(.4,0,.2,1). No glass,
  no blur, no shadows, no noise texture.

## Tokens (replace current styles.css themes)
Light: bg #fdfdfc, text #1a1a1a / #5a5a5a / #a8a8a4, borders #e2e2de / #f0f0ec.
Dark: bg #0b0b0b, text #e6e6e3 / #a2a2a0 / #5c5c58, borders #232320 / #191917.
Fonts: system sans UI; ui-monospace/SF Mono for MD; Georgia only in reader.

## Desktop specifics
- Keep the Tauri drag-region + traffic-light inset work (top wordmark strip is the drag area).
- Menu actions (new/open/save/settings) map to the new UI handlers.
