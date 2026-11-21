/* ==========================================================================
   Manage sources: a simple dialog over the NotebookLM page (same look as the
   carousel dialog). Search, filter by type, select, find duplicates,
   refresh Drive sources and delete in bulk. Scoped with .nts-.
   ========================================================================== */
(function () {
  "use strict";

  let root = null;
  let state = null;

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function isDarkPage() {
    const bg = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
    if (!bg) return false;
    const [r, g, b] = bg.map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
  }

  function client() {
    return window.NotebookToolsNotebookLM;
  }

  function host(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (_error) {
      return "";
    }
  }

  /* ---------- Data ---------- */
  function visible() {
    const q = state.query.trim().toLowerCase();
    return state.sources.filter((s) => {
      if (state.type !== "all" && (s.type || "Other") !== state.type) return false;
      if (q && !`${s.title} ${s.type} ${s.url || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function typeCounts() {
    const counts = new Map();
    state.sources.forEach((s) => counts.set(s.type || "Other", (counts.get(s.type || "Other") || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  async function load(note = "") {
    const session = state;
    Object.assign(state, { loading: true, error: "", note });
    render();
    try {
      const sources = await client().listNotebookLmSources(state.notebookId);
      if (state !== session) return;
      state.sources = sources;
      state.selected = new Set([...state.selected].filter((id) => sources.some((s) => s.id === id)));
      if (state.type !== "all" && !sources.some((s) => (s.type || "Other") === state.type)) state.type = "all";
    } catch (error) {
      if (state !== session) return;
      state.error = error.message || "Could not load this notebook's sources.";
    }
    state.loading = false;
    render();
  }

  /* ---------- Render ---------- */
  function render() {
    if (!root || !state) return;
    const body = root.querySelector(".nts-body");
    const list = visible();
    const counts = typeCounts();
    const allShownSelected = list.length > 0 && list.every((s) => state.selected.has(s.id));

    root.querySelector("[data-count]").textContent = state.loading && !state.sources.length
      ? "Loading sources…"
      : `${state.sources.length} source${state.sources.length === 1 ? "" : "s"} in this notebook`;

    body.innerHTML = `
      <div class="nts-controls">
        <input type="search" class="nts-input nts-search" data-search placeholder="Search sources" value="${esc(state.query)}" aria-label="Search sources">
        <select class="nts-select" data-type aria-label="Filter by type">
          <option value="all">All types (${state.sources.length})</option>
          ${counts.map(([type, n]) => `<option value="${esc(type)}"${state.type === type ? " selected" : ""}>${esc(type)} (${n})</option>`).join("")}
        </select>
      </div>
      ${state.error ? `<div class="nts-empty is-error">${esc(state.error)}</div>` : ""}
      ${!state.error && state.loading && !state.sources.length ? `<div class="nts-empty">Loading sources…</div>` : ""}
      ${!state.error && !state.loading && !list.length ? `<div class="nts-empty">${state.sources.length ? "No sources match." : "This notebook has no sources yet."}</div>` : ""}
      ${list.length ? `
        <label class="nts-row nts-row-head">
          <input type="checkbox" data-select-all${allShownSelected ? " checked" : ""}>
          <span>${state.selected.size ? `${state.selected.size} selected` : "Select all"}</span>
        </label>
        <div class="nts-list">
          ${list.map((s) => `
            <label class="nts-row${state.selected.has(s.id) ? " is-selected" : ""}${state.dupes.has(s.id) ? " is-dupe" : ""}">
              <input type="checkbox" data-id="${esc(s.id)}"${state.selected.has(s.id) ? " checked" : ""}>
              <span class="nts-type">${esc(s.type || "Other")}</span>
              <span class="nts-title" title="${esc(s.title)}">${esc(s.title || "Untitled")}</span>
              ${state.dupes.has(s.id) ? `<span class="nts-tag">Duplicate</span>` : ""}
              <span class="nts-host">${esc(host(s.url))}</span>
            </label>`).join("")}
        </div>` : ""}`;

    const selected = state.sources.filter((s) => state.selected.has(s.id));
    const refreshable = selected.filter((s) => client().isRefreshableSourceType?.(s.typeCode));
    const busy = state.loading || state.working;
    root.querySelector("[data-status]").textContent = state.working || state.note || "";
    const dupBtn = root.querySelector("[data-dupes]");
    dupBtn.disabled = busy || state.sources.length < 2;
    const refreshBtn = root.querySelector("[data-refresh]");
    refreshBtn.disabled = busy || !refreshable.length;
    refreshBtn.textContent = refreshable.length ? `Refresh (${refreshable.length})` : "Refresh";
    const delBtn = root.querySelector("[data-delete]");
    delBtn.disabled = busy || !selected.length;
    delBtn.textContent = state.confirmDelete ? `Confirm delete (${selected.length})` : selected.length ? `Delete (${selected.length})` : "Delete";
    delBtn.classList.toggle("is-confirm", Boolean(state.confirmDelete));
    root.querySelector("[data-reload]").hidden = !state.changed;
  }

  /* ---------- Actions ---------- */
  function selectDuplicates() {
    const finder = window.NotebookToolsDuplicateSources;
    if (!finder) return;
    const groups = finder.findDuplicateGroups(state.sources);
    const extra = new Set();
    groups.forEach((group) => group.sources.slice(1).forEach((s) => extra.add(s.id)));
    state.dupes = extra;
    state.selected = new Set(extra);
    state.type = "all";
    state.query = "";
    state.confirmDelete = false;
    state.note = extra.size
      ? `${extra.size} duplicate${extra.size === 1 ? "" : "s"} selected (the oldest copy of each is kept).`
      : "No duplicates found.";
    render();
  }

  async function runOnSelected(label, action, filter = () => true) {
    const items = state.sources.filter((s) => state.selected.has(s.id) && filter(s));
    if (!items.length) return;
    const session = state;
    let done = 0;
    let failed = 0;
    for (const item of items) {
      if (state !== session) return;
      state.working = `${label} ${done + failed + 1} of ${items.length}…`;
      render();
      try {
        await action(item);
        done += 1;
      } catch (_error) {
        failed += 1;
      }
    }
    if (state !== session) return;
    state.working = "";
    state.confirmDelete = false;
    state.changed = state.changed || done > 0;
    return { done, failed };
  }

  async function deleteSelected() {
    if (!state.confirmDelete) {
      state.confirmDelete = true;
      state.note = "This removes the sources from the notebook. Click again to confirm.";
      return render();
    }
    const result = await runOnSelected("Deleting", (s) => client().deleteNotebookLmSource(state.notebookId, s.id));
    if (!result) return;
    state.selected = new Set();
    state.dupes = new Set();
    await load(`Deleted ${result.done}${result.failed ? `, ${result.failed} failed` : ""}. Reload the page to see it in NotebookLM.`);
  }

  async function refreshSelected() {
    const result = await runOnSelected(
      "Refreshing",
      (s) => client().refreshNotebookLmSource(state.notebookId, s.id),
      (s) => client().isRefreshableSourceType?.(s.typeCode)
    );
    if (!result) return;
    await load(`Refreshed ${result.done}${result.failed ? `, ${result.failed} failed` : ""}.`);
  }

  /* ---------- Open / close ---------- */
  function onKey(event) {
    if (event.key === "Escape" && root) {
      event.stopPropagation();
      close();
    }
  }

  function open(notebookId) {
    if (!notebookId || !client()) return;
    close();
    state = { notebookId, sources: [], selected: new Set(), dupes: new Set(), type: "all", query: "", loading: true, error: "", note: "", working: "", confirmDelete: false, changed: false };

    root = document.createElement("div");
    root.className = `nts-backdrop${isDarkPage() ? " is-dark" : ""}`;
    root.innerHTML = `
      <div class="nts-dialog" role="dialog" aria-modal="true" aria-labelledby="nts-title">
        <header class="nts-head">
          <div>
            <h2 id="nts-title">Manage sources</h2>
            <p data-count>Loading sources…</p>
          </div>
          <button type="button" class="nts-close" data-close aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </header>
        <div class="nts-body"></div>
        <footer class="nts-foot">
          <span class="nts-status" data-status></span>
          <button type="button" class="nts-btn" data-reload hidden>Reload page</button>
          <button type="button" class="nts-btn" data-dupes>Select duplicates</button>
          <button type="button" class="nts-btn" data-refresh disabled>Refresh</button>
          <button type="button" class="nts-btn is-danger" data-delete disabled>Delete</button>
        </footer>
      </div>`;
    document.body.append(root);

    root.addEventListener("click", (event) => {
      if (event.target === root || event.target.closest("[data-close]")) return close();
      if (event.target.closest("[data-dupes]")) return selectDuplicates();
      if (event.target.closest("[data-refresh]")) return void refreshSelected();
      if (event.target.closest("[data-delete]")) return void deleteSelected();
      if (event.target.closest("[data-reload]")) return location.reload();
    });
    root.addEventListener("change", (event) => {
      const t = event.target;
      if (t.matches("[data-type]")) {
        state.type = t.value;
      } else if (t.matches("[data-select-all]")) {
        visible().forEach((s) => (t.checked ? state.selected.add(s.id) : state.selected.delete(s.id)));
      } else if (t.matches("input[data-id]")) {
        t.checked ? state.selected.add(t.dataset.id) : state.selected.delete(t.dataset.id);
      } else {
        return;
      }
      state.confirmDelete = false;
      state.note = "";
      render();
    });
    root.addEventListener("input", (event) => {
      if (!event.target.matches("[data-search]")) return;
      state.query = event.target.value;
      const pos = event.target.selectionStart;
      render();
      const input = root.querySelector("[data-search]");
      input.focus();
      input.setSelectionRange(pos, pos);
    });
    document.addEventListener("keydown", onKey, true);
    load();
  }

  function close() {
    root?.remove();
    root = null;
    state = null;
    document.removeEventListener("keydown", onKey, true);
  }

  window.NotebookToolsSourcesModal = { open, close };
})();
