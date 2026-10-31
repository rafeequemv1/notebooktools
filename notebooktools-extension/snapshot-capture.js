const NotebookToolsSnapshotCapture = {
  isCapturableUrl(url = "") {
    const value = String(url || "").trim().toLowerCase();

    if (!value) {
      return false;
    }

    if (
      value.startsWith("chrome://") ||
      value.startsWith("chrome-extension://") ||
      value.startsWith("edge://") ||
      value.startsWith("about:") ||
      value.startsWith("devtools://")
    ) {
      return false;
    }

    return value.startsWith("http://") || value.startsWith("https://");
  },

  async resolveTargetTab(tabId) {
    if (tabId) {
      return chrome.tabs.get(Number(tabId));
    }

    const candidates = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

    if (candidates[0]) {
      return candidates[0];
    }

    const [fallback] = await chrome.tabs.query({ active: true, currentWindow: true });
    return fallback || null;
  },

  async blobToDataUrl(blob) {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";

    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }

    const type = blob.type || "image/png";
    return `data:${type};base64,${btoa(binary)}`;
  },

  async cropDataUrl(dataUrl, rect, devicePixelRatio = 1) {
    const dpr = Number(devicePixelRatio) > 0 ? Number(devicePixelRatio) : 1;
    const x = Math.max(0, Math.round(Number(rect?.x || 0) * dpr));
    const y = Math.max(0, Math.round(Number(rect?.y || 0) * dpr));
    const width = Math.max(1, Math.round(Number(rect?.width || 0) * dpr));
    const height = Math.max(1, Math.round(Number(rect?.height || 0) * dpr));
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");

    context.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
    bitmap.close();

    const output = await canvas.convertToBlob({ type: "image/png" });
    return this.blobToDataUrl(output);
  },

  async captureTabRegion(tab, rect = null, devicePixelRatio = 1) {
    if (!tab?.id || !tab.windowId) {
      throw new Error("No browser tab to capture.");
    }

    if (!this.isCapturableUrl(tab.url)) {
      throw new Error("Cannot capture this page. Open a regular http or https website.");
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });

    if (!rect || !rect.width || !rect.height) {
      return dataUrl;
    }

    return this.cropDataUrl(dataUrl, rect, devicePixelRatio);
  },

  async ensureAnnotateScripts(tabId) {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["snapshot-annotate.css"]
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["snapshot-annotate.js"]
    });
  },

  async startAutoCapture(tabId) {
    const tab = await this.resolveTargetTab(tabId);

    if (!tab?.id) {
      throw new Error("No active tab found. Click the page you want to record first.");
    }

    if (!this.isCapturableUrl(tab.url)) {
      throw new Error("Cannot capture this page. Switch to a regular website tab.");
    }

    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["snapshot-auto-capture.css"]
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["snapshot-auto-capture.js"]
    });

    await chrome.storage.session.set({
      notebooktoolsAutoCapture: { tabId: tab.id, active: true, startedAt: Date.now() }
    });

    return tab;
  },

  async stopAutoCapture(tabId) {
    const stored = await chrome.storage.session.get("notebooktoolsAutoCapture");
    const tab = await this.resolveTargetTab(tabId || stored.notebooktoolsAutoCapture?.tabId);

    if (tab?.id) {
      await chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: () => {
            document.getElementById("notebooktools-auto-capture-bar")?.remove();
            document.documentElement.removeAttribute("data-notebooktools-auto-capture");
          }
        })
        .catch(() => {});
    }

    await chrome.storage.session.remove("notebooktoolsAutoCapture");
    return tab;
  },

  async captureAutoShot(tab, payload = {}) {
    const caption = String(payload.caption || payload.action || "").trim();
    const action = String(payload.action || caption).trim();
    const actionType = String(payload.actionType || payload.triggerType || "manual").trim();
    const dataUrl = await this.captureTabRegion(tab, null, 1);

    return this.saveSnapshotFromTab(tab, dataUrl, { caption, action, actionType });
  },

  async annotateSnapshotOnTab(tabId, snapshotId, dataUrl) {
    const tab = await this.resolveTargetTab(tabId);

    if (!tab?.id) {
      throw new Error("No browser tab found for annotation.");
    }

    if (!this.isCapturableUrl(tab.url)) {
      throw new Error("Open the captured website tab to annotate.");
    }

    await this.ensureAnnotateScripts(tab.id);

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (imageDataUrl) => {
        if (typeof window.NotebookToolsSnapshotAnnotate?.open !== "function") {
          return { ok: false, error: "Annotation tools not available." };
        }

        try {
          const annotated = await window.NotebookToolsSnapshotAnnotate.open(imageDataUrl);
          return { ok: true, dataUrl: annotated };
        } catch (error) {
          return { ok: false, error: error?.message || "Annotation cancelled." };
        }
      },
      args: [dataUrl]
    });

    const payload = result?.result;

    if (!payload?.ok || !String(payload.dataUrl || "").startsWith("data:image/")) {
      throw new Error(payload?.error || "Annotation failed.");
    }

    await NotebookToolsSnapshotStore.update(snapshotId, { dataUrl: payload.dataUrl });
    return { snapshotId, updated: true };
  },

  async startOverlay(tabId) {
    const tab = await this.resolveTargetTab(tabId);

    if (!tab?.id) {
      throw new Error("No active tab found. Click the page you want to capture first.");
    }

    if (!this.isCapturableUrl(tab.url)) {
      throw new Error("Cannot capture this page. Switch to a regular website tab.");
    }

    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["snapshot-capture-overlay.css", "snapshot-annotate.css"]
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [
        "vendor/html2canvas/html2canvas.min.js",
        "snapshot-capture-page.js",
        "snapshot-annotate.js",
        "snapshot-capture-overlay.js"
      ]
    });

    return tab;
  },

  async saveSnapshotFromTab(tab, dataUrl, extra = {}) {
    const snapshot = {
      id: NotebookToolsSnapshotStore.createId(),
      dataUrl,
      url: tab.url || "",
      title: tab.title || "Snapshot",
      action: String(extra.action || "").trim(),
      actionType: String(extra.actionType || "").trim(),
      caption: String(extra.caption || extra.action || "").trim(),
      timestamp: Date.now()
    };

    await NotebookToolsSnapshotStore.add(snapshot);
    const count = (await NotebookToolsSnapshotStore.list()).length;

    return { snapshot, count };
  }
};

if (typeof self !== "undefined") {
  self.NotebookToolsSnapshotCapture = NotebookToolsSnapshotCapture;
}

if (typeof window !== "undefined") {
  window.NotebookToolsSnapshotCapture = NotebookToolsSnapshotCapture;
}
