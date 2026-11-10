# NotebookTools

NotebookTools is a Chrome extension and website for sending YouTube videos to NotebookLM.

## Folders

- `notebooktools-extension` — development copy of the Chrome MV3 extension
- `version 0.1/` — old v0.2.3 store package (outdated; build from `notebooktools-extension` instead)
- `website` — landing page and privacy policy for Vercel hosting

## Version 0.1 features

- Import the current YouTube video into a signed-in NotebookLM notebook
- In-page **NotebookLM** button beside YouTube action buttons
- Create a new NotebookLM notebook from the popup before importing

## Install locally

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select `notebooktools-extension`

## Chrome Web Store upload

```bash
bash scripts/build-extension-zip.sh
```

Upload `dist/notebooktools-extension.zip`. Listing text, permission justifications, privacy answers
and the pre-submit checklist are in [`docs/CHROME_STORE_LISTING.md`](docs/CHROME_STORE_LISTING.md).

## Free and Pro

Free covers every import option; Pro ($49 one-time, Dodo Payments) unlocks everything else.
Which features are Pro is set in one place: `notebooktools-extension/plan-gate.js`.

## NotebookLM direct import

NotebookLM does not provide a public browser extension API. YouTube import uses your signed-in NotebookLM browser session. If import fails, open [NotebookLM](https://notebooklm.google.com/), confirm you are signed in, refresh the extension popup, and try again.

## Disclaimer

NotebookTools is an independent project and is not affiliated with Google or NotebookLM.
