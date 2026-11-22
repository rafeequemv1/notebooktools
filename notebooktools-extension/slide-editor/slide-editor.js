/* NotebookLM slide deck editor: open a slide deck PDF (or slide images),
   OCR turns the text into editable boxes, edit everything, export PPTX,
   PDF or PNG. Runs entirely in the browser. Uses NTPdf + NTSlides.

   Layout: top bar (file, insert, view, export) · format strip that changes
   with the selection · slides | stage | inspector (Design / Motion). */
(() => {
  const P = NTPdf;
  const S = NTSlides;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = NTTools.esc;
  const app = $("#seApp");
  if (!app) return;

  const FONTS = ["Arial", "Helvetica", "Georgia", "Times New Roman", "Verdana", "Trebuchet MS", "Courier New"];
  const PALETTE = [
    "#ffffff", "#f1f3f4", "#bdc1c6", "#80868b", "#3c4043", "#1f1f1f", "#000000",
    "#d93025", "#e8710a", "#f9ab00", "#188038", "#12b5cb", "#0b57d0", "#a142f4",
    "#fad2cf", "#feefc3", "#fde293", "#ceead6", "#cbf0f8", "#d2e3fc", "#e9d2fd"
  ];
  const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 88, 104, 128, 160, 200];
  const SPACING = [1, 1.15, 1.2, 1.35, 1.5, 2];
  const WIDTHS = [0, 1, 2, 3, 4, 6, 8, 12];
  const CM_WIDE = 33.867; // 13.333 in slide

  const TRANSITIONS = [
    ["none", "None"], ["fade", "Fade"], ["push", "Push"], ["wipe", "Wipe"],
    ["split", "Split"], ["cover", "Cover"], ["uncover", "Uncover"], ["cut", "Cut"],
    ["bars", "Bars"], ["dissolve", "Dissolve"], ["circle", "Circle"], ["zoom", "Zoom"]
  ];
  const ENTRANCES = [["none", "None"], ["appear", "Appear"], ["fade", "Fade"], ["fly", "Fly in"], ["rise", "Rise"], ["zoom", "Zoom"], ["wipe", "Wipe"]];
  const DURATIONS = [[0.3, "Quick"], [0.5, "Normal"], [0.8, "Slow"], [1.2, "Very slow"]];

  const deck = { title: "slides", slides: [] };
  let cur = 0;
  let selected = null; // element id
  let editing = null; // element id being typed into
  let zoom = 0.5;
  let showOriginal = false;
  let queue = Promise.resolve();
  let history = [];
  let future = [];
  let tab = "design"; // inspector tab
  let clipboard = null;

  /* ---------- Shell ---------- */
  app.innerHTML = `
    <div class="se-start" id="seStart">
      <div id="seDrop"></div>
      <label class="se-ocr-opt"><input type="checkbox" id="seOcr" checked> Make the text editable (reads slides with OCR, English)</label>
      <label class="se-ocr-opt"><input type="checkbox" id="seObjects" checked> Separate pictures and shapes so you can move, resize or delete them</label>
      <ul class="se-points">
        <li><b>Edit text</b> right on the slide: click, double-click to type, drag to move.</li>
        <li><b>Format, animate and add transitions</b>, then present from the browser.</li>
        <li><b>Download PowerPoint</b> with real text boxes, transitions and animations.</li>
        <li><b>Private</b>: the deck never leaves your browser.</li>
      </ul>
    </div>
    <div class="se-editor" id="seEditor" hidden>
      <header class="se-bar">
        <div class="se-bar-group">
          <button type="button" class="se-btn" data-act="new" title="Open another deck">${ico("upload")}<span>Open</span></button>
          <span class="se-count" id="seCount"></span>
          <span class="se-chip" id="seProgress" hidden></span>
        </div>
        <div class="se-bar-group">
          <button type="button" class="se-btn is-icon" data-act="undo" title="Undo (Ctrl+Z)">${ico("undo")}</button>
          <button type="button" class="se-btn is-icon" data-act="redo" title="Redo (Ctrl+Shift+Z)">${ico("redo")}</button>
          <span class="se-sep"></span>
          <button type="button" class="se-btn" data-act="add-text" title="Add a text box">${ico("text")}<span>Text</span></button>
          <button type="button" class="se-btn" data-pop="shapes" title="Add a shape">${ico("shapes")}<span>Shape</span>${ico("caret", 12)}</button>
          <button type="button" class="se-btn" data-act="add-image" title="Add a picture">${ico("image")}<span>Picture</span></button>
          <span class="se-sep"></span>
          <button type="button" class="se-btn" data-act="original" title="Compare with the original slide">${ico("eye")}<span>Original</span></button>
        </div>
        <div class="se-bar-group">
          <button type="button" class="se-btn" data-act="present" title="Present from this slide (F5)">${ico("play")}<span>Present</span></button>
          <button type="button" class="se-btn is-icon" data-act="full" title="Full-screen editor">${ico("expand")}</button>
          <div class="se-split">
            <button type="button" class="se-btn is-primary" data-act="pptx">${ico("download")}<span>Download PowerPoint</span></button>
            <button type="button" class="se-btn is-primary is-caret" data-act="menu" aria-label="More formats" aria-haspopup="menu">${ico("caret")}</button>
            <div class="se-menu" id="seMenu" hidden role="menu">
              <button type="button" role="menuitem" data-act="pptx">PowerPoint (.pptx), editable</button>
              <button type="button" role="menuitem" data-act="pdf">PDF with real text</button>
              <button type="button" role="menuitem" data-act="png">PNG images (.zip)</button>
              <button type="button" role="menuitem" data-act="png-one">This slide as PNG</button>
            </div>
          </div>
        </div>
      </header>
      <div class="se-fmt" id="seFmt" role="toolbar" aria-label="Format"></div>
      <div class="se-body">
        <aside class="se-pages" aria-label="Slides">
          <p class="se-label">Slides</p>
          <div class="se-thumbs" id="seThumbs"></div>
          <button type="button" class="se-add-slide" data-act="add-slide">${ico("plus")} New slide</button>
        </aside>
        <div class="se-stage-wrap" id="seWrap"><div class="se-stage" id="seStage"></div></div>
        <aside class="se-props" id="seProps" aria-label="Inspector"></aside>
      </div>
      <div class="se-loader" id="seLoader" hidden aria-live="polite">
        <div class="se-loader-card">
          <p class="se-loader-title" id="seLoaderTitle">Opening your deck</p>
          <div class="se-loader-strip" id="seLoaderStrip"></div>
          <div class="se-loader-bar"><i id="seLoaderBar"></i></div>
          <p class="se-loader-text" id="seLoaderText"></p>
        </div>
      </div>
      <p class="se-status" id="seStatus" role="status"></p>
      <div class="se-pop" id="sePop" hidden></div>
    </div>
    <div class="se-present" id="sePresent" hidden><canvas></canvas><p class="se-present-hint">Click or → for next · ← back · Esc to exit</p></div>
    <input type="file" id="seImageInput" accept="image/*" hidden>`;

  function ico(name, size = 16) {
    const d = {
      upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
      undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
      redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
      text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
      shapes: '<circle cx="8" cy="8" r="4.5"/><path d="M13 13h7.5v7.5H13z"/><path d="m4 20.5 3.5-6 3.5 6z"/>',
      rect: '<rect x="4" y="6" width="16" height="12"/>',
      rounded: '<rect x="4" y="6" width="16" height="12" rx="4"/>',
      ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6"/>',
      triangle: '<path d="M12 5 20.5 19h-17z"/>',
      line: '<path d="M5 19 19 5"/>',
      arrow: '<path d="M5 19 19 5M10 5h9v9"/>',
      image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-5-5-8 8"/>',
      eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      play: '<path d="M7 5v14l11-7z"/>',
      expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
      download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/>',
      caret: '<path d="m6 9 6 6 6-6"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      minus: '<path d="M5 12h14"/>',
      copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
      trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
      layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>',
      front: '<rect x="8" y="8" width="12" height="12" rx="2" fill="currentColor" fill-opacity=".25"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
      forward: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 13V5a1 1 0 0 1 1-1h8"/>',
      backward: '<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M20 11v8a1 1 0 0 1-1 1h-8"/>',
      back: '<rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" fill-opacity=".25"/><path d="M20 8v11a1 1 0 0 1-1 1H8"/>',
      left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
      center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
      right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
      justify: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
      vtop: '<path d="M4 4h16M12 8v12M8 12l4-4 4 4"/>',
      vmiddle: '<path d="M4 12h16M12 3v5M12 16v5M9 6l3 2 3-2M9 18l3-2 3 2"/>',
      vbottom: '<path d="M4 20h16M12 4v12M8 12l4 4 4-4"/>',
      bullets: '<circle cx="5" cy="7" r="1.3" fill="currentColor"/><circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="5" cy="17" r="1.3" fill="currentColor"/><path d="M10 7h10M10 12h10M10 17h10"/>',
      numbers: '<path d="M4 5h1.5v4M4 9h3M4 14.5c0-1 2.8-1 2.8.4 0 1-2.8 2.1-2.8 3.1h3M10 7h10M10 12h10M10 17h10"/>',
      lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
      unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 7.7-1.5"/>',
      rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4.5h-4.5"/>',
      flip: '<path d="M12 3v18M8 7 4 12l4 5V7ZM16 7l4 5-4 5V7Z"/>',
      alL: '<path d="M4 3v18M8 7h12v4H8zM8 14h7v4H8z"/>',
      alC: '<path d="M12 3v18M6 7h12v4H6zM8.5 14h7v4h-7z"/>',
      alR: '<path d="M20 3v18M4 7h12v4H4zM9 14h7v4H9z"/>',
      alT: '<path d="M3 4h18M7 8v12h4V8zM14 8v7h4V8z"/>',
      alM: '<path d="M3 12h18M7 6v12h4V6zM14 8.5v7h4v-7z"/>',
      alB: '<path d="M3 20h18M7 4v12h4V4zM14 9v7h4V9z"/>',
      spacing: '<path d="M11 6h9M11 12h9M11 18h9M5 4v16M3 6l2-2 2 2M3 18l2 2 2-2"/>',
      motion: '<path d="M4 17c3-8 7-8 9-3s5 5 7-3"/><circle cx="20" cy="8" r="1.4" fill="currentColor"/>',
      design: '<path d="M4 20 15 9M14 4l6 6M12.5 5.5l6 6"/><path d="M4 20l1-4 3 3z"/>',
      sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'
    }[name];
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  }

  const slide = () => deck.slides[cur];
  const find = (idv) => slide()?.elements.find((e) => e.id === idv);
  const isShape = (el) => el && (el.type === "rect" || el.type === "ellipse" || el.type === "triangle");
  const status = (msg, type = "") => {
    const el = $("#seStatus");
    el.textContent = msg || "";
    el.className = `se-status${type ? ` is-${type}` : ""}`;
  };
  const elName = (el) => el.type === "text" ? `“${String(el.text).replace(/\s+/g, " ").slice(0, 28)}${el.text.length > 28 ? "…" : ""}”` : { rect: "Rectangle", ellipse: "Ellipse", triangle: "Triangle", line: el.arrow ? "Arrow" : "Line", image: "Picture" }[el.type] || "Item";
  const animsOf = (s) => s.elements.filter((e) => e.anim && e.anim.type && e.anim.type !== "none").sort((a, b) => (a.anim.order || 0) - (b.anim.order || 0));

  /* ---------- History ---------- */
  function snapshot() {
    return JSON.stringify({ cur, order: deck.slides.map((s) => s.id), slides: deck.slides.map((s) => ({ id: s.id, status: s.status, bgMode: s.bgMode, bgColor: s.bgColor, notes: s.notes, transition: s.transition || null, elements: s.elements })) });
  }
  const canvases = new Map(); // slide id → slide (keeps its canvases across undo)
  function commit() {
    deck.slides.forEach((x) => canvases.set(x.id, x));
    history.push(snapshot());
    if (history.length > 80) history.shift();
    future = [];
  }
  function restore(json) {
    const data = JSON.parse(json);
    deck.slides.forEach((s) => canvases.set(s.id, s));
    deck.slides = data.order.map((idv) => {
      const base = canvases.get(idv);
      const saved = data.slides.find((s) => s.id === idv);
      // Saved before this slide's text was read: keep the text found since
      // (restoring the empty list would leave a cleaned slide with no text)
      const readSince = saved.status !== "done" && base.status === "done";
      const elements = readSince ? base.elements : JSON.parse(JSON.stringify(saved.elements));
      return Object.assign(base, { bgMode: saved.bgMode, bgColor: saved.bgColor, notes: saved.notes, transition: saved.transition, elements });
    });
    cur = Math.min(data.cur, deck.slides.length - 1);
    selected = null;
    renderAll();
  }
  function undo() {
    if (!history.length) return;
    future.push(snapshot());
    restore(history.pop());
  }
  function redo() {
    if (!future.length) return;
    history.push(snapshot());
    restore(future.pop());
  }

  /* ---------- Open ---------- */
  P.dropZone($("#seDrop"), { label: "Drop a NotebookLM slide deck PDF", hint: "or slide images, or", multiple: true, accept: ".pdf,application/pdf,image/png,image/jpeg,image/webp", sample: "deck" }, openFiles);

  /* ---------- Import progress: frames fill in slide by slide ---------- */
  const loader = {
    frames: 0,
    show(title) {
      const box = $("#seLoader");
      $("#seStart").hidden = true;
      $("#seEditor").hidden = false;
      box.classList.remove("is-leaving");
      box.hidden = false;
      $("#seLoaderTitle").textContent = title || "Opening your deck";
      $("#seLoaderText").textContent = "";
      $("#seLoaderBar").style.width = "0%";
      $("#seLoaderStrip").classList.add("is-waiting");
      $("#seLoaderStrip").innerHTML = '<span class="se-loader-frame"></span>'.repeat(5);
      this.frames = 0;
    },
    isOpen() {
      return !$("#seLoader").hidden;
    },
    text(msg) {
      $("#seLoaderText").textContent = msg || "";
    },
    /** Slide i (0-based) of n is in: show its picture in frame i. */
    frame(i, n, image) {
      const strip = $("#seLoaderStrip");
      if (this.frames !== n) {
        strip.classList.remove("is-waiting");
        strip.innerHTML = '<span class="se-loader-frame"></span>'.repeat(n);
        this.frames = n;
      }
      const cell = strip.children[i];
      if (cell && image) {
        const c = document.createElement("canvas");
        c.width = 96;
        c.height = Math.max(1, Math.round((96 * (image.height || 9)) / (image.width || 16)));
        c.getContext("2d").drawImage(image, 0, 0, c.width, c.height);
        cell.replaceChildren(c);
        cell.classList.add("is-in");
        cell.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      }
      strip.querySelectorAll(".is-now").forEach((x) => x.classList.remove("is-now"));
      strip.children[i + 1]?.classList.add("is-now");
      $("#seLoaderBar").style.width = `${Math.round(((i + 1) / n) * 100)}%`;
      this.text(`Slide ${i + 1} of ${n}`);
    },
    hide() {
      const box = $("#seLoader");
      if (box.hidden) return;
      box.classList.add("is-leaving");
      setTimeout(() => { box.hidden = true; box.classList.remove("is-leaving"); }, 260);
    }
  };

  async function openFiles(files) {
    const ocr = $("#seOcr").checked;
    const objectsOn = $("#seObjects").checked;
    deck.slides = [];
    history = [];
    future = [];
    cur = 0;
    selected = null;
    $("#seStart").hidden = true;
    $("#seEditor").hidden = false;
    status("Opening…");
    if (!loader.isOpen()) loader.show("Opening your deck");
    try {
      const pdfs = files.filter((f) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name));
      const images = files.filter((f) => /^image\//.test(f.type));
      deck.title = P.baseName((pdfs[0] || images[0] || { name: "slides" }).name);
      for (const f of pdfs) {
        const { pdf, pageCount } = await S.loadPdf(await P.bytesOf(f));
        for (let i = 1; i <= pageCount; i += 1) {
          status(`Opening slide ${i} of ${pageCount}…`);
          const page = await S.renderOriginal(pdf, i);
          deck.slides.push(S.newSlide(page));
          loader.frame(i - 1, pageCount, page);
          if (deck.slides.length === 1) renderAll();
        }
      }
      for (const f of images) {
        const img = await createImageBitmap(f);
        const canvas = document.createElement("canvas");
        canvas.width = S.W;
        canvas.height = Math.round((S.W * img.height) / img.width);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        deck.slides.push(S.newSlide(canvas));
        loader.frame(images.indexOf(f), images.length, canvas);
      }
      if (!deck.slides.length) throw new Error("No slides found in that file.");
    } catch (error) {
      loader.hide();
      status(error.message || "That file couldn't be opened. If the PDF has a password, remove it first.", "error");
      return;
    }
    loader.hide();
    renderAll();
    status(ocr ? "Reading the text on each slide. You can start editing slides that are ready." : "Opened. Text stays part of the slide image.");
    deck.slides.forEach((s, i) => {
      queue = queue.then(async () => {
        if (!deck.slides.includes(s)) return;
        if (!ocr) {
          S.skipAnalysis(s);
        } else {
          showProgress(`Reading text: slide ${i + 1} of ${deck.slides.length}`);
          s.status = "working";
          markScanning();
          try {
            await S.analyze(s, (p) => showProgress(`Reading text: slide ${i + 1} of ${deck.slides.length} · ${Math.round(p * 100)}%`), { objects: objectsOn });
          } catch (_error) {
            S.skipAnalysis(s);
            s.status = "error";
          }
        }
        renderThumb(deck.slides.indexOf(s));
        markScanning();
        if (deck.slides[cur] === s) {
          renderStage();
          if (!selected) renderPanels();
        }
        if (i === deck.slides.length - 1) {
          showProgress("");
          const failed = deck.slides.filter((x) => x.status === "error").length;
          const textCount = deck.slides.reduce((n, x) => n + x.elements.filter((e) => e.type === "text").length, 0);
          const objCount = deck.slides.reduce((n, x) => n + x.elements.filter((e) => e.detected).length, 0);
          status(ocr ? `Ready. ${textCount} text boxes${objCount ? ` and ${objCount} pictures and shapes` : ""} found${failed ? `; ${failed} slide${failed === 1 ? "" : "s"} couldn't be read` : ""}. Double-click any text to edit it; drag pictures to move them.` : "Ready.", "ok");
        }
      });
    });
  }

  // Let a host page (the extension) open a deck directly.
  window.NTSlideEditor = {
    open: (files) => openFiles(files),
    loader,
    status: (msg, type) => {
      $("#seStart").hidden = true;
      $("#seEditor").hidden = false;
      status(msg, type);
    }
  };

  /** A scan line runs over the slide whose text is being read (thumbnail and stage). */
  function markScanning() {
    deck.slides.forEach((x, i) => $(`.se-thumb[data-slide="${i}"]`)?.classList.toggle("is-scanning", x.status === "working"));
    $("#seStage")?.classList.toggle("is-scanning", deck.slides[cur]?.status === "working");
  }

  function showProgress(text) {
    const chip = $("#seProgress");
    chip.hidden = !text;
    chip.textContent = text;
  }

  /* ---------- Render ---------- */
  function renderAll() {
    renderThumbs();
    renderStage();
    renderPanels();
    $("#seCount").textContent = deck.slides.length ? `Slide ${cur + 1} of ${deck.slides.length}` : "";
  }

  function renderPanels() {
    renderFmt();
    renderProps();
  }

  function renderThumbs() {
    const box = $("#seThumbs");
    box.innerHTML = deck.slides.map((s, i) => `
      <button type="button" class="se-thumb${i === cur ? " is-on" : ""}${s.status === "working" ? " is-scanning" : ""}" data-slide="${i}" aria-label="Slide ${i + 1}">
        <span class="se-thumb-n">${i + 1}<span class="se-thumb-fx" title="Has motion"></span></span><span class="se-thumb-img"></span>
        ${s.status === "pending" || s.status === "working" ? '<span class="se-thumb-busy" title="Reading text…"></span>' : ""}
      </button>`).join("");
    deck.slides.forEach((_s, i) => renderThumb(i));
  }

  function renderThumb(i) {
    const s = deck.slides[i];
    const holder = $(`.se-thumb[data-slide="${i}"]`);
    if (!s || !holder) return;
    const c = S.slideCanvas(s, 168 / s.w, { original: !s.clean });
    holder.querySelector(".se-thumb-img").replaceChildren(c);
    holder.querySelector(".se-thumb-busy")?.toggleAttribute("hidden", s.status === "done" || s.status === "error");
    const fx = (s.transition && s.transition.type !== "none") || animsOf(s).length;
    holder.querySelector(".se-thumb-fx").innerHTML = fx ? ico("motion", 11) : "";
  }

  let thumbTimer = 0;
  function refreshThumbSoon() {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(() => renderThumb(cur), 250);
  }

  function fitZoom() {
    const wrap = $("#seWrap");
    const s = slide();
    if (!s || !wrap) return;
    zoom = Math.max(0.15, Math.min((wrap.clientWidth - 40) / s.w, (wrap.clientHeight - 40) / s.h));
  }

  function renderStage() {
    $("#seStage")?.classList.toggle("is-scanning", deck.slides[cur]?.status === "working");
    const s = slide();
    const stage = $("#seStage");
    if (!s) {
      stage.innerHTML = "";
      return;
    }
    fitZoom();
    stage.style.width = `${s.w * zoom}px`;
    stage.style.height = `${s.h * zoom}px`;
    const bg = document.createElement("canvas");
    bg.className = "se-bg";
    bg.width = Math.round(s.w * zoom * devicePixelRatio);
    bg.height = Math.round(s.h * zoom * devicePixelRatio);
    const ctx = bg.getContext("2d");
    const z = zoom * devicePixelRatio;
    if (showOriginal || !s.clean) ctx.drawImage(s.original, 0, 0, s.w * z, s.h * z);
    else if (s.bgMode === "color") { ctx.fillStyle = s.bgColor; ctx.fillRect(0, 0, bg.width, bg.height); }
    else ctx.drawImage(s.clean, 0, 0, s.w * z, s.h * z);
    stage.replaceChildren(bg);
    if (s.status === "working" || s.status === "pending") {
      const note = document.createElement("div");
      note.className = "se-stage-note";
      note.textContent = s.status === "working" ? "Reading the text on this slide…" : "Waiting to read this slide…";
      stage.append(note);
    }
    if (showOriginal) return;
    for (const el of s.elements) stage.append(elementNode(el));
  }

  function addHandles(node, el) {
    if (el.locked) {
      const tag = document.createElement("span");
      tag.className = "se-locktag";
      tag.innerHTML = ico("lock", 12);
      node.append(tag);
      return;
    }
    const dirs = el.type === "line" ? (el.flip ? ["sw", "ne"] : ["nw", "se"]) : ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
    dirs.forEach((d) => {
      const h = document.createElement("span");
      h.className = `se-handle is-${d}`;
      h.dataset.handle = d;
      node.append(h);
    });
    if (el.type !== "line") {
      const r = document.createElement("span");
      r.className = "se-handle is-rot";
      r.dataset.handle = "rot";
      r.title = "Drag to rotate (Shift snaps to 15°)";
      node.append(r);
    }
  }

  function elementNode(el) {
    const node = document.createElement("div");
    node.className = `se-el se-${el.type}${el.id === selected ? " is-selected" : ""}${el.locked ? " is-locked" : ""}`;
    node.dataset.id = el.id;
    paint(node, el);
    if (el.id === selected) addHandles(node, el);
    return node;
  }

  // Line endpoints for SVG, relative to the element box.
  function svgShape(el) {
    const w = Math.max(1, el.w * zoom), h = Math.max(1, el.h * zoom);
    const sw = (el.strokeWidth || 0) * zoom;
    if (el.type === "triangle") {
      const fill = el.fill && el.fill !== "none" ? el.fill : "none";
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="visible"><polygon points="${w / 2},0 ${w},${h} 0,${h}" fill="${fill}" stroke="${sw ? el.stroke : "none"}" stroke-width="${sw}" stroke-linejoin="round"/></svg>`;
    }
    const lw = Math.max(1, (el.strokeWidth || 4) * zoom);
    const [x1, y1, x2, y2] = S.lineEnds(el, 0, 0, el.w * zoom, el.h * zoom);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const head = el.arrow ? Math.max(lw * 3.5, 10 * zoom) : 0;
    const ex = x2 - Math.cos(ang) * head * 0.8, ey = y2 - Math.sin(ang) * head * 0.8;
    const tip = el.arrow ? `<polygon points="${x2},${y2} ${x2 - head * Math.cos(ang - 0.45)},${y2 - head * Math.sin(ang - 0.45)} ${x2 - head * Math.cos(ang + 0.45)},${y2 - head * Math.sin(ang + 0.45)}" fill="${el.stroke}"/>` : "";
    return `<svg width="${w}" height="${h}" overflow="visible"><line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="${el.stroke}" stroke-width="${lw}" stroke-linecap="round"/>${tip}</svg>`;
  }

  // Draw an element's look into its node (no handles).
  function paint(node, el) {
    applyBox(node, el);
    node.style.opacity = el.opacity ?? 1;
    node.style.background = "";
    node.style.border = "";
    if (el.type === "text") {
      const txt = document.createElement("div");
      txt.className = "se-txt";
      setText(txt, el);
      node.replaceChildren(txt);
      styleText(node, txt, el);
    } else if (el.type === "rect" || el.type === "ellipse") {
      node.replaceChildren();
      node.style.background = el.fill && el.fill !== "none" ? el.fill : "transparent";
      node.style.borderRadius = el.type === "ellipse" ? "50%" : `${(el.radius || 0) * zoom}px`;
      if (el.stroke && el.strokeWidth) node.style.border = `${Math.max(1, el.strokeWidth * zoom)}px solid ${el.stroke}`;
    } else if (el.type === "triangle" || el.type === "line") {
      node.innerHTML = svgShape(el);
    } else if (el.type === "image") {
      const img = document.createElement("img");
      img.src = el.src;
      img.alt = "";
      img.draggable = false;
      node.replaceChildren(img);
      if (el.stroke && el.strokeWidth) node.style.border = `${Math.max(1, el.strokeWidth * zoom)}px solid ${el.stroke}`;
    }
  }

  // Text with "Label:" runs in their own colour/weight (NotebookLM style).
  function setText(txt, el) {
    if (!el.labelColor) {
      txt.textContent = el.text;
      return;
    }
    txt.innerHTML = String(el.text).split("\n").map((line) => S.lineRuns(el, line).map((r) => r.label
      ? `<span style="color:${el.labelColor};font-weight:${el.labelBold ? 700 : 400}">${esc(r.text)}</span>`
      : esc(r.text)).join("")).join("\n");
  }

  function applyBox(node, el) {
    node.style.left = `${el.x * zoom}px`;
    node.style.top = `${el.y * zoom}px`;
    node.style.width = `${el.w * zoom}px`;
    node.style.height = `${el.h * zoom}px`;
    node.style.transform = el.rotate ? `rotate(${el.rotate}deg)` : "";
  }

  function styleText(node, txt, el) {
    node.style.justifyContent = { middle: "center", bottom: "flex-end" }[el.valign] || "flex-start";
    node.style.background = el.highlight || "";
    if (el.stroke && el.strokeWidth) node.style.border = `${Math.max(1, el.strokeWidth * zoom)}px solid ${el.stroke}`;
    txt.style.fontFamily = S.cssFamily(el.fontFamily);
    txt.style.fontSize = `${el.fontSize * zoom}px`;
    txt.style.lineHeight = String(el.lineHeight);
    txt.style.color = el.color;
    txt.style.fontWeight = el.bold ? "700" : "400";
    txt.style.fontStyle = el.italic ? "italic" : "normal";
    txt.style.textAlign = el.align;
    txt.style.textDecoration = [el.underline && "underline", el.strike && "line-through"].filter(Boolean).join(" ") || "none";
  }

  function nodeOf(idv) {
    return $(`.se-el[data-id="${CSS.escape(idv)}"]`);
  }

  // Change the selection in place (no re-render), so a double-click still
  // lands on the same element.
  function select(idv) {
    if (editing && editing !== idv) stopEditing();
    const prev = selected && nodeOf(selected);
    if (prev) {
      prev.classList.remove("is-selected");
      prev.querySelectorAll(".se-handle, .se-locktag").forEach((h) => h.remove());
    }
    selected = idv;
    const node = idv && nodeOf(idv);
    if (node) {
      node.classList.add("is-selected");
      addHandles(node, find(idv));
    }
    closePop();
    renderPanels();
  }

  /* ---------- Popovers (colours, shapes, arrange) ---------- */
  let popFor = null; // { kind, prop }
  function closePop() {
    $("#sePop").hidden = true;
    popFor = null;
    app.querySelectorAll("[data-pop].is-on").forEach((b) => b.classList.remove("is-on"));
  }
  function openPop(btn) {
    const kind = btn.dataset.pop;
    if (popFor && popFor.btn === btn) return closePop();
    closePop();
    const pop = $("#sePop");
    const el = find(selected);
    let html = "";
    if (kind === "color") {
      const prop = btn.dataset.prop;
      const current = prop === "bg" ? slide().bgColor : el?.[prop];
      const used = [...new Set(slide().elements.flatMap((e) => [e.color, e.fill, e.labelColor, e.stroke, e.highlight]).filter((c) => /^#[0-9a-f]{6}$/i.test(c || "")))].slice(0, 7);
      const chip = (c) => `<button type="button" class="se-chipc${String(current).toLowerCase() === c.toLowerCase() ? " is-on" : ""}" data-pick="${c}" style="background:${c}" title="${c}" aria-label="${c}"></button>`;
      html = `
        <p class="se-pop-title">${btn.title}</p>
        ${btn.dataset.none ? `<button type="button" class="se-pop-item" data-pick="none"><span class="se-nocolor"></span>No ${btn.dataset.none}</button>` : ""}
        <div class="se-chips">${PALETTE.map(chip).join("")}</div>
        ${used.length ? `<p class="se-pop-sub">On this slide</p><div class="se-chips">${used.map(chip).join("")}</div>` : ""}
        <label class="se-pop-item se-custom"><input type="color" data-pick-input value="${/^#[0-9a-f]{6}$/i.test(current || "") ? current : "#0b57d0"}"> Custom colour…</label>`;
      popFor = { kind, prop, btn };
    } else if (kind === "shapes") {
      html = `<p class="se-pop-title">Insert shape</p><div class="se-shape-grid">${[
        ["add-rect", "rect", "Rectangle"], ["add-rounded", "rounded", "Rounded"], ["add-ellipse", "ellipse", "Ellipse"],
        ["add-triangle", "triangle", "Triangle"], ["add-line", "line", "Line"], ["add-arrow", "arrow", "Arrow"]
      ].map(([act, ic, label]) => `<button type="button" class="se-tile" data-act="${act}">${ico(ic, 22)}<span>${label}</span></button>`).join("")}</div>`;
      popFor = { kind, btn };
    } else if (kind === "arrange") {
      const item = (act, ic, label, key = "") => `<button type="button" class="se-pop-item" data-act="${act}">${ico(ic)}<span>${label}</span>${key ? `<kbd>${key}</kbd>` : ""}</button>`;
      html = `
        <p class="se-pop-title">Layer</p>
        ${item("front", "front", "Bring to front", "Ctrl+Shift+]")}${item("forward", "forward", "Bring forward", "Ctrl+]")}${item("backward", "backward", "Send backward", "Ctrl+[")}${item("back", "back", "Send to back", "Ctrl+Shift+[")}
        <p class="se-pop-sub">Line up with the slide</p>
        <div class="se-row">${[["al-l", "alL", "Left"], ["al-c", "alC", "Centre"], ["al-r", "alR", "Right"], ["al-t", "alT", "Top"], ["al-m", "alM", "Middle"], ["al-b", "alB", "Bottom"]].map(([a, ic, l]) => `<button type="button" class="se-btn is-icon" data-act="${a}" title="Align ${l.toLowerCase()} on slide">${ico(ic)}</button>`).join("")}</div>`;
      popFor = { kind, btn };
    }
    pop.innerHTML = html;
    pop.hidden = false;
    btn.classList.add("is-on");
    const host = $("#seEditor").getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    const left = Math.min(r.left - host.left, host.width - pop.offsetWidth - 8);
    pop.style.left = `${Math.max(8, left)}px`;
    pop.style.top = `${r.bottom - host.top + 6}px`;
  }

  function applyColor(prop, value, opts) {
    if (prop === "bg") {
      if (!opts?.noCommit) commit();
      Object.assign(slide(), { bgMode: "color", bgColor: value === "none" ? "#ffffff" : value });
      renderStage();
      refreshThumbSoon();
      renderPanels();
      return;
    }
    const v = value === "none" ? (prop === "highlight" ? "" : "none") : value;
    const props = { [prop]: v };
    // Picking an outline colour with no width gives it a visible width.
    const el = find(selected);
    if (prop === "stroke" && el && !el.strokeWidth && v !== "none") props.strokeWidth = el.type === "line" ? 4 : 3;
    update(props, opts);
  }

  $("#sePop").addEventListener("click", (event) => {
    const pick = event.target.closest("[data-pick]");
    if (pick && popFor?.prop) {
      applyColor(popFor.prop, pick.dataset.pick);
      closePop();
      renderPanels();
    }
  });
  let customCommitted = false;
  $("#sePop").addEventListener("input", (event) => {
    if (!event.target.matches("[data-pick-input]") || !popFor?.prop) return;
    applyColor(popFor.prop, event.target.value, { noCommit: customCommitted });
    customCommitted = true;
  });
  $("#sePop").addEventListener("change", () => { customCommitted = false; renderFmt(); });

  /* ---------- Format strip ---------- */
  const colorBtn = (prop, title, value, glyph, none) => `<button type="button" class="se-btn se-colorbtn" data-pop="color" data-prop="${prop}" title="${title}"${none ? ` data-none="${none}"` : ""}>${glyph}<i style="background:${value && value !== "none" ? value : "transparent"}"${!value || value === "none" ? ' class="is-none"' : ""}></i></button>`;
  const tog = (attr, val, on, title, inner) => `<button type="button" class="se-btn is-icon${on ? " is-on" : ""}" data-${attr}="${val}" title="${title}" aria-pressed="${on ? "true" : "false"}">${inner}</button>`;
  const opts = (list, value, fmt = (v) => v) => {
    const vals = list.includes(value) ? list : [...list, value].sort((a, b) => a - b);
    return vals.map((v) => `<option value="${v}"${v === value ? " selected" : ""}>${fmt(v)}</option>`).join("");
  };
  const tail = (el) => `
    <span class="se-fmt-fill"></span>
    <button type="button" class="se-btn" data-pop="arrange" title="Layer order and alignment">${ico("layers")}<span>Arrange</span></button>
    <button type="button" class="se-btn is-icon${el.locked ? " is-on" : ""}" data-act="lock" title="${el.locked ? "Unlock" : "Lock position"} (Ctrl+L)">${ico(el.locked ? "lock" : "unlock")}</button>
    <button type="button" class="se-btn is-icon" data-act="dup" title="Duplicate (Ctrl+D)">${ico("copy")}</button>
    <button type="button" class="se-btn is-icon is-danger" data-act="del" title="Delete (Del)">${ico("trash")}</button>`;
  const outline = (el) => `
    ${colorBtn("stroke", "Outline colour", el.strokeWidth ? el.stroke : "none", ico("rect"), "outline")}
    <label class="se-mini" title="Outline width">${ico("minus")}<select data-prop="strokeWidth" aria-label="Outline width">${opts(WIDTHS, Number(el.strokeWidth || 0), (v) => (v ? `${v} pt` : "None"))}</select></label>`;

  function renderFmt() {
    const fmt = $("#seFmt");
    const s = slide();
    if (!s) return (fmt.innerHTML = "");
    const el = selected && find(selected);
    if (!el) {
      const tr = s.transition?.type || "none";
      fmt.innerHTML = `
        <span class="se-fmt-title">Slide ${cur + 1}</span>
        ${colorBtn("bg", "Background colour", s.bgMode === "color" ? s.bgColor : "", '<span class="se-glyph">Bg</span>')}
        ${s.bgMode === "color" && s.clean !== s.original ? '<button type="button" class="se-btn" data-act="bg-image" title="Use the slide picture as background">Use slide picture</button>' : ""}
        <span class="se-sep"></span>
        <label class="se-mini is-wide" title="Transition into this slide">${ico("sparkle")}<select data-slideprop="transition" aria-label="Transition">${TRANSITIONS.map(([v, l]) => `<option value="${v}"${v === tr ? " selected" : ""}>${v === "none" ? "No transition" : l}</option>`).join("")}</select></label>
        <span class="se-fmt-fill"></span>
        <span class="se-fmt-hint">Click anything on the slide to format it · double-click text to type</span>`;
      return;
    }
    if (el.type === "text") {
      fmt.innerHTML = `
        <select class="se-font" data-prop="fontFamily" aria-label="Font" style="font-family:${S.cssFamily(el.fontFamily)}">${FONTS.map((f) => `<option${f === el.fontFamily ? " selected" : ""} style="font-family:${S.cssFamily(f)}">${f}</option>`).join("")}</select>
        <span class="se-num">
          <button type="button" class="se-btn is-icon" data-act="size-down" title="Smaller (Ctrl+Shift+<)">${ico("minus", 14)}</button>
          <input type="number" min="6" max="400" value="${Math.round(el.fontSize)}" data-prop="fontSize" aria-label="Font size">
          <button type="button" class="se-btn is-icon" data-act="size-up" title="Bigger (Ctrl+Shift+>)">${ico("plus", 14)}</button>
        </span>
        <span class="se-sep"></span>
        ${tog("toggle", "bold", el.bold, "Bold (Ctrl+B)", "<b>B</b>")}
        ${tog("toggle", "italic", el.italic, "Italic (Ctrl+I)", '<i style="font-family:Georgia,serif">I</i>')}
        ${tog("toggle", "underline", el.underline, "Underline (Ctrl+U)", '<u>U</u>')}
        ${tog("toggle", "strike", el.strike, "Strikethrough", "<s>S</s>")}
        ${colorBtn("color", "Text colour", el.color, '<span class="se-glyph">A</span>')}
        ${colorBtn("highlight", "Highlight", el.highlight || "none", '<span class="se-glyph se-hl">ab</span>', "highlight")}
        <span class="se-sep"></span>
        ${tog("act", "list-bullet", /^•\s/.test(el.text), "Bulleted list", ico("bullets"))}
        ${tog("act", "list-number", /^\d+\.\s/.test(el.text), "Numbered list", ico("numbers"))}
        <span class="se-sep"></span>
        ${["left", "center", "right", "justify"].map((a) => tog("align", a, el.align === a, `Align ${a}`, ico(a))).join("")}
        <span class="se-sep"></span>
        ${[["top", "vtop"], ["middle", "vmiddle"], ["bottom", "vbottom"]].map(([v, ic]) => tog("valign", v, (el.valign || "top") === v, `Place text at the ${v}`, ico(ic))).join("")}
        <label class="se-mini" title="Line spacing">${ico("spacing")}<select data-prop="lineHeight" aria-label="Line spacing">${opts(SPACING, Math.round(el.lineHeight * 100) / 100, (v) => Number(v).toFixed(2).replace(/0$/, ""))}</select></label>
        ${tail(el)}`;
    } else if (isShape(el)) {
      fmt.innerHTML = `
        <span class="se-fmt-title">${elName(el)}</span>
        ${colorBtn("fill", "Fill colour", el.fill, '<span class="se-glyph">Fill</span>', "fill")}
        ${outline(el)}
        ${el.type === "rect" ? `<label class="se-mini is-range" title="Corner roundness">${ico("rounded")}<input type="range" min="0" max="${Math.round(Math.min(el.w, el.h) / 2)}" value="${el.radius || 0}" data-prop="radius" aria-label="Corner roundness"></label>` : ""}
        <span class="se-sep"></span>
        <button type="button" class="se-btn" data-act="shape-text" title="Put a text box on this shape">${ico("text")}<span>Add text</span></button>
        ${tail(el)}`;
    } else if (el.type === "line") {
      fmt.innerHTML = `
        <span class="se-fmt-title">${elName(el)}</span>
        ${colorBtn("stroke", "Line colour", el.stroke, ico("line"))}
        <label class="se-mini" title="Line width">${ico("minus")}<select data-prop="strokeWidth" aria-label="Line width">${opts(WIDTHS.slice(1), Number(el.strokeWidth || 4), (v) => `${v} pt`)}</select></label>
        ${tog("toggle", "arrow", el.arrow, "Arrow head", ico("arrow"))}
        ${tog("toggle", "flip", el.flip, "Flip direction", ico("flip"))}
        ${tail(el)}`;
    } else {
      fmt.innerHTML = `
        <span class="se-fmt-title">${el.detected ? "Picture from the slide" : "Picture"}</span>
        ${outline(el)}
        <span class="se-sep"></span>
        <button type="button" class="se-btn" data-act="replace-image" title="Swap in another picture, same place and size">${ico("image")}<span>Replace</span></button>
        <button type="button" class="se-btn" data-act="fit-image" title="Restore the picture's own proportions">Reset shape</button>
        ${tail(el)}`;
    }
  }

  /* ---------- Inspector ---------- */
  function tabs() {
    return `<div class="se-tabs" role="tablist">
      <button type="button" role="tab" class="${tab === "design" ? "is-on" : ""}" aria-selected="${tab === "design"}" data-tab="design">${ico("design", 14)} Design</button>
      <button type="button" role="tab" class="${tab === "motion" ? "is-on" : ""}" aria-selected="${tab === "motion"}" data-tab="motion">${ico("motion", 14)} Motion</button>
    </div>`;
  }

  function sequence(s) {
    const list = animsOf(s);
    if (!list.length) return `<p class="se-hint">Nothing on this slide animates yet. Select a text box or picture and pick an entrance.</p>`;
    return `<ol class="se-seq">${list.map((e, i) => `<li><button type="button" class="${e.id === selected ? "is-on" : ""}" data-pick-el="${e.id}"><span class="se-seq-n">${i + 1}</span><span class="se-seq-name">${esc(elName(e))}</span><span class="se-seq-fx">${(ENTRANCES.find((x) => x[0] === e.anim.type) || [])[1] || ""}</span></button></li>`).join("")}</ol>`;
  }

  function renderProps() {
    const box = $("#seProps");
    const s = slide();
    if (!s) return (box.innerHTML = "");
    const el = selected && find(selected);
    if (!el) {
      if (tab === "motion") {
        const tr = s.transition || { type: "none", dur: 0.7 };
        box.innerHTML = `${tabs()}
          <p class="se-label">Transition into slide ${cur + 1}</p>
          <div class="se-tiles">${TRANSITIONS.map(([v, l]) => `<button type="button" class="se-tile se-tr-${v}${tr.type === v ? " is-on" : ""}" data-transition="${v}"><span class="se-tr-demo"><i></i></span><span>${l}</span></button>`).join("")}</div>
          <div class="se-field"><span>Speed</span><div class="se-seg">${[[0.4, "Fast"], [0.7, "Medium"], [1.2, "Slow"]].map(([v, l]) => `<label><input type="radio" name="seTrDur" value="${v}"${Math.abs((tr.dur || 0.7) - v) < 0.01 ? " checked" : ""}>${l}</label>`).join("")}</div></div>
          <div class="se-row"><button type="button" class="se-btn is-small" data-act="preview-tr"${tr.type === "none" ? " disabled" : ""}>${ico("play", 14)} Preview</button><button type="button" class="se-btn is-small" data-act="tr-all">Use on all slides</button></div>
          <p class="se-label">Order on this slide</p>
          ${sequence(s)}`;
        return;
      }
      box.innerHTML = `${tabs()}
        <p class="se-label">Slide ${cur + 1}</p>
        <div class="se-field"><span>Background</span>
          <div class="se-seg">
            <label><input type="radio" name="seBg" value="image"${s.bgMode === "image" ? " checked" : ""}>Slide picture</label>
            <label><input type="radio" name="seBg" value="color"${s.bgMode === "color" ? " checked" : ""}>Colour</label>
          </div>
        </div>
        <div class="se-field"><span>Text</span>
          <p class="se-hint">${s.status === "done" ? `${s.elements.filter((e) => e.type === "text").length} text boxes. Double-click text on the slide to edit it; drag to move.` : s.status === "error" ? "This slide couldn't be read; its text stays part of the image." : "Reading…"}</p>
          <div class="se-row"><button type="button" class="se-btn is-small" data-act="reread">Read text again</button><button type="button" class="se-btn is-small" data-act="clear-text">Remove text boxes</button></div>
        </div>
        <div class="se-field"><span>Speaker notes</span><textarea id="seNotes" rows="5" placeholder="Notes for this slide. Saved in the PowerPoint, not shown on the slide.">${esc(s.notes)}</textarea></div>
        <div class="se-row se-slide-actions"><button type="button" class="se-btn is-small" data-act="dup-slide">${ico("copy")} Duplicate slide</button><button type="button" class="se-btn is-small is-danger" data-act="del-slide"${deck.slides.length < 2 ? " disabled" : ""}>${ico("trash")} Delete slide</button></div>`;
      return;
    }
    if (tab === "motion") {
      const a = el.anim || { type: "none" };
      const list = animsOf(s);
      const pos = list.indexOf(el);
      box.innerHTML = `${tabs()}
        <p class="se-label">Entrance · ${esc(elName(el))}</p>
        <div class="se-tiles">${ENTRANCES.map(([v, l]) => `<button type="button" class="se-tile se-an-${v}${a.type === v ? " is-on" : ""}" data-anim="${v}"><span class="se-an-demo"><i></i></span><span>${l}</span></button>`).join("")}</div>
        ${a.type !== "none" ? `
          <div class="se-field"><span>Speed</span><select data-animprop="dur">${DURATIONS.map(([v, l]) => `<option value="${v}"${Math.abs((a.dur || 0.5) - v) < 0.01 ? " selected" : ""}>${l} (${v}s)</option>`).join("")}</select></div>
          <div class="se-field"><span>Plays on click ${pos + 1} of ${list.length}</span>
            <div class="se-row"><button type="button" class="se-btn is-small" data-act="anim-earlier"${pos <= 0 ? " disabled" : ""}>Earlier</button><button type="button" class="se-btn is-small" data-act="anim-later"${pos >= list.length - 1 ? " disabled" : ""}>Later</button><button type="button" class="se-btn is-small" data-act="preview-anim">${ico("play", 14)} Preview</button></div>
          </div>` : ""}
        <p class="se-label">Order on this slide</p>
        ${sequence(s)}`;
      return;
    }
    const k = CM_WIDE / s.w;
    const cm = (v) => (Math.round(v * k * 100) / 100).toFixed(2);
    box.innerHTML = `${tabs()}
      <p class="se-label">${esc(elName(el))}</p>
      ${el.type === "text" ? `<div class="se-field"><span>Text</span><textarea data-prop="text" rows="4">${esc(el.text)}</textarea></div>` : ""}
      ${el.detected && el.type === "image" ? '<p class="se-hint">Cut out of the slide picture. Drag to move, use the handles to resize (Shift keeps its shape), Delete removes it.</p>' : ""}
      <div class="se-field"><span>Position (cm)</span>
        <div class="se-grid2"><label class="se-unit"><b>X</b><input type="number" step="0.1" value="${cm(el.x)}" data-geom="x"></label><label class="se-unit"><b>Y</b><input type="number" step="0.1" value="${cm(el.y)}" data-geom="y"></label></div>
      </div>
      <div class="se-field"><span>Size (cm)</span>
        <div class="se-grid2"><label class="se-unit"><b>W</b><input type="number" step="0.1" min="0" value="${cm(el.w)}" data-geom="w"></label><label class="se-unit"><b>H</b><input type="number" step="0.1" min="0" value="${cm(el.h)}" data-geom="h"></label></div>
        ${el.type === "image" || isShape(el) ? `<label class="se-check"><input type="checkbox" id="seKeepRatio"${el.keepRatio ? " checked" : ""}> Keep proportions</label>` : ""}
      </div>
      ${el.type !== "line" ? `<div class="se-field"><span>Rotation</span>
        <div class="se-row se-rot"><input type="number" step="1" value="${Math.round(el.rotate || 0)}" data-prop="rotate" aria-label="Rotation in degrees"><b>°</b>
          <button type="button" class="se-btn is-small" data-act="rot-left" title="Rotate 90° left">${ico("rotate", 14)}<span>−90°</span></button>
          <button type="button" class="se-btn is-small" data-act="rot-right" title="Rotate 90° right"><span>+90°</span></button>
          ${el.rotate ? '<button type="button" class="se-btn is-small" data-act="rot-reset">Straighten</button>' : ""}
        </div></div>` : ""}
      <div class="se-field"><span>Opacity · ${Math.round((el.opacity ?? 1) * 100)}%</span><input type="range" min="5" max="100" value="${Math.round((el.opacity ?? 1) * 100)}" data-prop="opacity" aria-label="Opacity"></div>
      <div class="se-field"><span>Line up with the slide</span>
        <div class="se-row">${[["al-l", "alL", "left"], ["al-c", "alC", "centre"], ["al-r", "alR", "right"], ["al-t", "alT", "top"], ["al-m", "alM", "middle"], ["al-b", "alB", "bottom"]].map(([a, ic, l]) => `<button type="button" class="se-btn is-icon se-boxed" data-act="${a}" title="Align ${l} on slide">${ico(ic)}</button>`).join("")}</div>
      </div>`;
  }

  /* ---------- Changing elements ---------- */
  function update(props, opts = {}) {
    const el = find(selected);
    if (!el) return;
    if (!opts.noCommit) commit();
    Object.assign(el, props);
    repaint(el);
    refreshThumbSoon();
  }

  function repaint(el) {
    const node = nodeOf(el.id);
    if (!node) return;
    if (editing === el.id) {
      applyBox(node, el);
      styleText(node, node.querySelector(".se-txt"), el);
      fitTextHeight(el, node);
      return;
    }
    const fresh = elementNode(el);
    node.replaceWith(fresh);
    if (el.type === "text") fitTextHeight(el, fresh);
  }

  function fitTextHeight(el, node) {
    const txt = node.querySelector(".se-txt");
    if (!txt) return;
    const need = txt.scrollHeight / zoom;
    if (need > el.h + 1) {
      el.h = need;
      node.style.height = `${el.h * zoom}px`;
    }
  }

  function toggleList(kind) {
    const el = find(selected);
    if (!el || el.type !== "text") return;
    if (editing) stopEditing();
    const lines = String(el.text).split("\n");
    const strip = (l) => l.replace(/^(?:•|\d+\.)\s+/, "");
    const has = kind === "bullet" ? lines.every((l) => /^•\s/.test(l) || !l.trim()) : lines.every((l) => /^\d+\.\s/.test(l) || !l.trim());
    let n = 0;
    const text = lines.map((l) => {
      if (!l.trim()) return l;
      if (has) return strip(l);
      n += 1;
      return `${kind === "bullet" ? "•" : `${n}.`} ${strip(l)}`;
    }).join("\n");
    update({ text });
    renderPanels();
  }

  function stepSize(dir) {
    const el = find(selected);
    if (!el || el.type !== "text") return;
    const v = Math.round(el.fontSize);
    const next = dir > 0 ? SIZES.find((x) => x > v) || v + 20 : [...SIZES].reverse().find((x) => x < v) || Math.max(6, v - 2);
    update({ fontSize: next });
    renderPanels();
  }

  function setGeom(key, cmValue) {
    const el = find(selected);
    if (!el) return;
    const px = Number(cmValue) / (CM_WIDE / slide().w);
    if (!Number.isFinite(px)) return;
    const props = { [key]: Math.round(px) };
    if (el.keepRatio && (key === "w" || key === "h") && el.w && el.h) {
      if (key === "w") props.h = Math.round(px * (el.h / el.w));
      else props.w = Math.round(px * (el.w / el.h));
    }
    update(props, { noCommit: true });
  }

  function onField(event, final) {
    const t = event.target;
    if (t.id === "seNotes") { slide().notes = t.value; return; }
    if (t.id === "seKeepRatio") { const el = find(selected); if (el) el.keepRatio = t.checked; return; }
    if (t.dataset.geom) {
      if (!final) { if (!t.dataset.started) { commit(); t.dataset.started = "1"; } setGeom(t.dataset.geom, t.value); }
      else delete t.dataset.started;
      return;
    }
    if (t.dataset.slideprop === "transition" && final) {
      commit();
      const s = slide();
      s.transition = { type: t.value, dur: s.transition?.dur || 0.7 };
      refreshThumbSoon();
      renderProps();
      return;
    }
    if (t.dataset.animprop && final) {
      const el = find(selected);
      if (el?.anim) { commit(); el.anim = { ...el.anim, [t.dataset.animprop]: Number(t.value) }; }
      return;
    }
    if (t.name === "seBg" && final) { commit(); slide().bgMode = t.value; renderStage(); refreshThumbSoon(); renderFmt(); return; }
    if (t.name === "seTrDur" && final) { commit(); const s = slide(); s.transition = { type: s.transition?.type || "none", dur: Number(t.value) }; return; }
    const prop = t.dataset.prop;
    if (!prop) return;
    let value = t.value;
    if (["fontSize", "lineHeight", "radius", "strokeWidth", "rotate"].includes(prop)) value = Number(value) || 0;
    if (prop === "opacity") value = Number(value) / 100;
    if (prop === "rotate") value = ((value % 360) + 360) % 360;
    if (prop === "text" && editing) stopEditing();
    const live = t.type === "range" || t.tagName === "TEXTAREA" || t.type === "number";
    if (!final) {
      if (live) { if (!t.dataset.started) { commit(); t.dataset.started = "1"; } update({ [prop]: value }, { noCommit: true }); }
      else update({ [prop]: value });
      if (prop === "fontFamily") t.style.fontFamily = S.cssFamily(value);
      if (prop === "opacity") { const lab = t.closest(".se-field")?.querySelector("span"); if (lab) lab.textContent = `Opacity · ${t.value}%`; }
      if (prop === "strokeWidth" || prop === "fontFamily") renderPanels();
    } else {
      delete t.dataset.started;
      // Keep the other panel in step.
      if (t.closest("#seFmt")) renderProps(); else renderFmt();
    }
  }

  for (const id of ["#seProps", "#seFmt"]) {
    $(id).addEventListener("input", (event) => onField(event, false));
    $(id).addEventListener("change", (event) => onField(event, true));
  }

  function onPanelClick(event) {
    const t = event.target.closest("button");
    if (!t || t.dataset.act || t.dataset.pop) return; // handled at app level
    const el = find(selected);
    if (t.dataset.tab) { tab = t.dataset.tab; return renderProps(); }
    if (t.dataset.pickEl) { tab = "motion"; return select(t.dataset.pickEl); }
    if (t.dataset.toggle && el) { update({ [t.dataset.toggle]: !el[t.dataset.toggle] }); return renderPanels(); }
    if (t.dataset.align) { update({ align: t.dataset.align }); return renderPanels(); }
    if (t.dataset.valign) { update({ valign: t.dataset.valign }); return renderPanels(); }
    if (t.dataset.transition) {
      commit();
      const s = slide();
      s.transition = { type: t.dataset.transition, dur: s.transition?.dur || 0.7 };
      refreshThumbSoon();
      renderPanels();
      if (t.dataset.transition !== "none") previewTransition();
      return;
    }
    if (t.dataset.anim && el) {
      commit();
      if (t.dataset.anim === "none") delete el.anim;
      else {
        const order = el.anim?.order || Math.max(0, ...slide().elements.map((e) => (e.anim && e.anim.type !== "none" ? e.anim.order || 0 : 0))) + 1;
        el.anim = { type: t.dataset.anim, dur: el.anim?.dur || 0.5, order };
      }
      renumber(slide());
      refreshThumbSoon();
      renderProps();
      if (el.anim) previewAnim(el);
    }
  }
  $("#seProps").addEventListener("click", onPanelClick);
  // Keep the caret in a text box while using the format strip.
  $("#seFmt").addEventListener("mousedown", (event) => { if (event.target.closest("button")) event.preventDefault(); });
  $("#seFmt").addEventListener("click", onPanelClick);

  function renumber(s) {
    animsOf(s).forEach((e, i) => { e.anim.order = i + 1; });
  }

  /* ---------- Actions ---------- */
  function addElement(el) {
    commit();
    const s = slide();
    s.elements.push(el);
    selected = el.id;
    closePop();
    renderStage();
    renderPanels();
    refreshThumbSoon();
  }

  function centerBox(w, h) {
    const s = slide();
    return { x: Math.round((s.w - w) / 2), y: Math.round((s.h - h) / 2), w, h };
  }

  function moveLayer(dir) {
    const s = slide();
    const i = s.elements.findIndex((e) => e.id === selected);
    if (i < 0) return;
    commit();
    const [el] = s.elements.splice(i, 1);
    if (dir === "front") s.elements.push(el);
    else if (dir === "back") s.elements.unshift(el);
    else s.elements.splice(Math.max(0, Math.min(s.elements.length, i + (dir === "forward" ? 1 : -1))), 0, el);
    renderStage();
    refreshThumbSoon();
    closePop();
  }

  function alignOnSlide(how) {
    const el = find(selected);
    if (!el) return;
    const s = slide();
    const m = Math.round(s.w * 0.04); // safe margin
    const props = { l: { x: m }, c: { x: Math.round((s.w - el.w) / 2) }, r: { x: s.w - el.w - m }, t: { y: m }, m: { y: Math.round((s.h - el.h) / 2) }, b: { y: s.h - el.h - m } }[how];
    update(props);
    renderProps();
  }

  function rotateBy(deg) {
    const el = find(selected);
    if (!el) return;
    update({ rotate: deg === null ? 0 : ((((el.rotate || 0) + deg) % 360) + 360) % 360 });
    renderProps();
  }

  function shiftAnim(dir) {
    const s = slide();
    const list = animsOf(s);
    const i = list.findIndex((e) => e.id === selected);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    commit();
    [list[i].anim.order, list[j].anim.order] = [list[j].anim.order, list[i].anim.order];
    renumber(s);
    renderProps();
  }

  const shapeBase = { opacity: 1, stroke: "#1f1f1f", strokeWidth: 0 };
  const actions = {
    new: () => { $("#seEditor").hidden = true; $("#seStart").hidden = false; app.classList.remove("is-full"); },
    undo, redo,
    "add-text": () => addElement({ id: S.id(), type: "text", ...centerBox(700, 90), text: "Double-click to edit", fontSize: 56, lineHeight: 1.2, color: "#1f1f1f", bold: false, italic: false, align: "left", valign: "top", fontFamily: "Arial", opacity: 1 }),
    "add-rect": () => addElement({ id: S.id(), type: "rect", ...centerBox(420, 260), fill: "#0b57d0", radius: 0, ...shapeBase }),
    "add-rounded": () => addElement({ id: S.id(), type: "rect", ...centerBox(420, 260), fill: "#d2e3fc", radius: 36, ...shapeBase }),
    "add-ellipse": () => addElement({ id: S.id(), type: "ellipse", ...centerBox(300, 300), fill: "#f9ab00", ...shapeBase }),
    "add-triangle": () => addElement({ id: S.id(), type: "triangle", ...centerBox(320, 280), fill: "#188038", ...shapeBase }),
    "add-line": () => addElement({ id: S.id(), type: "line", ...centerBox(520, 0), stroke: "#1f1f1f", strokeWidth: 4, opacity: 1 }),
    "add-arrow": () => addElement({ id: S.id(), type: "line", ...centerBox(520, 0), stroke: "#0b57d0", strokeWidth: 5, arrow: true, opacity: 1 }),
    "add-image": () => { replacing = false; $("#seImageInput").click(); },
    "replace-image": () => { replacing = true; $("#seImageInput").click(); },
    "fit-image": () => {
      const el = find(selected);
      if (!el || el.type !== "image") return;
      const img = new Image();
      img.onload = () => { update({ h: Math.round(el.w * (img.naturalHeight / img.naturalWidth)) }); renderProps(); };
      img.src = el.src;
    },
    "shape-text": () => {
      const el = find(selected);
      if (!el) return;
      const light = /^#(?:[89a-f][0-9a-f]){3}$/i.test(el.fill || "") || el.fill === "none";
      addElement({ id: S.id(), type: "text", x: el.x + 16, y: el.y, w: Math.max(40, el.w - 32), h: el.h, text: "Text", fontSize: Math.max(18, Math.min(64, Math.round(el.h / 4))), lineHeight: 1.2, color: light ? "#1f1f1f" : "#ffffff", bold: true, italic: false, align: "center", valign: "middle", fontFamily: "Arial", opacity: 1, rotate: el.rotate || 0 });
      startEditing(selected);
    },
    original: (btn) => { showOriginal = !showOriginal; btn.classList.toggle("is-on", showOriginal); selected = null; renderStage(); renderPanels(); },
    present: () => present(cur),
    full: () => { app.classList.toggle("is-full"); setTimeout(renderStage, 30); },
    menu: () => { $("#seMenu").hidden = !$("#seMenu").hidden; },
    pptx: () => runExport("pptx"),
    pdf: () => runExport("pdf"),
    png: () => runExport("png"),
    "png-one": () => runExport("png-one"),
    "add-slide": () => {
      commit();
      const first = deck.slides[0];
      const s = S.blankSlide(first?.w, first?.h, "#ffffff");
      deck.slides.splice(cur + 1, 0, s);
      cur += 1;
      selected = null;
      renderAll();
    },
    "dup-slide": () => {
      commit();
      const src = slide();
      const copy = Object.assign(S.newSlide(src.original), { clean: src.clean, bgMode: src.bgMode, bgColor: src.bgColor, notes: src.notes, transition: src.transition ? { ...src.transition } : undefined, status: src.status, elements: JSON.parse(JSON.stringify(src.elements)).map((e) => ({ ...e, id: S.id() })) });
      deck.slides.splice(cur + 1, 0, copy);
      cur += 1;
      renderAll();
    },
    "del-slide": () => {
      if (deck.slides.length < 2) return;
      commit();
      deck.slides.splice(cur, 1);
      cur = Math.min(cur, deck.slides.length - 1);
      selected = null;
      renderAll();
    },
    "bg-image": () => { commit(); slide().bgMode = "image"; renderStage(); refreshThumbSoon(); renderPanels(); },
    reread: () => {
      const s = slide();
      commit();
      s.status = "working";
      renderAll();
      queue = queue.then(async () => {
        showProgress("Reading text on this slide…");
        try { await S.analyze(s, (p) => showProgress(`Reading text… ${Math.round(p * 100)}%`), { objects: $("#seObjects").checked }); } catch (_e) { S.skipAnalysis(s); s.status = "error"; }
        showProgress("");
        if (deck.slides.includes(s)) { renderThumb(deck.slides.indexOf(s)); if (slide() === s) { renderStage(); renderPanels(); } }
      });
    },
    "clear-text": () => { commit(); const s = slide(); s.elements = s.elements.filter((e) => e.type !== "text"); renderStage(); renderPanels(); refreshThumbSoon(); },
    front: () => moveLayer("front"),
    forward: () => moveLayer("forward"),
    backward: () => moveLayer("backward"),
    back: () => moveLayer("back"),
    "al-l": () => alignOnSlide("l"), "al-c": () => alignOnSlide("c"), "al-r": () => alignOnSlide("r"),
    "al-t": () => alignOnSlide("t"), "al-m": () => alignOnSlide("m"), "al-b": () => alignOnSlide("b"),
    "rot-left": () => rotateBy(-90), "rot-right": () => rotateBy(90), "rot-reset": () => rotateBy(null),
    lock: () => { const el = find(selected); if (!el) return; update({ locked: !el.locked }); renderPanels(); },
    dup: () => { const el = find(selected); if (el) addElement({ ...JSON.parse(JSON.stringify(el)), id: S.id(), x: el.x + 30, y: el.y + 30, locked: false, anim: undefined }); },
    del: () => removeSelected(),
    "size-up": () => stepSize(1),
    "size-down": () => stepSize(-1),
    "list-bullet": () => toggleList("bullet"),
    "list-number": () => toggleList("number"),
    "anim-earlier": () => shiftAnim(-1),
    "anim-later": () => shiftAnim(1),
    "preview-anim": () => { const el = find(selected); if (el?.anim) previewAnim(el); },
    "preview-tr": () => previewTransition(),
    "tr-all": () => {
      const tr = slide().transition;
      commit();
      deck.slides.forEach((s) => { s.transition = tr ? { ...tr } : { type: "none", dur: 0.7 }; });
      renderThumbs();
      status(tr && tr.type !== "none" ? `“${TRANSITIONS.find((x) => x[0] === tr.type)[1]}” is now used on all ${deck.slides.length} slides.` : "Transitions removed from all slides.", "ok");
    }
  };

  app.addEventListener("click", (event) => {
    const popBtn = event.target.closest("[data-pop]");
    if (popBtn) return openPop(popBtn);
    const btn = event.target.closest("[data-act]");
    if (btn && actions[btn.dataset.act]) {
      if (btn.disabled) return;
      if (btn.dataset.act !== "menu") $("#seMenu").hidden = true;
      if (!btn.closest("#sePop") || btn.closest(".se-shape-grid") || /^(front|back|forward|backward)$/.test(btn.dataset.act)) closePop();
      return actions[btn.dataset.act](btn);
    }
    const thumb = event.target.closest(".se-thumb");
    if (thumb) {
      stopEditing();
      cur = Number(thumb.dataset.slide);
      selected = null;
      renderAll();
    }
    if (!event.target.closest(".se-split")) $("#seMenu").hidden = true;
    if (!event.target.closest("#sePop")) closePop();
  });

  let replacing = false;
  $("#seImageInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const src = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(file); });
    const img = await createImageBitmap(file);
    const el = find(selected);
    if (replacing && el?.type === "image") {
      update({ src, h: Math.round(el.w * (img.height / img.width)), detected: false });
      renderPanels();
      return;
    }
    const s = slide();
    const w = Math.min(s.w * 0.5, img.width);
    addElement({ id: S.id(), type: "image", ...centerBox(Math.round(w), Math.round((w * img.height) / img.width)), src, opacity: 1, keepRatio: true });
  });

  function removeSelected() {
    if (!selected) return;
    commit();
    const s = slide();
    s.elements = s.elements.filter((e) => e.id !== selected);
    selected = null;
    renumber(s);
    renderStage();
    renderPanels();
    refreshThumbSoon();
  }

  /* ---------- Direct manipulation ---------- */
  let drag = null;

  // Snap lines: slide edges and centre, and other elements' edges and centres.
  function snapTargets(el) {
    const s = slide();
    const xs = [0, s.w / 2, s.w];
    const ys = [0, s.h / 2, s.h];
    for (const o of s.elements) {
      if (o.id === el.id || o.rotate) continue;
      xs.push(o.x, o.x + o.w / 2, o.x + o.w);
      ys.push(o.y, o.y + o.h / 2, o.y + o.h);
    }
    return { xs, ys };
  }
  function snapAxis(pos, size, targets, tol) {
    let best = null;
    for (const t of targets) {
      for (const [off, kind] of [[0, 0], [size / 2, 1], [size, 2]]) {
        const d = t - (pos + off);
        if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line: t, kind };
      }
    }
    return best;
  }
  function showGuides(lines) {
    const stage = $("#seStage");
    stage.querySelectorAll(".se-guide").forEach((g) => g.remove());
    for (const [axis, v] of lines) {
      const g = document.createElement("div");
      g.className = `se-guide is-${axis}`;
      g.style[axis === "x" ? "left" : "top"] = `${v * zoom}px`;
      stage.append(g);
    }
  }

  // Clicking the grey area around the slide clears the selection.
  $("#seWrap").addEventListener("pointerdown", (event) => {
    if (event.target !== event.currentTarget) return;
    stopEditing();
    if (selected) select(null);
  });
  $("#seStage").addEventListener("pointerdown", (event) => {
    const node = event.target.closest(".se-el");
    if (!node) {
      stopEditing();
      if (selected) select(null);
      return;
    }
    const idv = node.dataset.id;
    if (editing === idv) return; // let the caret move
    const el = find(idv);
    if (!el) return;
    event.preventDefault();
    if (selected !== idv) select(idv);
    if (el.locked) return;
    const handle = event.target.closest("[data-handle]")?.dataset.handle || null;
    const r = node.getBoundingClientRect();
    drag = { id: idv, handle, sx: event.clientX, sy: event.clientY, cx: r.left + r.width / 2, cy: r.top + r.height / 2, start: { x: el.x, y: el.y, w: el.w, h: el.h, rotate: el.rotate || 0 }, moved: false, before: snapshot(), snap: snapTargets(el) };
    $("#seStage").setPointerCapture(event.pointerId);
  });
  $("#seStage").addEventListener("pointermove", (event) => {
    if (!drag) return;
    const el = find(drag.id);
    if (!el) return;
    let dx = (event.clientX - drag.sx) / zoom;
    let dy = (event.clientY - drag.sy) / zoom;
    if (!drag.moved && Math.hypot(dx, dy) < 2) return;
    drag.moved = true;
    const st = drag.start;
    const guides = [];
    if (drag.handle === "rot") {
      let deg = (Math.atan2(event.clientY - drag.cy, event.clientX - drag.cx) * 180) / Math.PI + 90;
      if (event.shiftKey) deg = Math.round(deg / 15) * 15;
      else if ([0, 90, 180, 270, 360, -90].some((a) => Math.abs(deg - a) < 3)) deg = Math.round(deg / 90) * 90;
      el.rotate = ((Math.round(deg) % 360) + 360) % 360;
      status(`Rotation ${el.rotate}°`);
    } else if (!drag.handle) {
      let x = st.x + dx, y = st.y + dy;
      if (!event.altKey && !st.rotate) {
        const tol = 6 / zoom;
        const sx = snapAxis(x, st.w, drag.snap.xs, tol);
        const sy = snapAxis(y, st.h, drag.snap.ys, tol);
        if (sx) { x += sx.d; guides.push(["x", sx.line]); }
        if (sy) { y += sy.d; guides.push(["y", sy.line]); }
      }
      if (event.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) y = st.y; else x = st.x; }
      el.x = Math.round(x);
      el.y = Math.round(y);
    } else {
      // Work in the element's own (rotated) frame.
      const a = (-(st.rotate || 0) * Math.PI) / 180;
      [dx, dy] = [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
      const h = drag.handle;
      const minW = el.type === "line" ? 0 : 20, minH = el.type === "line" ? 0 : 16;
      let { x, y, w, h: hh } = st;
      if (h.includes("e")) w = Math.max(minW, st.w + dx);
      if (h.includes("s")) hh = Math.max(minH, st.h + dy);
      if (h.includes("w")) { w = Math.max(minW, st.w - dx); x = st.x + st.w - w; }
      if (h.includes("n")) { hh = Math.max(minH, st.h - dy); y = st.y + st.h - hh; }
      const keep = (event.shiftKey || el.keepRatio) && el.type !== "text" && el.type !== "line" && h.length === 2;
      if (keep && st.h) { const ratio = st.w / st.h; if (w / hh > ratio) w = hh * ratio; else hh = w / ratio; if (h.includes("w")) x = st.x + st.w - w; if (h.includes("n")) y = st.y + st.h - hh; }
      Object.assign(el, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) });
    }
    showGuides(guides);
    const node = nodeOf(el.id);
    if (node) {
      if (drag.handle && drag.handle !== "rot" && el.type !== "text" && el.type !== "image") {
        paint(node, el); // shapes/lines redraw at the new size
        addHandles(node, el);
      } else applyBox(node, el);
    }
  });
  $("#seStage").addEventListener("pointerup", () => {
    if (!drag) return;
    showGuides([]);
    if (drag.moved) {
      history.push(drag.before);
      future = [];
      const el = find(drag.id);
      const node = el && nodeOf(el.id);
      if (el?.type === "text" && node) fitTextHeight(el, node);
      refreshThumbSoon();
      renderProps();
      if (drag.handle === "rot") status("");
    }
    drag = null;
  });

  // Pointer capture retargets clicks to the stage, so hit-test by position.
  const hitAt = (x, y) => document.elementsFromPoint(x, y).find((n) => n.classList?.contains("se-el")) || null;

  $("#seStage").addEventListener("dblclick", (event) => {
    const hit = hitAt(event.clientX, event.clientY);
    const node = hit && hit.classList.contains("se-text") ? hit : null;
    if (!node) {
      if (hit && isShape(find(hit.dataset.id))) { selected = hit.dataset.id; actions["shape-text"](); return; }
      if (!hit && slide()?.status === "done" && !showOriginal) {
        // Double-click empty space: new text box there.
        const rect = $("#seStage").getBoundingClientRect();
        actions["add-text"]();
        update({ x: Math.round((event.clientX - rect.left) / zoom - 20), y: Math.round((event.clientY - rect.top) / zoom - 40), text: "" }, { noCommit: true });
        startEditing(selected);
      }
      return;
    }
    if (find(node.dataset.id)?.locked) return;
    startEditing(node.dataset.id);
  });

  function startEditing(idv) {
    const node = nodeOf(idv);
    const el = find(idv);
    const txt = node?.querySelector(".se-txt");
    if (!node || !el || !txt) return;
    editing = idv;
    commit();
    node.querySelectorAll(".se-handle, .se-locktag").forEach((h) => h.remove());
    txt.contentEditable = "plaintext-only";
    if (txt.contentEditable !== "plaintext-only") txt.contentEditable = "true";
    node.classList.add("is-editing");
    txt.focus();
    const range = document.createRange();
    range.selectNodeContents(txt);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    txt.oninput = () => {
      el.text = txt.innerText.replace(/\n$/, "");
      fitTextHeight(el, node);
      const ta = $('#seProps textarea[data-prop="text"]');
      if (ta) ta.value = el.text;
      refreshThumbSoon();
    };
  }

  // Clicking anywhere outside the box being typed in ends editing, except
  // the format strip, which formats the box being typed in.
  document.addEventListener("pointerdown", (event) => {
    if (!editing) return;
    if (event.target.closest(`.se-el[data-id="${CSS.escape(editing)}"]`)) return;
    if (event.target.closest("#seFmt, #sePop")) return;
    stopEditing();
  }, true);

  function stopEditing() {
    if (!editing) return;
    const node = nodeOf(editing);
    const el = find(editing);
    editing = null;
    if (node && el) {
      const txt = node.querySelector(".se-txt");
      node.classList.remove("is-editing");
      if (txt) {
        txt.contentEditable = "false";
        el.text = txt.innerText.replace(/\n$/, "");
      }
      if (!el.text.trim()) {
        slide().elements = slide().elements.filter((e) => e !== el);
        selected = null;
      }
    }
    renderStage();
    renderPanels();
    refreshThumbSoon();
  }

  document.addEventListener("keydown", (event) => {
    if ($("#seEditor").hidden) return;
    if (!$("#sePresent").hidden) return;
    const typing = editing || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const el = selected && find(selected);
    if (mod && key === "z" && !typing) { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if (mod && key === "y" && !typing) { event.preventDefault(); redo(); return; }
    if (event.key === "Escape") { if (!$("#sePop").hidden) closePop(); else if (editing) stopEditing(); else if (selected) select(null); else app.classList.remove("is-full"); return; }
    if (event.key === "F5") { event.preventDefault(); present(event.shiftKey ? cur : 0); return; }
    // Text styling works while typing too (whole box).
    if (mod && el?.type === "text" && ["b", "i", "u"].includes(key)) {
      event.preventDefault();
      const prop = { b: "bold", i: "italic", u: "underline" }[key];
      update({ [prop]: !el[prop] });
      renderPanels();
      return;
    }
    if (mod && event.shiftKey && el?.type === "text" && (event.key === ">" || event.key === "." || event.key === "<" || event.key === ",")) { event.preventDefault(); stepSize(event.key === ">" || event.key === "." ? 1 : -1); return; }
    if (typing) return;
    if (mod && key === "l" && el) { event.preventDefault(); actions.lock(); return; }
    if (mod && (event.key === "]" || event.key === "[" || event.code === "BracketRight" || event.code === "BracketLeft") && el) {
      event.preventDefault();
      const up = event.key === "]" || event.code === "BracketRight";
      moveLayer(event.shiftKey ? (up ? "front" : "back") : (up ? "forward" : "backward"));
      return;
    }
    if (mod && key === "c" && el) { clipboard = JSON.parse(JSON.stringify(el)); status("Copied. Paste with Ctrl+V, on any slide."); return; }
    if (mod && key === "x" && el) { clipboard = JSON.parse(JSON.stringify(el)); removeSelected(); return; }
    if (mod && key === "v" && clipboard) {
      event.preventDefault();
      const same = slide().elements.some((e) => e.x === clipboard.x && e.y === clipboard.y);
      addElement({ ...JSON.parse(JSON.stringify(clipboard)), id: S.id(), x: clipboard.x + (same ? 30 : 0), y: clipboard.y + (same ? 30 : 0), anim: undefined });
      return;
    }
    if (mod && key === "d" && selected) { event.preventDefault(); actions.dup(); return; }
    if ((event.key === "Delete" || event.key === "Backspace") && selected) { event.preventDefault(); removeSelected(); return; }
    if (event.key === "Enter" && el?.type === "text" && !el.locked) { event.preventDefault(); startEditing(selected); return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      if (el) {
        if (el.locked) return;
        const step = event.shiftKey ? 10 : 1;
        update({ x: el.x + arrows[event.key][0] * step, y: el.y + arrows[event.key][1] * step }, { noCommit: true });
      } else if (event.key === "ArrowDown" || event.key === "ArrowRight") { cur = Math.min(deck.slides.length - 1, cur + 1); renderAll(); }
      else { cur = Math.max(0, cur - 1); renderAll(); }
    }
  });

  let resizeTimer = 0;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderStage, 120); });

  /* ---------- Motion: transitions and entrance animations ---------- */
  const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
  function tween(ms, fn) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / ms);
        fn(p);
        if (p < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  // Paint the frame between slide pictures A and B at progress p.
  function paintTransition(ctx, A, B, type, p) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const e = easeInOut(p);
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const draw = (img, x = 0, y = 0, sw = w, sh = h) => img && ctx.drawImage(img, x, y, sw, sh);
    if (type === "push") { draw(A, 0, -e * h); draw(B, 0, h - e * h); }
    else if (type === "cover") { draw(A); draw(B, w - e * w, 0); }
    else if (type === "uncover") { draw(B); draw(A, -e * w, 0); }
    else if (type === "wipe") { draw(A); ctx.beginPath(); ctx.rect(0, 0, e * w, h); ctx.clip(); draw(B); }
    else if (type === "split") { draw(A); ctx.beginPath(); ctx.rect(0, h / 2 - (e * h) / 2, w, e * h); ctx.clip(); draw(B); }
    else if (type === "circle") { draw(A); ctx.beginPath(); ctx.arc(w / 2, h / 2, (e * Math.hypot(w, h)) / 2, 0, Math.PI * 2); ctx.clip(); draw(B); }
    else if (type === "zoom") { draw(A); ctx.globalAlpha = e; const k = 0.4 + 0.6 * e; draw(B, (w * (1 - k)) / 2, (h * (1 - k)) / 2, w * k, h * k); }
    else if (type === "bars") {
      draw(A);
      const n = 28;
      const shown = Math.floor(p * n);
      ctx.beginPath();
      for (let i = 0; i < n; i += 1) if (((i * 17) % n) < shown) ctx.rect((i * w) / n, 0, w / n + 1, h);
      ctx.clip();
      draw(B);
    } else if (type === "dissolve") {
      draw(A);
      const cell = Math.max(8, Math.round(w / 48));
      ctx.beginPath();
      for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
        const r = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        if (r < p) ctx.rect(x, y, cell, cell);
      }
      ctx.clip();
      draw(B);
    } else if (type === "cut") { draw(p < 0.5 ? A : B); }
    else { draw(A); ctx.globalAlpha = e; draw(B); }
    ctx.restore();
  }

  // Preview overlays on the stage.
  function overlay() {
    const s = slide();
    const c = document.createElement("canvas");
    c.className = "se-preview";
    c.width = Math.round(s.w * zoom * devicePixelRatio);
    c.height = Math.round(s.h * zoom * devicePixelRatio);
    $("#seStage").append(c);
    return c;
  }
  let previewing = false;
  async function previewTransition() {
    const s = slide();
    const tr = s.transition;
    if (!tr || tr.type === "none" || previewing) return;
    previewing = true;
    const c = overlay();
    const sc = zoom * devicePixelRatio;
    const prev = deck.slides[cur - 1];
    const A = prev ? S.slideCanvas(prev, sc) : null;
    const B = S.slideCanvas(s, sc);
    await tween((tr.dur || 0.7) * 1000, (p) => paintTransition(c.getContext("2d"), A, B, tr.type, p));
    c.remove();
    previewing = false;
  }
  async function previewAnim(el) {
    if (previewing || !el.anim) return;
    previewing = true;
    const s = slide();
    const c = overlay();
    const sc = zoom * devicePixelRatio;
    const ctx = c.getContext("2d");
    await tween((el.anim.dur || 0.5) * 1000, (p) => {
      ctx.clearRect(0, 0, c.width, c.height);
      S.drawSlide(ctx, s, sc, { anim: { id: el.id, type: el.anim.type, p } });
    });
    await new Promise((r) => setTimeout(r, 150));
    c.remove();
    previewing = false;
  }

  /* ---------- Present ---------- */
  const pres = { i: 0, step: 0, busy: false };
  const presScale = (s) => Math.min(window.innerWidth / s.w, window.innerHeight / s.h) * devicePixelRatio;
  function frameOf(s, step, anim) {
    const sc = presScale(s);
    const c = document.createElement("canvas");
    c.width = Math.round(s.w * sc);
    c.height = Math.round(s.h * sc);
    const hidden = new Set(animsOf(s).slice(step).map((e) => e.id));
    if (anim) hidden.delete(anim.id);
    S.drawSlide(c.getContext("2d"), s, sc, { hidden, anim });
    return c;
  }
  function presCanvas(s) {
    const c = $("#sePresent canvas");
    const sc = presScale(s);
    const w = Math.round(s.w * sc), h = Math.round(s.h * sc);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    c.style.width = `${w / devicePixelRatio}px`;
    return c;
  }
  function showFrame() {
    const s = deck.slides[pres.i];
    if (!s) return;
    const c = presCanvas(s);
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(frameOf(s, pres.step), 0, 0);
  }
  function present(i) {
    stopEditing();
    closePop();
    Object.assign(pres, { i, step: 0, busy: false });
    const box = $("#sePresent");
    box.hidden = false;
    box.requestFullscreen?.().catch(() => {});
    showFrame();
  }
  async function presNext() {
    if (pres.busy) return;
    const s = deck.slides[pres.i];
    const list = animsOf(s);
    if (pres.step < list.length) {
      const el = list[pres.step];
      pres.busy = true;
      const c = presCanvas(s);
      const ctx = c.getContext("2d");
      await tween((el.anim.dur || 0.5) * 1000, (p) => { ctx.drawImage(frameOf(s, pres.step, { id: el.id, type: el.anim.type, p }), 0, 0); });
      pres.step += 1;
      pres.busy = false;
      return showFrame();
    }
    if (pres.i >= deck.slides.length - 1) return endPresent();
    const A = presCanvas(s);
    const from = document.createElement("canvas");
    from.width = A.width;
    from.height = A.height;
    from.getContext("2d").drawImage(A, 0, 0);
    pres.i += 1;
    pres.step = 0;
    const next = deck.slides[pres.i];
    const tr = next.transition;
    if (tr && tr.type && tr.type !== "none") {
      pres.busy = true;
      const to = frameOf(next, 0);
      const c = presCanvas(next);
      await tween((tr.dur || 0.7) * 1000, (p) => paintTransition(c.getContext("2d"), from, to, tr.type, p));
      pres.busy = false;
    }
    showFrame();
  }
  function presPrev() {
    if (pres.busy) return;
    if (pres.step > 0) pres.step -= 1;
    else if (pres.i > 0) { pres.i -= 1; pres.step = animsOf(deck.slides[pres.i]).length; }
    showFrame();
  }
  function endPresent() {
    $("#sePresent").hidden = true;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  $("#sePresent").addEventListener("click", (event) => {
    if (event.clientX < window.innerWidth / 4) presPrev();
    else presNext();
  });
  document.addEventListener("keydown", (event) => {
    if ($("#sePresent").hidden) return;
    if (event.key === "Escape") return endPresent();
    if (["ArrowRight", "ArrowDown", " ", "PageDown", "Enter"].includes(event.key)) { event.preventDefault(); presNext(); }
    if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(event.key)) { event.preventDefault(); presPrev(); }
  });
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && !$("#sePresent").hidden) endPresent(); else if (!$("#sePresent").hidden) showFrame(); });

  /* ---------- Export ---------- */
  async function runExport(kind) {
    stopEditing();
    await queue; // wait for OCR to finish
    const prog = (i, n) => status(`Exporting slide ${Math.min(n, i + 1)} of ${n}…`);
    try {
      if (kind === "pptx") await S.exportPptx(deck, `${deck.title} (editable).pptx`, prog);
      else if (kind === "pdf") await S.exportPdf(deck, `${deck.title} (edited).pdf`, prog);
      else if (kind === "png") await S.exportPngs(deck, deck.title, prog);
      else if (kind === "png-one") await S.exportPngs({ slides: [slide()] }, `${deck.title} - slide ${cur + 1}`, prog);
      const motion = deck.slides.some((x) => (x.transition && x.transition.type !== "none") || animsOf(x).length);
      status(kind === "pptx" ? `PowerPoint downloaded${motion ? ", with your transitions and animations" : ""}. Opens in PowerPoint, Keynote or Google Slides (File → Import).` : "Downloaded.", "ok");
    } catch (error) {
      status(error.message || "Export failed.", "error");
    }
  }
})();
