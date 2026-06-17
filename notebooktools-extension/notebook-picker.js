const LAST_NOTEBOOK_KEY = "lastNotebookId";

function createNotebookPicker(config) {
  const {
    searchInput = null,
    selectEl,
    newNameInput,
    refreshButton = null,
    onStatus = () => {}
  } = config;

  let notebooks = [];
  let busy = false;

  function setBusy(isBusy) {
    busy = isBusy;
    if (selectEl) {
      selectEl.disabled = isBusy;
    }
    if (newNameInput) {
      newNameInput.disabled = isBusy;
    }
    if (refreshButton) {
      refreshButton.disabled = isBusy;
    }
    if (searchInput) {
      searchInput.disabled = isBusy;
    }
  }

  function filterOptions(query) {
    if (!selectEl) {
      return;
    }

    const needle = String(query || "").trim().toLowerCase();

    for (const option of selectEl.options) {
      if (!option.value) {
        option.hidden = false;
        continue;
      }

      option.hidden = needle ? !option.textContent.toLowerCase().includes(needle) : false;
    }
  }

  async function rememberNotebook(notebookId) {
    if (!notebookId) {
      return;
    }

    await chrome.storage.local.set({ [LAST_NOTEBOOK_KEY]: notebookId });
  }

  async function applyLastNotebook() {
    if (!selectEl) {
      return;
    }

    const stored = await chrome.storage.local.get(LAST_NOTEBOOK_KEY);
    const lastId = stored[LAST_NOTEBOOK_KEY];

    if (lastId && notebooks.some((notebook) => notebook.id === lastId)) {
      selectEl.value = lastId;
    }
  }

  function selectedNotebookName() {
    return NotebookToolsStore.cleanNotebookName(newNameInput?.value || "");
  }

  function selectedNotebookId() {
    return selectEl?.value || "";
  }

  function getNotebookById(notebookId) {
    return notebooks.find((notebook) => notebook.id === notebookId) || null;
  }

  async function refresh({ silent = false } = {}) {
    setBusy(true);

    if (selectEl) {
      selectEl.innerHTML = '<option value="">Loading notebooks...</option>';
    }

    if (!silent) {
      onStatus("Loading notebooks...", { loading: true });
    }

    try {
      notebooks = await NotebookToolsNotebookLM.listNotebookLmNotebooks();

      if (selectEl) {
        selectEl.innerHTML = '<option value="">Choose a notebook...</option>';

        for (const notebook of notebooks) {
          const option = document.createElement("option");
          option.value = notebook.id;
          option.textContent = notebook.title;
          selectEl.append(option);
        }
      }

      await applyLastNotebook();
      filterOptions(searchInput?.value || "");

      if (!silent) {
        onStatus(`${notebooks.length} notebook${notebooks.length === 1 ? "" : "s"} ready.`);
      }
    } catch (error) {
      notebooks = [];

      if (selectEl) {
        selectEl.innerHTML = '<option value="">Sign in to NotebookLM first</option>';
      }

      if (!silent) {
        onStatus(error.message || "Could not load notebooks.", { type: "error" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function resolveTarget() {
    const newName = selectedNotebookName();

    if (newName) {
      onStatus("Creating notebook...", { loading: true });
      const created = await NotebookToolsNotebookLM.createNotebookLmNotebook(newName);
      await rememberNotebook(created.id);
      return created;
    }

    const target = getNotebookById(selectedNotebookId());

    if (!target) {
      throw new Error("Choose a notebook or enter a new name.");
    }

    await rememberNotebook(target.id);
    return target;
  }

  function bind() {
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        filterOptions(searchInput.value);
      });
    }

    if (selectEl) {
      selectEl.addEventListener("change", () => {
        if (selectEl.value && newNameInput) {
          newNameInput.value = "";
        }
      });
    }

    if (newNameInput) {
      newNameInput.addEventListener("input", () => {
        if (newNameInput.value.trim() && selectEl) {
          selectEl.value = "";
        }
      });
    }

    if (refreshButton) {
      refreshButton.addEventListener("click", () => refresh());
    }
  }

  return {
    bind,
    refresh,
    resolveTarget,
    rememberNotebook,
    getNotebookById,
    selectedNotebookId,
    selectedNotebookName,
    setBusy,
    get notebooks() {
      return notebooks;
    }
  };
}

if (typeof window !== "undefined") {
  window.NotebookToolsPicker = {
    create: createNotebookPicker,
    LAST_NOTEBOOK_KEY
  };
}
