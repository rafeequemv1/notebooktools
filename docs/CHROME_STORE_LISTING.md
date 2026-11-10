# Chrome Web Store listing: NotebookTools v0.12.0

This replaces `version 0.1/CHROME_STORE_LISTING.md`, which was written for v0.2.3.
NotebookTools is already live in the store (ID `fhjgbniefbimnklnnomlhkkiekcjddmj`),
so this is an **update**: upload a new package and update the listing text and privacy tab.

## Build the package

```bash
bash scripts/build-extension-zip.sh
```

Upload `dist/notebooktools-extension.zip`. It is built from `notebooktools-extension/`
(v0.12.0). Do not upload the old `version 0.1/extension` folder.

---

## Extension name (75 chars max)

```
NotebookTools — Import to NotebookLM
```

## Short description (132 chars max)

```
Import YouTube, webpages, X, Reddit and AI chats into NotebookLM free. Pro adds a notebooks dashboard, makers and prompt library.
```

## Detailed description

```
NotebookTools is a Chrome extension for Google NotebookLM (now Gemini Notebook). Importing is free; Pro unlocks the rest for a one-time $49.

FREE: EVERY WAY TO IMPORT
• YouTube: an import button on every watch page; whole playlists and channels in bulk
• Webpages: add the current tab in one click, or extract every link on a page
• X, Reddit, LinkedIn and AI chats (ChatGPT, Claude, Gemini, Perplexity, Grok): import as clean text
• Highlights: right-click selected text → Add to NotebookLM
• Bulk queue: paste links or add all open tabs at once
• Source meter: see how close each notebook is to its source limit

PRO: $49 ONCE, LIFETIME ACCESS
• Notebooks dashboard: every notebook in one table, with folders, tags and favorites
• Source manager: duplicate scan, Google Drive refresh and bulk actions
• Studio files, and Studio outputs created as you import
• Blog maker and carousel maker from your notebook
• Snapshots: capture, annotate and send screenshots to a notebook
• Prompt library with / commands inside NotebookLM chat
• Chat export to PDF and Word
• Every future Pro feature, no subscription

HOW IT WORKS
1. Sign in to NotebookLM at notebooklm.google.com
2. Install NotebookTools and pin it
3. Import from any page, the side panel, or right-click
NotebookTools uses your existing Google sign-in for NotebookLM. A NotebookTools account is only needed for Pro.

PRIVACY
Imports go from your browser straight to NotebookLM. We do not sell data. The optional account stores only your email, plan and purchase record. Policy: https://www.notebooktools.com/privacy

NOT AFFILIATED WITH GOOGLE
NotebookTools is independent and is not affiliated with, endorsed by, or sponsored by Google.
```

## Category, language, URLs

- Category: **Productivity**
- Language: **English**
- Homepage: `https://www.notebooktools.com/`
- Privacy policy: `https://www.notebooktools.com/privacy`
- Support: `https://www.notebooktools.com/support`

---

## Single purpose description

```
NotebookTools helps users collect content from the web into their Google NotebookLM notebooks and organize and work with those notebooks: importing pages, videos, posts and selected text, and managing notebooks and their sources.
```

## Permission justifications

### activeTab
```
Reads the URL and title of the current tab when the user clicks import, so that page can be added to NotebookLM.
```

### storage
```
Stores the user's preferences, import queue, saved prompts, snapshots and sign-in session locally on the device.
```

### contextMenus
```
Adds right-click actions: send highlighted text to NotebookLM, extract the links on a page for bulk import, and capture a snapshot.
```

### tabs
```
Lists open tabs when the user chooses "add open tabs" for bulk import, detects NotebookLM tabs, and opens the notebooks dashboard and checkout pages.
```

### sidePanel
```
The extension's main interface (import, bulk queue, snapshots, prompts and account) runs in Chrome's side panel.
```

### scripting
```
Injects the snapshot capture overlay into the page the user wants to capture, and shows the upgrade dialog on pages where a keyboard shortcut was used. Only runs after a user action.
```

### Host permissions (https://*/*, http://*/*, <all_urls>)
```
Users import from any website, so the extension must read the page the user chooses to import (URL, title, selected text and links) and capture snapshots of it. It also adds import buttons on YouTube, X, Reddit and AI chat sites, and talks to notebooklm.google.com with the user's own signed-in session to list notebooks and add sources.
```

### Remote code
```
No. All code is included in the package. The extension only exchanges data (JSON) with NotebookLM and with our account service (Supabase).
```

---

## Privacy practices tab (data usage)

Tick these data types:

| Data type | Why |
|---|---|
| **Personally identifiable information** | Email address, only for users who create an optional account (Pro). |
| **Authentication information** | Password and session token for the optional account, sent to our auth provider (Supabase). |
| **Website content** | Text, links and URLs of pages the user chooses to import, sent to the user's own NotebookLM. |

Leave everything else unticked (no health, financial/payment, location, web history, user activity or personal communications collected by the extension; payments happen on Dodo Payments' checkout page, not in the extension).

Then certify all three:
- Not sold to third parties
- Not used or transferred for purposes unrelated to the single purpose
- Not used or transferred to determine creditworthiness or for lending

---

## Before you submit

- [ ] Supabase → Authentication → URL Configuration: add `https://www.notebooktools.com/account` to **Redirect URLs** (email confirmation and password-reset links land there)
- [ ] Supabase → Authentication → Emails → Templates: paste the branded templates from `supabase/templates/`
- [ ] Supabase → Authentication → Attack Protection: turn on **leaked password protection**
- [ ] Dodo dashboard: webhook endpoint points to `https://vgqfjwwnezwhzwfhpmkz.supabase.co/functions/v1/dodo-webhook` for `payment.succeeded` and `refund.succeeded`, live mode
- [ ] End-to-end test with a real purchase (refund it afterwards): buy → Pro unlocks in the extension → "Pro is active" email arrives → refund → plan returns to Free
- [ ] Update screenshots: add one of the notebooks dashboard and one of the upgrade dialog
- [ ] Build the zip, upload, paste the text above, update the privacy tab, submit
