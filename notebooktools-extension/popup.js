const params = new URLSearchParams(window.location.search);
const initialMode = params.get("mode") || "webpage";

const pageContext = document.querySelector("#pageContext");
const sourcePreview = document.querySelector("#sourcePreview");
const importButton = document.querySelector("#importButton");
const statusBox = document.querySelector("#status");
const modeButtons = [...document.querySelectorAll(".import-mode")];
const modeTextButton = document.querySelector("#modeText");
const openNotebookLink = document.querySelector("#openNotebookLink");
const studioSection = document.querySelector("#studioSection");
const studioArtifactType = document.querySelector("#studioArtifactType");
const studioOpenTabToggle = document.querySelector("#studioOpenTabToggle");
const studioButton = document.querySelector("#studioButton");

let activeMode = initialMode;
let activeTab = null;
let pendingText = null;

const MODE_LABELS = {
  webpage: "Add current tab to NotebookLM",
  youtube: "Import video",
  text: "Import selection"
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
  }
});

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
  if (activeMode === "text") {
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
  return activeMode === "webpage" || activeMode === "youtube";
}

function updateStudioSectionVisibility() {
  if (!studioSection) {
    return;
  }

  const visible = shouldShowStudioSection();
  const available = isStudioAvailable();

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
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      resolve(tab || null);
    });
  });
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
  NotebookToolsUI.setImportButtonState(importButton, true, MODE_LABELS[activeMode] || "Import");
  setStatus("Preparing import...", { loading: true });

  try {
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
    showOpenNotebook(targetNotebook.id);
    await NotebookToolsSettings.openNotebookIfEnabled(targetNotebook.id);
    setStatus(`Added to "${targetNotebook.title}"`, { done: true });
  } catch (error) {
    setStatus(error.message || "Import failed.", { type: "error" });
  } finally {
    NotebookToolsUI.setImportButtonState(importButton, false, MODE_LABELS[activeMode] || "Import");
  }
}

async function initPopup() {
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

  pageContext.textContent = activeMode === "youtube"
    ? "YouTube video"
    : activeMode === "text"
      ? "Selected text"
      : "Current webpage";

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

  picker.bind();
  updateModeUi();
  picker.refresh({ silent: true });
}

initPopup();
