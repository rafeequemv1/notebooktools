const SUCCESS_CLOSE_DELAY_MS = 1400;

const params = new URLSearchParams(window.location.search);
const youtubeUrl = params.get("url") || "";
const pageTitle = params.get("title") || "YouTube video";
const modeParam = params.get("mode") || "import";
const isStudioMode = modeParam === "studio" || modeParam === "mindmap";

const videoTitle = document.querySelector("#videoTitle");
const importButton = document.querySelector("#importButton");
const statusBox = document.querySelector("#status");
const openNotebookLink = document.querySelector("#openNotebookLink");
const headerTitle = document.querySelector(".import-header-title");
const studioOptions = document.querySelector("#studioOptions");
const studioArtifactType = document.querySelector("#studioArtifactType");
const studioOpenTabToggle = document.querySelector("#studioOpenTabToggle");

const picker = NotebookToolsPicker.create({
  searchInput: document.querySelector("#notebookSearch"),
  selectEl: document.querySelector("#notebookLmSelect"),
  newNameInput: document.querySelector("#newNotebookLmName"),
  refreshButton: document.querySelector("#refreshButton"),
  onStatus: (message, options = {}) => {
    NotebookToolsUI.setImportStatus(statusBox, {
      message,
      type: options.type || "success",
      loading: options.loading === true,
      done: options.done === true
    });
  }
});

function getSelectedArtifactType() {
  return NotebookToolsStudioImport.getSelectedArtifactType(studioArtifactType);
}

function getArtifactLabel(type = getSelectedArtifactType()) {
  return NotebookToolsStudioImport.getArtifactLabel(type);
}

function setStatus(message, options = {}) {
  NotebookToolsUI.setImportStatus(statusBox, {
    message,
    type: options.type || "success",
    loading: options.loading === true,
    done: options.done === true
  });
}

function showOpenNotebook(notebookId, artifactId = "") {
  if (!openNotebookLink || !notebookId) {
    return;
  }

  openNotebookLink.hidden = false;

  if (artifactId && NotebookToolsStore.notebookArtifactUrl) {
    openNotebookLink.textContent = `Open ${getArtifactLabel().toLowerCase()}`;
    openNotebookLink.href = NotebookToolsStore.notebookArtifactUrl(notebookId, artifactId);
    return;
  }

  openNotebookLink.textContent = "Open notebook";
  openNotebookLink.href = `https://notebook.google.com/notebook/${encodeURIComponent(notebookId)}`;
}

function syncStudioUi() {
  const artifactLabel = getArtifactLabel();

  if (headerTitle) {
    headerTitle.textContent = `${artifactLabel} from video`;
  }

  NotebookToolsStudioImport.syncStudioButton(importButton, getSelectedArtifactType());
}

async function runImport() {
  picker.setBusy(true);
  setStatus(isStudioMode ? `Preparing ${getArtifactLabel().toLowerCase()}...` : "Adding video...", {
    loading: true
  });

  try {
    if (!youtubeUrl) {
      throw new Error("No YouTube video URL was found.");
    }

    const targetNotebook = await picker.resolveTarget();

    if (isStudioMode) {
      const artifactType = getSelectedArtifactType();
      showOpenNotebook(targetNotebook.id);
      await NotebookToolsSettings.openYoutubeStudioTabIfEnabled(targetNotebook.id);

      const result = await NotebookToolsStudioImport.runPipeline({
        notebookId: targetNotebook.id,
        kind: "youtube",
        url: youtubeUrl,
        artifactType,
        onStatus: ({ message, loading, done, type }) => {
          setStatus(message, { loading, done, type });
        }
      });

      showOpenNotebook(targetNotebook.id, result.artifact.id);
      await NotebookToolsSettings.openYoutubeStudioArtifactIfEnabled(
        targetNotebook.id,
        result.artifact.id
      );
      setStatus(`${result.artifactLabel} ready.`, { done: true });
    } else {
      setStatus("Sending to NotebookLM...", { loading: true });
      await NotebookToolsNotebookLM.addYoutubeToNotebookLm(targetNotebook.id, youtubeUrl);
      showOpenNotebook(targetNotebook.id);
      await NotebookToolsSettings.openNotebookIfEnabled(targetNotebook.id);
      setStatus(`Added to "${targetNotebook.title}"`, { done: true });
    }

    document.querySelector("#newNotebookLmName").value = "";
    await picker.refresh({ silent: true });
    document.querySelector("#notebookLmSelect").value = targetNotebook.id;

    window.setTimeout(() => {
      window.parent.postMessage({ type: "notebooktools-import-success" }, "*");
    }, SUCCESS_CLOSE_DELAY_MS);
  } catch (error) {
    setStatus(error.message || "Import failed.", { type: "error" });
  } finally {
    picker.setBusy(false);
  }
}

async function initStudioOptions() {
  if (!isStudioMode || !studioOptions) {
    return;
  }

  studioOptions.hidden = false;

  await NotebookToolsStudioImport.initControls({
    typeSelect: studioArtifactType,
    openTabToggle: studioOpenTabToggle,
    studioButton: importButton,
    onTypeChange: () => syncStudioUi()
  });

  syncStudioUi();
}

if (headerTitle && !isStudioMode) {
  headerTitle.textContent = "Import to NotebookLM";
}

if (importButton && !isStudioMode) {
  importButton.textContent = "Import";
}

importButton.addEventListener("click", runImport);
picker.bind();
initStudioOptions();

videoTitle.textContent = pageTitle;
picker.refresh({ silent: true });
