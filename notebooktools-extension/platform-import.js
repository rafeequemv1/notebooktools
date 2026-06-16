const SUCCESS_CLOSE_DELAY_MS = 1400;

const sourceTitle = document.querySelector("#sourceTitle");
const sourcePreview = document.querySelector("#sourcePreview");
const notebookLmSelect = document.querySelector("#notebookLmSelect");
const newNotebookLmName = document.querySelector("#newNotebookLmName");
const importButton = document.querySelector("#importButton");
const refreshButton = document.querySelector("#refreshButton");
const statusBox = document.querySelector("#status");

let notebookLmNotebooks = [];
let importPayload = null;

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

function loadPayloadFromBackground() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "notebooktools-get-platform-import" }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(response?.payload || null);
      });
    } catch (_error) {
      resolve(null);
    }
  });
}

function waitForImportPayload() {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (payload) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      resolve(payload);
    };

    const fail = (message) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      reject(new Error(message));
    };

    const onMessage = (event) => {
      if (event.data?.type === "notebooktools-import-payload" && event.data.payload?.plainText) {
        finish(event.data.payload);
      }
    };

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "notebooktools-request-import" }, "*");

    loadPayloadFromBackground().then((payload) => {
      if (payload?.plainText) {
        finish(payload);
      }
    });

    const timeoutId = window.setTimeout(() => {
      fail("Nothing to import. Close this panel and try again.");
    }, 4000);
  });
}

async function loadImportPayload() {
  importPayload = await waitForImportPayload();
  sourceTitle.textContent = importPayload.title || "Conversation";
  sourcePreview.textContent = `${importPayload.messageCount || 1} segment${importPayload.messageCount === 1 ? "" : "s"} · ${importPayload.url || ""}`;
}

async function importConversation() {
  setBusy(true);
  setStatus("Preparing import...", { loading: true });

  try {
    if (!importPayload?.plainText) {
      throw new Error("Nothing to import.");
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
    await NotebookToolsNotebookLM.addTextToNotebookLm(
      targetNotebook.id,
      importPayload.title,
      importPayload.markdown || importPayload.plainText
    );

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
importButton.addEventListener("click", importConversation);

loadImportPayload()
  .then(() => refreshNotebookList({ silent: true }))
  .catch((error) => setStatus(error.message || "Could not load content.", { type: "error" }));
