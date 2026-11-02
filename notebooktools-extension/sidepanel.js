const params = new URLSearchParams(window.location.search);
const initialMode = params.get("mode") || "webpage";
const initialPanel = params.get("panel") || "import";
const initialExtract = params.get("extract") === "1";

const pageContext = document.querySelector("#pageContext");
const sourcePreview = document.querySelector("#sourcePreview");
const importButton = document.querySelector("#importButton");
const statusBox = document.querySelector("#status");
const modeButtons = [...document.querySelectorAll(".import-mode")];
const modeTextButton = document.querySelector("#modeText");
const openNotebookLink = document.querySelector("#openNotebookLink");
const importLimitNote = document.querySelector("#importLimitNote");
const autoOpenToggle = document.querySelector("#autoOpenNotebookToggle");
const youtubeBatchPanel = document.querySelector("#youtubeBatchPanel");
const youtubeBatchList = document.querySelector("#youtubeBatchList");
const youtubeBatchTitle = document.querySelector("#youtubeBatchTitle");
const youtubeBatchMeta = document.querySelector("#youtubeBatchMeta");
const youtubeBatchSelected = document.querySelector("#youtubeBatchSelected");
const openNotebooksButton = document.querySelector("#openNotebooksButton");
const studioSection = document.querySelector("#studioSection");
const studioArtifactType = document.querySelector("#studioArtifactType");
const studioOpenTabToggle = document.querySelector("#studioOpenTabToggle");
const studioButton = document.querySelector("#studioButton");

function openNotebooksPage() {
  const url = chrome.runtime.getURL("notebooks.html");

  chrome.tabs.create({ url }, () => {
    if (chrome.runtime.lastError) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  });
}

openNotebooksButton?.addEventListener("click", (event) => {
  event.preventDefault();
  openNotebooksPage();
});

const panelTabs = [...document.querySelectorAll(".sidepanel-tab")];
const panels = {
  import: document.querySelector("#panelImport"),
  bulk: document.querySelector("#panelBulk"),
  snapshots: document.querySelector("#panelSnapshots"),
  prompts: document.querySelector("#panelPrompts")
};

let activeMode = initialMode;
let activeTab = null;
let pendingText = null;
let promptsMounted = false;
let bulkMounted = false;
let snapshotsMounted = false;
let importNotebookState = { notebookId: "", isNewNotebook: false, cachedSourceCount: null };
let youtubeBatchActive = false;
let youtubeBatchLoading = false;

const MODE_LABELS = {
  webpage: "Add page to notebook",
  youtube: "Add video to notebook",
  text: "Add text to notebook"
};

const picker = NotebookToolsPicker.create({
  searchInput: document.querySelector("#notebookSearch"),
  selectEl: document.querySelector("#notebookLmSelect"),
  newNameInput: document.querySelector("#newNotebookLmName"),
  refreshButton: document.querySelector("#refreshNotebookLmButton"),
  onStatus: (message, options = {}) => {
    NotebookToolsUI.setImportStatus(statusBox, {
      message,
      type: options.type || "success",
      loading: options.loading === true,
      done: options.done === true
    });
  },
  onNotebookChange: (state) => {
    importNotebookState = state;
    refreshImportLimitNote();
  }
});

function refreshImportLimitNote() {
  const adding = youtubeBatchActive
    ? NotebookToolsYouTubeBatchPreview.selectedCount()
    : 1;

  NotebookToolsSourceLimits.updateLimitNote(importLimitNote, {
    ...importNotebookState,
    adding
  });
}

function renderYouTubeBatchPreview() {
  if (!youtubeBatchPanel || !youtubeBatchList) {
    return;
  }

  NotebookToolsYouTubeBatchPreview.updateMetaElements({
    titleEl: youtubeBatchTitle,
    countEl: youtubeBatchMeta,
    selectedEl: youtubeBatchSelected
  });
  NotebookToolsYouTubeBatchPreview.renderList(youtubeBatchList, {
    disabled: youtubeBatchLoading
  });
  NotebookToolsYouTubeBatchPreview.bindList(youtubeBatchList, {
    disabled: youtubeBatchLoading,
    onChange: () => {
      renderYouTubeBatchPreview();
      refreshImportLimitNote();
      updateYouTubeImportButton();
    }
  });
  updateYouTubeImportButton();
}

function updateYouTubeImportButton() {
  if (!youtubeBatchActive || activeMode !== "youtube") {
    return;
  }

  const selected = NotebookToolsYouTubeBatchPreview.selectedCount();
  importButton.textContent = selected
    ? `Import ${selected} selected video${selected === 1 ? "" : "s"}`
    : "Select videos to import";
  importButton.disabled = youtubeBatchLoading || !selected;
}

async function refreshYouTubeBatchPreview({ force = false } = {}) {
  if (activeMode !== "youtube") {
    youtubeBatchActive = false;
    youtubeBatchPanel?.setAttribute("hidden", "");
    NotebookToolsYouTubeBatchPreview.reset();
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isBatch = NotebookToolsStore.isYouTubeBatchUrl(tab?.url || "");

  if (!isBatch) {
    youtubeBatchActive = false;
    youtubeBatchPanel?.setAttribute("hidden", "");
    NotebookToolsYouTubeBatchPreview.reset();
    updateModeUi();
    return;
  }

  youtubeBatchActive = true;
  youtubeBatchPanel?.removeAttribute("hidden");
  youtubeBatchLoading = true;
  renderYouTubeBatchPreview();
  setStatus("Loading playlist videos...", { loading: true });

  try {
    const result = await NotebookToolsYouTubeBatchPreview.loadFromActiveTab({ force });
    const collection = result?.collection;

    if (collection?.notebookName) {
      document.querySelector("#newNotebookLmName").value = collection.notebookName;
      importNotebookState = {
        notebookId: "",
        isNewNotebook: true,
        cachedSourceCount: 0
      };
    }

    renderYouTubeBatchPreview();
    refreshImportLimitNote();
    setStatus(`${NotebookToolsYouTubeBatchPreview.getVideos().length} videos loaded. Uncheck any you do not want.`);
  } catch (error) {
    youtubeBatchPanel?.setAttribute("hidden", "");
    youtubeBatchActive = false;
    NotebookToolsYouTubeBatchPreview.reset();
    setStatus(error.message || "Could not load playlist videos.", { type: "error" });
    updateModeUi();
  } finally {
    youtubeBatchLoading = false;
    renderYouTubeBatchPreview();
    updateStudioSectionVisibility();
  }
}

function setStatus(message, options = {}) {
  NotebookToolsUI.setImportStatus(statusBox, {
    message,
    type: options.type || "success",
    loading: options.loading === true,
    done: options.done === true
  });
}

function showOpenNotebook(notebookId, artifactId = "", artifactLabel = "") {
  if (!openNotebookLink || !notebookId) {
    return;
  }

  openNotebookLink.hidden = false;

  if (artifactId && NotebookToolsStore.notebookArtifactUrl) {
    openNotebookLink.textContent = `Open ${(artifactLabel || "output").toLowerCase()}`;
    openNotebookLink.href = NotebookToolsStore.notebookArtifactUrl(notebookId, artifactId);
    return;
  }

  openNotebookLink.textContent = "Open notebook";
  openNotebookLink.href = `https://notebook.google.com/notebook/${encodeURIComponent(notebookId)}`;
}

function isStudioAvailable() {
  if (activeMode === "text" || youtubeBatchActive) {
    return false;
  }

  if (activeMode === "youtube") {
    return Boolean(NotebookToolsStore.normalizeYouTubeVideoUrl(activeTab?.url || ""));
  }

  if (activeMode === "webpage") {
    return Boolean(NotebookToolsStore.normalizeWebpageUrl(activeTab?.url || ""));
  }

  return false;
}

function shouldShowStudioSection() {
  return activeMode === "webpage" || (activeMode === "youtube" && !youtubeBatchActive);
}

function updateStudioSectionVisibility() {
  if (!studioSection) {
    return;
  }

  const visible = shouldShowStudioSection();
  const available = isStudioAvailable();
  const hintEl = studioSection.querySelector(".sp-studio-hint");

  studioSection.hidden = !visible;
  studioSection.classList.toggle("is-unavailable", visible && !available);

  if (studioButton) {
    studioButton.disabled = !available;
  }

  if (studioArtifactType) {
    studioArtifactType.disabled = !available;
  }

  if (studioOpenTabToggle) {
    studioOpenTabToggle.disabled = !available;
  }

  if (hintEl) {
    if (!visible) {
      hintEl.textContent = "Import this page and create a NotebookLM studio output.";
    } else if (available) {
      hintEl.textContent = "Import this page and create a NotebookLM studio output.";
    } else if (activeMode === "youtube") {
      hintEl.textContent = "Open a YouTube watch page to use Studio.";
    } else {
      hintEl.textContent = "Open an article, blog, or PDF page to use Studio.";
    }
  }
}

async function refreshActiveTabContext() {
  activeTab = await getActiveTab();
  updateModeUi();

  if (activeMode === "youtube") {
    await refreshYouTubeBatchPreview();
  } else {
    updateStudioSectionVisibility();
  }
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      resolve(tab || null);
    });
  });
}

function setActivePanel(panelName) {
  panelTabs.forEach((tab) => {
    const isActive = tab.dataset.panel === panelName;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  Object.entries(panels).forEach(([name, panel]) => {
    if (!panel) {
      return;
    }

    const isActive = name === panelName;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });

  if (panelName === "prompts" && !promptsMounted) {
    const root = document.querySelector("#promptLibraryRoot");
    if (root) {
      NotebookToolsPromptLibraryUI.mount(root);
      promptsMounted = true;
    }
  }

  if (panelName === "bulk" && !bulkMounted) {
    const root = document.querySelector("#bulkImportRoot");
    if (root) {
      NotebookToolsBulkImportUI.mount(root).then(() => {
        if (initialExtract) {
          void NotebookToolsBulkImportUI.applyPendingLinkExtract?.();
        }

        if (params.get("tabs") === "1") {
          root.querySelector("#bulkAddTabsButton")?.click();
        }
      });
      bulkMounted = true;
    }
  } else if (panelName === "bulk" && bulkMounted && initialExtract) {
    void NotebookToolsBulkImportUI.applyPendingLinkExtract?.();
  }

  if (panelName === "snapshots" && !snapshotsMounted) {
    const root = document.querySelector("#snapshotsPanelRoot");

    if (root) {
      void NotebookToolsSnapshotsPanel.mount(root);
      snapshotsMounted = true;
    }
  } else if (panelName === "snapshots" && snapshotsMounted) {
    void NotebookToolsSnapshotsPanel.refreshList?.();
  }

  if (panelName === "import") {
    pageContext.textContent = activeMode === "youtube"
      ? "YouTube video"
      : activeMode === "text"
        ? "Selected text"
        : "Current webpage";
    void refreshYouTubeBatchPreview();
  } else if (panelName === "bulk") {
    pageContext.textContent = "Bulk import queue";

    if (bulkMounted && window.NotebookToolsBulkImportUI?.refreshYouTubeHint) {
      NotebookToolsBulkImportUI.refreshYouTubeHint();
    }
  } else if (panelName === "snapshots") {
    pageContext.textContent = "Capture & send screenshots";
  } else {
    pageContext.textContent = "Slide deck prompts";
  }
}

async function loadPendingText() {
  if (initialMode !== "text") {
    return;
  }

  const stored = await chrome.storage.session.get("pendingTextImport");
  pendingText = stored.pendingTextImport || null;

  if (!pendingText?.text) {
    pageContext.textContent = "No text selected";
    sourcePreview.textContent = "Highlight text on a page, then right-click → Add to NotebookLM.";
    return;
  }

  if (modeTextButton) {
    modeTextButton.hidden = false;
  }

  activeMode = "text";
  pageContext.textContent = "Selected text";
  sourcePreview.textContent = pendingText.text.slice(0, 140) + (pendingText.text.length > 140 ? "..." : "");
}

function updateModeUi() {
  for (const button of modeButtons) {
    button.classList.toggle("is-active", button.dataset.mode === activeMode);
    button.hidden = button.dataset.mode === "text" && !pendingText?.text;
  }

  importButton.textContent = MODE_LABELS[activeMode] || "Import";
  importButton.disabled = false;

  if (activeMode === "youtube" && youtubeBatchActive) {
    updateYouTubeImportButton();
  }

  if (activeMode === "text" && pendingText?.text) {
    sourcePreview.textContent = pendingText.text.slice(0, 140) + (pendingText.text.length > 140 ? "..." : "");
    updateStudioSectionVisibility();
    return;
  }

  const youtubeUrl = NotebookToolsStore.normalizeYouTubeVideoUrl(activeTab?.url || "");
  const webpageUrl = NotebookToolsStore.normalizeWebpageUrl(activeTab?.url || "");

  if (activeMode === "youtube") {
    sourcePreview.textContent = youtubeUrl
      ? (activeTab?.title || youtubeUrl)
      : "Open a YouTube video to import it.";
    updateStudioSectionVisibility();
    return;
  }

  sourcePreview.textContent = webpageUrl
    ? (activeTab?.title || webpageUrl)
    : "Open any webpage to import it as a NotebookLM source.";

  updateStudioSectionVisibility();
}

function setActiveMode(mode) {
  if (mode === "text" && !pendingText?.text) {
    return;
  }

  if (mode === "youtube" && !NotebookToolsStore.isYouTubeUrl(activeTab?.url || "")) {
    setStatus("Open a YouTube video first.", { type: "error" });
    return;
  }

  if (mode === "webpage" && !NotebookToolsStore.normalizeWebpageUrl(activeTab?.url || "")) {
    setStatus("This page cannot be imported as a webpage.", { type: "error" });
    return;
  }

  activeMode = mode;
  updateModeUi();
  setStatus("");

  if (mode === "youtube") {
    void refreshYouTubeBatchPreview();
  } else {
    youtubeBatchPanel?.setAttribute("hidden", "");
    youtubeBatchActive = false;
    NotebookToolsYouTubeBatchPreview.reset();
    updateStudioSectionVisibility();
  }
}

async function runStudioImport() {
  const artifactType = NotebookToolsStudioImport.getSelectedArtifactType(studioArtifactType);
  const artifactLabel = NotebookToolsStudioImport.getArtifactLabel(artifactType);
  const idleLabel = `Create ${artifactLabel.toLowerCase()}`;

  NotebookToolsUI.setImportButtonState(studioButton, true, idleLabel);
  picker.setBusy(true);
  setStatus(`Preparing ${artifactLabel.toLowerCase()}...`, { loading: true });

  try {
    if (!isStudioAvailable()) {
      throw new Error("Studio is not available for this page.");
    }

    await NotebookToolsSourceLimits.assertCanImport({
      ...importNotebookState,
      adding: 1
    });

    const targetNotebook = await picker.resolveTarget();
    const kind = activeMode === "youtube" ? "youtube" : "webpage";
    const sourceUrl =
      kind === "youtube"
        ? NotebookToolsStore.normalizeYouTubeVideoUrl(activeTab?.url || "")
        : NotebookToolsStore.normalizeWebpageUrl(activeTab?.url || "");

    if (!sourceUrl) {
      throw new Error(kind === "youtube" ? "Open a YouTube video first." : "This page cannot be imported.");
    }

    showOpenNotebook(targetNotebook.id);
    await NotebookToolsSettings.openYoutubeStudioTabIfEnabled(targetNotebook.id);

    const result = await NotebookToolsStudioImport.runPipeline({
      notebookId: targetNotebook.id,
      kind,
      url: sourceUrl,
      artifactType,
      onStatus: ({ message, loading, done, type }) => {
        setStatus(message, { loading, done, type });
      }
    });

    document.querySelector("#newNotebookLmName").value = "";
    await picker.refresh({ silent: true });
    document.querySelector("#notebookLmSelect").value = targetNotebook.id;
    importNotebookState = {
      notebookId: targetNotebook.id,
      isNewNotebook: false,
      cachedSourceCount: typeof importNotebookState.cachedSourceCount === "number"
        ? importNotebookState.cachedSourceCount + 1
        : 1
    };
    refreshImportLimitNote();
    showOpenNotebook(targetNotebook.id, result.artifact.id, result.artifactLabel);
    await NotebookToolsSettings.openYoutubeStudioArtifactIfEnabled(
      targetNotebook.id,
      result.artifact.id
    );
    setStatus(`${result.artifactLabel} ready.`, { done: true });
  } catch (error) {
    setStatus(error.message || "Studio import failed.", { type: "error" });
  } finally {
    NotebookToolsUI.setImportButtonState(studioButton, false, idleLabel);
    picker.setBusy(false);
  }
}

async function runImport() {
  const batchSelected = youtubeBatchActive ? NotebookToolsYouTubeBatchPreview.selectedCount() : 0;
  const idleLabel = youtubeBatchActive
    ? `Import ${batchSelected} selected video${batchSelected === 1 ? "" : "s"}`
    : MODE_LABELS[activeMode] || "Import";

  NotebookToolsUI.setImportButtonState(importButton, true, idleLabel);
  setStatus("Preparing import...", { loading: true });

  try {
    if (youtubeBatchActive) {
      const selectedCount = NotebookToolsYouTubeBatchPreview.selectedCount();

      if (!selectedCount) {
        throw new Error("Select at least one video to import.");
      }

      await NotebookToolsSourceLimits.assertCanImport({
        ...importNotebookState,
        adding: selectedCount
      });

      const result = await NotebookToolsYouTubeBatchPreview.importSelected({
        picker,
        forceNewNotebook: false,
        onStatus: setStatus
      });

      document.querySelector("#newNotebookLmName").value = "";
      await picker.refresh({ silent: true });

      if (result.lastNotebook?.id) {
        document.querySelector("#notebookLmSelect").value = result.lastNotebook.id;
        importNotebookState = {
          notebookId: result.lastNotebook.id,
          isNewNotebook: false,
          cachedSourceCount: result.totalSuccess
        };
        showOpenNotebook(result.lastNotebook.id);
      }

      refreshImportLimitNote();
      setStatus(`Imported ${result.totalSuccess} video${result.totalSuccess === 1 ? "" : "s"}.`, {
        done: result.totalFailed === 0
      });
      return;
    }

    await NotebookToolsSourceLimits.assertCanImport({
      ...importNotebookState,
      adding: 1
    });

    const targetNotebook = await picker.resolveTarget();

    setStatus("Sending to NotebookLM...", { loading: true });

    if (activeMode === "youtube") {
      const youtubeUrl = NotebookToolsStore.normalizeYouTubeVideoUrl(activeTab?.url || "");

      if (!youtubeUrl) {
        throw new Error("Open a YouTube video first.");
      }

      await NotebookToolsNotebookLM.addYoutubeToNotebookLm(targetNotebook.id, youtubeUrl);
    } else if (activeMode === "text") {
      if (!pendingText?.text) {
        throw new Error("No selected text found.");
      }

      await NotebookToolsNotebookLM.addTextToNotebookLm(
        targetNotebook.id,
        pendingText.title,
        pendingText.text
      );
      await chrome.storage.session.remove("pendingTextImport");
    } else {
      const webpageUrl = NotebookToolsStore.normalizeWebpageUrl(activeTab?.url || "");

      if (!webpageUrl) {
        throw new Error("This page cannot be imported as a webpage.");
      }

      await NotebookToolsNotebookLM.addWebpageToNotebookLm(targetNotebook.id, webpageUrl);
    }

    document.querySelector("#newNotebookLmName").value = "";
    await picker.refresh({ silent: true });
    document.querySelector("#notebookLmSelect").value = targetNotebook.id;
    importNotebookState = {
      notebookId: targetNotebook.id,
      isNewNotebook: false,
      cachedSourceCount: typeof importNotebookState.cachedSourceCount === "number"
        ? importNotebookState.cachedSourceCount + 1
        : 1
    };
    refreshImportLimitNote();
    showOpenNotebook(targetNotebook.id);
    await NotebookToolsSettings.openNotebookIfEnabled(targetNotebook.id);
    setStatus(`Added to "${targetNotebook.title}"`, { done: true });
  } catch (error) {
    setStatus(error.message || "Import failed.", { type: "error" });
  } finally {
    NotebookToolsUI.setImportButtonState(
      importButton,
      false,
      youtubeBatchActive ? idleLabel : MODE_LABELS[activeMode] || "Import"
    );
  }
}

async function initSidePanel() {
  await NotebookToolsTheme.init();
  const appSettings = await NotebookToolsSettings.getAppSettings();
  await NotebookToolsI18n.init(appSettings.language);
  NotebookToolsI18n.apply(document);
  NotebookToolsSettingsUI.init();
  NotebookToolsAccountUI.init();
  NotebookToolsPromptLibraryUI.setAppSettings(appSettings);

  NotebookToolsSettings.onChange(async (next) => {
    await NotebookToolsI18n.init(next.language);
    NotebookToolsI18n.apply(document);
    NotebookToolsPromptLibraryUI.setAppSettings(next);

    if (promptsMounted) {
      const root = document.querySelector("#promptLibraryRoot");

      if (root) {
        NotebookToolsPromptLibraryUI.refreshDisplay(root);
      }
    }
  });

  activeTab = await getActiveTab();
  await loadPendingText();

  const youtubeUrl = NotebookToolsStore.normalizeYouTubeVideoUrl(activeTab?.url || "");
  const webpageUrl = NotebookToolsStore.normalizeWebpageUrl(activeTab?.url || "");

  if (initialMode === "text" && pendingText?.text) {
    activeMode = "text";
  } else if (youtubeUrl) {
    activeMode = "youtube";
  } else if (webpageUrl) {
    activeMode = "webpage";
  } else {
    activeMode = "webpage";
  }

  panelTabs.forEach((tab) => {
    tab.addEventListener("click", () => setActivePanel(tab.dataset.panel));
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveMode(button.dataset.mode));
  });

  importButton.addEventListener("click", runImport);
  studioButton?.addEventListener("click", runStudioImport);
  await NotebookToolsStudioImport.initControls({
    typeSelect: studioArtifactType,
    openTabToggle: studioOpenTabToggle,
    studioButton
  });
  updateStudioSectionVisibility();
  document.querySelector("#youtubeBatchSelectAll")?.addEventListener("click", () => {
    NotebookToolsYouTubeBatchPreview.setAllSelected(true);
    renderYouTubeBatchPreview();
    refreshImportLimitNote();
  });
  document.querySelector("#youtubeBatchSelectNone")?.addEventListener("click", () => {
    NotebookToolsYouTubeBatchPreview.setAllSelected(false);
    renderYouTubeBatchPreview();
    refreshImportLimitNote();
  });
  document.querySelector("#youtubeBatchReload")?.addEventListener("click", () => {
    void refreshYouTubeBatchPreview({ force: true });
  });
  picker.bind();
  updateModeUi();
  void picker.refresh({ silent: true });

  if (autoOpenToggle) {
    autoOpenToggle.checked = await NotebookToolsSettings.getAutoOpenNotebook();
    autoOpenToggle.addEventListener("change", () => {
      NotebookToolsSettings.setAutoOpenNotebook(autoOpenToggle.checked);
    });
  }

  if (initialPanel === "prompts") {
    setActivePanel("prompts");
  } else if (initialPanel === "bulk") {
    setActivePanel("bulk");
  } else if (initialPanel === "snapshots") {
    setActivePanel("snapshots");
  } else {
    setActivePanel("import");
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshActiveTabContext();
    }
  });

  chrome.tabs.onActivated.addListener(() => {
    void refreshActiveTabContext();
  });

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === "complete") {
      void refreshActiveTabContext();
    }
  });

  if (activeMode === "youtube") {
    void refreshYouTubeBatchPreview();
  }
}

initSidePanel().catch((error) => {
  console.error("NotebookTools side panel init failed:", error);
  const status = document.querySelector("#status");

  if (status) {
    status.textContent = error?.message || "Side panel failed to load.";
    status.classList.add("error");
  }
});
