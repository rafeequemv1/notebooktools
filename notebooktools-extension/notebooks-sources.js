const NotebookToolsSourcesPanel = (() => {
  let listEl = null;
  let statusEl = null;
  let filterEl = null;
  let searchEl = null;
  let bulkDeleteEl = null;
  let bulkExportEl = null;
  let scanDuplicatesEl = null;
  let checkFreshnessEl = null;
  let refreshStaleEl = null;
  let viewModeEl = null;
  let activeNotebook = null;
  let authOptions = {};
  let sources = [];
  let labels = [];
  let sourceFreshness = {};
  let isCheckingFreshness = false;
  let isRefreshingAll = false;
  let activeFilter = "all";
  let searchQuery = "";
  let selectMode = true;
  let selectedIds = new Set();
  let manageSelectedIds = new Set();
  let manageFolderOpen = false;
  let loading = false;
  let onSourcesChanged = null;
  let appSettings = null;

  function setAppSettings(settings) {
    appSettings = settings;
  }

  function isTagEnabled(tagId) {
    return NotebookToolsSettings.isCardTagEnabled(appSettings, tagId);
  }

  function labelsForSource(sourceId) {
    return labels.filter((label) => label.sourceIds.includes(sourceId));
  }

  function sourceIdsInLabels() {
    const ids = new Set();

    for (const label of labels) {
      for (const sourceId of label.sourceIds) {
        ids.add(sourceId);
      }
    }

    return ids;
  }

  function filteredSources() {
    const labeled = sourceIdsInLabels();
    const query = searchQuery.trim().toLowerCase();

    return sources.filter((source) => {
      const folder = labelsForSource(source.id);

      if (activeFilter === "unfiled" && folder.length) {
        return false;
      }

      if (activeFilter !== "all" && activeFilter !== "unfiled") {
        const label = labels.find((item) => item.id === activeFilter);
        if (!label || !label.sourceIds.includes(source.id)) {
          return false;
        }
      }

      if (query) {
        const haystack = `${source.title} ${source.type} ${source.url || ""}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }

  function refreshableSources() {
    return sources.filter((source) =>
      NotebookToolsNotebookLM.isRefreshableSourceType(source.typeCode)
    );
  }

  function staleCount() {
    return refreshableSources().filter((source) => sourceFreshness[source.id] === "stale").length;
  }

  function updateFreshnessUi() {
    const refreshable = refreshableSources();
    const stale = staleCount();
    const busy = loading || isCheckingFreshness || isRefreshingAll;

    if (checkFreshnessEl) {
      checkFreshnessEl.hidden = refreshable.length === 0;
      checkFreshnessEl.disabled = busy;
      checkFreshnessEl.textContent = isCheckingFreshness ? "Checking..." : "Check updates";
    }

    if (refreshStaleEl) {
      refreshStaleEl.hidden = stale === 0;
      refreshStaleEl.disabled = busy;
      refreshStaleEl.textContent =
        stale > 0 ? `Refresh stale (${stale})` : "Refresh stale";
    }
  }

  function updateScanDuplicatesUi() {
    if (!scanDuplicatesEl) {
      return;
    }

    scanDuplicatesEl.disabled = loading || sources.length < 2;
  }

  function updateBulkUi() {
    if (viewModeEl) {
      viewModeEl.value = selectMode ? "select" : "browse";
    }

    const showBulk = selectMode && selectedIds.size > 0;

    if (bulkExportEl) {
      bulkExportEl.hidden = !showBulk;
      bulkExportEl.textContent =
        selectedIds.size > 0 ? `Export (${selectedIds.size})` : "Export selected";
    }

    if (bulkDeleteEl) {
      bulkDeleteEl.hidden = !showBulk;
      bulkDeleteEl.textContent =
        selectedIds.size > 0 ? `Delete (${selectedIds.size})` : "Delete selected";
    }

    updateScanDuplicatesUi();
    updateFreshnessUi();
  }

  function setStatus(message, type = "") {
    if (!statusEl) {
      return;
    }

    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      statusEl.className = "src-panel-status";
      return;
    }

    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = `src-panel-status${type ? ` is-${type}` : ""}`;
  }

  function closeMenus() {
    document.querySelectorAll(".src-dropdown-menu, .src-label-menu").forEach((node) => node.remove());
  }

  function renderFilters() {
    if (!filterEl) {
      return;
    }

    const pills = [
      { id: "all", label: "All" },
      ...labels.map((label) => ({
        id: label.id,
        label: label.emoji ? `${label.emoji} ${label.name}` : label.name
      })),
      { id: "unfiled", label: "Unfiled" }
    ];

    filterEl.innerHTML =
      pills
        .map((pill) => {
          const active = activeFilter === pill.id ? " is-active" : "";
          return `<button type="button" class="src-filter-pill${active}" data-src-filter="${pill.id}">${NotebookToolsStore.escapeHtml(pill.label)}</button>`;
        })
        .join("") +
      `<button type="button" class="src-filter-pill src-filter-add" id="srcNewFolderButton">+ Folder</button>`;

    filterEl.querySelectorAll("[data-src-filter]").forEach((pill) => {
      pill.addEventListener("click", () => {
        activeFilter = pill.dataset.srcFilter;
        renderFilters();
        renderList();
      });
    });

    filterEl.querySelector("#srcNewFolderButton")?.addEventListener("click", async () => {
      const name = window.prompt("Folder name");

      if (!name?.trim()) {
        return;
      }

      try {
        setStatus("Creating folder...", "loading");
        await NotebookToolsNotebookLM.createNotebookLmLabel(
          activeNotebook.id,
          name.trim(),
          authOptions
        );
        await reload({ quiet: true });
        activeFilter = labels.find((item) => item.name === name.trim())?.id || activeFilter;
        setStatus("");
      } catch (error) {
        setStatus(error.message || "Could not create folder.", "error");
      }
    });
  }

  function openSourceMenu(anchor, source) {
    if (selectMode) {
      return;
    }

    closeMenus();

    const menu = document.createElement("div");
    menu.className = "src-dropdown-menu";
    const canEdit = source.typeCode === 4;

    menu.innerHTML = `
      ${source.url ? `<button type="button" class="src-menu-item" data-action="open" data-id="${source.id}">Open link</button>` : ""}
      ${
        NotebookToolsNotebookLM.isRefreshableSourceType(source.typeCode)
          ? `<button type="button" class="src-menu-item" data-action="refresh" data-id="${source.id}">${
              sourceFreshness[source.id] === "stale" ? "Refresh (update available)" : "Refresh source"
            }</button>`
          : ""
      }
      <button type="button" class="src-menu-item" data-action="rename" data-id="${source.id}">Rename</button>
      ${canEdit ? `<button type="button" class="src-menu-item" data-action="edit" data-id="${source.id}">Edit text</button>` : ""}
      <button type="button" class="src-menu-item" data-action="folders" data-id="${source.id}">Organize in folders</button>
      <button type="button" class="src-menu-item" data-action="export" data-id="${source.id}">Export</button>
      <button type="button" class="src-menu-item is-danger" data-action="delete" data-id="${source.id}">Delete</button>
    `;

    menu.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");

      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeMenus();

      const action = button.dataset.action;
      const current = sources.find((item) => item.id === button.dataset.id);

      if (!current) {
        return;
      }

      if (action === "open" && current.url) {
        chrome.tabs.create({ url: current.url });
        return;
      }

      if (action === "refresh") {
        await refreshSource(current);
        return;
      }

      if (action === "rename") {
        const nextTitle = window.prompt("Source name", current.title);

        if (!nextTitle?.trim() || nextTitle.trim() === current.title) {
          return;
        }

        await runAction("Renaming source...", async () => {
          await NotebookToolsNotebookLM.renameNotebookLmSource(
            activeNotebook.id,
            current.id,
            nextTitle.trim(),
            authOptions
          );
        });
        return;
      }

      if (action === "edit") {
        await openEditModal(current);
        return;
      }

      if (action === "folders") {
        openLabelMenu(anchor, current);
        return;
      }

      if (action === "export") {
        await exportSource(current);
        return;
      }

      if (action === "delete") {
        if (!window.confirm(`Delete "${current.title}"?`)) {
          return;
        }

        await runAction("Deleting source...", async () => {
          await NotebookToolsNotebookLM.deleteNotebookLmSource(
            activeNotebook.id,
            current.id,
            authOptions
          );
        });
      }
    });

    document.body.append(menu);

    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(8, rect.right - 170)}px`;
    menu.style.top = `${rect.bottom + 4}px`;
  }

  function openLabelMenu(anchor, source) {
    closeMenus();

    const menu = document.createElement("div");
    menu.className = "src-label-menu";
    const assigned = new Set(labelsForSource(source.id).map((label) => label.id));

    menu.innerHTML = `
      <div class="src-label-menu-head">Move to folders</div>
      ${
        labels.length
          ? labels
              .map((label) => {
                const checked = assigned.has(label.id) ? " checked" : "";
                const labelName = label.emoji ? `${label.emoji} ${label.name}` : label.name;
                return `
                  <label class="src-label-option">
                    <input type="checkbox" data-label-id="${label.id}"${checked} />
                    <span>${NotebookToolsStore.escapeHtml(labelName)}</span>
                  </label>
                `;
              })
              .join("")
          : `<p class="src-label-empty">No folders yet. Create one above.</p>`
      }
      <div class="src-label-menu-actions">
        <button type="button" class="button compact" data-save-labels="${source.id}">Save</button>
      </div>
    `;

    menu.querySelector("[data-save-labels]")?.addEventListener("click", async () => {
      const selected = [...menu.querySelectorAll("input[data-label-id]:checked")].map(
        (input) => input.dataset.labelId
      );

      closeMenus();

      await runAction("Updating folders...", async () => {
        await NotebookToolsNotebookLM.setNotebookLmSourceLabels(
          activeNotebook.id,
          source.id,
          selected,
          authOptions
        );
      });
    });

    document.body.append(menu);

    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(8, rect.right - 220)}px`;
    menu.style.top = `${rect.bottom + 4}px`;
  }

  async function runAction(message, task) {
    if (loading) {
      return;
    }

    loading = true;
    setStatus(message, "loading");

    try {
      await task();
      await reload({ quiet: true });
      setStatus("");

      if (typeof onSourcesChanged === "function") {
        onSourcesChanged(activeNotebook.id, sources.length);
      }
    } catch (error) {
      setStatus(error.message || "Action failed.", "error");
    } finally {
      loading = false;
    }
  }

  async function checkAllFreshness({ quiet = false } = {}) {
    const targets = refreshableSources();

    if (!targets.length || !activeNotebook || isCheckingFreshness) {
      return;
    }

    isCheckingFreshness = true;
    updateFreshnessUi();

    if (!quiet) {
      setStatus(`Checking ${targets.length} source${targets.length === 1 ? "" : "s"} for updates...`, "loading");
    }

    const next = { ...sourceFreshness };
    const batchSize = 5;

    try {
      for (let index = 0; index < targets.length; index += batchSize) {
        const batch = targets.slice(index, index + batchSize);

        await Promise.all(
          batch.map(async (source) => {
            next[source.id] = "checking";

            try {
              const result = await NotebookToolsNotebookLM.checkNotebookLmSourceFreshness(
                activeNotebook.id,
                source.id,
                authOptions
              );
              next[source.id] = result || null;
            } catch (_error) {
              next[source.id] = null;
            }
          })
        );

        sourceFreshness = { ...next };
        renderList();
        updateFreshnessUi();
      }

      if (!quiet) {
        const stale = staleCount();
        setStatus(
          stale
            ? `${stale} source${stale === 1 ? "" : "s"} have updates available.`
            : "All checked sources are up to date."
        );
      } else {
        setStatus("");
      }
    } catch (error) {
      if (!quiet) {
        setStatus(error.message || "Could not check for updates.", "error");
      }
    } finally {
      isCheckingFreshness = false;
      updateFreshnessUi();
      renderList();
    }
  }

  async function refreshSource(source, { force = false } = {}) {
    if (!activeNotebook || !source || loading || isRefreshingAll) {
      return;
    }

    loading = true;
    sourceFreshness = { ...sourceFreshness, [source.id]: "checking" };
    updateFreshnessUi();
    renderList();
    setStatus(`Checking "${source.title}" for updates...`, "loading");

    try {
      let freshness = sourceFreshness[source.id];

      if (freshness !== "stale") {
        freshness = await NotebookToolsNotebookLM.checkNotebookLmSourceFreshness(
          activeNotebook.id,
          source.id,
          authOptions
        );
      }

      if (freshness !== "stale" && !force) {
        sourceFreshness = { ...sourceFreshness, [source.id]: freshness || "fresh" };
        setStatus(`"${source.title}" is already up to date.`);
        return;
      }

      setStatus(`Refreshing "${source.title}"...`, "loading");
      await NotebookToolsNotebookLM.refreshNotebookLmSource(
        activeNotebook.id,
        source.id,
        authOptions
      );
      sourceFreshness = { ...sourceFreshness, [source.id]: "fresh" };
      setStatus(`"${source.title}" refreshed.`);
      await reload({ quiet: true });
    } catch (error) {
      sourceFreshness = { ...sourceFreshness, [source.id]: null };
      setStatus(error.message || "Could not refresh source.", "error");
    } finally {
      loading = false;
      updateFreshnessUi();
      renderList();
    }
  }

  async function refreshAllStale() {
    const staleSources = refreshableSources().filter(
      (source) => sourceFreshness[source.id] === "stale"
    );

    if (!staleSources.length || isRefreshingAll) {
      return;
    }

    isRefreshingAll = true;
    loading = true;
    updateFreshnessUi();
    setStatus(`Refreshing ${staleSources.length} source${staleSources.length === 1 ? "" : "s"}...`, "loading");

    let refreshed = 0;

    try {
      for (const source of staleSources) {
        setStatus(`Refreshing "${source.title}" (${refreshed + 1}/${staleSources.length})...`, "loading");

        try {
          await NotebookToolsNotebookLM.refreshNotebookLmSource(
            activeNotebook.id,
            source.id,
            authOptions
          );
          sourceFreshness = { ...sourceFreshness, [source.id]: "fresh" };
          refreshed += 1;
        } catch (_error) {
          sourceFreshness = { ...sourceFreshness, [source.id]: null };
        }
      }

      await reload({ quiet: true });
      setStatus(
        refreshed
          ? `Refreshed ${refreshed} source${refreshed === 1 ? "" : "s"}.`
          : "Could not refresh sources."
      );
    } finally {
      isRefreshingAll = false;
      loading = false;
      updateFreshnessUi();
      renderList();
    }
  }


  function setManageStatus(message, type = "") {
    const el = document.querySelector("#srcManageStatus");
    if (!el) return;
    el.textContent = message || "";
    el.hidden = !message;
    el.classList.toggle("is-error", type === "error");
    el.classList.toggle("is-loading", type === "loading");
  }

  function updateManageToolbar() {
    const countEl = document.querySelector("#srcManageCount");
    const selectAllEl = document.querySelector("#srcManageSelectAll");
    const organizeEl = document.querySelector("#srcManageOrganize");
    const deleteEl = document.querySelector("#srcManageDelete");
    const n = manageSelectedIds.size;
    const total = sources.length;
    if (countEl) countEl.textContent = `${n} selected`;
    if (selectAllEl) selectAllEl.textContent = n && n === total ? "Deselect all" : "Select all";
    if (organizeEl) organizeEl.disabled = n === 0;
    if (deleteEl) deleteEl.disabled = n === 0;
  }

  function renderManageList() {
    const list = document.querySelector("#srcManageList");
    if (!list) return;

    if (!sources.length) {
      list.innerHTML = `<p class="manage-empty">No sources in this notebook.</p>`;
      updateManageToolbar();
      return;
    }

    list.innerHTML = sources
      .map((source) => {
        const checked = manageSelectedIds.has(source.id);
        const folderNames = labelsForSource(source.id)
          .map((label) => (label.emoji ? `${label.emoji} ${label.name}` : label.name))
          .join(", ");
        return `
          <label class="manage-row${checked ? " is-selected" : ""}" data-manage-id="${source.id}">
            <input type="checkbox" class="src-select-input" data-manage-check="${source.id}"${checked ? " checked" : ""} aria-label="Select source" />
            <span class="manage-row-title">${NotebookToolsStore.escapeHtml(source.title || "Untitled")}</span>
            <span class="manage-row-meta">${NotebookToolsStore.escapeHtml(folderNames || source.type || "")}</span>
          </label>
        `;
      })
      .join("");

    list.querySelectorAll("[data-manage-check]").forEach((input) => {
      input.addEventListener("change", () => {
        const id = input.dataset.manageCheck;
        if (input.checked) manageSelectedIds.add(id);
        else manageSelectedIds.delete(id);
        renderManageList();
      });
    });

    updateManageToolbar();
  }

  function renderManageFolders() {
    const panel = document.querySelector("#srcManageFolderPanel");
    const list = document.querySelector("#srcManageFolderList");
    if (!panel || !list) return;
    panel.hidden = !manageFolderOpen;
    if (!manageFolderOpen) return;

    list.innerHTML = labels.length
      ? labels
          .map((label) => {
            const name = label.emoji ? `${label.emoji} ${label.name}` : label.name;
            return `<button type="button" class="manage-folder-pill" data-manage-folder="${label.id}">${NotebookToolsStore.escapeHtml(name)}</button>`;
          })
          .join("")
      : `<p class="manage-empty">No folders yet — create one below.</p>`;

    list.querySelectorAll("[data-manage-folder]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await assignSelectedToFolder(btn.dataset.manageFolder);
      });
    });
  }

  async function assignSelectedToFolder(labelId) {
    if (!manageSelectedIds.size || !activeNotebook) return;
    setManageStatus("Organizing sources...", "loading");
    try {
      for (const sourceId of [...manageSelectedIds]) {
        const current = labelsForSource(sourceId).map((label) => label.id);
        const next = new Set(current);
        next.add(labelId);
        await NotebookToolsNotebookLM.setNotebookLmSourceLabels(
          activeNotebook.id,
          sourceId,
          [...next],
          authOptions
        );
      }
      await reload({ quiet: true });
      setManageStatus(`Moved ${manageSelectedIds.size} source(s) into folder.`);
      manageFolderOpen = false;
      renderManageFolders();
      renderManageList();
      if (typeof onSourcesChanged === "function") {
        onSourcesChanged(activeNotebook.id, sources.length);
      }
    } catch (error) {
      setManageStatus(error.message || "Could not organize sources.", "error");
    }
  }

  async function unfileSelected() {
    if (!manageSelectedIds.size || !activeNotebook) return;
    setManageStatus("Removing from folders...", "loading");
    try {
      for (const sourceId of [...manageSelectedIds]) {
        await NotebookToolsNotebookLM.setNotebookLmSourceLabels(
          activeNotebook.id,
          sourceId,
          [],
          authOptions
        );
      }
      await reload({ quiet: true });
      setManageStatus("Removed from folders.");
      manageFolderOpen = false;
      renderManageFolders();
      renderManageList();
    } catch (error) {
      setManageStatus(error.message || "Could not update folders.", "error");
    }
  }

  async function manageDeleteSelected() {
    if (!manageSelectedIds.size || !activeNotebook) return;
    if (!window.confirm(`Delete ${manageSelectedIds.size} selected source(s)?`)) return;
    setManageStatus("Deleting sources...", "loading");
    try {
      for (const sourceId of [...manageSelectedIds]) {
        await NotebookToolsNotebookLM.deleteNotebookLmSource(
          activeNotebook.id,
          sourceId,
          authOptions
        );
      }
      manageSelectedIds.clear();
      await reload({ quiet: true });
      setManageStatus("Deleted.");
      renderManageList();
      if (typeof onSourcesChanged === "function") {
        onSourcesChanged(activeNotebook.id, sources.length);
      }
    } catch (error) {
      setManageStatus(error.message || "Could not delete sources.", "error");
    }
  }

  function openManageModal() {
    const modal = document.querySelector("#srcManageModal");
    if (!modal || !activeNotebook) return;
    manageSelectedIds = new Set(selectedIds);
    manageFolderOpen = false;
    setManageStatus("");
    renderManageFolders();
    renderManageList();
    modal.hidden = false;
  }

  function closeManageModal() {
    const modal = document.querySelector("#srcManageModal");
    if (modal) modal.hidden = true;
    manageFolderOpen = false;
    setManageStatus("");
  }

  async function bulkDeleteSelected() {
    if (!selectedIds.size) {
      return;
    }

    if (!window.confirm(`Delete ${selectedIds.size} selected source(s)?`)) {
      return;
    }

    await runAction("Deleting sources...", async () => {
      for (const sourceId of [...selectedIds]) {
        await NotebookToolsNotebookLM.deleteNotebookLmSource(
          activeNotebook.id,
          sourceId,
          authOptions
        );
      }
      selectedIds.clear();
      updateBulkUi();
    });
  }

  async function bulkExportSelected() {
    if (!selectedIds.size) {
      return;
    }

    const selected = sources.filter((source) => selectedIds.has(source.id));

    setStatus(`Exporting ${selected.length} source${selected.length === 1 ? "" : "s"}...`, "loading");

    try {
      const parts = [];

      for (const source of selected) {
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
      setStatus(`Exported ${selected.length} source${selected.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatus(error.message || "Could not export sources.", "error");
    }
  }

  async function exportSource(source) {
    setStatus("Preparing export...", "loading");

    try {
      const payload = await NotebookToolsNotebookLM.getNotebookLmSourceContent(
        activeNotebook.id,
        source.id,
        authOptions
      );
      const safeName = (payload.title || source.title || "source")
        .replace(/[<>:"/\\|?*]+/g, "-")
        .slice(0, 80);
      const body = payload.content || "(No extractable text for this source.)";
      const blob = new Blob([`# ${payload.title || source.title}\n\n${body}`], {
        type: "text/plain;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("");
    } catch (error) {
      setStatus(error.message || "Could not export source.", "error");
    }
  }

  async function openEditModal(source) {
    const modal = document.querySelector("#srcEditModal");
    const titleInput = document.querySelector("#srcEditTitle");
    const textInput = document.querySelector("#srcEditText");

    if (!modal || !titleInput || !textInput) {
      return;
    }

    setStatus("Loading source text...", "loading");

    try {
      const payload = await NotebookToolsNotebookLM.getNotebookLmSourceContent(
        activeNotebook.id,
        source.id,
        authOptions
      );

      modal.dataset.sourceId = source.id;
      titleInput.value = payload.title || source.title;
      textInput.value = payload.content || "";
      modal.hidden = false;
      titleInput.focus();
      setStatus("");
    } catch (error) {
      setStatus(error.message || "Could not load source.", "error");
    }
  }

  function closeEditModal() {
    const modal = document.querySelector("#srcEditModal");

    if (modal) {
      modal.hidden = true;
      delete modal.dataset.sourceId;
    }
  }

  async function saveEditModal() {
    const modal = document.querySelector("#srcEditModal");
    const titleInput = document.querySelector("#srcEditTitle");
    const textInput = document.querySelector("#srcEditText");
    const sourceId = modal?.dataset.sourceId;
    const source = sources.find((item) => item.id === sourceId);

    if (!source || !titleInput || !textInput) {
      return;
    }

    const nextTitle = titleInput.value.trim();
    const nextText = textInput.value.trim();

    if (!nextTitle || !nextText) {
      setStatus("Title and text are required.", "error");
      return;
    }

    closeEditModal();

    await runAction("Saving source...", async () => {
      await NotebookToolsNotebookLM.deleteNotebookLmSource(
        activeNotebook.id,
        source.id,
        authOptions
      );
      await NotebookToolsNotebookLM.addTextToNotebookLm(
        activeNotebook.id,
        nextTitle,
        nextText,
        authOptions
      );
    });
  }

  function toggleSelected(sourceId) {
    if (selectedIds.has(sourceId)) {
      selectedIds.delete(sourceId);
    } else {
      selectedIds.add(sourceId);
    }

    updateBulkUi();
    renderList();
  }

  function renderList() {
    if (!listEl) {
      return;
    }

    const items = filteredSources();

    if (!items.length) {
      listEl.innerHTML = `<p class="src-empty">${sources.length ? "No sources match your search." : "No sources in this notebook yet."}</p>`;
      return;
    }

    listEl.innerHTML = items
      .map((source) => {
        const sourceLabels = labelsForSource(source.id);
        const showFolders = isTagEnabled("sourceFolder");
        const labelHtml =
          showFolders && sourceLabels.length
            ? sourceLabels
                .map((label) => {
                  const name = label.emoji ? `${label.emoji} ${label.name}` : label.name;
                  return `<span class="src-item-folder">${NotebookToolsStore.escapeHtml(name)}</span>`;
                })
                .join("")
            : "";
        const isSelected = selectedIds.has(source.id);
        const showType = isTagEnabled("sourceType");
        const freshness = sourceFreshness[source.id];
        const canRefresh = NotebookToolsNotebookLM.isRefreshableSourceType(source.typeCode);
        const staleBadge =
          freshness === "stale"
            ? `<span class="src-stale-badge">Update available</span>`
            : freshness === "checking"
              ? `<span class="src-stale-badge is-checking">Checking…</span>`
              : "";
        const refreshBtn =
          !selectMode && canRefresh
            ? `<button type="button" class="src-refresh-btn${freshness === "stale" ? " is-stale" : ""}" data-src-refresh-id="${source.id}" aria-label="${
                freshness === "stale" ? "Refresh source (update available)" : "Refresh source"
              }" title="${
                freshness === "stale" ? "Refresh source (update available)" : "Refresh source"
              }">↻</button>`
            : "";

        return `
          <article class="src-item${selectMode ? " is-selectable" : ""}${isSelected ? " is-selected" : ""}${freshness === "stale" ? " is-stale" : ""}" data-source-id="${source.id}">
            ${selectMode ? `<label class="src-select-wrap"><input type="checkbox" class="src-select-input" data-select-id="${source.id}"${isSelected ? " checked" : ""} aria-label="Select source" /><span class="src-select-box" aria-hidden="true"></span></label>` : ""}
            <div class="src-item-body">
              <div class="src-item-head">
                ${showType ? `<span class="src-item-type">${NotebookToolsStore.escapeHtml(source.type)}</span>` : ""}
                ${staleBadge}
              </div>
              <h3 class="src-item-title">${NotebookToolsStore.escapeHtml(source.title)}</h3>
              ${source.url ? `<a class="src-item-url" href="${NotebookToolsStore.escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${NotebookToolsStore.escapeHtml(source.url)}</a>` : ""}
              ${labelHtml ? `<div class="src-item-folders">${labelHtml}</div>` : ""}
            </div>
            ${selectMode ? "" : `${refreshBtn}<button type="button" class="src-menu-btn" data-src-menu-id="${source.id}" aria-label="Source actions" title="Actions">⋯</button>`}
          </article>
        `;
      })
      .join("");

    listEl.querySelectorAll("[data-src-refresh-id]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const source = sources.find((item) => item.id === btn.dataset.srcRefreshId);

        if (source) {
          void refreshSource(source);
        }
      });
    });

    listEl.querySelectorAll("[data-src-menu-id]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const source = sources.find((item) => item.id === btn.dataset.srcMenuId);

        if (source) {
          openSourceMenu(btn, source);
        }
      });
    });

    listEl.querySelectorAll("[data-select-id]").forEach((input) => {
      input.addEventListener("change", () => {
        toggleSelected(input.dataset.selectId);
      });
    });

    listEl.querySelectorAll(".src-item.is-selectable").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (!selectMode || event.target.closest("a") || event.target.closest(".src-select-wrap")) {
          return;
        }

        event.preventDefault();
        toggleSelected(row.dataset.sourceId);
      });
    });
  }

  async function reload({ quiet = false } = {}) {
    if (!activeNotebook) {
      return;
    }

    if (!quiet) {
      setStatus("Loading sources...", "loading");
    }

    const [nextSources, nextLabels] = await Promise.all([
      NotebookToolsNotebookLM.listNotebookLmSources(activeNotebook.id, authOptions),
      NotebookToolsNotebookLM.listNotebookLmLabels(activeNotebook.id, authOptions).catch(() => [])
    ]);

    sources = nextSources;
    labels = nextLabels;

    for (const sourceId of [...selectedIds]) {
      if (!sources.some((item) => item.id === sourceId)) {
        selectedIds.delete(sourceId);
      }
    }

    renderFilters();
    renderList();
    updateBulkUi();

    if (!quiet) {
      setStatus("");
    }

    if (refreshableSources().length) {
      void checkAllFreshness({ quiet: true });
    }
  }

  function bind() {
    searchEl?.addEventListener("input", () => {
      searchQuery = searchEl.value || "";
      renderList();
    });

    viewModeEl?.addEventListener("change", () => {
      selectMode = viewModeEl.value === "select";

      if (!selectMode) {
        selectedIds.clear();
      }

      updateBulkUi();
      renderList();
    });

    bulkDeleteEl?.addEventListener("click", bulkDeleteSelected);
    bulkExportEl?.addEventListener("click", () => {
      void bulkExportSelected();
    });

    checkFreshnessEl?.addEventListener("click", () => {
      void checkAllFreshness();
    });

    refreshStaleEl?.addEventListener("click", () => {
      void refreshAllStale();
    });


    document.querySelector("#sourcesManageButton")?.addEventListener("click", openManageModal);
    document.querySelector("#srcManageClose")?.addEventListener("click", closeManageModal);
    document.querySelector("#srcManageBackdrop")?.addEventListener("click", closeManageModal);
    document.querySelector("#srcManageSelectAll")?.addEventListener("click", () => {
      if (manageSelectedIds.size && manageSelectedIds.size === sources.length) {
        manageSelectedIds.clear();
      } else {
        manageSelectedIds = new Set(sources.map((s) => s.id));
      }
      renderManageList();
    });
    document.querySelector("#srcManageOrganize")?.addEventListener("click", () => {
      manageFolderOpen = !manageFolderOpen;
      renderManageFolders();
    });
    document.querySelector("#srcManageDelete")?.addEventListener("click", () => {
      void manageDeleteSelected();
    });
    document.querySelector("#srcManageUnfile")?.addEventListener("click", () => {
      void unfileSelected();
    });
    document.querySelector("#srcManageCreateFolder")?.addEventListener("click", async () => {
      const input = document.querySelector("#srcManageNewFolder");
      const name = input?.value?.trim();
      if (!name || !activeNotebook) return;
      setManageStatus("Creating folder...", "loading");
      try {
        await NotebookToolsNotebookLM.createNotebookLmLabel(activeNotebook.id, name, authOptions);
        labels = await NotebookToolsNotebookLM.listNotebookLmLabels(activeNotebook.id, authOptions).catch(() => labels);
        if (input) input.value = "";
        renderFilters();
        renderManageFolders();
        setManageStatus("Folder created.");
      } catch (error) {
        setManageStatus(error.message || "Could not create folder.", "error");
      }
    });

    document.querySelector("#sourcesAddBulk")?.addEventListener("click", () => {
      if (!activeNotebook) {
        return;
      }

      NotebookToolsSourcesBulk.open(activeNotebook, {
        authOptions,
        onComplete: async () => {
          await reload({ quiet: true });

          if (typeof onSourcesChanged === "function") {
            onSourcesChanged(activeNotebook.id, sources.length);
          }
        }
      });
    });

    scanDuplicatesEl?.addEventListener("click", () => {
      if (!activeNotebook || sources.length < 2) {
        return;
      }

      NotebookToolsDuplicateScan.open({
        notebook: activeNotebook,
        sources,
        authOptions,
        onComplete: async () => {
          await reload({ quiet: true });

          if (typeof onSourcesChanged === "function") {
            onSourcesChanged(activeNotebook.id, sources.length);
          }
        }
      });
    });

    document.querySelector("#srcEditCancel")?.addEventListener("click", closeEditModal);
    document.querySelector("#srcEditSave")?.addEventListener("click", saveEditModal);
    document.querySelector("#srcEditBackdrop")?.addEventListener("click", closeEditModal);

    document.addEventListener("click", (event) => {
      if (
        !event.target.closest(".src-menu-btn") &&
        !event.target.closest(".src-dropdown-menu") &&
        !event.target.closest(".src-label-menu")
      ) {
        closeMenus();
      }
    });
  }

  async function open(notebook, options = {}) {
    activeNotebook = notebook;
    authOptions = options.authOptions || {};
    onSourcesChanged = options.onSourcesChanged || null;
    activeFilter = "all";
    searchQuery = "";
    selectMode = true;
    selectedIds.clear();

    if (viewModeEl) {
      viewModeEl.value = "select";
    }

    if (searchEl) {
      searchEl.value = "";
    }

    sources = [];
    labels = [];
    sourceFreshness = {};
    isCheckingFreshness = false;
    isRefreshingAll = false;
    updateBulkUi();
    renderFilters();
    listEl.innerHTML = `<p class="src-empty">Loading sources...</p>`;

    await reload();
  }

  function close() {
    closeMenus();
    closeEditModal();
    closeManageModal();
    activeNotebook = null;
    sources = [];
    labels = [];
    sourceFreshness = {};
    isCheckingFreshness = false;
    isRefreshingAll = false;
    searchQuery = "";
    selectMode = true;
    selectedIds.clear();

    if (viewModeEl) {
      viewModeEl.value = "select";
    }

    if (searchEl) {
      searchEl.value = "";
    }

    updateBulkUi();
    setStatus("");
  }

  function init() {
    listEl = document.querySelector("#sourcesList");
    statusEl = document.querySelector("#sourcesPanelStatus");
    filterEl = document.querySelector("#sourcesFilters");
    searchEl = document.querySelector("#sourcesSearchInput");
    bulkDeleteEl = document.querySelector("#sourcesBulkDelete");
    bulkExportEl = document.querySelector("#sourcesBulkExport");
    scanDuplicatesEl = document.querySelector("#sourcesScanDuplicates");
    checkFreshnessEl = document.querySelector("#sourcesCheckFreshness");
    refreshStaleEl = document.querySelector("#sourcesRefreshStale");
    viewModeEl = document.querySelector("#sourcesViewMode");
    bind();
  }

  return { init, open, close, setAppSettings };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsSourcesPanel = NotebookToolsSourcesPanel;
}
