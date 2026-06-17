# NotebookTools v0.2.3 — Chrome Web Store package

Everything needed to submit **NotebookTools** to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Included

| Path | Purpose |
|------|---------|
| `extension/` | Load unpacked in Chrome, or zip for store upload |
| `store-assets/` | Store icon, screenshots, promo tiles (run `generate-store-assets.ps1`) |
| `CHROME_STORE_LISTING.md` | SEO-optimized store copy, permissions, checklist |
| `PRIVACY_POLICY.md` | Mirror of hosted policy at notebooktools.com/privacy |
| `package-extension.ps1` | Creates `notebooktools-v0.2.3.zip` |

## v0.2.3 features

- YouTube watch page import (in-page button, one video at a time)
- Fast button injection alongside Like/Share (works during ads)
- X / Twitter threads and articles
- Webpage URL import from popup
- Right-click selected text → Add to NotebookLM
- Searchable notebook picker + last-used notebook memory
- Welcome page on first install

## Quick test (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `extension` folder here
4. Open [NotebookLM](https://notebooklm.google.com/) and sign in
5. Test on YouTube watch pages, X, or any webpage

## Package for upload

```powershell
cd "version 0.1"
.\store-assets\generate-store-assets.ps1
.\package-extension.ps1
```

Upload `notebooktools-v0.2.3.zip` to the developer dashboard. See `CHROME_STORE_LISTING.md` for all listing fields and screenshot uploads.

## Disclaimer

NotebookTools is independent and **not affiliated with Google or NotebookLM**.
