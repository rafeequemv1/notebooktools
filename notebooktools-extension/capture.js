const notebookSelect = document.querySelector("#notebookSelect");
const newNotebookName = document.querySelector("#newNotebookName");
const captureTitle = document.querySelector("#captureTitle");
const captureContent = document.querySelector("#captureContent");
const saveSelectionButton = document.querySelector("#saveSelectionButton");
const statusBox = document.querySelector("#status");

let pendingCapture;
saveSelectionButton.disabled = true;

function setStatus(message, type = "success") {
  statusBox.textContent = message;
  statusBox.className = `status show ${type}`;
}

function selectedNotebookName() {
  return (
    NotebookToolsStore.cleanNotebookName(newNotebookName.value) ||
    NotebookToolsStore.cleanNotebookName(notebookSelect.value)
  );
}

async function refreshNotebookSelect() {
  const notebooks = await NotebookToolsStore.readNotebooks();
  notebookSelect.innerHTML = '<option value="">New notebook...</option>';

  for (const notebook of notebooks) {
    const option = document.createElement("option");
    option.value = notebook.name;
    option.textContent = `${notebook.name} (${notebook.items?.length || 0})`;
    notebookSelect.append(option);
  }
}

async function loadPendingCapture() {
  const result = await chrome.storage.session.get({ pendingCapture: null });
  pendingCapture = result.pendingCapture;

  if (!pendingCapture) {
    setStatus("No selected text was found. Try selecting text again.", "error");
    saveSelectionButton.disabled = true;
    return;
  }

  captureTitle.value = pendingCapture.title || "Selected text";
  captureContent.value = pendingCapture.content || "";
  saveSelectionButton.disabled = false;
}

async function saveSelection() {
  saveSelectionButton.disabled = true;

  try {
    const notebookName = selectedNotebookName();
    const capture = {
      ...pendingCapture,
      title: captureTitle.value.trim() || pendingCapture.title,
      content: captureContent.value.trim()
    };
    const notebook = await NotebookToolsStore.saveCaptureToNotebook(capture, notebookName);

    await chrome.storage.session.remove("pendingCapture");
    await refreshNotebookSelect();
    notebookSelect.value = notebook.name;
    newNotebookName.value = "";
    setStatus(`Saved selection to "${notebook.name}".`);
  } catch (error) {
    setStatus(error.message || "Could not save the selection.", "error");
  } finally {
    saveSelectionButton.disabled = false;
  }
}

notebookSelect.addEventListener("change", () => {
  if (notebookSelect.value) {
    newNotebookName.value = "";
  }
});

newNotebookName.addEventListener("input", () => {
  if (newNotebookName.value.trim()) {
    notebookSelect.value = "";
  }
});

saveSelectionButton.addEventListener("click", saveSelection);

refreshNotebookSelect();
loadPendingCapture();
