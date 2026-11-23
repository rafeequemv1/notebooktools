/* ==========================================================================
   Prompts tab of the notebooks dashboard.

   Your prompts in one calm table: search, filter by tag, add, edit, copy,
   delete. A small editor holds the title, the prompt and its tags. Your
   prompts appear first in the / menu in every NotebookLM chat
   (notebooklm-prompt-slash.js reads the same storage). The slide deck
   templates are the second view.
   Exposes window.NotebookToolsPromptsView = { open, close }.
   ========================================================================== */
(function () {
  "use strict";

  const KEY = "notebooktoolsCustomPrompts";
  const store = () => (typeof NotebookToolsCustomPrompts !== "undefined" ? NotebookToolsCustomPrompts : null);
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  let viewEl = null;
  let bound = false;
  let prompts = [];
  let query = "";
  let activeTag = "";
  let view = "mine"; // mine | templates
  let templatesMounted = false;
  let editing = null; // { id?, title, prompt, tags[] }

  const ICONS = {
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>'
  };
  const icon = (name, size = 16) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  function relTime(ts) {
    if (!ts) return "";
    const days = Math.floor((Date.now() - ts) / 86400000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function allTags() {
    const counts = new Map();
    for (const p of prompts) for (const t of p.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function visible() {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (activeTag && !(p.tags || []).includes(activeTag)) return false;
      if (!q) return true;
      return `${p.title} ${p.prompt} ${(p.tags || []).join(" ")}`.toLowerCase().includes(q);
    });
  }

  async function load() {
    prompts = (await store()?.list()) || [];
    if (activeTag && !prompts.some((p) => (p.tags || []).includes(activeTag))) activeTag = "";
  }

  function shell() {
    viewEl.innerHTML = `
      <div class="pv-wrap">
        <div class="pv-head">
          <div>
            <h2 class="pv-title">Prompts</h2>
            <p class="pv-sub">Type <b>/</b> in any NotebookLM chat: yours come first.</p>
          </div>
          <div class="pv-seg" role="tablist" aria-label="Prompts view">
            <button type="button" class="pv-seg-btn" data-pv-view="mine" role="tab">My prompts</button>
            <button type="button" class="pv-seg-btn" data-pv-view="templates" role="tab">Slide templates</button>
          </div>
        </div>
        <div class="pv-mine">
          <div class="pv-toolbar">
            <label class="pv-search">${icon("search", 16)}<input type="search" data-pv="search" placeholder="Search your prompts" aria-label="Search your prompts"></label>
            <button type="button" class="pv-new" data-pv="new">${icon("plus", 16)}New prompt</button>
          </div>
          <div class="pv-tags" data-pv="tags"></div>
          <div class="pv-table" data-pv="table"></div>
        </div>
        <div class="pv-templates" hidden><div id="promptsRoot"></div></div>
      </div>
      <div class="pv-editor" data-pv="editor" hidden>
        <div class="pv-editor-backdrop" data-pv="cancel"></div>
        <form class="pv-editor-card" data-pv="form" role="dialog" aria-modal="true" aria-labelledby="pvEditorTitle">
          <div class="pv-editor-head">
            <h3 id="pvEditorTitle">New prompt</h3>
            <button type="button" class="pv-icon" data-pv="cancel" aria-label="Close">${icon("close", 18)}</button>
          </div>
          <label class="pv-field"><span>Title</span><input type="text" data-pv="f-title" maxlength="80" placeholder="Exam paper, 20 questions" required></label>
          <label class="pv-field"><span>Prompt</span><textarea data-pv="f-prompt" rows="6" placeholder="Write a 20-question exam paper from my sources, with an answer key at the end." required></textarea></label>
          <div class="pv-field"><span>Tags</span>
            <div class="pv-tag-input" data-pv="f-tags"><input type="text" data-pv="f-tag" placeholder="Add a tag, then Enter" aria-label="Add a tag"></div>
            <div class="pv-suggest" data-pv="suggest"></div>
          </div>
          <div class="pv-editor-actions">
            <button type="button" class="pv-ghost" data-pv="cancel">Cancel</button>
            <button type="submit" class="pv-save">Save prompt</button>
          </div>
        </form>
      </div>`;
  }

  function renderTags() {
    const tags = allTags();
    const el = viewEl.querySelector('[data-pv="tags"]');
    if (!tags.length) { el.innerHTML = ""; el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = [`<button type="button" class="pv-chip${activeTag ? "" : " is-on"}" data-pv-tag="">All <em>${prompts.length}</em></button>`]
      .concat(tags.map(([t, n]) => `<button type="button" class="pv-chip${activeTag === t ? " is-on" : ""}" data-pv-tag="${esc(t)}">${esc(t)} <em>${n}</em></button>`))
      .join("");
  }

  function renderTable() {
    const el = viewEl.querySelector('[data-pv="table"]');
    if (!prompts.length) {
      el.innerHTML = `<div class="pv-empty">
        <p class="pv-empty-title">No prompts yet</p>
        <p class="pv-empty-text">Save the prompts you use often, tag them, and insert them with <b>/</b> in any notebook. You can also save one from a notebook: <b>Prompts</b> in the ribbon, then <b>Save chat box text as a prompt</b>.</p>
        <button type="button" class="pv-new" data-pv="new">${icon("plus", 16)}New prompt</button>
      </div>`;
      return;
    }
    const rows = visible();
    el.innerHTML = `
      <div class="pv-row pv-row-head" role="row"><span>Prompt</span><span>Tags</span><span>Updated</span><span></span></div>
      ${rows.length ? rows.map((p) => `
        <div class="pv-row" role="row" data-pv-id="${esc(p.id)}">
          <button type="button" class="pv-cell-main" data-pv-edit="${esc(p.id)}" title="Edit">
            <span class="pv-name">${esc(p.title)}</span>
            <span class="pv-preview">${esc(p.prompt.replace(/\s+/g, " ").slice(0, 140))}</span>
          </button>
          <span class="pv-cell-tags">${(p.tags || []).map((t) => `<button type="button" class="pv-tag" data-pv-tag="${esc(t)}">${esc(t)}</button>`).join("") || '<span class="pv-none">—</span>'}</span>
          <span class="pv-cell-date">${esc(relTime(p.updatedAt || p.createdAt))}</span>
          <span class="pv-cell-actions">
            <button type="button" class="pv-icon" data-pv-copy="${esc(p.id)}" title="Copy">${icon("copy")}</button>
            <button type="button" class="pv-icon" data-pv-edit="${esc(p.id)}" title="Edit">${icon("edit")}</button>
            <button type="button" class="pv-icon is-danger" data-pv-delete="${esc(p.id)}" title="Delete">${icon("trash")}</button>
          </span>
        </div>`).join("") : `<p class="pv-nomatch">No prompt matches.</p>`}`;
  }

  function renderView() {
    viewEl.querySelectorAll("[data-pv-view]").forEach((b) => b.classList.toggle("is-on", b.dataset.pvView === view));
    viewEl.querySelector(".pv-mine").hidden = view !== "mine";
    viewEl.querySelector(".pv-templates").hidden = view !== "templates";
    if (view === "templates" && !templatesMounted && typeof NotebookToolsPromptLibraryUI !== "undefined") {
      templatesMounted = true;
      void NotebookToolsPromptLibraryUI.mount(viewEl.querySelector("#promptsRoot"));
    }
  }

  function render() {
    renderTags();
    renderTable();
    renderView();
  }

  /* ---------- Editor ---------- */
  function renderEditorTags() {
    const box = viewEl.querySelector('[data-pv="f-tags"]');
    box.querySelectorAll(".pv-tag").forEach((n) => n.remove());
    const input = box.querySelector("input");
    editing.tags.forEach((t) => {
      const chip = document.createElement("span");
      chip.className = "pv-tag";
      chip.innerHTML = `${esc(t)}<button type="button" data-pv-untag="${esc(t)}" aria-label="Remove ${esc(t)}">${icon("close", 12)}</button>`;
      box.insertBefore(chip, input);
    });
    const have = new Set(editing.tags.map((t) => t.toLowerCase()));
    const suggest = allTags().map(([t]) => t).filter((t) => !have.has(t.toLowerCase())).slice(0, 8);
    viewEl.querySelector('[data-pv="suggest"]').innerHTML = suggest.length
      ? suggest.map((t) => `<button type="button" class="pv-suggest-tag" data-pv-addtag="${esc(t)}">+ ${esc(t)}</button>`).join("")
      : "";
  }

  function addTag(raw) {
    const next = store()?.normalizeTags([...editing.tags, ...String(raw).split(",")]) || editing.tags;
    editing.tags = next;
    renderEditorTags();
  }

  function openEditor(prompt) {
    editing = prompt ? { id: prompt.id, title: prompt.title, prompt: prompt.prompt, tags: [...(prompt.tags || [])] } : { title: "", prompt: "", tags: activeTag ? [activeTag] : [] };
    const ed = viewEl.querySelector('[data-pv="editor"]');
    ed.querySelector("#pvEditorTitle").textContent = prompt ? "Edit prompt" : "New prompt";
    ed.querySelector('[data-pv="f-title"]').value = editing.title;
    ed.querySelector('[data-pv="f-prompt"]').value = editing.prompt;
    ed.querySelector('[data-pv="f-tag"]').value = "";
    renderEditorTags();
    ed.hidden = false;
    ed.querySelector('[data-pv="f-title"]').focus();
  }

  function closeEditor() {
    viewEl.querySelector('[data-pv="editor"]').hidden = true;
    editing = null;
  }

  async function saveEditor() {
    const ed = viewEl.querySelector('[data-pv="editor"]');
    const pending = ed.querySelector('[data-pv="f-tag"]').value.trim();
    if (pending) addTag(pending);
    const title = ed.querySelector('[data-pv="f-title"]').value.trim();
    const text = ed.querySelector('[data-pv="f-prompt"]').value.trim();
    if (!text) { ed.querySelector('[data-pv="f-prompt"]').focus(); return; }
    await store()?.save({ id: editing.id || null, title, prompt: text, tags: editing.tags, type: "text" });
    closeEditor();
    await load();
    render();
  }

  function toast(message) {
    let el = document.querySelector(".pv-toast");
    if (!el) { el = document.createElement("div"); el.className = "pv-toast"; document.body.append(el); }
    el.textContent = message;
    el.classList.add("is-on");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("is-on"), 1800);
  }

  function bind() {
    viewEl.addEventListener("click", async (event) => {
      const t = event.target.closest("button, [data-pv='cancel']");
      if (!t) return;
      const byId = (id) => prompts.find((p) => p.id === id);
      if (t.dataset.pvView) { view = t.dataset.pvView; renderView(); return; }
      if (t.dataset.pv === "new") return openEditor(null);
      if (t.dataset.pv === "cancel") return closeEditor();
      if (t.dataset.pvEdit) return openEditor(byId(t.dataset.pvEdit));
      if (t.dataset.pvTag !== undefined) { activeTag = activeTag === t.dataset.pvTag ? "" : t.dataset.pvTag; renderTags(); renderTable(); return; }
      if (t.dataset.pvCopy) {
        const p = byId(t.dataset.pvCopy);
        if (p) { await navigator.clipboard.writeText(p.prompt).catch(() => {}); toast("Copied"); }
        return;
      }
      if (t.dataset.pvDelete) {
        const p = byId(t.dataset.pvDelete);
        if (p && window.confirm(`Delete "${p.title}"?`)) { await store()?.remove(p.id); await load(); render(); }
        return;
      }
      if (t.dataset.pvUntag) { editing.tags = editing.tags.filter((x) => x !== t.dataset.pvUntag); renderEditorTags(); return; }
      if (t.dataset.pvAddtag) { addTag(t.dataset.pvAddtag); return; }
    });
    viewEl.addEventListener("input", (event) => {
      if (event.target.dataset.pv === "search") { query = event.target.value; renderTable(); }
    });
    viewEl.addEventListener("keydown", (event) => {
      const el = event.target;
      if (el.dataset.pv === "f-tag" && (event.key === "Enter" || event.key === ",")) {
        event.preventDefault();
        if (el.value.trim()) { addTag(el.value); el.value = ""; }
      } else if (el.dataset.pv === "f-tag" && event.key === "Backspace" && !el.value && editing?.tags.length) {
        editing.tags.pop();
        renderEditorTags();
      } else if (event.key === "Escape" && editing) {
        closeEditor();
      } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && editing) {
        event.preventDefault();
        void saveEditor();
      }
    });
    viewEl.addEventListener("submit", (event) => { event.preventDefault(); void saveEditor(); });
  }

  // A prompt saved from a notebook's ribbon shows up here straight away
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "local" || !changes[KEY] || !viewEl || viewEl.hidden || !bound) return;
    await load();
    renderTags();
    renderTable();
  });

  window.NotebookToolsPromptsView = {
    async open() {
      viewEl ||= document.querySelector("#promptsView");
      if (!viewEl) return;
      if (!bound) { bound = true; shell(); bind(); }
      viewEl.hidden = false;
      await load();
      render();
    },
    close() {
      (viewEl || document.querySelector("#promptsView"))?.setAttribute("hidden", "");
    }
  };
})();
