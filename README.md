# Rich Text to Markdown

![Rich Text to Markdown logo](./favicon.svg)

Local-first rich text and Markdown conversion for the browser and macOS.
Works offline, keeps your content on-device, and supports both directions: `Rich Text → Markdown` and `Markdown → Rich Text`.

## What It Does

- Convert `Rich Text → Markdown` or `Markdown → Rich Text`
- Write with a clean formatting toolbar and live output
- Copy or download the result in a couple of clicks
- Switch between light, dark, black, or system theme
- Keep everything on-device with no server round-trip

## How to Use It

### Browser

1. Clone or download this repo.
2. Open `index.html` in a modern browser.
3. Choose a conversion direction, paste or type your content, then copy or download the result.

### macOS App

1. Run `npm install`.
2. Start the desktop app with `npm run dev`.
3. Build the macOS app with `npm run dist:mac`.

## A Few Nice Details

- Real-time conversion with adjustable delay
- Markdown flavor support for `GFM` and `CommonMark`
- Native macOS file open/save actions in the Electron app
- Local bundled fonts, icons, and libraries for offline use
- Auto-save for drafts and settings

## Privacy

Your content stays local. The app runs entirely in your browser or desktop app and does not send your writing to an external service.

## Third-Party Notices

Credits and license details for bundled libraries, fonts, and icons are in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## License

MIT
