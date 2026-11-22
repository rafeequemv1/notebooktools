/* NotebookLM slide deck editor: open a slide deck PDF (or slide images),
   OCR turns the text into editable boxes, edit everything, export PPTX,
   PDF or PNG. Runs entirely in the browser. Uses NTPdf + NTSlides. */
(() => {
  const P = NTPdf;
  const S = NTSlides;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = NTTools.esc;
  const app = $("#seApp");
  if (!app) return;

  const FONTS = ["Arial", "Helvetica", "Georgia", "Times New Roman", "Verdana", "Trebuchet MS", "Courier New"];
  const SWATCHES = ["#ffffff", "#f6f8fc", "#1f1f1f", "#0b57d0", "#188038", "#f9ab00", "#d93025", "#a142f4"];

  const deck = { title: "slides", slides: [] };
  let cur = 0;
  let selected = null; // element id
  let editing = null; // element id being typed into
  let zoom = 0.5;
  let showOriginal = false;
  let queue = Promise.resolve();
  let history = [];
  let future = [];

  /* ---------- Shell ---------- */
  app.innerHTML = `
    <div class="se-start" id="seStart">
      <div id="seDrop"></div>
      <label class="se-ocr-opt"><input type="checkbox" id="seOcr" checked> Make the text editable (reads slides with OCR, English)</label>
      <label class="se-ocr-opt"><input type="checkbox" id="seObjects" checked> Separate pictures and shapes so you can move, resize or delete them</label>
      <ul class="se-points">
        <li><b>Edit text</b> right on the slide: click, double-click to type, drag to move.</li>
        <li><b>Download PowerPoint</b> with real text boxes. Opens in PowerPoint, Keynote and Google Slides.</li>
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
          <button type="button" class="se-btn is-icon" data-act="add-rect" title="Add a rectangle">${ico("rect")}</button>
          <button type="button" class="se-btn is-icon" data-act="add-ellipse" title="Add an ellipse">${ico("ellipse")}</button>
          <button type="button" class="se-btn is-icon" data-act="add-image" title="Add an image">${ico("image")}</button>
          <span class="se-sep"></span>
          <button type="button" class="se-btn" data-act="original" title="Compare with the original slide">${ico("eye")}<span>Original</span></button>
        </div>
        <div class="se-bar-group">
          <button type="button" class="se-btn" data-act="present" title="Present (full screen)">${ico("play")}<span>Present</span></button>
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
      <div class="se-body">
        <aside class="se-pages" aria-label="Slides">
          <p class="se-label">Slides</p>
          <div class="se-thumbs" id="seThumbs"></div>
          <button type="button" class="se-add-slide" data-act="add-slide">${ico("plus")} New slide</button>
        </aside>
        <div class="se-stage-wrap" id="seWrap"><div class="se-stage" id="seStage"></div></div>
        <aside class="se-props" id="seProps" aria-label="Properties"></aside>
      </div>
      <p class="se-status" id="seStatus" role="status"></p>
    </div>
    <div class="se-present" id="sePresent" hidden><canvas></canvas><p class="se-present-hint">← → to move · Esc to exit</p></div>
    <input type="file" id="seImageInput" accept="image/*" hidden>`;

  function ico(name) {
    const d = {
      upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
      undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
      redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
      text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
      rect: '<rect x="4" y="6" width="16" height="12" rx="2"/>',
      ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6"/>',
      image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-5-5-8 8"/>',
      eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      play: '<path d="M7 5v14l11-7z"/>',
      expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
      download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/>',
      caret: '<path d="m6 9 6 6 6-6"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      front: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
      back: '<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M20 8v11a1 1 0 0 1-1 1H8"/>',
      copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
      trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'
    }[name];
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  }

  const slide = () => deck.slides[cur];
  const find = (idv) => slide()?.elements.find((e) => e.id === idv);
  const status = (msg, type = "") => {
    const el = $("#seStatus");
    el.textContent = msg || "";
    el.className = `se-status${type ? ` is-${type}` : ""}`;
  };

  /* ---------- History ---------- */
  function snapshot() {
    return JSON.stringify({ cur, order: deck.slides.map((s) => s.id), slides: deck.slides.map((s) => ({ id: s.id, bgMode: s.bgMode, bgColor: s.bgColor, notes: s.notes, elements: s.elements })) });
  }
  const canvases = new Map(); // slide id → { original, clean, w, h, status }
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
      return Object.assign(base, { bgMode: saved.bgMode, bgColor: saved.bgColor, notes: saved.notes, elements: JSON.parse(JSON.stringify(saved.elements)) });
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
    try {
      const pdfs = files.filter((f) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name));
      const images = files.filter((f) => /^image\//.test(f.type));
      deck.title = P.baseName((pdfs[0] || images[0] || { name: "slides" }).name);
      for (const f of pdfs) {
        const { pdf, pageCount } = await S.loadPdf(await P.bytesOf(f));
        for (let i = 1; i <= pageCount; i += 1) {
          status(`Opening slide ${i} of ${pageCount}…`);
          deck.slides.push(S.newSlide(await S.renderOriginal(pdf, i)));
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
      }
      if (!deck.slides.length) throw new Error("No slides found in that file.");
    } catch (error) {
      status(error.message || "That file couldn't be opened. If the PDF has a password, remove it first.", "error");
      return;
    }
    renderAll();
    status(ocr ? "Reading the text on each slide. You can start editing slides that are ready." : "Opened. Text stays part of the slide image.");
    deck.slides.forEach((s, i) => {
      queue = queue.then(async () => {
        if (!deck.slides.includes(s)) return;
        if (!ocr) {
          S.skipAnalysis(s);
        } else {
          showProgress(`Reading text: slide ${i + 1} of ${deck.slides.length}`);
          try {
            await S.analyze(s, (p) => showProgress(`Reading text: slide ${i + 1} of ${deck.slides.length} · ${Math.round(p * 100)}%`), { objects: objectsOn });
          } catch (_error) {
            S.skipAnalysis(s);
            s.status = "error";
          }
        }
        renderThumb(deck.slides.indexOf(s));
        if (deck.slides[cur] === s) {
          renderStage();
          if (!selected) renderProps();
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
    status: (msg, type) => {
      $("#seStart").hidden = true;
      $("#seEditor").hidden = false;
      status(msg, type);
    }
  };

  function showProgress(text) {
    const chip = $("#seProgress");
    chip.hidden = !text;
    chip.textContent = text;
  }

  /* ---------- Render ---------- */
  function renderAll() {
    renderThumbs();
    renderStage();
    renderProps();
    $("#seCount").textContent = deck.slides.length ? `Slide ${cur + 1} of ${deck.slides.length}` : "";
  }

  function renderThumbs() {
    const box = $("#seThumbs");
    box.innerHTML = deck.slides.map((s, i) => `
      <button type="button" class="se-thumb${i === cur ? " is-on" : ""}" data-slide="${i}" aria-label="Slide ${i + 1}">
        <span class="se-thumb-n">${i + 1}</span><span class="se-thumb-img"></span>
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

  function elementNode(el) {
    const node = document.createElement("div");
    node.className = `se-el se-${el.type}${el.id === selected ? " is-selected" : ""}`;
    node.dataset.id = el.id;
    applyBox(node, el);
    if (el.type === "text") {
      setText(node, el);
      applyText(node, el);
    } else if (el.type === "rect" || el.type === "ellipse") {
      node.style.background = el.fill;
      node.style.borderRadius = el.type === "ellipse" ? "50%" : `${(el.radius || 0) * zoom}px`;
    } else if (el.type === "image") {
      const img = document.createElement("img");
      img.src = el.src;
      img.alt = "";
      img.draggable = false;
      node.append(img);
    }
    node.style.opacity = el.opacity ?? 1;
    if (el.id === selected) {
      ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach((d) => {
        const h = document.createElement("span");
        h.className = `se-handle is-${d}`;
        h.dataset.handle = d;
        node.append(h);
      });
    }
    return node;
  }

  // Text with "Label:" runs in their own colour/weight (NotebookLM style).
  function setText(node, el) {
    if (!el.labelColor) {
      node.textContent = el.text;
      return;
    }
    node.innerHTML = String(el.text).split("\n").map((line) => S.lineRuns(el, line).map((r) => r.label
      ? `<span style="color:${el.labelColor};font-weight:${el.labelBold ? 700 : 400}">${esc(r.text)}</span>`
      : esc(r.text)).join("")).join("\n");
  }

  function applyBox(node, el) {
    node.style.left = `${el.x * zoom}px`;
    node.style.top = `${el.y * zoom}px`;
    node.style.width = `${el.w * zoom}px`;
    node.style.height = `${el.h * zoom}px`;
  }

  function applyText(node, el) {
    node.style.fontFamily = S.cssFamily(el.fontFamily);
    node.style.fontSize = `${el.fontSize * zoom}px`;
    node.style.lineHeight = String(el.lineHeight);
    node.style.color = el.color;
    node.style.fontWeight = el.bold ? "700" : "400";
    node.style.fontStyle = el.italic ? "italic" : "normal";
    node.style.textAlign = el.align;
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
      prev.querySelectorAll(".se-handle").forEach((h) => h.remove());
    }
    selected = idv;
    const node = idv && nodeOf(idv);
    if (node) {
      node.classList.add("is-selected");
      ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach((d) => {
        const h = document.createElement("span");
        h.className = `se-handle is-${d}`;
        h.dataset.handle = d;
        node.append(h);
      });
    }
    renderProps();
  }

  /* ---------- Properties ---------- */
  function renderProps() {
    const box = $("#seProps");
    const s = slide();
    if (!s) return (box.innerHTML = "");
    const el = selected && find(selected);
    if (!el) {
      box.innerHTML = `
        <p class="se-label">Slide ${cur + 1}</p>
        <div class="se-field"><span>Background</span>
          <div class="se-seg">
            <label><input type="radio" name="seBg" value="image"${s.bgMode === "image" ? " checked" : ""}>Slide image</label>
            <label><input type="radio" name="seBg" value="color"${s.bgMode === "color" ? " checked" : ""}>Colour</label>
          </div>
          <div class="se-swatches">${SWATCHES.map((c) => `<button type="button" class="se-swatch" data-bg="${c}" style="background:${c}" aria-label="Background ${c}"></button>`).join("")}<input type="color" id="seBgColor" value="${s.bgColor}" aria-label="Custom background colour"></div>
        </div>
        <div class="se-field"><span>Text</span>
          <p class="se-hint">${s.status === "done" ? `${s.elements.filter((e) => e.type === "text").length} text boxes. Double-click text on the slide to edit it; drag to move.` : s.status === "error" ? "This slide couldn't be read; its text stays part of the image." : "Reading…"}</p>
          <div class="se-row"><button type="button" class="se-btn is-small" data-act="reread">Read text again</button><button type="button" class="se-btn is-small" data-act="clear-text">Remove text boxes</button></div>
        </div>
        <div class="se-field"><span>Speaker notes</span><textarea id="seNotes" rows="5" placeholder="Notes for this slide. Saved in the PowerPoint, not shown on the slide.">${esc(s.notes)}</textarea></div>
        <div class="se-row se-slide-actions"><button type="button" class="se-btn is-small" data-act="dup-slide">${ico("copy")} Duplicate slide</button><button type="button" class="se-btn is-small is-danger" data-act="del-slide"${deck.slides.length < 2 ? " disabled" : ""}>${ico("trash")} Delete slide</button></div>`;
      return;
    }
    const common = `
      <div class="se-row se-layer">
        <button type="button" class="se-btn is-small" data-act="front">${ico("front")} Front</button>
        <button type="button" class="se-btn is-small" data-act="back">${ico("back")} Back</button>
        <button type="button" class="se-btn is-small" data-act="dup">${ico("copy")}</button>
        <button type="button" class="se-btn is-small is-danger" data-act="del">${ico("trash")}</button>
      </div>
      <div class="se-field"><span>Opacity</span><input type="range" min="10" max="100" value="${Math.round((el.opacity ?? 1) * 100)}" data-prop="opacity"></div>`;
    if (el.type === "text") {
      box.innerHTML = `
        <p class="se-label">Text box</p>
        <div class="se-field"><span>Text</span><textarea data-prop="text" rows="4">${esc(el.text)}</textarea></div>
        <div class="se-field"><span>Font</span><select data-prop="fontFamily">${FONTS.map((f) => `<option${f === el.fontFamily ? " selected" : ""}>${f}</option>`).join("")}</select></div>
        <div class="se-grid2">
          <div class="se-field"><span>Size</span><input type="number" min="6" max="400" value="${Math.round(el.fontSize)}" data-prop="fontSize"></div>
          <div class="se-field"><span>Line height</span><input type="number" min="0.8" max="3" step="0.05" value="${el.lineHeight}" data-prop="lineHeight"></div>
        </div>
        <div class="se-field"><span>Colour</span><div class="se-swatches">${SWATCHES.map((c) => `<button type="button" class="se-swatch" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join("")}<input type="color" value="${el.color}" data-prop="color" aria-label="Text colour"></div></div>
        <div class="se-row">
          <button type="button" class="se-toggle${el.bold ? " is-on" : ""}" data-toggle="bold" title="Bold"><b>B</b></button>
          <button type="button" class="se-toggle${el.italic ? " is-on" : ""}" data-toggle="italic" title="Italic"><i>I</i></button>
          <span class="se-sep"></span>
          ${["left", "center", "right"].map((a) => `<button type="button" class="se-toggle${el.align === a ? " is-on" : ""}" data-align="${a}" title="Align ${a}">${{ left: "⟸", center: "⟺", right: "⟹" }[a]}</button>`).join("")}
        </div>
        ${common}`;
    } else if (el.type === "rect" || el.type === "ellipse") {
      box.innerHTML = `
        <p class="se-label">${el.type === "rect" ? "Rectangle" : "Ellipse"}</p>
        <div class="se-field"><span>Fill</span><div class="se-swatches">${SWATCHES.map((c) => `<button type="button" class="se-swatch" data-fill="${c}" style="background:${c}" aria-label="${c}"></button>`).join("")}<input type="color" value="${el.fill}" data-prop="fill" aria-label="Fill colour"></div></div>
        ${el.type === "rect" ? `<div class="se-field"><span>Corner radius</span><input type="range" min="0" max="120" value="${el.radius || 0}" data-prop="radius"></div>` : ""}
        ${common}`;
    } else {
      box.innerHTML = `<p class="se-label">${el.detected ? "Picture from the slide" : "Image"}</p>${el.detected ? '<p class="se-hint">Drag to move, use the handles to resize (hold Shift to keep its shape), or press Delete to remove it.</p>' : ""}${common}`;
    }
  }

  function update(props, opts = {}) {
    const el = find(selected);
    if (!el) return;
    if (!opts.noCommit) commit();
    Object.assign(el, props);
    const node = nodeOf(el.id);
    if (node) {
      applyBox(node, el);
      if (el.type === "text") {
        if (editing !== el.id && "text" in props) {
          const handles = [...node.querySelectorAll(".se-handle")];
          setText(node, el);
          handles.forEach((h) => node.append(h));
        }
        applyText(node, el);
        fitTextHeight(el, node);
      } else if (el.type === "rect" || el.type === "ellipse") {
        node.style.background = el.fill;
        if (el.type === "rect") node.style.borderRadius = `${(el.radius || 0) * zoom}px`;
      }
      node.style.opacity = el.opacity ?? 1;
    }
    refreshThumbSoon();
  }

  function fitTextHeight(el, node) {
    const need = node.scrollHeight / zoom;
    if (need > el.h + 1) {
      el.h = need;
      node.style.height = `${el.h * zoom}px`;
    }
  }

  $("#seProps").addEventListener("input", (event) => {
    const t = event.target;
    if (t.id === "seNotes") { slide().notes = t.value; return; }
    if (t.id === "seBgColor") { commit(); Object.assign(slide(), { bgMode: "color", bgColor: t.value }); renderStage(); refreshThumbSoon(); return; }
    const prop = t.dataset.prop;
    if (!prop) return;
    let value = t.value;
    if (["fontSize", "lineHeight", "radius"].includes(prop)) value = Number(value) || 0;
    if (prop === "opacity") value = Number(value) / 100;
    if (prop === "text" && editing) stopEditing();
    update({ [prop]: value }, { noCommit: t.type === "range" || t.tagName === "TEXTAREA" });
  });
  $("#seProps").addEventListener("change", (event) => {
    const t = event.target;
    if (t.name === "seBg") { commit(); slide().bgMode = t.value; renderStage(); refreshThumbSoon(); }
    if (t.type === "range" || t.tagName === "TEXTAREA") commit();
  });
  $("#seProps").addEventListener("click", (event) => {
    const t = event.target.closest("button");
    if (!t) return;
    const el = find(selected);
    if (t.dataset.bg) { commit(); Object.assign(slide(), { bgMode: "color", bgColor: t.dataset.bg }); renderStage(); renderProps(); refreshThumbSoon(); return; }
    if (t.dataset.color) return update({ color: t.dataset.color });
    if (t.dataset.fill) return update({ fill: t.dataset.fill });
    if (t.dataset.toggle && el) { update({ [t.dataset.toggle]: !el[t.dataset.toggle] }); return renderProps(); }
    if (t.dataset.align) { update({ align: t.dataset.align }); return renderProps(); }
  });

  /* ---------- Actions ---------- */
  function addElement(el) {
    commit();
    const s = slide();
    s.elements.push(el);
    selected = el.id;
    renderStage();
    renderProps();
    refreshThumbSoon();
  }

  function centerBox(w, h) {
    const s = slide();
    return { x: (s.w - w) / 2, y: (s.h - h) / 2, w, h };
  }

  const actions = {
    new: () => { $("#seEditor").hidden = true; $("#seStart").hidden = false; app.classList.remove("is-full"); },
    undo, redo,
    "add-text": () => addElement({ id: S.id(), type: "text", ...centerBox(700, 90), text: "Double-click to edit", fontSize: 56, lineHeight: 1.2, color: "#1f1f1f", bold: false, italic: false, align: "left", fontFamily: "Arial" }),
    "add-rect": () => addElement({ id: S.id(), type: "rect", ...centerBox(420, 260), fill: "#0b57d0", radius: 16, opacity: 1 }),
    "add-ellipse": () => addElement({ id: S.id(), type: "ellipse", ...centerBox(300, 300), fill: "#f9ab00", opacity: 1 }),
    "add-image": () => $("#seImageInput").click(),
    original: (btn) => { showOriginal = !showOriginal; btn.classList.toggle("is-on", showOriginal); selected = null; renderStage(); renderProps(); },
    present: () => present(0),
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
      const copy = Object.assign(S.newSlide(src.original), { clean: src.clean, bgMode: src.bgMode, bgColor: src.bgColor, notes: src.notes, status: src.status, elements: JSON.parse(JSON.stringify(src.elements)).map((e) => ({ ...e, id: S.id() })) });
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
    reread: () => {
      const s = slide();
      commit();
      s.status = "working";
      renderAll();
      queue = queue.then(async () => {
        showProgress("Reading text on this slide…");
        try { await S.analyze(s, (p) => showProgress(`Reading text… ${Math.round(p * 100)}%`), { objects: $("#seObjects").checked }); } catch (_e) { S.skipAnalysis(s); s.status = "error"; }
        showProgress("");
        if (deck.slides.includes(s)) { renderThumb(deck.slides.indexOf(s)); if (slide() === s) { renderStage(); renderProps(); } }
      });
    },
    "clear-text": () => { commit(); const s = slide(); s.elements = s.elements.filter((e) => e.type !== "text"); renderStage(); renderProps(); refreshThumbSoon(); },
    front: () => { commit(); const s = slide(); const i = s.elements.findIndex((e) => e.id === selected); s.elements.push(...s.elements.splice(i, 1)); renderStage(); refreshThumbSoon(); },
    back: () => { commit(); const s = slide(); const i = s.elements.findIndex((e) => e.id === selected); s.elements.unshift(...s.elements.splice(i, 1)); renderStage(); refreshThumbSoon(); },
    dup: () => { const el = find(selected); if (el) addElement({ ...JSON.parse(JSON.stringify(el)), id: S.id(), x: el.x + 30, y: el.y + 30 }); },
    del: () => removeSelected()
  };

  app.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-act]");
    if (btn && actions[btn.dataset.act]) {
      if (btn.closest("#seMenu")) $("#seMenu").hidden = true;
      else if (btn.dataset.act !== "menu") $("#seMenu").hidden = true;
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
  });

  $("#seImageInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const src = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(file); });
    const img = await createImageBitmap(file);
    const s = slide();
    const w = Math.min(s.w * 0.5, img.width);
    addElement({ id: S.id(), type: "image", ...centerBox(w, (w * img.height) / img.width), src, opacity: 1 });
  });

  function removeSelected() {
    if (!selected) return;
    commit();
    const s = slide();
    s.elements = s.elements.filter((e) => e.id !== selected);
    selected = null;
    renderStage();
    renderProps();
    refreshThumbSoon();
  }

  /* ---------- Direct manipulation ---------- */
  let drag = null;
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
    const handle = event.target.closest("[data-handle]")?.dataset.handle || null;
    drag = { id: idv, handle, sx: event.clientX, sy: event.clientY, start: { x: el.x, y: el.y, w: el.w, h: el.h }, moved: false, before: snapshot() };
    $("#seStage").setPointerCapture(event.pointerId);
  });
  $("#seStage").addEventListener("pointermove", (event) => {
    if (!drag) return;
    const el = find(drag.id);
    if (!el) return;
    const dx = (event.clientX - drag.sx) / zoom;
    const dy = (event.clientY - drag.sy) / zoom;
    if (!drag.moved && Math.hypot(dx, dy) < 2) return;
    drag.moved = true;
    const st = drag.start;
    if (!drag.handle) {
      el.x = Math.round(st.x + dx);
      el.y = Math.round(st.y + dy);
    } else {
      const h = drag.handle;
      let { x, y, w, h: hh } = st;
      if (h.includes("e")) w = Math.max(20, st.w + dx);
      if (h.includes("s")) hh = Math.max(16, st.h + dy);
      if (h.includes("w")) { w = Math.max(20, st.w - dx); x = st.x + st.w - w; }
      if (h.includes("n")) { hh = Math.max(16, st.h - dy); y = st.y + st.h - hh; }
      if (event.shiftKey && el.type !== "text") { const r = st.w / st.h; if (w / hh > r) w = hh * r; else hh = w / r; }
      Object.assign(el, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) });
    }
    const node = nodeOf(el.id);
    if (node) applyBox(node, el);
  });
  $("#seStage").addEventListener("pointerup", () => {
    if (!drag) return;
    if (drag.moved) {
      history.push(drag.before);
      future = [];
      const el = find(drag.id);
      const node = el && nodeOf(el.id);
      if (el?.type === "text" && node) fitTextHeight(el, node);
      refreshThumbSoon();
    }
    drag = null;
  });

  // Pointer capture retargets clicks to the stage, so hit-test by position.
  const hitAt = (x, y) => document.elementsFromPoint(x, y).find((n) => n.classList?.contains("se-el")) || null;

  $("#seStage").addEventListener("dblclick", (event) => {
    const hit = hitAt(event.clientX, event.clientY);
    const node = hit && hit.classList.contains("se-text") ? hit : null;
    if (!node) {
      if (!hit && slide()?.status === "done" && !showOriginal) {
        // Double-click empty space: new text box there.
        const rect = $("#seStage").getBoundingClientRect();
        actions["add-text"]();
        update({ x: Math.round((event.clientX - rect.left) / zoom - 20), y: Math.round((event.clientY - rect.top) / zoom - 40), text: "" }, { noCommit: true });
        startEditing(selected);
      }
      return;
    }
    startEditing(node.dataset.id);
  });

  function startEditing(idv) {
    const node = nodeOf(idv);
    const el = find(idv);
    if (!node || !el) return;
    editing = idv;
    commit();
    node.querySelectorAll(".se-handle").forEach((h) => h.remove());
    node.contentEditable = "plaintext-only";
    if (node.contentEditable !== "plaintext-only") node.contentEditable = "true";
    node.classList.add("is-editing");
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    node.oninput = () => {
      el.text = node.innerText.replace(/\n$/, "");
      fitTextHeight(el, node);
      const ta = $('#seProps textarea[data-prop="text"]');
      if (ta) ta.value = el.text;
      refreshThumbSoon();
    };
  }

  // Clicking anywhere outside the box being typed in ends editing.
  document.addEventListener("pointerdown", (event) => {
    if (editing && !event.target.closest(`.se-el[data-id="${CSS.escape(editing)}"]`)) stopEditing();
  }, true);

  function stopEditing() {
    if (!editing) return;
    const node = nodeOf(editing);
    const el = find(editing);
    editing = null;
    if (node && el) {
      node.contentEditable = "false";
      node.classList.remove("is-editing");
      el.text = node.innerText.replace(/\n$/, "");
      if (!el.text.trim()) {
        slide().elements = slide().elements.filter((e) => e !== el);
        selected = null;
      }
    }
    renderStage();
    renderProps();
    refreshThumbSoon();
  }

  document.addEventListener("keydown", (event) => {
    if ($("#seEditor").hidden) return;
    if (!$("#sePresent").hidden) return;
    const typing = editing || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === "z" && !typing) { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if (mod && event.key.toLowerCase() === "y" && !typing) { event.preventDefault(); redo(); return; }
    if (event.key === "Escape") { if (editing) stopEditing(); else if (selected) select(null); else app.classList.remove("is-full"); return; }
    if (typing) return;
    if (mod && event.key.toLowerCase() === "d" && selected) { event.preventDefault(); actions.dup(); return; }
    if ((event.key === "Delete" || event.key === "Backspace") && selected) { event.preventDefault(); removeSelected(); return; }
    if (event.key === "Enter" && selected && find(selected)?.type === "text") { event.preventDefault(); startEditing(selected); return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      if (selected) {
        const step = event.shiftKey ? 10 : 1;
        const el = find(selected);
        update({ x: el.x + arrows[event.key][0] * step, y: el.y + arrows[event.key][1] * step }, { noCommit: true });
      } else if (event.key === "ArrowDown" || event.key === "ArrowRight") { cur = Math.min(deck.slides.length - 1, cur + 1); renderAll(); }
      else { cur = Math.max(0, cur - 1); renderAll(); }
    }
  });

  let resizeTimer = 0;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderStage, 120); });

  /* ---------- Present ---------- */
  let presentAt = 0;
  function present(i) {
    stopEditing();
    presentAt = i;
    const box = $("#sePresent");
    box.hidden = false;
    box.requestFullscreen?.().catch(() => {});
    drawPresent();
  }
  function drawPresent() {
    const box = $("#sePresent");
    const s = deck.slides[presentAt];
    if (!s) return;
    const scale = Math.min(window.innerWidth / s.w, window.innerHeight / s.h) * devicePixelRatio;
    const c = box.querySelector("canvas");
    c.width = Math.round(s.w * scale);
    c.height = Math.round(s.h * scale);
    S.drawSlide(c.getContext("2d"), s, scale);
    c.style.width = `${c.width / devicePixelRatio}px`;
  }
  function endPresent() {
    $("#sePresent").hidden = true;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  $("#sePresent").addEventListener("click", (event) => {
    if (event.clientX < window.innerWidth / 4) presentAt = Math.max(0, presentAt - 1);
    else if (presentAt < deck.slides.length - 1) presentAt += 1;
    else return endPresent();
    drawPresent();
  });
  document.addEventListener("keydown", (event) => {
    if ($("#sePresent").hidden) return;
    if (event.key === "Escape") return endPresent();
    if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(event.key)) { event.preventDefault(); presentAt = Math.min(deck.slides.length - 1, presentAt + 1); drawPresent(); }
    if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) { event.preventDefault(); presentAt = Math.max(0, presentAt - 1); drawPresent(); }
  });
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && !$("#sePresent").hidden) endPresent(); else if (!$("#sePresent").hidden) drawPresent(); });

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
      status(kind === "pptx" ? "PowerPoint downloaded. Open it in PowerPoint, Keynote or Google Slides (File → Import)." : "Downloaded.", "ok");
    } catch (error) {
      status(error.message || "Export failed.", "error");
    }
  }
})();
