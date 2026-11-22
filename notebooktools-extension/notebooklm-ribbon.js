/* ==========================================================================
   NotebookTools ribbon inside a Gemini Notebook notebook, between the page
   header and the Sources / Chat / Studio panels. It is split into three bars,
   each sitting right above the panel its tools belong to. When the panels
   can't be matched (narrow window, unusual layout) it falls back to one bar.
   ========================================================================== */
(function () {
  "use strict";

  const RIBBON_ID = "notebooktools-ribbon";
  const COLLAPSE_KEY = "notebooktoolsRibbonCollapsed";
  const store = window.NotebookToolsNotebookFolders;
  let renderTimer = 0;
  let lastUrl = location.href;
  let collapsed = false;
  let sizedRow = null;

  const I = {
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
    tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7-8.3-8.3Z"/><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none"/>',
    star: '<path d="M12 3.5l2.55 5.17 5.7.83-4.12 4.02.97 5.67L12 16.9l-5.1 2.69.97-5.67-4.12-4.02 5.7-.83L12 3.5Z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
    tabs: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M8 6V4h8v2"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
    studio: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M17 13.5v7M13.5 17h7"/>',
    camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z"/><circle cx="12" cy="13" r="3.5"/>',
    slash: '<path d="M15 4 9 20"/>',
    grid: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9.5 9.5v10"/>',
    doc: '<path d="M7 3.5h7l4.5 4.5v12.5H7z"/><path d="M14 3.5V8h4.5M9.5 12.5h6M9.5 16h6"/>',
    carousel: '<rect x="6.5" y="4.5" width="11" height="15" rx="2"/><path d="M3.5 7v10M20.5 7v10"/>',
    chevron: '<path d="m6 15 6-6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    caret: '<path d="m7 10 5 5 5-5"/>'
  };

  function icon(name, size = 16) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name]}</svg>`;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function notebookId() {
    return location.pathname.match(/\/notebook\/([^/?#]+)/i)?.[1] || "";
  }

  function isNotebookPage() {
    return Boolean(notebookId());
  }

  function send(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          void chrome.runtime.lastError;
          resolve(response || null);
        });
      } catch (_error) {
        resolve(null);
      }
    });
  }

  function toast(message, isError = false) {
    document.querySelector(".ntr-toast")?.remove();
    const node = document.createElement("div");
    node.className = `ntr-toast${isError ? " is-error" : ""}${isDarkPage() ? " is-dark" : ""}`;
    node.textContent = message;
    document.body.append(node);
    window.setTimeout(() => node.remove(), 2600);
  }

  /* ---------- Theme: follow the page ---------- */
  function luminance(color) {
    const m = String(color).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(",").map((v) => parseFloat(v));
    if (a === 0) return null;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  function isDarkPage() {
    for (const node of [document.body, document.documentElement, document.querySelector("main")]) {
      if (!node) continue;
      const lum = luminance(getComputedStyle(node).backgroundColor);
      if (lum !== null) return lum < 0.45;
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
  }

  /* ---------- Where the ribbon goes ---------- */
  function findChatInput() {
    return document.querySelector(
      "textarea[placeholder*='Ask'], textarea[aria-label='Query box'], textarea[aria-label*='Query'], textarea[placeholder*='question'], textarea[placeholder*='Start typing']"
    );
  }

  // The lowest ancestor of the chat box that spans (almost) the full width is
  // the row holding Sources, Chat and Studio. The ribbon goes right above it.
  function findPanelRow() {
    const input = findChatInput();
    if (!input) return null;
    const minWidth = window.innerWidth * 0.82;
    let node = input.parentElement;
    while (node && node !== document.body) {
      const rect = node.getBoundingClientRect();
      if (rect.width >= minWidth && rect.top > 24 && node.parentElement) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function fitRow(row, ribbon) {
    if (sizedRow && sizedRow !== row) {
      sizedRow.style.removeProperty("height");
      sizedRow.style.removeProperty("min-height");
    }
    sizedRow = row;
    row.style.removeProperty("height");
    const overflow = document.documentElement.scrollHeight - window.innerHeight;
    if (overflow > 0 && overflow <= ribbon.offsetHeight + 24) {
      row.style.setProperty("min-height", "0");
      row.style.setProperty("height", `${Math.max(240, row.getBoundingClientRect().height - overflow)}px`);
    }
  }

  // Shrink in steps until everything fits: group names, tighter spacing,
  // secondary labels, the ▾ carets, and only then icons without names.
  const FIT_LEVELS = ["fit-1", "fit-tight", "fit-2", "fit-3", "fit-4"];

  function fitRibbon(ribbon) {
    if (!ribbon) return;
    const segs = [...ribbon.querySelectorAll(".ntr-seg")];
    segs.forEach((seg) => seg.classList.remove(...FIT_LEVELS));
    if (ribbon.classList.contains("is-split")) {
      // Each bar shrinks on its own to fit the panel below it.
      for (const seg of segs) {
        for (const level of FIT_LEVELS) {
          if (seg.scrollWidth <= seg.clientWidth + 1) break;
          seg.classList.add(level);
        }
      }
      return;
    }
    for (const level of FIT_LEVELS) {
      if (ribbon.scrollWidth <= ribbon.clientWidth + 1) return;
      segs.forEach((seg) => seg.classList.add(level));
    }
  }

  /* ---------- Three bars above the three panels ---------- */
  // The panels are the children of the panel row: Sources, Chat (holds the
  // chat box) and Studio. Thin children such as resize handles are skipped.
  function findColumns(row) {
    const input = findChatInput();
    let chat = input;
    while (chat && chat.parentElement !== row) chat = chat.parentElement;
    if (!chat) return null;
    const kids = [...row.children].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 40 && r.height > 120;
    });
    const i = kids.indexOf(chat);
    if (i < 1 || i > kids.length - 2) return null;
    return { sources: kids[i - 1], chat, studio: kids[i + 1] };
  }

  function layoutSegments(ribbon, row) {
    const cols = row && findColumns(row);
    const segs = {
      sources: ribbon.querySelector('[data-seg="sources"]'),
      chat: ribbon.querySelector('[data-seg="chat"]'),
      studio: ribbon.querySelector('[data-seg="studio"]')
    };
    if (!cols || window.innerWidth < 900) {
      ribbon.classList.remove("is-split");
      Object.values(segs).forEach((seg) => {
        seg?.style.removeProperty("left");
        seg?.style.removeProperty("width");
      });
      return;
    }
    ribbon.classList.add("is-split");
    const origin = ribbon.getBoundingClientRect().left;
    for (const [name, col] of Object.entries(cols)) {
      const r = col.getBoundingClientRect();
      const seg = segs[name];
      if (!seg) continue;
      seg.style.left = `${Math.round(r.left - origin)}px`;
      seg.style.width = `${Math.max(48, Math.round(r.width))}px`;
    }
  }

  /* ---------- Organize (folders, tags, favorite) ---------- */
  async function organizeState() {
    if (!store) return { folder: "", tags: [], favorite: false, folders: [], allTags: [] };
    const state = await store.getState();
    const id = notebookId();
    return {
      folder: state.assignments[id] || "",
      tags: Array.isArray(state.tagAssignments[id]) ? state.tagAssignments[id] : [],
      favorite: state.favorites.includes(id),
      folders: state.folders,
      allTags: state.tags
    };
  }


  async function renderOrganize(ribbon) {
    const slot = ribbon.querySelector("[data-ntr-organize]");
    if (!slot) return;
    const s = await organizeState();
    slot.innerHTML = `
      <button type="button" class="ntr-btn ntr-chip" data-ntr="folder" title="Move this notebook to a folder">${icon("folder")}<span class="ntr-label">${esc(s.folder || "Add to folder")}</span>${icon("caret", 13)}</button>
      <button type="button" class="ntr-btn ntr-chip" data-ntr="tags" title="Tag this notebook">${icon("tag")}<span class="ntr-label">${s.tags.length ? esc(s.tags.slice(0, 2).join(", ")) + (s.tags.length > 2 ? ` +${s.tags.length - 2}` : "") : "Tags"}</span>${icon("caret", 13)}</button>
      <button type="button" class="ntr-btn ntr-icon${s.favorite ? " is-on" : ""}" data-ntr="favorite" title="${s.favorite ? "Remove from favorites" : "Add to favorites"}" aria-pressed="${s.favorite}">${icon("star")}</button>`;
    fitRibbon(ribbon);
  }

  /* ---------- Menus ---------- */
  function closeMenu() {
    document.querySelector(".ntr-menu")?.remove();
  }

  function openMenu(anchor, html, onClick) {
    closeMenu();
    const menu = document.createElement("div");
    menu.className = `ntr-menu${isDarkPage() ? " is-dark" : ""}`;
    menu.innerHTML = html;
    document.body.append(menu);
    const rect = anchor.getBoundingClientRect();
    const width = menu.offsetWidth;
    menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    menu.style.top = `${rect.bottom + 6}px`;
    menu.addEventListener("click", (event) => {
      event.stopPropagation();
      const item = event.target.closest("[data-value]");
      if (item) onClick(item.dataset.value, menu);
    });
    const input = menu.querySelector("input");
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && input.value.trim()) onClick(`new:${input.value.trim()}`, menu);
      if (event.key === "Escape") closeMenu();
    });
    return menu;
  }

  async function folderMenu(anchor, ribbon) {
    const s = await organizeState();
    const items = ["", ...s.folders]
      .map((f) => `<button type="button" class="ntr-menu-item${s.folder === f ? " is-active" : ""}" data-value="${esc(f)}">${icon(f ? "folder" : "list", 15)}<span>${esc(f || "Unfiled")}</span></button>`)
      .join("");
    openMenu(anchor, `<p class="ntr-menu-title">Move to folder</p>${items}<div class="ntr-menu-new"><input type="text" placeholder="New folder…" maxlength="40"></div>`, async (value) => {
      let folder = value;
      if (value.startsWith("new:")) {
        folder = value.slice(4);
        await store.addFolder(folder);
      }
      await store.setNotebookFolder(notebookId(), folder);
      closeMenu();
      toast(folder ? `Moved to ${folder}` : "Moved to Unfiled");
      renderOrganize(ribbon);
    });
  }

  async function tagMenu(anchor, ribbon) {
    const s = await organizeState();
    const items = s.allTags.length
      ? s.allTags.map((t) => `<button type="button" class="ntr-menu-item${s.tags.includes(t) ? " is-active" : ""}" data-value="${esc(t)}">${icon("tag", 15)}<span>${esc(t)}</span>${s.tags.includes(t) ? '<b class="ntr-check">✓</b>' : ""}</button>`).join("")
      : `<p class="ntr-menu-empty">No tags yet</p>`;
    openMenu(anchor, `<p class="ntr-menu-title">Tags</p>${items}<div class="ntr-menu-new"><input type="text" placeholder="New tag…" maxlength="32"></div>`, async (value) => {
      let tag = value;
      if (value.startsWith("new:")) {
        tag = value.slice(4);
        await store.addTag(tag);
      }
      await store.toggleNotebookTag(notebookId(), tag);
      await renderOrganize(ribbon);
      tagMenu(ribbon.querySelector('[data-ntr="tags"]') || anchor, ribbon);
    });
  }

  function exportMenu(anchor) {
    const formats = window.NotebookToolsChatExport?.listFormats?.() || [];
    if (!formats.length) return toast("Export is not available on this page.", true);
    const answer = [
      ["answer:pdf", "doc", "PDF (print-ready)"],
      ["answer:word", "doc", "Word (.doc)"],
      ["answer:markdown", "copy", "Markdown"]
    ].map(([v, ic, label]) => `<button type="button" class="ntr-menu-item" data-value="${v}">${icon(ic, 15)}<span>${esc(label)}</span></button>`).join("");
    const items = formats.map((f) => `<button type="button" class="ntr-menu-item" data-value="${esc(f.id)}">${icon("download", 15)}<span>${esc(f.label)}</span></button>`).join("");
    const whole = `<button type="button" class="ntr-menu-item" data-value="notebook:zip">${icon("download", 15)}<span>Sources and notes (ZIP)</span></button>`;
    openMenu(anchor, `<p class="ntr-menu-title">Last answer only</p>${answer}<p class="ntr-menu-title">Whole chat</p>${items}<p class="ntr-menu-title">Whole notebook</p>${whole}`, async (formatId) => {
      closeMenu();
      try {
        if (formatId === "notebook:zip") {
          const title = (document.title || "").replace(/\s*[-–|]\s*(NotebookLM|Gemini Notebook).*$/i, "").trim();
          return void window.NotebookToolsNotebookExport?.openDialog([{ id: notebookId(), title: title || "This notebook" }]);
        }
        if (formatId.startsWith("answer:")) {
          if (!window.NotebookToolsAnswerExport) throw new Error("Export is still loading. Try again in a moment.");
          return toast(await window.NotebookToolsAnswerExport.exportLastAnswer(formatId.slice(7)));
        }
        const payload = window.NotebookToolsNotebookLmChatExtract.extractNotebookLmChat();
        const result = await window.NotebookToolsChatExport.exportConversation(payload, formatId);
        toast(result?.openedPrintDialog ? "PDF view opened. Choose Save as PDF." : `Exported ${result?.filename || "chat"}`);
      } catch (error) {
        toast(error.message || "Export failed.", true);
      }
    });
  }

  // One Import button: links (pasted, YouTube, playlists) or open tabs, both
  // handled in the toolbar dropdown's Bulk tab.
  function importMenu(anchor) {
    const items = [
      ["links", "link", "Paste links or YouTube URLs"],
      ["tabs", "tabs", "Add my open tabs"]
    ].map(([value, ic, label]) => `<button type="button" class="ntr-menu-item" data-value="${value}">${icon(ic, 15)}<span>${esc(label)}</span></button>`).join("");
    openMenu(anchor, `<p class="ntr-menu-title">Import to this notebook</p>${items}`, (value) => {
      closeMenu();
      send({ type: "notebooktools-ribbon-open-panel", query: value === "tabs" ? "panel=bulk&tabs=1" : "panel=bulk" });
    });
  }

  // Create: things NotebookTools makes from this notebook. Each item runs the
  // same action (and Pro check) its old button did.
  function createMenu(anchor, ribbon) {
    const items = [
      ["blog", "doc", "Blog post", "with slide images"],
      ["carousel", "carousel", "Carousel", "from a slide deck"],
      ["snapdoc", "camera", "Snapshot doc", "from your screenshots"],
      ["editdeck", "studio", "Edit a slide deck", "editable text, PowerPoint"]
    ].map(([value, ic, label, hint]) => `<button type="button" class="ntr-menu-item" data-value="${value}">${icon(ic, 15)}<span>${esc(label)} <small class="ntr-menu-hint">${esc(hint)}</small></span></button>`).join("");
    openMenu(anchor, `<p class="ntr-menu-title">Create from this notebook</p>${items}`, (value) => {
      closeMenu();
      handle(value, anchor, ribbon);
    });
  }

  /* ---------- Actions ---------- */
  async function copyChat() {
    try {
      const payload = window.NotebookToolsNotebookLmChatExtract.extractNotebookLmChat();
      const text = payload?.markdown || payload?.plainText;
      if (!text) throw new Error("No chat messages to copy yet.");
      await navigator.clipboard.writeText(text);
      toast(`Copied ${payload.messages?.length || 1} message${payload.messages?.length === 1 ? "" : "s"} as Markdown`);
    } catch (error) {
      toast(error.message || "Could not copy the chat.", true);
    }
  }

  function openPrompts() {
    const input = findChatInput();
    if (!input) return toast("Chat box not found.", true);
    input.focus();
    if (!input.value.startsWith("/")) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(input, "/");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // The Blog and Snapshot workflows keep their own menus. Their original
  // buttons stay hidden; we park them under the ribbon button that was
  // clicked so their menus open right below it.
  function clickWorkflow(selector, name, from) {
    const button = document.querySelector(selector);
    if (!button) return toast(`${name} is still loading. Try again in a moment.`, true);
    const rect = from.getBoundingClientRect();
    const root = document.documentElement.style;
    root.setProperty("--ntr-anchor-top", `${Math.round(rect.bottom - 2)}px`);
    root.setProperty("--ntr-anchor-left", `${Math.round(rect.right - 2)}px`);
    window.requestAnimationFrame(() => button.click());
  }

  // Ribbon actions that need Pro (feature keys from plan-gate.js). Others are free.
  const PRO_ACTIONS = {
    folder: "organize",
    tags: "organize",
    favorite: "organize",
    export: "chat-export",
    "manage-sources": "manage-sources",
    "studio-files": "studio-files",
    blog: "blog-maker",
    carousel: "carousel-maker",
    editdeck: "studio-files",
    snapdoc: "snapshots",
    prompts: "prompt-library",
    hub: "notebooks-hub",
  };

  async function handle(action, button, ribbon) {
    const proKey = PRO_ACTIONS[action];
    if (proKey && window.NotebookToolsPlan && !(await window.NotebookToolsPlan.can(proKey))) {
      window.NotebookToolsPlan.showUpgrade(proKey);
      return;
    }
    switch (action) {
      case "folder": return folderMenu(button, ribbon);
      case "tags": return tagMenu(button, ribbon);
      case "favorite":
        await store.toggleFavorite(notebookId());
        return renderOrganize(ribbon);
      case "copy": return copyChat();
      case "export": return exportMenu(button);
      case "import": return importMenu(button);
      case "add-links": return send({ type: "notebooktools-ribbon-open-panel", query: "panel=bulk" });
      case "from-tabs": return send({ type: "notebooktools-ribbon-open-panel", query: "panel=bulk&tabs=1" });
      case "manage-sources":
        if (!window.NotebookToolsSourcesModal) return toast("Manage is still loading. Try again in a moment.", true);
        return window.NotebookToolsSourcesModal.open(notebookId());
      case "studio-files":
        if (!window.NotebookToolsStudioModal) return toast("Manage is still loading. Try again in a moment.", true);
        return window.NotebookToolsStudioModal.open(notebookId());
      case "create": return createMenu(button, ribbon);
      case "blog": return clickWorkflow(".notebooktools-blog-workflow-btn", "Blog workflow", button);
      case "editdeck":
        return window.NotebookToolsStudioModal?.open(notebookId(), { type: "Slide deck" });
      case "carousel":
        if (!window.NotebookToolsCarousel) return toast("Carousel is still loading. Try again in a moment.", true);
        return window.NotebookToolsCarousel.open(notebookId());
      case "snapdoc": return clickWorkflow(".notebooktools-snapshot-workflow-btn", "Snapshots", button);
      case "prompts": return openPrompts();
      case "hub": return send({ type: "notebooktools-ribbon-open-hub" });
      case "collapse":
        collapsed = !collapsed;
        chrome.storage.local.set({ [COLLAPSE_KEY]: collapsed });
        ribbon.classList.toggle("is-collapsed", collapsed);
        button.title = collapsed ? "Show labels" : "Compact ribbon";
        fitRibbon(ribbon);
        return fitRow(sizedRow || findPanelRow(), ribbon);
      default:
    }
  }

  /* ---------- Build ---------- */
  function btn(action, iconName, label, title, extra = "") {
    return `<button type="button" class="ntr-btn${extra}" data-ntr="${action}" title="${esc(title || label)}">${icon(iconName)}<span class="ntr-label">${esc(label)}</span></button>`;
  }

  function buildRibbon() {
    const ribbon = document.createElement("div");
    ribbon.id = RIBBON_ID;
    ribbon.className = `ntr${isDarkPage() ? " is-dark" : ""}${collapsed ? " is-collapsed" : ""}`;
    ribbon.setAttribute("role", "toolbar");
    ribbon.setAttribute("aria-label", "NotebookTools");
    ribbon.innerHTML = `
      <div class="ntr-seg" data-seg="sources" role="group" aria-label="Sources tools">
        <div class="ntr-brand" title="NotebookTools"><img src="${chrome.runtime.getURL("icons/icon48.png")}" alt="" width="18" height="18"></div>
        <div class="ntr-group" data-group="Sources"><div class="ntr-items">
          <button type="button" class="ntr-btn has-caret" data-ntr="import" title="Import links, YouTube videos or your open tabs">${icon("plus")}<span class="ntr-label">Import</span>${icon("caret", 13)}</button>
          ${btn("manage-sources", "list", "Manage", "Search, filter, de-duplicate, refresh and delete sources")}
        </div></div>
        <div class="ntr-group" data-group="Filter"><div class="ntr-items" data-ntr-typefilter></div></div>
      </div>
      <div class="ntr-seg" data-seg="chat" role="group" aria-label="Chat tools">
        <div class="ntr-group" data-group="Organize"><div class="ntr-items" data-ntr-organize></div></div>
        <div class="ntr-group" data-group="Chat"><div class="ntr-items">
          ${btn("copy", "copy", "Copy", "Copy the chat as Markdown", " is-tertiary")}
        </div></div>
        <div class="ntr-spacer"></div>
        <div class="ntr-end">
          <button type="button" class="ntr-btn ntr-pill" data-ntr="prompts" title="Insert a saved prompt (type / in the chat)">${icon("slash")}<span class="ntr-label">Prompts</span></button>
          ${btn("hub", "grid", "All notebooks", "Open the NotebookTools notebooks table", " is-tertiary")}
          ${btn("export", "download", "Export", "Save the last answer as a PDF or Word document, or export the whole chat", " has-caret")}
          <button type="button" class="ntr-btn ntr-icon ntr-collapse" data-ntr="collapse" title="${collapsed ? "Show labels" : "Compact ribbon"}">${icon("chevron", 15)}</button>
        </div>
      </div>
      <div class="ntr-seg" data-seg="studio" role="group" aria-label="Studio tools">
        <div class="ntr-group" data-group="Studio"><div class="ntr-items">
          ${btn("studio-files", "studio", "Manage", "Search, open, download and delete this notebook's Studio files")}
          <button type="button" class="ntr-btn has-caret" data-ntr="create" title="Blog post, carousel or snapshot document from this notebook">${icon("plus")}<span class="ntr-label">Create</span>${icon("caret", 13)}</button>
        </div></div>
        <div class="ntr-group" data-group="Filter"><div class="ntr-items" data-ntr-studiofilter></div></div>
      </div>`;

    ribbon.addEventListener("click", (event) => {
      const button = event.target.closest("[data-ntr]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      handle(button.dataset.ntr, button, ribbon);
    });
    return ribbon;
  }

  function mount() {
    const existing = document.getElementById(RIBBON_ID);
    if (!isNotebookPage()) {
      existing?.remove();
      document.documentElement.classList.remove("ntr-on");
      return;
    }
    const row = findPanelRow();
    if (!row) return;
    if (existing && existing.nextElementSibling === row) {
      existing.classList.toggle("is-dark", isDarkPage());
      layoutSegments(existing, row);
      fitRibbon(existing);
      window.NotebookToolsSourceFilter?.refresh();
      window.NotebookToolsStudioFilter?.refresh();
      return;
    }
    existing?.remove();
    const ribbon = buildRibbon();
    row.parentElement.insertBefore(ribbon, row);
    document.documentElement.classList.add("ntr-on");
    renderOrganize(ribbon);
    window.NotebookToolsSourceFilter?.attach(ribbon.querySelector("[data-ntr-typefilter]"), () => {
      const panelRow = findPanelRow();
      return panelRow ? findColumns(panelRow)?.sources || null : null;
    });
    window.NotebookToolsStudioFilter?.attach(ribbon.querySelector("[data-ntr-studiofilter]"), () => {
      const panelRow = findPanelRow();
      return panelRow ? findColumns(panelRow)?.studio || null : null;
    });
    layoutSegments(ribbon, row);
    fitRibbon(ribbon);
    fitRow(row, ribbon);
  }

  function schedule() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(mount, 250);
  }

  function onNavigation() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      closeMenu();
      window.NotebookToolsSourcesModal?.close();
      window.NotebookToolsStudioModal?.close();
      const ribbon = document.getElementById(RIBBON_ID);
      if (ribbon) renderOrganize(ribbon);
    }
    schedule();
  }

  document.addEventListener("mousedown", (event) => {
    const menu = document.querySelector(".ntr-menu");
    if (menu && !menu.contains(event.target) && !event.target.closest?.(`#${RIBBON_ID}`)) closeMenu();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
  window.addEventListener("resize", () => {
    const ribbon = document.getElementById(RIBBON_ID);
    if (ribbon) layoutSegments(ribbon, sizedRow || findPanelRow());
    if (ribbon) fitRibbon(ribbon);
    if (ribbon && sizedRow) fitRow(sizedRow, ribbon);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.notebooktoolsNotebookFolders) {
      const ribbon = document.getElementById(RIBBON_ID);
      if (ribbon) renderOrganize(ribbon);
    }
  });

  chrome.storage.local.get(COLLAPSE_KEY, (stored) => {
    collapsed = Boolean(stored?.[COLLAPSE_KEY]);
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("popstate", onNavigation);
    window.setInterval(onNavigation, 600);
    schedule();
  });
})();
