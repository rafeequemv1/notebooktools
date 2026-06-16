const SUCCESS_CLOSE_DELAY_MS = 1400;

const params = new URLSearchParams(window.location.search);
const youtubeUrl = params.get("url") || "";
const pageTitle = params.get("title") || "YouTube video";
const videoTitle = document.querySelector("#videoTitle");
const notebookLmSelect = document.querySelector("#notebookLmSelect");
const newNotebookLmName = document.querySelector("#newNotebookLmName");
const importButton = document.querySelector("#importButton");
const refreshButton = document.querySelector("#refreshButton");
const statusBox = document.querySelector("#status");

let notebookLmNotebooks = [];

function setStatus(message, options = {}) {
  NotebookToolsUI.setImportStatus(statusBox, {
    message,
    type: options.type || "success",
    loading: options.loading === true,
    done: options.done === true
  });
}

function setBusy(isBusy) {
  NotebookToolsUI.setImportButtonState(importButton, isBusy, "Import");
  refreshButton.disabled = isBusy;
  notebookLmSelect.disabled = isBusy;
  newNotebookLmName.disabled = isBusy;
}

function selectedNotebookName() {
  return NotebookToolsStore.cleanNotebookName(newNotebookLmName.value);
}

async function refreshNotebookList({ silent = false } = {}) {
  refreshButton.disabled = true;
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
    refreshButton.disabled = false;
    notebookLmSelect.disabled = false;
  }
}

async function importVideo() {
  setBusy(true);
  setStatus("Adding video...", { loading: true });

  try {
    if (!youtubeUrl) {
      throw new Error("No YouTube video URL was found.");
    }

    const newName = selectedNotebookName();
    let targetNotebook = null;

    if (newName) {
      setStatus("Creating notebook...", { loading: true });
      targetNotebook = await NotebookToolsNotebookLM.createNotebookLmNotebook(newName);
    } else {
      targetNotebook = notebookLmNotebooks.find((notebook) => notebook.id === notebookLmSelect.value) || null;

      if (!targetNotebook) {
        throw new Error("Choose a notebook or enter a new name.");
      }
    }

    setStatus("Sending to NotebookLM...", { loading: true });
    await NotebookToolsNotebookLM.addYoutubeToNotebookLm(targetNotebook.id, youtubeUrl);

    newNotebookLmName.value = "";
    await refreshNotebookList({ silent: true });
    notebookLmSelect.value = targetNotebook.id;
    setStatus(`Added to "${targetNotebook.title}"`, { done: true });
    window.setTimeout(() => {
      window.parent.postMessage({ type: "notebooktools-import-success" }, "*");
    }, SUCCESS_CLOSE_DELAY_MS);
  } catch (error) {
    setStatus(error.message || "Import failed.", { type: "error" });
  } finally {
    setBusy(false);
  }
}

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

refreshButton.addEventListener("click", () => refreshNotebookList());
importButton.addEventListener("click", importVideo);

videoTitle.textContent = pageTitle;
refreshNotebookList({ silent: true });
