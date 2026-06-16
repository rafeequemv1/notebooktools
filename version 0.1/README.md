# NotebookTools v0.1 — Chrome Web Store package

This folder contains everything needed to submit **NotebookTools v0.1** to the Chrome Developer Dashboard.

## What is included

| Path | Purpose |
|---|---|
| `extension/` | Load unpacked in Chrome, or zip for store upload |
| `CHROME_STORE_LISTING.md` | Copy for store title, description, and permissions justification |
| `PRIVACY_POLICY.md` | Host on your website and paste the URL in the store listing |
| `package-extension.ps1` | Creates `notebooktools-v0.1.0.zip` from the extension folder |

## Quick test (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension` folder inside this directory

## Upload to Chrome Web Store

1. Zip the **contents** of `extension/` (not the parent folder itself):

   ```powershell
   .\package-extension.ps1
   ```

2. Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Create a new item (or new draft version)
4. Upload `notebooktools-v0.1.0.zip`
5. Paste listing text from `CHROME_STORE_LISTING.md`
6. Add privacy policy URL (e.g. `https://your-domain.com/privacy.html`)
7. Upload screenshots (1280×800 or 640×400) showing:
   - YouTube page with the in-page NotebookLM button
   - Extension popup with notebook selector
   - Successful import confirmation
8. Submit for review

## Version 0.1 scope

- YouTube video import to NotebookLM
- In-page button on YouTube watch pages
- Extension popup import on YouTube tabs

Future versions will add more capture features.

## Disclaimer

NotebookTools is an independent project and is **not affiliated with, endorsed by, or sponsored by Google or NotebookLM**.
