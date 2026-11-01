# Feature demos (Stageshow)

Animated product demos for the website's feature pages, built with the
[Stageshow](https://github.com/benjitaylor/skills) skill and kit (MIT). The
skill itself lives in `.claude/skills/stageshow/`; read its `SKILL.md` before
adding or changing a demo.

```
npm install
npm run build      # writes website/features/stage/stage.js + stage.css
```

The site stays plain HTML: a feature page mounts a demo with
`<div class="md-stage" data-stage="youtube"></div>` and loads
`/features/stage/stage.js`. `scripts/sync-feature-pages.py` copies the markup
and the script tags to every feature page.

| `data-stage` | Component | Story |
|---|---|---|
| `youtube` | `src/demos/YouTubeImport.tsx` | NotebookLM button under a video, pick a notebook, Import; the notebook's Sources card receives it and its count rolls |
| `hub` | `src/demos/NotebooksTable.tsx` | Select two notebooks, Add tag from the bulk bar, "Thesis" lands on both rows, the sidebar count rolls |
| `chat-export` | `src/demos/RibbonExport.tsx` | The in-notebook ribbon: Export, Markdown, the file lands in Chrome's downloads |

Each demo is 960 x 600 with a `compact` design at 358 wide, plays once when it
scrolls into view and holds its result (the poster frame), with a Replay
button. Gold examples copied: `hero-demo` (structure, beats, measured
targets), `table-edit` (table rhythm). Checked: stills at 1040 and 358 for
every beat, the real feature pages at 1440 and 390. Not yet run: the skill's
`film.mjs --gate` rehearsal tool and dark-theme looks.
