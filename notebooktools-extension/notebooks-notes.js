const NotebookToolsNotesPanel = (() => {
  let listEl = null;
  let viewerEl = null;
  let statusEl = null;
  let activeNotebook = null;
  let authOptions = {};
  let notes = [];
  let selectedId = null;

  function setStatus(message, type = "") {
    if (!statusEl) {
      return;
    }

    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      statusEl.className = "notes-panel-status";
      return;
    }

    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = `notes-panel-status${type ? ` is-${type}` : ""}`;
  }

  function renderViewer(note) {
    if (!viewerEl) {
      return;
    }

    if (!note) {
      viewerEl.hidden = true;
      viewerEl.innerHTML = "";
      return;
    }

    viewerEl.hidden = false;
    viewerEl.innerHTML = `
      <h3 class="notes-viewer-title">${NotebookToolsStore.escapeHtml(note.title)}</h3>
      <pre class="notes-viewer-body">${NotebookToolsStore.escapeHtml(note.body)}</pre>
    `;
  }

  function selectNote(noteId) {
    selectedId = noteId;
    const note = notes.find((item) => item.id === noteId);
    renderList();
    renderViewer(note || null);
  }

  function renderList() {
    if (!listEl) {
      return;
    }

    if (!notes.length) {
      listEl.innerHTML = `<p class="notes-empty">No notes in this notebook yet.</p>`;
      renderViewer(null);
      return;
    }

    listEl.innerHTML = notes
      .map((note) => {
        const active = note.id === selectedId ? " is-active" : "";
        const snippet = note.body.slice(0, 80) + (note.body.length > 80 ? "…" : "");

        return `
          <button type="button" class="notes-item${active}" data-note-id="${note.id}">
            <span class="notes-item-title">${NotebookToolsStore.escapeHtml(note.title)}</span>
            <span class="notes-item-snippet">${NotebookToolsStore.escapeHtml(snippet)}</span>
          </button>
        `;
      })
      .join("");

    listEl.querySelectorAll("[data-note-id]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedId = button.dataset.noteId;
        const note = notes.find((item) => item.id === selectedId);
        renderList();
        renderViewer(note);
      });
    });

    if (!selectedId && notes[0]) {
      selectedId = notes[0].id;
      renderList();
      renderViewer(notes[0]);
    }
  }

  async function open(notebook, options = {}) {
    activeNotebook = notebook;
    authOptions = options.authOptions || {};
    selectedId = null;
    notes = [];
    setStatus("Loading notes...", "loading");
    listEl.innerHTML = "";
    renderViewer(null);

    try {
      notes = await NotebookToolsNotebookLM.listNotebookLmNotes(notebook.id, authOptions);
      setStatus("");
      renderList();
    } catch (error) {
      setStatus(error.message || "Could not load notes.", "error");
      listEl.innerHTML = "";
    }
  }

  function close() {
    activeNotebook = null;
    notes = [];
    selectedId = null;
    setStatus("");

    if (listEl) {
      listEl.innerHTML = "";
    }

    renderViewer(null);
  }

  function init() {
    listEl = document.querySelector("#notesList");
    viewerEl = document.querySelector("#notesViewer");
    statusEl = document.querySelector("#notesPanelStatus");
  }

  function getNotes() {
    return notes;
  }

  return { init, open, close, getNotes, selectNote };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsNotesPanel = NotebookToolsNotesPanel;
}
