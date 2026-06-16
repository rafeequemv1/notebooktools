# NotebookTools

NotebookTools is a simple Chrome extension and website starter for collecting webpage research for NotebookLM workflows.

## Folders

- `notebooktools-extension` contains the Chrome Manifest V3 addon.
- `website` contains the static NotebookTools.com landing page.

## Extension Features

- Import the current YouTube video into a signed-in NotebookLM notebook.
- Use the in-page **NotebookLM** button that appears beside YouTube's video action buttons.
- Create a new NotebookLM notebook from the popup before importing a YouTube video.
- Right-click selected text on any webpage and choose **Add selection to NotebookTools**.
- Click the extension icon to add the entire current webpage.
- Save captures into an existing local notebook or type a new notebook name.
- Open NotebookLM from the extension after saving research.

## Install the Extension Locally

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the `notebooktools-extension` folder.

## NotebookLM Direct Import

NotebookLM does not provide a public browser extension API. The YouTube import feature uses the signed-in NotebookLM browser session and NotebookLM web RPCs. If import fails, open `https://notebooklm.google.com/`, confirm you are signed in, refresh the extension popup, and try again.

Local capture remains available as a fallback for selected text and full webpage notes.
