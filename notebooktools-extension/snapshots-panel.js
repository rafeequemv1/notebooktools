const NotebookToolsSnapshotsPanel = {
  mounted: false,
  snapshots: [],
  picker: null,
  autoCaptureActive: false,

  async mount(root) {
    if (!root || this.mounted) {
      return;
    }

    try {
      this.mounted = true;
      root.innerHTML = `
      <div class="snapshots-panel">
        <section class="sp-card">
          <h2 class="sp-label">Capture</h2>
          <p class="snapshots-empty">Drag to capture a region (<kbd>Alt+Shift+S</kbd>), or use <strong>Auto</strong> to record clicks, scroll, and keys on the page.</p>
          <div class="snapshots-actions">
            <div class="snapshots-capture-row">
              <button type="button" class="button sp-primary" id="snapshotsCaptureBtn">Drag to capture</button>
              <button type="button" class="button secondary" id="snapshotsAutoCaptureBtn">Auto</button>
              <button type="button" class="button secondary" id="snapshotsStopAutoBtn" hidden>Stop auto</button>
              <button type="button" class="text-button snapshots-clear" id="snapshotsClearBtn">Clear</button>
            </div>
          </div>
        </section>

        <section class="sp-card">
          <h2 class="sp-label">Snapshots (<span id="snapshotsCount">0</span>)</h2>
          <div class="snapshots-grid" id="snapshotsGrid"></div>
        </section>

        <section class="sp-card sp-destination">
          <h2 class="sp-label">Notebook</h2>
          <div class="sp-fields">
            <input id="snapshotsNotebookSearch" type="search" placeholder="Search notebooks" autocomplete="off" aria-label="Search snapshots notebooks">
            <select id="snapshotsNotebookSelect" aria-label="Snapshots notebook">
              <option value="">Loading notebooks...</option>
            </select>
            <input id="snapshotsNewNotebookName" type="text" placeholder="Or create new notebook" aria-label="New snapshots notebook name">
          </div>
        </section>

        <section class="sp-card snapshots-output-type">
          <label for="snapshotsOutputType">Then</label>
          <select id="snapshotsOutputType" aria-label="Output type">
            <option value="discuss">Discuss in chat</option>
            <option value="blog" selected>Create blog with images</option>
            <option value="guide">Create web app tutorial</option>
          </select>
        </section>

        <section class="sp-card snapshots-guide-fields" id="snapshotsGuideFields" hidden>
          <h2 class="sp-label">Tutorial context</h2>
          <p class="snapshots-empty">Helps NotebookLM write a detailed step-by-step guide tied to each screenshot. Add a caption on every snapshot — that becomes the step context.</p>
          <input id="snapshotsGuideTitle" type="text" placeholder="Tutorial title (e.g. How to export reports in Acme)" aria-label="Tutorial title">
          <textarea id="snapshotsGuideContext" rows="3" placeholder="What are you explaining? Who is it for? Describe the workflow in 1–2 sentences." aria-label="Tutorial context"></textarea>
        </section>

        <p class="source-limit-note" id="snapshotsLimitNote" hidden></p>

        <button type="button" class="button sp-primary" id="snapshotsUploadBtn" disabled>Send snapshots to notebook</button>
        <button type="button" class="button secondary" id="snapshotsUploadOpenBtn" disabled>Send &amp; open notebook</button>

        <div class="sp-actions">
          <button class="text-button" id="snapshotsRefreshNotebooksBtn" type="button">Refresh</button>
        </div>

        <div class="status snapshots-status" id="snapshotsStatus" role="status"></div>
      </div>
    `;

    this.root = root;
    this.gridEl = root.querySelector("#snapshotsGrid");
    this.countEl = root.querySelector("#snapshotsCount");
    this.statusEl = root.querySelector("#snapshotsStatus");
    this.uploadBtn = root.querySelector("#snapshotsUploadBtn");
    this.uploadOpenBtn = root.querySelector("#snapshotsUploadOpenBtn");
    this.limitNote = root.querySelector("#snapshotsLimitNote");
    this.autoCaptureBtn = root.querySelector("#snapshotsAutoCaptureBtn");
    this.stopAutoBtn = root.querySelector("#snapshotsStopAutoBtn");

    this.picker = NotebookToolsPicker.create({
      searchInput: root.querySelector("#snapshotsNotebookSearch"),
      selectEl: root.querySelector("#snapshotsNotebookSelect"),
      newNameInput: root.querySelector("#snapshotsNewNotebookName"),
      refreshButton: root.querySelector("#snapshotsRefreshNotebooksBtn"),
      onStatus: (message, options = {}) => {
        this.setStatus(message, options);
      },
      onNotebookChange: () => {
        this.refreshLimitNote();
      }
    });

    root.querySelector("#snapshotsCaptureBtn")?.addEventListener("click", () => {
      void this.captureActiveTab();
    });
    this.autoCaptureBtn?.addEventListener("click", () => {
      void this.startAutoCapture();
    });
    this.stopAutoBtn?.addEventListener("click", () => {
      void this.stopAutoCapture();
    });
    root.querySelector("#snapshotsClearBtn")?.addEventListener("click", () => {
      void this.clearAll();
    });
    this.uploadBtn?.addEventListener("click", () => {
      void this.uploadSnapshots({ openNotebook: false });
    });
    this.uploadOpenBtn?.addEventListener("click", () => {
      void this.uploadSnapshots({ openNotebook: true });
    });

    const outputTypeEl = root.querySelector("#snapshotsOutputType");
    const guideFields = root.querySelector("#snapshotsGuideFields");

    const syncGuideFields = () => {
      const isGuide = outputTypeEl?.value === "guide";
      if (guideFields) {
        guideFields.hidden = !isGuide;
      }
    };

    outputTypeEl?.addEventListener("change", syncGuideFields);
    syncGuideFields();

    this.picker.bind();
    await this.picker.refresh({ silent: true });
    await this.refreshList();
    await this.syncAutoCaptureState();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "session" && changes.notebooktoolsAutoCapture) {
        void this.syncAutoCaptureState();
      }

      if (area === "local" && changes[NotebookToolsSnapshotStore.STORAGE_KEY]) {
        const next = changes[NotebookToolsSnapshotStore.STORAGE_KEY].newValue || [];
        const prev = changes[NotebookToolsSnapshotStore.STORAGE_KEY].oldValue || [];

        if (next.length > prev.length) {
          const latest = next[next.length - 1] || {};
          const label = latest.action || latest.caption;
          this.setStatus(
            label ? `Captured snapshot ${next.length}: ${label}` : `Captured snapshot ${next.length}.`,
            { done: true }
          );
        }

        void this.refreshList();
      }
    });
    } catch (error) {
      this.mounted = false;
      root.innerHTML = `
        <div class="snapshots-panel">
          <section class="sp-card">
            <p class="status" style="color:var(--error,#c5221f)">Snapshots failed to load: ${String(error?.message || error)}</p>
          </section>
        </div>
      `;
      console.error("NotebookTools snapshots panel mount failed:", error);
    }
  },

  async getCaptureTab() {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    let tab = tabs[0];

    if (!tab?.id) {
      const [fallback] = await chrome.tabs.query({ active: true, currentWindow: true });
      tab = fallback;
    }

    if (!tab?.id) {
      throw new Error("No browser tab found. Click the page you want to capture first.");
    }

    if (!NotebookToolsSnapshotStore.isCapturableUrl(tab.url)) {
      throw new Error("Cannot capture this page. Open a regular website (http/https) tab first.");
    }

    return tab;
  },

  setStatus(message, options = {}) {
    NotebookToolsUI.setImportStatus(this.statusEl, {
      message,
      type: options.type || "success",
      loading: options.loading === true,
      done: options.done === true
    });
  },

  notebookState() {
    return {
      notebookId: this.picker?.selectedNotebookId?.() || "",
      isNewNotebook: Boolean(this.root?.querySelector("#snapshotsNewNotebookName")?.value?.trim()),
      cachedSourceCount: null
    };
  },

  refreshLimitNote() {
    NotebookToolsSourceLimits.updateLimitNote(this.limitNote, {
      ...this.notebookState(),
      adding: 1
    });
  },

  async refreshList() {
    this.snapshots = await NotebookToolsSnapshotStore.list();
    this.renderGrid();
    this.updateButtons();
    this.refreshLimitNote();
  },

  updateAutoCaptureUi() {
    if (this.autoCaptureBtn) {
      this.autoCaptureBtn.hidden = this.autoCaptureActive;
      this.autoCaptureBtn.disabled = this.autoCaptureActive;
    }

    if (this.stopAutoBtn) {
      this.stopAutoBtn.hidden = !this.autoCaptureActive;
      this.stopAutoBtn.textContent = "Stop auto";
    }
  },

  async syncAutoCaptureState() {
    const stored = await chrome.storage.session.get("notebooktoolsAutoCapture");
    this.autoCaptureActive = Boolean(stored.notebooktoolsAutoCapture?.active);
    this.updateAutoCaptureUi();
  },

  async startAutoCapture() {
    this.setStatus("Starting auto capture on the page tab...", { loading: true });

    try {
      const tab = await this.getCaptureTab();
      const response = await chrome.runtime.sendMessage({
        type: "notebooktools-start-auto-capture",
        tabId: tab.id
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Could not start auto capture.");
      }

      await chrome.tabs.update(tab.id, { active: true });
      this.autoCaptureActive = true;
      this.updateAutoCaptureUi();
      this.setStatus(
        "Auto capture on — click/drag on the page. Stop when done, then Annotate each snapshot.",
        { done: true }
      );
    } catch (error) {
      this.setStatus(error.message || "Could not start auto capture.", { type: "error" });
    }
  },

  async stopAutoCapture() {
    this.setStatus("Stopping auto capture...", { loading: true });

    try {
      const tab = await this.getCaptureTab().catch(() => null);
      const response = await chrome.runtime.sendMessage({
        type: "notebooktools-stop-auto-capture",
        tabId: tab?.id
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Could not stop auto capture.");
      }

      this.autoCaptureActive = false;
      this.updateAutoCaptureUi();
      await this.refreshList();
      this.setStatus("Auto capture stopped. Click Annotate on any snapshot to mark it up.", { done: true });
    } catch (error) {
      this.setStatus(error.message || "Could not stop auto capture.", { type: "error" });
    }
  },

  async annotateSnapshot(snapshot) {
    if (!snapshot?.id || !snapshot?.dataUrl) {
      return;
    }

    this.setStatus("Opening annotation on the page tab...", { loading: true });

    try {
      const tab = await this.getCaptureTab();
      await chrome.tabs.update(tab.id, { active: true });

      const response = await chrome.runtime.sendMessage({
        type: "notebooktools-annotate-snapshot",
        tabId: tab.id,
        snapshotId: snapshot.id,
        dataUrl: snapshot.dataUrl
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Annotation failed.");
      }

      await this.refreshList();
      this.setStatus("Snapshot annotated.", { done: true });
    } catch (error) {
      if (!/cancel/i.test(error.message || "")) {
        this.setStatus(error.message || "Could not annotate snapshot.", { type: "error" });
      } else {
        this.setStatus("Annotation cancelled.");
      }
    }
  },

  updateButtons() {
    const hasSnapshots = this.snapshots.length > 0;

    if (this.countEl) {
      this.countEl.textContent = String(this.snapshots.length);
    }

    if (this.uploadBtn) {
      this.uploadBtn.disabled = !hasSnapshots;
      this.uploadBtn.textContent = hasSnapshots
        ? `Send ${this.snapshots.length} snapshot${this.snapshots.length === 1 ? "" : "s"} to notebook`
        : "Send snapshots to notebook";
    }

    if (this.uploadOpenBtn) {
      this.uploadOpenBtn.disabled = !hasSnapshots;
    }
  },

  formatActionTypeLabel(actionType = "") {
    const labels = {
      "left-click": "Left click",
      "right-click": "Right click",
      "middle-click": "Middle click",
      "double-click": "Double click",
      drag: "Drag",
      "scroll-up": "Scroll up",
      "scroll-down": "Scroll down",
      "scroll-left": "Scroll left",
      "scroll-right": "Scroll right",
      key: "Key",
      "key-combo": "Shortcut",
      change: "Change",
      submit: "Submit",
      hotkey: "Hotkey"
    };

    return labels[String(actionType || "").toLowerCase()] || "";
  },

  renderGrid() {
    if (!this.gridEl) {
      return;
    }

    if (!this.snapshots.length) {
      this.gridEl.innerHTML = `<p class="snapshots-empty">No snapshots yet. Click Drag to capture, then select an area on the page.</p>`;
      return;
    }

    this.gridEl.innerHTML = this.snapshots
      .map((snapshot, index) => {
        const title = String(snapshot.title || `Snapshot ${index + 1}`).replace(/"/g, "&quot;");
        const action = String(snapshot.action || snapshot.caption || "").replace(/"/g, "&quot;");
        const notes = String(
          snapshot.caption && snapshot.caption !== snapshot.action ? snapshot.caption : ""
        ).replace(/"/g, "&quot;");
        const actionType = this.formatActionTypeLabel(snapshot.actionType);
        const actionBadge = actionType
          ? `<span class="snapshot-action-type">${actionType}</span>`
          : "";

        return `
          <article class="snapshot-card" data-id="${snapshot.id}">
            <img src="${snapshot.dataUrl}" alt="${title}">
            <p class="snapshot-card-title">${index + 1}. ${title}</p>
            <label class="snapshot-field-label">Recorded action ${actionBadge}</label>
            <input class="snapshot-card-action" type="text" value="${action}" placeholder="e.g. Left click · Export button" aria-label="Recorded action for snapshot ${index + 1}">
            <label class="snapshot-field-label">Step notes (optional)</label>
            <input class="snapshot-card-caption" type="text" value="${notes}" placeholder="Extra tutorial context" aria-label="Step notes for snapshot ${index + 1}">
            <div class="snapshot-card-tools">
              <button type="button" class="button secondary compact snapshot-annotate-btn" data-id="${snapshot.id}">Annotate</button>
              <button type="button" class="button secondary compact snapshot-remove-btn" data-id="${snapshot.id}">Remove</button>
            </div>
          </article>
        `;
      })
      .join("");

    this.gridEl.querySelectorAll(".snapshot-annotate-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const snapshot = this.snapshots.find((item) => item.id === button.dataset.id);
        void this.annotateSnapshot(snapshot);
      });
    });

    this.gridEl.querySelectorAll(".snapshot-remove-btn").forEach((button) => {
      button.addEventListener("click", () => {
        void this.removeSnapshot(button.dataset.id);
      });
    });

    this.gridEl.querySelectorAll(".snapshot-card-action").forEach((input) => {
      input.addEventListener("change", () => {
        const card = input.closest(".snapshot-card");
        const id = card?.dataset.id;

        if (id) {
          const value = input.value.trim();
          void NotebookToolsSnapshotStore.update(id, { action: value, caption: value });
        }
      });
    });

    this.gridEl.querySelectorAll(".snapshot-card-caption").forEach((input) => {
      input.addEventListener("change", () => {
        const card = input.closest(".snapshot-card");
        const id = card?.dataset.id;

        if (id) {
          const snapshot = this.snapshots.find((item) => item.id === id);
          const notes = input.value.trim();
          const caption = notes || snapshot?.action || "";

          void NotebookToolsSnapshotStore.update(id, { caption });
        }
      });
    });
  },

  async captureActiveTab() {
    this.setStatus("Starting capture overlay on the page tab...", { loading: true });

    try {
      const tab = await this.getCaptureTab();
      const response = await chrome.runtime.sendMessage({
        type: "notebooktools-start-snapshot-overlay",
        tabId: tab.id
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Capture failed.");
      }

      this.setStatus("Drag on the page to capture, then annotate. Shortcut: Alt+Shift+S.", { done: true });
    } catch (error) {
      this.setStatus(error.message || "Could not start capture.", { type: "error" });
    }
  },

  async removeSnapshot(id) {
    await NotebookToolsSnapshotStore.remove(id);
    await this.refreshList();
  },

  async clearAll() {
    await NotebookToolsSnapshotStore.clear();
    await NotebookToolsSnapshotStore.clearSession();
    await this.refreshList();
    this.setStatus("Snapshots cleared.");
  },

  async uploadSnapshots({ openNotebook = false } = {}) {
    if (!this.snapshots.length) {
      this.setStatus("Capture at least one snapshot first.", { type: "error" });
      return;
    }

    const outputType = this.root?.querySelector("#snapshotsOutputType")?.value || "blog";
    const idleUpload = this.uploadBtn?.textContent || "Send snapshots to notebook";

    NotebookToolsUI.setImportButtonState(this.uploadBtn, true, idleUpload);
    NotebookToolsUI.setImportButtonState(this.uploadOpenBtn, true, "Send & open notebook");
    this.picker.setBusy(true);
    this.setStatus("Uploading snapshot images to notebook...", { loading: true });

    try {
      await NotebookToolsSourceLimits.assertCanImport({
        ...this.notebookState(),
        adding: this.snapshots.length
      });

      const targetNotebook = await this.picker.resolveTarget();
      const pageTitle = this.snapshots[0]?.title || "Captured screens";
      const guideTitle = this.root?.querySelector("#snapshotsGuideTitle")?.value?.trim() || "";
      const guideContext = this.root?.querySelector("#snapshotsGuideContext")?.value?.trim() || "";

      const sourceIds = await NotebookToolsSnapshotUpload.uploadSnapshotsAsImages(
        targetNotebook.id,
        this.snapshots,
        {
          onProgress: (event) => {
            this.setStatus(event.message || "Uploading snapshot images...", { loading: true });
          }
        }
      );

      await NotebookToolsSnapshotStore.setSession({
        notebookId: targetNotebook.id,
        snapshots: this.snapshots,
        sourceIds,
        snapshotCount: this.snapshots.length,
        pageTitle,
        guideTitle,
        guideContext,
        outputType,
        uploadedAt: Date.now(),
        pendingRun: openNotebook && outputType !== "discuss",
        autoDownloadDoc: true
      });

      this.root.querySelector("#snapshotsNewNotebookName").value = "";
      await this.picker.refresh({ silent: true });
      this.root.querySelector("#snapshotsNotebookSelect").value = targetNotebook.id;

      const notebookUrl = `https://notebook.google.com/notebook/${encodeURIComponent(targetNotebook.id)}`;

      if (openNotebook) {
        chrome.tabs.create({ url: notebookUrl });
        await NotebookToolsSettings.openNotebookIfEnabled(targetNotebook.id);
      }

      this.setStatus(
        openNotebook
          ? outputType === "discuss"
            ? `Uploaded ${this.snapshots.length} images to "${targetNotebook.title}". Discussion will start automatically.`
            : `Uploaded ${this.snapshots.length} images to "${targetNotebook.title}". Writing article with inline images...`
          : `Uploaded ${this.snapshots.length} images to "${targetNotebook.title}". Open the notebook and click Snapshots in chat.`,
        { done: true }
      );
    } catch (error) {
      this.setStatus(error.message || "Upload failed.", { type: "error" });
    } finally {
      NotebookToolsUI.setImportButtonState(this.uploadBtn, false, idleUpload);
      NotebookToolsUI.setImportButtonState(this.uploadOpenBtn, false, "Send & open notebook");
      this.picker.setBusy(false);
      this.updateButtons();
    }
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsSnapshotsPanel = NotebookToolsSnapshotsPanel;
}
