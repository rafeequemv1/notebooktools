/* ==========================================================================
   Slide deck → carousel.

   Turns a NotebookLM slide deck into a LinkedIn document carousel (one PDF)
   or Instagram images (a ZIP of JPGs), 1080 × 1350 or 1080 × 1080, with the
   creator's handle, page numbers and a swipe hint on every page.

   Reuses the slides-to-blog pipeline: the deck's PDF is downloaded and each
   page rendered with pdf.js (NotebookToolsSlidePdfImages), then every page
   is composed on a canvas here.
   ========================================================================== */
(function () {
  "use strict";

  const SETTINGS_KEY = "notebooktoolsCarouselSettings";
  const RENDER_WIDTH = 1440; // slide pixels kept per page (the card is 960 wide)
  const PREVIEW_SCALE = 0.2;
  const FONT = '"Google Sans", "Google Sans Text", Roboto, Arial, sans-serif';

  const DEFAULTS = {
    format: "pdf", // pdf (LinkedIn) | images (Instagram)
    size: "portrait", // portrait 1080x1350 | square 1080x1080
    background: "match", // match | light | dark
    handle: "",
    numbers: true,
    swipe: true,
    cover: true
  };

  let settings = { ...DEFAULTS };
  let root = null;
  let state = null; // { notebookId, decks, deckId, deck, slides: [{ blob, edge }], loading, token }

  /* ---------- Small helpers ---------- */
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function safeName(value, fallback = "carousel") {
    const base = String(value || fallback).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 64);
    return base || fallback;
  }

  function sizeOf(size) {
    return size === "square" ? { w: 1080, h: 1080 } : { w: 1080, h: 1350 };
  }

  function luminance([r, g, b]) {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  function rgb([r, g, b]) {
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }

  // A touch darker or lighter than a colour, for the page behind a slide
  function shade([r, g, b], amount) {
    const t = amount < 0 ? 0 : 255;
    const p = Math.abs(amount);
    return [r + (t - r) * p, g + (t - g) * p, b + (t - b) * p];
  }

  function canvasToBlob(canvas, type = "image/jpeg", quality = 0.92) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image."))), type, quality);
    });
  }

  function download(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function loadSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(SETTINGS_KEY, (stored) => {
          settings = { ...DEFAULTS, ...(stored?.[SETTINGS_KEY] || {}) };
          resolve(settings);
        });
      } catch (_error) {
        resolve(settings);
      }
    });
  }

  function saveSettings() {
    try {
      chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    } catch (_error) {
      /* settings just won't stick */
    }
  }

  /* ---------- Store-only ZIP (JPGs are already compressed) ---------- */
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function buildZip(files) {
    const encoder = new TextEncoder();
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [];
    const central = [];
    let offset = 0;

    for (const file of files) {
      const name = encoder.encode(file.name);
      const crc = crc32(file.bytes);
      const size = file.bytes.length;
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(8, 0, true); // stored
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, size, true);
      local.setUint32(22, size, true);
      local.setUint16(26, name.length, true);
      parts.push(new Uint8Array(local.buffer), name, file.bytes);

      const dir = new DataView(new ArrayBuffer(46));
      dir.setUint32(0, 0x02014b50, true);
      dir.setUint16(4, 20, true);
      dir.setUint16(6, 20, true);
      dir.setUint16(12, time, true);
      dir.setUint16(14, date, true);
      dir.setUint32(16, crc, true);
      dir.setUint32(20, size, true);
      dir.setUint32(24, size, true);
      dir.setUint16(28, name.length, true);
      dir.setUint32(42, offset, true);
      central.push(new Uint8Array(dir.buffer), name);
      offset += 30 + name.length + size;
    }

    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
  }

  /* ---------- Slides: download the deck PDF, render each page ---------- */
  // The average colour around a slide's edge, so the page can match it
  function edgeColor(canvas) {
    const small = document.createElement("canvas");
    small.width = 64;
    small.height = 36;
    const ctx = small.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, 64, 36);
    const { data } = ctx.getImageData(0, 0, 64, 36);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = 0; y < 36; y += 1) {
      for (let x = 0; x < 64; x += 1) {
        if (x > 2 && x < 61 && y > 2 && y < 33) continue;
        const i = (y * 64 + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n += 1;
      }
    }
    return [r / n, g / n, b / n];
  }

  async function renderDeck(deck, onProgress) {
    const images = window.NotebookToolsSlidePdfImages;
    if (!images) throw new Error("The slide renderer is still loading. Try again in a moment.");
    onProgress("Downloading the deck…");
    const bytes = await images.fetchBinary(images.getDeckPdfUrl(deck));
    const pdfjsLib = await images.loadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const slides = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress(`Rendering slide ${pageNumber} of ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      slides.push({ blob: await canvasToBlob(canvas, "image/jpeg", 0.94), edge: edgeColor(canvas), ratio: canvas.height / canvas.width });
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
    await pdf.destroy?.();
    return slides;
  }

  /* ---------- Compose one carousel page ---------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxWidth, maxLines) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
        if (lines.length === maxLines) break;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
      let last = lines[maxLines - 1];
      while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last.trim()}…`;
    }
    return lines;
  }

  function palette(slide, opts) {
    if (opts.background === "light") return { bg: [247, 248, 250], ink: "#1f1f1f", soft: "rgba(31,31,31,.55)", pill: "rgba(0,0,0,.06)" };
    if (opts.background === "dark") return { bg: [17, 20, 26], ink: "#ffffff", soft: "rgba(255,255,255,.62)", pill: "rgba(255,255,255,.1)" };
    const dark = luminance(slide.edge) < 0.5;
    return {
      bg: shade(slide.edge, dark ? -0.25 : -0.06),
      ink: dark ? "#ffffff" : "#1f1f1f",
      soft: dark ? "rgba(255,255,255,.66)" : "rgba(31,31,31,.58)",
      pill: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.07)"
    };
  }

  /**
   * Draws page `index` (0-based) of `count` onto a new canvas at `scale`
   * (1 = full 1080 wide). Returns the canvas.
   */
  async function composePage(slide, index, count, opts, title, scale = 1) {
    const { w, h } = sizeOf(opts.size);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.scale(scale, scale);

    const colors = palette(slide, opts);
    ctx.fillStyle = rgb(colors.bg);
    ctx.fillRect(0, 0, w, h);

    const pad = 60;
    const cardW = w - pad * 2;
    const cardH = Math.round(cardW * (slide.ratio || 9 / 16));
    const showTitle = opts.cover && index === 0 && title;
    const footerH = 110;
    let cardY = Math.round((h - cardH) / 2 - (opts.size === "square" ? 10 : 30));

    // Cover: the deck title above the first slide
    if (showTitle) {
      ctx.fillStyle = colors.ink;
      ctx.textBaseline = "alphabetic";
      const titleSize = opts.size === "square" ? 50 : 62;
      ctx.font = `700 ${titleSize}px ${FONT}`;
      const lines = wrapLines(ctx, title, cardW, opts.size === "square" ? 2 : 3);
      const lineH = Math.round(titleSize * 1.14);
      const blockH = lines.length * lineH;
      const space = h - footerH - cardH - pad;
      const top = Math.max(pad + 10, Math.round(pad + (space - blockH - 40) / 2));
      lines.forEach((line, i) => ctx.fillText(line, pad, top + titleSize + i * lineH));
      cardY = Math.max(cardY, top + blockH + 44);
    }

    // The slide, as a card
    const bitmap = await createImageBitmap(slide.blob);
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 14;
    roundRect(ctx, pad, cardY, cardW, cardH, 22);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, pad, cardY, cardW, cardH, 22);
    ctx.clip();
    ctx.drawImage(bitmap, pad, cardY, cardW, cardH);
    ctx.restore();
    // A hairline edge, so a slide the colour of the page still reads as a card
    roundRect(ctx, pad + 0.5, cardY + 0.5, cardW - 1, cardH - 1, 22);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = colors.ink === "#ffffff" ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)";
    ctx.stroke();
    bitmap.close?.();

    // Page number, top right
    if (opts.numbers && count > 1) {
      const label = `${index + 1} / ${count}`;
      ctx.font = `500 30px ${FONT}`;
      const tw = ctx.measureText(label).width;
      const pw = tw + 40;
      roundRect(ctx, w - pad - pw, pad - 6, pw, 52, 26);
      ctx.fillStyle = colors.pill;
      ctx.fill();
      ctx.fillStyle = colors.ink;
      ctx.textBaseline = "middle";
      ctx.fillText(label, w - pad - pw + 20, pad + 20);
    }

    // Footer: handle on the left, swipe hint on the right
    const footY = h - pad - 4;
    ctx.textBaseline = "alphabetic";
    const handle = String(opts.handle || "").trim();
    if (handle) {
      const text = handle.startsWith("@") || /\s|\./.test(handle) ? handle : `@${handle}`;
      ctx.font = `600 34px ${FONT}`;
      ctx.fillStyle = colors.ink;
      ctx.fillText(text, pad, footY);
    }
    if (opts.swipe && index < count - 1) {
      ctx.font = `500 30px ${FONT}`;
      ctx.fillStyle = colors.soft;
      ctx.textAlign = "right";
      ctx.fillText("Swipe  →", w - pad, footY);
      ctx.textAlign = "left";
    }

    return canvas;
  }

  /* ---------- Export ---------- */
  async function exportCarousel(onProgress) {
    const { slides, deck } = state;
    const opts = { ...settings };
    const name = safeName(deck?.title, "slide-deck");
    const pages = [];
    for (let i = 0; i < slides.length; i += 1) {
      onProgress(`Building page ${i + 1} of ${slides.length}…`);
      const canvas = await composePage(slides[i], i, slides.length, opts, deck?.title, 1);
      pages.push(await canvasToBlob(canvas, "image/jpeg", 0.92));
      canvas.width = 0;
    }

    if (opts.format === "pdf") {
      const PDFLib = window.PDFLib;
      if (!PDFLib) throw new Error("PDF export is still loading. Try again in a moment.");
      onProgress("Writing the PDF…");
      const { w, h } = sizeOf(opts.size);
      const doc = await PDFLib.PDFDocument.create();
      doc.setTitle(deck?.title || "Carousel");
      doc.setCreator("NotebookTools");
      for (const blob of pages) {
        const jpg = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        doc.addPage([w, h]).drawImage(jpg, { x: 0, y: 0, width: w, height: h });
      }
      const bytes = await doc.save();
      download(`${name} - carousel.pdf`, new Blob([bytes], { type: "application/pdf" }));
      return `Saved ${pages.length}-page PDF for LinkedIn`;
    }

    onProgress("Packing the images…");
    const files = [];
    for (let i = 0; i < pages.length; i += 1) {
      files.push({ name: `${String(i + 1).padStart(2, "0")}.jpg`, bytes: new Uint8Array(await pages[i].arrayBuffer()) });
    }
    download(`${name} - carousel.zip`, buildZip(files));
    return `Saved ${pages.length} images (ZIP) for Instagram`;
  }

  /* ---------- Dialog ---------- */
  function seg(name, value, options) {
    return `<div class="ntc-seg" role="radiogroup" data-setting="${name}">${options
      .map(([v, label, hint]) => `<button type="button" role="radio" class="ntc-seg-btn${v === value ? " is-on" : ""}" aria-checked="${v === value}" data-value="${v}"${hint ? ` title="${esc(hint)}"` : ""}>${esc(label)}</button>`)
      .join("")}</div>`;
  }

  function toggle(name, label, on) {
    return `<label class="ntc-check"><input type="checkbox" data-setting="${name}"${on ? " checked" : ""}><span>${esc(label)}</span></label>`;
  }

  function isDarkPage() {
    const color = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
    return color ? luminance(color.map(Number)) < 0.45 : false;
  }

  function render() {
    if (!root || !state) return;
    const decks = state.decks || [];
    const deckOptions = decks.length
      ? decks.map((d) => `<option value="${esc(d.id)}"${d.id === state.deckId ? " selected" : ""}>${esc(d.title)}</option>`).join("")
      : `<option value="">${state.decks ? "No ready slide decks" : "Loading decks…"}</option>`;
    const ready = Boolean(state.slides?.length) && !state.loading;

    root.querySelector(".ntc-body").innerHTML = `
      <div class="ntc-controls">
        <label class="ntc-field"><span class="ntc-label">Slide deck</span>
          <select class="ntc-select" data-deck${decks.length ? "" : " disabled"}>${deckOptions}</select>
        </label>
        <div class="ntc-field"><span class="ntc-label">For</span>
          ${seg("format", settings.format, [["pdf", "LinkedIn · PDF", "One PDF to upload as a LinkedIn document post"], ["images", "Instagram · JPG", "A ZIP with one JPG per page"]])}
        </div>
        <div class="ntc-field"><span class="ntc-label">Size</span>
          ${seg("size", settings.size, [["portrait", "Portrait 4:5", "1080 × 1350"], ["square", "Square 1:1", "1080 × 1080"]])}
        </div>
        <div class="ntc-field"><span class="ntc-label">Background</span>
          ${seg("background", settings.background, [["match", "Match", "Take the colour from each slide"], ["light", "Light"], ["dark", "Dark"]])}
        </div>
        <label class="ntc-field"><span class="ntc-label">Your handle</span>
          <input class="ntc-input" type="text" data-setting="handle" placeholder="@yourname" maxlength="40" value="${esc(settings.handle)}">
        </label>
        <div class="ntc-checks">
          ${toggle("cover", "Deck title on the first page", settings.cover)}
          ${toggle("numbers", "Page numbers", settings.numbers)}
          ${toggle("swipe", "“Swipe →” hint", settings.swipe)}
        </div>
      </div>
      <div class="ntc-preview">
        <div class="ntc-strip" data-strip>${state.error ? `<p class="ntc-empty is-error">${esc(state.error)}</p>` : `<p class="ntc-empty">${esc(state.status || "Loading…")}</p>`}</div>
      </div>`;

    const go = root.querySelector("[data-export]");
    go.disabled = !ready || state.exporting;
    go.textContent = state.exporting ? "Exporting…" : settings.format === "pdf" ? `Download PDF${ready ? ` · ${state.slides.length} pages` : ""}` : `Download images${ready ? ` · ${state.slides.length}` : ""}`;
    root.querySelector("[data-status]").textContent = state.note || "";
    if (ready) drawPreviews();
  }

  let previewToken = 0;
  async function drawPreviews() {
    const strip = root?.querySelector("[data-strip]");
    if (!strip || !state?.slides?.length) return;
    const token = ++previewToken;
    const opts = { ...settings };
    const nodes = [];
    for (let i = 0; i < state.slides.length; i += 1) {
      const canvas = await composePage(state.slides[i], i, state.slides.length, opts, state.deck?.title, PREVIEW_SCALE);
      if (token !== previewToken) return;
      canvas.className = "ntc-page";
      nodes.push(canvas);
    }
    strip.replaceChildren(...nodes);
  }

  async function loadDeck(deckId) {
    const session = state;
    const token = (session.token || 0) + 1;
    const live = () => state === session && session.token === token;
    Object.assign(session, { deckId, deck: null, slides: null, loading: true, error: "", status: "Loading the deck…", token });
    render();
    try {
      const deck = await window.NotebookToolsNotebookLM.getNotebookLmSlideDeck(session.notebookId, deckId);
      if (!live()) return;
      session.deck = deck;
      const slides = await renderDeck(deck, (status) => {
        if (!live()) return;
        session.status = status;
        const empty = root?.querySelector(".ntc-empty");
        if (empty) empty.textContent = status;
      });
      if (!live()) return;
      Object.assign(session, { slides, loading: false, status: "" });
    } catch (error) {
      if (!live()) return;
      Object.assign(session, { loading: false, error: error.message || "Could not load the slide deck." });
    }
    render();
  }

  async function open(notebookId) {
    if (!notebookId) return;
    await loadSettings();
    close();
    state = { notebookId, decks: null, deckId: "", slides: null, loading: true, status: "Looking for slide decks…" };

    root = document.createElement("div");
    root.className = `ntc-backdrop${isDarkPage() ? " is-dark" : ""}`;
    root.innerHTML = `
      <div class="ntc-dialog" role="dialog" aria-modal="true" aria-labelledby="ntc-title">
        <header class="ntc-head">
          <div>
            <h2 id="ntc-title">Slide deck to carousel</h2>
            <p>Post a NotebookLM deck as a LinkedIn or Instagram carousel.</p>
          </div>
          <button type="button" class="ntc-close" data-close aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </header>
        <div class="ntc-body"></div>
        <footer class="ntc-foot">
          <span class="ntc-status" data-status></span>
          <button type="button" class="ntc-btn" data-close>Cancel</button>
          <button type="button" class="ntc-btn is-primary" data-export disabled>Download</button>
        </footer>
      </div>`;
    document.body.append(root);

    root.addEventListener("click", async (event) => {
      if (event.target === root || event.target.closest("[data-close]")) return close();
      const segBtn = event.target.closest(".ntc-seg-btn");
      if (segBtn) {
        settings[segBtn.closest("[data-setting]").dataset.setting] = segBtn.dataset.value;
        saveSettings();
        return render();
      }
      if (event.target.closest("[data-export]") && state.slides?.length && !state.exporting) {
        state.exporting = true;
        state.note = "";
        render();
        const session = state;
        let note = "";
        try {
          note = await exportCarousel((status) => {
            const node = root?.querySelector("[data-status]");
            if (node) node.textContent = status;
          });
        } catch (error) {
          note = error.message || "Export failed.";
        }
        if (state !== session) return;
        Object.assign(state, { exporting: false, note });
        render();
      }
    });
    root.addEventListener("change", (event) => {
      const target = event.target;
      if (target.matches("[data-deck]")) return loadDeck(target.value);
      if (target.matches("input[type=checkbox][data-setting]")) {
        settings[target.dataset.setting] = target.checked;
        saveSettings();
        drawPreviews();
      }
    });
    let typing = 0;
    root.addEventListener("input", (event) => {
      if (!event.target.matches("input[type=text][data-setting]")) return;
      settings[event.target.dataset.setting] = event.target.value;
      window.clearTimeout(typing);
      typing = window.setTimeout(() => {
        saveSettings();
        drawPreviews();
      }, 250);
    });
    document.addEventListener("keydown", onKey, true);

    render();
    const session = state;
    try {
      const all = await window.NotebookToolsNotebookLM.listNotebookLmArtifacts(notebookId);
      if (state !== session) return;
      state.decks = all.filter((a) => a.typeCode === 8 && a.status === "ready");
      if (!state.decks.length) {
        Object.assign(state, { loading: false, error: "No ready slide deck in this notebook yet. Create one in Studio (Slide deck), wait until it finishes, then try again." });
        return render();
      }
      loadDeck(state.decks[0].id);
    } catch (error) {
      if (state !== session) return;
      state.decks = [];
      Object.assign(state, { loading: false, error: error.message || "Could not list this notebook's slide decks." });
      render();
    }
  }

  function onKey(event) {
    if (event.key === "Escape" && root) {
      event.stopPropagation();
      close();
    }
  }

  function close() {
    root?.remove();
    root = null;
    state = null;
    previewToken += 1;
    document.removeEventListener("keydown", onKey, true);
  }

  window.NotebookToolsCarousel = { open, close, composePage, buildZip, _renderDeck: renderDeck };
})();
