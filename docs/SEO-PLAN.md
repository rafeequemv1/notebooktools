# NotebookTools SEO plan (November 2026)

Built from three exports: Kortex's ranked keywords (`kortex-notebooklm.com`,
the closest third-party competitor), Google's own `notebook.google.com`
ranked keywords, and the top NotebookLM / Gemini Notebook search list.
Volumes are monthly (US unless the tool says otherwise). KD is keyword
difficulty, 0 to 100.

---

## 1. What the data says

### 1.1 A small third-party site can win the big NotebookLM questions
Kortex ranks **#1** with a single post (`/blog/is-notebooklm-free`) for:

| Keyword | Volume | KD | Kortex position |
|---|---:|---:|---:|
| is notebooklm free | 2,900 | 36 | 1 |
| notebook lm pricing | 880 | 25 | 1 |
| notebooklm podcast | 590 | 25 | 1 |
| is gemini notebook free | 320 | 37 | 1 |
| is google notebooklm free | 320 | 40 | 1 |

That one URL ranks for ~60 keywords (free, pricing, cost, plans, Plus, Pro,
students, limits). Google rewards **one deep page per question cluster**
from a niche site, even against Google's own domain (DR 85).

Kortex is weak where it matters to us. It sits at positions 15 to 30 on:
`notebooklm cost` (480, KD 3), `how much is notebooklm` (320, KD 10),
`notebooklm plans` (210), `notebooklm limits` (390), `notebooklm
alternatives` (260 to 590, KD 0), `notebooklm use cases` (170, KD 4) and the
podcast how-tos. Those are beatable in weeks, not months.

### 1.2 The cheapest, highest-intent keywords on the list
Sorted by opportunity (volume ÷ difficulty, then intent and fit with the
product):

| Keyword | Vol | KD | CPC | Fit | Note |
|---|---:|---:|---:|---|---|
| notebooklm pricing / price | 1,300 + 1,300 | **2** | $11.46 | ★★★ | We have a page; it isn't ranking |
| notebooklm mcp | 880 | **1** | $17.14 | ★★ | Developer intent, almost no competition |
| notebooklm-py / api / cli | 720 / 1,000 / 260 | 6 / 22 / 4 | | ★★ | Developer cluster |
| notebooklm skill / -skill | 320 + 320 | 8 to 9 | | ★★★ | Claude Code / agent skills: we already build these |
| notebooklm alternative(s) | 590 + 590 | **0** | $7.92 | ★★ | We have a page |
| youtube to notebooklm | 590 | 14 | | ★★★ | **Our core feature** |
| youtube to notebooklm chrome extension | 320 | 8 | | ★★★ | Literally our product |
| notebooklm to pdf chrome extension | 320 | **0** | | ★★★ | Our chat export does this |
| notebooklm mind map | 320 | **0** | $21.05 | ★★ | Studio how-to |
| notebooklm infographic | 260 | **0** | | ★★ | Studio how-to |
| notebooklm slide deck | 210 | **1** | | ★★★ | Ties to our slide-deck prompt library |
| notebooklm video overview(s) | 260 + 260 | 5 | | ★★ | Studio how-to |
| notebooklm podcast generator | 390 | 20 | | ★★ | Podcast hub feature |
| how many sources can you add to notebooklm | 320 | **3** | | ★★★ | We have a source-limits page |
| notebooklm limits / limitations / limit | 390 × 3 | 9 to 22 | | ★★★ | Same page, expand |
| is notebooklm down | 320 | **0** | | ★ | Troubleshooting page |
| notebooklm vs chatgpt | 260 | **0** | | ★★ | We have a page |
| notebooklm vs gemini | 480 | 13 | | ★★ | We have a page |
| notebooklm for students / studying | 590 + 590 | 21 / 31 | $13.92 | ★★★ | We have a study page |
| notebooklm student discount | 260 | 13 | | ★★ | New short post |
| notebooklm tutorial | 320 | 17 | | ★★ | We have a tutorial |
| how to use gemini notebook | 320 | 24 | $11.40 | ★★★ | Rebrand term, new page |
| notebooklm review(s), is notebooklm good | 260 × 3 | 7 to 9 | | ★★ | We have a review |
| notebooklm enterprise | 320 | 10 | | ★ | |
| notebooklm update(s) | 260 + 260 | 34 | | ★★ | Monthly "what's new" page |
| what is notebooklm used for / what does it do / how does it work | 1,000 / 720 / 590 | 26 to 32 | | ★★ | Use-cases page |

### 1.3 The rebrand is the biggest wave
Google renamed NotebookLM to **Gemini Notebook** (the app is now on
`notebook.google.com`). Search demand already splits:

- `gemini notebook` 60,500 (KD 51), `gemini notebooks` 60,500, `google gemini notebook` 2,400
- `what is gemini notebook` 1,600 (KD 36), `is gemini notebook free` 320, `how to use gemini notebook` 320
- `notebooklm` is still 1,000,000/month (navigational to Google, KD 64)

Almost every competing guide still says only "NotebookLM". Pages that answer
for **both names** ("Gemini Notebook (formerly NotebookLM)") will capture
the new queries first, while the old name keeps its volume.

### 1.4 What Google's own domain reveals
`notebook.google.com` ranks #1 to #2 for `google notebook` (49,500) and
`what is google notebook` (590). The rest of its ranking keywords are
**public shared notebooks** ranking for spam terms (coupon codes, free
followers, game codes) on Google's DR 85 domain. Two takeaways:

1. Public Gemini Notebook artifacts are indexed and rank. **Do not** do
   parasite SEO with them (it is spam, and Google will clean it up). But a
   few genuinely useful public notebooks (our prompt library, slide-deck
   styles, a "how to use NotebookTools" notebook) with a link back are a
   legitimate, cheap visibility channel.
2. Navigational head terms (`google notebook`, `notebooklm login`, `gemini
   notebook login`) belong to Google. Skip them.

---

## 2. Technical fixes first (week 1)

These multiply everything else. Ordered by impact.

1. **Feature pages are near-duplicates.** Each of the 14 `/features/*`
   pages ships the full text of all 13 demos (~3,200 words) with only one
   panel visible, so Google sees 14 copies of one page and no clear topic per
   URL. Change `scripts/sync-feature-pages.py` to keep only the page's own
   panel in the HTML (the sidebar still links to the others). Give each page
   a unique title, H1, meta description and 300 to 600 words of copy written
   for its keyword (table in §3).
2. **Add "Gemini Notebook" to titles and H1s** wherever the page is about
   the product, keeping "NotebookLM" too. Pattern:
   `Is Gemini Notebook (NotebookLM) Free? What You Get in 2026`.
3. **Structured data:**
   - `SoftwareApplication` and `Offer` on the homepage and every feature page.
   - `HowTo` on how-to posts.
   - `FAQPage` on every post with an FAQ.
   - `BreadcrumbList` everywhere.
   - `dateModified` kept current (Google weights freshness on pricing and limits).
4. **Internal links:**
   - Each blog post links to its matching feature page with keyword anchors (`YouTube to NotebookLM extension`, `export NotebookLM to PDF`).
   - Each feature page links back to 2 or 3 guides.
   - Add a "Related" block to every post (we already have cards; make sure every post has 3 or more).
5. **Sitemap:** include `lastmod`, submit it in Search Console and Bing Webmaster, and ping after every publish.
6. **Pricing and limits content must be current.** Kortex's "free" page wins on freshness. Add a visible "Updated November 2026" line and a changelog box to pricing, free, limits and plans pages, and review monthly.

---

## 3. Page plan: keyword → URL

One primary keyword per URL, with the cluster it should also catch. **Fix**
= existing page to rewrite or expand; **New** = page to create.

### Cluster A: Price and plans (highest volume we can win)
| Status | URL | Primary | Also targets | Target length |
|---|---|---|---|---|
| Fix | `/blog/is-notebooklm-free` | is notebooklm free (2,900) | is gemini notebook free, is google notebooklm free, notebooklm free, notebooklm free vs paid, free for students | 2,000+ words, comparison table, FAQ |
| Fix | `/blog/notebooklm-pricing-plans` | notebooklm pricing (1,300, KD 2) | notebooklm price, cost, how much is notebooklm, plans, plus price, pro price, enterprise pricing | Price table per plan, per region, what each tier unlocks, "how to get it cheaper" |
| New | `/blog/notebooklm-student-discount` | notebooklm student discount (260) | notebooklm for students free, free notebook lm for students | 900 words |
| New | `/blog/notebooklm-plus-vs-free` | notebooklm plus (480) | notebooklm pro vs free, notebooklm premium, tiers | Side-by-side table |

Split pricing from "free" so the two pages don't compete: "free" answers
yes/no and limits; "pricing" answers money and tiers.

### Cluster B: Limits and troubleshooting
| Status | URL | Primary | Also targets |
|---|---|---|---|
| Fix | `/blog/notebooklm-source-limits` → expand into "NotebookLM limits: every limit in one page" | notebooklm limits (390) | limitations, limit, does notebooklm have a limit, how many sources can you add (320, KD 3), audio overview limit, daily limit reset time, limit per day |
| New | `/blog/notebooklm-not-working` | is notebooklm down (320, KD 0) | the system was unable to answer, notebooklm errors, sources not loading |

### Cluster C: Our product (convert directly)
| Status | URL | Primary | Also targets |
|---|---|---|---|
| Fix | `/features/add-youtube` | youtube to notebooklm chrome extension (320, KD 8) | youtube to notebooklm (590), add youtube playlist to notebooklm |
| Fix | `/blog/summarize-youtube-videos-notebooklm` (849 words → 1,800) | youtube to notebooklm (590) | summarize youtube with notebooklm, playlist import |
| Fix | `/features/chat-export` | notebooklm to pdf chrome extension (320, KD 0) | export notebooklm chat, notebooklm to markdown/word |
| New | `/blog/export-notebooklm-to-pdf` | export notebooklm to pdf | save notebooklm notes, download notebooklm chat |
| Fix | `/features/notebooks-hub` | organize notebooklm notebooks | notebooklm folders, notebooklm tags |
| New | `/blog/notebooklm-chrome-extensions` | best notebooklm chrome extensions | notebooklm extension, notebooklm plugin |

The "best NotebookLM Chrome extensions" listicle is a classic
bottom-of-funnel page competitors don't have yet. List ours honestly at #1
with the others, with a comparison table.

### Cluster D: Studio how-tos (KD 0 to 5, rising)
| Status | URL | Primary |
|---|---|---|
| New | `/blog/notebooklm-mind-map` | notebooklm mind map (320, KD 0, CPC $21) |
| New | `/blog/notebooklm-infographic` | notebooklm infographic (260, KD 0) |
| New | `/blog/notebooklm-video-overview` | notebooklm video overview(s) (520 combined, KD 5) |
| Fix | `/blog/notebooklm-slide-prompts` | notebooklm slide deck (210, KD 1) |
| New | `/blog/notebooklm-podcast` | notebooklm podcast (590), podcast generator (390), how long does it take, how to make a podcast |

Each how-to gets: what it is, step-by-step with real screenshots, limits,
5 prompts to get better output, and a CTA to the matching NotebookTools
feature (Studio files, podcast hub, slide prompts).

### Cluster E: Developers (near-zero competition, high CPC)
| Status | URL | Primary | Also |
|---|---|---|---|
| New | `/blog/notebooklm-mcp` | notebooklm mcp (880, KD 1, CPC $17) | notebooklm mcp server, claude notebooklm |
| New | `/blog/notebooklm-api` | notebooklm api (1,000, KD 22) | notebooklm-py (720), notebooklm cli (260), enterprise api |
| New | `/blog/notebooklm-skill` | notebooklm skill (640 combined, KD 8) | claude code notebooklm skill, agent skill |

We already have the know-how (the extension's NotebookLM client and the
Stageshow-style skills). These pages can rank in days and bring a
technical audience that links back.

### Cluster F: Rebrand and explainers
| Status | URL | Primary | Also |
|---|---|---|---|
| New | `/blog/what-is-gemini-notebook` | what is gemini notebook (1,600, KD 36) | gemini notebook vs notebooklm, notebooklm renamed, notebook.google.com |
| New | `/blog/how-to-use-gemini-notebook` | how to use gemini notebook (320, $11.40) | how to use google notebooklm, notebooklm tutorial |
| Fix | `/blog/what-is-notebooklm` | what is notebooklm (5,400, KD 47) | what is google notebooklm, what does notebooklm do, how does notebooklm work |
| New | `/blog/notebooklm-use-cases` | what is notebooklm used for (1,000, KD 32) | notebooklm use cases (170, KD 4), best uses, featured notebooks |
| New | `/blog/notebooklm-updates` | notebooklm updates (520 combined) | what's new, changelog. Update monthly; it earns repeat visits and links |
| New | `/blog/notebooklm-desktop-app` | notebooklm desktop app (320) | for mac (260+260), download (720), app download |

### Cluster G: Comparisons (we have pages; push them up)
| Status | URL | Primary |
|---|---|---|
| Fix | `/blog/best-notebooklm-alternatives` | notebooklm alternatives (1,180 combined, KD 0); add competitors, notebooklm competitors |
| Fix | `/blog/notebooklm-vs-chatgpt` | notebooklm vs chatgpt (260, KD 0) |
| Fix | `/blog/notebooklm-vs-gemini` | notebooklm vs gemini (480); add the rebrand angle ("Gemini app vs Gemini Notebook") |
| New | `/blog/kortex-vs-notebooklm`-style pages | Skip naming Kortex; instead "NotebookTools vs other NotebookLM extensions" inside the extensions listicle |

---

## 4. Content standard for every page

What made Kortex's free page win, plus what it lacks:

- **Answer in the first two lines** ("Yes. Gemini Notebook is free with a Google account; paid plans add …"). This targets the featured snippet.
- **One comparison table** above the fold for any cost/plan/limit question.
- **Real screenshots** of the current UI (Gemini Notebook branding), plus the illustrated thumbnail we already generate (`scripts/blog-thumbs`).
- **FAQ block of 5 to 8 questions** taken from the cluster's long-tail keywords, marked up as `FAQPage`.
- **"Updated <month year>"** line and a short changelog on time-sensitive pages.
- **One clear product CTA** that matches the reader's job (YouTube post → "Import a whole playlist in one click"), not a generic banner.
- **Both names** in the title, H1 or intro, and alt text: Gemini Notebook and NotebookLM.
- 1,500 to 2,500 words for pillar pages, 800 to 1,200 for how-tos. No padding.

---

## 5. Authority (links)

Our DR is low; the KD 0 to 25 targets above need only a handful of good
referring domains.

1. **Directories and launch sites:** Product Hunt, There's An AI For That, Futurepedia, Toolify, AlternativeTo (list as a NotebookLM alternative/companion), Chrome Web Store listing polish. Kortex even ranks a `/directories` page, a sign this channel works in the niche.
2. **Reddit and communities** (`notebooklm reddit` is 590/month): answer questions in r/notebooklm and r/GoogleGeminiAI with genuinely useful posts. Link only when it answers the question.
3. **Developer pages** (MCP, API, skill) get linked from GitHub READMEs, awesome-lists and dev newsletters. Publish a small open-source helper alongside them.
4. **Public Gemini Notebooks:** 3 to 5 genuinely useful public notebooks (prompt library, slide-deck styles, onboarding guide) that link to the site.
5. **Free tools as link magnets:** a "NotebookLM source-limit calculator" or a "slide deck prompt generator" page (it can use the new `slide_deck_prompts` table).

---

## 6. 90-day schedule

**Weeks 1 to 2: foundations and quick wins**
- Technical fixes §2.1 to §2.6 (feature-page de-duplication first).
- Rewrite `notebooklm-pricing-plans` (KD 2 cluster) and `is-notebooklm-free`.
- Expand `notebooklm-source-limits` into the all-limits page.
- New: `notebooklm-mcp`, `notebooklm-skill` (KD 1 to 9).
- Submit sitemap; set up Search Console and Bing; baseline rank tracking for every keyword in §1.2.

**Weeks 3 to 6: product pages and Studio how-tos**
- Rewrite `/features/add-youtube`, `/features/chat-export`, and the YouTube blog post.
- New: `export-notebooklm-to-pdf`, `notebooklm-chrome-extensions`, `notebooklm-mind-map`, `notebooklm-infographic`, `notebooklm-video-overview`, `notebooklm-podcast`.
- Directory submissions (10 or more) and Product Hunt launch.

**Weeks 7 to 12: rebrand and explainers**
- New: `what-is-gemini-notebook`, `how-to-use-gemini-notebook`, `notebooklm-use-cases`, `notebooklm-api`, `notebooklm-desktop-app`, `notebooklm-not-working`, `notebooklm-student-discount`, `notebooklm-plus-vs-free`, `notebooklm-updates` (then monthly).
- Refresh comparisons and alternatives with the rebrand angle.
- Publish the public notebooks and one free tool page.

Pace: about 2 new or rewritten pages a week. That is 24 in 90 days, covering every cluster above.

---

## 7. Targets and how we'll measure

| Metric | Today | 90 days | Tool |
|---|---|---|---|
| Keywords in top 10 | ~0 | 40+ | Rank tracker on the §1.2 list |
| Top 3 for KD ≤ 10 terms (pricing, mcp, alternatives, pdf extension, mind map, infographic, slide deck, sources limit) | 0 | 8 | Same |
| Organic visits / month | baseline | 3,000 to 5,000 | Search Console |
| Organic → Chrome Web Store clicks | baseline | 5% of organic visits | Analytics event on "Add to Chrome" |
| Referring domains | baseline | +25 | Ahrefs / Semrush |

Rough traffic logic: Kortex gets ~220 visits/month from position 1 on
`is notebooklm free` alone. The pricing cluster (2,600 volume at KD 2),
alternatives (1,180 at KD 0), YouTube (910) and MCP/API/skill (3,000+ at
KD ≤ 22) together are worth several thousand visits a month in top-3
positions.

---

## 8. Don'ts

- No parasite SEO with public Gemini Notebooks (§1.4).
- Don't chase `google notebook`, `notebooklm login` or other navigational terms Google owns.
- Don't publish prices or limits we can't source; date-stamp them and review monthly.
- Don't use the Gemini Notebook logo or name in a way that suggests Google endorses NotebookTools; keep "Not affiliated with Google" in the footer.
- No near-duplicate pages (fix the feature pages first; one keyword cluster per URL).
