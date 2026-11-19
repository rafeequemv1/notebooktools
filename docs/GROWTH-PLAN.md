# NotebookTools growth plan (from Piqo data, 19 Nov 2026)

Goal: more search clicks, more AI citations (ChatGPT, Gemini, Copilot, Perplexity),
more installs, and the first paid Pro customers.

This builds on [`SEO-PLAN.md`](SEO-PLAN.md) (keyword → URL map) and does not repeat it.
It re-orders the work by what the last 30 days of data show.

---

## 1. Where we are (last 30 days vs the 30 before)

All numbers from Piqo (site analytics, Google Search Console sync).

| Metric | Last 30 days | Previous 30 | Change |
|---|---|---|---|
| Visitors | 955 | 758 | +26% |
| Pageviews | 2,387 | 1,617 | +48% |
| Bounce rate | 69.2% | 77.1% | −7.9 pts |
| Avg session time | 1,076 s | 599 s | +80% |
| Revenue / sign-ups tracked | 0 / 0 | 0 / 0 | not connected |

**Traffic sources (visitors):**

| Source | Last 30 | Previous 30 |
|---|---|---|
| Direct | 338 | 284 |
| Bing | 328 | 327 |
| Google | 184 | 87 |
| DuckDuckGo | 51 | 53 |
| Yahoo (all regions) | ~77 | ~71 |
| **gemini.google.com** | **20** | 0 |
| **chatgpt.com** | **11** | 2 |
| Perplexity | ~5 | 2 |

**Google Search Console (20 Oct – 16 Nov):** 145 clicks, 9,013 impressions,
**CTR 1.6%**, average position 8.8.

**Top entry pages:** best-notebooklm-prompts (136 visitors), is-notebooklm-free (125),
notebooklm-slide-prompts (91), notebooklm-privacy (95), **/es/es-notebooklm-gratis (91)**,
home (72), notebooklm-vs-gemini (66).

**Installs:** at least 36 visitors clicked through to the Chrome Web Store in 30 days
(≈4% of visitors). On the localized pages, 34 visitors clicked through to
notebooklm.google.com and only 8 to our store listing.

---

## 2. Diagnosis

**Working**
- Google traffic doubled (87 → 184 visitors). The prompts, slide-prompts and privacy posts are climbing.
- AI referrals went from almost nothing to ~36 visitors a month (Gemini 20, ChatGPT 11, Perplexity ~5). The AI-citation work is landing.
- The Spanish page became the #5 entry page within a week. The localized pages work.
- Engagement is up: lower bounce rate, much longer sessions.

**Broken or leaking**
1. **The 14 feature pages are near-duplicates.** Each `/features/*` page ships ~3,020 words, the full text of every demo. Google sees 14 copies of one page. This was fix #1 in `SEO-PLAN.md` and is still open.
2. **High impressions, almost no clicks:**
   - `is-notebooklm-free`: 550 impressions, **0 clicks**, average position 23.
   - `notebooklm-privacy`: 324 impressions, 3 clicks (0.9% CTR) at position ~10.
   - "notebooklm free" (92 impressions) and "notebook lm free" (58) at position ~11 with 0 clicks.
3. **Our core product keyword is untouched:** "youtube to notebooklm" has 31 impressions at position 9.4 and **0 clicks**; `/features/add-youtube` gets 45 impressions and 0 clicks.
4. **Visitors leave for NotebookLM, not the Chrome Web Store.** On the localized pages the "go to notebooklm.google.com" link outperforms our install button about 4:1 (34 vs 8 visitors).
5. **Bing isn't connected to Piqo,** although Bing sends a third of all visitors. We can't see Bing queries.
6. **Revenue and sign-ups aren't connected to Piqo,** so a sale can't be attributed to a channel (the refunded sale left no trace).
7. **Preview deployments are public:** `notebooktools.vercel.app` and per-commit `*.vercel.app` URLs send visits and can be indexed as duplicates.

---

## 3. Week 1: fixes that multiply everything else

| # | Fix | Why | Effort |
|---|---|---|---|
| 1 | **De-duplicate feature pages** in `scripts/sync-feature-pages.py`: each page keeps only its own demo, gets a unique title/H1/description and 400–600 words for its keyword | Removes 14× duplicate content; lets `add-youtube`, `chat-export`, `notebooks-hub` rank | 1 day |
| 2 | **Connect Bing Webmaster Tools, Dodo and Supabase in Piqo** (site settings) | See Bing queries; attribute sales and sign-ups to channels | 30 min |
| 3 | **Redirect or noindex `*.vercel.app`**: add a Vercel redirect from `notebooktools.vercel.app` to `www.notebooktools.com`, and keep previews behind Vercel's deployment protection | Stops duplicate indexing | 15 min |
| 4 | **Rewrite titles and meta descriptions for CTR** (table below) | 1.6% CTR at position 8.8 should be 4–6% | 2 hours |
| 5 | **Install CTAs on localized pages**: in-language "Add to Chrome" button in the hero and after the steps; keep the NotebookLM link but make it secondary | Converts the fastest-growing traffic | 2 hours |
| 6 | **Dodo live webhook check** (from the launch checklist) | The refunded sale never reached the database | 15 min |

**Title rewrites (from Search Console):**

| Page | Problem | New title |
|---|---|---|
| `/blog/is-notebooklm-free` | 550 impr, 0 clicks, pos 23 | `Is NotebookLM Free? Yes: 100 Notebooks, 50 Sources (2026 Limits)` |
| `/blog/notebooklm-privacy` | 324 impr, 0.9% CTR, pos 10 | `Does NotebookLM Train on Your Data? No: Google's Privacy Rules Explained` |
| `/features/add-youtube` | 45 impr, 0 clicks, pos 8.7 | `YouTube to NotebookLM: Add Videos & Whole Playlists in One Click` |
| `/blog/notebooklm-vs-gemini` | pos 31 | already rewritten 8 Nov; re-check in 2 weeks |
| `/` (home) | "notebook tools" pos 11.9 | already says "NotebookLM Tools"; add an H2 "NotebookLM tools in one extension" |

Rules: lead with the exact query, put the answer or the number in the title,
keep the year, stay under 60 characters where possible.

---

## 4. More Google clicks (weeks 2–6)

1. **Push page-2 queries onto page 1.** Everything at positions 9–25 with impressions is the cheapest win:
   - "notebooklm free" / "notebook lm free" (pos ~11): add a 40-word answer box under the H1, a "free vs paid" table in the first screen (done), and 3 internal links from the prompts posts, which are our strongest pages.
   - "is notebooklm private" (pos 18) and "notebooklm privacy" (pos 29): add a short FAQ block with these exact questions to the privacy post.
   - "notebooklm free for students" (pos 12): link `/students` and the free page to each other with that exact anchor.
2. **Internal links from winners to money pages.** `best-notebooklm-prompts` and `notebooklm-slide-prompts` get the most Google clicks. Each should link to `/features/prompts`, `/notebooklm-slide-styles` and the Chrome Web Store with descriptive anchors.
3. **Feature pages as landing pages** (after the de-dup): each one gets a "How it works" 3-step block, a 30-second demo GIF, an FAQ with `FAQPage` schema, `SoftwareApplication` schema, and links to 2–3 guides.
4. **Request indexing** in Search Console for every rewritten page.

---

## 5. More ChatGPT and AI citations

AI referrals grew from 4 to ~36 visitors a month. What gets pages cited:

1. **Answer first, in one quotable sentence, with a number.** Every guide opens with a "Short answer" box (done on free, pricing, limits, vs-Gemini). Add it to: privacy, prompts, slide prompts, tutorial, review, alternatives, what-is.
2. **Keep facts identical everywhere.** One fact sheet (limits, prices, rename) reused verbatim on every page and in `llms.txt`. AI engines skip sources that contradict each other.
3. **Tables and lists.** Comparison tables and numbered steps get lifted into answers. Add a table to every comparison and how-to page.
4. **Freshness.** Visible "Updated" date and `dateModified` on every page; re-date only when something actually changed. Review the free, pricing and limits pages monthly.
5. **Bing matters double.** ChatGPT search and Copilot draw on Bing's index. Submit the sitemap in Bing Webmaster Tools and use IndexNow on every publish (add a ping step to the deploy).
6. **Expand the localized pages that work.** Spanish is our #5 entry page. Add the next 3 pages in Spanish and German first (pricing, limits, prompts for studying), then French and Portuguese.
7. **Be the source others cite.** One original data piece a month (see §7) gives AI answers something only we have.
8. **Track it.** Monthly: re-export the Bing AI citation report (as on 8 Nov), plus Piqo referrers for chatgpt.com, gemini.google.com, copilot.com, perplexity.ai.

---

## 6. Product and conversion improvements

| # | Improvement | Why |
|---|---|---|
| 1 | **Ship v0.12.0** (Free/Pro) to the Chrome Web Store | Pro can't sell until it's live |
| 2 | **Install → activation onboarding**: `welcome.html` shows 3 steps (pin, open NotebookLM, try one import) with a live checklist | First successful import is what keeps users |
| 3 | **Upgrade moments in context**: after the 3rd bulk import, or when a notebook is 80% full, a one-line hint that the source manager (Pro) can clean it up | Converts at the moment of need |
| 4 | **Remove or relabel the Google Docs text import** ("Copy text, won't sync") | NotebookLM's own Drive import is better; avoid a weaker duplicate |
| 5 | **Chrome Web Store listing**: new screenshots (dashboard, bulk import, upgrade dialog); first line "Import YouTube, webpages and AI chats into NotebookLM" | The store is a search engine too |
| 6 | **Ask for reviews** after the 5th successful import (once, dismissible) | Ratings drive store ranking and trust |
| 7 | **Free tool page**: "NotebookLM source limit checker" or "YouTube playlist → NotebookLM link list" on the website, no install needed, with an install CTA | Linkable asset; captures "youtube to notebooklm" intent |

---

## 7. Blog and content plan (6 weeks, 2 pages a week)

Ordered by data signal first, then by `SEO-PLAN.md` keyword value.

| Week | Page | Type | Signal |
|---|---|---|---|
| 1 | `/blog/youtube-to-notebooklm` (expand `summarize-youtube-videos-notebooklm` into the canonical guide) | Rewrite | 31 impr at pos 9.4, 0 clicks; our core feature |
| 1 | `/blog/notebooklm-prompts-for-studying` split from best-prompts: 30 prompts by subject (nursing, medicine, law, engineering, languages) | New | 6 "prompts for studying" variants in GSC, all positions 7–10 |
| 2 | `/blog/notebooklm-chrome-extensions` (best extensions, ours listed honestly with others) | New | Bottom-of-funnel, no competitor page yet |
| 2 | `/blog/export-notebooklm-to-pdf` | New | KD 0, links to chat export (Pro) |
| 3 | `/blog/notebooklm-mind-map` | New | KD 0, CPC $21 |
| 3 | `/blog/notebooklm-video-overview` | New | KD 5, rising |
| 4 | `/blog/notebooklm-mcp` | New | KD 1, CPC $17, technical audience that links |
| 4 | `/blog/notebooklm-not-working` (errors and fixes) | New | KD 0, recurring searches |
| 5 | `/blog/what-is-gemini-notebook` | New | Rebrand wave |
| 5 | Spanish + German: pricing and limits | Translate | Localized pages already convert visits |
| 6 | `/blog/notebooklm-updates` (monthly changelog) | New, recurring | Earns repeat visits, links and AI citations |
| 6 | **Original data post**: "We analysed 1,000 NotebookLM prompts" or "What students import into NotebookLM" (aggregated, anonymous) | New | Citable, linkable, only we have it |

**Every page:** short answer box, table, FAQ with schema, 3+ internal links, a CTA to
the matching feature, visible "Updated" date. Studio how-tos get real screenshots.

---

## 8. Distribution and links

- Product Hunt launch the week v0.12.0 is approved.
- 10+ directories: Chrome extension lists, AI tool directories (There's An AI For That, Futurepedia, Toolify), alternativeto.net.
- Reddit (r/notebooklm, r/GetStudying, r/PhD): answer questions with genuinely useful posts; link only when it is the answer.
- YouTube: three 60-second demos (YouTube playlist → notebook, bulk import, dashboard), embedded on the matching feature pages.
- One guest post or interview a month on study and research blogs.

---

## 9. Targets (re-check on 19 Dec and 19 Jan)

| Metric | Now (30 d) | 30 days | 60 days |
|---|---|---|---|
| Google clicks | 145 | 300 | 600 |
| Google CTR | 1.6% | 3% | 4% |
| AI-referred visitors | ~36 | 60 | 120 |
| Total visitors | 955 | 1,300 | 2,000 |
| Chrome Web Store clicks | 36+ | 80 | 160 |
| Pro purchases | 0 | first 3 | 10 |

---

## 10. This week's checklist

- [ ] Connect Bing, Dodo and Supabase in Piqo
- [ ] Verify the Dodo live webhook
- [ ] Submit v0.12.0 to the Chrome Web Store
- [ ] De-duplicate the feature pages
- [ ] Redirect `notebooktools.vercel.app`
- [ ] Rewrite the 3 titles in §3
- [ ] Add in-language install CTAs to the 6 localized pages
- [ ] Start the YouTube guide and the studying-prompts page
