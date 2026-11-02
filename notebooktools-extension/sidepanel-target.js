/* ==========================================================================
   One shared "Add to" notebook for the whole side panel.

   Import, Bulk and Snapshots each keep their own picker (search, select,
   "new notebook" field) because their import code reads it. Those pickers
   are hidden; this bar is the only notebook control people see, and it
   writes the choice into every picker, including ones mounted later.
   ========================================================================== */
(function () {
  "use strict";

  const PICKERS = [
    { select: "#notebookLmSelect", newName: "#newNotebookLmName", refresh: "#refreshNotebookLmButton" },
    { select: "#bulkNotebookSelect", newName: "#bulkNewNotebookName", refresh: "#bulkRefreshButton" },
    { select: "#snapshotsNotebookSelect", newName: "#snapshotsNewNotebookName", refresh: "#snapshotsRefreshNotebooksBtn" }
  ];
  const LAST_KEY = "lastNotebookId";

  const bar = document.querySelector("#spTarget");
  if (!bar) {
    return;
  }

  let notebooks = [];
  let current = { id: "", newName: "" };
  let open = false;
  let query = "";
  let creating = false;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // "🤖 Research — AI tools (12)" → { title, count }
  function parseOption(option) {
    const text = option.textContent.trim();
    const match = text.match(/^(.*?)\s*\((\d+)\)$/);
    return { id: option.value, title: match ? match[1] : text, count: match ? Number(match[2]) : null };
  }

  function readNotebooks() {
    const select = document.querySelector(PICKERS[0].select);
    if (!select) {
      return;
    }
    const list = Array.from(select.options).filter((o) => o.value).map(parseOption);
    if (list.length || !notebooks.length) {
      notebooks = list;
    }
    if (!current.id && !current.newName && select.value) {
      current.id = select.value;
    }
  }

  function loadingState() {
    const select = document.querySelector(PICKERS[0].select);
    const first = select?.options[0]?.textContent || "";
    if (/loading/i.test(first)) return "loading";
    if (/sign in/i.test(first)) return "signin";
    return "";
  }

  function fire(el, type) {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  /** Write the current choice into every mounted picker. */
  function sync() {
    for (const p of PICKERS) {
      const select = document.querySelector(p.select);
      const newName = document.querySelector(p.newName);
      if (current.newName) {
        if (newName && newName.value !== current.newName) {
          newName.value = current.newName;
          fire(newName, "input");
        }
        continue;
      }
      if (newName && newName.value) {
        newName.value = "";
        fire(newName, "input");
      }
      if (select && current.id && select.value !== current.id && Array.from(select.options).some((o) => o.value === current.id)) {
        select.value = current.id;
        fire(select, "change");
      }
    }
  }

  function choose(id) {
    current = { id, newName: "" };
    chrome.storage.local.set({ [LAST_KEY]: id });
    sync();
    close();
  }

  function chooseNew(name) {
    const clean = String(name || "").trim();
    if (!clean) return;
    current = { id: "", newName: clean };
    sync();
    close();
  }

  function close() {
    open = false;
    creating = false;
    query = "";
    render();
  }

  function label() {
    if (current.newName) {
      return `<span class="sp-target-new">New</span><span class="sp-target-name">${esc(current.newName)}</span>`;
    }
    const nb = notebooks.find((n) => n.id === current.id);
    if (nb) {
      return `<span class="sp-target-name">${esc(nb.title)}</span>${nb.count != null ? `<span class="sp-target-count">${nb.count}</span>` : ""}`;
    }
    const state = loadingState();
    if (state === "loading") return '<span class="sp-target-name is-muted">Loading notebooks…</span>';
    if (state === "signin") return '<span class="sp-target-name is-muted">Sign in to NotebookLM</span>';
    return '<span class="sp-target-name is-muted">Choose a notebook</span>';
  }

  function menuHtml() {
    const needle = query.trim().toLowerCase();
    const items = notebooks.filter((n) => !needle || n.title.toLowerCase().includes(needle));
    const list = items.length
      ? items.map((n) => `
          <button type="button" class="sp-target-item${n.id === current.id && !current.newName ? " is-active" : ""}" data-pick="${esc(n.id)}">
            <span class="sp-target-item-name">${esc(n.title)}</span>
            ${n.count != null ? `<span class="sp-target-item-count">${n.count}</span>` : ""}
          </button>`).join("")
      : `<p class="sp-target-empty">${notebooks.length ? "No notebook matches." : loadingState() === "signin" ? "Sign in to NotebookLM in this browser, then refresh." : "No notebooks yet."}</p>`;
    return `
      <div class="sp-target-menu" role="dialog" aria-label="Choose a notebook">
        <input type="search" class="sp-target-search" placeholder="Search notebooks" value="${esc(query)}" aria-label="Search notebooks">
        <div class="sp-target-list">${list}</div>
        ${creating
          ? `<form class="sp-target-create" data-create-form><input type="text" class="sp-target-create-input" placeholder="New notebook name" maxlength="80" aria-label="New notebook name"><button type="submit" class="sp-target-create-btn">Use</button></form>`
          : `<button type="button" class="sp-target-item is-new" data-new>＋ New notebook…</button>`}
        <div class="sp-target-foot" data-autoopen-slot></div>
        <button type="button" class="sp-target-refresh" data-refresh>Refresh list</button>
      </div>`;
  }

  function render() {
    readNotebooks();
    bar.classList.toggle("is-open", open);
    bar.innerHTML = `
      <span class="sp-target-label">Add to</span>
      <button type="button" class="sp-target-btn" aria-haspopup="dialog" aria-expanded="${open}">
        ${label()}
        <svg class="sp-target-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      ${open ? menuHtml() : ""}`;

    // The "open after import" switch lives in the menu (it was in the header)
    const holder = document.querySelector("#spAutoOpenHolder");
    const sw = document.querySelector("#autoOpenNotebookToggle")?.closest("label");
    const slot = bar.querySelector("[data-autoopen-slot]");
    if (sw) (slot || holder)?.appendChild(sw);

    if (open) {
      const search = bar.querySelector(".sp-target-search");
      const createInput = bar.querySelector(".sp-target-create-input");
      (createInput || search)?.focus();
      search?.addEventListener("input", () => {
        query = search.value;
        const pos = search.selectionStart;
        render();
        const again = bar.querySelector(".sp-target-search");
        again?.setSelectionRange(pos, pos);
      });
    }
  }

  bar.addEventListener("click", (event) => {
    const target = event.target;
    if (target.closest(".sp-target-btn")) {
      open = !open;
      creating = false;
      render();
      return;
    }
    const pick = target.closest("[data-pick]");
    if (pick) return choose(pick.dataset.pick);
    if (target.closest("[data-new]")) {
      creating = true;
      render();
      return;
    }
    if (target.closest("[data-refresh]")) {
      for (const p of PICKERS) document.querySelector(p.refresh)?.click();
      close();
    }
  });

  bar.addEventListener("submit", (event) => {
    if (!event.target.closest("[data-create-form]")) return;
    event.preventDefault();
    chooseNew(bar.querySelector(".sp-target-create-input")?.value);
  });

  document.addEventListener("mousedown", (event) => {
    if (open && !bar.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (open && event.key === "Escape") close();
  });

  // Hidden on Prompts, where there is nothing to add
  function syncVisibility() {
    const promptsActive = document.querySelector('.sidepanel-tab.is-active')?.dataset.panel === "prompts";
    bar.hidden = promptsActive;
  }
  document.querySelector(".sidepanel-tabs")?.addEventListener("click", () => setTimeout(syncVisibility, 0));

  // Follow the pickers as they load, refresh and mount
  let scheduled = 0;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = requestAnimationFrame(() => {
      scheduled = 0;
      const before = JSON.stringify(notebooks);
      readNotebooks();
      sync();
      syncVisibility();
      if (!open && JSON.stringify(notebooks) !== before) render();
    });
  }).observe(document.querySelector(".sidepanel-app") || document.body, { childList: true, subtree: true });

  // Start from the remembered notebook
  chrome.storage.local.get(LAST_KEY, (stored) => {
    if (stored?.[LAST_KEY] && !current.id) current.id = stored[LAST_KEY];
    render();
    syncVisibility();
  });
})();
