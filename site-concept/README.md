# Asterism website concept

Approved design, 11 November 2026. Aditya approved the flat typographic direction and requested a final CTA refinement. Production source is `site/`; this folder retains the review prototype.

Preview: https://concept-asterism-site.aditya-pandya.workers.dev/ (review prototype).

Second pass after the first concept was rejected as generic. The page is now one field where Markdown source becomes the typeset document at poster scale, with the ⁂ mark built from the three `*` of a horizontal rule. See `DESIGN.md` for the idea, colour and motion.

Functionality kept: Markdown, Page, Replay, the range control and Edit source work locally. The animated layer is hidden from accessibility APIs; a semantic article provides the readable content. With JavaScript off the article is shown as the page.

Verification: the final poster and content changes passed 28 isolated Electron checks for keyboard/range/editor behavior, reduced motion, inert hostile Markdown, semantic content, and responsive overflow/control placement at 1280×900, 390×844 and 1554×817. Source syntax and whitespace checks passed. Rendered screenshot pixels confirmed the solid ink/paper, blue/paper and orange/dark pairs at 14.83:1, 6.31:1 and 6.65:1 respectively. These samples do not certify every antialiased or moving glyph. Desktop, mobile and transition screenshots were reviewed; Aditya approved the creative direction. The refined CTA passed a further 31 behavior checks, including the mobile layout.

Known risks: the difference-blend colour model means automated contrast tools that read computed colours see white text on the dark ground, not the final ink on paper; solid pixel pairs were checked as described above; moving glyphs and other browser engines remain unverified. The demo parser handles representative Markdown rather than all CommonMark/GFM. In custom Edit source samples, links and code are visual only (the animated glyph layer is not clickable); the hidden semantic article carries the real links. Underlines on multi-word links break at spaces during and after the move. Safari, Firefox and assistive-technology interaction have not been exercised. Asterism's browser app and Mac preview are unchanged.

Serve locally with `python3 -m http.server 8768 --directory site-concept` from the repository root. Font and Marked licenses are bundled beside their assets.
