/* ==========================================================================
   Sources library (notebooks page → Sources tab): every source from every
   notebook in one table. Search titles, links and notebook names, filter by
   type or notebook, spot sources that sit in several notebooks, then copy
   links, export CSV or copy sources into another notebook.
   Exposes window.NotebookToolsSourcesLibrary = { open, close }.
   ========================================================================== */
(function () {
  "use strict";

  const CACHE_KEY = "notebooktoolsSourcesIndex";
  const client = () => window.NotebookToolsNotebookLM;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const TYPE_COLORS = { PDF: "#ea4335", Web: "#4285f4", YouTube: "#ff0033", Text: "#9aa0a6", Doc: "#4285f4", Slides: "#f4b400", Sheets: "#0f9d58", Markdown: "#9aa0a6", Media: "#a142f4", Word: "#2b579a", Image: "#24c1e0", CSV: "#0f9d58", EPUB: "#ff8a00" };

  let root = null;
  let ctx = null;
  const state = { items: [], scannedAt: 0, scanning: false, query: "", type: "all", notebook: "all", dupesOnly: false, sort: "notebook", selected: new Set(), status: "", working: "" };

  const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (_e) { return ""; } };
  const keyOf = (s) => window.NotebookToolsNotebookMerge?.sourceKey?.(s) || `t:${String(s.title || "").toLowerCase()}`;
  const uid = (s) => `${s.notebookId}:${s.id}`;

  /* ---------- Scan ---------- */
  async function loadCache() {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    const entry = stored[CACHE_KEY];
    const account = ctx.authOptions?.authUser || "default";
    state.items = entry && entry.account === account ? entry.items || [] : [];
    state.scannedAt = entry && entry.account === account ? entry.at || 0 : 0;
    markDupes();
  }

  async function saveCache() {
    await chrome.storage.local.set({ [CACHE_KEY]: { account: ctx.authOptions?.authUser || "default", at: state.scannedAt, items: state.items } });
  }

  // How many notebooks each source appears in.
  function markDupes() {
    const counts = new Map();
    state.items.forEach((s) => {
      const k = keyOf(s);
      if (!counts.has(k)) counts.set(k, new Set());
      counts.get(k).add(s.notebookId);
    });
    state.items.forEach((s) => { s.inNotebooks = counts.get(keyOf(s))?.size || 1; });
  }

  async function scan() {
    if (state.scanning || !ctx) return;
    state.scanning = true;
    state.selected = new Set();
    const notebooks = ctx.notebooks.filter((n) => n.id);
    const found = [];
    let done = 0;
    let failed = 0;
    const work = [...notebooks];
    const worker = async () => {
      while (work.length) {
        const nb = work.shift();
        try {
          const sources = await client().listNotebookLmSources(nb.id, ctx.authOptions);
          sources.forEach((s) => found.push({
            id: s.id, title: s.title || "Untitled", type: s.type || "Other", typeCode: s.typeCode, url: s.url || "", youtubeVideoId: s.youtubeVideoId || "",
            notebookId: nb.id, notebookTitle: nb.title || "Untitled notebook"
          }));
        } catch (_error) {
          failed += 1;
        }
        done += 1;
        state.working = `Scanning notebooks… ${done} of ${notebooks.length}`;
        if (done % 4 === 0 || done === notebooks.length) {
          state.items = [...found];
          markDupes();
          render();
        }
      }
    };
    state.working = `Scanning notebooks… 0 of ${notebooks.length}`;
    render();
    await Promise.all(Array.from({ length: Math.min(4, notebooks.length) }, worker));
    state.items = found;
    markDupes();
    state.scannedAt = Date.now();
    state.scanning = false;
    state.working = "";
    const dupes = new Set(found.filter((s) => s.inNotebooks > 1).map(keyOf)).size;
    state.status = `Found ${found.length} sources in ${notebooks.length} notebooks${dupes ? ` · ${dupes} appear in more than one notebook` : ""}${failed ? ` · ${failed} notebooks couldn't be read` : ""}.`;
    await saveCache();
    render();
  }

  /* ---------- Filter ---------- */
  function visible() {
    const words = state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = state.items.filter((s) => {
      if (state.type !== "all" && s.type !== state.type) return false;
      if (state.notebook !== "all" && s.notebookId !== state.notebook) return false;
      if (state.dupesOnly && s.inNotebooks < 2) return false;
      if (words.length) {
        const hay = `${s.title} ${s.url} ${s.notebookTitle} ${s.type}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const by = {
      notebook: (a, b) => a.notebookTitle.localeCompare(b.notebookTitle) || a.title.localeCompare(b.title),
      title: (a, b) => a.title.localeCompare(b.title) || a.notebookTitle.localeCompare(b.notebookTitle),
      type: (a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title),
      dupes: (a, b) => b.inNotebooks - a.inNotebooks || keyOf(a).localeCompare(keyOf(b))
    };
    return list.sort(by[state.dupesOnly ? "dupes" : state.sort] || by.notebook);
  }

  /* ---------- Actions ---------- */
  const chosen = () => state.items.filter((s) => state.selected.has(uid(s)));

  async function copyLinks() {
    const links = [...new Set(chosen().map((s) => s.url).filter(Boolean))];
    if (!links.length) { state.status = "None of the selected sources has a link (PDFs and pasted text don't)."; return render(); }
    await navigator.clipboard.writeText(links.join("\n"));
    state.status = `Copied ${links.length} link${links.length === 1 ? "" : "s"}. Paste them into NotebookTools bulk import or anywhere else.`;
    render();
  }

  function exportCsv() {
    const rows = [["Title", "Type", "Link", "Notebook", "In notebooks"], ...chosen().map((s) => [s.title, s.type, s.url, s.notebookTitle, s.inNotebooks])];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `notebooklm-sources-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    state.status = `Exported ${rows.length - 1} sources as CSV.`;
    render();
  }

  async function copyTo(targetId) {
    const target = ctx.notebooks.find((n) => n.id === targetId);
    const items = chosen().filter((s) => s.notebookId !== targetId);
    if (!target || !items.length) return;
    const existing = await client().listNotebookLmSources(targetId, ctx.authOptions).catch(() => []);
    const have = new Set(existing.map(keyOf));
    const todo = items.filter((s) => !have.has(keyOf(s)));
    const limit = client().NOTEBOOK_SOURCE_LIMIT || 50;
    if (existing.length + todo.length > limit) {
      state.status = `“${target.title}” has ${existing.length} sources; adding ${todo.length} would pass the ${limit}-source limit. Select fewer.`;
      return render();
    }
    let done = 0;
    let failed = 0;
    for (const s of todo) {
      state.working = `Copying ${done + failed + 1} of ${todo.length} into “${target.title}”…`;
      render();
      try {
        await window.NotebookToolsNotebookMerge.copySource(s.notebookId, s, targetId, ctx.authOptions);
        done += 1;
      } catch (_error) {
        failed += 1;
      }
    }
    state.working = "";
    state.status = `Copied ${done} source${done === 1 ? "" : "s"} into “${target.title}”${items.length - todo.length ? `; ${items.length - todo.length} were already there` : ""}${failed ? `; ${failed} failed` : ""}. Rescan to see them here.`;
    render();
  }

  /* ---------- Render ---------- */
  function ago(ts) {
    if (!ts) return "";
    const m = Math.round((Date.now() - ts) / 60000);
    return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
  }

  function notebookUrl(idv) {
    const origin = client()?.getOrigin?.() || "https://notebook.google.com";
    const au = ctx.authOptions?.authUser;
    return `${origin}/notebook/${encodeURIComponent(idv)}${au ? `?authuser=${encodeURIComponent(au)}` : ""}`;
  }

  function highlight(text) {
    const safe = esc(text);
    const words = state.query.trim().split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return words.length ? safe.replace(new RegExp(`(${words.map(esc).join("|")})`, "gi"), "<mark>$1</mark>") : safe;
  }

  function render() {
    if (!root) return;
    const list = visible();
    const counts = new Map();
    state.items.forEach((s) => counts.set(s.type, (counts.get(s.type) || 0) + 1));
    const nbs = new Map();
    state.items.forEach((s) => nbs.set(s.notebookId, s.notebookTitle));
    const dupeCount = state.items.filter((s) => s.inNotebooks > 1).length;
    const allOn = list.length && list.slice(0, 800).every((s) => state.selected.has(uid(s)));
    const busy = Boolean(state.working) || state.scanning;
    const shown = list.slice(0, 800);

    root.innerHTML = `
      <div class="stl-head">
        <div>
          <h1 class="nbx-h1">All sources <span class="nbx-count">${state.items.length}</span></h1>
          <p class="stl-sub">${state.scannedAt ? `Every source in your ${nbs.size} notebooks with sources · scanned ${ago(state.scannedAt)}` : "Scan your notebooks to search every source in one place."}</p>
        </div>
        <button type="button" class="nbx-primary" data-sl="scan"${state.scanning ? " disabled" : ""}>${state.scanning ? "Scanning…" : state.scannedAt ? "Rescan notebooks" : "Scan notebooks"}</button>
      </div>
      <div class="stl-tools">
        <label class="stl-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></svg><input type="search" data-sl-input="query" placeholder="Search source titles, links and notebooks" value="${esc(state.query)}" aria-label="Search sources"></label>
        <select data-sl-input="notebook" aria-label="Notebook"><option value="all">All notebooks (${nbs.size})</option>${[...nbs.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([idv, t]) => `<option value="${esc(idv)}"${state.notebook === idv ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <select data-sl-input="sort" aria-label="Sort"${state.dupesOnly ? " disabled" : ""}><option value="notebook"${state.sort === "notebook" ? " selected" : ""}>Sort: notebook</option><option value="title"${state.sort === "title" ? " selected" : ""}>Sort: title</option><option value="type"${state.sort === "type" ? " selected" : ""}>Sort: type</option></select>
      </div>
      <div class="stl-types" role="tablist" aria-label="Source type">
        <button type="button" class="stl-type${state.type === "all" && !state.dupesOnly ? " is-on" : ""}" data-type="all">All <b>${state.items.length}</b></button>
        ${[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `<button type="button" class="stl-type${state.type === t ? " is-on" : ""}" data-type="${esc(t)}"><i class="sl-dot" style="background:${TYPE_COLORS[t] || "#9aa0a6"}"></i>${esc(t)} <b>${n}</b></button>`).join("")}
        ${dupeCount ? `<button type="button" class="stl-type sl-dupe-chip${state.dupesOnly ? " is-on" : ""}" data-dupes>In several notebooks <b>${dupeCount}</b></button>` : ""}
      </div>
      <div class="stl-bulk"${state.selected.size ? "" : " hidden"}>
        <span>${state.selected.size} selected</span>
        <button type="button" class="nbx-bulk-btn" data-sl="links"${busy ? " disabled" : ""}>Copy links</button>
        <button type="button" class="nbx-bulk-btn" data-sl="csv"${busy ? " disabled" : ""}>Export CSV</button>
        <select class="sl-copy-to" data-sl-input="copyto"${busy ? " disabled" : ""} aria-label="Copy to notebook"><option value="">Copy to notebook…</option>${ctx.notebooks.slice().sort((a, b) => String(a.title).localeCompare(String(b.title))).map((n) => `<option value="${esc(n.id)}">${esc(n.title || "Untitled notebook")}</option>`).join("")}</select>
        <button type="button" class="nbx-bulk-btn is-ghost" data-sl="clear">Clear</button>
      </div>
      <p class="stl-status"${state.working || state.status ? "" : " hidden"}>${esc(state.working || state.status)}</p>
      ${!state.items.length && !state.scanning ? `<div class="stl-empty">${state.scannedAt ? "No sources found." : `<p>Search every source across all ${ctx.notebooks.length} notebooks by title, link or notebook name. Find where a paper, video or page lives, and which sources you've added to more than one notebook.</p><button type="button" class="nbx-primary" data-sl="scan">Scan notebooks</button>`}</div>` : ""}
      ${shown.length ? `
        <div class="nbx-table-wrap"><table class="nbx-table stl-table sl-table">
          <thead><tr>
            <th class="nbx-col-check"><input type="checkbox" class="stl-check" data-sl-all${allOn ? " checked" : ""} aria-label="Select all shown"></th>
            <th class="stl-col-name">Source</th><th class="stl-col-nb">Notebook</th><th class="sl-col-type">Type</th><th class="sl-col-act"><span class="nbx-sr">Actions</span></th>
          </tr></thead>
          <tbody>${shown.map((s) => `
            <tr class="nbx-row${state.selected.has(uid(s)) ? " is-selected" : ""}">
              <td class="nbx-col-check"><input type="checkbox" class="stl-check" data-pick="${esc(uid(s))}"${state.selected.has(uid(s)) ? " checked" : ""} aria-label="Select"></td>
              <td><div class="sl-name"><span class="stl-title" title="${esc(s.title)}">${highlight(s.title)}</span>${s.url ? `<span class="sl-host" title="${esc(s.url)}">${highlight(host(s.url))}</span>` : ""}</div></td>
              <td><button type="button" class="stl-nb" data-open-nb="${esc(s.notebookId)}" title="Open this notebook">${highlight(s.notebookTitle)}</button>${s.inNotebooks > 1 ? `<span class="sl-in" title="This source is in ${s.inNotebooks} notebooks">+${s.inNotebooks - 1}</span>` : ""}</td>
              <td><span class="sl-type"><i class="sl-dot" style="background:${TYPE_COLORS[s.type] || "#9aa0a6"}"></i>${esc(s.type)}</span></td>
              <td class="sl-col-act">
                ${s.url ? `<a class="stl-open" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="Open the source link" aria-label="Open the source link"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/></svg></a>` : ""}
                <a class="stl-open" href="${notebookUrl(s.notebookId)}" target="_blank" rel="noopener noreferrer" title="Open the notebook in NotebookLM" aria-label="Open the notebook in NotebookLM"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-8 8"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg></a>
              </td>
            </tr>`).join("")}</tbody>
        </table></div>
        ${list.length > shown.length ? `<p class="stl-status">Showing ${shown.length} of ${list.length}. Search or filter to narrow it down.</p>` : ""}` : state.items.length ? `<div class="stl-empty">No sources match.</div>` : ""}`;
  }

  function bind() {
    root.addEventListener("click", (event) => {
      const t = event.target.closest("button");
      if (!t) return;
      if (t.dataset.sl === "scan") return void scan();
      if (t.dataset.type) { state.type = t.dataset.type; state.dupesOnly = false; return render(); }
      if ("dupes" in t.dataset) { state.dupesOnly = !state.dupesOnly; state.type = "all"; return render(); }
      if (t.dataset.openNb) { const nb = ctx.notebooks.find((n) => n.id === t.dataset.openNb); if (nb) ctx.onOpenNotebook?.(nb); return; }
      if (t.dataset.sl === "clear") { state.selected = new Set(); return render(); }
      if (t.dataset.sl === "links") return void copyLinks();
      if (t.dataset.sl === "csv") return exportCsv();
    });
    root.addEventListener("change", (event) => {
      const t = event.target;
      if (t.dataset.pick) { t.checked ? state.selected.add(t.dataset.pick) : state.selected.delete(t.dataset.pick); return render(); }
      if (t.matches("[data-sl-all]")) { visible().slice(0, 800).forEach((s) => (t.checked ? state.selected.add(uid(s)) : state.selected.delete(uid(s)))); return render(); }
      if (t.dataset.slInput === "copyto" && t.value) return void copyTo(t.value);
      if (t.dataset.slInput === "notebook" || t.dataset.slInput === "sort") { state[t.dataset.slInput] = t.value; render(); }
    });
    let timer = 0;
    root.addEventListener("input", (event) => {
      if (event.target.dataset.slInput !== "query") return;
      state.query = event.target.value;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const pos = event.target.selectionStart;
        render();
        const input = root.querySelector('[data-sl-input="query"]');
        input.focus();
        input.setSelectionRange(pos, pos);
      }, 120);
    });
  }

  async function open(options) {
    ctx = options;
    root = document.querySelector("#sourcesLibraryView");
    if (!root) return;
    root.hidden = false;
    if (!root.dataset.bound) { bind(); root.dataset.bound = "1"; }
    await loadCache();
    render();
  }

  function close() {
    if (root) root.hidden = true;
  }

  window.NotebookToolsSourcesLibrary = { open, close };
})();
