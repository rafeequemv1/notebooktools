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

  const ICON = {
    all: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    Audio: '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>',
    "Slide deck": '<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="7" y="8.5" width="10" height="7" rx="1"/>',
    Video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
    "Mind map": '<circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4m0 0V7.5A1.5 1.5 0 0 1 12.5 6H17M11 12v4.5a1.5 1.5 0 0 0 1.5 1.5H17"/>',
    Report: '<path d="M7 3.5h7l4.5 4.5v12.5H7z"/><path d="M14 3.5V8h4.5M9.5 12.5h6M9.5 16h4"/>',
    Quiz: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9.6 9.6a2.4 2.4 0 1 1 3.4 2.2c-.6.3-1 .8-1 1.5V14M12 17h.01"/>',
    Infographic: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    "Data table": '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
    newest: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    oldest: '<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/><path d="M12 8v4l3 2"/>',
    type: '<path d="M12 3.5 7.5 11h9z"/><circle cx="17" cy="17" r="3.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/>',
    sort: '<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/>',
    caret: '<path d="m7 10 5 5 5-5"/>'
  };
  // Studio tile colours (dark page, light page)
  const TINT = {
    Audio: ["#a8c7fa", "#0b57d0"], "Slide deck": ["#f7a1c4", "#c2185b"], Video: ["#81c995", "#188038"],
    "Mind map": ["#d7aefb", "#8430ce"], Report: ["#f6aea9", "#c5221f"], Quiz: ["#a8c7fa", "#1a73e8"],
    Infographic: ["#fdd663", "#b06000"], "Data table": ["#78d9ec", "#007b83"]
  };
  const svg = (name, size = 16, color = "") =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${color ? ` style="color:${color}"` : ""}>${ICON[name] || ICON.Report}</svg>`;
  const isDark = () => document.getElementById("notebooktools-ribbon")?.classList.contains("is-dark") ?? window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const tint = (t) => (TINT[t] ? TINT[t][isDark() ? 0 : 1] : "");

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
    const typeLabel = type === "all" ? "All types" : (TYPE_LABEL[type] || type);
    const sortLabel = (SORTS.find(([k]) => k === sort) || SORTS[0])[1];
    slot.innerHTML = `
      <button type="button" class="ntr-btn has-caret ntr-sf${type !== "all" ? " is-on" : ""}" data-sf="type" title="Show one type of Studio file"${items.length ? "" : " disabled"}>
        ${type === "all" ? svg("all") : svg(type, 16, tint(type))}<span class="ntr-label">${esc(typeLabel)}</span>${svg("caret", 13)}
      </button>
      <button type="button" class="ntr-btn has-caret ntr-sf${sort !== "newest" ? " is-on" : ""}" data-sf="sort" title="Sort the Studio list by date or by file type"${items.length ? "" : " disabled"}>
        ${svg("sort")}<span class="ntr-label">${esc(sortLabel)}</span>${svg("caret", 13)}
      </button>`;
  }

  /* ---------- Menus, in the ribbon's own style ---------- */
  function closeMenu() {
    document.querySelector(".ntr-menu.ntr-sf-menu")?.remove();
  }

  function openMenu(anchor, which) {
    closeMenu();
    const menu = document.createElement("div");
    menu.className = `ntr-menu ntr-sf-menu${isDark() ? " is-dark" : ""}`;
    menu.setAttribute("role", "menu");
    const item = (value, icon, text, active, extra = "") =>
      `<button type="button" role="menuitemradio" aria-checked="${active}" class="ntr-menu-item${active ? " is-active" : ""}" data-value="${esc(value)}">${icon}<span>${esc(text)}</span>${extra}${active ? '<b class="ntr-check">✓</b>' : ""}</button>`;
    if (which === "type") {
      menu.innerHTML = `<p class="ntr-menu-title">Show</p>`
        + item("all", svg("all", 16), "All types", type === "all", `<em class="ntr-sf-count">${items.length}</em>`)
        + counts().map(([t, n]) => item(t, svg(t, 16, tint(t)), TYPE_LABEL[t] || t, type === t, `<em class="ntr-sf-count">${n}</em>`)).join("");
    } else {
      menu.innerHTML = `<p class="ntr-menu-title">Sort by</p>` + SORTS.map(([k, name]) => item(k, svg(k, 16), name, sort === k)).join("");
    }
    document.body.append(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${r.bottom + 6}px`;
    menu.addEventListener("click", (event) => {
      event.stopPropagation();
      const choice = event.target.closest("[data-value]");
      if (!choice) return;
      if (which === "type") type = choice.dataset.value;
      else sort = choice.dataset.value;
      closeMenu();
      remember();
      render();
      apply();
    });
  }

  document.addEventListener("mousedown", (event) => {
    const menu = document.querySelector(".ntr-menu.ntr-sf-menu");
    if (menu && !menu.contains(event.target) && !event.target.closest?.("[data-sf]")) closeMenu();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

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
    slot.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sf]");
      if (!button || button.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      if (document.querySelector(".ntr-menu.ntr-sf-menu")) return closeMenu();
      openMenu(button, button.dataset.sf);
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
