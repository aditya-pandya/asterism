# Asterism website concept

Review draft, 11 November 2026. This folder is separate from the production `site/` build.

Preview: https://concept-asterism-site.aditya-pandya.workers.dev/

The document spread animates Markdown characters into their formatted positions. Source, Read, Replay, the range control, and the editable sample work locally. The visual layer is hidden from accessibility APIs; a semantic article provides the readable content.

References inspected: Aditya's personal site, Mornumi, Monday Music Mix, and totalBarça. This is a proposed direction for review, not an approved replacement.

Verification: 34 isolated Electron checks passed, covering 1280×900, 390×844, and 1554×817 layouts, keyboard and edit controls, input safety, semantic content, and control contrast. The separate HTTPS preview matches the tested HTML. Production remains on Cloudflare version `4f92a917-6435-44c4-a785-2f79b8cf9f4f`.

Limits: the demo parser handles representative Markdown rather than all CommonMark/GFM constructs. Safari, Firefox, and assistive-technology interaction have not been exercised. Asterism's actual browser app and downloadable Mac preview are unchanged.

Serve locally with `python3 -m http.server 8768 --directory site-concept` from the repository root. Font and Marked licenses are bundled beside their assets.
