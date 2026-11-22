/* ==========================================================================
   Compare, merge and copy sources between notebooks (notebooks page).

   - Compare two notebooks side by side: only in A · in both · only in B.
   - Copy the sources you tick across, either way.
   - Merge: a new notebook with every unique source from both.
   - Import from another notebook: same dialog, with "this notebook" fixed
     on the right.

   NotebookLM has no "copy source" call, so web pages and YouTube videos are
   re-added from their link and everything else (PDFs, Docs, pasted text…)
   is copied as its extracted text. The dialog says so.
   Exposes window.NotebookToolsNotebookMerge = { open }.
   ========================================================================== */
(function () {
  "use strict";

  const client = () => window.NotebookToolsNotebookLM;
  const LIMIT = () => client()?.NOTEBOOK_SOURCE_LIMIT || 50;
  let root = null;
  let state = null;

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function sourceKey(source) {
    if (source.youtubeVideoId) return `yt:${source.youtubeVideoId}`;
    if (source.url) {
      try {
        const u = new URL(source.url.trim());
        return `url:${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}${u.search}`.toLowerCase();
      } catch (_error) {
        return `url:${source.url.trim().toLowerCase()}`;
      }
    }
    return `title:${String(source.title || "").toLowerCase().replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim()}`;
  }

  function howCopied(source) {
    if (source.typeCode === 9 && source.url) return "link";
    if (source.typeCode === 5 && source.url) return "link";
    return "text";
  }

  // Copy one source into a notebook. Returns "link" | "text".
  async function copySource(fromId, source, toId, auth) {
    const api = client();
    if (source.typeCode === 9 && source.url) {
      await api.addYoutubeToNotebookLm(toId, source.url, auth);
      return "link";
    }
    if (source.typeCode === 5 && source.url) {
      await api.addWebpageToNotebookLm(toId, source.url, auth);
      return "link";
    }
    const payload = await api.getNotebookLmSourceContent(fromId, source.id, auth);
    const text = String(payload.content || "").trim();
    if (!text) throw new Error("No text to copy");
    await api.addTextToNotebookLm(toId, source.title || payload.title || "Copied source", text, auth);
    return "text";
  }

  function diff() {
    const a = state.sources.a || [];
    const b = state.sources.b || [];
    const bKeys = new Map(b.map((s) => [sourceKey(s), s]));
    const aKeys = new Set(a.map(sourceKey));
    return {
      onlyA: a.filter((s) => !bKeys.has(sourceKey(s))),
      both: a.filter((s) => bKeys.has(sourceKey(s))),
      onlyB: b.filter((s) => !aKeys.has(sourceKey(s)))
    };
  }

  function notebookTitle(id) {
    return state.notebooks.find((n) => n.id === id)?.title || "Untitled notebook";
  }

  async function loadSide(side) {
    const id = state[side];
    state.sources[side] = null;
    render();
    if (!id) return;
    try {
      const list = await client().listNotebookLmSources(id, state.auth);
      if (state && state[side] === id) state.sources[side] = list;
    } catch (error) {
      if (state) {
        state.sources[side] = [];
        state.note = error.message || "Could not load sources.";
      }
    }
    if (state) {
      state.picked[side] = new Set();
      render();
    }
  }

  function selectHtml(side) {
    const fixed = side === "b" && state.fixedB;
    const options = state.notebooks
      .filter((n) => n.id !== state[side === "a" ? "b" : "a"] || !n.id)
      .map((n) => `<option value="${esc(n.id)}"${n.id === state[side] ? " selected" : ""}>${esc(n.title || "Untitled notebook")}</option>`)
      .join("");
    return fixed
      ? `<div class="ntm-fixed">${esc(notebookTitle(state.b))}<span>This notebook</span></div>`
      : `<select class="ntm-select" data-side="${side}" aria-label="Notebook ${side.toUpperCase()}"><option value="">Choose a notebook…</option>${options}</select>`;
  }

  function list(items, side, pickable) {
    if (!items) return `<p class="ntm-empty">Loading…</p>`;
    if (!items.length) return `<p class="ntm-empty">Nothing here.</p>`;
    const picked = state.picked[side];
    return items.map((s) => `
      <label class="ntm-row${pickable ? "" : " is-static"}${pickable && picked.has(s.id) ? " is-on" : ""}">
        ${pickable ? `<input type="checkbox" data-pick="${side}" value="${esc(s.id)}"${picked.has(s.id) ? " checked" : ""}>` : ""}
        <span class="ntm-type">${esc(s.type || "Other")}</span>
        <span class="ntm-title" title="${esc(s.title)}">${esc(s.title || "Untitled")}</span>
        ${pickable && howCopied(s) === "text" ? `<span class="ntm-as" title="Copied as its extracted text">as text</span>` : ""}
      </label>`).join("");
  }

  function column(title, items, side, pickable) {
    const all = pickable && items?.length && items.every((s) => state.picked[side].has(s.id));
    return `
      <section class="ntm-col">
        <header class="ntm-col-head">
          ${pickable && items?.length ? `<input type="checkbox" data-all="${side}"${all ? " checked" : ""} aria-label="Select all">` : ""}
          <span>${title}</span><b>${items ? items.length : ""}</b>
        </header>
        <div class="ntm-list">${list(items, side, pickable)}</div>
      </section>`;
  }

  function render() {
    if (!root || !state) return;
    const ready = state.a && state.b && state.sources.a && state.sources.b;
    const d = ready ? diff() : null;
    const pickA = state.picked.a.size;
    const pickB = state.picked.b.size;
    const busy = Boolean(state.working);
    const bCount = state.sources.b?.length || 0;
    const aCount = state.sources.a?.length || 0;

    root.querySelector(".ntm-pickers").innerHTML = `
      <div class="ntm-picker"><span class="ntm-tag">A</span>${selectHtml("a")}</div>
      <div class="ntm-picker"><span class="ntm-tag">B</span>${selectHtml("b")}</div>`;
    root.querySelector(".ntm-cols").innerHTML = state.a || state.b
      ? column("Only in A", ready ? d.onlyA : state.a ? state.sources.a : [], "a", true) +
        column("In both", ready ? d.both : [], "both", false) +
        column("Only in B", ready ? d.onlyB : state.b ? state.sources.b : [], "b", !state.fixedB)
      : `<p class="ntm-empty ntm-start">Choose two notebooks to compare their sources.</p>`;

    const toB = root.querySelector("[data-copy='b']");
    const toA = root.querySelector("[data-copy='a']");
    const merge = root.querySelector("[data-merge]");
    toB.textContent = state.fixedB ? `Copy ${pickA || ""} to this notebook`.replace("  ", " ") : `Copy ${pickA || ""} to B →`.replace("  ", " ");
    toB.disabled = busy || !ready || !pickA || bCount + pickA > LIMIT();
    toA.hidden = Boolean(state.fixedB);
    toA.textContent = `← Copy ${pickB || ""} to A`.replace("  ", " ");
    toA.disabled = busy || !ready || !pickB || aCount + pickB > LIMIT();
    merge.hidden = Boolean(state.fixedB);
    merge.disabled = busy || !ready;
    const over = ready && (bCount + pickA > LIMIT() || aCount + pickB > LIMIT());
    root.querySelector(".ntm-status").textContent = state.working || state.note
      || (over ? `A notebook holds up to ${LIMIT()} sources. Pick fewer.` : ready ? "Web pages and YouTube videos are re-added from their link. Other sources are copied as their text." : "");
  }

  async function copy(toSide) {
    const fromSide = toSide === "b" ? "a" : "b";
    const fromId = state[fromSide];
    const toId = state[toSide];
    const items = (state.sources[fromSide] || []).filter((s) => state.picked[fromSide].has(s.id));
    await runCopies(items.map((s) => ({ fromId, source: s })), toId);
    state.picked[fromSide] = new Set();
    await loadSide(toSide);
  }

  async function runCopies(jobs, toId) {
    const session = state;
    let done = 0;
    let failed = 0;
    for (const job of jobs) {
      if (state !== session) return { done, failed };
      state.working = `Copying ${done + failed + 1} of ${jobs.length}: ${job.source.title || "source"}…`;
      render();
      try {
        await copySource(job.fromId, job.source, toId, state.auth);
        done += 1;
      } catch (_error) {
        failed += 1;
      }
    }
    if (state !== session) return { done, failed };
    state.working = "";
    state.note = `Copied ${done} source${done === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}.`;
    state.changed = true;
    state.onChanged?.(toId);
    return { done, failed };
  }

  async function mergeNew() {
    const d = diff();
    const jobs = [
      ...state.sources.a.map((s) => ({ fromId: state.a, source: s })),
      ...d.onlyB.map((s) => ({ fromId: state.b, source: s }))
    ];
    if (jobs.length > LIMIT()) {
      state.note = `Together they have ${jobs.length} unique sources; a notebook holds ${LIMIT()}. Copy a selection instead.`;
      return render();
    }
    const name = `${notebookTitle(state.a)} + ${notebookTitle(state.b)}`.slice(0, 100);
    state.working = "Creating the merged notebook…";
    render();
    try {
      const created = await client().createNotebookLmNotebook(name, state.auth);
      const result = await runCopies(jobs, created.id);
      if (!state) return;
      state.notebooks = [{ id: created.id, title: name }, ...state.notebooks];
      state.note = `Merged into “${name}”: ${result.done} source${result.done === 1 ? "" : "s"}${result.failed ? `, ${result.failed} failed` : ""}. Both originals are unchanged.`;
      state.onCreated?.(created);
    } catch (error) {
      if (!state) return;
      state.working = "";
      state.note = error.message || "Could not create the merged notebook.";
    }
    render();
  }

  function close() {
    if (state?.working) return;
    root?.remove();
    root = null;
    state = null;
    document.removeEventListener("keydown", onKey, true);
  }

  function onKey(event) {
    if (event.key === "Escape" && root) {
      event.stopPropagation();
      close();
    }
  }

  /**
   * open({ notebooks, a, b, fixedB, authOptions, onChanged(id), onCreated(nb) })
   */
  async function open(options = {}) {
    if (window.NotebookToolsPlan && !(await window.NotebookToolsPlan.can("notebook-merge"))) {
      window.NotebookToolsPlan.showUpgrade("notebook-merge");
      return;
    }
    close();
    state = {
      notebooks: (options.notebooks || []).filter((n) => n?.id),
      a: options.a || "",
      b: options.b || "",
      fixedB: Boolean(options.fixedB),
      auth: options.authOptions || {},
      sources: { a: null, b: null },
      picked: { a: new Set(), b: new Set() },
      working: "",
      note: "",
      onChanged: options.onChanged,
      onCreated: options.onCreated
    };
    root = document.createElement("div");
    root.className = "ntm-backdrop";
    root.innerHTML = `
      <div class="ntm-dialog" role="dialog" aria-modal="true" aria-labelledby="ntm-title">
        <header class="ntm-head">
          <div>
            <h2 id="ntm-title">${state.fixedB ? "Import sources from another notebook" : "Compare notebooks"}</h2>
            <p>${state.fixedB ? "Pick a notebook, tick the sources it has that this one doesn't, and copy them in." : "See which sources each notebook has, copy them across, or merge both into a new notebook."}</p>
          </div>
          <button type="button" class="ntm-close" data-close aria-label="Close">×</button>
        </header>
        <div class="ntm-pickers"></div>
        <div class="ntm-cols"></div>
        <footer class="ntm-foot">
          <span class="ntm-status" role="status"></span>
          <button type="button" class="button secondary compact" data-copy="a">← Copy to A</button>
          <button type="button" class="button secondary compact" data-merge>Merge into new notebook</button>
          <button type="button" class="button compact" data-copy="b">Copy to B →</button>
        </footer>
      </div>`;
    document.body.append(root);

    root.addEventListener("click", (event) => {
      if (event.target === root || event.target.closest("[data-close]")) return close();
      const copyBtn = event.target.closest("[data-copy]");
      if (copyBtn && !copyBtn.disabled) return void copy(copyBtn.dataset.copy);
      if (event.target.closest("[data-merge]")) return void mergeNew();
    });
    root.addEventListener("change", (event) => {
      const t = event.target;
      if (t.matches(".ntm-select")) {
        state[t.dataset.side] = t.value;
        state.note = "";
        void loadSide(t.dataset.side);
        return;
      }
      if (t.matches("[data-pick]")) {
        const set = state.picked[t.dataset.pick];
        t.checked ? set.add(t.value) : set.delete(t.value);
      } else if (t.matches("[data-all]")) {
        const side = t.dataset.all;
        const d = diff();
        const items = side === "a" ? d.onlyA : d.onlyB;
        state.picked[side] = t.checked ? new Set(items.map((s) => s.id)) : new Set();
      } else return;
      state.note = "";
      render();
    });
    document.addEventListener("keydown", onKey, true);
    render();
    if (state.a) void loadSide("a");
    if (state.b) void loadSide("b");
  }

  window.NotebookToolsNotebookMerge = { open, sourceKey, copySource };
})();
