/* Slide deck engine for the NotebookLM slide editor.
   PDF page → image → OCR (Tesseract) → editable text boxes; the original
   text is painted out of the background. Renders slides to canvas and
   exports PPTX (PptxGenJS), PDF (pdf-lib, real text) and PNG.
   Everything runs in the browser. */
window.NTSlides = (() => {
  const P = NTPdf;
  const W = 1600; // slide width in editor units (px)
  let uid = 0;
  const id = () => `e${Date.now().toString(36)}${(uid++).toString(36)}`;

  /* ---------- Colour helpers ---------- */
  const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  function median(values) {
    if (!values.length) return 0;
    const s = [...values].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }

  /* ---------- Load ---------- */
  async function loadPdf(bytes) {
    const pdf = await P.openPdfjs(bytes);
    const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
    return { pdf, pageCount: pdf.numPages, aspect: first.height / first.width };
  }

  async function renderOriginal(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber);
    const scale = W / page.getViewport({ scale: 1 }).width;
    return P.renderPage(pdf, pageNumber, scale);
  }

  function newSlide(original) {
    return {
      id: id(),
      w: W,
      h: original.height,
      original,
      clean: null, // canvas with text painted out
      bgMode: "image", // "image" | "color"
      bgColor: "#ffffff",
      elements: [],
      notes: "",
      status: "pending" // pending | working | done | error
    };
  }

  function blankSlide(w = W, h = Math.round(W * 9 / 16), color = "#ffffff") {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    const slide = newSlide(canvas);
    slide.clean = canvas;
    slide.bgMode = "color";
    slide.bgColor = color;
    slide.status = "done";
    return slide;
  }

  /* ---------- Analyse: OCR → text boxes, paint out text ---------- */
  function lineText(line) {
    const text = (line.words || []).map((w) => w.text).join(" ").replace(/\s+/g, " ").trim() || String(line.text || "").trim();
    // OCR often reads bullet dots as », «, e, o or ®; put a real bullet back.
    return text.replace(/^(?:[»«•·●▪◦*®]|[eo](?=\s+[A-Z]))\s+/, "• ");
  }

  // Font size that makes a line as wide as it is on the slide.
  const measureCtx = document.createElement("canvas").getContext("2d");
  function sizeFromWidth(text, width, bold) {
    measureCtx.font = `${bold ? 700 : 400} 100px Arial, sans-serif`;
    const w = measureCtx.measureText(text).width;
    return w > 0 ? (width / w) * 100 : 0;
  }

  // Split Tesseract paragraphs where the text size jumps (title + body) or there's a big gap.
  function groupLines(paragraph) {
    const lines = (paragraph.lines || []).filter((l) => lineText(l) && (l.confidence ?? 100) > 35);
    const groups = [];
    let current = [];
    for (const line of lines) {
      const h = line.bbox.y1 - line.bbox.y0;
      const prev = current[current.length - 1];
      if (prev) {
        const ph = prev.bbox.y1 - prev.bbox.y0;
        const gap = line.bbox.y0 - prev.bbox.y1;
        if (Math.max(h, ph) / Math.max(1, Math.min(h, ph)) > 1.3 || gap > Math.max(h, ph) * 1.2) {
          groups.push(current);
          current = [];
        }
      }
      current.push(line);
    }
    if (current.length) groups.push(current);
    return groups;
  }

  function pixelAt(data, w, x, y) {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  }

  // Colours and weight of a text box, from the original pixels.
  function sampleStyle(img, box) {
    const { data, width, height } = img;
    const ring = [];
    const pad = 4;
    for (let x = box.x0 - pad; x <= box.x1 + pad; x += 2) {
      for (const y of [box.y0 - pad, box.y1 + pad]) if (x >= 0 && y >= 0 && x < width && y < height) ring.push(pixelAt(data, width, x, y));
    }
    for (let y = box.y0 - pad; y <= box.y1 + pad; y += 2) {
      for (const x of [box.x0 - pad, box.x1 + pad]) if (x >= 0 && y >= 0 && x < width && y < height) ring.push(pixelAt(data, width, x, y));
    }
    const bg = [0, 1, 2].map((k) => median(ring.map((p) => p[k])));
    const ink = [];
    let count = 0;
    let total = 0;
    for (let y = Math.max(0, box.y0); y < Math.min(height, box.y1); y += 1) {
      for (let x = Math.max(0, box.x0); x < Math.min(width, box.x1); x += 1) {
        total += 1;
        const p = pixelAt(data, width, x, y);
        const d = dist(p, bg);
        if (d > 70) {
          count += 1;
          if (d > 120 || ink.length < 50) ink.push([p, d]);
        }
      }
    }
    ink.sort((a, b) => b[1] - a[1]);
    const top = ink.slice(0, Math.max(10, Math.floor(ink.length * 0.4))).map((x) => x[0]);
    const color = top.length ? [0, 1, 2].map((k) => median(top.map((p) => p[k]))) : lum(bg) > 128 ? [20, 20, 20] : [250, 250, 250];
    return { color: hex(...color), bg, inkRatio: total ? count / total : 0 };
  }

  // Paint out text: each pixel in a box becomes a blend of the nearest
  // pixels outside the box (left/right and top/bottom), skipping other text.
  function paintOut(ctx, boxes, w, h) {
    if (!boxes.length) return;
    const img = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(img.data);
    const mask = new Uint8Array(w * h);
    boxes.forEach((b) => {
      for (let y = Math.max(0, b.y0); y < Math.min(h, b.y1); y += 1) mask.fill(1, y * w + Math.max(0, b.x0), y * w + Math.min(w, b.x1));
    });
    const sample = (x, y) => {
      let r = 0, g = 0, bl = 0, n = 0;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const xx = Math.min(w - 1, Math.max(0, x + dx)), yy = Math.min(h - 1, Math.max(0, y + dy));
        if (mask[yy * w + xx]) continue;
        const i = (yy * w + xx) * 4;
        r += src[i]; g += src[i + 1]; bl += src[i + 2]; n += 1;
      }
      return n ? [r / n, g / n, bl / n] : null;
    };
    const walk = (x, y, dx, dy) => {
      for (let k = 0; k < 120; k += 1) {
        if (x < 0 || y < 0 || x >= w || y >= h) return null;
        if (!mask[y * w + x]) return { c: sample(x, y), d: k + 1 };
        x += dx; y += dy;
      }
      return null;
    };
    const out = img.data;
    boxes.forEach((b) => {
      for (let y = Math.max(0, b.y0); y < Math.min(h, b.y1); y += 1) {
        for (let x = Math.max(0, b.x0); x < Math.min(w, b.x1); x += 1) {
          const picks = [walk(x - 1, y, -1, 0), walk(x + 1, y, 1, 0), walk(x, y - 1, 0, -1), walk(x, y + 1, 0, 1)].filter((p) => p && p.c);
          if (!picks.length) continue;
          let r = 0, g = 0, bl = 0, wt = 0;
          picks.forEach((p) => { const k = 1 / (p.d * p.d); r += p.c[0] * k; g += p.c[1] * k; bl += p.c[2] * k; wt += k; });
          const i = (y * w + x) * 4;
          out[i] = r / wt; out[i + 1] = g / wt; out[i + 2] = bl / wt;
        }
      }
    });
    ctx.putImageData(img, 0, 0);
    // Soften the patches a little so they don't show as flat rectangles.
    ctx.save();
    ctx.filter = "blur(2px)";
    boxes.forEach((b) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      ctx.clip();
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  }

  async function analyze(slide, onProgress = () => {}) {
    slide.status = "working";
    const blocks = await P.ocrBlocks(slide.original, (m) => {
      if (m.status === "recognizing text") onProgress(m.progress);
    });
    const octx = slide.original.getContext("2d", { willReadFrequently: true });
    const img = octx.getImageData(0, 0, slide.w, slide.h);
    const elements = [];
    const boxes = [];
    for (const block of blocks) {
      for (const para of block.paragraphs || []) {
        for (const group of groupLines(para)) {
          const text = group.map(lineText).join("\n").trim();
          const conf = median(group.map((l) => l.confidence ?? 100));
          if (!text || conf < 45 || text.replace(/[^\p{L}\p{N}]/gu, "").length < 1) continue;
          const x0 = Math.min(...group.map((l) => l.bbox.x0));
          const y0 = Math.min(...group.map((l) => l.bbox.y0));
          const x1 = Math.max(...group.map((l) => l.bbox.x1));
          const y1 = Math.max(...group.map((l) => l.bbox.y1));
          // Skip "text" that covers most of the slide (usually a picture).
          if ((x1 - x0) * (y1 - y0) > slide.w * slide.h * 0.5) continue;
          const lineH = median(group.map((l) => l.bbox.y1 - l.bbox.y0));
          const style = sampleStyle(img, { x0, y0, x1, y1 });
          const bold = style.inkRatio > 0.3;
          // Size from the width of the longer lines (more reliable than height), checked against height.
          const bySize = group.filter((l) => lineText(l).length >= 4).map((l) => sizeFromWidth(lineText(l), l.bbox.x1 - l.bbox.x0, bold)).filter(Boolean);
          let fontSize = bySize.length ? median(bySize) : lineH * 0.8;
          if (fontSize > lineH * 1.6 || fontSize < lineH * 0.5) fontSize = lineH * 0.8;
          fontSize = Math.max(8, Math.round(fontSize));
          const pitch = group.length > 1 ? (group[group.length - 1].bbox.y0 - group[0].bbox.y0) / (group.length - 1) : fontSize * 1.2;
          const lineHeight = Math.max(1, Math.min(1.9, pitch / fontSize));
          const lefts = group.map((l) => l.bbox.x0);
          const centres = group.map((l) => (l.bbox.x0 + l.bbox.x1) / 2);
          const spread = (a) => Math.max(...a) - Math.min(...a);
          let align = "left";
          if (group.length > 1 && spread(lefts) > fontSize * 0.6 && spread(centres) < fontSize * 0.6) align = "center";
          else if (group.length === 1 && Math.abs((x0 + x1) / 2 - slide.w / 2) < slide.w * 0.02 && x0 > slide.w * 0.15) align = "center";
          const pad = Math.max(4, Math.round(fontSize * 0.18));
          boxes.push({ x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad });
          const boxW = (x1 - x0) * 1.06 + fontSize * 0.6;
          const boxH = group.length * fontSize * lineHeight;
          elements.push({
            id: id(),
            type: "text",
            x: align === "center" ? (x0 + x1) / 2 - boxW / 2 : x0 - fontSize * 0.05,
            y: y0 - (fontSize * lineHeight - lineH) / 2 - fontSize * 0.05,
            w: Math.min(boxW, slide.w - Math.max(0, x0)),
            h: boxH,
            text,
            fontSize,
            lineHeight: Math.round(lineHeight * 100) / 100,
            color: style.color,
            bold,
            italic: false,
            align,
            fontFamily: "Arial"
          });
        }
      }
    }
    const clean = document.createElement("canvas");
    clean.width = slide.w;
    clean.height = slide.h;
    const cctx = clean.getContext("2d", { willReadFrequently: true });
    cctx.drawImage(slide.original, 0, 0);
    paintOut(cctx, boxes, slide.w, slide.h);
    slide.clean = clean;
    slide.elements = elements;
    slide.status = "done";
    return slide;
  }

  // Keep the original image as background with no text boxes.
  function skipAnalysis(slide) {
    slide.clean = slide.original;
    slide.status = "done";
  }

  /* ---------- Render ---------- */
  const imageCache = new Map();
  function imageFor(src) {
    if (!imageCache.has(src)) {
      const img = new Image();
      img.src = src;
      imageCache.set(src, img);
    }
    return imageCache.get(src);
  }

  function fontString(el, scale) {
    return `${el.italic ? "italic " : ""}${el.bold ? 700 : 400} ${el.fontSize * scale}px ${cssFamily(el.fontFamily)}`;
  }

  function cssFamily(name) {
    const map = { Georgia: "Georgia, 'Times New Roman', serif", "Times New Roman": "'Times New Roman', Times, serif", "Courier New": "'Courier New', monospace", Verdana: "Verdana, sans-serif", "Trebuchet MS": "'Trebuchet MS', sans-serif", Helvetica: "Helvetica, Arial, sans-serif" };
    return map[name] || `${name.includes(" ") ? `'${name}'` : name}, Arial, sans-serif`;
  }

  // Word-wrap text to a width with a measure function. Keeps explicit line breaks.
  function wrapLines(text, maxWidth, measure) {
    const out = [];
    for (const para of String(text).split("\n")) {
      let line = "";
      for (const word of para.split(/(\s+)/)) {
        const next = line + word;
        if (measure(next.trimEnd()) > maxWidth && line.trim()) {
          out.push(line.trimEnd());
          line = word.trimStart();
        } else line = next;
      }
      out.push(line.trimEnd());
    }
    return out;
  }

  function drawSlide(ctx, slide, scale = 1, options = {}) {
    const w = slide.w * scale;
    const h = slide.h * scale;
    if (options.original) {
      ctx.drawImage(slide.original, 0, 0, w, h);
      return;
    }
    if (slide.bgMode === "color") {
      ctx.fillStyle = slide.bgColor;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.drawImage(slide.clean || slide.original, 0, 0, w, h);
    }
    for (const el of slide.elements) {
      ctx.save();
      ctx.globalAlpha = el.opacity ?? 1;
      if (el.type === "rect" || el.type === "ellipse") {
        ctx.fillStyle = el.fill;
        ctx.beginPath();
        if (el.type === "rect") ctx.roundRect ? ctx.roundRect(el.x * scale, el.y * scale, el.w * scale, el.h * scale, (el.radius || 0) * scale) : ctx.rect(el.x * scale, el.y * scale, el.w * scale, el.h * scale);
        else ctx.ellipse((el.x + el.w / 2) * scale, (el.y + el.h / 2) * scale, (el.w / 2) * scale, (el.h / 2) * scale, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (el.type === "image") {
        const img = imageFor(el.src);
        if (img.complete && img.naturalWidth) ctx.drawImage(img, el.x * scale, el.y * scale, el.w * scale, el.h * scale);
      } else if (el.type === "text") {
        ctx.font = fontString(el, scale);
        ctx.fillStyle = el.color;
        ctx.textBaseline = "middle";
        ctx.textAlign = el.align === "center" ? "center" : el.align === "right" ? "right" : "left";
        const lh = el.fontSize * el.lineHeight * scale;
        const lines = wrapLines(el.text, el.w * scale, (s) => ctx.measureText(s).width);
        const x = el.align === "center" ? (el.x + el.w / 2) * scale : el.align === "right" ? (el.x + el.w) * scale : el.x * scale;
        lines.forEach((line, i) => ctx.fillText(line, x, el.y * scale + lh * i + lh / 2));
      }
      ctx.restore();
    }
  }

  function slideCanvas(slide, scale = 1, options) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(slide.w * scale);
    canvas.height = Math.round(slide.h * scale);
    drawSlide(canvas.getContext("2d"), slide, scale, options);
    return canvas;
  }

  /* ---------- Export ---------- */
  let pptxPromise = null;
  function pptxLib() {
    pptxPromise ||= new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/tools/vendor/pptxgenjs/pptxgen.bundle.js";
      s.onload = () => resolve(window.PptxGenJS);
      s.onerror = () => reject(new Error("Could not load the PowerPoint exporter."));
      document.head.append(s);
    });
    return pptxPromise;
  }

  const noHash = (c) => String(c || "#000000").replace("#", "").slice(0, 6).toUpperCase();
  const bareData = (url) => url.replace(/^data:/, "");

  async function exportPptx(deck, filename, onProgress = () => {}) {
    const PptxGenJS = await pptxLib();
    const pptx = new PptxGenJS();
    const widthIn = 13.333;
    const first = deck.slides[0];
    const k = widthIn / first.w; // inches per editor px
    pptx.defineLayout({ name: "NT", width: widthIn, height: first.h * k });
    pptx.layout = "NT";
    pptx.title = deck.title || "Slides";
    deck.slides.forEach((slide, i) => {
      onProgress(i, deck.slides.length);
      const s = pptx.addSlide();
      if (slide.bgMode === "color") s.background = { color: noHash(slide.bgColor) };
      else s.background = { data: bareData((slide.clean || slide.original).toDataURL("image/jpeg", 0.9)) };
      for (const el of slide.elements) {
        const box = { x: el.x * k, y: el.y * k, w: el.w * k, h: el.h * k };
        if (el.type === "text") {
          s.addText(el.text, {
            ...box,
            fontFace: el.fontFamily,
            fontSize: Math.max(1, Math.round(el.fontSize * k * 72 * 10) / 10),
            color: noHash(el.color),
            bold: Boolean(el.bold),
            italic: Boolean(el.italic),
            align: el.align || "left",
            valign: "top",
            margin: 0,
            lineSpacingMultiple: el.lineHeight || 1.2,
            fit: "none",
            transparency: Math.round((1 - (el.opacity ?? 1)) * 100)
          });
        } else if (el.type === "rect" || el.type === "ellipse") {
          s.addShape(el.type === "rect" ? (el.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect) : pptx.ShapeType.ellipse, {
            ...box,
            fill: { color: noHash(el.fill), transparency: Math.round((1 - (el.opacity ?? 1)) * 100) },
            line: { type: "none" },
            ...(el.radius ? { rectRadius: Math.min(0.5, el.radius / Math.min(el.w, el.h)) } : {})
          });
        } else if (el.type === "image") {
          s.addImage({ ...box, data: bareData(el.src) });
        }
      }
      if (slide.notes) s.addNotes(slide.notes);
    });
    onProgress(deck.slides.length, deck.slides.length);
    await pptx.writeFile({ fileName: filename });
  }

  async function exportPdf(deck, filename, onProgress = () => {}) {
    const { PDFDocument, StandardFonts, rgb } = await P.pdfLib();
    const doc = await PDFDocument.create();
    const fonts = {};
    const pick = async (el) => {
      const serif = /georgia|times/i.test(el.fontFamily);
      const mono = /courier/i.test(el.fontFamily);
      const key = `${serif ? "T" : mono ? "C" : "H"}${el.bold ? "B" : ""}${el.italic ? "I" : ""}`;
      const name = {
        H: "Helvetica", HB: "HelveticaBold", HI: "HelveticaOblique", HBI: "HelveticaBoldOblique",
        T: "TimesRoman", TB: "TimesRomanBold", TI: "TimesRomanItalic", TBI: "TimesRomanBoldItalic",
        C: "Courier", CB: "CourierBold", CI: "CourierOblique", CBI: "CourierBoldOblique"
      }[key];
      fonts[key] ||= await doc.embedFont(StandardFonts[name]);
      return fonts[key];
    };
    const rgbOf = (c) => {
      const n = parseInt(noHash(c), 16);
      return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    };
    const safe = (font, text) => [...text].map((ch) => { try { font.encodeText(ch); return ch; } catch (_e) { return "?"; } }).join("");
    for (let i = 0; i < deck.slides.length; i += 1) {
      onProgress(i, deck.slides.length);
      const slide = deck.slides[i];
      const k = 960 / slide.w; // points per editor px
      const pw = 960;
      const ph = slide.h * k;
      const page = doc.addPage([pw, ph]);
      if (slide.bgMode === "color") page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: rgbOf(slide.bgColor) });
      else {
        const jpg = await doc.embedJpg(new Uint8Array(await (await P.canvasBlob(slide.clean || slide.original, "image/jpeg", 0.9)).arrayBuffer()));
        page.drawImage(jpg, { x: 0, y: 0, width: pw, height: ph });
      }
      for (const el of slide.elements) {
        const op = el.opacity ?? 1;
        if (el.type === "rect") page.drawRectangle({ x: el.x * k, y: ph - (el.y + el.h) * k, width: el.w * k, height: el.h * k, color: rgbOf(el.fill), opacity: op });
        else if (el.type === "ellipse") page.drawEllipse({ x: (el.x + el.w / 2) * k, y: ph - (el.y + el.h / 2) * k, xScale: (el.w / 2) * k, yScale: (el.h / 2) * k, color: rgbOf(el.fill), opacity: op });
        else if (el.type === "image") {
          const bytes = new Uint8Array(await (await fetch(el.src)).arrayBuffer());
          const img = /png/.test(el.src.slice(0, 30)) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          page.drawImage(img, { x: el.x * k, y: ph - (el.y + el.h) * k, width: el.w * k, height: el.h * k, opacity: op });
        } else if (el.type === "text") {
          const font = await pick(el);
          const size = el.fontSize * k;
          const lh = size * el.lineHeight;
          const lines = wrapLines(safe(font, el.text), el.w * k, (s) => font.widthOfTextAtSize(s, size));
          lines.forEach((line, n) => {
            const tw = font.widthOfTextAtSize(line, size);
            const x = el.align === "center" ? el.x * k + (el.w * k - tw) / 2 : el.align === "right" ? (el.x + el.w) * k - tw : el.x * k;
            const baseline = ph - (el.y * k + lh * n + lh / 2 + size * 0.35);
            page.drawText(line, { x, y: baseline, size, font, color: rgbOf(el.color), opacity: op });
          });
        }
      }
    }
    onProgress(deck.slides.length, deck.slides.length);
    P.saveBlob(P.pdfBlob(await doc.save()), filename);
  }

  async function exportPngs(deck, baseName, onProgress = () => {}) {
    const files = [];
    for (let i = 0; i < deck.slides.length; i += 1) {
      onProgress(i, deck.slides.length);
      const blob = await P.canvasBlob(slideCanvas(deck.slides[i], 1), "image/png");
      files.push({ name: `${baseName} - ${String(i + 1).padStart(2, "0")}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    onProgress(deck.slides.length, deck.slides.length);
    if (files.length === 1) P.saveBlob(new Blob([files[0].data], { type: "image/png" }), files[0].name);
    else P.saveBlob(P.zip(files), `${baseName} (slides).zip`);
  }

  return { W, id, loadPdf, renderOriginal, newSlide, blankSlide, analyze, skipAnalysis, drawSlide, slideCanvas, cssFamily, exportPptx, exportPdf, exportPngs };
})();
