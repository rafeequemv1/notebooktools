const NotebookToolsDuplicateScan = (() => {
  const STEPS = {
    OPTIONS: "options",
    SCANNING: "scanning",
    REVIEW: "review",
    CONFIRM: "confirm",
    SUCCESS: "success"
  };

  const BATCH_SIZE = 3;

  let modalEl = null;
  let backdropEl = null;
  let titleEl = null;
  let bodyEl = null;
  let statusEl = null;
  let primaryBtn = null;
  let secondaryBtn = null;
  let closeBtn = null;

  let notebook = null;
  let sources = [];
  let authOptions = {};
  let onComplete = null;

  let step = STEPS.OPTIONS;
  let scanMode = "fast";
  let keepPreference = "oldest";
  let groups = [];
  let selectedGroups = {};
  let busy = false;

  function setBusy(nextBusy) {
    busy = nextBusy;
    primaryBtn.disabled = busy;
    secondaryBtn.disabled = busy;
    closeBtn.disabled = busy;
  }

  function resetState() {
    step = STEPS.OPTIONS;
    scanMode = "fast";
    keepPreference = "oldest";
    groups = [];
    selectedGroups = {};
    busy = false;
  }

  function shortUrl(url) {
    if (!url) {
      return "";
    }

    try {
      const parsed = new URL(url);
      const path = `${parsed.hostname}${parsed.pathname}`;
      return path.length > 48 ? `${path.slice(0, 45)}...` : path;
    } catch (_error) {
      return url.length > 48 ? `${url.slice(0, 45)}...` : url;
    }
  }

  function formatDate(value) {
    if (!value) {
      return "Unknown date";
    }

    try {
      return new Date(value).toLocaleDateString();
    } catch (_error) {
      return "Unknown date";
    }
  }

  function updateSelectionsForKeepPreference() {
    selectedGroups = NotebookToolsDuplicateSources.defaultSelections(groups, keepPreference);
  }

  function renderGroup(group) {
    const selection = selectedGroups[group.id] || {};
    const skipped = selection.action === "skip";
    const similarity = Math.round((group.similarity || 0) * 100);
    const matchLabel = NotebookToolsDuplicateSources.matchLabel(group.matchType);

    const sourceRows = group.sources
      .map((source, index) => {
        const isKeep = !skipped && selection.keepSourceId === source.id;
        const isOldest = index === 0;
        const isNewest = index === group.sources.length - 1;

        return `
          <label class="dup-source-row${isKeep ? " is-keep" : ""}${skipped ? " is-muted" : ""}">
            <input
              type="radio"
              name="dup-group-${NotebookToolsStore.escapeHtml(group.id)}"
              value="${NotebookToolsStore.escapeHtml(source.id)}"
              ${isKeep ? "checked" : ""}
              ${skipped ? "disabled" : ""}
              data-group-id="${NotebookToolsStore.escapeHtml(group.id)}"
              data-source-id="${NotebookToolsStore.escapeHtml(source.id)}"
            />
            <span class="dup-source-copy">
              <span class="dup-source-action">${isKeep ? "Keep" : "Remove"}</span>
              <span class="dup-source-title">${NotebookToolsStore.escapeHtml(source.title)}</span>
              <span class="dup-source-meta">
                <span>${NotebookToolsStore.escapeHtml(formatDate(source.createdAt))}</span>
                ${isOldest ? `<span class="dup-tag${keepPreference === "oldest" ? " is-active" : ""}">oldest</span>` : ""}
                ${isNewest && group.sources.length > 1 ? `<span class="dup-tag${keepPreference === "newest" ? " is-active" : ""}">newest</span>` : ""}
                ${source.url ? `<span class="dup-source-url">${NotebookToolsStore.escapeHtml(shortUrl(source.url))}</span>` : ""}
              </span>
            </span>
          </label>
        `;
      })
      .join("");

    return `
      <article class="dup-group${skipped ? " is-skipped" : ""}" data-group-id="${NotebookToolsStore.escapeHtml(group.id)}">
        <div class="dup-group-head">
          <div class="dup-group-summary">
            <strong>${NotebookToolsStore.escapeHtml(group.sources[0]?.title || "Untitled")}</strong>
            <span>${similarity}% · ${group.sources.length} sources · ${NotebookToolsStore.escapeHtml(matchLabel)}</span>
          </div>
          <button type="button" class="dup-skip-btn" data-skip-group="${NotebookToolsStore.escapeHtml(group.id)}">
            ${skipped ? "Skipped" : "Skip"}
          </button>
        </div>
        <div class="dup-group-sources">${sourceRows}</div>
      </article>
    `;
  }

  function renderBody() {
    const duplicateCount = groups.reduce((sum, group) => sum + group.sources.length - 1, 0);
    const summary = NotebookToolsDuplicateSources.getDeletionSummary(groups, selectedGroups);

    if (step === STEPS.OPTIONS) {
      bodyEl.innerHTML = `
        <p class="dup-lead">Choose how to detect duplicates in <strong>${NotebookToolsStore.escapeHtml(notebook.title)}</strong>.</p>
        <div class="dup-mode-list">
          <label class="dup-mode-option${scanMode === "fast" ? " is-selected" : ""}">
            <input type="radio" name="dupScanMode" value="fast" ${scanMode === "fast" ? "checked" : ""} />
            <span>
              <strong>Fast scan</strong>
              <span>Match by URL and similar titles. Instant, no extra API calls.</span>
            </span>
          </label>
          <label class="dup-mode-option${scanMode === "deep" ? " is-selected" : ""}">
            <input type="radio" name="dupScanMode" value="deep" ${scanMode === "deep" ? "checked" : ""} />
            <span>
              <strong>Deep scan</strong>
              <span>Also compare fetched source content. Slower but catches near-identical text.</span>
            </span>
          </label>
        </div>
      `;

      bodyEl.querySelectorAll('input[name="dupScanMode"]').forEach((input) => {
        input.addEventListener("change", () => {
          scanMode = input.value === "deep" ? "deep" : "fast";
          renderBody();
        });
      });

      titleEl.textContent = "Find duplicates";
      primaryBtn.textContent = scanMode === "deep" ? "Run deep scan" : "Run fast scan";
      secondaryBtn.hidden = true;
      statusEl.hidden = true;
      return;
    }

    if (step === STEPS.SCANNING) {
      bodyEl.innerHTML = `
        <div class="dup-scanning">
          <p class="dup-lead">Scanning ${sources.length} sources...</p>
          <div class="dup-progress"><span></span></div>
        </div>
      `;
      titleEl.textContent = "Find duplicates";
      primaryBtn.hidden = true;
      secondaryBtn.hidden = true;
      statusEl.hidden = false;
      statusEl.textContent = statusEl.dataset.message || "Analyzing sources...";
      return;
    }

    if (step === STEPS.REVIEW) {
      bodyEl.innerHTML = `
        <div class="dup-review-toolbar">
          <p class="dup-lead">Found <strong>${groups.length}</strong> duplicate group${groups.length === 1 ? "" : "s"} (${duplicateCount} removable).</p>
          <label class="dup-keep-field">
            <span>Keep</span>
            <select id="dupKeepPreference">
              <option value="oldest" ${keepPreference === "oldest" ? "selected" : ""}>Oldest source</option>
              <option value="newest" ${keepPreference === "newest" ? "selected" : ""}>Newest source</option>
            </select>
          </label>
        </div>
        <div class="dup-group-list">${groups.map(renderGroup).join("")}</div>
      `;

      bodyEl.querySelector("#dupKeepPreference")?.addEventListener("change", (event) => {
        keepPreference = event.target.value === "newest" ? "newest" : "oldest";
        updateSelectionsForKeepPreference();
        renderBody();
        bindReviewActions();
      });

      bindReviewActions();
      titleEl.textContent = `Found ${groups.length} duplicate groups`;
      primaryBtn.hidden = false;
      primaryBtn.textContent = `Clean up ${summary.toDelete} duplicates`;
      secondaryBtn.hidden = false;
      secondaryBtn.textContent = "Rescan";
      statusEl.hidden = true;
      return;
    }

    if (step === STEPS.CONFIRM) {
      bodyEl.innerHTML = `
        <p class="dup-lead">Delete <strong>${summary.toDelete}</strong> duplicate source${summary.toDelete === 1 ? "" : "s"} and keep <strong>${summary.toKeep}</strong> source${summary.toKeep === 1 ? "" : "s"}?</p>
        <p class="dup-note">This cannot be undone.</p>
      `;
      titleEl.textContent = "Confirm cleanup";
      primaryBtn.hidden = false;
      primaryBtn.textContent = `Delete ${summary.toDelete} duplicates`;
      secondaryBtn.hidden = false;
      secondaryBtn.textContent = "Back";
      statusEl.hidden = true;
      return;
    }

    bodyEl.innerHTML = `
      <div class="dup-success">
        <p class="dup-lead">Cleanup complete.</p>
        <p class="dup-note">${statusEl.dataset.result || "Duplicate sources were removed from this notebook."}</p>
      </div>
    `;
    titleEl.textContent = "Cleanup complete";
    primaryBtn.hidden = false;
    primaryBtn.textContent = "Done";
    secondaryBtn.hidden = true;
    statusEl.hidden = true;
  }

  function bindReviewActions() {
    bodyEl.querySelectorAll("[data-skip-group]").forEach((button) => {
      button.addEventListener("click", () => {
        const groupId = button.dataset.skipGroup;
        const current = selectedGroups[groupId];

        if (current?.action === "skip") {
          const group = groups.find((item) => item.id === groupId);

          if (group) {
            selectedGroups[groupId] = {
              action: "delete",
              keepSourceId: group.representativeId
            };
          }
        } else {
          selectedGroups[groupId] = {
            action: "skip",
            keepSourceId: null
          };
        }

        renderBody();
        bindReviewActions();
      });
    });

    bodyEl.querySelectorAll("[data-group-id][data-source-id]").forEach((input) => {
      input.addEventListener("change", () => {
        selectedGroups[input.dataset.groupId] = {
          action: "delete",
          keepSourceId: input.dataset.sourceId
        };
        renderBody();
        bindReviewActions();
      });
    });
  }

  async function fetchContentMap() {
    const contentMap = {};
    const total = sources.length;

    for (let index = 0; index < sources.length; index += BATCH_SIZE) {
      const batch = sources.slice(index, index + BATCH_SIZE);
      statusEl.dataset.message = `Fetching content ${Math.min(index + BATCH_SIZE, total)}/${total}...`;
      renderBody();

      const results = await Promise.allSettled(
        batch.map((source) =>
          NotebookToolsNotebookLM.getNotebookLmSourceContent(
            notebook.id,
            source.id,
            authOptions
          ).then((payload) => ({
            id: source.id,
            content: payload.content || ""
          }))
        )
      );

      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value.content) {
          contentMap[result.value.id] = result.value.content;
        }
      });
    }

    return contentMap;
  }

  async function runScan() {
    step = STEPS.SCANNING;
    setBusy(true);
    statusEl.hidden = false;
    statusEl.dataset.message = "Analyzing sources...";
    renderBody();

    try {
      let contentMap = null;

      if (scanMode === "deep") {
        statusEl.dataset.message = "Fetching source content...";
        contentMap = await fetchContentMap();
      }

      statusEl.dataset.message = "Comparing sources...";
      groups = NotebookToolsDuplicateSources.findDuplicateGroups(sources, {
        contentMap: scanMode === "deep" ? contentMap : null
      });

      if (!groups.length) {
        step = STEPS.SUCCESS;
        statusEl.dataset.result = "No duplicate sources found.";
        renderBody();
        return;
      }

      selectedGroups = NotebookToolsDuplicateSources.defaultSelections(groups, keepPreference);
      step = STEPS.REVIEW;
    } catch (error) {
      step = STEPS.OPTIONS;
      renderBody();
      statusEl.hidden = false;
      statusEl.textContent = error.message || "Scan failed.";
    } finally {
      setBusy(false);
    }
  }

  async function executeDeletion() {
    const summary = NotebookToolsDuplicateSources.getDeletionSummary(groups, selectedGroups);
    const deleteIds = [];

    for (const group of groups) {
      const selection = selectedGroups[group.id];

      if (selection?.action !== "delete" || !selection.keepSourceId) {
        continue;
      }

      for (const source of group.sources) {
        if (source.id !== selection.keepSourceId) {
          deleteIds.push(source.id);
        }
      }
    }

    if (!deleteIds.length) {
      step = STEPS.SUCCESS;
      statusEl.dataset.result = "Nothing selected for deletion.";
      renderBody();
      return;
    }

    step = STEPS.SCANNING;
    setBusy(true);
    statusEl.hidden = false;
    statusEl.dataset.message = `Deleting 0/${deleteIds.length}...`;
    renderBody();

    let deleted = 0;
    let failed = 0;

    try {
      for (let index = 0; index < deleteIds.length; index += BATCH_SIZE) {
        const batch = deleteIds.slice(index, index + BATCH_SIZE);
        statusEl.dataset.message = `Deleting ${Math.min(index + BATCH_SIZE, deleteIds.length)}/${deleteIds.length}...`;
        renderBody();

        const results = await Promise.allSettled(
          batch.map((sourceId) =>
            NotebookToolsNotebookLM.deleteNotebookLmSource(notebook.id, sourceId, authOptions)
          )
        );

        results.forEach((result) => {
          if (result.status === "fulfilled") {
            deleted += 1;
          } else {
            failed += 1;
          }
        });
      }

      step = STEPS.SUCCESS;
      statusEl.dataset.result =
        failed > 0
          ? `Deleted ${deleted} of ${deleteIds.length} duplicate sources.`
          : `Removed ${deleted} duplicate source${deleted === 1 ? "" : "s"}.`;

      if (typeof onComplete === "function") {
        await onComplete({ deleted, failed });
      }
    } catch (error) {
      step = STEPS.CONFIRM;
      statusEl.hidden = false;
      statusEl.textContent = error.message || "Deletion failed.";
      renderBody();
    } finally {
      setBusy(false);
    }
  }

  async function handlePrimary() {
    if (busy) {
      return;
    }

    if (step === STEPS.OPTIONS) {
      await runScan();
      return;
    }

    if (step === STEPS.REVIEW) {
      const summary = NotebookToolsDuplicateSources.getDeletionSummary(groups, selectedGroups);

      if (!summary.toDelete) {
        step = STEPS.SUCCESS;
        statusEl.dataset.result = "No duplicates selected for deletion.";
        renderBody();
        return;
      }

      step = STEPS.CONFIRM;
      renderBody();
      return;
    }

    if (step === STEPS.CONFIRM) {
      await executeDeletion();
      renderBody();
      return;
    }

    if (step === STEPS.SUCCESS) {
      close();
    }
  }

  function handleSecondary() {
    if (busy) {
      return;
    }

    if (step === STEPS.REVIEW) {
      step = STEPS.OPTIONS;
      renderBody();
      return;
    }

    if (step === STEPS.CONFIRM) {
      step = STEPS.REVIEW;
      renderBody();
    }
  }

  function open(options = {}) {
    notebook = options.notebook || null;
    sources = Array.isArray(options.sources) ? options.sources : [];
    authOptions = options.authOptions || {};
    onComplete = options.onComplete || null;

    if (!notebook || sources.length < 2) {
      return;
    }

    resetState();
    modalEl.hidden = false;
    primaryBtn.hidden = false;
    secondaryBtn.hidden = true;
    renderBody();
  }

  function close() {
    if (busy) {
      return;
    }

    modalEl.hidden = true;
    resetState();
  }

  function init() {
    modalEl = document.querySelector("#dupScanModal");
    backdropEl = document.querySelector("#dupScanBackdrop");
    titleEl = document.querySelector("#dupScanTitle");
    bodyEl = document.querySelector("#dupScanBody");
    statusEl = document.querySelector("#dupScanStatus");
    primaryBtn = document.querySelector("#dupScanPrimary");
    secondaryBtn = document.querySelector("#dupScanSecondary");
    closeBtn = document.querySelector("#dupScanClose");

    primaryBtn?.addEventListener("click", () => {
      void handlePrimary();
    });
    secondaryBtn?.addEventListener("click", handleSecondary);
    closeBtn?.addEventListener("click", close);
    backdropEl?.addEventListener("click", close);
  }

  return { init, open, close };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsDuplicateScan = NotebookToolsDuplicateScan;
}
