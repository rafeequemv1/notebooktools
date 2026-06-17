const SUCCESS_CLOSE_DELAY_MS = 1400;

const params = new URLSearchParams(window.location.search);
const youtubeUrl = params.get("url") || "";
const pageTitle = params.get("title") || "YouTube video";
const videoTitle = document.querySelector("#videoTitle");
const importButton = document.querySelector("#importButton");
const statusBox = document.querySelector("#status");
const openNotebookLink = document.querySelector("#openNotebookLink");

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
  openNotebookLink.href = `https://notebooklm.google.com/notebook/${encodeURIComponent(notebookId)}`;
}

async function importVideo() {
  picker.setBusy(true);
  setStatus("Adding video...", { loading: true });

  try {
    if (!youtubeUrl) {
      throw new Error("No YouTube video URL was found.");
    }

    const targetNotebook = await picker.resolveTarget();

    setStatus("Sending to NotebookLM...", { loading: true });
    await NotebookToolsNotebookLM.addYoutubeToNotebookLm(targetNotebook.id, youtubeUrl);

    document.querySelector("#newNotebookLmName").value = "";
    await picker.refresh({ silent: true });
    document.querySelector("#notebookLmSelect").value = targetNotebook.id;
    showOpenNotebook(targetNotebook.id);
    setStatus(`Added to "${targetNotebook.title}"`, { done: true });
    window.setTimeout(() => {
      window.parent.postMessage({ type: "notebooktools-import-success" }, "*");
    }, SUCCESS_CLOSE_DELAY_MS);
  } catch (error) {
    setStatus(error.message || "Import failed.", { type: "error" });
  } finally {
    picker.setBusy(false);
  }
}

importButton.addEventListener("click", importVideo);
picker.bind();

videoTitle.textContent = pageTitle;
picker.refresh({ silent: true });
