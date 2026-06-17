# Chrome Web Store listing — NotebookTools v0.2.3

Copy these fields into the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).

**Homepage:** `https://notebooktools.com/`  
**Privacy policy:** `https://notebooktools.com/privacy`  
**Support:** `https://notebooktools.com/support`

---

## Extension name (75 chars max)

```
NotebookTools — Import YouTube & Web to NotebookLM
```

## Short description (132 chars max)

```
Free: import YouTube videos, X posts, webpages & highlights into Google NotebookLM — one click from watch pages, popup, or right-click.
```

## Detailed description (SEO-optimized)

```
NotebookTools is a free Chrome extension that imports content into Google NotebookLM — without copy-paste.

Import YouTube videos, X (Twitter) threads, any webpage URL, and highlighted text from the web. NotebookTools uses your existing Google sign-in. No extra account. No paywall.

WHAT YOU CAN IMPORT
• YouTube watch page — in-page button next to Like/Share; pick a notebook and import in one click
• X / Twitter — import threads and articles as clean text
• Webpages — add the current tab URL from the extension popup
• Selected text — right-click highlighted text → Add to NotebookLM

HOW TO USE
1. Sign in to NotebookLM at notebooklm.google.com (keep a tab open once)
2. Install NotebookTools and pin the extension
3. On YouTube — open any watch page and click NotebookLM next to Like/Share
4. Or open the popup on any tab to import a webpage
5. Or highlight text, right-click, and choose Add to NotebookLM
6. Select an existing notebook or create a new one — done

WHY NOTEBOOKTOOLS
NotebookLM is powerful for research and synthesis, but collecting sources from across the web can be slow. NotebookTools closes that gap with a minimal, calm UI designed for NotebookLM workflows.

PRIVACY
No backend servers. Imports go directly from your browser to NotebookLM using your signed-in session. Read our privacy policy: https://notebooktools.com/privacy

FREE
All features are included at no cost.

NOT AFFILIATED WITH GOOGLE
NotebookTools is an independent extension and is not affiliated with, endorsed by, or sponsored by Google or NotebookLM.
```

## Category

```
Productivity
```

## Language

```
English
```

## Homepage URL

```
https://notebooktools.com/
```

## Privacy policy URL

```
https://notebooktools.com/privacy
```

## Support URL

```
https://notebooktools.com/support
```

Contact email: `rafeequemavoor@gmail.com`

---

## Single purpose description (required for review)

```
This extension helps users import YouTube videos, X posts, webpage URLs, and selected text into their Google NotebookLM notebooks using their signed-in NotebookLM browser session.
```

## Permission justifications

Paste each justification when the dashboard asks.

### activeTab

```
Needed to read the current tab URL when the user opens the extension popup to import a webpage, and to support import actions on the active page.
```

### storage

```
Stores lightweight extension preferences locally on the user's device (for example, last-selected notebook).
```

### contextMenus

```
Adds a right-click menu item so users can send highlighted text on any webpage directly to NotebookLM.
```

### tabs

```
Needed to detect when NotebookLM is open and to support import flows that communicate between the extension and the user's NotebookLM session.
```

### Host permission — https://*/* and http://*/*

```
Required to inject the in-page import button on YouTube watch pages, load import panels, and send webpage URLs and extracted text to NotebookLM when the user clicks import.
```

### Host permission — notebooklm.google.com

```
Required to list the user's notebooks and add sources (videos, URLs, and text) to NotebookLM through the signed-in browser session.
```

---

## Store listing graphics

Pre-made assets in **`store-assets/`** (see `store-assets/README.md`):

| Asset | File |
|-------|------|
| Store icon 128×128 | `store-assets/store-icon-128.png` |
| Screenshot 1 | `store-assets/screenshot-01-outcome.png` |
| Screenshot 2 | `store-assets/screenshot-02-youtube.png` |
| Screenshot 3 | `store-assets/screenshot-03-rightclick.png` |
| Screenshot 4 | `store-assets/screenshot-04-popup.png` |
| Screenshot 5 | `store-assets/screenshot-05-query.png` |
| Small promo 440×280 | `store-assets/promo-small-440x280.png` |
| Marquee promo 1400×560 | `store-assets/promo-marquee-1400x560.png` |

Regenerate: `.\store-assets\generate-store-assets.ps1`

### Suggested screenshot captions

1. **Outcome** — Turn scattered tabs into one NotebookLM notebook
2. **YouTube** — Import any watch-page video in one click
3. **Right-click** — Save highlighted text as a NotebookLM source
4. **Popup** — Add the current webpage URL from the extension popup
5. **Query** — Ask NotebookLM across all imported sources

### Extension icons (included in zip)

| Size | File |
|------|------|
| 16×16 | `extension/icons/icon16.png` |
| 48×48 | `extension/icons/icon48.png` |
| 128×128 | `extension/icons/icon128.png` |

---

## Keywords for discoverability (use naturally in description)

NotebookLM, Google NotebookLM, import to NotebookLM, YouTube to NotebookLM, Chrome extension, research tool, AI notes, knowledge base, web clipper, save to NotebookLM

---

## Submission checklist

- [ ] One-time [Chrome Web Store developer registration](https://chrome.google.com/webstore/devconsole) fee ($5)
- [ ] Run `.\store-assets\generate-store-assets.ps1` and `.\package-extension.ps1`
- [ ] Upload `notebooktools-v0.2.3.zip`
- [ ] Paste listing text from this file
- [ ] Set privacy policy URL to `https://notebooktools.com/privacy`
- [ ] Set homepage to `https://notebooktools.com/`
- [ ] Upload store icon + 5 screenshots + promo tiles from `store-assets/`
- [ ] Complete **Privacy practices** tab (no data sold, no remote code, etc.)
- [ ] Submit for review (typically 1–3 business days)
- [ ] After approval: copy the store URL and update `website/script.js` → `CHROME_STORE_URL`
