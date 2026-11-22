/* ==========================================================================
   Highlights and notes on sources. A reader shows a source's text; select a
   passage to highlight it (4 colours), and keep a note beside it. Saved in
   chrome.storage.local per notebook + source (never sent anywhere).
   Exposes window.NotebookToolsSourceNotes = { get, all, open, summary, markdown }.
   ========================================================================== */
(function () {
  "use strict";

  const KEY = "notebooktoolsSourceNotes";
  const COLORS = { yellow: "#fdd663", green: "#81c995", blue: "#8ab4f8", pink: "#f8a5c2" };
  let root = null;
  let ctx = null;

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const keyOf = (notebookId, sourceId) => `${notebookId}:${sourceId}`;

  async function all() {
    const stored = await chrome.storage.local.get(KEY);
    return stored[KEY] || {};
  }

  async function get(notebookId, sourceId) {
    const entry = (await all())[keyOf(notebookId, sourceId)] || {};
    return { note: entry.note || "", highlights: Array.isArray(entry.highlights) ? entry.highlights : [], title: entry.title || "" };
  }

  async function save(notebookId, sourceId, entry) {
    const data = await all();
    const key = keyOf(notebookId, sourceId);
    if (!entry.note?.trim() && !entry.highlights?.length) delete data[key];
    else data[key] = { ...entry, updatedAt: Date.now() };
    await chrome.storage.local.set({ [KEY]: data });
  }

  // { sourceId: count } for one notebook (highlights + 1 if there is a note)
  async function summary(notebookId) {
    const out = {};
    const prefix = `${notebookId}:`;
    for (const [key, entry] of Object.entries(await all())) {
      if (!key.startsWith(prefix)) continue;
      out[key.slice(prefix.length)] = (entry.highlights?.length || 0) + (entry.note?.trim() ? 1 : 0);
    }
    return out;
  }

  function markdown(entry) {
    const parts = [];
    if (entry.highlights?.length) {
      parts.push("## My highlights", "", ...entry.highlights.map((h) => `> ${h.text.replace(/\n+/g, " ")}${h.comment ? `\n\n${h.comment}` : ""}\n`));
    }
    if (entry.note?.trim()) parts.push("## My notes", "", entry.note.trim(), "");
    return parts.join("\n");
  }

  /* ---------- Reader ---------- */
  function renderText() {
    const pane = root.querySelector(".ntn-text");
    let html = esc(ctx.text || "No text could be extracted from this source.");
    // Mark the first occurrence of each highlight (longest first, so nested ones don't break).
    [...ctx.entry.highlights].sort((a, b) => b.text.length - a.text.length).forEach((h) => {
      const needle = esc(h.text);
      const at = html.indexOf(needle);
      if (at < 0 || html.slice(0, at).lastIndexOf("<mark") > html.slice(0, at).lastIndexOf("</mark>")) return;
      html = `${html.slice(0, at)}<mark data-hl="${esc(h.id)}" style="--hl:${COLORS[h.color] || COLORS.yellow}">${needle}</mark>${html.slice(at + needle.length)}`;
    });
    pane.innerHTML = html;
  }

  function renderSide() {
    const list = root.querySelector(".ntn-hl-list");
    const items = ctx.entry.highlights;
    root.querySelector("[data-hl-count]").textContent = items.length ? `(${items.length})` : "";
    list.innerHTML = items.length
      ? items.map((h) => `
        <div class="ntn-hl" data-id="${esc(h.id)}" style="--hl:${COLORS[h.color] || COLORS.yellow}">
          <button type="button" class="ntn-hl-text" data-jump="${esc(h.id)}" title="Show in text">${esc(h.text.length > 220 ? `${h.text.slice(0, 220)}…` : h.text)}</button>
          <button type="button" class="ntn-hl-del" data-del="${esc(h.id)}" aria-label="Remove highlight">×</button>
        </div>`).join("")
      : `<p class="ntn-empty">Select text on the left to highlight it.</p>`;
  }

  let saveTimer = 0;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      await save(ctx.notebookId, ctx.source.id, { ...ctx.entry, title: ctx.source.title });
      root?.querySelector(".ntn-saved")?.removeAttribute("hidden");
      ctx.onChange?.();
    }, 300);
  }

  function addHighlight(color) {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    hideToolbar();
    if (!text || text.length < 2) return;
    if (ctx.entry.highlights.some((h) => h.text === text)) return;
    ctx.entry.highlights.push({ id: `h${Date.now().toString(36)}`, text, color, at: Date.now() });
    sel.removeAllRanges();
    renderText();
    renderSide();
    persist();
  }

  function showToolbar() {
    if (!root) return;
    const sel = window.getSelection();
    const bar = root.querySelector(".ntn-toolbar");
    if (!sel || sel.isCollapsed || !root.querySelector(".ntn-text").contains(sel.anchorNode)) return hideToolbar();
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    bar.hidden = false;
    bar.style.left = `${Math.max(8, rect.left + rect.width / 2 - bar.offsetWidth / 2)}px`;
    bar.style.top = `${Math.max(8, rect.top - bar.offsetHeight - 8)}px`;
  }

  function hideToolbar() {
    const bar = root?.querySelector(".ntn-toolbar");
    if (bar) bar.hidden = true;
  }

  function close() {
    clearTimeout(saveTimer);
    if (ctx) void save(ctx.notebookId, ctx.source.id, { ...ctx.entry, title: ctx.source.title }).then(() => ctx?.onChange?.());
    root?.remove();
    root = null;
    document.removeEventListener("keydown", onKey, true);
    setTimeout(() => { ctx = null; }, 0);
  }

  function onKey(event) {
    if (event.key === "Escape" && root) {
      event.stopPropagation();
      close();
    }
  }

  /**
   * open({ notebookId, source:{id,title,type,url}, authOptions, onChange })
   */
  async function open(options) {
    if (window.NotebookToolsPlan && !(await window.NotebookToolsPlan.can("source-notes"))) {
      window.NotebookToolsPlan.showUpgrade("source-notes");
      return;
    }
    if (root) close();
    ctx = { ...options, text: "", entry: await get(options.notebookId, options.source.id) };
    root = document.createElement("div");
    root.className = "ntn-backdrop";
    root.innerHTML = `
      <div class="ntn-dialog" role="dialog" aria-modal="true" aria-labelledby="ntn-title">
        <header class="ntn-head">
          <div class="ntn-head-copy">
            <span class="ntn-kicker">${esc(options.source.type || "Source")}</span>
            <h2 id="ntn-title">${esc(options.source.title || "Untitled source")}</h2>
          </div>
          <button type="button" class="ntn-close" data-close aria-label="Close">×</button>
        </header>
        <div class="ntn-body">
          <article class="ntn-text" tabindex="0">Loading source text…</article>
          <aside class="ntn-side">
            <p class="ntn-label">My note <span class="ntn-saved" hidden>Saved</span></p>
            <textarea class="ntn-note" placeholder="What matters in this source? Your own words, questions, next steps…">${esc(ctx.entry.note)}</textarea>
            <p class="ntn-label">Highlights <span data-hl-count></span></p>
            <div class="ntn-hl-list"></div>
            <button type="button" class="ntn-copy" data-copy>Copy highlights and note</button>
          </aside>
        </div>
        <div class="ntn-toolbar" hidden role="toolbar" aria-label="Highlight colour">
          ${Object.entries(COLORS).map(([name, c]) => `<button type="button" data-color="${name}" style="--hl:${c}" aria-label="Highlight ${name}" title="Highlight"></button>`).join("")}
        </div>
      </div>`;
    document.body.append(root);
    renderSide();

    root.addEventListener("mouseup", () => setTimeout(showToolbar, 0));
    root.querySelector(".ntn-text").addEventListener("scroll", hideToolbar, { passive: true });
    root.addEventListener("mousedown", (event) => {
      if (event.target.closest("[data-color]")) event.preventDefault();
    });
    root.addEventListener("click", async (event) => {
      if (event.target === root || event.target.closest("[data-close]")) return close();
      const color = event.target.closest("[data-color]");
      if (color) return addHighlight(color.dataset.color);
      const del = event.target.closest("[data-del]");
      if (del) {
        ctx.entry.highlights = ctx.entry.highlights.filter((h) => h.id !== del.dataset.del);
        renderText();
        renderSide();
        return persist();
      }
      const jump = event.target.closest("[data-jump]");
      if (jump) {
        const mark = root.querySelector(`mark[data-hl="${CSS.escape(jump.dataset.jump)}"]`);
        mark?.scrollIntoView({ block: "center", behavior: "smooth" });
        mark?.classList.add("is-flash");
        setTimeout(() => mark?.classList.remove("is-flash"), 1200);
        return;
      }
      if (event.target.closest("[data-copy]")) {
        const text = `# ${ctx.source.title}\n\n${markdown(ctx.entry) || "_No highlights or notes yet._"}`;
        await navigator.clipboard.writeText(text);
        event.target.textContent = "Copied";
        setTimeout(() => { if (event.target.isConnected) event.target.textContent = "Copy highlights and note"; }, 1400);
      }
    });
    root.querySelector(".ntn-note").addEventListener("input", (event) => {
      ctx.entry.note = event.target.value;
      root.querySelector(".ntn-saved").hidden = true;
      persist();
    });
    document.addEventListener("keydown", onKey, true);

    try {
      const payload = await window.NotebookToolsNotebookLM.getNotebookLmSourceContent(options.notebookId, options.source.id, options.authOptions || {});
      if (!ctx || ctx.source.id !== options.source.id) return;
      ctx.text = payload.content || "";
    } catch (error) {
      if (!ctx) return;
      ctx.text = "";
      root.querySelector(".ntn-text").textContent = error.message || "Could not load this source's text.";
      return;
    }
    renderText();
  }

  window.NotebookToolsSourceNotes = { get, all, open, summary, markdown };
})();
