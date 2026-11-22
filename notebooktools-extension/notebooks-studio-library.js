/* ==========================================================================
   Studio library (notebooks page → Studio tab): every Studio file from every
   notebook in one table. Search, filter by type and notebook, download one,
   or select many and download a ZIP (one folder per notebook).
   Exposes window.NotebookToolsStudioLibrary = { open, close }.
   ========================================================================== */
(function () {
  "use strict";

  const CACHE_KEY = "notebooktoolsStudioIndex";
  const client = () => window.NotebookToolsNotebookLM;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const TYPES = {
    Audio: ["#7aa7f5", '<path d="M5 10v4M9 7v10M13 4v16M17 8v8"/>'],
    Video: ["#5bb974", '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10.5 5-3v9l-5-3"/>'],
    "Slide deck": ["#f0717f", '<rect x="3" y="5" width="18" height="13" rx="2"/><path d="M7 5v13"/>'],
    Report: ["#c58af9", '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none"/>'],
    Quiz: ["#4ecde6", '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9.6 9.5a2.4 2.4 0 1 1 3.4 2.2c-.6.3-1 .9-1 1.6M12 16.4h.01"/>'],
    Flashcards: ["#f4c430", '<rect x="4" y="7" width="12" height="13" rx="2.5"/><path d="M8 4h9a3 3 0 0 1 3 3v10"/>'],
    Infographic: ["#f4a330", '<path d="M5 20V11M10 20V5M15 20v-6M20 20V9"/>'],
    "Mind map": ["#a78bfa", '<rect x="3" y="9.5" width="6" height="5" rx="1.2"/><rect x="15" y="3.5" width="6" height="5" rx="1.2"/><rect x="15" y="15.5" width="6" height="5" rx="1.2"/><path d="M9 12h3M12 6v12M12 6h3M12 18h3"/>'],
    "Data table": ["#34a853", '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M10 9.5v10"/>']
  };
  const icon = (type, size = 18) => {
    const [color, path] = TYPES[type] || ["#9aa0a6", '<rect x="4" y="4" width="16" height="16" rx="3"/>'];
    return `<span class="stl-ico" style="--fc:${color}"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg></span>`;
  };

  let root = null;
  let ctx = null; // { notebooks, authOptions, onOpenNotebook }
  const state = { items: [], scannedAt: 0, scanning: false, query: "", type: "all", notebook: "all", sort: "notebook", selected: new Set(), status: "", working: "" };

  /* ---------- Scan ---------- */
  async function loadCache() {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    const entry = stored[CACHE_KEY];
    const account = ctx.authOptions?.authUser || "default";
    if (entry && entry.account === account) {
      state.items = entry.items || [];
      state.scannedAt = entry.at || 0;
    } else {
      state.items = [];
      state.scannedAt = 0;
    }
  }

  async function saveCache() {
    await chrome.storage.local.set({ [CACHE_KEY]: { account: ctx.authOptions?.authUser || "default", at: state.scannedAt, items: state.items } });
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
      while (work.length && root) {
        const nb = work.shift();
        try {
          const artifacts = await client().listNotebookLmArtifacts(nb.id, ctx.authOptions);
          artifacts.forEach((a) => found.push({ ...a, notebookId: nb.id, notebookTitle: nb.title || "Untitled notebook" }));
        } catch (_error) {
          failed += 1;
        }
        done += 1;
        state.working = `Scanning notebooks… ${done} of ${notebooks.length}`;
        if (done % 3 === 0 || done === notebooks.length) {
          state.items = [...found];
          render();
        }
      }
    };
    state.working = `Scanning notebooks… 0 of ${notebooks.length}`;
    render();
    await Promise.all(Array.from({ length: Math.min(4, notebooks.length) }, worker));
    state.items = found;
    state.scannedAt = Date.now();
    state.scanning = false;
    state.working = "";
    state.status = `Found ${found.length} Studio file${found.length === 1 ? "" : "s"} in ${notebooks.length} notebooks${failed ? ` (${failed} couldn't be read)` : ""}.`;
    await saveCache();
    render();
  }

  /* ---------- Filter ---------- */
  function visible() {
    const q = state.query.trim().toLowerCase();
    const list = state.items.filter((a) => {
      if (state.type !== "all" && a.type !== state.type) return false;
      if (state.notebook !== "all" && a.notebookId !== state.notebook) return false;
      if (q && !`${a.title} ${a.notebookTitle} ${a.type}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const by = {
      notebook: (a, b) => a.notebookTitle.localeCompare(b.notebookTitle) || a.type.localeCompare(b.type) || a.title.localeCompare(b.title),
      type: (a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title),
      title: (a, b) => a.title.localeCompare(b.title)
    };
    return list.sort(by[state.sort] || by.notebook);
  }

  /* ---------- Download ---------- */
  const EXT = { "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/webm": "webm", "video/mp4": "mp4", "video/webm": "webm", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx", "text/html": "html" };
  const safe = (s) => String(s || "file").replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 90) || "file";

  async function fetchBlob(url) {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    return response.blob();
  }

  function longestString(value, best = "") {
    if (typeof value === "string") return value.length > best.length ? value : best;
    if (Array.isArray(value)) for (const v of value) best = longestString(v, best);
    return best;
  }

  // Returns [{ name, blob }] for one Studio file. format: "pdf" | "pptx" for slide decks.
  async function filesFor(item, format = "pdf") {
    const base = safe(item.title);
    const api = client();
    if (item.type === "Slide deck") {
      const deck = await api.getNotebookLmSlideDeck(item.notebookId, item.id, ctx.authOptions);
      const url = format === "pptx" ? deck?.pptxUrl || deck?.pdfUrl : deck?.pdfUrl || deck?.pptxUrl;
      if (!url) throw new Error("This slide deck has no download yet.");
      const blob = await fetchBlob(url);
      return [{ name: `${base}.${EXT[blob.type.split(";")[0]] || (url === deck.pptxUrl ? "pptx" : "pdf")}`, blob }];
    }
    const url = item.downloadUrl || item.mediaUrl;
    if (url && ["Audio", "Video", "Infographic"].includes(item.type)) {
      const blob = await fetchBlob(url);
      const fallback = item.type === "Audio" ? "m4a" : item.type === "Video" ? "mp4" : "png";
      return [{ name: `${base}.${EXT[blob.type.split(";")[0]] || fallback}`, blob }];
    }
    // Reports, quizzes, flashcards, tables, mind maps: interactive HTML or text.
    let html = "";
    try { html = await api.getNotebookLmArtifactHtml(item.notebookId, item.id, ctx.authOptions); } catch (_e) { /* fall back */ }
    if (html && html.length > 50) {
      return [{ name: `${base}.html`, blob: new Blob([html], { type: "text/html" }) }];
    }
    const records = await api.listNotebookLmArtifactRecords(item.notebookId, ctx.authOptions);
    const record = records.find((r) => String(r[0] || "") === item.id);
    const text = longestString(record).trim();
    if (text.length < 40) throw new Error("No downloadable content for this file.");
    return [{ name: `${base}.md`, blob: new Blob([`# ${item.title}\n\n${text}\n`], { type: "text/markdown" }) }];
  }

  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function downloadOne(item, format) {
    state.working = `Downloading “${item.title}”…`;
    render();
    try {
      const [file] = await filesFor(item, format);
      saveBlob(file.blob, file.name);
      state.status = `Downloaded ${file.name}.`;
    } catch (error) {
      state.status = `${item.title}: ${error.message || "download failed"}`;
    }
    state.working = "";
    render();
  }

  async function downloadZip(items) {
    const files = [];
    const used = new Set();
    let failed = 0;
    let bytes = 0;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      state.working = `Preparing ${i + 1} of ${items.length}: ${item.title}…`;
      render();
      try {
        for (const f of await filesFor(item)) {
          let name = `${safe(item.notebookTitle)}/${f.name}`;
          for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${safe(item.notebookTitle)}/${f.name.replace(/(\.[^.]+)$/, ` (${n})$1`)}`;
          used.add(name.toLowerCase());
          const data = new Uint8Array(await f.blob.arrayBuffer());
          bytes += data.length;
          files.push({ name, data });
        }
      } catch (_error) {
        failed += 1;
      }
    }
    state.working = "Building ZIP…";
    render();
    if (files.length) {
      const zip = window.NotebookToolsNotebookExport.buildZip(files);
      saveBlob(zip, `notebooklm-studio-files-${new Date().toISOString().slice(0, 10)}.zip`);
    }
    state.working = "";
    state.status = `Downloaded ${files.length} file${files.length === 1 ? "" : "s"} (${(bytes / 1048576).toFixed(1)} MB) as a ZIP${failed ? `; ${failed} couldn't be downloaded` : ""}.`;
    render();
  }

  /* ---------- Render ---------- */
  function ago(ts) {
    if (!ts) return "";
    const m = Math.round((Date.now() - ts) / 60000);
    return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
  }

  function render() {
    if (!root) return;
    const list = visible();
    const counts = new Map();
    state.items.forEach((a) => counts.set(a.type, (counts.get(a.type) || 0) + 1));
    const nbWith = new Map();
    state.items.forEach((a) => nbWith.set(a.notebookId, a.notebookTitle));
    const selectedVisible = list.filter((a) => state.selected.has(a.id));
    const allOn = list.length && selectedVisible.length === list.length;
    const busy = Boolean(state.working) || state.scanning;

    root.innerHTML = `
      <div class="stl-head">
        <div>
          <h1 class="nbx-h1">Studio files <span class="nbx-count">${state.items.length}</span></h1>
          <p class="stl-sub">${state.scannedAt ? `Every Audio Overview, video, slide deck, report and more across your notebooks · scanned ${ago(state.scannedAt)}` : "Scan your notebooks to list every Studio file in one place."}</p>
        </div>
        <button type="button" class="nbx-primary" data-stl="scan"${state.scanning ? " disabled" : ""}>${state.scanning ? "Scanning…" : state.scannedAt ? "Rescan notebooks" : "Scan notebooks"}</button>
      </div>
      <div class="stl-tools">
        <label class="stl-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></svg><input type="search" data-stl-input="query" placeholder="Search Studio files and notebooks" value="${esc(state.query)}" aria-label="Search Studio files"></label>
        <select data-stl-input="notebook" aria-label="Notebook"><option value="all">All notebooks (${nbWith.size})</option>${[...nbWith.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([idv, t]) => `<option value="${esc(idv)}"${state.notebook === idv ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <select data-stl-input="sort" aria-label="Sort"><option value="notebook"${state.sort === "notebook" ? " selected" : ""}>Sort: notebook</option><option value="type"${state.sort === "type" ? " selected" : ""}>Sort: type</option><option value="title"${state.sort === "title" ? " selected" : ""}>Sort: title</option></select>
      </div>
      <div class="stl-types" role="tablist" aria-label="File type">
        <button type="button" class="stl-type${state.type === "all" ? " is-on" : ""}" data-type="all">All <b>${state.items.length}</b></button>
        ${[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `<button type="button" class="stl-type${state.type === t ? " is-on" : ""}" data-type="${esc(t)}">${icon(t, 15)}${esc(t)} <b>${n}</b></button>`).join("")}
      </div>
      <div class="stl-bulk"${state.selected.size ? "" : " hidden"}>
        <span>${state.selected.size} selected</span>
        <button type="button" class="nbx-bulk-btn" data-stl="zip"${busy ? " disabled" : ""}>Download ZIP</button>
        <button type="button" class="nbx-bulk-btn" data-stl="each"${busy ? " disabled" : ""}>Download separately</button>
        <button type="button" class="nbx-bulk-btn is-ghost" data-stl="clear">Clear</button>
      </div>
      <p class="stl-status"${state.working || state.status ? "" : " hidden"}>${esc(state.working || state.status)}</p>
      ${!state.items.length && !state.scanning ? `<div class="stl-empty">${state.scannedAt ? "No Studio files yet. Create Audio Overviews, slide decks or reports in NotebookLM's Studio panel." : `<p>Find any Audio Overview, video, slide deck, infographic, report or quiz across all ${ctx.notebooks.length} notebooks, and download them, one by one or in bulk.</p><button type="button" class="nbx-primary" data-stl="scan">Scan notebooks</button>`}</div>` : ""}
      ${list.length ? `
        <div class="nbx-table-wrap"><table class="nbx-table stl-table">
          <thead><tr>
            <th class="nbx-col-check"><input type="checkbox" class="stl-check" data-stl-all${allOn ? " checked" : ""} aria-label="Select all"></th>
            <th class="stl-col-name">Name</th><th class="stl-col-nb">Notebook</th><th class="stl-col-type">Type</th><th class="stl-col-dl"><span class="nbx-sr">Download</span></th>
          </tr></thead>
          <tbody>${list.slice(0, 600).map((a) => `
            <tr class="nbx-row${state.selected.has(a.id) ? " is-selected" : ""}" data-id="${esc(a.id)}">
              <td class="nbx-col-check"><input type="checkbox" class="stl-check" data-pick="${esc(a.id)}"${state.selected.has(a.id) ? " checked" : ""} aria-label="Select"></td>
              <td><div class="stl-name">${icon(a.type)}<span class="stl-title" title="${esc(a.title)}">${esc(a.title)}</span>${a.status && a.status !== "ready" ? `<span class="stl-badge">${/fail|error/i.test(a.status) ? "Failed" : "Generating"}</span>` : ""}</div></td>
              <td><button type="button" class="stl-nb" data-open-nb="${esc(a.notebookId)}" title="Open this notebook">${esc(a.notebookTitle)}</button></td>
              <td class="stl-meta">${esc(a.type)}${a.duration ? ` · ${esc(a.duration)}` : ""}</td>
              <td class="stl-col-dl">
                ${a.type === "Slide deck" ? `<button type="button" class="stl-dl stl-edit" data-edit="${esc(a.id)}" title="Edit in the NotebookTools slide editor: editable text and pictures, export PowerPoint">Edit</button><button type="button" class="stl-dl" data-dl="${esc(a.id)}" data-format="pdf">PDF</button><button type="button" class="stl-dl" data-dl="${esc(a.id)}" data-format="pptx">PPTX</button>` : `<button type="button" class="stl-dl" data-dl="${esc(a.id)}"${a.status && a.status !== "ready" ? " disabled" : ""}>Download</button>`}
                <a class="stl-open" href="${notebookUrl(a.notebookId)}" target="_blank" rel="noopener noreferrer" title="Open in NotebookLM" aria-label="Open in NotebookLM"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-8 8"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg></a>
              </td>
            </tr>`).join("")}</tbody>
        </table></div>
        ${list.length > 600 ? `<p class="stl-status">Showing 600 of ${list.length}. Search or filter to narrow it down.</p>` : ""}` : state.items.length ? `<div class="stl-empty">No Studio files match.</div>` : ""}`;
  }

  function notebookUrl(idv) {
    const origin = client()?.getOrigin?.() || "https://notebook.google.com";
    const au = ctx.authOptions?.authUser;
    return `${origin}/notebook/${encodeURIComponent(idv)}${au ? `?authuser=${encodeURIComponent(au)}` : ""}`;
  }

  function bind() {
    root.addEventListener("click", async (event) => {
      const t = event.target.closest("button, input");
      if (!t) return;
      if (t.dataset.stl === "scan") return void scan();
      if (t.dataset.type) { state.type = t.dataset.type; return render(); }
      if (t.dataset.openNb) { const nb = ctx.notebooks.find((n) => n.id === t.dataset.openNb); if (nb) ctx.onOpenNotebook?.(nb); return; }
      if (t.dataset.edit) {
        const item = state.items.find((a) => a.id === t.dataset.edit);
        if (!item) return;
        const params = new URLSearchParams({ notebook: item.notebookId, artifact: item.id, title: item.title });
        if (ctx.authOptions?.authUser) params.set("authuser", ctx.authOptions.authUser);
        chrome.tabs.create({ url: chrome.runtime.getURL(`slide-editor.html?${params}`) });
        return;
      }
      if (t.dataset.dl) { const item = state.items.find((a) => a.id === t.dataset.dl); if (item) void downloadOne(item, t.dataset.format); return; }
      if (t.dataset.stl === "clear") { state.selected = new Set(); return render(); }
      const chosen = () => state.items.filter((a) => state.selected.has(a.id));
      if (t.dataset.stl === "zip") return void downloadZip(chosen());
      if (t.dataset.stl === "each") {
        for (const item of chosen()) await downloadOne(item);
        return;
      }
    });
    root.addEventListener("change", (event) => {
      const t = event.target;
      if (t.dataset.pick) { t.checked ? state.selected.add(t.dataset.pick) : state.selected.delete(t.dataset.pick); return render(); }
      if (t.matches("[data-stl-all]")) { visible().forEach((a) => (t.checked ? state.selected.add(a.id) : state.selected.delete(a.id))); return render(); }
      if (t.dataset.stlInput === "notebook" || t.dataset.stlInput === "sort") { state[t.dataset.stlInput] = t.value; render(); }
    });
    root.addEventListener("input", (event) => {
      if (event.target.dataset.stlInput !== "query") return;
      state.query = event.target.value;
      const pos = event.target.selectionStart;
      render();
      const input = root.querySelector('[data-stl-input="query"]');
      input.focus();
      input.setSelectionRange(pos, pos);
    });
  }

  async function open(options) {
    ctx = options;
    root = document.querySelector("#studioLibraryView");
    if (!root) return;
    root.hidden = false;
    if (!root.dataset.bound) { bind(); root.dataset.bound = "1"; }
    await loadCache();
    render();
  }

  function close() {
    if (root) root.hidden = true;
  }

  window.NotebookToolsStudioLibrary = { open, close, filesFor };
})();
