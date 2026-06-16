# NotebookTools

NotebookTools is a Chrome extension and website for sending YouTube videos to NotebookLM.

## Folders

- `notebooktools-extension` — development copy of the Chrome MV3 extension
- `version 0.1/` — **Chrome Web Store submission package** (zip the `extension` folder)
- `website` — landing page and privacy policy for Vercel hosting

## Version 0.1 features

- Import the current YouTube video into a signed-in NotebookLM notebook
- In-page **NotebookLM** button beside YouTube action buttons
- Create a new NotebookLM notebook from the popup before importing

## Install locally

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select `version 0.1/extension` (or `notebooktools-extension`)

## Chrome Web Store upload

See [`version 0.1/README.md`](version%200.1/README.md) for packaging and listing instructions.

```powershell
cd "version 0.1"
.\package-extension.ps1
```

Upload `notebooktools-v0.1.0.zip` in the Chrome Developer Dashboard.

## NotebookLM direct import

NotebookLM does not provide a public browser extension API. YouTube import uses your signed-in NotebookLM browser session. If import fails, open [NotebookLM](https://notebooklm.google.com/), confirm you are signed in, refresh the extension popup, and try again.

## Disclaimer

NotebookTools is an independent project and is not affiliated with Google or NotebookLM.
