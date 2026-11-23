/* ==========================================================================
   Presentations tab: slide decks being edited in the slide editor, saved on
   this computer (slide-editor/deck-store.js, IndexedDB). Open, rename, delete.
   Nothing here is uploaded.
   ========================================================================== */
window.NotebookToolsPresentations = (() => {
  let viewEl = null;
  let query = "";

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ago = (t) => {
    const s = Math.max(1, Math.round((Date.now() - t) / 1000));
    if (s < 60) return "just now";
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return d < 30 ? `${d} day${d === 1 ? "" : "s"} ago` : new Date(t).toLocaleDateString();
  };
  const size = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const editorUrl = (q) => chrome.runtime.getURL(`slide-editor.html${q ? `?${q}` : ""}`);

  async function render() {
    if (!viewEl) return;
    const store = window.NTDeckStore;
    let list = [];
    try { list = store ? await store.list() : []; } catch (_error) { list = []; }
    const total = list.reduce((n, m) => n + (m.bytes || 0), 0);
    const needle = query.trim().toLowerCase();
    const shown = list.filter((m) => !needle || `${m.title} ${m.source?.title || ""}`.toLowerCase().includes(needle));
    viewEl.innerHTML = `
      <div class="stl-head">
        <div>
          <h1 class="nbx-h1">Presentations <span class="nbx-count">${list.length}</span></h1>
          <p class="stl-sub">Slide decks you're editing, saved on this computer${list.length ? ` · ${size(total)}` : ""}. Nothing is uploaded.</p>
        </div>
        <button type="button" class="nbx-primary" data-pres="new">Open a deck</button>
      </div>
      ${list.length > 4 ? `<div class="stl-tools"><label class="stl-search"><input type="search" placeholder="Search presentations" value="${esc(query)}" data-pres="search" aria-label="Search presentations"></label></div>` : ""}
      ${list.length ? `<div class="pres-grid">${shown.map((m) => `
        <article class="pres-card" data-id="${esc(m.id)}">
          <button type="button" class="pres-thumb" data-pres="open" title="Open in the slide editor">${m.thumb ? `<img src="${m.thumb}" alt="">` : ""}</button>
          <div class="pres-body">
            <p class="pres-title" title="${esc(m.title)}">${esc(m.title)}</p>
            <p class="pres-meta">${m.slideCount} slide${m.slideCount === 1 ? "" : "s"} · edited ${ago(m.updatedAt)}${m.bytes ? ` · ${size(m.bytes)}` : ""}</p>
            ${m.source?.notebookId ? `<p class="pres-src">From NotebookLM${m.source.title && m.source.title !== m.title ? ` · ${esc(m.source.title)}` : ""}</p>` : ""}
          </div>
          <div class="pres-actions">
            <button type="button" class="pres-btn is-primary" data-pres="open">Open</button>
            <button type="button" class="pres-btn" data-pres="rename">Rename</button>
            <button type="button" class="pres-btn is-danger" data-pres="delete">Delete</button>
          </div>
        </article>`).join("") || '<p class="stl-status">No presentation matches.</p>'}</div>`
        : `<div class="stl-empty"><p>No presentations yet. Open a slide deck from a notebook's Studio panel with <b>Edit</b>, or open a PDF in the slide editor. Your edits are saved here as you go.</p><button type="button" class="nbx-primary" data-pres="new">Open a deck</button></div>`}`;
  }

  function bind() {
    viewEl.addEventListener("click", async (event) => {
      const btn = event.target.closest("[data-pres]");
      if (!btn) return;
      const act = btn.dataset.pres;
      const card = btn.closest(".pres-card");
      const id = card?.dataset.id;
      if (act === "new") return void chrome.tabs.create({ url: editorUrl("") });
      if (!id) return;
      if (act === "open") return void chrome.tabs.create({ url: editorUrl(`deck=${encodeURIComponent(id)}`) });
      if (act === "rename") {
        const current = card.querySelector(".pres-title")?.textContent || "";
        const name = prompt("Rename presentation", current);
        if (name && name.trim() && name.trim() !== current) { await window.NTDeckStore.rename(id, name.trim()); void render(); }
        return;
      }
      if (act === "delete") {
        const name = card.querySelector(".pres-title")?.textContent || "this presentation";
        if (!confirm(`Delete “${name}” from this computer? Its edits can't be recovered.`)) return;
        await window.NTDeckStore.remove(id);
        void render();
      }
    });
    viewEl.addEventListener("input", (event) => {
      if (event.target.dataset.pres !== "search") return;
      query = event.target.value;
      const pos = event.target.selectionStart;
      void render().then(() => { const input = viewEl.querySelector('[data-pres="search"]'); input?.focus(); input?.setSelectionRange(pos, pos); });
    });
    // Edits saved in the editor show up when you come back to this tab
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !viewEl.hidden) void render(); });
  }

  return {
    open() {
      viewEl ||= document.querySelector("#presentationsView");
      if (!viewEl) return;
      if (!viewEl.dataset.bound) { viewEl.dataset.bound = "1"; bind(); }
      viewEl.hidden = false;
      void render();
    },
    close() {
      (viewEl || document.querySelector("#presentationsView"))?.setAttribute("hidden", "");
    }
  };
})();
