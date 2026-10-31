const NotebookToolsSourceLimits = (() => {
  const limit = () => NotebookToolsNotebookLM.NOTEBOOK_SOURCE_LIMIT;

  function slotsLeft(sourceCount) {
    return Math.max(0, limit() - sourceCount);
  }

  function formatStatus(sourceCount) {
    const left = slotsLeft(sourceCount);

    if (sourceCount >= limit()) {
      return `This notebook is full (${sourceCount}/${limit()}). Create a new notebook or remove sources in NotebookLM.`;
    }

    if (left <= 5) {
      return `${sourceCount}/${limit()} sources · ${left} slot${left === 1 ? "" : "s"} left. Consider a new notebook soon.`;
    }

    return `${sourceCount}/${limit()} sources · ${left} slots left`;
  }

  function formatAfterImport(sourceCount, adding) {
    const next = sourceCount + adding;
    const left = slotsLeft(next);

    if (next > limit()) {
      const overflow = next - limit();
      return `Would exceed the limit (${next}/${limit()}). Remove ${overflow} item${overflow === 1 ? "" : "s"} or split across notebooks.`;
    }

    if (left === 0) {
      return `After import: ${next}/${limit()} sources. Notebook will be full.`;
    }

    return `After import: ${next}/${limit()} sources · ${left} slots left`;
  }

  function validateImport(sourceCount, adding) {
    const next = sourceCount + adding;

    if (sourceCount >= limit()) {
      return {
        ok: false,
        level: "error",
        message: `Notebook is full (${sourceCount}/${limit()}). Pick another notebook or create a new one.`
      };
    }

    if (next > limit()) {
      const overflow = next - limit();
      return {
        ok: false,
        level: "error",
        message: `Only ${slotsLeft(sourceCount)} slot${slotsLeft(sourceCount) === 1 ? "" : "s"} left. Remove ${overflow} item${overflow === 1 ? "" : "s"} or split into another notebook.`
      };
    }

    if (slotsLeft(next) <= 5) {
      return {
        ok: true,
        level: "warning",
        message: formatAfterImport(sourceCount, adding)
      };
    }

    return {
      ok: true,
      level: "info",
      message: formatAfterImport(sourceCount, adding)
    };
  }

  function renderNote(element, sourceCount, adding = 0) {
    if (!element) {
      return null;
    }

    if (typeof sourceCount !== "number") {
      element.hidden = true;
      element.textContent = "";
      element.classList.remove("is-warning", "is-error");
      return null;
    }

    const check = validateImport(sourceCount, adding);
    element.textContent = adding > 0 ? check.message : formatStatus(sourceCount);
    element.classList.toggle("is-warning", check.level === "warning");
    element.classList.toggle("is-error", check.level === "error" || !check.ok);
    element.hidden = check.level === "info" && slotsLeft(sourceCount + adding) > 10;
    return check;
  }

  async function resolveSourceCount({ notebookId, isNewNotebook = false, cachedSourceCount = null }) {
    if (isNewNotebook) {
      return 0;
    }

    if (!notebookId) {
      return null;
    }

    if (typeof cachedSourceCount === "number") {
      return cachedSourceCount;
    }

    return NotebookToolsNotebookLM.getNotebookLmSourceCount(notebookId);
  }

  async function updateLimitNote(element, { notebookId, isNewNotebook = false, adding = 0, cachedSourceCount = null }) {
    if (!element) {
      return { sourceCount: null, check: null };
    }

    if (!notebookId && !isNewNotebook) {
      element.hidden = true;
      element.textContent = "";
      element.classList.remove("is-warning", "is-error");
      return { sourceCount: null, check: null };
    }

    element.hidden = false;
    element.textContent = "Checking source count...";
    element.classList.remove("is-warning", "is-error");

    try {
      const sourceCount = await resolveSourceCount({ notebookId, isNewNotebook, cachedSourceCount });
      const check = typeof sourceCount === "number" ? validateImport(sourceCount, adding) : null;
      renderNote(element, sourceCount, adding);
      return { sourceCount, check };
    } catch {
      element.hidden = false;
      element.textContent = `Could not read source count. Limit is about ${limit()} per notebook.`;
      element.classList.remove("is-warning", "is-error");
      return { sourceCount: null, check: null };
    }
  }

  async function assertCanImport({ notebookId, isNewNotebook = false, adding = 1, cachedSourceCount = null }) {
    const sourceCount = await resolveSourceCount({ notebookId, isNewNotebook, cachedSourceCount });
    const check = validateImport(typeof sourceCount === "number" ? sourceCount : 0, adding);

    if (!check.ok) {
      throw new Error(check.message);
    }

    return { sourceCount, check };
  }

  return {
    assertCanImport,
    formatAfterImport,
    formatStatus,
    renderNote,
    slotsLeft,
    updateLimitNote,
    validateImport
  };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsSourceLimits = NotebookToolsSourceLimits;
}
