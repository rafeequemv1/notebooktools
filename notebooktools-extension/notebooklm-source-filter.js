/* ==========================================================================
   Type filter for NotebookLM's own Sources list (free). A dropdown in the
   ribbon's Sources bar; picking a type hides the other rows in the page's
   Sources panel. Types come from the NotebookLM source list; rows are matched
   by their title text. Nothing is deleted or moved: rows are only hidden.
   ========================================================================== */
(function () {
  "use strict";

  const HIDDEN_ATTR = "data-ntr-filtered";
  const CHECKBOX = 'input[type="checkbox"], [role="checkbox"], mat-checkbox';

  let slot = null;
  let getColumn = () => null;
  let notebookId = "";
  let sources = [];
  let type = "all";
  let loading = null;
  let observer = null;
  let observed = null;
  let applyTimer = 0;
  let lastBoxCount = -1;

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function currentNotebookId() {
    return location.pathname.match(/\/notebook\/([^/?#]+)/i)?.[1] || "";
  }

  async function loadSources(force = false) {
    const id = currentNotebookId();
    if (!id) return;
    if (!force && id === notebookId && (sources.length || loading)) return loading;
    if (id !== notebookId) {
      notebookId = id;
      type = "all";
      sources = [];
    }
    loading = (async () => {
      try {
        sources = (await window.NotebookToolsNotebookLM?.listNotebookLmSources(id)) || [];
      } catch (_error) {
        sources = [];
      }
      loading = null;
      renderSelect();
      apply();
    })();
    return loading;
  }

  function counts() {
    const map = new Map();
    sources.forEach((s) => map.set(s.type || "Other", (map.get(s.type || "Other") || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function renderSelect() {
    if (!slot || !slot.isConnected) return;
    const list = counts();
    if (type !== "all" && !list.some(([t]) => t === type)) type = "all";
    slot.innerHTML = `
      <label class="ntr-typefilter${type !== "all" ? " is-on" : ""}" title="Show only one type of source in the Sources panel">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4-2v-4.5L4 5Z"/></svg>
        <select data-ntr-type aria-label="Filter sources by type"${sources.length ? "" : " disabled"}>
          <option value="all">${sources.length ? `All types (${sources.length})` : "Type"}</option>
          ${list.map(([t, n]) => `<option value="${esc(t)}"${type === t ? " selected" : ""}>${esc(t)} (${n})</option>`).join("")}
        </select>
      </label>`;
  }

  /* ---------- Matching rows in the page ---------- */
  function clear(column) {
    (column || document).querySelectorAll(`[${HIDDEN_ATTR}]`).forEach((row) => {
      row.style.removeProperty("display");
      row.removeAttribute(HIDDEN_ATTR);
    });
  }

  // Count checkboxes, treating a checkbox nested in another (mat-checkbox
  // wrapping an <input>) as one.
  function countBoxes(element) {
    return [...element.querySelectorAll(CHECKBOX)].filter((box) => {
      const outer = box.parentElement?.closest(CHECKBOX);
      return !outer || !element.contains(outer);
    }).length;
  }

  // The row for a title is the closest ancestor of the title text that also
  // holds a checkbox (each source row in the Sources panel has one).
  function rowFor(element, column) {
    let node = element;
    while (node && node !== column) {
      if (node.querySelector?.(CHECKBOX)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function apply() {
    const column = getColumn();
    if (!column) return;
    watch(column);
    clear(column);
    if (type === "all" || !sources.length) return;

    const typeByTitle = new Map();
    sources.forEach((s) => {
      const title = String(s.title || "").trim();
      if (title) typeByTitle.set(title, s.type || "Other");
    });

    const walker = document.createTreeWalker(column, NodeFilter.SHOW_TEXT);
    const rows = new Map();
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const value = text.nodeValue.trim();
      if (!value || !typeByTitle.has(value)) continue;
      const row = rowFor(text.parentElement, column);
      if (!row || rows.has(row)) continue;
      // Skip containers that hold several sources (not a single row).
      if (countBoxes(row) > 1) continue;
      rows.set(row, typeByTitle.get(value));
    }
    rows.forEach((rowType, row) => {
      if (rowType !== type) {
        row.setAttribute(HIDDEN_ATTR, "1");
        row.style.setProperty("display", "none", "important");
      }
    });
  }

  function scheduleApply() {
    window.clearTimeout(applyTimer);
    applyTimer = window.setTimeout(() => {
      const column = getColumn();
      const boxes = column ? countBoxes(column) : 0;
      // A source was added or removed: reload the types, then re-apply.
      if (lastBoxCount !== -1 && boxes !== lastBoxCount) loadSources(true);
      lastBoxCount = boxes;
      if (currentNotebookId() !== notebookId) return loadSources();
      apply();
    }, 250);
  }

  function watch(column) {
    if (observed === column) return;
    observer?.disconnect();
    observed = column;
    lastBoxCount = countBoxes(column);
    observer = new MutationObserver((mutations) => {
      // Ignore our own style changes.
      if (mutations.every((m) => m.type === "attributes")) return;
      scheduleApply();
    });
    observer.observe(column, { childList: true, subtree: true });
  }

  /** Called by the ribbon each time it is built. */
  function attach(slotElement, columnGetter) {
    slot = slotElement;
    getColumn = columnGetter || (() => null);
    slot.addEventListener("change", (event) => {
      if (!event.target.matches("[data-ntr-type]")) return;
      type = event.target.value;
      slot.querySelector(".ntr-typefilter")?.classList.toggle("is-on", type !== "all");
      apply();
    });
    renderSelect();
    loadSources();
  }

  /** Re-check the notebook and re-apply (the ribbon calls this on layout passes). */
  function refresh() {
    if (currentNotebookId() !== notebookId) {
      clear();
      loadSources();
      return;
    }
    if (type !== "all") apply();
  }

  window.NotebookToolsSourceFilter = { attach, refresh, _apply: apply };
})();
