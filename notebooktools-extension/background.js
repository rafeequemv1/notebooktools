importScripts("plan-gate.js", "account.js", "notebooklm-client.js", "link-extract.js", "snapshot-store.js", "snapshot-capture.js", "stats.js");

/* Shows the Pro upgrade dialog inside a tab (used when a Pro shortcut or menu runs from the background). */
async function showUpgradeInTab(tabId, featureKey) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["plan-gate.js"] });
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (key) => globalThis.NotebookToolsPlan?.showUpgrade(key),
      args: [featureKey]
    });
  } catch (_error) {
    // Pages like chrome:// block scripts: show it in the app instead.
    await openSidePanel(tabId, `upgrade=${encodeURIComponent(featureKey)}`).catch(() => {});
  }
}

/* Runs a Pro-only background action, or shows the upgrade dialog in the tab. */
async function runPro(featureKey, tab, action) {
  if (await NotebookToolsPlan.can(featureKey)) return action();
  if (tab?.id) await showUpgradeInTab(tab.id, featureKey);
  return null;
}

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

/* The app (Import, Bulk, Snapshots, Prompts) lives in the toolbar dropdown.
   To open it on a given tab or with options, point the dropdown at a URL with
   those options and open it; the page resets the URL once it has loaded. If
   Chrome can't open the dropdown (no focused window), use a small window. */
const APP_POPUP = "sidepanel.html?popup=1";

async function openAppPanel(query = "") {
  const popup = query ? `${APP_POPUP}&${query}` : APP_POPUP;
  try {
    await chrome.action.setPopup({ popup });
    await chrome.action.openPopup();
    return true;
  } catch (error) {
    await chrome.action.setPopup({ popup: APP_POPUP }).catch(() => {});
    await chrome.windows.create({
      url: chrome.runtime.getURL(`sidepanel.html${query ? `?${query}` : ""}`),
      type: "popup",
      width: 420,
      height: 720,
      focused: true
    });
    return true;
  }
}

// Kept for the callers below; the tab no longer matters.
async function openSidePanel(_tabId, query = "") {
  return openAppPanel(query);
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
  // Keep the cached plan current (picks up purchases and refunds).
  NotebookToolsAccount.getState().then((state) => {
    if (state.signedIn) NotebookToolsAccount.refreshProfile().catch(() => {});
  });
});

setupContextMenu();


/* ---------- Dev auto-reload (unpacked installs only) ----------
   scripts/dev-sync.ps1 / dev-sync.sh keep a local clone in sync with GitHub
   and write the current commit to dev-stamp.txt. When it changes, the
   extension reloads itself and refreshes the tabs it was running in.
   Store installs never have dev-stamp.txt and never poll. */
const DEV_STAMP_URL = chrome.runtime.getURL("dev-stamp.txt");
let devInstall = null;

function isDevInstall() {
  if (devInstall !== null) {
    return Promise.resolve(devInstall);
  }

  return new Promise((resolve) => {
    try {
      chrome.management.getSelf((info) => {
        devInstall = info?.installType === "development";
        resolve(devInstall);
      });
    } catch (_error) {
      devInstall = false;
      resolve(false);
    }
  });
}

async function devCheck(tabId) {
  if (!(await isDevInstall())) {
    return;
  }

  let stamp = "";

  try {
    const response = await fetch(DEV_STAMP_URL, { cache: "no-store" });
    stamp = response.ok ? (await response.text()).trim() : "";
  } catch (_error) {
    return;
  }

  if (!stamp) {
    return;
  }

  const { devStamp, devTabs = [] } = await chrome.storage.session.get(["devStamp", "devTabs"]);
  const tabs = tabId && !devTabs.includes(tabId) ? [...devTabs, tabId].slice(-20) : devTabs;

  if (devStamp && devStamp !== stamp) {
    await chrome.storage.local.set({ notebooktoolsDevReloadTabs: tabs });
    chrome.runtime.reload();
    return;
  }

  if (!devStamp || tabs !== devTabs) {
    await chrome.storage.session.set({ devStamp: stamp, devTabs: tabs });
  }
}

// After a dev reload, refresh the pages whose content scripts were cut off.
chrome.storage.local.get("notebooktoolsDevReloadTabs", ({ notebooktoolsDevReloadTabs: tabs }) => {
  if (!Array.isArray(tabs) || !tabs.length) {
    return;
  }

  chrome.storage.local.remove("notebooktoolsDevReloadTabs");
  tabs.forEach((id) => chrome.tabs.reload(id).catch(() => {}));
});

void devCheck();

// NotebookLM calls for the import panels shown inside other sites (YouTube, …).
// Inside youtube.com Chrome treats their requests to NotebookLM as third-party and
// often holds back the Google sign-in cookies; from here they are first-party.
const NLM_BRIDGE_METHODS = new Set([
  "listNotebookLmNotebooks", "createNotebookLmNotebook", "listNotebookLmSources", "getNotebookLmSourceCount",
  "addYoutubeToNotebookLm", "addWebpageToNotebookLm", "addTextToNotebookLm",
  "waitForYoutubeSourceReady", "waitForWebSourceReady",
  "createNotebookLmArtifact", "waitForNotebookLmArtifactReady"
]);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "notebooktools-nlm") {
    const fn = NLM_BRIDGE_METHODS.has(message.method) ? globalThis[message.method] : null;
    if (typeof fn !== "function") {
      sendResponse({ ok: false, error: "That NotebookLM action isn't available here." });
      return false;
    }
    Promise.resolve()
      .then(() => fn(...(Array.isArray(message.args) ? message.args : [])))
      .then((result) => sendResponse({ ok: true, result }), (error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  // Usage counters (stats.js): pages and content scripts report successful imports here.
  if (message?.type === "notebooktools-record-import") {
    if (!NotebookToolsStats.isAllowedKey(message.key)) {
      sendResponse({ ok: false });
      return false;
    }

    const count = Math.min(500, Math.max(0, Math.floor(Number(message.count) || 0)));
    NotebookToolsStats.bumpLocal(message.key, count).then((value) => {
      sendResponse({ ok: value !== null, value });
    });
    return true;
  }

  if (message?.type === "notebooktools-dev-check") {
    isDevInstall().then((dev) => {
      sendResponse({ dev });

      if (dev) {
        void devCheck(sender?.tab?.id);
      }
    });

    return true;
  }

  if (message?.type === "notebooktools-refresh-plan") {
    NotebookToolsAccount.refreshProfile()
      .then((profile) => sendResponse({ ok: true, plan: profile?.plan || "free" }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  // --- Ribbon inside Gemini Notebook ---
  if (message?.type === "notebooktools-ribbon-open-panel") {
    openAppPanel(message.query || "").then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "notebooktools-open-slide-editor") {
    void (async () => {
      const params = new URLSearchParams({ notebook: message.notebookId || "", artifact: message.artifactId || "", title: message.title || "Slide deck" });
      let authUser = message.authUser;
      if (authUser === undefined || authUser === null || authUser === "") {
        const stored = await chrome.storage.local.get("notebooktoolsAuthUser");
        authUser = stored.notebooktoolsAuthUser;
      }
      if (authUser !== undefined && authUser !== null && authUser !== "") params.set("authuser", String(authUser));
      chrome.tabs.create({ url: chrome.runtime.getURL(`slide-editor.html?${params}`) });
      sendResponse({ ok: true });
    })();
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
    // notebooks.html shows its own Pro lock screen for Free users.
    chrome.tabs.create({ url: chrome.runtime.getURL(`notebooks.html${query ? `?${query}` : ""}`) });
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "notebooktools-snapshot-continuous-start") {
    void (async () => {
      try {
        if (!(await NotebookToolsPlan.can("snapshots"))) {
          sendResponse({ ok: false, upgrade: "snapshots" });
          return;
        }
        const tab = message.tabId
          ? await chrome.tabs.get(Number(message.tabId))
          : sender.tab || (await NotebookToolsSnapshotCapture.resolveTargetTab());
        await startContinuous(tab, sender.tab && isNotebookUrl(sender.tab.url) ? sender.tab.id : null);
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "Couldn't start capturing." });
      }
    })();
    return true;
  }

  if (message?.type === "notebooktools-snapshot-continuous-done") {
    void (async () => {
      await finishContinuous(sender.tab).catch((error) => console.warn("NotebookTools: continuous capture", error));
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === "notebooktools-ribbon-snapshot") {
    void (async () => {
      try {
        if (!(await NotebookToolsPlan.can("snapshots"))) {
          sendResponse({ ok: false, upgrade: "snapshots" });
          return;
        }
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

  // Download a file through the open notebook tab, so it goes out with that
  // page's sign-in and origin, the way NotebookLM itself fetches it. Used by
  // the slide editor when a direct download is refused.
  if (message?.type === "notebooktools-fetch-via-notebook-tab") {
    void (async () => {
      try {
        const tab = await findNotebookTab(message.notebookId);
        if (!tab?.id) {
          sendResponse({ ok: false, error: "Open the notebook in a browser tab, then try again." });
          return;
        }
        sendResponse(await fetchInTab(tab.id, message.url));
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "Couldn't use the notebook tab." });
      }
    })();
    return true;
  }

  // The last resort, as NotebookLM's own button does it: open the deck's ⋮
  // menu in the notebook tab, choose Download → PDF, pick up that download,
  // read it through the tab, then take it back out of the Downloads folder.
  // Needs the optional "downloads" permission (asked for by the editor).
  if (message?.type === "notebooktools-deck-via-notebook-download") {
    void (async () => {
      try {
        sendResponse(await deckViaNotebookDownload(message.notebookId, message.title, sender?.tab));
      } catch (error) {
        sendResponse({ ok: false, error: error.message || "Couldn't download the deck through NotebookLM." });
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

/* ---------- Continuous capture ----------
   One session at a time. The bar follows the active tab; Done goes back to
   the notebook it was started from and opens the review box there. */
const CONTINUOUS_KEY = "notebooktoolsContinuousCapture";

function isNotebookUrl(url = "") {
  return /^https:\/\/notebook(lm)?\.google\.com\//i.test(String(url));
}

async function continuousState() {
  const stored = await chrome.storage.session.get(CONTINUOUS_KEY).catch(() => ({}));
  return stored[CONTINUOUS_KEY] || null;
}

async function startContinuous(tab, notebookTabId) {
  if (!tab?.id) throw new Error("No tab to capture.");
  if (!NotebookToolsSnapshotCapture.isCapturableUrl(tab.url)) throw new Error("This page can't be captured. Switch to a website tab.");
  await chrome.storage.session.set({ [CONTINUOUS_KEY]: { active: true, notebookTabId: notebookTabId || null, startedAt: Date.now() } });
  await NotebookToolsSnapshotCapture.injectContinuous(tab.id);
}

async function followContinuous(tabId) {
  const state = await continuousState();
  if (!state?.active) return;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab?.active || !NotebookToolsSnapshotCapture.isCapturableUrl(tab.url)) return;
  await NotebookToolsSnapshotCapture.injectContinuous(tab.id).catch(() => {});
}

async function finishContinuous(fromTab) {
  const state = await continuousState();
  await chrome.storage.session.remove(CONTINUOUS_KEY);
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((t) => chrome.tabs.sendMessage(t.id, { type: "ntcc-stop" }).catch(() => {})));
  const notebookTab = state?.notebookTabId ? await chrome.tabs.get(state.notebookTabId).catch(() => null) : null;
  if (notebookTab) {
    await chrome.tabs.update(notebookTab.id, { active: true });
    await chrome.windows.update(notebookTab.windowId, { focused: true }).catch(() => {});
    const opened = await chrome.tabs.sendMessage(notebookTab.id, { type: "ntsr-open-review" }).catch(() => null);
    if (opened?.ok) return;
    await NotebookToolsSnapshotCapture.openReviewOnTab(notebookTab.id);
    return;
  }
  if (fromTab?.id) await NotebookToolsSnapshotCapture.openReviewOnTab(fromTab.id);
}

chrome.tabs.onActivated.addListener(({ tabId }) => void followContinuous(tabId));
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "complete") void followContinuous(tabId);
});

async function startSnapshotCapture(tab) {
  if (!tab?.id) {
    throw new Error("No active tab to capture.");
  }

  // Snapshots are saved to the Snapshots view of the toolbar dropdown. The
  // dropdown isn't opened here: it would close as soon as the user clicks
  // the page to draw the capture area.
  await NotebookToolsSnapshotCapture.startOverlay(tab.id);
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "capture-snapshot") {
    try {
      const tab = await NotebookToolsSnapshotCapture.resolveTargetTab();
      // During continuous capture the shortcut drags an area on the bar's tab
      if ((await continuousState())?.active && tab?.id) {
        await NotebookToolsSnapshotCapture.injectContinuous(tab.id);
        await chrome.tabs.sendMessage(tab.id, { type: "ntcc-area" });
        return;
      }
      await runPro("snapshots", tab, () => startSnapshotCapture(tab, true));
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
      await runPro("snapshots", tab, () => startSnapshotCapture(tab, true));
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


/* ---------- Slide editor: getting a deck's file out of NotebookLM ---------- */

async function findNotebookTab(notebookId) {
  const tabs = await chrome.tabs.query({ url: ["https://notebook.google.com/*", "https://notebooklm.google.com/*"] });
  return tabs.find((t) => notebookId && String(t.url || "").includes(notebookId))
    || tabs.find((t) => t.active)
    || tabs[0]
    || null;
}

/** Fetch `url` inside the tab (its sign-in, its origin, blob: links too); base64 back. */
async function fetchInTab(tabId, url) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [String(url || "")],
    func: async (target) => {
      try {
        const response = await fetch(target, { credentials: "include" });
        if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
        const blob = await response.blob();
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        return { ok: true, data, type: blob.type };
      } catch (error) {
        return { ok: false, error: String(error?.message || error) };
      }
    }
  });
  return injection?.result || { ok: false, error: "No result from the notebook tab." };
}

const NOTEBOOK_HOST = /^https:\/\/notebook(lm)?\.google\.com\//i;
const isDeckDownload = (item) => /\.(pdf|pptx)$/i.test(item.filename || "") || /pdf|presentation/i.test(item.mime || "");
const fromNotebookTab = (item) => NOTEBOOK_HOST.test(item.referrer || "") || NOTEBOOK_HOST.test(item.url || "") || /usercontent\.google\.com|googleusercontent\.com/i.test(item.finalUrl || item.url || "");

/** The next finished deck download from NotebookLM, started after `since`. */
function nextDeckDownload(since, timeoutMs) {
  return new Promise((resolve) => {
    const done = (item) => {
      chrome.downloads.onChanged.removeListener(onChanged);
      clearTimeout(timer);
      resolve(item);
    };
    const onChanged = async (delta) => {
      if (delta.state?.current !== "complete") return;
      const [item] = await chrome.downloads.search({ id: delta.id });
      if (item && Date.parse(item.startTime) >= since - 2000 && isDeckDownload(item) && fromNotebookTab(item)) done(item);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    chrome.downloads.onChanged.addListener(onChanged);
  });
}

async function deckViaNotebookDownload(notebookId, title, editorTab) {
  if (!chrome.downloads || !(await chrome.permissions.contains({ permissions: ["downloads"] }))) {
    return { ok: false, needPermission: true, error: "NotebookTools needs permission to pick up the download." };
  }
  const tab = await findNotebookTab(notebookId);
  if (!tab?.id) return { ok: false, error: "Open the notebook in a browser tab, then try again." };
  const since = Date.now();
  const download = nextDeckDownload(since, 90000);
  // Background tabs are throttled and NotebookLM's menus may not open there:
  // bring the notebook forward for the click, as a person would, then go back.
  await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
  await chrome.tabs.update(tab.id, { active: true }).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const clicked = await chrome.tabs.sendMessage(tab.id, { type: "ntde-download-deck", title }).catch(() => null);
  if (editorTab?.id) {
    await chrome.windows.update(editorTab.windowId, { focused: true }).catch(() => undefined);
    await chrome.tabs.update(editorTab.id, { active: true }).catch(() => undefined);
  }
  if (!clicked?.ok) {
    return { ok: false, error: clicked?.error || "Reload the notebook tab (so NotebookTools can reach it), open the deck, then try again." };
  }
  const item = await download;
  if (!item) return { ok: false, error: "The download didn't arrive. Download the PDF from the deck's ⋮ menu, then click Open in the editor." };
  if (!/\.pdf$/i.test(item.filename || "") && !/pdf/i.test(item.mime || "")) {
    return { ok: false, error: "NotebookLM gave a PowerPoint file, not a PDF. Download the deck as PDF, then click Open in the editor." };
  }
  const url = item.finalUrl || item.url;
  let result = await fetchInTab(tab.id, url);
  if (!result.ok && /^https?:/i.test(url)) {
    try {
      const response = await fetch(url, { credentials: "include" });
      if (response.ok) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        result = { ok: true, data: btoa(binary), type: response.headers.get("content-type") || "application/pdf" };
      }
    } catch (_error) {
      /* keep the tab's answer */
    }
  }
  if (result.ok) {
    // The editor has the deck now; keep Downloads tidy
    await chrome.downloads.removeFile(item.id).catch(() => undefined);
    await chrome.downloads.erase({ id: item.id }).catch(() => undefined);
    return { ...result, name: String(item.filename || "").split(/[\\/]/).pop() };
  }
  return { ok: false, error: `The deck was saved to Downloads (${String(item.filename || "").split(/[\\/]/).pop()}) but couldn't be read. Click Open in the editor and choose it.` };
}
