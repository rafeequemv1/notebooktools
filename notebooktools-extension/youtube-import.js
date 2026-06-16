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

function setStatus(message, type = "success") {
  statusBox.textContent = message;
  statusBox.className = `status show ${type}`;
}

function setBusy(isBusy) {
  importButton.disabled = isBusy;
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
  notebookLmSelect.innerHTML = '<option value="">Loading NotebookLM notebooks...</option>';

  try {
    notebookLmNotebooks = await NotebookToolsNotebookLM.listNotebookLmNotebooks();
    notebookLmSelect.innerHTML = '<option value="">New NotebookLM notebook...</option>';

    for (const notebook of notebookLmNotebooks) {
      const option = document.createElement("option");
      option.value = notebook.id;
      option.textContent = notebook.title;
      notebookLmSelect.append(option);
    }

    if (!silent) {
      const suffix = notebookLmNotebooks.length === 1 ? "" : "s";
      setStatus(`Loaded ${notebookLmNotebooks.length} NotebookLM notebook${suffix}.`);
    }
  } catch (error) {
    notebookLmNotebooks = [];
    notebookLmSelect.innerHTML = '<option value="">Open NotebookLM and sign in first</option>';

    if (!silent) {
      setStatus(error.message || "Could not load NotebookLM notebooks.", "error");
    }
  } finally {
    refreshButton.disabled = false;
    notebookLmSelect.disabled = false;
  }
}

async function importVideo() {
  setBusy(true);
  setStatus("Preparing import...", "success");

  try {
    if (!youtubeUrl) {
      throw new Error("No YouTube video URL was found.");
    }

    const newName = selectedNotebookName();
    let targetNotebook = null;

    if (newName) {
      setStatus("Creating NotebookLM notebook...", "success");
      targetNotebook = await NotebookToolsNotebookLM.createNotebookLmNotebook(newName);
    } else {
      targetNotebook = notebookLmNotebooks.find((notebook) => notebook.id === notebookLmSelect.value) || null;

      if (!targetNotebook) {
        throw new Error("Choose a notebook or enter a new notebook name.");
      }
    }

    setStatus("Sending video to NotebookLM...", "success");
    await NotebookToolsNotebookLM.addYoutubeToNotebookLm(targetNotebook.id, youtubeUrl);

    newNotebookLmName.value = "";
    await refreshNotebookList({ silent: true });
    notebookLmSelect.value = targetNotebook.id;
    setStatus(`Imported into "${targetNotebook.title}".`);
  } catch (error) {
    setStatus(error.message || "Could not import this video.", "error");
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
