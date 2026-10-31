# Bulk Import Queue — Implementation Plan

**Feature:** Import many sources in one flow (open tabs, pasted links, page-scraped links, YouTube playlist).  
**Goal:** Close the #1 competitive gap vs NotebookLM Web Importer and similar addons.  
**Codebase:** `notebooktools-extension/` (side panel, `notebooklm-client.js`, `notebook-picker.js`).  
**Version target:** `0.3.0`  
**Status:** Plan only (not implemented)

---

## 1. Problem statement

Today NotebookTools imports **one source at a time**:
- Current tab (webpage or YouTube)
- Selected text (context menu)
- X/Twitter thread (in-page panel)

Power users build notebooks from **collections**: 15 open research tabs, a reading list, a syllabus playlist, or every link on a syllabus page. Doing that one-by-one is slow and error-prone.

**Success looks like:**
- User assembles a queue in under 60 seconds
- Reviews and dedupes before sending
- Imports 10–30 items with clear progress
- Gets a summary: added / skipped / failed
- Never silently hits the ~50 source-per-notebook cap

---

## 2. Current technical foundation

| Piece | Status | Notes |
|-------|--------|-------|
| `addWebpageToNotebookLm` | Ready | Single URL via RPC `izAoDd` |
| `addYoutubeToNotebookLm` | Ready | Single URL via RPC `izAoDd` |
| `addTextToNotebookLm` | Ready | Not in bulk v1 |
| Source limit detection | Partial | RPC error string `SOURCE_LIMIT_REACHED` only after failure |
| Notebook source count | Missing | Competitors show count; we need notebook detail RPC |
| Sequential import | Missing | No queue runner |
| Tab enumeration | Missing | Needs `chrome.tabs` permission (already granted) |
| YouTube playlist parse | Missing | Hardest collector; needs YouTube page/API access |
| Background long-running job | Missing | Side panel can close mid-import |

**Key constraint:** NotebookLM has no public API. All imports go through `batchexecute` with session cookies, same as today.

---

## 3. UX design

### 3.1 Where it lives

Add a **third top-level side panel tab:**

```
[ Import ]  [ Bulk ]  [ Prompt library ]
```

- **Import** — unchanged quick single-source flow
- **Bulk** — new queue workflow
- **Prompt library** — unchanged

Rationale: Bulk is a distinct mental model (collect → review → run). Burying it inside Import hides the flagship power feature.

### 3.2 Bulk tab flow (4 steps)

```
┌─────────────────────────────────────┐
│ 1. SOURCE                           │
│  [Tabs] [Paste links] [This page]   │
│  [Playlist] (phase 2)               │
├─────────────────────────────────────┤
│ 2. QUEUE          12 items · 3 YT   │
│  ☑ Article A          webpage       │
│  ☑ Lecture 1          youtube       │
│  ☐ Duplicate URL      skipped       │
│  [Select all] [Remove selected]     │
├─────────────────────────────────────┤
│ 3. DESTINATION                      │
│  Notebook picker (reuse picker)     │
│  ⚠ 38/50 sources after import       │
├─────────────────────────────────────┤
│ 4. RUN                              │
│  [Import 12 sources]                │
│  ████████░░  8/12 · 1 failed        │
└─────────────────────────────────────┘
```

### 3.3 Visual style

Match existing side panel: warm off-white, subtle borders, Notion/NotebookLM calm density.

- Queue rows: compact list with favicon/type icon, truncated title, type pill (`webpage` / `youtube`)
- Status colors: pending (muted), success (green), failed (red), skipped (gray)
- Sticky footer on Bulk tab: queue count + primary CTA

### 3.4 Empty and error states

| State | Copy |
|-------|------|
| No items in queue | "Add tabs, paste links, or scrape this page to get started." |
| No notebook selected | "Choose a notebook or create a new one." |
| At source limit | "This notebook has ~N sources. Only M slots left. Uncheck items or pick another notebook." |
| Not signed in | Reuse existing NotebookLM sign-in message from picker |
| Import running | Disable collectors; show cancel button |

---

## 4. Source collectors (v1 scope)

### 4.1 Open tabs (Phase 1 — ship first)

**Input:** All tabs in current window (option: current window vs all windows in v1.1).

**Logic:**
```javascript
chrome.tabs.query({ currentWindow: true })
  → filter http/https
  → classify: YouTube watch URL → youtube, else → webpage
  → skip: chrome://, notebooklm.google.com, empty tabs
  → normalize URL (strip tracking params optional v1.1)
  → title from tab.title
```

**Permissions:** `tabs` (already in manifest).

**UX:** Button "Add open tabs" → items append to queue (no replace by default).

---

### 4.2 Pasted link list (Phase 1)

**Input:** Textarea, one URL per line (also accept comma-separated).

**Logic:**
- Split on newlines / commas
- Trim, validate URL
- Classify youtube vs webpage using existing `normalizeYouTubeVideoUrl` / `normalizeWebpageUrl`
- Reject invalid lines with inline count: "3 lines skipped (not URLs)"

**UX:** Textarea + "Add to queue" button. Keep textarea content after add (user may tweak and re-add).

---

### 4.3 Links from this page (Phase 1)

**Input:** Active tab in current window.

**Logic:**
- Side panel sends message to content script on active tab
- New lightweight script: `link-scraper.js` (or inject via existing content scripts on `<all_urls>` — prefer dedicated script registered in manifest for `http(s)://*/*` on demand via `chrome.scripting.executeScript` to avoid always-on overhead)

**Extract:**
```javascript
[...document.querySelectorAll('a[href]')]
  → resolve absolute href
  → filter http/https
  → optional: same-origin only toggle (default off)
  → dedupe by normalized URL
  → title: link.textContent or href
```

**UX:**
- Button "Scrape links from active tab"
- Modal or inline subview: checklist of found links (cap display at 100, with "show all")
- User confirms → add selected to queue

**Permission:** May need `scripting` permission (MV3) for on-demand scrape on arbitrary pages.

---

### 4.4 YouTube playlist (Phase 2)

**Input:** User on playlist page OR pastes playlist URL.

**Why Phase 2:** Competitors use YouTube internal browse/continuation tokens. Fragile and page-structure dependent.

**Approach options (pick one in implementation spike):**

| Option | Pros | Cons |
|--------|------|------|
| A. Content script on `youtube.com/playlist` | No extra auth | Breaks when YouTube changes DOM |
| B. Parse `list=` from watch page sidebar | Works from watch view | Partial playlist visibility |
| C. `ytInitialData` JSON in page source | Rich metadata | CSP / sanitization care |

**Output:** Same queue items `{ type: 'youtube', url, title }`.

**Defer to Phase 2** but reserve UI tab/button (disabled with "Coming soon" or hidden until ready).

---

## 5. Queue data model

```typescript
// bulk-queue-types (documentation only)

type SourceType = "webpage" | "youtube";

type QueueItemStatus =
  | "pending"
  | "importing"
  | "success"
  | "failed"
  | "skipped";

interface BulkQueueItem {
  id: string;              // crypto.randomUUID() or hash of url+type
  url: string;             // normalized
  title: string;           // display only
  type: SourceType;
  status: QueueItemStatus;
  error?: string;
  addedAt: number;
}

interface BulkQueueState {
  items: BulkQueueItem[];
  destinationNotebookId: string | null;
  runId: string | null;    // active import batch
  isRunning: boolean;
}
```

**Persistence:**
- `chrome.storage.session` while panel open
- On import start: mirror queue + progress to `chrome.storage.local` key `bulkImportJob` so **background service worker** can continue if panel closes
- Clear job on completion or cancel

**Deduping:** Before add, normalize URL; if `id` exists in queue, mark as skipped or show toast "Already in queue".

---

## 6. Import runner (core engine)

### 6.1 Location

**`bulk-import-runner.js`** — callable from side panel and background.

Flow:
1. Validate notebook target (picker `resolveTarget()`)
2. Optional: fetch notebook source count (see §7)
3. Trim queue to remaining capacity
4. For each `pending` item sequentially:
   - Set status `importing`
   - Call `addYoutubeToNotebookLm` or `addWebpageToNotebookLm`
   - On success → `success`
   - On error → `failed` + store message
   - Delay **400–800 ms** between calls (rate limit; tune in QA)
5. Emit progress events
6. Final summary

### 6.2 Background orchestration

Move long runs to `background.js`:

```javascript
// message types
"bulk-import-start"   // { items, notebookId }
"bulk-import-cancel"
"bulk-import-status"  // broadcast progress to side panel
```

Why: Service worker survives panel close. User can kick off 20 imports and keep browsing.

### 6.3 Cancel

- Set `cancelRequested = true` on job
- Finish current RPC, stop before next item
- Leave completed items as success; rest revert to pending

### 6.4 Retry

- "Retry failed" button after run
- Resets only `failed` → `pending`

---

## 7. Source limit awareness

NotebookLM: **~50 sources per notebook** (see `website/blog/notebooklm-source-limits.html`).

Today we only detect limit **after** RPC fails.

### Phase 1 (minimum)

- Constant `NOTEBOOK_SOURCE_LIMIT = 50`
- After user picks notebook, show: **"Up to 50 sources per notebook"**
- Before run: `if (queue.pending.length > 50)` → warn and cap with user confirm
- On `SOURCE_LIMIT_REACHED` mid-run → stop queue, mark remaining as `skipped` with reason

### Phase 1.5 (recommended before public launch)

Add notebook detail RPC to `notebooklm-client.js` (competitor uses `rLM1Ne` per `ADDON_FEATURES.md`):

```javascript
async function getNotebookLmNotebookDetails(notebookId)
  → returns { id, title, sourceCount, ... }
```

Then show live: **"42/50 sources · 8 slots left"** and auto-cap queue.

**Spike task:** 2–4 hours to reverse-engineer detail RPC from NotebookLM network tab.

---

## 8. File structure (new / modified)

```
notebooktools-extension/
├── sidepanel.html              # add Bulk tab + panel markup
├── sidepanel.js                # register Bulk tab
├── bulk-import.html            # optional: if Bulk UI gets large, iframe embed
├── bulk-import.js              # UI controller, collectors, queue CRUD
├── bulk-import.css             # queue list, progress, scrape modal
├── bulk-import-runner.js       # sequential import engine
├── bulk-queue-store.js         # session/local persistence
├── link-scraper.js             # injected snippet for page scrape
├── background.js                 # job orchestration, cancel
├── notebooklm-client.js          # + getNotebookDetails (phase 1.5)
├── manifest.json                 # + scripting permission if needed, v0.3.0
└── utils.js                      # + parseLinkList, normalizeUrlForDedupe
```

---

## 9. Phased rollout

### Phase 1 — MVP (1.5–2 weeks)

**Ship:**
- Bulk tab UI shell
- Open tabs collector
- Paste links collector
- Queue list (add, remove, select all, clear)
- Sequential import via existing RPCs
- Progress bar + success/fail summary
- Open notebook link after complete
- Basic 50-source cap warning

**Do not ship yet:** Playlist, source count API, paywall.

**Exit criteria:**
- Import 20 tabs into one notebook without manual re-click
- Duplicate URLs deduped
- Failed item does not block rest
- Works from side panel on YouTube, news site, and Google Doc tab

---

### Phase 2 — Page scrape + playlist (1–2 weeks)

**Ship:**
- Scrape links from active tab (with selection UI)
- YouTube playlist collector
- Notebook source count from detail RPC
- Background job persistence (panel can close)
- URL normalization (strip `utm_*`, `fbclid`)

---

### Phase 3 — Polish + retention (1 week)

**Ship:**
- Remember last bulk destination notebook
- "Add current tab" quick action on Bulk tab
- Export queue as text file
- Import history (last 3 runs, local only)
- Rate-limit backoff on repeated RPC errors
- Optional: auto-open notebook after bulk complete (setting)

---

## 10. Permissions and manifest changes

| Permission | Why | Phase |
|------------|-----|-------|
| `tabs` | List open tabs | 1 (have) |
| `scripting` | Inject link scraper on demand | 2 |
| `sidePanel` | Bulk UI | have |
| `storage` | Queue + job persistence | have |

**No new host permissions** for Phase 1.

---

## 11. Testing plan

### Manual QA matrix

| Scenario | Expected |
|----------|----------|
| 5 http tabs | 5 queue items, all import |
| Mix YT + web | Correct RPC per type |
| Duplicate paste | Second deduped |
| Invalid paste lines | Skipped with count |
| Full notebook (50) | Warning before run; graceful stop |
| Sign out of NotebookLM | Clear error on first RPC |
| Close panel mid-import | Job continues (Phase 2) |
| Cancel mid-import | Stops after current item |
| Scrape link-heavy page | Performance OK under 200 links |

### Edge cases

- `chrome://`, `edge://`, Web Store tabs → excluded from tab collector
- YouTube `/shorts/`, `/embed/` → normalize to watch URL
- PDF tabs → import as webpage URL (NotebookLM handles fetch)
- Same video, different query params → dedupe to one

---

## 12. Metrics (lightweight, privacy-safe)

Track locally or via existing analytics when added:

- `bulk_queue_created` — item count by source type
- `bulk_import_started` — queue size
- `bulk_import_completed` — success / failed / skipped counts, duration
- `bulk_import_error` — error message category (limit, auth, network)

---

## 13. Monetization (optional, later)

Competitors gate playlist / all-windows / RSS behind Pro. **Recommendation for NotebookTools:**

| Feature | Free | Pro (future) |
|---------|------|----------------|
| Paste links (≤10 per run) | Yes | — |
| Open tabs (current window, ≤15) | Yes | — |
| Scrape page links | Yes | — |
| Playlist import | — | Yes |
| All windows tabs | — | Yes |
| Unlimited per-run count | — | Yes |

**v1:** Ship bulk free with soft cap (e.g. 25 per run) to prevent abuse; tune after usage data.

---

## 14. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| RPC rate limiting | Sequential import + delay; exponential backoff |
| Source limit mid-batch | Pre-check count; stop on `SOURCE_LIMIT_REACHED` |
| YouTube playlist breakage | Phase 2 only; isolate in `youtube-playlist-collector.js` |
| Side panel memory on 100+ items | Virtualize list or cap queue at 100 with warning |
| User confusion (Bulk vs Import) | Clear tab labels; one-line helper under Bulk header |
| NotebookLM API change | Centralize RPC in `notebooklm-client.js`; single fix point |

---

## 15. Implementation order (task checklist)

### Week 1
- [ ] Add Bulk tab to `sidepanel.html` / `sidepanel.js`
- [ ] Create `bulk-queue-store.js` + data model
- [ ] Build queue UI (list, remove, clear, counts)
- [ ] Implement **tabs collector**
- [ ] Implement **paste links collector**
- [ ] Wire notebook picker (reuse `NotebookToolsPicker`)
- [ ] Create `bulk-import-runner.js` (sequential RPC)
- [ ] Progress UI + completion summary
- [ ] 50-source cap warning (static limit)

### Week 2
- [ ] Move runner to `background.js` for durability
- [ ] Cancel + retry failed
- [ ] Spike notebook detail RPC for source count
- [ ] Link scraper content script + selection modal
- [ ] QA pass on 3 real workflows (research, course, newsletter)

### Week 3 (optional)
- [ ] YouTube playlist collector
- [ ] Settings: auto-open notebook, per-run caps
- [ ] Chrome Web Store listing update (screenshots of Bulk tab)

---

## 16. Definition of done

Bulk Import Queue v1 is **done** when:

1. User can add **open tabs** and **pasted links** to a reviewable queue
2. User can pick/create a notebook and import **all pending items** in one action
3. UI shows per-item and overall progress with success/failure breakdown
4. Duplicate URLs are not imported twice in one batch
5. Source limit is communicated before and during import
6. No changes to `website/` landing page (per product decision)
7. Extension version bumped to `0.3.0` and submission package updated

---

## 17. Related follow-ups (out of scope)

- RSS feed import
- Import queue → auto-run prompt pack after complete
- Bulk import from browser history
- Notebook tags / dashboard

These pair well after Bulk v1 ships.
