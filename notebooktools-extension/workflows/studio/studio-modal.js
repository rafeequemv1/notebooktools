/* ==========================================================================
   Manage Studio files: a dialog over the NotebookLM page listing every Studio
   output in this notebook (Audio and Video Overviews, slide decks, reports,
   quizzes, infographics…). Search, filter by type, open or download, and
   delete in bulk. Shares the .nts- styles of the Manage sources dialog.
   ========================================================================== */
(function () {
  "use strict";

  let root = null;
  let state = null;

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function isDarkPage() {
    for (const node of [document.body, document.documentElement]) {
      const bg = node && getComputedStyle(node).backgroundColor.match(/\d+(\.\d+)?/g);
      if (!bg || Number(bg[3] ?? 1) === 0) continue;
      const [r, g, b] = bg.map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
  }

  function client() {
    return window.NotebookToolsNotebookLM;
  }

  // Icons and colours per Studio type, close to NotebookLM's own Studio list.
  const TYPE_ICONS = {
    Audio: ["#7aa7f5", '<path d="M5 10v4M9 7v10M13 4v16M17 8v8"/><path d="M20 3.5l.7 1.6 1.6.7-1.6.7L20 8.1l-.7-1.6-1.6-.7 1.6-.7z" fill="currentColor" stroke="none"/>'],
    Video: ["#5bb974", '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10.5 5-3v9l-5-3"/>'],
    "Slide deck": ["#f0717f", '<rect x="3" y="5" width="18" height="13" rx="2"/><path d="M7 5v13"/>'],
    Report: ["#c58af9", '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none"/>'],
    Quiz: ["#4ecde6", '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9.6 9.5a2.4 2.4 0 1 1 3.4 2.2c-.6.3-1 .9-1 1.6M12 16.4h.01"/>'],
    Flashcards: ["#f4c430", '<rect x="4" y="7" width="12" height="13" rx="2.5"/><path d="M8 4h9a3 3 0 0 1 3 3v10"/>'],
    Infographic: ["#f4c430", '<path d="M5 20V11M10 20V5M15 20v-6M20 20V9"/>'],
    "Mind map": ["#a78bfa", '<rect x="3" y="9.5" width="6" height="5" rx="1.2"/><rect x="15" y="3.5" width="6" height="5" rx="1.2"/><rect x="15" y="15.5" width="6" height="5" rx="1.2"/><path d="M9 12h3M12 6v12M12 6h3M12 18h3"/>'],
    "Data table": ["#5bb974", '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M10 9.5v10"/>']
  };

  function typeIcon(type) {
    const [color, path] = TYPE_ICONS[type] || ["#9aa0a6", '<rect x="4" y="4" width="16" height="16" rx="3"/>'];
    return `<span class="nts-ficon" style="--fc:${color}" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
  }

  function statusLabel(status) {
    if (!status || status === "ready") return "";
    if (/generat|progress|pending/i.test(status)) return "Generating…";
    if (/fail|error/i.test(status)) return "Failed";
    return String(status);
  }

  function visible() {
    const q = state.query.trim().toLowerCase();
    return state.items.filter((a) => {
      if (state.type !== "all" && a.type !== state.type) return false;
      if (q && !`${a.title} ${a.type}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  async function load(note = "") {
    const session = state;
    Object.assign(state, { loading: true, error: "", note });
    render();
    try {
      const items = await client().listNotebookLmArtifacts(state.notebookId);
      if (state !== session) return;
      state.items = items;
      state.selected = new Set([...state.selected].filter((id) => items.some((a) => a.id === id)));
      if (state.type !== "all" && !items.some((a) => a.type === state.type)) state.type = "all";
    } catch (error) {
      if (state !== session) return;
      state.error = error.message || "Could not load this notebook's Studio files.";
    }
    state.loading = false;
    render();
  }

  function render() {
    if (!root || !state) return;
    const list = visible();
    const counts = new Map();
    state.items.forEach((a) => counts.set(a.type, (counts.get(a.type) || 0) + 1));
    const types = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const allShown = list.length > 0 && list.every((a) => state.selected.has(a.id));

    root.querySelector("[data-count]").textContent = state.loading && !state.items.length
      ? "Loading Studio files…"
      : `${state.items.length} Studio file${state.items.length === 1 ? "" : "s"} in this notebook`;

    root.querySelector(".nts-body").innerHTML = `
      <div class="nts-controls">
        <input type="search" class="nts-input nts-search" data-search placeholder="Search Studio files" value="${esc(state.query)}" aria-label="Search Studio files">
        <select class="nts-select" data-type aria-label="Filter by type">
          <option value="all">All types (${state.items.length})</option>
          ${types.map(([t, n]) => `<option value="${esc(t)}"${state.type === t ? " selected" : ""}>${esc(t)} (${n})</option>`).join("")}
        </select>
      </div>
      ${state.error ? `<div class="nts-empty is-error">${esc(state.error)}</div>` : ""}
      ${!state.error && state.loading && !state.items.length ? `<div class="nts-empty">Loading Studio files…</div>` : ""}
      ${!state.error && !state.loading && !list.length ? `<div class="nts-empty">${state.items.length ? "No Studio files match." : "No Studio files yet. Create one from the Studio panel."}</div>` : ""}
      ${list.length ? `
        <label class="nts-row nts-row-head">
          <input type="checkbox" data-select-all${allShown ? " checked" : ""}>
          <span>${state.selected.size ? `${state.selected.size} selected` : "Select all"}</span>
        </label>
        <div class="nts-list">
          ${list.map((a) => {
            const link = a.downloadUrl || a.mediaUrl;
            const status = statusLabel(a.status);
            return `
            <label class="nts-row${state.selected.has(a.id) ? " is-selected" : ""}">
              <input type="checkbox" data-id="${esc(a.id)}"${state.selected.has(a.id) ? " checked" : ""}>
              ${typeIcon(a.type)}
              <span class="nts-text">
                <span class="nts-title" title="${esc(a.title)}">${esc(a.title)}</span>
                <span class="nts-meta">${[a.type, a.duration, status].filter(Boolean).map(esc).join(" · ")}</span>
              </span>
              ${a.type === "Slide deck" && (!a.status || a.status === "ready") ? `<button type="button" class="nts-link nts-edit" data-edit="${esc(a.id)}" data-stop title="Open in the NotebookTools slide editor: editable text, export PowerPoint">Edit</button>` : ""}
              ${link ? `<a class="nts-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer" data-stop>${a.downloadUrl ? "Download" : "Open"}</a>` : ""}
            </label>`;
          }).join("")}
        </div>` : ""}`;

    const selected = state.items.filter((a) => state.selected.has(a.id));
    const busy = state.loading || state.working;
    root.querySelector("[data-status]").textContent = state.working || state.note || "";
    const del = root.querySelector("[data-delete]");
    del.disabled = busy || !selected.length;
    del.textContent = state.confirmDelete ? `Confirm delete (${selected.length})` : selected.length ? `Delete (${selected.length})` : "Delete";
    del.classList.toggle("is-confirm", Boolean(state.confirmDelete));
    root.querySelector("[data-refresh]").disabled = busy;
    root.querySelector("[data-reload]").hidden = !state.changed;
  }

  async function deleteSelected() {
    if (!state.confirmDelete) {
      state.confirmDelete = true;
      state.note = "This permanently deletes the selected Studio files. Click again to confirm.";
      return render();
    }
    const items = state.items.filter((a) => state.selected.has(a.id));
    const session = state;
    let done = 0;
    let failed = 0;
    for (const item of items) {
      if (state !== session) return;
      state.working = `Deleting ${done + failed + 1} of ${items.length}…`;
      render();
      try {
        await client().deleteNotebookLmArtifact(state.notebookId, item.id);
        done += 1;
      } catch (_error) {
        failed += 1;
      }
    }
    if (state !== session) return;
    Object.assign(state, { working: "", confirmDelete: false, selected: new Set(), changed: state.changed || done > 0 });
    await load(`Deleted ${done}${failed ? `, ${failed} failed` : ""}. Reload the page to see it in NotebookLM.`);
  }

  function onKey(event) {
    if (event.key === "Escape" && root) {
      event.stopPropagation();
      close();
    }
  }

  function open(notebookId, options = {}) {
    if (!notebookId || !client()) return;
    close();
    state = { notebookId, items: [], selected: new Set(), type: options.type || "all", query: "", loading: true, error: "", note: "", working: "", confirmDelete: false, changed: false };

    root = document.createElement("div");
    root.className = `nts-backdrop${isDarkPage() ? " is-dark" : ""}`;
    root.innerHTML = `
      <div class="nts-dialog" role="dialog" aria-modal="true" aria-labelledby="ntsf-title">
        <header class="nts-head">
          <div>
            <h2 id="ntsf-title">Manage Studio files</h2>
            <p data-count>Loading Studio files…</p>
          </div>
          <button type="button" class="nts-close" data-close aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </header>
        <div class="nts-body"></div>
        <footer class="nts-foot">
          <span class="nts-status" data-status></span>
          <button type="button" class="nts-btn" data-reload hidden>Reload page</button>
          <button type="button" class="nts-btn" data-refresh>Refresh list</button>
          <button type="button" class="nts-btn is-danger" data-delete disabled>Delete</button>
        </footer>
      </div>`;
    document.body.append(root);

    root.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit]");
      if (edit) {
        event.preventDefault();
        event.stopPropagation();
        const item = state.items.find((a) => a.id === edit.dataset.edit);
        const authUser = new URLSearchParams(location.search).get("authuser");
        chrome.runtime.sendMessage({ type: "notebooktools-open-slide-editor", notebookId: state.notebookId, artifactId: item?.id, title: item?.title, authUser });
        state.note = "Opening the slide editor in a new tab…";
        render();
        return;
      }
      if (event.target.closest("[data-stop]")) {
        event.stopPropagation();
        return;
      }
      if (event.target === root || event.target.closest("[data-close]")) return close();
      if (event.target.closest("[data-delete]")) return void deleteSelected();
      if (event.target.closest("[data-refresh]")) return void load();
      if (event.target.closest("[data-reload]")) return location.reload();
    });
    root.addEventListener("change", (event) => {
      const t = event.target;
      if (t.matches("[data-type]")) state.type = t.value;
      else if (t.matches("[data-select-all]")) visible().forEach((a) => (t.checked ? state.selected.add(a.id) : state.selected.delete(a.id)));
      else if (t.matches("input[data-id]")) t.checked ? state.selected.add(t.dataset.id) : state.selected.delete(t.dataset.id);
      else return;
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

  window.NotebookToolsStudioModal = { open, close };
})();
