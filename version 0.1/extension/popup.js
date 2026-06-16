const params = new URLSearchParams(window.location.search);
const initialMode = params.get("mode") || "webpage";

const pageContext = document.querySelector("#pageContext");
const sourcePreview = document.querySelector("#sourcePreview");
const notebookLmSelect = document.querySelector("#notebookLmSelect");
const newNotebookLmName = document.querySelector("#newNotebookLmName");
const importButton = document.querySelector("#importButton");
const refreshNotebookLmButton = document.querySelector("#refreshNotebookLmButton");
const statusBox = document.querySelector("#status");
const modeButtons = [...document.querySelectorAll(".import-mode")];
const modeTextButton = document.querySelector("#modeText");

let notebookLmNotebooks = [];
let activeMode = initialMode;
let activeTab = null;
let pendingText = null;

const MODE_LABELS = {
  webpage: "Import webpage",
  youtube: "Import video",
  text: "Import selection"
};

function setStatus(message, options = {}) {
  NotebookToolsUI.setImportStatus(statusBox, {
    message,
    type: options.type || "success",
    loading: options.loading === true,
    done: options.done === true
  });
}

function selectedNotebookLmName() {
  return NotebookToolsStore.cleanNotebookName(newNotebookLmName.value);
}

function selectedNotebookLmId() {
  return notebookLmSelect.value || "";
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

  modeTextButton.hidden = false;
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
    return;
  }

  const youtubeUrl = NotebookToolsStore.normalizeYouTubeVideoUrl(activeTab?.url || "");
  const webpageUrl = NotebookToolsStore.normalizeWebpageUrl(activeTab?.url || "");

  if (activeMode === "youtube") {
    sourcePreview.textContent = youtubeUrl
      ? (activeTab?.title || youtubeUrl)
      : "Open a YouTube video to import it.";
    return;
  }

  sourcePreview.textContent = webpageUrl
    ? (activeTab?.title || webpageUrl)
    : "Open any webpage to import it as a NotebookLM source.";
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

async function refreshNotebookLmSelect({ silent = false } = {}) {
  refreshNotebookLmButton.disabled = true;
  notebookLmSelect.disabled = true;
  notebookLmSelect.innerHTML = '<option value="">Loading notebooks...</option>';

  if (!silent) {
    setStatus("Loading notebooks...", { loading: true });
  }

  try {
    notebookLmNotebooks = await NotebookToolsNotebookLM.listNotebookLmNotebooks();
    notebookLmSelect.innerHTML = '<option value="">Choose a notebook...</option>';

    for (const notebook of notebookLmNotebooks) {
      const option = document.createElement("option");
      option.value = notebook.id;
      option.textContent = notebook.title;
      notebookLmSelect.append(option);
    }

    if (!silent) {
      setStatus(`${notebookLmNotebooks.length} notebook${notebookLmNotebooks.length === 1 ? "" : "s"} ready.`);
    }
  } catch (error) {
    notebookLmNotebooks = [];
    notebookLmSelect.innerHTML = '<option value="">Sign in to NotebookLM first</option>';

    if (!silent) {
      setStatus(error.message || "Could not load notebooks.", { type: "error" });
    }
  } finally {
    refreshNotebookLmButton.disabled = false;
    notebookLmSelect.disabled = false;
  }
}

async function resolveTargetNotebook() {
  const newNotebookName = selectedNotebookLmName();

  if (newNotebookName) {
    setStatus("Creating notebook...", { loading: true });
    return NotebookToolsNotebookLM.createNotebookLmNotebook(newNotebookName);
  }

  const notebookId = selectedNotebookLmId();
  const targetNotebook = notebookLmNotebooks.find((notebook) => notebook.id === notebookId) || null;

  if (!targetNotebook) {
    throw new Error("Choose a notebook or enter a new name.");
  }

  return targetNotebook;
}

async function runImport() {
  NotebookToolsUI.setImportButtonState(importButton, true, MODE_LABELS[activeMode] || "Import");
  setStatus("Preparing import...", { loading: true });

  try {
    const targetNotebook = await resolveTargetNotebook();

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

    newNotebookLmName.value = "";
    await refreshNotebookLmSelect({ silent: true });
    notebookLmSelect.value = targetNotebook.id;
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

  notebookLmSelect.addEventListener("change", () => {
    if (notebookLmSelect.value) {
      newNotebookLmName.value = "";
    }
  });

  newNotebookLmName.addEventListener("input", () => {
    if (newNotebookLmName.value.trim()) {
      notebookLmSelect.value = "";
    }
  });

  refreshNotebookLmButton.addEventListener("click", () => refreshNotebookLmSelect());
  importButton.addEventListener("click", runImport);

  updateModeUi();
  refreshNotebookLmSelect({ silent: true });
}

initPopup();
