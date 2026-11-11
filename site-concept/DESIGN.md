# Asterism site concept: design

Review draft. Flat only: no perspective, rotation of the page, shadows or folds.

## Idea

The first viewport is the document itself, set at poster scale. Markdown source and the
typeset page occupy the same field. Real characters travel from their source position
to their typeset position: the three `*` of a `***` rule become the ⁂ mark, `# Asterism`
becomes the headline, and the `#`, `**` and `|` leave as markup.

Why this and not a product mockup: the subject is text, so text is the image. The
headline is Bricolage Grotesque 800 at about 15vw, and the star mark is made from the
same three asterisk glyphs, so the lockup comes from the format's own punctuation. The
page is not illustrated; it is typeset (italic Newsreader subheads, mono keys, ruled
table, plain prose). The default specimen has no code block and no inline link: a short
"Read & revise" subhead and factual paragraphs follow the shortcuts table, so the hero
carries no developer setup and nothing competes with Download. The parser still supports
code blocks, links and the rest for custom samples. In custom samples, links and code are
visual only (the animated layer is `aria-hidden` and not clickable); the semantic article
carries real links and `pre` blocks for assistive tech.

## Colour

One pair and one accent. Dark ground `#0f1722`, paper `#f0e8dd` (its exact RGB inverse),
accent orange `#ff963c`. The stage is drawn in white and accent with
`mix-blend-mode: difference`, so any glyph is cream over dark and ink over paper, and the
accent reads orange on dark and blue (`#0f52a1`) on paper. Characters stay legible while
the two grounds meet; no cross-fade through grey.

## Motion

- Source state is syntax-coloured by one rule: markup is accent, content is cream.
- A diagonal front sweeps the source in reading order. Characters move in a window
  around the front; markup lifts away and shrinks, content scales to its typeset size.
- The paper is a flat polygon clip that follows the same front, then finishes quickly
  once the last characters land. The `***` leaves last, so the star mark closes the move.
- It plays once on load. Replay, the range control, Markdown / Page and Edit source use
  the same progress value. Reduced motion lands on the page immediately; the range
  control remains available for manual scrubbing.
- Edit source rebuilds the layout from the pasted Markdown (1800 characters, this tab only).

## Layout

Headline and star mark, a larger deck, then two lanes chosen by weight so the table
and prose balance (code blocks, when a custom sample has them, join the same lanes). Mobile moves the star above the headline and stacks the lanes.
Controls are one quiet toolbar at the foot of the first viewport; the app and download
links are in the header and again below the fold.

## Constraints kept

Self-hosted fonts and Marked, strict CSP, safe DOM construction, a semantic article for
assistive tech (the animated layer is `aria-hidden`), and the full static article when
JavaScript is off.
