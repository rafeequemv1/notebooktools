/* ==========================================================================
   Review snapshots: one box with every captured image. Select, delete or
   crop each one, then push the selected ones into the open notebook (as
   image sources, ready for "Write article from snapshots").

   Runs on NotebookLM (content script) and on any page the continuous
   capture bar was used on (injected by the background). Off NotebookLM the
   box only edits; pushing happens back in the notebook.
   ========================================================================== */
(function () {
  "use strict";

  if (window.NotebookToolsSnapshotReview) return;

  const ROOT_ID = "notebooktools-snapshot-review";
  const store = () => window.NotebookToolsSnapshotStore;

  const ICON = {
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'
  };

  function svg(name, size = 18) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function isDarkPage() {
    for (const node of [document.body, document.documentElement]) {
      const m = node && getComputedStyle(node).backgroundColor.match(/[\d.]+/g);
      if (!m || Number(m[3] ?? 1) === 0) continue;
      const [r, g, b] = m.map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
  }

  function notebookId() {
    if (!/(^|\.)notebook(lm)?\.google\.com$/i.test(location.hostname)) return "";
    return location.pathname.match(/\/notebook\/([^/?#]+)/i)?.[1] || "";
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read the image."));
      img.src = src;
    });
  }

  /* ---------- State ---------- */
  let root = null;
  let shots = [];
  let selected = new Set();
  let cropping = null; // { id, img, box: {x,y,w,h} in image pixels }
  let pushing = false;
  let pushed = 0;
  const seen = new Set();

  async function reload() {
    shots = (await store().list()).filter((s) => s?.dataUrl);
    // New shots start selected; ones that are gone drop out
    const ids = new Set(shots.map((s) => s.id));
    selected = new Set([...selected].filter((id) => ids.has(id)));
    shots.forEach((s) => { if (!seen.has(s.id)) { seen.add(s.id); selected.add(s.id); } });
  }

  // Editing an image the notebook already has means uploading it again
  async function forgetUpload() {
    const id = notebookId();
    if (id) await store().clearSession(id).catch(() => {});
  }

  /* ---------- Render ---------- */
  function render() {
    if (!root) return;
    root.classList.toggle("is-dark", isDarkPage());
    const box = root.querySelector(".ntsr-box");
    if (cropping) return renderCrop(box);
    const onNotebook = Boolean(notebookId());
    const count = selected.size;
    box.innerHTML = `
      <header class="ntsr-head">
        <div class="ntsr-titles">
          <h2>Snapshots</h2>
          <p>${shots.length ? `${count} of ${shots.length} selected` : "Nothing captured yet"}</p>
        </div>
        ${shots.length ? `<button type="button" class="ntsr-link" data-act="all">${count === shots.length ? "Select none" : "Select all"}</button>` : ""}
        <button type="button" class="ntsr-icon" data-act="close" title="Close" aria-label="Close">${svg("close")}</button>
      </header>
      <div class="ntsr-grid">
        ${shots.length ? shots.map((s, i) => `
          <figure class="ntsr-card${selected.has(s.id) ? " is-on" : ""}" data-id="${esc(s.id)}" tabindex="0" role="checkbox" aria-checked="${selected.has(s.id)}">
            <div class="ntsr-thumb"><img src="${s.dataUrl}" alt="Snapshot ${i + 1}" loading="lazy"></div>
            <span class="ntsr-tick" aria-hidden="true">${svg("check", 14)}</span>
            <span class="ntsr-num">${i + 1}</span>
            <div class="ntsr-tools">
              <button type="button" class="ntsr-tool" data-act="crop" title="Crop" aria-label="Crop snapshot ${i + 1}">${svg("crop", 16)}</button>
              <button type="button" class="ntsr-tool" data-act="delete" title="Delete" aria-label="Delete snapshot ${i + 1}">${svg("trash", 16)}</button>
            </div>
            <figcaption title="${esc(s.title)}">${esc(s.caption || s.title || "Snapshot")}</figcaption>
          </figure>`).join("") : `<div class="ntsr-empty">${svg("camera", 28)}<p>Capture screens with <b>Capture continuously</b> in the Snapshots menu, or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> on any tab.</p></div>`}
      </div>
      <footer class="ntsr-foot">
        <button type="button" class="ntsr-btn is-quiet" data-act="delete-selected"${count ? "" : " disabled"}>${svg("trash", 16)}<span>Delete${count ? ` ${count}` : ""}</span></button>
        <span class="ntsr-status" role="status"></span>
        ${onNotebook
          ? (pushed
            ? `<button type="button" class="ntsr-btn" data-act="close">Close</button>
               <button type="button" class="ntsr-btn is-primary" data-act="write">${svg("doc", 16)}<span>Write article from them</span></button>`
            : `<button type="button" class="ntsr-btn" data-act="close">Close</button>
               <button type="button" class="ntsr-btn is-primary" data-act="push"${count && !pushing ? "" : " disabled"}>${svg("upload", 16)}<span>${count ? `Add ${count} to notebook` : "Add to notebook"}</span></button>`)
          : `<button type="button" class="ntsr-btn is-primary" data-act="close">Done</button>`}
      </footer>`;
    if (pushed) status(`Added ${pushed} snapshot${pushed === 1 ? "" : "s"} to this notebook.`);
  }

  function status(text, isError = false) {
    const el = root?.querySelector(".ntsr-status");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("is-error", isError);
  }

  /* ---------- Crop ---------- */
  function renderCrop(box) {
    box.innerHTML = `
      <header class="ntsr-head">
        <div class="ntsr-titles"><h2>Crop snapshot</h2><p>Drag the frame or its corners</p></div>
        <button type="button" class="ntsr-icon" data-act="crop-cancel" title="Cancel" aria-label="Cancel crop">${svg("close")}</button>
      </header>
      <div class="ntsr-stage"><div class="ntsr-canvas">
        <img src="${cropping.img.src}" alt="" draggable="false">
        <div class="ntsr-frame">${["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => `<i data-h="${h}"></i>`).join("")}</div>
      </div></div>
      <footer class="ntsr-foot">
        <button type="button" class="ntsr-btn is-quiet" data-act="crop-reset">Reset</button>
        <span class="ntsr-status" role="status"></span>
        <button type="button" class="ntsr-btn" data-act="crop-cancel">Cancel</button>
        <button type="button" class="ntsr-btn is-primary" data-act="crop-apply">${svg("check", 16)}<span>Apply crop</span></button>
      </footer>`;
    requestAnimationFrame(placeFrame);
  }

  function scale() {
    const img = root.querySelector(".ntsr-canvas img");
    return img ? img.clientWidth / cropping.img.naturalWidth : 1;
  }

  function placeFrame() {
    const frame = root?.querySelector(".ntsr-frame");
    if (!frame || !cropping) return;
    const k = scale();
    const b = cropping.box;
    Object.assign(frame.style, { left: `${b.x * k}px`, top: `${b.y * k}px`, width: `${b.w * k}px`, height: `${b.h * k}px` });
  }

  async function startCrop(id) {
    const shot = shots.find((s) => s.id === id);
    if (!shot) return;
    const img = await loadImage(shot.dataUrl);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    cropping = { id, img, box: { x: 0, y: 0, w, h } };
    render();
  }

  function dragFrame(event) {
    const frame = event.target.closest(".ntsr-frame");
    if (!frame || !cropping) return;
    event.preventDefault();
    const handle = event.target.dataset.h || "move";
    const k = scale();
    const start = { x: event.clientX, y: event.clientY, box: { ...cropping.box } };
    const W = cropping.img.naturalWidth;
    const H = cropping.img.naturalHeight;
    const MIN = Math.max(16, Math.round(24 / k));
    const move = (e) => {
      const dx = (e.clientX - start.x) / k;
      const dy = (e.clientY - start.y) / k;
      let { x, y, w, h } = start.box;
      if (handle === "move") {
        x = Math.min(Math.max(0, x + dx), W - w);
        y = Math.min(Math.max(0, y + dy), H - h);
      } else {
        if (handle.includes("w")) { const nx = Math.min(Math.max(0, x + dx), x + w - MIN); w += x - nx; x = nx; }
        if (handle.includes("e")) w = Math.min(Math.max(MIN, w + dx), W - x);
        if (handle.includes("n")) { const ny = Math.min(Math.max(0, y + dy), y + h - MIN); h += y - ny; y = ny; }
        if (handle.includes("s")) h = Math.min(Math.max(MIN, h + dy), H - y);
      }
      cropping.box = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
      placeFrame();
    };
    const up = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
  }

  async function applyCrop() {
    const { id, img, box } = cropping;
    const whole = box.x === 0 && box.y === 0 && box.w === img.naturalWidth && box.h === img.naturalHeight;
    if (!whole) {
      const canvas = document.createElement("canvas");
      canvas.width = box.w;
      canvas.height = box.h;
      canvas.getContext("2d").drawImage(img, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      await store().update(id, { dataUrl: canvas.toDataURL("image/png") });
      await forgetUpload();
      pushed = 0;
    }
    cropping = null;
    await reload();
    render();
  }

  /* ---------- Delete and push ---------- */
  async function remove(ids) {
    for (const id of ids) {
      await store().remove(id);
      selected.delete(id);
    }
    await forgetUpload();
    pushed = 0;
    await reload();
    render();
  }

  async function push() {
    const id = notebookId();
    const items = shots.filter((s) => selected.has(s.id));
    if (!id || !items.length || pushing) return;
    if (!window.NotebookToolsSnapshotUpload) return status("Upload isn't ready yet. Try again in a moment.", true);
    if (window.NotebookToolsPlan && !(await window.NotebookToolsPlan.can("snapshots"))) {
      window.NotebookToolsPlan.showUpgrade("snapshots");
      return;
    }
    pushing = true;
    const button = root.querySelector('[data-act="push"]');
    root.querySelectorAll(".ntsr-foot button, .ntsr-tool").forEach((b) => { b.disabled = true; });
    const label = button?.querySelector("span");
    try {
      const sourceIds = await window.NotebookToolsSnapshotUpload.uploadSnapshotsAsImages(id, items, {
        onProgress: (e) => {
          if (label) label.textContent = `Adding ${e.current} of ${e.total}…`;
          status(e.phase === "processing" ? "NotebookLM is reading the image…" : "Uploading…");
        }
      });
      await store().setSession({
        notebookId: id,
        snapshots: items,
        sourceIds,
        pageTitle: items[0]?.title || "Captured screens",
        outputType: "blog",
        uploadedAt: Date.now()
      });
      pushed = items.length;
      pushing = false;
      render();
    } catch (error) {
      pushing = false;
      render();
      status(error?.message || "Couldn't add the snapshots.", true);
    }
  }

  function writeArticle() {
    const option = document.querySelector('#notebooktools-snapshot-workflow-menu [data-action="auto"]');
    close();
    if (option) option.click();
  }

  /* ---------- Open / close ---------- */
  function onKey(event) {
    if (event.key !== "Escape" || !root) return;
    event.preventDefault();
    event.stopPropagation();
    if (cropping) { cropping = null; render(); } else close();
  }

  function onStorage(changes, area) {
    if (area === "local" && changes[store().STORAGE_KEY] && root && !cropping && !pushing) {
      void reload().then(render);
    }
  }

  async function open() {
    if (!store()) return;
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      root.innerHTML = '<div class="ntsr-scrim" data-act="close"></div><div class="ntsr-box" role="dialog" aria-modal="true" aria-label="Snapshots"></div>';
      root.addEventListener("click", onClick);
      root.addEventListener("keydown", (e) => {
        const card = e.target.closest?.(".ntsr-card");
        if (card && (e.key === " " || e.key === "Enter") && e.target === card) { e.preventDefault(); toggle(card.dataset.id); }
      });
      root.addEventListener("pointerdown", dragFrame);
      window.addEventListener("keydown", onKey, true);
      window.addEventListener("resize", placeFrame);
      chrome.storage.onChanged.addListener(onStorage);
      document.documentElement.append(root);
    }
    pushed = 0;
    cropping = null;
    await reload();
    render();
    root.querySelector(".ntsr-box")?.focus?.();
  }

  function close() {
    if (!root) return;
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", placeFrame);
    chrome.storage.onChanged.removeListener(onStorage);
    root.remove();
    root = null;
    cropping = null;
  }

  function toggle(id) {
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    render();
  }

  function onClick(event) {
    const act = event.target.closest("[data-act]")?.dataset.act;
    const card = event.target.closest(".ntsr-card");
    if (act === "close") return close();
    if (act === "all") {
      selected = selected.size === shots.length ? new Set() : new Set(shots.map((s) => s.id));
      return render();
    }
    if (act === "crop" && card) return void startCrop(card.dataset.id);
    if (act === "delete" && card) return void remove([card.dataset.id]);
    if (act === "delete-selected") return void remove([...selected]);
    if (act === "push") return void push();
    if (act === "write") return writeArticle();
    if (act === "crop-cancel") { cropping = null; return render(); }
    if (act === "crop-reset") { cropping.box = { x: 0, y: 0, w: cropping.img.naturalWidth, h: cropping.img.naturalHeight }; return placeFrame(); }
    if (act === "crop-apply") return void applyCrop();
    if (card && !act) toggle(card.dataset.id);
  }

  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== "ntsr-open-review") return false;
      void open().then(() => sendResponse({ ok: true }));
      return true;
    });
  } catch (_error) {
    /* not an extension page (tests) */
  }

  window.NotebookToolsSnapshotReview = { open, close };
})();
