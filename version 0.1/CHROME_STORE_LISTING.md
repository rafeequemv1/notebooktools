# Chrome Web Store listing — NotebookTools v0.1

Use the fields below in the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Extension name

```
NotebookTools — YouTube to NotebookLM
```

## Short description (132 chars max)

```
Import YouTube videos into NotebookLM notebooks with one click from YouTube or the extension popup.
```

## Detailed description

```
NotebookTools helps you send YouTube videos to NotebookLM without copying links manually.

WHAT IT DOES
• Adds a NotebookLM button on YouTube watch pages
• Lets you import the current video from the extension popup
• Lists your NotebookLM notebooks and supports creating a new notebook
• Uses your existing signed-in NotebookLM browser session

HOW TO USE
1. Sign in to NotebookLM at notebooklm.google.com
2. Open any YouTube video
3. Click the in-page NotebookLM button or open the NotebookTools popup
4. Choose a notebook (or create a new one) and import

VERSION 0.1
This first release focuses on YouTube import only. More research capture features are planned.

PRIVACY
NotebookTools does not run its own servers. Video URLs are sent to NotebookLM only when you click import. See the privacy policy URL in this listing.

NOT AFFILIATED WITH GOOGLE
NotebookTools is an independent extension and is not affiliated with Google or NotebookLM.
```

## Category

```
Productivity
```

## Language

```
English
```

## Single purpose description (for review)

```
This extension imports YouTube video URLs into the user's NotebookLM notebooks using their signed-in NotebookLM session.
```

## Permission justifications

### activeTab
```
Needed to read the active YouTube video URL when the user opens the extension popup and clicks import.
```

### storage
```
Stores lightweight extension preferences locally on the user's device.
```

### Host permissions — youtube.com / youtu.be
```
Required to inject the in-page import button on YouTube watch pages and to identify the current video URL.
```

### Host permissions — notebooklm.google.com
```
Required to list notebooks and send YouTube video sources to the user's NotebookLM account through the signed-in browser session.
```

## Privacy policy URL

Host `website/privacy.html` on your domain, for example:

```
https://YOUR-VERCEL-URL.vercel.app/privacy.html
```

## Icons (included in package)

- 16×16 — `extension/icons/icon16.png`
- 48×48 — `extension/icons/icon48.png`
- 128×128 — `extension/icons/icon128.png`

## Suggested screenshots

Capture at 1280×800:

1. YouTube watch page showing the white **NotebookLM** button beside Share
2. Extension popup with notebook dropdown on a YouTube tab
3. NotebookLM notebook showing the imported YouTube source

## Support URL (optional)

```
https://github.com/rafeequemv1/notebooktools/issues
```
