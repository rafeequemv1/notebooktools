/* ==========================================================================
   Type filter and sort for NotebookLM's own Studio list (free). Two small
   dropdowns in the ribbon's Studio bar. Types come from the notebook's
   Studio items (plus its mind maps), and the sort groups rows by file type
   in the order of NotebookLM's Studio buttons. Each row's file type comes
   from NotebookLM's own list (the title is only used to find the row). Nothing is deleted or moved in NotebookLM: other
   types are hidden, and sorting only changes the visual order (CSS order).
   ========================================================================== */
(function () {
  "use strict";

  const HIDDEN_ATTR = "data-ntr-studio-hidden";
  const ORDER_ATTR = "data-ntr-studio-order";
  const MORE_TEXT = /^(more|more options|more actions|options)$/i;
  const SORTS = [
    ["newest", "Newest first"],
    ["oldest", "Oldest first"],
    ["type", "By file type"]
  ];
  // File types in the order of NotebookLM's Studio buttons
  const TYPE_ORDER = ["Audio", "Slide deck", "Video", "Mind map", "Report", "Quiz", "Infographic", "Data table"];
  const typeRank = (t) => {
    const i = TYPE_ORDER.indexOf(t);
    return i === -1 ? TYPE_ORDER.length : i;
  };
  const TYPE_LABEL = { Audio: "Audio Overview", Video: "Video Overview", Report: "Report", Quiz: "Quiz & flashcards", Infographic: "Infographic", "Slide deck": "Slide deck", "Data table": "Data table", "Mind map": "Mind map" };

  let slot = null;
  let getColumn = () => null;
  let notebookId = "";
  let items = []; // { title, type }
  let type = "all";
  let sort = "newest";
  let loading = null;
  let observer = null;
  let observed = null;
  let applyTimer = 0;
  let lastRowCount = -1;
  let flexParent = null; // a container we made flex to sort, and its old inline display

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const norm = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const label = (el) => ((el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("mattooltip"))) || el.textContent || "").trim();

  function currentNotebookId() {
    return location.pathname.match(/\/notebook\/([^/?#]+)/i)?.[1] || "";
  }

  function remember() {
    try { sessionStorage.setItem(`ntrStudioView:${notebookId}`, JSON.stringify({ type, sort })); } catch (_error) { /* private mode */ }
  }

  function recall() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(`ntrStudioView:${notebookId}`) || "{}");
      type = saved.type || "all";
      sort = SORTS.some(([k]) => k === saved.sort) ? saved.sort : "newest";
    } catch (_error) {
      type = "all";
      sort = "newest";
    }
  }

  async function loadItems(force = false) {
    const id = currentNotebookId();
    if (!id) return;
    if (!force && id === notebookId && (items.length || loading)) return loading;
    if (id !== notebookId) {
      notebookId = id;
      items = [];
      recall();
    }
    const client = window.NotebookToolsNotebookLM;
    loading = (async () => {
      const [artifacts, maps] = await Promise.all([
        client?.listNotebookLmArtifacts?.(id).catch(() => []) ?? [],
        client?.listNotebookLmMindMaps?.(id).catch(() => []) ?? []
      ]);
      items = [
        ...(artifacts || []).map((a) => ({ title: a.title, type: a.type || "Other" })),
        ...(maps || []).map((m) => ({ title: m.title, type: "Mind map" }))
      ].filter((i) => i.title);
      loading = null;
      render();
      apply();
    })();
    return loading;
  }

  function counts() {
    const map = new Map();
    items.forEach((i) => map.set(i.type, (map.get(i.type) || 0) + 1));
    return [...map.entries()].sort((a, b) => typeRank(a[0]) - typeRank(b[0]) || a[0].localeCompare(b[0]));
  }

  function render() {
    if (!slot || !slot.isConnected) return;
    const list = counts();
    if (type !== "all" && !list.some(([t]) => t === type)) type = "all";
    slot.innerHTML = `
      <label class="ntr-typefilter${type !== "all" ? " is-on" : ""}" title="Show only one type of Studio file">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4-2v-4.5L4 5Z"/></svg>
        <select data-ntr-studio-type aria-label="Filter Studio files by type"${items.length ? "" : " disabled"}>
          <option value="all">${items.length ? `All types (${items.length})` : "Type"}</option>
          ${list.map(([t, n]) => `<option value="${esc(t)}"${type === t ? " selected" : ""}>${esc(TYPE_LABEL[t] || t)} (${n})</option>`).join("")}
        </select>
      </label>
      <label class="ntr-typefilter${sort !== "newest" ? " is-on" : ""}" title="Sort the Studio list by date or by file type">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/></svg>
        <select data-ntr-studio-sort aria-label="Sort Studio files"${items.length ? "" : " disabled"}>
          ${SORTS.map(([k, name]) => `<option value="${k}"${sort === k ? " selected" : ""}>${name}</option>`).join("")}
        </select>
      </label>`;
  }

  /* ---------- Rows in the page's Studio panel ---------- */
  const moreButtons = (el) => [...el.querySelectorAll("button, [role='button']")].filter((b) => MORE_TEXT.test(label(b)));

  /** Each Studio row: the smallest element round a title that holds exactly one ⋮ button. */
  function findRows(column) {
    const typeByTitle = new Map(items.map((i) => [norm(i.title), i.type]));
    const rows = new Map();
    const walker = document.createTreeWalker(column, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const value = norm(text.nodeValue);
      if (!value || !typeByTitle.has(value)) continue;
      let node = text.parentElement;
      while (node && node !== column) {
        const mores = moreButtons(node);
        if (mores.length > 1) { node = null; break; } // several items: not a row
        if (mores.length === 1) break;
        node = node.parentElement;
      }
      if (!node || node === column || rows.has(node)) continue;
      // An open item's header (title, ⋮, "View prompt") isn't a list row
      if ([...node.querySelectorAll("button, a, [role='button']")].some((b) => /^view prompt/i.test(label(b)))) continue;
      rows.set(node, { title: value, type: typeByTitle.get(value) });
    }
    return rows;
  }

  function clear(column) {
    (column || document).querySelectorAll(`[${HIDDEN_ATTR}]`).forEach((row) => {
      row.style.removeProperty("display");
      row.removeAttribute(HIDDEN_ATTR);
    });
    (column || document).querySelectorAll(`[${ORDER_ATTR}]`).forEach((el) => {
      el.style.removeProperty("order");
      el.removeAttribute(ORDER_ATTR);
    });
    if (flexParent) {
      flexParent.el.style.display = flexParent.display;
      flexParent.el.style.flexDirection = flexParent.direction;
      flexParent = null;
    }
  }

  /** The list's container and, for each row, its child of that container (what gets the CSS order). */
  function sortables(rowList) {
    if (rowList.length < 2) return null;
    let common = rowList[0].parentElement;
    while (common && !rowList.every((r) => common.contains(r))) common = common.parentElement;
    if (!common) return null;
    const entries = rowList.map((row) => {
      let item = row;
      while (item.parentElement && item.parentElement !== common) item = item.parentElement;
      return item;
    });
    return new Set(entries).size === entries.length ? { common, entries } : null;
  }

  function apply() {
    const column = getColumn();
    if (!column) return;
    watch(column);
    clear(column);
    if (!items.length || (type === "all" && sort === "newest")) return;
    const rows = findRows(column);

    if (type !== "all") {
      rows.forEach((info, row) => {
        if (info.type !== type) {
          row.setAttribute(HIDDEN_ATTR, "1");
          row.style.setProperty("display", "none", "important");
        }
      });
    }

    if (sort !== "newest") {
      const list = [...rows.keys()];
      const found = sortables(list);
      if (!found) return;
      const { common, entries } = found;
      const indexed = list.map((row, i) => ({ entry: entries[i], info: rows.get(row), i }));
      if (sort === "oldest") indexed.reverse();
      if (sort === "type") indexed.sort((a, b) => typeRank(a.info.type) - typeRank(b.info.type) || a.i - b.i);
      const display = getComputedStyle(common).display;
      if (!/flex|grid/.test(display)) {
        flexParent = { el: common, display: common.style.display, direction: common.style.flexDirection };
        common.style.display = "flex";
        common.style.flexDirection = "column";
      }
      // Anything that isn't a row (headers, generating placeholders) stays on top
      indexed.forEach(({ entry }, n) => {
        entry.setAttribute(ORDER_ATTR, String(n + 1));
        entry.style.setProperty("order", String(n + 1));
      });
    }
  }

  function scheduleApply() {
    window.clearTimeout(applyTimer);
    applyTimer = window.setTimeout(() => {
      const column = getColumn();
      const count = column ? moreButtons(column).length : 0;
      // An item was made or deleted: reload the list, then re-apply
      if (lastRowCount !== -1 && count !== lastRowCount) loadItems(true);
      lastRowCount = count;
      if (currentNotebookId() !== notebookId) return loadItems();
      apply();
    }, 250);
  }

  function watch(column) {
    if (observed === column) return;
    observer?.disconnect();
    observed = column;
    lastRowCount = moreButtons(column).length;
    observer = new MutationObserver((mutations) => {
      if (mutations.every((m) => m.type === "attributes")) return; // our own style changes
      scheduleApply();
    });
    observer.observe(column, { childList: true, subtree: true });
  }

  /** Called by the ribbon each time it is built. */
  function attach(slotElement, columnGetter) {
    slot = slotElement;
    getColumn = columnGetter || (() => null);
    slot.addEventListener("change", (event) => {
      if (event.target.matches("[data-ntr-studio-type]")) type = event.target.value;
      else if (event.target.matches("[data-ntr-studio-sort]")) sort = event.target.value;
      else return;
      remember();
      render();
      apply();
    });
    render();
    loadItems();
  }

  /** Re-check the notebook and re-apply (the ribbon calls this on layout passes). */
  function refresh() {
    if (currentNotebookId() !== notebookId) {
      clear();
      loadItems();
      return;
    }
    if (type !== "all" || sort !== "newest") apply();
  }

  window.NotebookToolsStudioFilter = { attach, refresh, _apply: apply, _findRows: findRows };
})();
