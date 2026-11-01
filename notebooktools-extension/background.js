importScripts("notebooklm-client.js", "link-extract.js", "snapshot-store.js", "snapshot-capture.js");

const PENDING_TEXT_KEY = "pendingTextImport";
const PENDING_LINK_EXTRACT_KEY = "pendingLinkExtract";

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

    chrome.contextMenus.create(
      {
        id: "notebooktools-extract-links",
        title: "Extract links to Notebook",
        contexts: ["page"],
        documentUrlPatterns: ["http://*/*", "https://*/*"]
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error("NotebookTools contextMenus.create:", chrome.runtime.lastError.message);
        }
      }
    );

    chrome.contextMenus.create(
      {
        id: "notebooktools-capture-snapshot",
        title: "Capture snapshot area",
        contexts: ["page"],
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

async function openSidePanel(tabId, query = "") {
  if (!tabId || !chrome.sidePanel?.open) {
    return false;
  }

  const path = query ? `sidepanel.html?${query}` : "sidepanel.html";

  try {
    await chrome.sidePanel.setOptions({ tabId, path });
    await chrome.sidePanel.open({ tabId });
    return true;
  } catch (error) {
    console.warn("NotebookTools openSidePanel:", error);
    return false;
  }
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

if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => {
      console.warn("NotebookTools sidePanel.setPanelBehavior:", error);
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // --- Ribbon inside Gemini Notebook ---
  if (message?.type === "notebooktools-ribbon-open-panel") {
    const tabId = sender?.tab?.id;
    const path = `sidepanel.html?${message.query || ""}`;

    if (tabId && chrome.sidePanel?.open) {
      // Call open() right away so Chrome still counts the click as a user gesture.
      chrome.sidePanel.setOptions({ tabId, path }).catch(() => {});
      chrome.sidePanel
        .open({ tabId })
        .then(() => sendResponse({ ok: true }))
        .catch(() => {
          chrome.windows.create({ url: chrome.runtime.getURL(path), type: "popup", width: 420, height: 760 });
          sendResponse({ ok: true, popup: true });
        });
    } else {
      chrome.windows.create({ url: chrome.runtime.getURL(path), type: "popup", width: 420, height: 760 });
      sendResponse({ ok: true, popup: true });
    }

    return true;
  }

  if (message?.type === "notebooktools-ribbon-open-hub") {
    const params = new URLSearchParams();

    if (message.notebookId) {
      params.set("notebook", message.notebookId);
      params.set("tab", message.tab || "sources");

      if (message.title) {
        params.set("title", String(message.title).replace(/\s*[-–|]\s*(Gemini Notebook|NotebookLM).*$/i, ""));
      }
    }

    const query = params.toString();
    chrome.tabs.create({ url: chrome.runtime.getURL(`notebooks.html${query ? `?${query}` : ""}`) });
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "notebooktools-ribbon-snapshot") {
    void (async () => {
      try {
        await startSnapshotCapture(sender.tab, true);
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "Snapshot failed." });
      }
    })();

    return true;
  }

  if (message?.type === "notebooktools-store-platform-import") {
    platformImportCache = message.payload || null;
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "notebooktools-get-platform-import") {
    sendResponse({ payload: platformImportCache });
    return true;
  }

  if (message?.type === "notebooktools-extract-tab-links") {
    void (async () => {
      try {
        const tabId = Number(message.tabId);

        if (!tabId) {
          sendResponse({ ok: false, error: "No active tab." });
          return;
        }

        const links = await NotebookToolsLinkExtract.extractLinksFromTab(tabId);
        sendResponse({ ok: true, links });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "Extract failed." });
      }
    })();

    return true;
  }

  if (message?.type === "notebooktools-start-snapshot-overlay") {
    void (async () => {
      try {
        const tab = await NotebookToolsSnapshotCapture.startOverlay(message.tabId);
        sendResponse({ ok: true, tabId: tab.id });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "Could not start capture overlay." });
      }
    })();

    return true;
  }

  if (message?.type === "notebooktools-save-snapshot") {
    void (async () => {
      try {
        const senderTab = sender?.tab;

        if (!senderTab?.id) {
          sendResponse({ ok: false, error: "Capture must run on a webpage tab." });
          return;
        }

        const dataUrl = String(message.dataUrl || "").trim();

        if (!dataUrl.startsWith("data:image/")) {
          sendResponse({ ok: false, error: "Invalid snapshot image." });
          return;
        }

        const saved = await NotebookToolsSnapshotCapture.saveSnapshotFromTab(senderTab, dataUrl);
        sendResponse({ ok: true, ...saved });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "Could not save snapshot." });
      }
    })();

    return true;
  }

  if (message?.type === "notebooktools-start-auto-capture") {
    void (async () => {
      try {
        const tab = await NotebookToolsSnapshotCapture.startAutoCapture(message.tabId);
        sendResponse({ ok: true, tabId: tab.id });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "Could not start auto capture." });
      }
    })();

    return true;
  }

  if (message?.type === "notebooktools-stop-auto-capture") {
    void (async () => {
      try {
        const tab = await NotebookToolsSnapshotCapture.stopAutoCapture(message.tabId);
        sendResponse({ ok: true, tabId: tab?.id || null });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "Could not stop auto capture." });
      }
    })();

    return true;
  }

  if (message?.type === "notebooktools-auto-capture-shot") {
    void (async () => {
      try {
        const senderTab = sender?.tab;
        const stored = await chrome.storage.session.get("notebooktoolsAutoCapture");
        const tab = senderTab?.id
          ? senderTab
          : await NotebookToolsSnapshotCapture.resolveTargetTab(
              stored.notebooktoolsAutoCapture?.tabId || message.tabId
            );

        if (!tab?.id) {
          sendResponse({ ok: false, error: "No tab available for snapshot storage." });
          return;
        }

        const saved = await NotebookToolsSnapshotCapture.captureAutoShot(tab, {
          action: String(message.action || message.caption || "").trim(),
          actionType: String(message.actionType || message.triggerType || "manual").trim(),
          caption: String(message.caption || message.action || "").trim(),
          triggerType: String(message.triggerType || message.actionType || "manual").trim()
        });
        sendResponse({ ok: true, ...saved });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "Auto capture failed." });
      }
    })();

    return true;
  }

  if (message?.type === "notebooktools-annotate-snapshot") {
    void (async () => {
      try {
        const snapshotId = String(message.snapshotId || "").trim();
        const dataUrl = String(message.dataUrl || "").trim();

        if (!snapshotId || !dataUrl.startsWith("data:image/")) {
          sendResponse({ ok: false, error: "Invalid snapshot for annotation." });
          return;
        }

        const result = await NotebookToolsSnapshotCapture.annotateSnapshotOnTab(
          message.tabId,
          snapshotId,
          dataUrl
        );
        sendResponse({ ok: true, ...result });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "Could not annotate snapshot." });
      }
    })();

    return true;
  }

  if (message?.type === "notebooktools-auto-capture-started") {
    void (async () => {
      const stored = await chrome.storage.session.get("notebooktoolsAutoCapture");
      await chrome.storage.session.set({
        notebooktoolsAutoCapture: {
          ...stored.notebooktoolsAutoCapture,
          tabId: sender?.tab?.id || stored.notebooktoolsAutoCapture?.tabId || null,
          active: true,
          startedAt: stored.notebooktoolsAutoCapture?.startedAt || Date.now()
        }
      });
      sendResponse({ ok: true });
    })();

    return true;
  }

  if (message?.type === "notebooktools-auto-capture-stopped") {
    void chrome.storage.session.remove("notebooktoolsAutoCapture");
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "notebooktools-capture-region") {
    void (async () => {
      try {
        const senderTab = sender?.tab;
        const tab = senderTab?.id
          ? senderTab
          : await NotebookToolsSnapshotCapture.resolveTargetTab(message.tabId);

        if (message.dataUrl?.startsWith("data:image/")) {
          if (message.returnDataOnly) {
            sendResponse({ ok: true, dataUrl: message.dataUrl });
            return;
          }

          const saved = await NotebookToolsSnapshotCapture.saveSnapshotFromTab(tab, message.dataUrl);
          sendResponse({ ok: true, ...saved });
          return;
        }

        const dataUrl = await NotebookToolsSnapshotCapture.captureTabRegion(
          tab,
          message.rect || null,
          message.devicePixelRatio || 1
        );

        if (message.returnDataOnly) {
          sendResponse({ ok: true, dataUrl });
          return;
        }

        const saved = await NotebookToolsSnapshotCapture.saveSnapshotFromTab(tab, dataUrl);
        sendResponse({ ok: true, ...saved });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "Capture failed." });
      }
    })();

    return true;
  }

  if (message?.type === "notebooktools-capture-snapshot") {
    void (async () => {
      try {
        const tab = await NotebookToolsSnapshotCapture.resolveTargetTab(message.tabId);

        if (!tab?.id) {
          sendResponse({ ok: false, error: "No active tab to capture." });
          return;
        }

        await NotebookToolsSnapshotCapture.startOverlay(tab.id);
        sendResponse({ ok: true, overlay: true, tabId: tab.id });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "Capture failed." });
      }
    })();

    return true;
  }

  if (message?.type === "notebooktools-fetch-media") {
    void (async () => {
      try {
        const response = await fetch(String(message.url || ""), {
          credentials: "include",
          redirect: "follow"
        });

        if (!response.ok) {
          sendResponse({ ok: false, error: `HTTP ${response.status}` });
          return;
        }

        const buffer = await response.arrayBuffer();

        sendResponse({
          ok: true,
          buffer: Array.from(new Uint8Array(buffer)),
          type: response.headers.get("content-type") || "audio/mpeg"
        });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "Fetch failed" });
      }
    })();

    return true;
  }

  return false;
});

async function startSnapshotCapture(tab, openPanel = true) {
  if (!tab?.id) {
    throw new Error("No active tab to capture.");
  }

  await NotebookToolsSnapshotCapture.startOverlay(tab.id);

  if (!openPanel) {
    return;
  }

  const opened = await openSidePanel(tab.id, "panel=snapshots");

  if (!opened) {
    await chrome.windows.create({
      url: chrome.runtime.getURL("sidepanel.html?panel=snapshots"),
      type: "popup",
      width: 420,
      height: 720,
      focused: false
    });
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "capture-snapshot") {
    try {
      const tab = await NotebookToolsSnapshotCapture.resolveTargetTab();
      await startSnapshotCapture(tab, true);
    } catch (error) {
      console.error("NotebookTools snapshot shortcut failed:", error);
    }
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "notebooktools-capture-snapshot") {
    if (!tab?.id) {
      return;
    }

    try {
      await startSnapshotCapture(tab, true);
    } catch (error) {
      console.error("NotebookTools snapshot capture failed:", error);
    }

    return;
  }

  if (info.menuItemId === "notebooktools-extract-links") {
    if (!tab?.id) {
      return;
    }

    try {
      const links = await NotebookToolsLinkExtract.extractLinksFromTab(tab.id);

      await chrome.storage.session.set({
        [PENDING_LINK_EXTRACT_KEY]: {
          links,
          pageUrl: tab.url || "",
          pageTitle: tab.title || "Page"
        }
      });

      const opened = await openSidePanel(tab.id, "panel=bulk&extract=1");

      if (!opened) {
        await chrome.windows.create({
          url: chrome.runtime.getURL("sidepanel.html?panel=bulk&extract=1"),
          type: "popup",
          width: 420,
          height: 640,
          focused: true
        });
      }
    } catch (error) {
      console.error("NotebookTools link extract failed:", error);
    }

    return;
  }

  if (info.menuItemId === "notebooktools-add-selection") {
    if (!info.selectionText?.trim()) {
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

      const popupUrl = chrome.runtime.getURL(`sidepanel.html?mode=text`);
      const opened = tab?.id ? await openSidePanel(tab.id, "mode=text") : false;

      if (!opened) {
        await chrome.windows.create({
          url: popupUrl,
          type: "popup",
          width: 380,
          height: 520,
          focused: true
        });
      }
    } catch (error) {
      console.error("NotebookTools context menu import failed:", error);
    }
  }
});
