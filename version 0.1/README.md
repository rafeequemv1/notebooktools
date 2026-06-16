# NotebookTools v0.1.0 — Chrome Web Store package

Everything needed to submit **NotebookTools** to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Included

| Path | Purpose |
|------|---------|
| `extension/` | Load unpacked in Chrome, or zip for store upload |
| `CHROME_STORE_LISTING.md` | SEO-optimized store copy, permissions, checklist |
| `PRIVACY_POLICY.md` | Mirror of hosted policy at notebooktools.vercel.app/privacy |
| `package-extension.ps1` | Creates `notebooktools-v0.1.0.zip` |

## v0.1.0 features

- YouTube import (in-page button + popup)
- ChatGPT & Gemini conversation import
- X / Twitter threads and articles
- Webpage URL import from popup
- Right-click selected text → Add to NotebookLM
- Create or choose NotebookLM notebooks

## Quick test (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `extension` folder here
4. Open [NotebookLM](https://notebooklm.google.com/) and sign in
5. Test on YouTube, ChatGPT, Gemini, or any webpage

## Package for upload

```powershell
cd "version 0.1"
.\package-extension.ps1
```

Upload `notebooktools-v0.1.0.zip` to the developer dashboard. See `CHROME_STORE_LISTING.md` for all listing fields.

## Disclaimer

NotebookTools is independent and **not affiliated with Google or NotebookLM**.
