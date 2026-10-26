# ![Asterism icon](./assets/asterism-app-icon.svg) Asterism

> Formerly Inkdown. The name comes from ⁂, three asterisks, the punctuation Markdown is built on.

A privacy-first rich text and Markdown converter for the browser and macOS.

Convert pasted rich text into clean Markdown, render Markdown back into rich text, or use the reader mode for a focused local preview. No account, no server, no content upload.

![Inkdown macOS preview](./docs/assets/inkdown-macos-preview.png)

## Download

The current macOS build is an unsigned Apple Silicon preview:

- [Download the latest release](https://github.com/aditya-pandya/asterism/releases/latest)
- Supported Macs: Apple Silicon only
- Build status: unsigned and not notarized

### Why macOS warns you

Asterism (formerly Inkdown) is a personal open-source project. I do not have a paid Apple Developer certificate, so the macOS app is not signed or notarized. Because of that, macOS Gatekeeper shows a warning the first time you open it. It does this for any app that is not signed and notarized.

The warning is about the missing certificate. It is not about anything the app does.

### Why it is safe to use

You do not have to take my word for it. Here is what you can check yourself:

- The full source code is in this public repository under the MIT license.
- It runs fully offline, with bundled libraries and local assets.
- The page has a strict Content-Security-Policy with `connect-src 'none'`, so its code cannot send your text anywhere. You can see it in [index.html](./index.html). It can still load remote images: any image your Markdown links to, and images inside rich text you paste in, such as tracking pixels in a copied marketing email.
- Your content is stored only on your Mac, in the app's local storage. It is never sent to a server.
- You can skip the download and build it yourself from source with `npm install` and `npm run dist:mac` (see [Desktop Development](#desktop-development)).
- You can also use the [browser version](#browser-version) and avoid the macOS warning entirely.

### How to open it

The current release was built before the rename, so it is still called Inkdown.

1. Download `Inkdown-1.1.0-arm64.dmg`.
2. Open the DMG and move Inkdown to Applications.
3. Control-click or right-click Inkdown, choose Open, then confirm Open.

If macOS still blocks it, open System Settings, go to Privacy & Security, and choose Open Anyway for Inkdown.

## What It Does

- Convert `Rich Text -> Markdown`
- Convert `Markdown -> Rich Text`
- Read Markdown in a focused local reader mode
- Format content with a built-in editor toolbar
- Copy or download the result instantly
- Run fully offline with bundled libraries and local assets

## Browser Version

You can also use Asterism as a static browser app:

1. Clone or download this repository.
2. Open [index.html](./index.html) in a modern browser.
3. Choose a conversion direction.
4. Paste or type your content.
5. Copy or download the output.

```bash
git clone https://github.com/aditya-pandya/asterism.git
cd asterism
open index.html
```

## Desktop Development

```bash
npm install
npm start
```

Build the Apple Silicon macOS preview:

```bash
npm run dist:mac
```

The build writes the app, DMG, and ZIP into `dist/`.

## Privacy

Asterism keeps your content local. The packaged desktop app uses bundled JavaScript, CSS, icons, and syntax-highlighting assets instead of runtime CDN or web font loads.

The app can open normal external links only when you explicitly click them. It does not send editor content to an external service.

## Project Files

- [index.html](./index.html) - app structure
- [styles.css](./styles.css) - styling and themes
- [app.js](./app.js) - editor and conversion logic
- [electron/main.js](./electron/main.js) - macOS desktop shell
- [electron/preload.js](./electron/preload.js) - desktop bridge
- [scripts/after-pack.js](./scripts/after-pack.js) - macOS package metadata cleanup
- [vendor/](./vendor) - bundled runtime libraries
- [assets/asterism-mark.svg](./assets/asterism-mark.svg) - primary app mark

## Release Notes

See [v1.1.0 Apple Silicon Preview](./docs/release-notes/v1.1.0.md).

## License

MIT
