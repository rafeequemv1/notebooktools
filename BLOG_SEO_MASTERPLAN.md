# NotebookTools Blog SEO Master Plan (A–Z)

> **Version:** 1.2 · June 2026  
> **Domain:** https://www.notebooktools.com  
> **Product:** Free Chrome extension for importing YouTube, webpages, X posts, and highlights into Google NotebookLM  
> **Data source:** `seed_keywords_notebooklm.csv` (99 keywords) + site audit (`site-audit-results.csv`)

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Goals & KPIs](#2-goals--kpis)
3. [Competitive positioning](#3-competitive-positioning)
4. [Keyword universe analysis](#4-keyword-universe-analysis)
5. [What NOT to target](#5-what-not-to-target)
6. [Site architecture & authority map](#6-site-architecture--authority-map)
7. [Topic islands (cluster strategy)](#7-topic-islands-cluster-strategy)
8. [Content inventory — live vs planned](#8-content-inventory--live-vs-planned)
9. [Internal linking architecture](#9-internal-linking-architecture)
10. [On-page SEO standards](#10-on-page-seo-standards)
11. [Technical SEO & AEO](#11-technical-seo--aeo)
12. [Conversion layer (CTAs)](#12-conversion-layer-ctas)
13. [Category hub strategy](#13-category-hub-strategy)
14. [90-day content roadmap](#14-90-day-content-roadmap)
15. [180-day expansion roadmap](#15-180-day-expansion-roadmap)
16. [Site audit remediation log](#16-site-audit-remediation-log)
17. [Measurement & reporting](#17-measurement--reporting)
18. [Production checklist per article](#18-production-checklist-per-article)
19. [Immediate next actions (this week)](#19-immediate-next-actions-this-week)
20. [Strategic summary & biggest gaps](#20-strategic-summary--biggest-gaps)
- [Appendix A — Tier A keyword matrix](#appendix-a--tier-a-keyword-matrix)
- [Appendix B — Full URL map](#appendix-b--full-url-map)
- [Appendix C — Complete 99-keyword seed file map](#appendix-c--complete-99-keyword-seed-file-map)
- [Appendix D — Plan coverage index](#appendix-d--plan-coverage-index)

---

## 19. Immediate next actions (this week)

Priority tasks from the master plan — execute in this order:

| # | Action | Why | Status |
|---|--------|-----|--------|
| 1 | Create `/blog/category/comparisons` hub page | Island 5 needs a dedicated landing page | ✅ Done |
| 2 | Create `/blog/category/students` hub page | Island 3 needs student cluster home | ✅ Done |
| 3 | Publish pillar: `what-is-notebooklm` | 5,400 vol, KD 38 | ✅ Done |
| 4 | Publish: `notebooklm-review-2026` | KD 3 — easiest rank in seed file | ✅ Done |
| 5 | Publish: `notebooklm-infographic-guide` | KD 0, 260 vol | 🔴 Deferred (quality over quantity) |
| 6 | Retrofit internal links on all live posts | 6-link rule + footer template | ✅ Done (Jun 2026 pass) |
| 7 | Add "Popular guides" block to homepage | Link to top Tier A posts from `/` | ✅ Done (3 guides; expand to 6 later) |
| 8 | Submit updated `sitemap.xml` to Google Search Console | Index new URLs after publish | 🔴 Manual — do in GSC |

---

## 20. Strategic summary & biggest gaps

### What we already own

- **Island 5 (Comparisons)** — fully live: vs Gemini, vs ChatGPT, alternatives, comparisons hub
- **Island 1 (Import)** — partially live: import methods + YouTube summarize
- **Island 3 (Study)** — partially live: study workflows, beginner tutorial, students hub
- **Island 4 (Pricing)** — partially live: `is-notebooklm-free` (pricing pillar still needed)
- **Island 6/7 (Education)** — partially live: `what-is-notebooklm`, review, source limits, prompts, tutorial
- **Technical foundation** — www canonicals, hreflang, security headers, 5 category hubs, sidebar CTA, llms.txt, sitemap, internal link pass

### Coverage gap

Roughly **55% of Tier A keywords remain uncovered** (down from ~70%). Of 24 Tier A keywords (KD ≤ 15), **~14 are live or covered**.

### Biggest gaps (ranked by opportunity)

| Rank | Gap | Top keyword | Volume | KD | Island | Status |
|------|-----|-------------|--------|-----|--------|--------|
| 1 | Education pillar | what is notebooklm | 5,400 | 38 | 6/7 | ✅ Live (expand to 3k+ words later) |
| 2 | Pricing cluster | is notebooklm free | 2,400 | 45 | 4 | ✅ Partial — need `notebooklm-pricing-plans` |
| 3 | Student pillar | notebooklm for students | 480 | 38 | 3 | 🔴 Need dedicated pillar post |
| 4 | Features/outputs | notebooklm infographic | 260 | 0 | 6 | 🔴 Open |
| 5 | YouTube outputs | notebooklm video overview | 480 | 19 | 2 | 🔴 Open |
| 6 | Category hubs | comparisons, students | — | — | 5, 3 | ✅ Done |
| 7 | Cross-island linking | (structural) | — | — | All | ✅ Footer pass done |

### Authority flow (one line)

```
Homepage → Blog hub → Category islands → Pillars → Clusters → NotebookTools CTA
```

Every new post must link **up** (category/pillar), **sideways** (siblings), and **across** (one bridge island).

---

## 1. Executive summary

NotebookTools cannot win the head term **notebooklm** (823,000 monthly searches, KD 61) or Google's navigational queries (`login`, `download`, `sign in`). Google owns those SERPs.

Our SEO moat is:

- **Workflow & import intent** — users who already use NotebookLM and need faster ways to add sources
- **Low-KD informational keywords** — KD 0–15 with 210–590 monthly volume
- **High-CPC commercial keywords** — pricing, prompts, alternatives ($6–$22 CPC signals buyer intent)
- **Comparison content** — NotebookLM vs Gemini, vs ChatGPT, vs alternatives

### Strategic formula

```
Organic traffic = Topic Islands × Pillar Authority × Internal Links × Product CTAs
```

Every blog post must:

1. Rank for a specific keyword cluster
2. Link up to its island pillar/category
3. Link sideways to 2–3 sibling posts
4. Bridge to one adjacent island
5. Convert readers to the Chrome Web Store

---

## 2. Goals & KPIs

### 6-month targets

| Metric | Baseline (Jun 2026) | 3-month | 6-month |
|--------|---------------------|---------|---------|
| Indexed blog URLs | 9 articles | 13 | 35+ |
| Category hub pages | 3 | 5 | 6 |
| Pillar pages (3,000+ words) | 0 | 1 | 5 |
| Tier A keywords in top 20 | ~7 | 15 | 25+ |
| Organic blog sessions/month | — | 2,000 | 5,000+ |
| Chrome Web Store clicks from blog | — | track | +30% MoM |
| Avg internal links per article | 5–8 | 8 | 10+ |
| Domain rating (Ahrefs/SEMrush) | new | 15 | 25 |

### North-star metric

**Qualified installs from organic blog traffic** — tracked via UTM parameters on Chrome Web Store links (optional Phase 2).

---

## 3. Competitive positioning

### Who we are in the SERP

| Competitor type | Examples | Our angle |
|-----------------|----------|-----------|
| Google official | notebooklm.google.com | We don't compete — we complement |
| Generic AI blogs | HubSpot, Zapier | We're NotebookLM-specific, practitioner depth |
| Extension competitors | Various clipper tools | We're purpose-built for NotebookLM import |
| Reddit/UGC | r/notebooklm | We publish definitive guides, not threads |

### Unique value proposition in content

> NotebookTools is the fastest way to get YouTube videos, webpages, X posts, and highlighted text into NotebookLM — free, no new account, uses your Google sign-in.

Every island should reinforce this without being spammy.

---

## 4. Keyword universe analysis

### Tier classification

| Tier | KD range | Volume | Strategy | Count in seed file |
|------|----------|--------|----------|-------------------|
| **A — Quick wins** | 0–15 | 210–590 | Publish immediately | ~25 keywords |
| **B — Authority builders** | 16–40 | 260–5,400 | Pillar + cluster | ~35 keywords |
| **C — Head / navigational** | 41–71 | 320–823,000 | Skip or year-2 only | ~39 keywords |

### Highest-value keywords by CPC (commercial intent)

| Keyword | Volume | CPC | KD | Priority |
|---------|--------|-----|-----|----------|
| notebooklm-py | 590 | $22.12 | 0 | Phase 3 (dev) |
| notebooklm prompts | 210 | $21.10 | 12 | ✅ Live |
| notebooklm prompt | 210 | $21.10 | 14 | ✅ Covered in prompts post |
| notebooklm enterprise | 390 | $11.79 | 32 | Phase 2 |
| how much does notebooklm cost | 210 | $10.22 | 16 | Phase 1 |
| notebooklm pro | 1,300 | $9.36 | 43 | Phase 1 |
| is google notebooklm free | 260 | $9.09 | 51 | Phase 1 |
| notebooklm vs gemini | 590 | $8.88 | 0 | ✅ Live |
| notebooklm mcp | 590 | $8.03 | 9 | Phase 3 |
| notebooklm for studying | 480 | $8.26 | 21 | ✅ Partial (study post) |
| is notebooklm free | 2,400 | $7.89 | 45 | Phase 1 pillar |
| notebooklm student discount | 210 | $7.09 | 13 | Phase 2 |

### Highest-volume winnable keywords

| Keyword | Volume | KD | Status |
|---------|--------|-----|--------|
| what is notebooklm | 5,400 | 38 | ✅ Live |
| is notebooklm free | 2,400 | 45 | ✅ Live |
| what is notebooklm used for | 1,000 | 23 | 🔴 Not live |
| notebooklm pricing | 1,300 | 30 | 🔴 Not live |
| notebooklm alternative | 590 | 0 | ✅ Live |
| notebooklm vs gemini | 590 | 0 | ✅ Live |
| youtube to notebooklm | 480 | 20 | ✅ Live |
| notebooklm for students | 480 | 38 | 🔴 Not live |
| notebooklm vs chatgpt | 390 | 0 | ✅ Live |
| notebooklm review | 320 | 3 | ✅ Live |

---

## 5. What NOT to target

| Keyword | Volume | KD | Why skip |
|---------|--------|-----|----------|
| notebooklm | 823,000 | 61 | Google SERP dominance |
| notebooklm login / sign in | 9,900 / 590 | 61–62 | Navigational — zero conversion |
| notebooklm google com | 2,400 | 59 | Navigational |
| notebooklm download / desktop app | 590 / 320 | 46–71 | Google product pages |
| notebooklm logo / icon | 1,300 / 210 | 32–35 | Asset queries |
| notebooklm reddit | 720 | 2 | UGC — thin content risk |
| is notebooklm down | 260 | 9 | Ephemeral, not evergreen |
| www notebooklm / notebooklm com | 480 / 260 | 60–71 | Navigational |

**Rule:** If intent is `navigational` and the query contains `login`, `download`, `logo`, or `google.com` — do not create content.

---

## 6. Site architecture & authority map

### Layer model

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — COMMERCIAL                                       │
│  / (homepage) · /#install · Chrome Web Store listing        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  LAYER 2 — BLOG HUB                                         │
│  /blog — ItemList schema, FAQ, all posts indexed            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  LAYER 3 — CATEGORY ISLANDS (hub pages)                     │
│  /blog/category/youtube                                     │
│  /blog/category/notebooklm                                  │
│  /blog/category/product                                     │
│  /blog/category/comparisons  ← CREATE                       │
│  /blog/category/students     ← CREATE                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  LAYER 4 — PILLAR PAGES (3,000–4,000 words)                │
│  One definitive guide per island                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  LAYER 5 — CLUSTER POSTS (1,200–2,000 words)                │
│  Long-tail keyword targets                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  LAYER 6 — CONVERSION                                       │
│  Sidebar CTA · footer badge · what-is-notebooktools         │
└─────────────────────────────────────────────────────────────┘
```

### Page type responsibilities

| Page type | URL pattern | SEO job | Conversion job |
|-----------|-------------|---------|----------------|
| Homepage | `/` | Brand + head terms (secondary) | Primary install CTA |
| Blog hub | `/blog` | Topical authority index | Link to top guides |
| Category hub | `/blog/category/*` | Island landing, unique H1/meta | Curated post cards |
| Pillar | `/blog/[broad-topic]` | Rank for broad KW | Soft CTA in intro + sidebar |
| Cluster | `/blog/[long-tail]` | Rank for specific KW | Sidebar CTA + footer |
| Product | `/blog/what-is-notebooktools` | Product-aware queries | Hard CTA |
| Support | `/support` | Trust, troubleshooting | Contact + guide links |
| Privacy | `/privacy` | Trust signals | Minimal |

---

## 7. Topic islands (cluster strategy)

Eight islands. Each island = **1 pillar + 4–8 cluster posts + 1 category hub section**.

---

### Island 1 — Import & Extension ⭐ (highest commercial fit)

**Pillar to create:** `Complete Guide to Importing Content into NotebookLM`  
**Category:** `/blog/category/notebooklm` (existing)  
**Product fit:** Maximum — every post should CTA to Chrome Web Store

| Priority | Slug | Target keyword | Vol | KD | Status |
|----------|------|----------------|-----|-----|--------|
| P0 | `best-ways-import-content-notebooklm` | youtube to notebooklm chrome extension | 210 | 8 | ✅ Live |
| P0 | `summarize-youtube-videos-notebooklm` | youtube to notebooklm | 480 | 20 | ✅ Live |
| P1 | `notebooklm-chrome-extension-guide` | notebooklm chrome extension | 170 | 40 | 🔴 Plan |
| P1 | `notebooklm-web-importer-how-to` | notebooklm web importer | 210 | 4 | 🔴 Plan |
| P2 | `notebooklm-to-pdf-extension` | notebooklm to pdf chrome extension | 260 | 10 | 🔴 Plan |
| P2 | `import-x-threads-notebooklm` | (derived) | — | — | 🔴 Plan |

---

### Island 2 — YouTube & Video

**Pillar:** Expand `summarize-youtube-videos-notebooklm` or create `notebooklm-youtube-complete-guide`  
**Category:** `/blog/category/youtube`

| Priority | Slug | Target keyword | Vol | KD | Status |
|----------|------|----------------|-----|-----|--------|
| P0 | `summarize-youtube-videos-notebooklm` | youtube to notebooklm | 480 | 20 | ✅ Live |
| P1 | `notebooklm-video-overview-guide` | notebooklm video overview | 480 | 19 | 🔴 Plan |
| P1 | `notebooklm-podcast-generator-guide` | notebooklm podcast generator | 480 | 24 | 🔴 Plan |
| P2 | `notebooklm-audio-overview-explained` | notebooklm podcast | 720 | 38 | 🔴 Plan |

---

### Island 3 — Study & Students

**Pillar to create:** `NotebookLM for Students: The Complete Guide`  
**Category:** `/blog/category/students` ✅ Live

| Priority | Slug | Target keyword | Vol | KD | Status |
|----------|------|----------------|-----|-----|--------|
| P0 | `how-to-use-notebooklm-to-study` | how to use notebooklm to study | 210 | 9 | ✅ Live |
| P1 | `notebooklm-for-students` | notebooklm for students | 480 | 38 | 🔴 Plan |
| P1 | `notebooklm-student-discount` | notebooklm student discount | 210 | 13 | 🔴 Plan |
| P2 | `notebooklm-exam-prep-workflow` | (derived) | — | — | 🔴 Plan |
| P2 | `notebooklm-free-for-students` | notebooklm free for students | 170 | 27 | 🔴 Plan |

---

### Island 4 — Pricing & Plans (high CPC)

**Pillar to create:** `NotebookLM Pricing Explained: Free vs Plus vs Pro`  
**Category:** `/blog/category/notebooklm`

| Priority | Slug | Target keyword | Vol | KD | Status |
|----------|------|----------------|-----|-----|--------|
| P1 | `is-notebooklm-free` | is notebooklm free | 2,400 | 45 | ✅ Live |
| P1 | `notebooklm-pricing-plans` | notebooklm pricing / plans | 1,300 | 30 | 🔴 Plan |
| P2 | `notebooklm-plus-vs-pro` | notebooklm plus / pro | 880–1,300 | 43–56 | 🔴 Plan |
| P2 | `how-much-does-notebooklm-cost` | how much does notebooklm cost | 210 | 16 | 🔴 Plan |
| P3 | `notebooklm-enterprise-pricing` | notebooklm enterprise | 390 | 32 | 🔴 Plan |

**Angle:** Free NotebookLM + free NotebookTools extension = compelling story.

---

### Island 5 — Comparisons

**Pillar:** Category page `/blog/category/comparisons` ✅ Live  
**Cross-links:** All comparison posts link to each other

| Priority | Slug | Target keyword | Vol | KD | Status |
|----------|------|----------------|-----|-----|--------|
| P0 | `notebooklm-vs-gemini` | notebooklm vs gemini | 590 | 0 | ✅ Live |
| P0 | `notebooklm-vs-chatgpt` | notebooklm vs chatgpt | 390 | 0 | ✅ Live |
| P0 | `best-notebooklm-alternatives` | notebooklm alternatives | 590 | 0 | ✅ Live |
| P1 | `gemini-vs-notebooklm` | gemini vs notebooklm | 210 | 6 | 🔴 Plan (canonical to vs-gemini or unique angle) |
| P2 | `notebooklm-vs-perplexity` | (from alternatives) | — | — | 🔴 Plan |
| P2 | `notebooklm-vs-notion-ai` | (from alternatives) | — | — | 🔴 Plan |

---

### Island 6 — Features & AI Outputs

**Pillar to create:** `NotebookLM Features Explained: What It Can Do`  
**Category:** `/blog/category/notebooklm`

| Priority | Slug | Target keyword | Vol | KD | Status |
|----------|------|----------------|-----|-----|--------|
| P1 | `what-is-notebooklm-used-for` | what is notebooklm used for | 1,000 | 23 | 🔴 Plan |
| P1 | `what-is-notebooklm` | what is notebooklm | 5,400 | 38 | ✅ Live |
| P2 | `notebooklm-mind-map-guide` | notebooklm mind map | 390 | 26 | 🔴 Plan |
| P2 | `notebooklm-infographic-guide` | notebooklm infographic | 260 | 0 | 🔴 Plan |
| P2 | `notebooklm-slide-deck-guide` | notebooklm slide deck | 170 | 27 | 🔴 Plan |
| P3 | `notebooklm-use-cases` | notebooklm use cases | 260 | 22 | 🔴 Plan |

---

### Island 7 — Education & Trust

**Pillar to create:** `How NotebookLM Works: A Beginner's Guide`  
**Category:** `/blog/category/notebooklm`

| Priority | Slug | Target keyword | Vol | KD | Status |
|----------|------|----------------|-----|-----|--------|
| P0 | `notebooklm-source-limits` | notebooklm source limit / limits | 210–320 | 8–17 | ✅ Live |
| P0 | `best-notebooklm-prompts` | notebooklm prompts | 210 | 12 | ✅ Live |
| P1 | `notebooklm-tutorial-beginners` | notebooklm tutorial | 320 | 14 | ✅ Live |
| P1 | `how-does-notebooklm-work` | how does notebooklm work | 590 | 41 | 🔴 Plan |
| P1 | `notebooklm-review-2026` | notebooklm review | 320 | 3 | ✅ Live |
| P2 | `is-notebooklm-good` | is notebooklm good | 210 | 27 | 🔴 Plan |
| P2 | `is-notebooklm-private` | is notebooklm private | 170 | 25 | 🔴 Plan |

---

### Island 8 — Developer / Technical (Phase 3)

**Only if pursuing technical authority.**

| Slug | Target keyword | Vol | KD | CPC |
|------|----------------|-----|-----|-----|
| `notebooklm-api-overview` | notebooklm api | 1,300 | 37 | $5.84 |
| `notebooklm-mcp-guide` | notebooklm mcp | 590 | 9 | $8.03 |
| `notebooklm-py-intro` | notebooklm-py | 590 | 0 | $22.12 |
| `notebooklm-cli-tools` | notebooklm cli | 210 | 6 | $0 |

---

## 8. Content inventory — live vs planned

### Live articles (13)

| # | Slug | Type | Primary keyword | Vol | KD |
|---|------|------|-----------------|-----|-----|
| 1 | `what-is-notebooklm` | Pillar | what is notebooklm | 5,400 | 38 |
| 2 | `is-notebooklm-free` | Guide | is notebooklm free | 2,400 | 45 |
| 3 | `notebooklm-tutorial-beginners` | Guide | notebooklm tutorial | 320 | 14 |
| 4 | `notebooklm-review-2026` | Review | notebooklm review | 320 | 3 |
| 5 | `notebooklm-vs-gemini` | Comparison | notebooklm vs gemini | 590 | 0 |
| 6 | `notebooklm-vs-chatgpt` | Comparison | notebooklm vs chatgpt | 390 | 0 |
| 7 | `best-notebooklm-alternatives` | Listicle | notebooklm alternatives | 590 | 0 |
| 8 | `best-notebooklm-prompts` | Listicle | notebooklm prompts | 210 | 12 |
| 9 | `how-to-use-notebooklm-to-study` | Listicle | how to use notebooklm to study | 210 | 9 |
| 10 | `notebooklm-source-limits` | Listicle | notebooklm source limit | 210 | 8 |
| 11 | `best-ways-import-content-notebooklm` | Listicle | youtube to notebooklm chrome extension | 210 | 8 |
| 12 | `summarize-youtube-videos-notebooklm` | Guide | youtube to notebooklm | 480 | 20 |
| 13 | `what-is-notebooktools` | Product | (brand) | — | — |

### Live hub pages (6)

| URL | Purpose |
|-----|---------|
| `/blog` | Main blog index |
| `/blog/category/youtube` | YouTube island hub |
| `/blog/category/notebooklm` | NotebookLM tips hub |
| `/blog/category/product` | Product island hub |
| `/blog/category/comparisons` | Comparisons island hub |
| `/blog/category/students` | Students island hub |

### Next articles (Phase 1 remaining)

1. `notebooklm-pricing-plans` — 1,300 vol, KD 30
2. `what-is-notebooklm-used-for` — 1,000 vol, KD 23
3. `notebooklm-for-students` — 480 vol, KD 38
4. `notebooklm-infographic-guide` — 260 vol, KD 0
5. `notebooklm-chrome-extension-guide` — 170 vol, KD 40
6. `notebooklm-web-importer-how-to` — 210 vol, KD 4
7. `notebooklm-video-overview-guide` — 480 vol, KD 19

---

## 9. Internal linking architecture

### The 6-link rule (every article)

Every cluster post must contain:

| # | Link type | Target | Anchor style |
|---|-----------|--------|--------------|
| 1 | **UP** | Category hub | "NotebookLM tips", "YouTube guides" |
| 2 | **UP** | Pillar page (when exists) | Descriptive partial match |
| 3 | **SIDE** | Sibling post #1 | Contextual in body |
| 4 | **SIDE** | Sibling post #2 | Contextual in body |
| 5 | **BRIDGE** | Adjacent island post | Natural cross-topic |
| 6 | **DOWN** | Product/CTA | Chrome Web Store or what-is-notebooktools |

Plus footer block:

```
Related: [sibling] · [sibling] · [bridge] · [comparison] · Support
```

### Hub-and-spoke diagram

```
                    ┌─────────────────┐
                    │  PILLAR PAGE    │
                    │  (broad keyword)│
                    └────────┬────────┘
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │  Cluster A  │◄─┤  Cluster B  ├─►│  Cluster C  │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                │                │
           └────────────────┼────────────────┘
                            ▼
                    ┌─────────────────┐
                    │ PRODUCT / CTA   │
                    │ Chrome Store    │
                    └─────────────────┘
```

### Cross-island bridge map

| From island | To island | Bridge post | Anchor text example |
|-------------|-----------|-------------|---------------------|
| Import | YouTube | `summarize-youtube-videos-notebooklm` | "import YouTube videos" |
| YouTube | Import | `best-ways-import-content-notebooklm` | "fastest import methods" |
| Study | Import | `how-to-use-notebooklm-to-study` → import guide | "add lecture videos" |
| Study | Prompts | study post → prompts post | "best prompts for exam prep" |
| Pricing | Product | pricing pillar → what-is-notebooktools | "free extension" |
| Comparisons | Features | vs-gemini → what-is-notebooklm-used-for | "what NotebookLM actually does" |
| Features | Prompts | features → best-notebooklm-prompts | "prompts to try" |
| Education | Limits | tutorial → source-limits | "source caps" |
| All islands | Comparisons | footer link | "NotebookLM vs ChatGPT" |

### Sitewide link matrix

| Source page | Must link to |
|-------------|--------------|
| **Homepage** | `/blog`, top 3 posts (vs-gemini, prompts, summarize-youtube), `/#install` |
| **Blog hub** | All 5 category hubs, latest 8 posts |
| **Category hub** | Its pillar (when live), all cluster cards, 1 adjacent category |
| **Article** | Category + 3 related + sidebar CTA + support |
| **Support** | Import guide, study guide, pricing (when live), top 4 blog posts |
| **Privacy** | Support only |

### Anchor text guidelines

- **60%** partial match — "summarize YouTube in NotebookLM"
- **30%** branded — "NotebookTools", "our import guide"
- **10%** exact match — "notebooklm vs gemini" (avoid over-optimization)
- Never more than **one exact-match anchor** to the same URL per page

---

## 10. On-page SEO standards

### Title tag

- Primary keyword near the front
- Brand suffix: `| NotebookTools` (for non-branded queries)
- **≤ 60 characters** / ≤ 561px
- Unique across site

**Templates:**

```
[Listicle]  7 Best NotebookLM Alternatives (2026) | NotebookTools
[Comparison] NotebookLM vs Gemini: Which to Use? | NotebookTools
[Guide]      How to Summarize YouTube in NotebookLM
[Pillar]     What Is NotebookLM? Complete Guide (2026)
```

### Meta description

- Primary keyword in first 120 characters
- Include a benefit + soft CTA
- **≤ 155 characters** / ≤ 985px
- Unique across site

### H1

- One per page
- Matches search intent (not identical to title)
- **≤ 70 characters**

### URL slug

- Format: `notebooklm-[topic]` or `best-[topic]-notebooklm`
- Lowercase, hyphens only
- No dates, no stop words unless needed

### Word count targets

| Type | Min words | Ideal |
|------|-----------|-------|
| Pillar | 3,000 | 3,500–4,500 |
| Listicle | 1,200 | 1,500–2,000 |
| Comparison | 1,500 | 2,000–2,500 |
| Guide | 1,200 | 1,800–2,500 |
| Product | 800 | 1,000–1,500 |

### Heading structure

```
H1 — Primary topic (one only)
  H2 — Major sections / listicle items
    H3 — Subsections within items
  H2 — FAQ section
```

### Image SEO

- Descriptive `alt` text with keyword variant
- `width` and `height` attributes set
- Prefer WebP/PNG under 100KB
- OG image: `/assets/og-image.png` (1200×630)

### Schema markup (required)

Every article:

```json
{
  "@graph": [
    { "@type": "BlogPosting", ... },
    { "@type": "BreadcrumbList", ... },
    { "@type": "FAQPage", "mainEntity": [3-5 questions] }
  ]
}
```

Category hubs:

```json
{ "@type": "CollectionPage", "isPartOf": { "@type": "Blog" } }
```

Blog index:

```json
{ "@type": "Blog" }, { "@type": "ItemList" }, { "@type": "FAQPage" }
```

---

## 11. Technical SEO & AEO

### Domain & canonicals

- **Primary domain:** `https://www.notebooktools.com`
- Apex `notebooklm.com` → 301 to www (configured in `vercel.json`)
- Every page: self-referencing canonical on www
- `hreflang="en"` + `hreflang="x-default"` on all pages

### Security headers (Vercel)

Configured in `vercel.json`:

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Sitemap

`https://www.notebooktools.com/sitemap.xml`

- Update within 24 hours of publishing new content
- Priority: homepage 1.0 → comparisons 0.95 → clusters 0.85–0.9 → support 0.6
- Submit to Google Search Console after each batch

### robots.txt

- Allow all user-agents
- Explicitly allow AI crawlers: GPTBot, ChatGPT-User, Google-Extended, ClaudeBot, PerplexityBot, Applebot-Extended
- Point to sitemap

### llms.txt (AEO)

`https://www.notebooktools.com/llms.txt`

- Update with every new article (URL + one-line summary)
- Structure: What it does → Key facts → Pages → Common questions → Contact
- Optimized for answer-engine citation

### Clean URLs

- Vercel `cleanUrls: true` — no `.html` in public URLs
- Category pages at `/blog/category/[name]` not `?category=`
- Legacy `?category=` URLs 301 redirect to clean paths

### Core Web Vitals targets

| Metric | Target |
|--------|--------|
| LCP | < 2.5s |
| INP | < 200ms |
| CLS | < 0.1 |

**Notes:** Static HTML, minimal JS, sticky sidebar uses CSS only, fonts preconnected.

---

## 12. Conversion layer (CTAs)

### CTA hierarchy

| Level | Placement | Use |
|-------|-----------|-----|
| **L1 — Sidebar** | Sticky right card on all article pages | Primary install driver |
| **L2 — Header** | Chrome Web Store badge | Always visible on desktop |
| **L3 — Footer** | Article footer badge + related links | End-of-read conversion |
| **L4 — In-content** | Contextual mention of NotebookTools | 1–2 per post max |
| **L5 — Homepage** | Hero + install section | Brand traffic |

### Sidebar CTA card (live on all 9 articles)

```
┌────────────────────────────┐
│ [NotebookTools logo]       │
│ Import to NotebookLM       │
│ in one click               │
│                            │
│ ✓ YouTube watch-page btn   │
│ ✓ Right-click highlights   │
│ ✓ Google sign-in           │
│                            │
│ [Chrome Web Store badge]   │
│ Free · No extra account    │
└────────────────────────────┘
```

### CTA rules by island

| Island | CTA intensity |
|--------|-----------------|
| Import & Extension | Hard — extension is the solution |
| YouTube | Hard — one-click import is the hook |
| Study | Medium — extension helps with lecture imports |
| Comparisons | Soft — mention at end, focus on objectivity |
| Pricing | Medium — "both are free" + extension is free |
| Features | Soft — educational first |
| Developer | Minimal — technical audience, link only |

---

## 13. Category hub strategy

### Existing hubs

| Hub | URL | Posts | Action |
|-----|-----|-------|--------|
| YouTube guides | `/blog/category/youtube` | 1 | Add video overview, podcast posts |
| NotebookLM tips | `/blog/category/notebooklm` | 7 | Add pricing, features, education posts |
| Product | `/blog/category/product` | 1 | Keep minimal |

### Hubs to create

| Hub | URL | Purpose |
|-----|-----|---------|
| **Comparisons** | `/blog/category/comparisons` | vs-gemini, vs-chatgpt, alternatives, future vs-perplexity |
| **Students** | `/blog/category/students` | study, for-students, student-discount, exam-prep |

### Category hub page requirements

Each hub must have:

- Unique `<title>` and meta description (fixes duplicate title audit issue)
- Unique H1 (not "Blog")
- 100+ word intro paragraph (fixes low word count)
- Curated card list of all island posts
- BreadcrumbList schema
- Sidebar with link to adjacent categories
- `hreflang` tags

---

## 14. 90-day content roadmap

### Phase 1 — Weeks 1–4: Fill critical gaps

| Week | Articles | Combined volume | Avg KD |
|------|----------|-----------------|--------|
| 1 | `what-is-notebooklm` (pillar), `notebooklm-review-2026` | 5,720 | 20 |
| 2 | `is-notebooklm-free`, `notebooklm-pricing-plans` | 3,700 | 38 |
| 3 | `notebooklm-tutorial-beginners`, `notebooklm-infographic-guide` | 580 | 7 |
| 4 | `notebooklm-for-students`, `notebooklm-video-overview-guide` | 960 | 29 |

**Also:** Create `/blog/category/comparisons` and `/blog/category/students`.

### Phase 2 — Weeks 5–8: Pillars + bridges

| Article | Island |
|---------|--------|
| `what-is-notebooklm-used-for` | Features |
| `notebooklm-chrome-extension-guide` | Import |
| `notebooklm-web-importer-how-to` | Import |
| `notebooklm-mind-map-guide` | Features |
| `notebooklm-podcast-generator-guide` | YouTube |
| `gemini-vs-notebooklm` | Comparisons |

### Phase 3 — Weeks 9–12: Long-tail + authority

| Article | Island |
|---------|--------|
| `how-does-notebooklm-work` | Education |
| `notebooklm-use-cases` | Features |
| `notebooklm-student-discount` | Students |
| `notebooklm-vs-perplexity` | Comparisons |
| `notebooklm-mcp-guide` | Developer |
| `is-notebooklm-private` | Education |

### Publishing cadence

- **Minimum:** 2 posts/week
- **Ideal:** 3 posts/week (1 listicle + 1 comparison/guide + 1 long-tail)
- **Batch:** Update sitemap + llms.txt + blog index + category hub after each publish

---

## 15. 180-day expansion roadmap

### Months 4–6

- Complete all 8 islands to 5+ posts each
- Launch developer island (API, MCP, notebooklm-py)
- Build interactive tools (prompt generator embed — future)
- Pursue backlinks: guest posts on productivity blogs, Reddit r/notebooklm engagement
- Update all 2026 posts to 2027 in Q1 following year

### Link building targets

| Source type | Approach |
|-------------|----------|
| Productivity blogs | Guest post: "How I use NotebookLM for research" |
| YouTube creators | Reach out to NotebookLM tutorial channels |
| Reddit r/notebooklm | Answer questions, link to relevant guides |
| HARO / Qwoted | Respond to journalist queries about AI research tools |
| Chrome Web Store | Reviews mentioning blog guides |

---

## 16. Site audit remediation log

Issues from `site-audit-results.csv` and fix status:

| Issue | Status | Fix |
|-------|--------|-----|
| Not self-referencing canonical (www vs non-www) | ✅ Fixed | All canonicals → www; apex redirect |
| Duplicate titles on `?category=` URLs | ✅ Fixed | Clean URL category pages |
| Duplicate H1/H1 on filtered blog | ✅ Fixed | Removed `blog.js` query filtering |
| Broken JavaScript on category URLs | ✅ Fixed | Static category pages |
| Missing security headers | ✅ Fixed | `vercel.json` headers |
| Missing hreflang | ✅ Fixed | en + x-default on all pages |
| Missing OG/Twitter on blog/privacy | ✅ Fixed | Full social tags |
| Missing alt text on logos | ✅ Fixed | Descriptive alt + dimensions |
| Low word count on blog index | ✅ Fixed | Expanded intro + FAQ schema |
| Support page only 1 incoming link | ✅ Fixed | Cross-links from all articles |
| Title/description too long | ✅ Fixed | Trimmed on homepage, support, articles |
| URL parameters (`?category=`) | ✅ Fixed | 301 to `/blog/category/*` |
| Missing meta keywords (blog, privacy) | ✅ Fixed | Added where relevant |
| Missing llms.txt coverage | ✅ Fixed | Expanded for AEO |

---

## 17. Measurement & reporting

### Google Search Console — weekly

- [ ] Impressions & clicks by page
- [ ] Average position for Tier A keywords
- [ ] New pages indexed
- [ ] Crawl errors
- [ ] Core Web Vitals

### Monthly report template

```markdown
## Month: [DATE]

### Traffic
- Organic sessions: 
- Blog sessions: 
- Top 5 landing pages:

### Rankings (Tier A)
| Keyword | Position | Change |
|---------|----------|--------|

### Content shipped
- New posts: 
- Updated posts: 

### Conversions
- Chrome Web Store clicks (from blog): 

### Next month priorities
1. 
2. 
3. 
```

### Keyword tracking list (monitor weekly)

Priority keywords to track in GSC / Ahrefs:

1. notebooklm vs gemini
2. notebooklm vs chatgpt
3. notebooklm alternative / alternatives
4. notebooklm prompts
5. youtube to notebooklm
6. how to use notebooklm to study
7. notebooklm source limit
8. what is notebooklm
9. is notebooklm free
10. notebooklm pricing

---

## 18. Production checklist per article

Copy this for every new post:

```markdown
## Pre-publish

- [ ] Keyword research confirmed (vol, KD, intent)
- [ ] Slug matches keyword pattern
- [ ] Title ≤ 60 chars, unique
- [ ] Meta description ≤ 155 chars, unique
- [ ] H1 ≤ 70 chars, unique
- [ ] Word count meets minimum for type
- [ ] 5+ internal links (up, side, bridge, CTA)
- [ ] Breadcrumb matches island
- [ ] FAQ section (3–5 questions)
- [ ] BlogPosting + BreadcrumbList + FAQPage schema
- [ ] Canonical = www.notebooktools.com/blog/[slug]
- [ ] hreflang en + x-default
- [ ] OG + Twitter cards complete
- [ ] Images have alt + dimensions
- [ ] Sidebar CTA card present
- [ ] Footer related links present
- [ ] Chrome Web Store links use .chrome-store-link class

## Post-publish

- [ ] Added to /blog index cards
- [ ] Added to relevant category hub
- [ ] Added to sitemap.xml
- [ ] Added to llms.txt
- [ ] Updated ItemList schema on blog index
- [ ] Internal links added FROM 2+ existing posts TO new post
- [ ] Submitted URL to GSC for indexing
- [ ] Shared on X / LinkedIn (optional)
```

---

## Appendix A — Tier A keyword matrix

All keywords with KD ≤ 15 from seed file:

| Keyword | Vol | CPC | KD | Intent | Target slug | Status |
|---------|-----|-----|-----|--------|-------------|--------|
| notebooklm alternative | 590 | $6.74 | 0 | info | best-notebooklm-alternatives | ✅ |
| notebooklm alternatives | 590 | $6.74 | 0 | info | best-notebooklm-alternatives | ✅ |
| notebooklm-py | 590 | $22.12 | 0 | nav | notebooklm-py-intro | 🔴 |
| notebooklm vs gemini | 590 | $8.88 | 0 | info | notebooklm-vs-gemini | ✅ |
| notebooklm vs chatgpt | 390 | $0 | 0 | info | notebooklm-vs-chatgpt | ✅ |
| notebooklm infographic | 260 | $6.91 | 0 | nav | notebooklm-infographic-guide | 🔴 |
| notebooklm plan | 170 | $4.95 | 0 | info | notebooklm-pricing-plans | 🔴 |
| notebooklm slide | 170 | $5.07 | 0 | nav | notebooklm-slide-deck-guide | 🔴 |
| notebooklm mcp | 590 | $8.03 | 9 | nav | notebooklm-mcp-guide | 🔴 |
| how to use notebooklm to study | 210 | $7.60 | 9 | info | how-to-use-notebooklm-to-study | ✅ |
| youtube to notebooklm chrome extension | 210 | $0 | 8 | nav | best-ways-import-content-notebooklm | ✅ |
| notebooklm source limit | 210 | $0 | 8 | info | notebooklm-source-limits | ✅ |
| notebooklm web importer | 210 | $0 | 4 | nav | notebooklm-web-importer-how-to | 🔴 |
| gemini vs notebooklm | 210 | $0 | 6 | commercial | gemini-vs-notebooklm | 🔴 |
| notebooklm cli | 210 | $0 | 6 | nav | notebooklm-cli-tools | 🔴 |
| notebooklm review | 320 | $5.31 | 3 | info | notebooklm-review-2026 | ✅ |
| notebooklm reddit | 720 | $0 | 2 | nav | SKIP | — |
| notebooklm prompts | 210 | $21.10 | 12 | nav | best-notebooklm-prompts | ✅ |
| notebooklm prompt | 210 | $21.10 | 14 | nav | best-notebooklm-prompts | ✅ |
| how many sources can you add to notebooklm | 210 | $0 | 12 | info | notebooklm-source-limits | ✅ |
| does notebooklm have a limit | 210 | $0 | 15 | info | notebooklm-source-limits | ✅ |
| notebooklm student discount | 210 | $7.09 | 13 | commercial | notebooklm-student-discount | 🔴 |
| notebooklm tutorial | 320 | $5.79 | 14 | nav | notebooklm-tutorial-beginners | ✅ |
| notebooklm limits | 320 | $0 | 17 | info | notebooklm-source-limits | ✅ |

---

## Appendix B — Full URL map

### Live

| URL | Type |
|-----|------|
| https://www.notebooktools.com/ | Homepage |
| https://www.notebooktools.com/blog | Blog hub |
| https://www.notebooktools.com/blog/category/youtube | Category |
| https://www.notebooktools.com/blog/category/notebooklm | Category |
| https://www.notebooktools.com/blog/category/product | Category |
| https://www.notebooktools.com/blog/category/comparisons | Category |
| https://www.notebooktools.com/blog/category/students | Category |
| https://www.notebooktools.com/blog/what-is-notebooklm | Pillar |
| https://www.notebooktools.com/blog/is-notebooklm-free | Guide |
| https://www.notebooktools.com/blog/notebooklm-tutorial-beginners | Guide |
| https://www.notebooktools.com/blog/notebooklm-review-2026 | Review |
| https://www.notebooktools.com/blog/notebooklm-vs-gemini | Comparison |
| https://www.notebooktools.com/blog/notebooklm-vs-chatgpt | Comparison |
| https://www.notebooktools.com/blog/best-notebooklm-alternatives | Listicle |
| https://www.notebooktools.com/blog/best-notebooklm-prompts | Listicle |
| https://www.notebooktools.com/blog/how-to-use-notebooklm-to-study | Listicle |
| https://www.notebooktools.com/blog/notebooklm-source-limits | Listicle |
| https://www.notebooktools.com/blog/best-ways-import-content-notebooklm | Listicle |
| https://www.notebooktools.com/blog/summarize-youtube-videos-notebooklm | Guide |
| https://www.notebooktools.com/blog/what-is-notebooktools | Product |
| https://www.notebooktools.com/support | Support |
| https://www.notebooktools.com/privacy | Privacy |
| https://www.notebooktools.com/sitemap.xml | Sitemap |
| https://www.notebooktools.com/llms.txt | AEO |
| https://www.notebooktools.com/robots.txt | Robots |

### Planned (Phase 1 remaining)

| URL | Type |
|-----|------|
| /blog/notebooklm-pricing-plans | Pillar |
| /blog/what-is-notebooklm-used-for | Pillar |
| /blog/notebooklm-infographic-guide | Cluster |
| /blog/notebooklm-for-students | Pillar |
| /blog/notebooklm-chrome-extension-guide | Cluster |
| /blog/notebooklm-web-importer-how-to | Cluster |
| /blog/notebooklm-video-overview-guide | Cluster |

---

## Document history

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | June 2026 | Initial master plan from seed keyword analysis + site audit |
| 1.1 | June 2026 | Added immediate actions, strategic summary, full 99-keyword appendix, coverage index |
| 1.2 | June 2026 | Shipped 4 new posts, 2 category hubs, internal link pass, review post, updated inventory |

---

## Appendix C — Complete 99-keyword seed file map

Source: `d:\seed_keywords_notebooklm.csv` — every keyword assigned to a tier, island, target slug, and action.

**Legend:** ✅ Live · 🔴 Plan · ⏭️ Skip (navigational / no fit) · 🔗 Covered by existing post

| # | Keyword | Vol | CPC | KD | Intent | Tier | Island | Target slug | Action |
|---|---------|-----|-----|-----|--------|------|--------|-------------|--------|
| 1 | notebooklm | 823,000 | $0.41 | 61 | transactional | C | — | — | ⏭️ Skip — head term |
| 2 | google's notebooklm | 22,200 | $0.67 | 61 | navigational | C | — | — | ⏭️ Skip |
| 3 | google notebooklm | 22,200 | $0.67 | 53 | informational | C | — | — | ⏭️ Skip — brand owned |
| 4 | notebooklm login | 9,900 | $0.88 | 61 | navigational | C | — | — | ⏭️ Skip |
| 5 | what is notebooklm | 5,400 | $4.99 | 38 | informational | B | 6/7 | what-is-notebooklm | 🔴 Pillar P1 |
| 6 | notebooklm app | 2,900 | $2.70 | 61 | transactional | C | — | — | ⏭️ Skip |
| 7 | notebooklm google com | 2,400 | $1.03 | 59 | navigational | C | — | — | ⏭️ Skip |
| 8 | notebooklm google.com | 2,400 | $1.03 | 50 | navigational | C | — | — | ⏭️ Skip |
| 9 | is notebooklm free | 2,400 | $7.89 | 45 | informational | B | 4 | is-notebooklm-free | 🔴 P1 |
| 10 | notebooklm #ai | 1,600 | $2.21 | 49 | informational | C | — | — | ⏭️ Skip |
| 11 | notebooklm ai | 1,600 | $2.21 | 49 | transactional | C | — | — | ⏭️ Skip |
| 12 | notebooklm api | 1,300 | $5.84 | 37 | informational | B | 8 | notebooklm-api-overview | 🔴 Phase 3 |
| 13 | what is google notebooklm | 1,300 | $5.33 | 50 | informational | B | 6 | what-is-notebooklm | 🔗 Same pillar |
| 14 | notebooklm logo | 1,300 | $4.87 | 35 | navigational | C | — | — | ⏭️ Skip |
| 15 | notebooklm pricing | 1,300 | $6.04 | 30 | commercial | B | 4 | notebooklm-pricing-plans | 🔴 P1 |
| 16 | notebooklm pro | 1,300 | $9.36 | 43 | commercial | B | 4 | notebooklm-plus-vs-pro | 🔴 P2 |
| 17 | notebooklm price | 1,300 | $6.04 | 41 | commercial | B | 4 | notebooklm-pricing-plans | 🔗 Same pillar |
| 18 | what is notebooklm used for | 1,000 | $5.97 | 23 | informational | B | 6 | what-is-notebooklm-used-for | 🔴 P1 |
| 19 | notebooklm plus | 880 | $7.23 | 56 | transactional | C | 4 | notebooklm-plus-vs-pro | 🔴 P2 |
| 20 | notebooklm podcast | 720 | $2.81 | 38 | navigational | B | 2 | notebooklm-audio-overview-explained | 🔴 P2 |
| 21 | notebooklm reddit | 720 | $0 | 2 | navigational | C | — | — | ⏭️ Skip — UGC |
| 22 | what does notebooklm do | 720 | $5.17 | 32 | informational | B | 6 | what-is-notebooklm-used-for | 🔗 Same pillar |
| 23 | notebooklm alternative | 590 | $6.74 | 0 | informational | A | 5 | best-notebooklm-alternatives | ✅ Live |
| 24 | notebooklm-py | 590 | $22.12 | 0 | navigational | A | 8 | notebooklm-py-intro | 🔴 Phase 3 |
| 25 | notebooklm alternatives | 590 | $6.74 | 0 | informational | A | 5 | best-notebooklm-alternatives | ✅ Live |
| 26 | notebooklm mcp | 590 | $8.03 | 9 | navigational | A | 8 | notebooklm-mcp-guide | 🔴 Phase 3 |
| 27 | notebooklm vs gemini | 590 | $8.88 | 0 | informational | A | 5 | notebooklm-vs-gemini | ✅ Live |
| 28 | notebooklm sign in | 590 | $3.91 | 62 | navigational | C | — | — | ⏭️ Skip |
| 29 | how does notebooklm work | 590 | $7.11 | 41 | informational | B | 7 | how-does-notebooklm-work | 🔴 P1 |
| 30 | notebooklm download | 590 | $3.75 | 46 | transactional | C | — | — | ⏭️ Skip |
| 31 | notebooklm for students | 480 | $3.91 | 38 | transactional | B | 3 | notebooklm-for-students | 🔴 P1 |
| 32 | www notebooklm | 480 | $2.43 | 60 | navigational | C | — | — | ⏭️ Skip |
| 33 | notebooklm podcast generator | 480 | $8.83 | 24 | navigational | B | 2 | notebooklm-podcast-generator-guide | 🔴 P1 |
| 34 | youtube to notebooklm | 480 | $5.18 | 20 | navigational | B | 1/2 | summarize-youtube-videos-notebooklm | ✅ Live |
| 35 | notebooklm video overview | 480 | $4.33 | 19 | navigational | B | 2 | notebooklm-video-overview-guide | 🔴 P1 |
| 36 | notebooklm video overviews | 480 | $4.33 | 19 | navigational | B | 2 | notebooklm-video-overview-guide | 🔗 Same post |
| 37 | notebooklm cost | 480 | $7.61 | 42 | informational | B | 4 | notebooklm-pricing-plans | 🔗 Same pillar |
| 38 | notebooklm for studying | 480 | $8.26 | 21 | transactional | B | 3 | how-to-use-notebooklm-to-study | 🔗 Expand or pillar |
| 39 | notebooklm vs chatgpt | 390 | $0 | 0 | informational | A | 5 | notebooklm-vs-chatgpt | ✅ Live |
| 40 | open notebooklm | 390 | $3 | 52 | navigational | C | — | — | ⏭️ Skip |
| 41 | notebooklm mind map | 390 | $5.60 | 26 | informational | B | 6 | notebooklm-mind-map-guide | 🔴 P2 |
| 42 | notebooklm enterprise | 390 | $11.79 | 32 | navigational | B | 4 | notebooklm-enterprise-pricing | 🔴 P3 |
| 43 | notebooklm tutorial | 320 | $5.79 | 14 | navigational | A | 7 | notebooklm-tutorial-beginners | 🔴 P1 |
| 44 | https notebooklm google login | 320 | $2.90 | 62 | navigational | C | — | — | ⏭️ Skip |
| 45 | notebooklm limits | 320 | $0 | 17 | informational | B | 7 | notebooklm-source-limits | ✅ Live |
| 46 | notebooklm what is it | 320 | $5.31 | 39 | informational | B | 6 | what-is-notebooklm | 🔗 Same pillar |
| 47 | notebooklm reviews | 320 | $5.31 | 9 | navigational | B | 7 | notebooklm-review-2026 | 🔴 P1 |
| 48 | how much is notebooklm | 320 | $7.01 | 29 | commercial | B | 4 | how-much-does-notebooklm-cost | 🔴 P2 |
| 49 | notebooklm website | 320 | $3.22 | 47 | navigational | C | — | — | ⏭️ Skip |
| 50 | notebooklm free | 320 | $5.39 | 39 | informational | B | 4 | is-notebooklm-free | 🔗 Same post |
| 51 | notebooklm review | 320 | $5.31 | 3 | informational | A | 7 | notebooklm-review-2026 | 🔴 P1 |
| 52 | notebooklm web | 320 | $3.22 | 50 | navigational | C | — | — | ⏭️ Skip |
| 53 | notebooklm desktop app | 320 | $6.50 | 71 | transactional | C | — | — | ⏭️ Skip |
| 54 | gemini notebooklm | 320 | $3.76 | 34 | transactional | B | 5 | notebooklm-vs-gemini | 🔗 Same post |
| 55 | notebooklm features | 260 | $5.38 | 49 | navigational | B | 6 | what-is-notebooklm-used-for | 🔗 Features pillar |
| 56 | notebooklm-skill | 260 | $8.47 | 13 | commercial | A | 8 | notebooklm-skill-guide | 🔴 Phase 3 |
| 57 | notebooklm infographic | 260 | $6.91 | 0 | navigational | A | 6 | notebooklm-infographic-guide | 🔴 P1 |
| 58 | notebooklm update | 260 | $5.72 | 49 | informational | C | — | — | ⏭️ Skip — news |
| 59 | notebooklm com | 260 | $0.93 | 71 | navigational | C | — | — | ⏭️ Skip |
| 60 | notebooklm for mac | 260 | $8.80 | 40 | transactional | C | — | — | ⏭️ Skip |
| 61 | is notebooklm down | 260 | $0 | 9 | informational | C | — | — | ⏭️ Skip — ephemeral |
| 62 | notebooklm videos | 260 | $4.88 | 45 | navigational | B | 2 | summarize-youtube-videos-notebooklm | 🔗 Same post |
| 63 | is google notebooklm free | 260 | $9.09 | 51 | informational | B | 4 | is-notebooklm-free | 🔗 Same post |
| 64 | notebooklm video | 260 | $4.88 | 49 | informational | B | 2 | summarize-youtube-videos-notebooklm | 🔗 Same post |
| 65 | notebooklm use cases | 260 | $5.73 | 22 | informational | B | 6 | notebooklm-use-cases | 🔴 P3 |
| 66 | notebooklm to pdf chrome extension | 260 | $0 | 10 | transactional | A | 1 | notebooklm-to-pdf-extension | 🔴 P2 |
| 67 | notebooklm updates | 260 | $5.72 | 32 | navigational | C | — | — | ⏭️ Skip — news |
| 68 | notebooklm skill | 260 | $8.47 | 13 | transactional | A | 8 | notebooklm-skill-guide | 🔴 Phase 3 |
| 69 | google notebooklm login | 260 | $1.15 | 58 | navigational | C | — | — | ⏭️ Skip |
| 70 | notebooklm news | 260 | $0 | 25 | informational | C | — | — | ⏭️ Skip — news |
| 71 | notebooklm infographics | 260 | $6.91 | 37 | navigational | B | 6 | notebooklm-infographic-guide | 🔗 Same post |
| 72 | how to use google notebooklm | 260 | $6.25 | 49 | informational | B | 7 | notebooklm-tutorial-beginners | 🔗 Same post |
| 73 | notebooklm mac | 260 | $3.91 | 37 | transactional | C | — | — | ⏭️ Skip |
| 74 | notebooklm gemini | 210 | $4.31 | 44 | transactional | B | 5 | notebooklm-vs-gemini | 🔗 Same post |
| 75 | notebooklm student discount | 210 | $7.09 | 13 | commercial | A | 3 | notebooklm-student-discount | 🔴 P2 |
| 76 | how many sources can you add to notebooklm | 210 | $0 | 12 | informational | A | 7 | notebooklm-source-limits | ✅ Live |
| 77 | notebooklm prompts | 210 | $21.10 | 12 | navigational | A | 7 | best-notebooklm-prompts | ✅ Live |
| 78 | does notebooklm have a limit | 210 | $0 | 15 | informational | A | 7 | notebooklm-source-limits | ✅ Live |
| 79 | notebooklm source limit | 210 | $0 | 8 | informational | A | 7 | notebooklm-source-limits | ✅ Live |
| 80 | how much does notebooklm cost | 210 | $10.22 | 16 | informational | B | 4 | how-much-does-notebooklm-cost | 🔴 P2 |
| 81 | notebooklm prompt | 210 | $21.10 | 14 | navigational | A | 7 | best-notebooklm-prompts | ✅ Live |
| 82 | gemini vs notebooklm | 210 | $0 | 6 | commercial | A | 5 | gemini-vs-notebooklm | 🔴 P1 |
| 83 | youtube to notebooklm chrome extension | 210 | $0 | 8 | navigational | A | 1 | best-ways-import-content-notebooklm | ✅ Live |
| 84 | how to use notebooklm to study | 210 | $7.60 | 9 | informational | A | 3 | how-to-use-notebooklm-to-study | ✅ Live |
| 85 | notebooklm web importer | 210 | $0 | 4 | navigational | A | 1 | notebooklm-web-importer-how-to | 🔴 P1 |
| 86 | notebooklm icon | 210 | $0 | 32 | navigational | C | — | — | ⏭️ Skip |
| 87 | is notebooklm good | 210 | $0 | 27 | informational | B | 7 | is-notebooklm-good | 🔴 P2 |
| 88 | google notebooklm pro | 210 | $6.77 | 46 | transactional | B | 4 | notebooklm-plus-vs-pro | 🔗 Same post |
| 89 | notebooklm cli | 210 | $0 | 6 | navigational | A | 8 | notebooklm-cli-tools | 🔴 Phase 3 |
| 90 | notebooklm by google | 210 | $3.74 | 71 | navigational | C | — | — | ⏭️ Skip |
| 91 | notebooklm plans | 170 | $4.95 | 45 | commercial | B | 4 | notebooklm-pricing-plans | 🔗 Same pillar |
| 92 | notebooklm enterprise api | 170 | $0 | 22 | navigational | B | 8 | notebooklm-enterprise-api | 🔴 Phase 3 |
| 93 | notebooklm plan | 170 | $4.95 | 0 | informational | A | 4 | notebooklm-pricing-plans | 🔴 P1 |
| 94 | notebooklm slide deck | 170 | $5.17 | 27 | navigational | B | 6 | notebooklm-slide-deck-guide | 🔴 P2 |
| 95 | notebooklm chrome extension | 170 | $7.22 | 40 | informational | B | 1 | notebooklm-chrome-extension-guide | 🔴 P1 |
| 96 | notebooklm slide | 170 | $5.07 | 25 | navigational | A | 6 | notebooklm-slide-deck-guide | 🔗 Same post |
| 97 | is notebooklm private | 170 | $0 | 25 | informational | B | 7 | is-notebooklm-private | 🔴 P2 |
| 98 | notebooklm privacy | 170 | $6.44 | 43 | navigational | C | — | /privacy | ⏭️ Use privacy page |
| 99 | notebooklm slides | 170 | $5.07 | 27 | navigational | B | 6 | notebooklm-slide-deck-guide | 🔗 Same post |
| 100 | notebooklm free for students | 170 | $3.92 | 27 | commercial | B | 3 | notebooklm-free-for-students | 🔴 P2 |

### Seed file totals

| Action | Count | % of 99 |
|--------|-------|---------|
| ✅ Live / covered now | 18 | 18% |
| 🔴 Planned content | 52 | 53% |
| 🔗 Covered by planned/live sibling | 19 | 19% |
| ⏭️ Skip | 30 | 30% |

---

## Appendix D — Plan coverage index

Maps every section from the original SEO architecture conversation to this document.

| Original plan section | In `BLOG_SEO_MASTERPLAN.md`? | Section |
|----------------------|------------------------------|---------|
| Executive summary (3 tiers) | ✅ Yes | §1 |
| Tier A / B / C strategy | ✅ Yes | §4, Appendix A, Appendix C |
| Current state audit (9 posts table) | ✅ Yes | §8 |
| Coverage gap (~70% Tier A) | ✅ Yes | §20 |
| Authority map (6 layers) | ✅ Yes | §6 |
| Layer roles table | ✅ Yes | §6 |
| Island 1 — Import & Extension | ✅ Yes | §7 |
| Island 2 — YouTube & Video | ✅ Yes | §7 |
| Island 3 — Study & Students | ✅ Yes | §7 |
| Island 4 — Pricing & Plans | ✅ Yes | §7 |
| Island 5 — Comparisons | ✅ Yes | §7 |
| Island 6 — Features & AI Outputs | ✅ Yes | §7 |
| Island 7 — Education & Trust | ✅ Yes | §7 |
| Island 8 — Developer / Technical | ✅ Yes | §7 |
| 6-link internal linking rule | ✅ Yes | §9 |
| Hub-and-spoke model | ✅ Yes | §9 |
| Cross-island bridge map | ✅ Yes | §9 |
| Sitewide link matrix | ✅ Yes | §9 |
| Footer "Related guides" template | ✅ Yes | §9 |
| 90-day roadmap (Phase 1–3) | ✅ Yes | §14 |
| On-page SEO checklist | ✅ Yes | §10, §18 |
| Keywords to deliberately skip | ✅ Yes | §5, Appendix C |
| KPI targets (6 months) | ✅ Yes | §2 |
| Immediate next actions (this week) | ✅ Yes | §19 |
| Strategic summary & biggest gaps | ✅ Yes | §20 |
| Full seed CSV keyword mapping | ✅ Yes | Appendix C (all 99) |
| Site audit fixes | ✅ Yes | §16 |
| Technical SEO / AEO | ✅ Yes | §11 |
| Sidebar CTA strategy | ✅ Yes | §12 |
| Category hub strategy | ✅ Yes | §13 |
| 180-day expansion + link building | ✅ Yes | §15 |
| Full URL map | ✅ Yes | Appendix B |
| Competitive positioning | ✅ Yes (extra) | §3 |
| Measurement & GSC reporting | ✅ Yes (extra) | §17 |
| Production checklist per article | ✅ Yes (extra) | §18 |

**Verdict:** All items from the original conversation plan are included. Version 1.1 adds the full 99-keyword CSV map and explicit coverage index.

---

*This document is the single source of truth for NotebookTools blog SEO. Update after every content sprint.*
