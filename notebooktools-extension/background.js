const CONTEXT_MENU_ID = "notebooktools-save-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Add selection to NotebookTools",
      contexts: ["selection"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) {
    return;
  }

  const pendingCapture = {
    id: crypto.randomUUID(),
    type: "selection",
    title: tab?.title || "Selected text",
    url: info.pageUrl || tab?.url || "",
    content: info.selectionText || "",
    createdAt: new Date().toISOString()
  };

  await chrome.storage.session.set({ pendingCapture });

  chrome.windows.create({
    url: chrome.runtime.getURL("capture.html"),
    type: "popup",
    width: 480,
    height: 640
  });
});
