# Chrome Web Store listing — NotebookTools v0.1.0

Copy these fields into the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).

**Homepage:** `https://notebooktools.vercel.app/`  
**Privacy policy:** `https://notebooktools.vercel.app/privacy`  
**Support:** `https://github.com/rafeequemv1/notebooktools/issues`

---

## Extension name (75 chars max)

```
NotebookTools — Import YouTube, ChatGPT & Web to NotebookLM
```

## Short description (132 chars max)

```
Free: import YouTube, ChatGPT, Gemini, X posts, webpages & highlighted text into Google NotebookLM — one click, your sign-in.
```

*(131 characters)*

## Detailed description (SEO-optimized)

```
NotebookTools is a free Chrome extension that imports content into Google NotebookLM — without copy-paste.

Import YouTube videos, ChatGPT conversations, Gemini chats, X (Twitter) threads, any webpage URL, and highlighted text from the web. NotebookTools uses your existing Google sign-in. No extra account. No paywall.

WHAT YOU CAN IMPORT
• YouTube — in-page button on watch pages; pick a notebook and import in one click
• ChatGPT — import full conversations as text sources
• Gemini — import full conversations as text sources
• X / Twitter — import threads and articles as clean text
• Webpages — import the current tab URL from the extension popup
• Selected text — right-click highlighted text → Add to NotebookLM

HOW TO USE
1. Sign in to NotebookLM at notebooklm.google.com (keep a tab open once)
2. Install NotebookTools and pin the extension
3. On YouTube, ChatGPT, Gemini, or X — click the in-page NotebookLM button
4. Or open the popup on any tab to import a webpage
5. Or highlight text, right-click, and choose Add to NotebookLM
6. Select an existing notebook or create a new one — done

WHY NOTEBOOKTOOLS
NotebookLM is powerful for research and synthesis, but collecting sources from across the web can be slow. NotebookTools closes that gap with a minimal, calm UI designed for NotebookLM workflows.

PRIVACY
No backend servers. No analytics. Imports go directly from your browser to NotebookLM using your signed-in session. Read our privacy policy: https://notebooktools.vercel.app/privacy

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
https://notebooktools.vercel.app/
```

## Privacy policy URL

```
https://notebooktools.vercel.app/privacy
```

## Support URL

```
https://notebooktools.vercel.app/support
```

Contact email: `rafeequemavoor@gmail.com`

---

## Single purpose description (required for review)

```
This extension helps users import YouTube videos, AI chat conversations, social posts, webpage URLs, and selected text into their Google NotebookLM notebooks using their signed-in NotebookLM browser session.
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
Required to inject in-page import buttons on supported sites (YouTube, ChatGPT, Gemini, X), load import panels, and send webpage URLs and extracted text to NotebookLM when the user clicks import.
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
| Screenshots 1280×800 (×5) | `store-assets/screenshot-01-workflow.png` … `screenshot-05-all-sources.png` |
| Small promo 440×280 | `store-assets/promo-small-440x280.png` |
| Marquee promo 1400×560 | `store-assets/promo-marquee-1400x560.png` |

Regenerate: `.\store-assets\generate-store-assets.ps1`

### Promotional images (you create)

| Asset | Size | Notes |
|-------|------|-------|
| Screenshot | 1280×800 | 5 files in `store-assets/` (workflow, YouTube, popup, AI chats, all sources) |
| Small promo tile | 440×280 | `store-assets/promo-small-440x280.png` |
| Marquee promo tile | 1400×560 | `store-assets/promo-marquee-1400x560.png` |

### Extension icons (included in zip)

| Size | File |
|------|------|
| 16×16 | `extension/icons/icon16.png` |
| 48×48 | `extension/icons/icon48.png` |
| 128×128 | `extension/icons/icon128.png` |

### Suggested screenshot captions

---

## Keywords for discoverability (use naturally in description)

NotebookLM, Google NotebookLM, import to NotebookLM, YouTube to NotebookLM, ChatGPT to NotebookLM, Gemini NotebookLM, Chrome extension, research tool, AI notes, knowledge base, web clipper, save to NotebookLM

---

## Submission checklist

- [ ] One-time [Chrome Web Store developer registration](https://chrome.google.com/webstore/devconsole) fee ($5)
- [ ] Run `.\package-extension.ps1` → upload `notebooktools-v0.1.0.zip`
- [ ] Paste listing text from this file
- [ ] Set privacy policy URL to `https://notebooktools.vercel.app/privacy`
- [ ] Set homepage to `https://notebooktools.vercel.app/`
- [ ] Upload 1–5 screenshots
- [ ] Complete **Privacy practices** tab (no data sold, no remote code, etc.)
- [ ] Submit for review (typically 1–3 business days)
- [ ] After approval: copy the store URL and update `website/script.js` → `CHROME_STORE_URL`
