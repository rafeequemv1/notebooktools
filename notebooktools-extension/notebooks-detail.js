const NotebookToolsNotebookDetail = (() => {
  let notebook = null;
  let tab = "sources";
  let authOptions = {};
  let onSourcesChanged = null;
  let onStudioCountsChanged = null;
  let notebookUrl = "";

  let onListTabChange = null;

  function setOnListTabChange(handler) {
    onListTabChange = handler;
  }

  function setListTab(listTab) {
    updateAppTabs(true, listTab);
  }

  function listChromeEl() {
    return document.querySelector("#notebooksListChrome");
  }

  function contextChromeEl() {
    return document.querySelector("#notebookContextChrome");
  }

  function showListChrome(show) {
    const listView = document.querySelector("#notebooksListView");
    const detailView = document.querySelector("#notebookDetailView");
    const podcast = document.querySelector("#podcastView");

    if (listView) {
      listView.hidden = !show;
    }

    if (podcast) {
      podcast.hidden = true;
    }

    if (!show) {
      window.NotebookToolsPodcast?.hide();
    }

    listChromeEl()?.classList.toggle("is-hidden", !show);

    const context = contextChromeEl();

    if (context) {
      context.hidden = show;
    }

    detailView.hidden = show;
    updateAppTabs(show, "notebooks");
  }

  function updateAppTabs(listMode, listTab = "notebooks") {
    document.querySelectorAll("[data-app-tab]").forEach((button) => {
      const name = button.dataset.appTab;

      if (name === "podcast") {
        button.hidden = !listMode;
        button.disabled = false;
        button.classList.toggle("is-active", listMode && listTab === "podcast");
        return;
      }

      const notebookTab = name !== "notebooks";
      button.hidden = listMode && notebookTab;
      button.disabled = listMode && notebookTab;
      button.classList.toggle("is-active", listMode ? name === listTab : name === tab);
    });
  }

  function setTab(nextTab) {
    tab = nextTab;

    document.querySelectorAll("[data-app-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.appTab === tab);
    });

    document.querySelectorAll(".detail-pane").forEach((pane) => {
      const active = pane.dataset.pane === tab;
      pane.hidden = !active;
      pane.classList.toggle("is-active", active);
    });
  }

  function renderNotesMenu() {
    const menu = document.querySelector("#detailNotesMenu");

    if (!menu) {
      return;
    }

    const notes = NotebookToolsNotesPanel.getNotes();

    if (!notes.length) {
      menu.innerHTML = `<span class="detail-notes-empty">No notes yet</span>`;
      return;
    }

    menu.innerHTML = notes
      .map(
        (note) =>
          `<button type="button" class="detail-notes-item" data-open-note="${note.id}">${NotebookToolsStore.escapeHtml(note.title)}</button>`
      )
      .join("");

    menu.querySelectorAll("[data-open-note]").forEach((button) => {
      button.addEventListener("click", () => {
        menu.hidden = true;
        setTab("notes");
        NotebookToolsNotesPanel.selectNote(button.dataset.openNote);
      });
    });
  }

  function studioOptions() {
    return {
      authOptions,
      notebookUrl,
      onStudioCountsChanged
    };
  }

  async function open(targetNotebook, options = {}) {
    notebook = targetNotebook;
    authOptions = options.authOptions || {};
    onSourcesChanged = options.onSourcesChanged || null;
    onStudioCountsChanged = options.onStudioCountsChanged || null;
    notebookUrl = options.notebookUrl || "#";
    tab = options.tab || "sources";

    const titleEl = document.querySelector("#detailNotebookTitle");
    const linkEl = document.querySelector("#detailOpenNotebook");

    if (titleEl) {
      titleEl.textContent = targetNotebook.title;
    }

    if (linkEl) {
      linkEl.href = notebookUrl;
    }

    showListChrome(false);
    setTab(tab);

    await NotebookToolsSourcesPanel.open(targetNotebook, {
      authOptions,
      onSourcesChanged
    });

    if (tab === "studio") {
      await NotebookToolsStudio.open(targetNotebook, studioOptions());
    }

    await NotebookToolsNotesPanel.open(targetNotebook, { authOptions });
    renderNotesMenu();
  }

  function close() {
    NotebookToolsSourcesPanel.close();
    NotebookToolsStudio.close();
    NotebookToolsNotesPanel.close();
    notebook = null;
    onStudioCountsChanged = null;
    showListChrome(true);
    document.querySelector("#detailNotesMenu").hidden = true;
  }

  async function switchTab(nextTab) {
    if (!notebook) {
      return;
    }

    setTab(nextTab);

    if (nextTab === "studio") {
      await NotebookToolsStudio.open(notebook, studioOptions());
    } else if (nextTab === "notes") {
      await NotebookToolsNotesPanel.open(notebook, { authOptions });
    }
  }

  function init() {
    document.querySelectorAll("[data-app-tab]").forEach((button) => {
      button.addEventListener("click", async () => {
        const nextTab = button.dataset.appTab;

        if (nextTab === "notebooks") {
          close();
          onListTabChange?.("notebooks");
          return;
        }

        if (nextTab === "podcast") {
          if (notebook) {
            close();
          }

          onListTabChange?.("podcast");
          return;
        }

        if (!notebook) {
          return;
        }

        await switchTab(nextTab);
      });
    });

    document.querySelector("#detailNotesToggle")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const menu = document.querySelector("#detailNotesMenu");

      if (!menu) {
        return;
      }

      menu.hidden = !menu.hidden;
    });

    document.addEventListener("click", (event) => {
      const wrap = document.querySelector(".detail-notes-wrap");

      if (!wrap || wrap.contains(event.target)) {
        return;
      }

      document.querySelector("#detailNotesMenu").hidden = true;
    });
  }

  return { init, open, close, switchTab, setOnListTabChange, setListTab };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsNotebookDetail = NotebookToolsNotebookDetail;
}
