const NotebookToolsYouTubeBatchPreview = (() => {
  let collection = null;
  let videos = [];
  let loading = false;
  let lastLoadedUrl = "";

  function videoKey(url) {
    return String(url || "");
  }

  function reset() {
    collection = null;
    videos = [];
    lastLoadedUrl = "";
  }

  function getCollection() {
    return collection;
  }

  function getVideos() {
    return videos;
  }

  function getSelected() {
    return videos.filter((video) => video.selected);
  }

  function selectedCount() {
    return getSelected().length;
  }

  function isLoading() {
    return loading;
  }

  function setAllSelected(selected) {
    videos = videos.map((video) => ({ ...video, selected: selected === true }));
  }

  function toggleVideo(id, selected) {
    videos = videos.map((video) =>
      video.id === id ? { ...video, selected: selected === true } : video
    );
  }

  async function loadFromActiveTab({ force = false } = {}) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabUrl = tab?.url || "";

    if (!NotebookToolsStore.isYouTubeBatchUrl(tabUrl)) {
      reset();
      return null;
    }

    if (!force && lastLoadedUrl === tabUrl && videos.length) {
      return { collection, videos };
    }

    loading = true;

    try {
      const nextCollection = await NotebookToolsYouTubeCollector.collectFromTab(tab.id);

      if (!nextCollection?.videos?.length) {
        reset();
        throw new Error(
          nextCollection?.playlistUrl
            ? "No videos found. Scroll the playlist panel or open the full playlist page."
            : "No videos found on this YouTube page."
        );
      }

      collection = nextCollection;
      videos = nextCollection.videos.map((video, index) => ({
        id: `yt-preview-${index}-${videoKey(video.url)}`,
        url: video.url,
        title: video.title || video.url,
        selected: true
      }));
      lastLoadedUrl = tabUrl;
      return { collection, videos };
    } finally {
      loading = false;
    }
  }

  function summaryLabel() {
    if (!collection) {
      return "Playlist / channel";
    }

    const kind = collection.type === "channel" ? "Channel" : "Playlist";
    const title = NotebookToolsStore.cleanNotebookName(collection.title || collection.notebookName || kind);
    return `${kind}: ${title}`;
  }

  function renderList(container, { disabled = false } = {}) {
    if (!container) {
      return;
    }

    if (!videos.length) {
      container.innerHTML = '<p class="youtube-batch-empty">Load videos from the current YouTube tab.</p>';
      return;
    }

    container.innerHTML = videos
      .map(
        (video) => `
          <label class="youtube-batch-item">
            <input
              type="checkbox"
              class="youtube-batch-check"
              data-yt-preview-id="${NotebookToolsStore.escapeHtml(video.id)}"
              ${video.selected ? "checked" : ""}
              ${disabled ? "disabled" : ""}
            >
            <span class="youtube-batch-copy">
              <span class="youtube-batch-name">${NotebookToolsStore.escapeHtml(video.title)}</span>
              <span class="youtube-batch-url">${NotebookToolsStore.escapeHtml(video.url)}</span>
            </span>
          </label>
        `
      )
      .join("");
  }

  function bindList(container, { onChange = () => {}, disabled = false } = {}) {
    if (!container || disabled) {
      return;
    }

    container.querySelectorAll("[data-yt-preview-id]").forEach((input) => {
      input.addEventListener("change", () => {
        toggleVideo(input.dataset.ytPreviewId, input.checked);
        onChange();
      });
    });
  }

  function updateMetaElements({ titleEl, countEl, selectedEl } = {}) {
    const selected = selectedCount();

    if (titleEl) {
      titleEl.textContent = summaryLabel();
    }

    if (countEl) {
      countEl.textContent = videos.length
        ? `${videos.length} video${videos.length === 1 ? "" : "s"}`
        : "";
    }

    if (selectedEl) {
      selectedEl.textContent = videos.length
        ? `${selected} selected`
        : "";
    }
  }

  async function importSelected({
    picker,
    onStatus = () => {},
    shouldCancel = () => false,
    onProgress = () => {},
    forceNewNotebook = true
  } = {}) {
    const selected = getSelected();

    if (!selected.length) {
      throw new Error("Select at least one video to import.");
    }

    if (!collection) {
      throw new Error("Load the playlist or channel first.");
    }

    const limit = NotebookToolsBulkQueue.NOTEBOOK_SOURCE_LIMIT;
    const baseName = NotebookToolsStore.suggestBatchNotebookName(collection);
    const chunks = NotebookToolsStore.chunkItems(selected, limit);
    let totalSuccess = 0;
    let totalFailed = 0;
    const createdNotebooks = [];

    for (let index = 0; index < chunks.length; index += 1) {
      if (shouldCancel()) {
        break;
      }

      let targetNotebook = null;

      if (forceNewNotebook || index > 0) {
        const partLabel = chunks.length > 1 ? ` (${index + 1}/${chunks.length})` : "";
        const notebookName = `${baseName}${partLabel}`.slice(0, 80);
        onStatus(`Creating "${notebookName}"...`, { loading: true });
        targetNotebook = await NotebookToolsNotebookLM.createNotebookLmNotebook(notebookName);
      } else if (picker) {
        onStatus("Preparing notebook...", { loading: true });
        targetNotebook = await picker.resolveTarget();
      } else {
        throw new Error("Choose a notebook or enter a new name.");
      }

      createdNotebooks.push(targetNotebook);
      onStatus(`Importing ${chunks[index].length} videos...`, { loading: true });

      const queueItems = chunks[index].map((video, itemIndex) => ({
        id: `yt-selected-${index}-${itemIndex}-${video.url}`,
        url: video.url,
        title: video.title,
        type: "youtube",
        status: "pending",
        error: "",
        selected: true,
        addedAt: Date.now()
      }));

      const summary = await NotebookToolsBulkRunner.run({
        items: queueItems,
        notebookId: targetNotebook.id,
        shouldCancel,
        onProgress
      });

      totalSuccess += summary.success;
      totalFailed += summary.failed;

      if (summary.stoppedByLimit || summary.cancelled) {
        break;
      }
    }

    const lastNotebook = createdNotebooks[createdNotebooks.length - 1];

    if (lastNotebook?.id) {
      await NotebookToolsSettings.openNotebookIfEnabled(lastNotebook.id);
    }

    return {
      totalSuccess,
      totalFailed,
      createdNotebooks,
      lastNotebook,
      baseName
    };
  }

  return {
    bindList,
    getCollection,
    getSelected,
    getVideos,
    importSelected,
    isLoading,
    loadFromActiveTab,
    renderList,
    reset,
    selectedCount,
    setAllSelected,
    summaryLabel,
    toggleVideo,
    updateMetaElements
  };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsYouTubeBatchPreview = NotebookToolsYouTubeBatchPreview;
}
