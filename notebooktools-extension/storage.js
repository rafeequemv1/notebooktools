const NOTEBOOKTOOLS_MAX_CAPTURE_CHARS = 100000;

function notebookToolsId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanNotebookName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function limitCaptureContent(content) {
  const value = String(content || "").trim();

  if (value.length <= NOTEBOOKTOOLS_MAX_CAPTURE_CHARS) {
    return { content: value, truncated: false };
  }

  return {
    content: value.slice(0, NOTEBOOKTOOLS_MAX_CAPTURE_CHARS),
    truncated: true
  };
}

async function readNotebooks() {
  const result = await chrome.storage.local.get({ notebooks: [] });
  return Array.isArray(result.notebooks) ? result.notebooks : [];
}

async function writeNotebooks(notebooks) {
  await chrome.storage.local.set({ notebooks });
}

async function saveCaptureToNotebook(capture, notebookName) {
  const name = cleanNotebookName(notebookName);

  if (!name) {
    throw new Error("Choose an existing notebook or enter a new notebook name.");
  }

  if (!capture?.content) {
    throw new Error("There is no content to save.");
  }

  const notebooks = await readNotebooks();
  let notebook = notebooks.find(
    (item) => item.name.toLowerCase() === name.toLowerCase()
  );

  if (!notebook) {
    notebook = {
      id: notebookToolsId(),
      name,
      createdAt: new Date().toISOString(),
      items: []
    };
    notebooks.unshift(notebook);
  }

  if (!Array.isArray(notebook.items)) {
    notebook.items = [];
  }

  const limited = limitCaptureContent(capture.content);
  notebook.items.unshift({
    id: notebookToolsId(),
    type: capture.type || "note",
    title: capture.title || "Untitled",
    url: capture.url || "",
    content: limited.content,
    truncated: limited.truncated,
    capturedAt: capture.createdAt || new Date().toISOString(),
    savedAt: new Date().toISOString()
  });

  await writeNotebooks(notebooks);
  return notebook;
}

window.NotebookToolsStore = {
  cleanNotebookName,
  readNotebooks,
  saveCaptureToNotebook
};
