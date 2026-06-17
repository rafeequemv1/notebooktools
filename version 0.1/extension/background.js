importScripts("notebooklm-client.js");

const PENDING_TEXT_KEY = "pendingTextImport";

let platformImportCache = null;

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.warn("NotebookTools contextMenus.removeAll:", chrome.runtime.lastError.message);
    }

    chrome.contextMenus.create(
      {
        id: "notebooktools-add-selection",
        title: "Add to NotebookLM",
        contexts: ["selection"],
        documentUrlPatterns: ["http://*/*", "https://*/*"]
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error("NotebookTools contextMenus.create:", chrome.runtime.lastError.message);
        }
      }
    );
  });
}

async function openWelcomeOnce() {
  const stored = await chrome.storage.local.get("welcomeShown");

  if (stored.welcomeShown) {
    return;
  }

  await chrome.storage.local.set({ welcomeShown: true });
  chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
}

chrome.runtime.onInstalled.addListener((details) => {
  setupContextMenu();

  if (details.reason === "install") {
    openWelcomeOnce();
  }
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenu();
});

setupContextMenu();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "notebooktools-store-platform-import") {
    platformImportCache = message.payload || null;
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "notebooktools-get-platform-import") {
    sendResponse({ payload: platformImportCache });
    return true;
  }

  return false;
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "notebooktools-add-selection" || !info.selectionText?.trim()) {
    return;
  }

  const pageTitle = tab?.title || "Selected text";
  const pageUrl = tab?.url || "";
  const title = pageTitle.length > 80 ? `${pageTitle.slice(0, 77)}...` : pageTitle;

  try {
    await chrome.storage.session.set({
      [PENDING_TEXT_KEY]: {
        text: info.selectionText.trim(),
        title,
        pageUrl
      }
    });

    const popupUrl = chrome.runtime.getURL(
      `popup.html?mode=text&title=${encodeURIComponent(title)}`
    );

    await chrome.windows.create({
      url: popupUrl,
      type: "popup",
      width: 380,
      height: 520,
      focused: true
    });
  } catch (error) {
    console.error("NotebookTools context menu import failed:", error);
  }
});
