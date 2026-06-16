function cleanNotebookName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

window.NotebookToolsStore = {
  cleanNotebookName
};
