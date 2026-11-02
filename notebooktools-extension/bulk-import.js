const NotebookToolsBulkImportUI = (() => {
  let root = null;
  let picker = null;
  let statusBox = null;
  let importButton = null;
  let cancelButton = null;
  let openNotebookLink = null;
  let pasteInput = null;
  let progressFill = null;
  let progressLabel = null;
  let summaryEl = null;
  let limitNote = null;
  let running = false;
  let cancelRequested = false;
  let mounted = false;
  let bulkNotebookState = { notebookId: "", isNewNotebook: false, cachedSourceCount: null };
  let youtubeBatchHint = null;
  let youtubeBatchDetails = null;
  let youtubeBatchList = null;
  let youtubeBatchLoading = false;

  function setStatus(message, options = {}) {
    NotebookToolsUI.setImportStatus(statusBox, {
      message,
      type: options.type || "success",
      loading: options.loading === true,
      done: options.done === true
    });
  }

  function showOpenNotebook(notebookId) {
    if (!openNotebookLink || !notebookId) {
      return;
    }

    openNotebookLink.hidden = false;
    openNotebookLink.href = `https://notebook.google.com/notebook/${encodeURIComponent(notebookId)}`;
  }

  function countMeta(items) {
    const pending = items.filter((item) => item.selected && item.status === "pending").length;
    const youtube = items.filter((item) => item.type === "youtube").length;
    const webpage = items.length - youtube;
    return { pending, youtube, webpage, total: items.length };
  }

  function renderQueueItem(item) {
    const statusClass =
      item.status === "failed"
        ? " is-failed"
        : item.status === "success"
          ? " is-success"
          : item.status === "skipped"
            ? " is-skipped"
            : "";

    return `
      <div class="bulk-queue-item${statusClass}" data-item-id="${item.id}">
        <input
          class="bulk-queue-check"
          type="checkbox"
          data-toggle-id="${item.id}"
          ${item.selected ? "checked" : ""}
          ${running || item.status !== "pending" ? "disabled" : ""}
        >
        <div class="bulk-queue-copy">
          <span class="bulk-queue-name">${NotebookToolsStore.escapeHtml(item.title)}</span>
          <span class="bulk-queue-url">${NotebookToolsStore.escapeHtml(item.url)}</span>
          ${item.error ? `<span class="bulk-queue-error">${NotebookToolsStore.escapeHtml(item.error)}</span>` : ""}
        </div>
        <span class="bulk-type-pill is-${item.type}">${item.type}</span>
      </div>
    `;
  }

  function renderQueue(items) {
    const list = root.querySelector("#bulkQueueList");
    const meta = root.querySelector("#bulkQueueMeta");
    const stats = countMeta(items);

    if (meta) {
      meta.textContent = items.length
        ? `${stats.total} items · ${stats.pending} ready · ${stats.youtube} YT`
        : "0 items";
    }

    if (!list) {
      return;
    }

    if (!items.length) {
      list.innerHTML = '<p class="bulk-queue-empty">Add open tabs or paste links to build your queue.</p>';
      return;
    }

    list.innerHTML = items.map(renderQueueItem).join("");
    void updateLimitNote(stats.pending);
    updateImportButton(stats.pending);
  }

  async function updateLimitNote(pendingCount) {
    if (!limitNote) {
      return;
    }

    const adding = pendingCount || 0;

    if (!adding && !bulkNotebookState.notebookId && !bulkNotebookState.isNewNotebook) {
      limitNote.textContent = `NotebookLM supports about ${NotebookToolsBulkQueue.NOTEBOOK_SOURCE_LIMIT} sources per notebook.`;
      limitNote.classList.remove("is-warning", "is-error");
      return;
    }

    await NotebookToolsSourceLimits.updateLimitNote(limitNote, {
      ...bulkNotebookState,
      adding
    });
  }

  function updateImportButton(pendingCount) {
    if (!importButton) {
      return;
    }

    importButton.textContent = pendingCount
      ? `Import ${pendingCount} source${pendingCount === 1 ? "" : "s"}`
      : "Import queue";
    importButton.disabled = running || !pendingCount;
  }

  function setRunning(isRunning) {
    running = isRunning;
    cancelRequested = false;

    root.querySelectorAll(".bulk-secondary-btn, .bulk-paste, #bulkAddPasteButton, .bulk-youtube-btn, .youtube-batch-tool").forEach((el) => {
      el.disabled = isRunning;
    });

    if (picker) {
      picker.setBusy(isRunning);
    }

    if (cancelButton) {
      cancelButton.classList.toggle("is-visible", isRunning);
    }

    if (progressFill?.parentElement?.parentElement) {
      progressFill.parentElement.parentElement.classList.toggle("is-visible", isRunning);
    }

    updateImportButton(NotebookToolsBulkQueue.getSelectedPending().length);
  }

  async function addOpenTabs() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const candidates = [];

    for (const tab of tabs) {
      const classified = NotebookToolsStore.classifyImportUrl(tab.url || "");

      if (!classified) {
        continue;
      }

      candidates.push({
        ...classified,
        title: tab.title || classified.url
      });
    }

    const result = NotebookToolsBulkQueue.addMany(candidates);
    await NotebookToolsBulkQueue.persist();

    const parts = [`Added ${result.added}`];

    if (result.skipped) {
      parts.push(`${result.skipped} duplicates skipped`);
    }

    if (!result.added && !candidates.length) {
      setStatus("No importable tabs in this window.", { type: "error" });
      return;
    }

    setStatus(parts.join(" · ") + ".");
  }

  async function addPastedLinks() {
    const parsed = NotebookToolsStore.parseLinkList(pasteInput?.value || "");
    const result = NotebookToolsBulkQueue.addMany(
      parsed.map((entry) => ({ ...entry, title: entry.url }))
    );
    await NotebookToolsBulkQueue.persist();

    if (!parsed.length) {
      setStatus("Paste one URL per line.", { type: "error" });
      return;
    }

    const parts = [`Added ${result.added}`];

    if (result.skipped) {
      parts.push(`${result.skipped} duplicates skipped`);
    }

    const invalidCount = parsed.length - result.added - result.skipped;

    if (invalidCount > 0) {
      parts.push(`${invalidCount} invalid lines skipped`);
    }

    setStatus(parts.join(" · ") + ".");
  }

  async function extractLinksFromActiveTab() {
    if (!chrome?.tabs?.query) {
      setStatus("Link extraction is not available here.", { type: "error" });
      return;
    }

    setStatus("Extracting links from page...", { loading: true });

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id) {
        throw new Error("No active tab found.");
      }

      const response = await chrome.runtime.sendMessage({
        type: "notebooktools-extract-tab-links",
        tabId: tab.id
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Could not extract links.");
      }

      const links = response.links || [];

      if (!links.length) {
        setStatus("No links found on this page.", { type: "error" });
        return;
      }

      if (pasteInput) {
        pasteInput.value = NotebookToolsLinkExtract.linksToText(links);
      }

      const importable = NotebookToolsLinkExtract.filterImportableLinks(links);
      setStatus(
        `Found ${links.length} link${links.length === 1 ? "" : "s"} in main content (${importable.length} importable). Review below, then click Paste links.`
      );
    } catch (error) {
      setStatus(error.message || "Could not extract links.", { type: "error" });
    }
  }

  async function applyPendingLinkExtract() {
    const stored = await chrome.storage.session.get("pendingLinkExtract");
    const payload = stored?.pendingLinkExtract;

    if (!payload?.links?.length) {
      return false;
    }

    if (pasteInput) {
      pasteInput.value = NotebookToolsLinkExtract.linksToText(payload.links);
    }

    const importable = NotebookToolsLinkExtract.filterImportableLinks(payload.links);
    setStatus(
      `Extracted ${payload.links.length} link${payload.links.length === 1 ? "" : "s"} from main content on ${payload.pageTitle || "page"} (${importable.length} importable).`
    );

    await chrome.storage.session.remove("pendingLinkExtract");
    return true;
  }

  async function readYouTubeCollection() {
    if (NotebookToolsYouTubeBatchPreview.getVideos().length) {
      const selected = NotebookToolsYouTubeBatchPreview.getSelected();

      if (!selected.length) {
        throw new Error("Select at least one video to import.");
      }

      return {
        collection: NotebookToolsYouTubeBatchPreview.getCollection(),
        videos: selected
      };
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!NotebookToolsStore.isYouTubeBatchUrl(tab?.url || "")) {
      throw new Error("Open a YouTube playlist or channel /videos page first.");
    }

    const collection = await NotebookToolsYouTubeCollector.collectFromTab(tab.id);

    if (!collection?.videos?.length) {
      throw new Error(
        collection?.playlistUrl
          ? "No videos found. Try opening the full playlist page or scroll the playlist panel."
          : "No videos found. Open a playlist or channel /videos page first."
      );
    }

    return { collection, videos: collection.videos };
  }

  function renderBulkYouTubePreview() {
    if (!youtubeBatchList) {
      return;
    }

    const hasVideos = NotebookToolsYouTubeBatchPreview.getVideos().length > 0;

    if (youtubeBatchDetails) {
      youtubeBatchDetails.hidden = !hasVideos;
      if (hasVideos) {
        youtubeBatchDetails.open = true;
      }
    }

    NotebookToolsYouTubeBatchPreview.updateMetaElements({
      titleEl: root.querySelector("#bulkYouTubeBatchTitle"),
      countEl: root.querySelector("#bulkYouTubeBatchMeta"),
      selectedEl: root.querySelector("#bulkYouTubeBatchSelected")
    });
    NotebookToolsYouTubeBatchPreview.renderList(youtubeBatchList, {
      disabled: youtubeBatchLoading || running
    });
    NotebookToolsYouTubeBatchPreview.bindList(youtubeBatchList, {
      disabled: youtubeBatchLoading || running,
      onChange: () => {
        renderBulkYouTubePreview();
        void updateLimitNote(NotebookToolsYouTubeBatchPreview.selectedCount());
      }
    });

    const selected = NotebookToolsYouTubeBatchPreview.selectedCount();
    const oneClick = root.querySelector("#bulkYouTubeOneClickButton");

    if (oneClick) {
      oneClick.textContent = selected
        ? `Import ${selected} selected to new notebook`
        : "Import selected to new notebook";
      oneClick.disabled = running || youtubeBatchLoading || !selected;
    }

    const queueBtn = root.querySelector("#bulkYouTubeQueueButton");

    if (queueBtn) {
      queueBtn.disabled = running || youtubeBatchLoading || !selected;
    }
  }

  async function loadYouTubeBatchPreview({ force = false } = {}) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!NotebookToolsStore.isYouTubeBatchUrl(tab?.url || "")) {
      NotebookToolsYouTubeBatchPreview.reset();
      renderBulkYouTubePreview();
      return;
    }

    youtubeBatchLoading = true;
    renderBulkYouTubePreview();
    setStatus("Loading playlist videos...", { loading: true });

    try {
      await NotebookToolsYouTubeBatchPreview.loadFromActiveTab({ force });
      const collection = NotebookToolsYouTubeBatchPreview.getCollection();

      if (collection) {
        picker?.setNewNotebookName(collection.notebookName || NotebookToolsStore.suggestBatchNotebookName(collection));
      }

      renderBulkYouTubePreview();
      void updateLimitNote(NotebookToolsYouTubeBatchPreview.selectedCount());
      setStatus(`${NotebookToolsYouTubeBatchPreview.getVideos().length} videos loaded. Uncheck any you do not want.`);
    } catch (error) {
      NotebookToolsYouTubeBatchPreview.reset();
      renderBulkYouTubePreview();
      setStatus(error.message || "Could not load YouTube page.", { type: "error" });
    } finally {
      youtubeBatchLoading = false;
      renderBulkYouTubePreview();
    }
  }

  async function addYouTubeBatchToQueue() {
    setStatus("Reading videos from YouTube...", { loading: true });

    try {
      const { collection, videos } = await readYouTubeCollection();
      const result = NotebookToolsBulkQueue.addMany(
        videos.map((video) => ({
          type: "youtube",
          url: video.url,
          title: video.title
        }))
      );
      await NotebookToolsBulkQueue.persist();
      picker.setNewNotebookName(NotebookToolsStore.suggestBatchNotebookName(collection));

      const parts = [`Added ${result.added} videos`];

      if (result.skipped) {
        parts.push(`${result.skipped} duplicates skipped`);
      }

      if (videos.length > NotebookToolsBulkQueue.NOTEBOOK_SOURCE_LIMIT) {
        parts.push(`will split across ${Math.ceil(videos.length / NotebookToolsBulkQueue.NOTEBOOK_SOURCE_LIMIT)} notebooks`);
      }

      setStatus(parts.join(" · ") + ".");
    } catch (error) {
      setStatus(error.message || "Could not read YouTube page.", { type: "error" });
    }
  }

  async function runNotebookChunkImport({ notebookId, videos, chunkIndex, chunkCount, onItemProgress }) {
    const queueItems = videos.map((video, index) => ({
      id: `yt-batch-${chunkIndex}-${index}-${video.url}`,
      url: video.url,
      title: video.title,
      type: "youtube",
      status: "pending",
      error: "",
      selected: true,
      addedAt: Date.now()
    }));

    let completed = 0;
    const total = queueItems.length;

    return NotebookToolsBulkRunner.run({
      items: queueItems,
      notebookId,
      shouldCancel: () => cancelRequested,
      onProgress: ({ item, summary: liveSummary, phase }) => {
        if (phase === "importing" && progressLabel) {
          const label = chunkCount > 1 ? `Part ${chunkIndex + 1}/${chunkCount} · ` : "";
          progressLabel.textContent = `${label}Importing ${Math.min(completed + 1, total)} of ${total}...`;
        }

        if (phase === "done" || phase === "failed") {
          completed += 1;
        }

        if (progressFill && total > 0) {
          const chunkBase = chunkIndex / chunkCount;
          const chunkSpan = 1 / chunkCount;
          progressFill.style.width = `${Math.round((chunkBase + (completed / total) * chunkSpan) * 100)}%`;
        }

        if (typeof onItemProgress === "function") {
          onItemProgress({ item, summary: liveSummary, phase, completed, total });
        }

        if (liveSummary?.stoppedByLimit && phase === "failed") {
          setStatus("Notebook source limit reached. Remaining items skipped.", { type: "error" });
        }
      }
    });
  }

  async function oneClickYouTubeBatch() {
    if (running) {
      return;
    }

    setRunning(true);
    cancelRequested = false;

    if (progressFill?.parentElement?.parentElement) {
      progressFill.parentElement.parentElement.classList.add("is-visible");
    }

    try {
      const { collection, videos } = await readYouTubeCollection();
      const limit = NotebookToolsBulkQueue.NOTEBOOK_SOURCE_LIMIT;
      const baseName = NotebookToolsStore.suggestBatchNotebookName(collection);
      const chunks = NotebookToolsStore.chunkItems(videos, limit);

      NotebookToolsBulkQueue.clearQueue();
      NotebookToolsBulkQueue.addMany(
        videos.map((video) => ({
          type: "youtube",
          url: video.url,
          title: video.title
        }))
      );
      await NotebookToolsBulkQueue.persist();
      picker.setNewNotebookName(baseName);

      let totalSuccess = 0;
      let totalFailed = 0;
      const createdNotebooks = [];

      for (let index = 0; index < chunks.length; index += 1) {
        if (cancelRequested) {
          break;
        }

        const partLabel = chunks.length > 1 ? ` (${index + 1}/${chunks.length})` : "";
        const notebookName = `${baseName}${partLabel}`.slice(0, 80);

        setStatus(`Creating "${notebookName}"...`, { loading: true });
        const notebook = await NotebookToolsNotebookLM.createNotebookLmNotebook(notebookName);
        createdNotebooks.push(notebook);

        setStatus(`Importing ${chunks[index].length} videos...`, { loading: true });

        const summary = await runNotebookChunkImport({
          notebookId: notebook.id,
          videos: chunks[index],
          chunkIndex: index,
          chunkCount: chunks.length,
          onItemProgress: ({ item, phase }) => {
            if (phase === "importing") {
              setStatus(`Importing ${item.title.slice(0, 48)}...`, { loading: true });
            }
          }
        });

        totalSuccess += summary.success;
        totalFailed += summary.failed;

        if (summary.stoppedByLimit || summary.cancelled) {
          break;
        }
      }

      if (!createdNotebooks.length) {
        throw new Error("Could not create a notebook for this import.");
      }

      const lastNotebook = createdNotebooks[createdNotebooks.length - 1];
      picker.setNewNotebookName("");
      await picker.refresh({ silent: true });
      root.querySelector("#bulkNotebookSelect").value = lastNotebook.id;
      bulkNotebookState = {
        notebookId: lastNotebook.id,
        isNewNotebook: false,
        cachedSourceCount: totalSuccess
      };
      void updateLimitNote(0);
      showOpenNotebook(lastNotebook.id);
      await NotebookToolsSettings.openNotebookIfEnabled(lastNotebook.id);

      const summaryParts = [
        `${totalSuccess} videos added`,
        createdNotebooks.length > 1 ? `${createdNotebooks.length} notebooks` : `notebook "${baseName}"`,
        totalFailed ? `${totalFailed} failed` : "",
        cancelRequested ? "cancelled" : ""
      ].filter(Boolean);

      if (summaryEl) {
        summaryEl.textContent = summaryParts.join(" · ");
      }

      setStatus(`Playlist import complete: ${summaryParts.join(", ")}.`, {
        done: totalFailed === 0 && !cancelRequested
      });
    } catch (error) {
      setStatus(error.message || "Playlist import failed.", { type: "error" });
    } finally {
      setRunning(false);

      if (progressFill) {
        progressFill.style.width = "0%";
      }
    }
  }

  async function refreshYouTubeBatchHint() {
    if (!youtubeBatchHint) {
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const batch = NotebookToolsStore.classifyYouTubeBatchUrl(tab?.url || "");

    if (!batch) {
      youtubeBatchHint.textContent = "Open a playlist or channel /videos page, then import in one click.";
      return;
    }

    youtubeBatchHint.textContent =
      batch.type === "playlist"
        ? "Playlist detected. Videos load below for review."
        : "Channel detected. Videos load below for review.";

    void loadYouTubeBatchPreview();
  }

  async function runBulkImport() {
    const pending = NotebookToolsBulkQueue.getSelectedPending();

    if (!pending.length) {
      setStatus("Add sources to the queue first.", { type: "error" });
      return;
    }

    setRunning(true);
    setStatus("Preparing bulk import...", { loading: true });

    try {
      await NotebookToolsSourceLimits.assertCanImport({
        ...bulkNotebookState,
        adding: pending.length
      });

      const targetNotebook = await picker.resolveTarget();
      const items = NotebookToolsBulkQueue.getItems();
      let completed = 0;
      const total = pending.length;

      const summary = await NotebookToolsBulkRunner.run({
        items,
        notebookId: targetNotebook.id,
        shouldCancel: () => cancelRequested,
        onProgress: ({ item, summary: liveSummary, phase }) => {
          NotebookToolsBulkQueue.updateItem(item.id, {
            status: item.status,
            error: item.error || ""
          });

          if (phase === "importing") {
            if (progressLabel) {
              progressLabel.textContent = `Importing ${Math.min(completed + 1, total)} of ${total}...`;
            }
            setStatus(`Importing ${item.title.slice(0, 48)}...`, { loading: true });
          }

          if (phase === "done" || phase === "failed") {
            completed += 1;
          }

          if (progressFill && total > 0) {
            progressFill.style.width = `${Math.round((completed / total) * 100)}%`;
          }

          if (progressLabel && (phase === "done" || phase === "failed")) {
            progressLabel.textContent = `${completed} of ${total} processed`;
          }

          if (liveSummary && phase === "failed" && liveSummary.stoppedByLimit) {
            setStatus("Notebook source limit reached. Remaining items skipped.", { type: "error" });
          }
        }
      });

      await NotebookToolsBulkQueue.persist();
      root.querySelector("#bulkNewNotebookName").value = "";
      await picker.refresh({ silent: true });
      root.querySelector("#bulkNotebookSelect").value = targetNotebook.id;
      bulkNotebookState = {
        notebookId: targetNotebook.id,
        isNewNotebook: false,
        cachedSourceCount: typeof bulkNotebookState.cachedSourceCount === "number"
          ? bulkNotebookState.cachedSourceCount + summary.success
          : summary.success
      };
      void updateLimitNote(NotebookToolsBulkQueue.getSelectedPending().length);
      showOpenNotebook(targetNotebook.id);
      await NotebookToolsSettings.openNotebookIfEnabled(targetNotebook.id);

      const summaryParts = [
        `${summary.success} added`,
        summary.failed ? `${summary.failed} failed` : "",
        summary.skipped ? `${summary.skipped} skipped` : "",
        summary.cancelled ? "cancelled" : ""
      ].filter(Boolean);

      if (summaryEl) {
        summaryEl.textContent = summaryParts.join(" · ");
      }

      setStatus(`Bulk import complete: ${summaryParts.join(", ")}.`, {
        done: summary.failed === 0 && !summary.cancelled
      });
    } catch (error) {
      setStatus(error.message || "Bulk import failed.", { type: "error" });
    } finally {
      setRunning(false);
      if (progressFill) {
        progressFill.style.width = "0%";
      }
    }
  }

  function bindEvents() {
    root.querySelector("#bulkExtractLinksButton")?.addEventListener("click", () => {
      void extractLinksFromActiveTab();
    });

    root.querySelector("#bulkAddTabsButton")?.addEventListener("click", () => {
      addOpenTabs();
    });

    root.querySelector("#bulkYouTubeOneClickButton")?.addEventListener("click", () => {
      oneClickYouTubeBatch();
    });

    root.querySelector("#bulkYouTubeLoadButton")?.addEventListener("click", () => {
      void loadYouTubeBatchPreview({ force: true });
    });

    root.querySelector("#bulkYouTubeSelectAll")?.addEventListener("click", () => {
      NotebookToolsYouTubeBatchPreview.setAllSelected(true);
      renderBulkYouTubePreview();
      void updateLimitNote(NotebookToolsYouTubeBatchPreview.selectedCount());
    });

    root.querySelector("#bulkYouTubeSelectNone")?.addEventListener("click", () => {
      NotebookToolsYouTubeBatchPreview.setAllSelected(false);
      renderBulkYouTubePreview();
      void updateLimitNote(NotebookToolsYouTubeBatchPreview.selectedCount());
    });

    root.querySelector("#bulkYouTubeQueueButton")?.addEventListener("click", () => {
      addYouTubeBatchToQueue();
    });

    root.querySelector("#bulkAddPasteButton")?.addEventListener("click", () => {
      addPastedLinks();
    });

    root.querySelector("#bulkSelectAllButton")?.addEventListener("click", async () => {
      NotebookToolsBulkQueue.toggleAll(true);
      await NotebookToolsBulkQueue.persist();
    });

    root.querySelector("#bulkClearSelectedButton")?.addEventListener("click", async () => {
      NotebookToolsBulkQueue.removeSelected();
      await NotebookToolsBulkQueue.persist();
    });

    root.querySelector("#bulkClearAllButton")?.addEventListener("click", async () => {
      NotebookToolsBulkQueue.clearQueue();
      await NotebookToolsBulkQueue.persist();
    });

    root.querySelector("#bulkRetryFailedButton")?.addEventListener("click", async () => {
      NotebookToolsBulkQueue.resetFailedToPending();
      await NotebookToolsBulkQueue.persist();
      setStatus("Failed items moved back to queue.");
    });

    importButton?.addEventListener("click", runBulkImport);

    cancelButton?.addEventListener("click", () => {
      cancelRequested = true;
      setStatus("Cancelling after current item...");
    });

    root.querySelector("#bulkQueueList")?.addEventListener("change", (event) => {
      const toggle = event.target.closest("[data-toggle-id]");

      if (!toggle) {
        return;
      }

      NotebookToolsBulkQueue.toggleItem(toggle.dataset.toggleId, toggle.checked);
    });
  }

  async function mount(container) {
    if (mounted) {
      renderQueue(NotebookToolsBulkQueue.getItems());
      return;
    }

    root = container;
    root.innerHTML = `
      <div class="bulk-import sp-stack">
        <section class="sp-card bulk-youtube-card">
          <h2 class="sp-label">Playlist / channel</h2>
          <p class="bulk-youtube-hint" id="bulkYouTubeHint">Open a playlist or channel page, then load videos here.</p>
          <button type="button" class="bulk-secondary-btn bulk-youtube-btn" id="bulkYouTubeLoadButton">Load from tab</button>
          <details class="youtube-batch-panel" id="bulkYouTubeDetails" hidden>
            <summary class="youtube-batch-summary">
              <span class="youtube-batch-summary-title" id="bulkYouTubeBatchTitle">Playlist</span>
              <span class="youtube-batch-summary-meta" id="bulkYouTubeBatchMeta"></span>
            </summary>
            <div class="youtube-batch-tools">
              <button type="button" class="youtube-batch-tool" id="bulkYouTubeSelectAll">All</button>
              <button type="button" class="youtube-batch-tool" id="bulkYouTubeSelectNone">None</button>
            </div>
            <div class="youtube-batch-list" id="bulkYouTubeVideoList"></div>
            <p class="youtube-batch-selected" id="bulkYouTubeBatchSelected"></p>
          </details>
          <div class="bulk-youtube-actions">
            <button type="button" class="button bulk-youtube-primary" id="bulkYouTubeOneClickButton">Import to new notebook</button>
            <button type="button" class="bulk-secondary-btn" id="bulkYouTubeQueueButton">Add to queue</button>
          </div>
        </section>

        <section class="sp-card bulk-source-actions">
          <h2 class="sp-label">Add links</h2>
          <div class="bulk-action-row">
            <button type="button" class="bulk-secondary-btn" id="bulkExtractLinksButton">Extract from page</button>
            <button type="button" class="bulk-secondary-btn" id="bulkAddTabsButton">Open tabs</button>
            <button type="button" class="bulk-secondary-btn" id="bulkAddPasteButton">Paste links</button>
          </div>
          <textarea
            class="bulk-paste"
            id="bulkPasteInput"
            placeholder="One link per line"
            aria-label="Paste links"
          ></textarea>
        </section>

        <section class="sp-card bulk-queue-section">
          <div class="bulk-queue-head">
            <div>
              <h2 class="sp-label sp-label-inline">Queue</h2>
              <p class="bulk-queue-meta" id="bulkQueueMeta">0 items</p>
            </div>
          </div>
          <div class="bulk-queue-tools">
            <button type="button" class="bulk-text-btn" id="bulkSelectAllButton">All</button>
            <button type="button" class="bulk-text-btn" id="bulkClearSelectedButton">Remove</button>
            <button type="button" class="bulk-text-btn" id="bulkRetryFailedButton">Retry</button>
            <button type="button" class="bulk-text-btn" id="bulkClearAllButton">Clear</button>
          </div>
          <div class="bulk-queue-list" id="bulkQueueList">
            <p class="bulk-queue-empty">Add tabs or paste links to build your queue.</p>
          </div>
        </section>

        <section class="sp-card bulk-destination">
          <h2 class="sp-label">Notebook</h2>
          <div class="sp-fields">
            <input id="bulkNotebookSearch" type="search" placeholder="Search notebooks" autocomplete="off" aria-label="Search notebooks">
            <select id="bulkNotebookSelect" aria-label="Notebook">
              <option value="">Loading notebooks...</option>
            </select>
            <input id="bulkNewNotebookName" type="text" placeholder="Or create new notebook" aria-label="New notebook name">
          </div>
        </section>
        <p class="bulk-limit-note" id="bulkLimitNote" hidden></p>

        <div class="bulk-progress" id="bulkProgress">
          <div class="bulk-progress-bar"><div class="bulk-progress-fill" id="bulkProgressFill"></div></div>
          <p class="bulk-progress-label" id="bulkProgressLabel">0 of 0 processed</p>
        </div>

        <div class="bulk-footer-actions">
          <button type="button" class="button sp-primary" id="bulkImportButton">Import queue</button>
          <button type="button" class="bulk-cancel-btn" id="bulkCancelButton">Cancel</button>
          <p class="bulk-summary" id="bulkSummary"></p>
          <div class="sp-actions">
            <button type="button" class="text-button" id="bulkRefreshButton">Refresh</button>
            <a class="text-button" id="bulkOpenNotebookLink" href="#" target="_blank" rel="noopener noreferrer" hidden>Open notebook</a>
          </div>
          <div class="status" id="bulkStatus" role="status"></div>
        </div>
      </div>
    `;

    statusBox = root.querySelector("#bulkStatus");
    importButton = root.querySelector("#bulkImportButton");
    cancelButton = root.querySelector("#bulkCancelButton");
    openNotebookLink = root.querySelector("#bulkOpenNotebookLink");
    pasteInput = root.querySelector("#bulkPasteInput");
    progressFill = root.querySelector("#bulkProgressFill");
    progressLabel = root.querySelector("#bulkProgressLabel");
    summaryEl = root.querySelector("#bulkSummary");
    limitNote = root.querySelector("#bulkLimitNote");
    youtubeBatchHint = root.querySelector("#bulkYouTubeHint");
    youtubeBatchDetails = root.querySelector("#bulkYouTubeDetails");
    youtubeBatchList = root.querySelector("#bulkYouTubeVideoList");

    picker = NotebookToolsPicker.create({
      searchInput: root.querySelector("#bulkNotebookSearch"),
      selectEl: root.querySelector("#bulkNotebookSelect"),
      newNameInput: root.querySelector("#bulkNewNotebookName"),
      refreshButton: root.querySelector("#bulkRefreshButton"),
      onStatus: (message, options = {}) => {
        setStatus(message, options);
      },
      onNotebookChange: (state) => {
        bulkNotebookState = state;
        void updateLimitNote(NotebookToolsBulkQueue.getSelectedPending().length);
      }
    });

    picker.bind();
    await picker.refresh({ silent: true });
    await NotebookToolsBulkQueue.restore();
    NotebookToolsBulkQueue.subscribe(renderQueue);
    renderQueue(NotebookToolsBulkQueue.getItems());
    bindEvents();
    void refreshYouTubeBatchHint();
    mounted = true;

    if (new URLSearchParams(window.location.search).get("extract") === "1") {
      void applyPendingLinkExtract();
    }
  }

  return {
    mount,
    refreshYouTubeHint: refreshYouTubeBatchHint,
    loadYouTubeBatchPreview,
    applyPendingLinkExtract
  };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsBulkImportUI = NotebookToolsBulkImportUI;
}
