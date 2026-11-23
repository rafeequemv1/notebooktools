# Slide OCR benchmark

A fixed set of test slides with known answers, so every change to the slide
editor's converter (`website/tools/slide-engine.js`) can be measured: did text,
pictures, tables and backgrounds get better or worse?

```bash
node bench/run.js              # all sets, compared with the baseline
node bench/run.js --details    # also list every miss
node bench/run.js 07-structure # one set (compare only with a baseline of the same sets)
node bench/run.js --baseline   # save this run as the new baseline
```

It serves `website/` itself and runs the converter in Chromium (Playwright), about
a second per slide. Results go to `results/latest.json`; every full run adds a line
to `results/history.csv`.

## How the answer is known

Every slide is drawn from HTML (`sets/*/slides.js`) and saved four ways:

| File | What it is |
|---|---|
| `slides.pdf` | the slide, an image-only PDF like NotebookLM's |
| `clean.pdf` | the slide with its text hidden |
| `bg.pdf` | text and pictures hidden: what the editable slide's background should be (boxes, tables, lines, cards stay) |
| `page.pdf` | everything hidden: the bare page |

Comparing them sorts every pixel of the original into **text**, **picture**,
**structure** (boxes, tables, lines, cards, frames) or **bare page**.
`truth.json` lists every line of text and how it looks; `pics.json` the pictures.

## Categories (0–100) and the overall score

| Category | Weight | Measures |
|---|---|---|
| Text found | 15 | share of text lines that became editable text (≥ 80% the same) |
| Text accuracy | 15 | character accuracy of those lines |
| Text style | 10 | bold, italic, serif, colour, styled words inside lines, badges (minus false styling) |
| Labels on pictures | 10 | labels on figures and photos that became editable |
| Pictures separated | 15 | real pictures cut out whole, against all cut-outs (false ones count against) |
| Text removed cleanly | 10 | where text was, the background now shows what's behind it |
| Pictures lifted cleanly | 10 | where pictures were, the background shows what's behind them |
| Tables, lines, boxes kept | 10 | structure is still in the background, not cut into pictures |
| Background untouched | 5 | the bare page is left as it was |

The overall score is the weighted average. Speed (seconds per slide) is reported, not scored.

## Sets

| Set | Covers |
|---|---|
| 01-business | bullets, two columns, timelines, stats, a line chart |
| 02-layouts | steps, timelines, comparisons, quotes, coloured cards |
| 03-mixed | a bar chart, number badges, gradients, dark slides |
| 04-figures | science figures with labels on them |
| 05-italic | italic quotes, captions, titles |
| 06-styles | styled words, super/subscripts, badges, shadowed photos, labels on textures |
| 07-structure | tables, framed comic panels, speech bubbles, cards with dividers and arrows, a chart, a framed slide |

## Adding or changing a set

1. Add `sets/NN-name/slides.js` (copy one; `markup: true` allows `**bold**`,
   `_italic_`, `{#d93025|colour}`, `^sup^`, `~sub~` inside lines; class `pic` marks pictures;
   `ln(L(text, { fig: 1 }))` marks a label on a picture).
2. `node bench/make.js NN-name` (needs network once, for Google Fonts).
3. `node bench/run.js --baseline` and commit the set and the new baseline.

The PDFs are committed so the benchmark stays identical between runs. Rebuild a
set only when its slides change; a rebuild changes the baseline.
