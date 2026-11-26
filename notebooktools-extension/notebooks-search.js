/* ==========================================================================
   Search everything (notebooks page): the search box finds notebooks by name
   as before, and also searches inside every notebook: source titles and links,
   notes (title and text) and Studio files. Results sit above the notebooks
   table, grouped by kind; a click opens that notebook on the right tab.
   The index is built on request (one pass over the notebooks, a few at a time),
   kept on this computer, and refreshed with one click. It also fills the
   Sources tab's list so that opens instantly.
   Exposes window.NotebookToolsSearch = { attach }.
   ========================================================================== */
(function () {
  "use strict";

  const INDEX_KEY = "notebooktoolsSearchIndex";
  const SOURCES_KEY = "notebooktoolsSourcesIndex"; // the Sources tab's cache
  const NOTE_CHARS = 6000; // enough of each note to search; long notes are cut
  const PER_GROUP = 5;
  const client = () => window.NotebookToolsNotebookLM;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  let opts = null; // { input, mount, getNotebooks, getAuthOptions, openNotebook }
  let box = null;
  const state = { index: null, account: "", scanning: false, progress: "", query: "", expanded: new Set(), failed: 0 };

  /* ---------- Index ---------- */
  const accountKey = () => opts.getAuthOptions()?.authUser || "default";

  async function loadIndex() {
    state.account = accountKey();
    try {
      const stored = (await chrome.storage.local.get(INDEX_KEY))[INDEX_KEY];
      state.index = stored && stored.account === state.account ? stored : null;
    } catch (_error) {
      state.index = null;
    }
  }

  async function build() {
    if (state.scanning) return;
    const notebooks = (opts.getNotebooks() || []).filter((n) => n && n.id);
    if (!notebooks.length || !client()) return;
    const auth = opts.getAuthOptions();
    state.scanning = true;
    state.failed = 0;
    const next = { account: state.account, at: 0, notebooks: notebooks.length, sources: [], notes: [], studio: [] };
    const work = [...notebooks];
    let done = 0;
    const one = async (nb) => {
      const where = { notebookId: nb.id, notebookTitle: nb.title || "Untitled notebook" };
      const [sources, notes, studio] = await Promise.allSettled([
        client().listNotebookLmSources(nb.id, auth),
        client().listNotebookLmNotes(nb.id, auth),
        client().listNotebookLmArtifacts(nb.id, auth)
      ]);
      if (sources.status === "fulfilled") sources.value.forEach((s) => next.sources.push({ id: s.id, title: s.title || "Untitled", type: s.type || "Other", typeCode: s.typeCode, url: s.url || "", youtubeVideoId: s.youtubeVideoId || "", ...where }));
      if (notes.status === "fulfilled") notes.value.forEach((n) => next.notes.push({ id: n.id, title: n.title || "Untitled", body: String(n.body || "").replace(/\s+/g, " ").slice(0, NOTE_CHARS), ...where }));
      if (studio.status === "fulfilled") studio.value.forEach((a) => next.studio.push({ id: a.id, title: a.title || "Untitled", type: a.type || "Studio file", ...where }));
      if ([sources, notes, studio].every((r) => r.status === "rejected")) state.failed += 1;
    };
    const worker = async () => {
      while (work.length && opts) {
        const nb = work.shift();
        try { await one(nb); } catch (_error) { state.failed += 1; }
        done += 1;
        state.progress = `Reading notebooks… ${done} of ${notebooks.length}`;
        if (done % 3 === 0 || done === notebooks.length) { state.index = { ...next, partial: done < notebooks.length }; render(); }
      }
    };
    state.progress = `Reading notebooks… 0 of ${notebooks.length}`;
    render();
    // a few notebooks at a time, so NotebookLM isn't flooded
    await Promise.all(Array.from({ length: Math.min(3, notebooks.length) }, worker));
    next.at = Date.now();
    state.index = next;
    state.scanning = false;
    state.progress = "";
    try {
      await chrome.storage.local.set({
        [INDEX_KEY]: next,
        // the Sources tab reads the same list
        [SOURCES_KEY]: { account: state.account, at: next.at, items: next.sources.map(({ id, title, type, typeCode, url, youtubeVideoId, notebookId, notebookTitle }) => ({ id, title, type, typeCode, url, youtubeVideoId, notebookId, notebookTitle })) }
      });
    } catch (_error) { /* a very large index may not fit; search still works this session */ }
    render();
  }

  /* ---------- Matching ---------- */
  function words(q) {
    return q.toLowerCase().split(/\s+/).filter((w) => w.length >= 1);
  }

  function score(fields, ws) {
    // every word somewhere; matches in the title count most
    const title = fields[0].toLowerCase();
    const rest = fields.slice(1).join(" ").toLowerCase();
    let s = 0;
    for (const w of ws) {
      if (title.includes(w)) s += title.startsWith(w) ? 4 : 3;
      else if (rest.includes(w)) s += 1;
      else return 0;
    }
    return s;
  }

  function search(q) {
    const ws = words(q);
    const ix = state.index;
    if (!ws.length || !ix) return { sources: [], notes: [], studio: [] };
    const rank = (list, fieldsOf) => list.map((item) => ({ item, s: score(fieldsOf(item), ws) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s || a.item.title.localeCompare(b.item.title)).map((r) => r.item);
    return {
      sources: rank(ix.sources || [], (s) => [s.title, s.url, s.type, s.notebookTitle]),
      notes: rank(ix.notes || [], (n) => [n.title, n.body, n.notebookTitle]),
      studio: rank(ix.studio || [], (a) => [a.title, a.type, a.notebookTitle])
    };
  }

  function mark(text, ws) {
    let out = esc(text);
    ws.filter((w) => w.length >= 2).sort((a, b) => b.length - a.length).forEach((w) => {
      out = out.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/&/g, "&amp;").replace(/</g, "&lt;")})`, "gi"), "<mark>$1</mark>");
    });
    return out;
  }

  function snippet(body, ws) {
    if (!body) return "";
    const lower = body.toLowerCase();
    const at = ws.map((w) => lower.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
    if (at === undefined) return body.slice(0, 120) + (body.length > 120 ? "…" : "");
    const from = Math.max(0, at - 50);
    return (from ? "…" : "") + body.slice(from, from + 150) + (from + 150 < body.length ? "…" : "");
  }

  const ago = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return `${d} day${d === 1 ? "" : "s"} ago`;
  };

  /* ---------- Render ---------- */
  const ICONS = {
    sources: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4"/>',
    notes: '<path d="M5 4.5h14v15H5z"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>',
    studio: '<path d="M12 3.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.8l5-.7z"/>'
  };
  const icon = (k) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;
  const GROUPS = [["sources", "Sources"], ["notes", "Notes"], ["studio", "Studio files"]];

  function render() {
    if (!box) return;
    const q = state.query;
    if (q.length < 2) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    const ws = words(q);
    const ix = state.index;
    if (!ix && !state.scanning) {
      const n = (opts.getNotebooks() || []).length;
      box.innerHTML = `
        <div class="nsx-invite">
          <span class="nsx-invite-ic">${icon("sources")}</span>
          <div><p class="nsx-invite-title">Search inside your notebooks too</p><p class="nsx-invite-sub">Find "${esc(q)}" in source titles and links, notes and Studio files across all ${n} notebook${n === 1 ? "" : "s"}. NotebookTools reads each notebook once and keeps the index on this computer.</p></div>
          <button type="button" class="nsx-build" data-nsx="build">Search inside notebooks</button>
        </div>`;
      return;
    }
    const res = search(q);
    const total = res.sources.length + res.notes.length + res.studio.length;
    const status = state.scanning
      ? `<span class="nsx-spin" aria-hidden="true"></span>${esc(state.progress)}`
      : `${total ? `${total} match${total === 1 ? "" : "es"} inside notebooks` : `Nothing inside notebooks matches "${esc(q)}"`} · indexed ${ago(ix.at)}${state.failed ? ` · ${state.failed} notebook${state.failed === 1 ? "" : "s"} couldn't be read` : ""}`;
    const groups = GROUPS.map(([key, label]) => {
      const list = res[key];
      if (!list.length) return "";
      const open = state.expanded.has(key);
      const shown = open ? list.slice(0, 60) : list.slice(0, PER_GROUP);
      const rows = shown.map((it, i) => `
        <li><button type="button" class="nsx-hit" data-nsx="open" data-kind="${key}" data-i="${list.indexOf(it)}">
          <span class="nsx-hit-ic is-${key}">${icon(key)}</span>
          <span class="nsx-hit-main">
            <span class="nsx-hit-title">${mark(it.title, ws)}</span>
            ${key === "notes" && it.body ? `<span class="nsx-hit-snip">${mark(snippet(it.body, ws), ws)}</span>` : ""}
            ${key === "sources" && it.url ? `<span class="nsx-hit-snip">${mark(it.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 80), ws)}</span>` : ""}
          </span>
          <span class="nsx-hit-meta">${key !== "notes" ? `<span class="nsx-type">${esc(it.type)}</span>` : ""}<span class="nsx-nb">${mark(it.notebookTitle, ws)}</span></span>
        </button></li>`).join("");
      const more = list.length > PER_GROUP ? `<button type="button" class="nsx-more" data-nsx="more" data-kind="${key}">${open ? "Show fewer" : `Show all ${list.length}`}</button>` : "";
      return `<section class="nsx-group"><p class="nsx-group-title">${label} <span>${list.length}</span></p><ul class="nsx-list">${rows}</ul>${more}</section>`;
    }).join("");
    box.innerHTML = `
      <div class="nsx-head"><p class="nsx-status">${status}</p>${state.scanning ? "" : `<button type="button" class="nsx-link" data-nsx="build">Update index</button>`}</div>
      ${groups ? `<div class="nsx-groups">${groups}</div>` : ""}`;
    box._res = res;
  }

  function onClick(event) {
    const el = event.target.closest("[data-nsx]");
    if (!el) return;
    if (el.dataset.nsx === "build") return void build();
    if (el.dataset.nsx === "more") {
      const k = el.dataset.kind;
      state.expanded.has(k) ? state.expanded.delete(k) : state.expanded.add(k);
      return render();
    }
    if (el.dataset.nsx === "open") {
      const it = box._res?.[el.dataset.kind]?.[Number(el.dataset.i)];
      if (!it) return;
      const nb = (opts.getNotebooks() || []).find((n) => n.id === it.notebookId) || { id: it.notebookId, title: it.notebookTitle };
      opts.openNotebook(nb, el.dataset.kind === "sources" ? "sources" : el.dataset.kind === "notes" ? "notes" : "studio");
    }
  }

  async function attach(options) {
    opts = options;
    box = document.createElement("section");
    box.className = "nsx";
    box.id = "nbSearchEverything";
    box.hidden = true;
    box.setAttribute("aria-live", "polite");
    box.addEventListener("click", onClick);
    options.mount.after(box);
    await loadIndex();
    const update = () => {
      state.query = (opts.input.value || "").trim();
      state.expanded.clear();
      if (accountKey() !== state.account) loadIndex().then(render);
      else render();
    };
    opts.input.addEventListener("input", update);
    opts.input.addEventListener("search", update);
    update();
  }

  // the page cleared or changed the box itself (Esc, Clear filters)
  function refresh() { if (opts) opts.input.dispatchEvent(new Event("search")); }

  window.NotebookToolsSearch = { attach, refresh, get state() { return state; } };
})();
