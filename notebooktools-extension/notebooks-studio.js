const NotebookToolsStudio = (() => {
  const STUDIO_TYPES = [
    { id: "audio", label: "Audio" },
    { id: "quiz", label: "Quiz" },
    { id: "flashcards", label: "Cards" },
    { id: "report", label: "Report" },
    { id: "slide_deck", label: "Slides" },
    { id: "data_table", label: "Table" },
    { id: "mind_map", label: "Mind map" },
    { id: "video", label: "Video" },
    { id: "infographic", label: "Graphic" }
  ];

  const TYPE_OPTIONS = {
    audio: {
      format: [
        { value: 1, label: "Deep dive" },
        { value: 2, label: "Brief" },
        { value: 3, label: "Critique" },
        { value: 4, label: "Debate" }
      ],
      length: [
        { value: 1, label: "Short" },
        { value: 2, label: "Default" },
        { value: 3, label: "Long" }
      ]
    },
    video: {
      format: [
        { value: 1, label: "Explainer" },
        { value: 2, label: "Brief" }
      ]
    },
    slide_deck: {
      format: [
        { value: 1, label: "Detailed" },
        { value: 2, label: "Presenter" }
      ],
      length: [
        { value: 1, label: "Default" },
        { value: 2, label: "Short" }
      ]
    },
    infographic: {
      orientation: [
        { value: 1, label: "Landscape" },
        { value: 2, label: "Portrait" },
        { value: 3, label: "Square" }
      ],
      detail: [
        { value: 1, label: "Concise" },
        { value: 2, label: "Standard" },
        { value: 3, label: "Detailed" }
      ]
    },
    quiz: {
      quantity: [
        { value: 1, label: "Fewer" },
        { value: 2, label: "Standard" }
      ],
      difficulty: [
        { value: 1, label: "Easy" },
        { value: 2, label: "Medium" },
        { value: 3, label: "Hard" }
      ]
    },
    flashcards: {
      quantity: [
        { value: 1, label: "Fewer" },
        { value: 2, label: "Standard" }
      ],
      difficulty: [
        { value: 1, label: "Easy" },
        { value: 2, label: "Medium" },
        { value: 3, label: "Hard" }
      ]
    }
  };

  let rootEl = null;
  let activeNotebook = null;
  let authOptions = {};
  let sources = [];
  let artifacts = [];
  let selectedTypes = new Set(["audio"]);
  let manageSelectedIds = new Set();
  let manageFolderOpen = false;
  let studioFolderState = { folders: [], assignments: {} };
  let studioFilter = "all";
  let manageModalBound = false;
  let loading = false;
  let onStudioCountsChanged = null;

  function typeMeta(id) {
    return STUDIO_TYPES.find((item) => item.id === id) || STUDIO_TYPES[0];
  }

  function setStatus(message, type = "") {
    const statusEl = rootEl?.querySelector("#studioStatus");

    if (!statusEl) {
      return;
    }

    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      statusEl.className = "studio-status";
      return;
    }

    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = `studio-status${type ? ` is-${type}` : ""}`;
  }

  function renderOptionGroup(label, name, options, selectedValue) {
    if (!options?.length) {
      return "";
    }

    return `
      <div class="studio-option-group">
        <span class="studio-option-label">${NotebookToolsStore.escapeHtml(label)}</span>
        <div class="studio-option-pills">
          ${options
            .map((option) => {
              const active = Number(selectedValue) === option.value ? " is-active" : "";
              return `<button type="button" class="studio-option-pill${active}" data-option="${name}" data-value="${option.value}">${NotebookToolsStore.escapeHtml(option.label)}</button>`;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function renderOptions() {
    const optionsEl = rootEl?.querySelector("#studioOptions");
    const primaryType = [...selectedTypes][0] || "audio";
    const config = TYPE_OPTIONS[primaryType] || {};
    const state = rootEl?.dataset || {};

    if (!optionsEl) {
      return;
    }

    const html =
      renderOptionGroup("Format", "format", config.format, state.format || config.format?.[0]?.value) +
      renderOptionGroup("Length", "length", config.length, state.length || config.length?.[0]?.value) +
      renderOptionGroup("Orientation", "orientation", config.orientation, state.orientation || config.orientation?.[0]?.value) +
      renderOptionGroup("Detail", "detail", config.detail, state.detail || config.detail?.[0]?.value) +
      renderOptionGroup("Quantity", "quantity", config.quantity, state.quantity || config.quantity?.[0]?.value) +
      renderOptionGroup("Difficulty", "difficulty", config.difficulty, state.difficulty || config.difficulty?.[0]?.value);

    optionsEl.innerHTML = html || `<p class="studio-options-empty">No extra options for this type.</p>`;

    optionsEl.querySelectorAll(".studio-option-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        rootEl.dataset[pill.dataset.option] = pill.dataset.value;
        renderOptions();
      });
    });
  }

  function renderTypeGrid() {
    const gridEl = rootEl?.querySelector("#studioTypeGrid");

    if (!gridEl) {
      return;
    }

    gridEl.innerHTML = STUDIO_TYPES.map((type) => {
      const active = selectedTypes.has(type.id) ? " is-active" : "";
      return `<button type="button" class="studio-type-pill${active}" data-studio-type="${type.id}">${NotebookToolsStore.escapeHtml(type.label)}</button>`;
    }).join("");

    gridEl.querySelectorAll("[data-studio-type]").forEach((pill) => {
      pill.addEventListener("click", () => {
        const typeId = pill.dataset.studioType;

        if (selectedTypes.has(typeId)) {
          if (selectedTypes.size > 1) {
            selectedTypes.delete(typeId);
          }
        } else {
          selectedTypes.add(typeId);
        }

        renderTypeGrid();
        renderOptions();
        updateGenerateLabel();
      });
    });
  }

  function renderSourceSelect() {
    const selectEl = rootEl?.querySelector("#studioSourceSelect");

    if (!selectEl) {
      return;
    }

    selectEl.innerHTML = `
      <option value="all">All sources (${sources.length})</option>
      ${sources
        .map(
          (source) =>
            `<option value="${source.id}">${NotebookToolsStore.escapeHtml(source.title)}</option>`
        )
        .join("")}
    `;
  }


  function setManageStatus(message, type = "") {
    const el = document.querySelector("#studioManageStatus");
    if (!el) return;
    el.textContent = message || "";
    el.hidden = !message;
    el.classList.toggle("is-error", type === "error");
    el.classList.toggle("is-loading", type === "loading");
  }

  function updateManageToolbar() {
    const countEl = document.querySelector("#studioManageCount");
    const selectAllEl = document.querySelector("#studioManageSelectAll");
    const organizeEl = document.querySelector("#studioManageOrganize");
    const deleteEl = document.querySelector("#studioManageDelete");
    const n = manageSelectedIds.size;
    const total = artifacts.length;
    if (countEl) countEl.textContent = `${n} selected`;
    if (selectAllEl) selectAllEl.textContent = n && n === total ? "Deselect all" : "Select all";
    if (organizeEl) organizeEl.disabled = n === 0;
    if (deleteEl) deleteEl.disabled = n === 0;
  }

  function renderManageList() {
    const list = document.querySelector("#studioManageList");
    if (!list) return;
    if (!artifacts.length) {
      list.innerHTML = `<p class="manage-empty">No Studio files yet.</p>`;
      updateManageToolbar();
      return;
    }
    list.innerHTML = artifacts
      .map((artifact) => {
        const checked = manageSelectedIds.has(artifact.id);
        const folder = studioFolderState.assignments[artifact.id] || "";
        return `
          <label class="manage-row${checked ? " is-selected" : ""}">
            <input type="checkbox" class="src-select-input" data-studio-manage-check="${artifact.id}"${checked ? " checked" : ""} aria-label="Select file" />
            <span class="manage-row-title">${NotebookToolsStore.escapeHtml(artifact.title || artifact.type || "Untitled")}</span>
            <span class="manage-row-meta">${NotebookToolsStore.escapeHtml(folder || artifact.type || "")}</span>
          </label>
        `;
      })
      .join("");
    list.querySelectorAll("[data-studio-manage-check]").forEach((input) => {
      input.addEventListener("change", () => {
        const id = input.dataset.studioManageCheck;
        if (input.checked) manageSelectedIds.add(id);
        else manageSelectedIds.delete(id);
        renderManageList();
      });
    });
    updateManageToolbar();
  }

  function renderManageFolders() {
    const panel = document.querySelector("#studioManageFolderPanel");
    const list = document.querySelector("#studioManageFolderList");
    if (!panel || !list) return;
    panel.hidden = !manageFolderOpen;
    if (!manageFolderOpen) return;
    const folders = studioFolderState.folders || [];
    list.innerHTML = folders.length
      ? folders
          .map(
            (name) =>
              `<button type="button" class="manage-folder-pill" data-studio-folder="${NotebookToolsStore.escapeHtml(name)}">${NotebookToolsStore.escapeHtml(name)}</button>`
          )
          .join("")
      : `<p class="manage-empty">No folders yet — create one below.</p>`;
    list.querySelectorAll("[data-studio-folder]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await assignSelectedStudioFolder(btn.dataset.studioFolder);
      });
    });
  }

  async function assignSelectedStudioFolder(folderName) {
    if (!activeNotebook || !manageSelectedIds.size) return;
    setManageStatus("Organizing...", "loading");
    try {
      studioFolderState = await NotebookToolsNotebookFolders.assignStudioArtifactsFolder(
        activeNotebook.id,
        [...manageSelectedIds],
        folderName
      );
      setManageStatus(`Moved ${manageSelectedIds.size} file(s) into “${folderName}”.`);
      manageFolderOpen = false;
      renderManageFolders();
      renderManageList();
      renderArtifacts();
    } catch (error) {
      setManageStatus(error.message || "Could not organize.", "error");
    }
  }

  async function unfileSelectedStudio() {
    if (!activeNotebook || !manageSelectedIds.size) return;
    setManageStatus("Removing from folders...", "loading");
    try {
      studioFolderState = await NotebookToolsNotebookFolders.assignStudioArtifactsFolder(
        activeNotebook.id,
        [...manageSelectedIds],
        "Unfiled"
      );
      setManageStatus("Removed from folders.");
      manageFolderOpen = false;
      renderManageFolders();
      renderManageList();
      renderArtifacts();
    } catch (error) {
      setManageStatus(error.message || "Could not update folders.", "error");
    }
  }

  async function manageDeleteSelectedStudio() {
    if (!activeNotebook || !manageSelectedIds.size) return;
    if (!window.confirm(`Delete ${manageSelectedIds.size} selected Studio file(s)?`)) return;
    setManageStatus("Deleting...", "loading");
    try {
      for (const artifactId of [...manageSelectedIds]) {
        await NotebookToolsNotebookLM.deleteNotebookLmArtifact(
          activeNotebook.id,
          artifactId,
          authOptions
        );
      }
      manageSelectedIds.clear();
      await reloadArtifacts();
      setManageStatus("Deleted.");
      renderManageList();
    } catch (error) {
      setManageStatus(error.message || "Could not delete files.", "error");
    }
  }

  function openManageModal() {
    const modal = document.querySelector("#studioManageModal");
    if (!modal || !activeNotebook) return;
    manageSelectedIds.clear();
    manageFolderOpen = false;
    setManageStatus("");
    renderManageFolders();
    renderManageList();
    modal.hidden = false;
  }

  function closeManageModal() {
    const modal = document.querySelector("#studioManageModal");
    if (modal) modal.hidden = true;
    manageFolderOpen = false;
    setManageStatus("");
  }

  function bindManageModal() {
    if (manageModalBound) return;
    manageModalBound = true;
    document.querySelector("#studioManageClose")?.addEventListener("click", closeManageModal);
    document.querySelector("#studioManageBackdrop")?.addEventListener("click", closeManageModal);
    document.querySelector("#studioManageSelectAll")?.addEventListener("click", () => {
      if (manageSelectedIds.size && manageSelectedIds.size === artifacts.length) {
        manageSelectedIds.clear();
      } else {
        manageSelectedIds = new Set(artifacts.map((a) => a.id));
      }
      renderManageList();
    });
    document.querySelector("#studioManageOrganize")?.addEventListener("click", () => {
      manageFolderOpen = !manageFolderOpen;
      renderManageFolders();
    });
    document.querySelector("#studioManageDelete")?.addEventListener("click", () => {
      void manageDeleteSelectedStudio();
    });
    document.querySelector("#studioManageUnfile")?.addEventListener("click", () => {
      void unfileSelectedStudio();
    });
    document.querySelector("#studioManageCreateFolder")?.addEventListener("click", async () => {
      const input = document.querySelector("#studioManageNewFolder");
      const name = input?.value?.trim();
      if (!name || !activeNotebook) return;
      setManageStatus("Creating folder...", "loading");
      try {
        await NotebookToolsNotebookFolders.addStudioFolder(activeNotebook.id, name);
        studioFolderState = await NotebookToolsNotebookFolders.getStudioState(activeNotebook.id);
        if (input) input.value = "";
        renderManageFolders();
        setManageStatus("Folder created.");
      } catch (error) {
        setManageStatus(error.message || "Could not create folder.", "error");
      }
    });
  }

  function renderArtifacts() {
    const listEl = rootEl?.querySelector("#studioArtifactList");

    if (!listEl) {
      return;
    }

    if (!artifacts.length) {
      listEl.innerHTML = `<p class="studio-empty">No outputs yet.</p>`;
      return;
    }

    listEl.innerHTML = artifacts
      .map((artifact) => {
        const status =
          artifact.status === "generating"
            ? "…"
            : artifact.status === "ready"
              ? "Ready"
              : artifact.status === "failed"
                ? "Failed"
                : "—";

        const openButton =
          artifact.status === "ready"
            ? `<button type="button" class="studio-row-open" data-open-artifact="${artifact.id}">Open in NotebookLM</button>`
            : "";

        const folder = studioFolderState.assignments[artifact.id] || "";
        return `
          <article class="studio-row${artifact.status === "ready" ? " is-ready" : ""}" data-artifact-id="${artifact.id}">
            <span class="studio-row-type">${NotebookToolsStore.escapeHtml(artifact.type)}</span>
            <span class="studio-row-title">${NotebookToolsStore.escapeHtml(artifact.title)}${folder ? ` · ${NotebookToolsStore.escapeHtml(folder)}` : ""}</span>
            <span class="studio-row-status is-${artifact.status}">${status}</span>
            ${openButton}
          </article>
        `;
      })
      .join("");

    listEl.querySelectorAll("[data-open-artifact]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openArtifactInNotebookLm(button.dataset.openArtifact);
      });
    });
  }

  function openArtifactInNotebookLm(artifactId) {
    if (!activeNotebook || !artifactId) {
      return;
    }

    const url = NotebookToolsStore.notebookArtifactUrl(
      activeNotebook.id,
      artifactId,
      authOptions.authUser
    );

    chrome.tabs.create({ url });
  }

  async function exportSources() {
    if (!activeNotebook || !sources.length) {
      setStatus("No sources to export.", "error");
      return;
    }

    setStatus(`Exporting ${sources.length} source${sources.length === 1 ? "" : "s"}...`, "loading");

    try {
      const parts = [];

      for (const source of sources) {
        const payload = await NotebookToolsNotebookLM.getNotebookLmSourceContent(
          activeNotebook.id,
          source.id,
          authOptions
        );
        const title = payload.title || source.title || "Untitled";
        const body = payload.content || "(No extractable text for this source.)";
        parts.push(`# ${title}\n\n${body}`);
      }

      const notebookTitle = (activeNotebook.title || "notebook")
        .replace(/[<>:"/\\|?*]+/g, "-")
        .slice(0, 60);
      const blob = new Blob([parts.join("\n\n---\n\n")], {
        type: "text/plain;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${notebookTitle}-sources.txt`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`Exported ${sources.length} source${sources.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatus(error.message || "Could not export sources.", "error");
    }
  }

  async function persistStudioCounts(artifactList) {
    if (!activeNotebook) {
      return;
    }

    const studioCounts = NotebookToolsNotebooksCache.summarizeStudioArtifacts(artifactList);

    await NotebookToolsNotebooksCache.updateNotebook(authOptions.authUser, activeNotebook.id, {
      studioCounts
    });

    if (typeof onStudioCountsChanged === "function") {
      onStudioCountsChanged(activeNotebook.id, studioCounts);
    }
  }

  function updateGenerateLabel() {
    const button = rootEl?.querySelector("#studioGenerateButton");

    if (!button) {
      return;
    }

    const count = selectedTypes.size;
    const primary = typeMeta([...selectedTypes][0]);
    button.textContent = count > 1 ? `Generate ${count}` : `Generate ${primary.label.toLowerCase()}`;
  }

  function getSelectedSourceIds() {
    const selectEl = rootEl?.querySelector("#studioSourceSelect");
    const value = selectEl?.value || "all";

    if (value === "all") {
      return sources.map((source) => source.id);
    }

    return [value];
  }

  function buildConfigForType(typeId) {
    const state = rootEl?.dataset || {};

    return {
      instructions: rootEl?.querySelector("#studioInstructions")?.value?.trim() || "",
      language: "en",
      sourceIds: getSelectedSourceIds(),
      format: Number(state.format) || undefined,
      length: Number(state.length) || undefined,
      orientation: Number(state.orientation) || undefined,
      detail: Number(state.detail) || undefined,
      quantity: Number(state.quantity) || undefined,
      difficulty: Number(state.difficulty) || undefined,
      title: typeId === "report" ? "Briefing Doc" : undefined
    };
  }

  async function generate() {
    if (loading || !activeNotebook) {
      return;
    }

    const sourceIds = getSelectedSourceIds();

    if (!sourceIds.length) {
      setStatus("Add sources before generating.", "error");
      return;
    }

    loading = true;
    setStatus("Starting...", "loading");
    const button = rootEl?.querySelector("#studioGenerateButton");
    button.disabled = true;

    try {
      for (const typeId of selectedTypes) {
        await NotebookToolsNotebookLM.createNotebookLmArtifact(
          activeNotebook.id,
          typeId,
          buildConfigForType(typeId),
          authOptions
        );
      }

      await reloadArtifacts();
      setStatus("Generation started.", "loading");
    } catch (error) {
      setStatus(error.message || "Could not start generation.", "error");
    } finally {
      loading = false;
      button.disabled = false;
    }
  }

  async function reloadArtifacts() {
    if (!activeNotebook) {
      return;
    }

    artifacts = await NotebookToolsNotebookLM.listNotebookLmArtifacts(
      activeNotebook.id,
      authOptions
    ).catch(() => []);
    renderArtifacts();
    await persistStudioCounts(artifacts);
  }

  function bind() {
    rootEl?.querySelector("#studioGenerateButton")?.addEventListener("click", generate);
    rootEl?.querySelector("#studioManageButton")?.addEventListener("click", openManageModal);
    bindManageModal();
    rootEl?.querySelector("#studioExportSources")?.addEventListener("click", () => {
      void exportSources();
    });
  }

  function renderShell() {
    if (!rootEl) {
      return;
    }

    rootEl.innerHTML = `
      <div class="studio-shell">
        <div class="studio-bar">
          <div class="studio-type-pills" id="studioTypeGrid"></div>
          <select id="studioSourceSelect" class="studio-select" aria-label="Sources"></select>
          <button type="button" class="button compact" id="studioGenerateButton">Generate audio</button>
        </div>
        <details class="studio-more">
          <summary>Options</summary>
          <div class="studio-options" id="studioOptions"></div>
          <textarea id="studioInstructions" class="studio-textarea" maxlength="5000" placeholder="Optional instructions..." aria-label="Instructions"></textarea>
        </details>
        <div class="studio-status" id="studioStatus" hidden></div>
        <div class="studio-list-head">
          <span>Outputs</span>
          <div class="studio-list-actions">
            <button type="button" class="studio-tool-btn" id="studioManageButton">Manage</button>
            <button type="button" class="studio-tool-btn" id="studioExportSources">Export sources</button>
          </div>
        </div>
        <div class="studio-list" id="studioArtifactList"></div>
      </div>
    `;

    bind();
    renderTypeGrid();
    renderOptions();
    renderSourceSelect();
    renderArtifacts();
    updateGenerateLabel();
  }

  async function open(notebook, options = {}) {
    activeNotebook = notebook;
    authOptions = options.authOptions || {};
    onStudioCountsChanged = options.onStudioCountsChanged || null;
    selectedTypes = new Set(["audio"]);
    rootEl.dataset.format = "1";
    rootEl.dataset.length = "2";

    renderShell();
    setStatus("Loading...", "loading");

    try {
      sources = await NotebookToolsNotebookLM.listNotebookLmSources(notebook.id, authOptions);
      studioFolderState = await NotebookToolsNotebookFolders.getStudioState(notebook.id);
      renderSourceSelect();
      await reloadArtifacts();
      setStatus("");
    } catch (error) {
      setStatus(error.message || "Could not load studio.", "error");
    }
  }

  function close() {
    closeManageModal();
    activeNotebook = null;
    onStudioCountsChanged = null;
    sources = [];
    artifacts = [];
    manageSelectedIds.clear();
    setStatus("");

    if (rootEl) {
      rootEl.innerHTML = "";
    }
  }

  function init() {
    rootEl = document.querySelector("#studioApp");
  }

  return { init, open, close };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsStudio = NotebookToolsStudio;
}
