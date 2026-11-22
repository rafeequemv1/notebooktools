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
  function sizeFromWidth(text, width, bold, family = "Arial") {
    measureCtx.font = `${bold ? 700 : 400} 100px ${family === "Georgia" ? "Georgia, serif" : "Arial, sans-serif"}`;
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

  // Paint out text. For each box, take the typical (median) colour of thin
  // strips just outside each side, ignoring stray text pixels, and blend
  // them across the box. Smooth on flat and gradient backgrounds.
  function paintOut(ctx, boxes, w, h) {
    if (!boxes.length) return;
    const img = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(img.data);
    const out = img.data;
    let ref = null; // background colour of the current box
    const stripMedian = (x0, y0, x1, y1) => {
      const px = [];
      for (let y = Math.max(0, y0); y < Math.min(h, y1); y += 1) for (let x = Math.max(0, x0); x < Math.min(w, x1); x += 2) {
        const i = (y * w + x) * 4;
        px.push([src[i], src[i + 1], src[i + 2]]);
      }
      if (!px.length) return null;
      if (ref) {
        // Keep only pixels close to the background (drops anti-aliased text edges).
        const keep = px.filter((p) => Math.abs(p[0] - ref[0]) + Math.abs(p[1] - ref[1]) + Math.abs(p[2] - ref[2]) < 60);
        if (keep.length < px.length * 0.25) return null;
        return [0, 1, 2].map((c) => median(keep.map((p) => p[c])));
      }
      const lum = px.map((p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]);
      const med = median(lum);
      const keep = px.filter((_p, k) => Math.abs(lum[k] - med) < 30);
      return [0, 1, 2].map((c) => median((keep.length ? keep : px).map((p) => p[c])));
    };
    for (const b of boxes) {
      const x0 = Math.max(0, Math.round(b.x0)), x1 = Math.min(w, Math.round(b.x1));
      const y0 = Math.max(0, Math.round(b.y0)), y1 = Math.min(h, Math.round(b.y1));
      if (x1 <= x0 || y1 <= y0) continue;
      // Sample a few points along each side so gradients along the box are kept.
      const cols = Math.max(2, Math.min(12, Math.round((x1 - x0) / 80)));
      const rows = Math.max(2, Math.min(6, Math.round((y1 - y0) / 60)));
      ref = null;
      const fallback = b.bg || stripMedian(x0 - 8, y0 - 8, x1 + 8, y1 + 8) || [255, 255, 255];
      ref = b.bg || null;
      // A strip that looks more like the text colour than the background is text: use the background.
      const near = (c) => {
        if (!c) return fallback;
        if (!b.ink) return c;
        const dInk = Math.abs(c[0] - b.ink[0]) + Math.abs(c[1] - b.ink[1]) + Math.abs(c[2] - b.ink[2]);
        const dBg = Math.abs(c[0] - fallback[0]) + Math.abs(c[1] - fallback[1]) + Math.abs(c[2] - fallback[2]);
        return dInk < dBg * 0.8 ? fallback : c;
      };
      const top = [], bottom = [], left = [], right = [];
      for (let k = 0; k < cols; k += 1) {
        const a = x0 + ((x1 - x0) * k) / cols, z = x0 + ((x1 - x0) * (k + 1)) / cols;
        top.push(near(stripMedian(Math.round(a), y0 - 6, Math.round(z), y0 - 1)));
        bottom.push(near(stripMedian(Math.round(a), y1 + 1, Math.round(z), y1 + 6)));
      }
      for (let k = 0; k < rows; k += 1) {
        const a = y0 + ((y1 - y0) * k) / rows, z = y0 + ((y1 - y0) * (k + 1)) / rows;
        left.push(near(stripMedian(x0 - 6, Math.round(a), x0 - 1, Math.round(z))));
        right.push(near(stripMedian(x1 + 1, Math.round(a), x1 + 6, Math.round(z))));
      }
      const at = (arr, t) => {
        const f = Math.min(arr.length - 1, Math.max(0, t * arr.length - 0.5));
        const i = Math.floor(f), j = Math.min(arr.length - 1, i + 1), u = f - i;
        return [0, 1, 2].map((c) => arr[i][c] * (1 - u) + arr[j][c] * u);
      };
      for (let y = y0; y < y1; y += 1) {
        const ty = (y - y0 + 0.5) / (y1 - y0);
        const l = at(left, ty), r = at(right, ty);
        for (let x = x0; x < x1; x += 1) {
          const tx = (x - x0 + 0.5) / (x1 - x0);
          const t = at(top, tx), bt = at(bottom, tx);
          const i = (y * w + x) * 4;
          for (let c = 0; c < 3; c += 1) {
            const v = t[c] * (1 - ty) + bt[c] * ty;
            const hz = l[c] * (1 - tx) + r[c] * tx;
            out[i + c] = (v + hz) / 2;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /* --- Segments: OCR lines split at big gaps, junk words dropped --- */
  const BULLET_RE = /^(?:[»«•·●▪◦*®©¢]|eo|[eoc](?=\s+[A-Z]))\s*/;
  function plausible(word) {
    const w = word.replace(/^[("'“‘\[]+|[)"'”’\].,:;!?]+$/g, "");
    if (!w) return false;
    if (/^\d+([.,:/-]\d+)*%?$/.test(w)) return true; // numbers, dates, 10:30, 50%
    if (/^[\p{L}][\p{L}'’\-]*$/u.test(w)) {
      if (w.length === 1) return /^[aAI]$/.test(w);
      if (w.length >= 3 && !/[aeiouyAEIOUYÀ-ɏ]/.test(w)) return /^[A-Z]{2,6}$/.test(w); // acronyms only
      return !/(.)\1\1/.test(w);
    }
    return /^[\p{L}\p{N}][\p{L}\p{N}'’\-./()]*$/u.test(w) && /[\p{L}]{2}/u.test(w);
  }

  function segmentsOf(blocks, img) {
    const segs = [];
    for (const block of blocks) for (const para of block.paragraphs || []) for (const line of para.lines || []) {
      const words = (line.words || []).filter((w) => w.text && w.text.trim()).sort((a, b) => a.bbox.x0 - b.bbox.x0);
      if (!words.length) continue;
      const h = median(words.map((w) => w.bbox.y1 - w.bbox.y0));
      let cur = [];
      // Trim symbols / badge numbers at the ends (keeps icons and badges in the picture).
      const junkEnd = (w) => /^[|@©®°~_=+*<>\\/()\[\]{}#•»«·.,:;-]*\d?[|@©®°~_=+*<>\\/()\[\]{}#.,:;-]*$/.test(w.text.trim()) && !/^\d{2,}/.test(w.text.trim());
      const flush = () => {
        const weak = (w) => ((w.confidence ?? 100) < 55 && w.text.trim().length <= 3)
          || (img && w.text.trim().length <= 3 && !/^[aAI]$/.test(w.text.trim()) && ringBusy(img, w.bbox, 3) > 0.35)
          || (w.text.trim().length === 1 && !/^[aAI•»«¢&]$/.test(w.text.trim()));
        while (cur.length && (junkEnd(cur[0]) || weak(cur[0])) && !/^[•»«¢]$/.test(cur[0].text.trim())) cur.shift();
        while (cur.length && (junkEnd(cur[cur.length - 1]) || weak(cur[cur.length - 1]))) cur.pop();
        if (cur.length) segs.push(cur);
        cur = [];
      };
      words.forEach((w, i) => {
        if (/^[|¦]+$/.test(w.text.trim())) { flush(); return; } // diagram lines read as "|"
        if (i && w.bbox.x0 - words[i - 1].bbox.x1 > Math.max(12, h * 1.1)) flush();
        cur.push(w);
      });
      flush();
    }
    return segs.map((ws) => {
      const text = ws.map((w) => w.text).join(" ").replace(/\s+/g, " ").trim().replace(BULLET_RE, (m) => (m.trim() ? "• " : ""));
      const real = ws.filter((w) => plausible(w.text));
      const conf = ws.reduce((n, w) => n + (w.confidence ?? 0), 0) / ws.length;
      return {
        words: ws,
        text,
        conf,
        quality: real.reduce((n, w) => n + w.text.length, 0) / Math.max(1, ws.reduce((n, w) => n + w.text.length, 0)),
        h: 0, // set below from width
        tx0: 0,
        x0: Math.min(...ws.map((w) => w.bbox.x0)), x1: Math.max(...ws.map((w) => w.bbox.x1)),
        y0: Math.min(...ws.map((w) => w.bbox.y0)), y1: Math.max(...ws.map((w) => w.bbox.y1))
      };
    }).map((sg) => {
      // Comparable "size" for every line: the font size its width implies (letter-independent).
      const body = sg.text.replace(/^•\s*/, "");
      const first = sg.words.find((w) => !/^[•»«¢©]$/.test(w.text.trim()) && !/^eo$/.test(w.text.trim()));
      sg.tx0 = sg.text.startsWith("•") && first ? first.bbox.x0 : sg.x0;
      const fromWidth = body.length >= 6 ? sizeFromWidth(body, sg.x1 - sg.tx0, false, "Arial") : 0;
      const fromHeight = (sg.y1 - sg.y0) * 0.78;
      sg.h = fromWidth && fromWidth < fromHeight * 1.8 && fromWidth > fromHeight * 0.45 ? fromWidth : fromHeight;
      return sg;
    });
  }

  // Share of the pixels around a box that differ from the typical
  // background: high = the text sits on a picture. Robust to a few
  // neighbouring text pixels (tight line spacing).
  function ringBusy(img, b, pad) {
    const { data, width, height } = img;
    const lums = [];
    const add = (x, y) => { if (x >= 0 && y >= 0 && x < width && y < height) { const i = (y * width + x) * 4; lums.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]); } };
    for (let x = b.x0 - pad; x <= b.x1 + pad; x += 2) { add(x, b.y0 - pad); add(x, b.y1 + pad); }
    for (let y = b.y0 - pad; y <= b.y1 + pad; y += 2) { add(b.x0 - pad, y); add(b.x1 + pad, y); add(b.x0 - pad - 4, y); add(b.x1 + pad + 4, y); }
    if (!lums.length) return 0;
    const med = median(lums);
    return lums.filter((v) => Math.abs(v - med) > 40).length / lums.length;
  }

  // Luminance standard deviation around a box (large = photo / strong gradient behind it).
  function ringSpread(img, b, pad) {
    const { data, width, height } = img;
    const lums = [];
    const add = (x, y) => { if (x >= 0 && y >= 0 && x < width && y < height) { const i = (y * width + x) * 4; lums.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]); } };
    for (let x = b.x0 - pad; x <= b.x1 + pad; x += 3) { add(x, b.y0 - pad); add(x, b.y1 + pad); }
    for (let y = b.y0 - pad; y <= b.y1 + pad; y += 3) { add(b.x0 - pad, y); add(b.x1 + pad, y); }
    if (lums.length < 4) return 0;
    const mean = lums.reduce((a, v) => a + v, 0) / lums.length;
    return Math.sqrt(lums.reduce((a, v) => a + (v - mean) ** 2, 0) / lums.length);
  }

  // Group segments into paragraphs: same left edge (or centre), similar size, close lines.
  function groupSegments(segs) {
    const groups = [];
    for (const seg of [...segs].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
      const h = seg.h;
      const cx = (seg.x0 + seg.x1) / 2;
      const g = groups.find((gr) => {
        const last = gr[gr.length - 1];
        const lh = last.h;
        if (Math.max(h, lh) / Math.max(1, Math.min(h, lh)) > 1.28) return false;
        const gap = seg.y0 - last.y1;
        // Lines in a paragraph sit close; a half-line gap or a bullet starts a new paragraph.
        if (gap < -lh * 0.35 || gap > Math.max(h, lh) * 0.5) return false;
        if (/^•/.test(seg.text)) return false;
        const left = Math.abs(seg.tx0 - last.tx0) < Math.max(h, lh) * 0.9;
        const centre = Math.abs(cx - (last.x0 + last.x1) / 2) < Math.max(h, lh) * 0.9;
        const overlap = Math.min(seg.x1, last.x1) - Math.max(seg.x0, last.x0) > 0;
        return overlap && (left || centre);
      });
      if (g) g.push(seg); else groups.push([seg]);
    }
    return groups;
  }

  // Pick font family + weight by drawing the line and comparing with the original pixels.
  const FONT_CANDIDATES = [["Arial", false], ["Arial", true], ["Georgia", false], ["Georgia", true]];
  function matchFont(img, seg, bg) {
    const w = Math.max(1, Math.round(seg.x1 - seg.x0));
    const h = Math.max(1, Math.round(seg.y1 - seg.y0));
    if (w * h > 400000 || seg.text.length < 3) return null;
    const { data, width } = img;
    const ink = new Uint8Array(w * h);
    let inkCount = 0;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const i = ((seg.y0 + y) * width + (seg.x0 + x)) * 4;
      if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 150) { ink[y * w + x] = 1; inkCount += 1; }
    }
    if (!inkCount) return null;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d", { willReadFrequently: true });
    const text = seg.text.replace(/^•\s*/, "");
    let best = null;
    const scores = {};
    for (const [family, bold] of FONT_CANDIDATES) {
      const size = sizeFromWidth(text, w - (seg.text.startsWith("•") ? h * 0.9 : 0), bold, family);
      if (!size) continue;
      cx.clearRect(0, 0, w, h);
      cx.fillStyle = "#000";
      cx.font = `${bold ? 700 : 400} ${size}px ${family === "Georgia" ? "Georgia, serif" : "Arial, sans-serif"}`;
      cx.textBaseline = "alphabetic";
      const m = cx.measureText(text);
      const asc = m.actualBoundingBoxAscent || size * 0.75;
      const desc = m.actualBoundingBoxDescent || size * 0.2;
      const top = (h - (asc + desc)) / 2 + asc;
      cx.fillText(text, w - m.width, top);
      const d = cx.getImageData(0, 0, w, h).data;
      let both = 0, either = 0;
      for (let k = 0; k < w * h; k += 1) {
        const r = d[k * 4 + 3] > 110 ? 1 : 0;
        if (r && ink[k]) both += 1;
        if (r || ink[k]) either += 1;
      }
      const score = either ? both / either : 0;
      scores[`${family}${bold ? "B" : ""}`] = score;
      if (!best || score > best.score) best = { family, bold, size, score };
    }
    if (best) {
      // Weight margin within the winning family: bold only when it fits clearly better.
      best.boldMargin = (scores[`${best.family}B`] || 0) - (scores[best.family] || 0);
    }
    return best;
  }

  const longest0 = (group) => [...group].sort((a, b) => b.text.length - a.text.length)[0];

  async function analyze(slide, onProgress = () => {}, options = {}) {
    slide.status = "working";
    const blocks = await P.ocrBlocks(slide.original, (m) => {
      if (m.status === "recognizing text") onProgress(m.progress);
    });
    const octx = slide.original.getContext("2d", { willReadFrequently: true });
    const img = octx.getImageData(0, 0, slide.w, slide.h);
    const elements = [];
    const boxes = [];

    // 1. Keep real text: confident, plausible words, on a calm background.
    const dropped = [];
    const segs = segmentsOf(blocks, img).filter((sg) => {
      const h = sg.y1 - sg.y0;
      const letters = sg.text.replace(/[^\p{L}\p{N}]/gu, "").length;
      const why = letters < 2 || h < 8 ? "tiny"
        : /notebook\s?lm/i.test(sg.text) && sg.y0 > slide.h * 0.85 && sg.text.length < 20 ? "watermark"
        : sg.conf < 60 ? `conf ${Math.round(sg.conf)}`
        : sg.quality < (sg.conf >= 80 ? 0.5 : 0.7) ? `quality ${sg.quality.toFixed(2)}`
        : letters <= 3 && sg.conf < 80 ? "short"
        : (sg.text.match(/\d/g) || []).length > (sg.text.match(/\p{L}/gu) || []).length * 1.5 && !/\p{L}{4,}/u.test(sg.text) ? "numbers (chart)"
        : ringBusy(img, sg, Math.max(3, Math.round(h * 0.2))) > 0.3 ? "busy background" : "";
      if (why) dropped.push(`${why}: ${sg.text}`);
      return !why;
    });
    // Drop overlapping duplicate readings, keeping the more confident one.
    const kept = [];
    for (const sg of [...segs].sort((a, b) => b.conf * b.text.length - a.conf * a.text.length)) {
      const area = (sg.x1 - sg.x0) * (sg.y1 - sg.y0);
      const clash = kept.some((k) => {
        const ix = Math.max(0, Math.min(k.x1, sg.x1) - Math.max(k.x0, sg.x0));
        const iy = Math.max(0, Math.min(k.y1, sg.y1) - Math.max(k.y0, sg.y0));
        return ix * iy > area * 0.3;
      });
      if (clash) dropped.push(`overlap: ${sg.text}`); else kept.push(sg);
    }
    segs.length = 0;
    segs.push(...kept);
    slide.debugDropped = dropped;


    // 2. Paragraphs, style, boxes.
    const groupsFound = groupSegments(segs);

    for (const group of groupsFound) {
      const x0 = Math.min(...group.map((g) => g.x0));
      const y0 = Math.min(...group.map((g) => g.y0));
      const x1 = Math.max(...group.map((g) => g.x1));
      const y1 = Math.max(...group.map((g) => g.y1));
      // Text over a photo or strong gradient: keep it in the picture (removing it would leave patches).
      if (ringSpread(img, { x0, y0, x1, y1 }, 10) > 45) continue;
      const lineH = median(group.map((g) => g.h));
      const style = sampleStyle(img, { x0, y0, x1, y1 });
      // Match the font on lines without a "Label:" lead-in (labels are often bold/grey).
      const plain = group.filter((g) => !/^[^:]{2,30}:\s/.test(g.text) && g.text.length >= 6);
      const probe = (plain.length ? plain : group).slice().sort((a, b) => b.text.length - a.text.length).slice(0, 2);
      const votes = probe.map((g) => matchFont(img, g, style.bg)).filter(Boolean);
      const margin = votes.length ? votes.reduce((a, v) => a + (v.boldMargin || 0), 0) / votes.length : 0;
      const font = votes.length
        ? { family: votes.filter((v) => v.family === "Georgia").length > votes.length / 2 ? "Georgia" : votes[0].family, bold: margin > 0.13, size: votes[0].size }
        : { family: "Arial", bold: false, size: lineH * 0.8 };
      // Size: median of width-fitted sizes for the longer lines, in the matched font.
      const sizes = group.filter((g) => g.text.length >= 6).map((g) => sizeFromWidth(g.text.replace(/^•\s*/, ""), g.x1 - g.x0 - (g.text.startsWith("•") ? lineH * 0.9 : 0), font.bold, font.family)).filter(Boolean);
      let fontSize = sizes.length ? median(sizes) : font.size;
      if (!(fontSize > lineH * 0.55 && fontSize < lineH * 1.7)) fontSize = lineH * 0.8;
      fontSize = Math.max(8, Math.round(fontSize));
      const pitch = group.length > 1 ? (group[group.length - 1].y0 - group[0].y0) / (group.length - 1) : fontSize * 1.2;
      const lineHeight = Math.max(1, Math.min(1.9, pitch / fontSize));
      const lefts = group.map((g) => g.x0);
      const centres = group.map((g) => (g.x0 + g.x1) / 2);
      const spread = (a) => Math.max(...a) - Math.min(...a);
      let align = "left";
      if (group.length > 1 && spread(lefts) > fontSize * 0.6 && spread(centres) < fontSize * 0.8) align = "center";
      else if (group.length === 1 && Math.abs((x0 + x1) / 2 - slide.w / 2) < slide.w * 0.03 && x0 > slide.w * 0.12) align = "center";
      // "Label:" lead-ins (NotebookLM style): keep their own colour/weight.
      let label = null;
      const lab = group.find((g) => /^(?:•\s*)?[^:]{2,40}:\s/.test(g.text));
      if (lab) {
        const n = lab.text.replace(/^•\s*/, "").split(":")[0].split(/\s+/).length;
        const lw = lab.words.filter((w) => w.text.trim() && !/^[•»«]$/.test(w.text)).slice(0, n);
        if (lw.length) {
          const lb = { x0: Math.min(...lw.map((w) => w.bbox.x0)), y0: Math.min(...lw.map((w) => w.bbox.y0)), x1: Math.max(...lw.map((w) => w.bbox.x1)), y1: Math.max(...lw.map((w) => w.bbox.y1)) };
          const ls = sampleStyle(img, lb);
          const hexToRgb = (hx) => [1, 3, 5].map((k) => parseInt(hx.slice(k, k + 2), 16));
          const differs = dist(hexToRgb(ls.color), hexToRgb(style.color)) > 45;
          const lf = matchFont(img, { ...lb, text: lw.map((w) => w.text).join(" ") }, style.bg);
          const lbold = differs || (lf ? (lf.boldMargin || 0) > 0.05 : ls.inkRatio > style.inkRatio * 1.25);
          if (differs || lbold !== font.bold) label = { color: differs ? ls.color : style.color, bold: lbold };
        }
      }
      const pad = Math.max(4, Math.round(fontSize * 0.2));
      const inkRgb = [1, 3, 5].map((k) => parseInt(style.color.slice(k, k + 2), 16));
      group.forEach((g) => boxes.push({ x0: g.x0 - pad, y0: g.y0 - pad, x1: g.x1 + pad, y1: g.y1 + pad, bg: style.bg, ink: inkRgb }));
      // Box wide enough for the longest line in our font, so it doesn't re-wrap.
      measureCtx.font = `${font.bold ? 700 : 400} ${fontSize}px ${font.family === "Georgia" ? "Georgia, serif" : "Arial, sans-serif"}`;
      const textW = Math.max(...group.map((g) => measureCtx.measureText(g.text).width));
      const boxW = Math.min(slide.w - Math.max(0, x0 - 4), Math.max(x1 - x0, textW) * 1.04 + 6);
      elements.push({
        id: id(),
        type: "text",
        x: align === "center" ? (x0 + x1) / 2 - boxW / 2 : x0 - 2,
        y: y0 - (fontSize * lineHeight - lineH) / 2 - fontSize * 0.04,
        w: boxW,
        h: group.length * fontSize * lineHeight,
        text: group.map((g) => g.text).join("\n"),
        fontSize,
        lineHeight: Math.round(lineHeight * 100) / 100,
        color: style.color,
        bold: font.bold,
        italic: false,
        align,
        fontFamily: font.family,
        _lines: group.map((g) => ({ w: g.x1 - g.x0 })),
        _lineH: lineH,
        ...(label ? { labelColor: label.color, labelBold: label.bold } : {})
      });
    }
    // Headings (much larger than the body text, or big text near the top) are bold.
    const bodySize = median(elements.map((e) => e.fontSize));
    const isHeading = (e) => e.fontSize >= Math.max(44, bodySize * 1.4) || (e.y < slide.h * 0.22 && e.fontSize >= bodySize * 1.25 && e.fontSize >= 36);
    // Paragraphs of similar size on one slide share a font: use the majority family and weight.
    // Only multi-line paragraphs take part; titles and short labels keep their own font.
    const body = elements.filter((e) => !isHeading(e) && e.text.includes("\n"));
    body.forEach((e) => {
      const peers = body.filter((o) => Math.abs(o.fontSize - e.fontSize) <= e.fontSize * 0.25);
      if (peers.length < 2) return;
      const weight = (pred) => peers.filter(pred).reduce((n, o) => n + o.text.length, 0);
      const total = weight(() => true);
      e.fontFamily = weight((o) => o.fontFamily === "Georgia") > total / 2 ? "Georgia" : "Arial";
      e.bold = weight((o) => o.bold) > total * 0.8;
    });
    // Then re-fit size and box width to the final font so nothing re-wraps.
    elements.forEach((e) => {
      if (isHeading(e)) e.bold = true;
      const lines = e.text.split("\n");
      const fam = e.fontFamily === "Georgia" ? "Georgia, serif" : "Arial, sans-serif";
      const fit = e._lines.map((ln, i) => sizeFromWidth((lines[i] || "").replace(/^•\s*/, ""), ln.w - (lines[i]?.startsWith("•") ? e._lineH * 0.9 : 0), e.bold, e.fontFamily)).filter((v, i) => v && (lines[i] || "").length >= 6);
      if (fit.length) {
        const size = Math.round(median(fit));
        if (size > e._lineH * 0.55 && size < e._lineH * 1.7) {
          e.h = (e.h / e.fontSize) * size;
          e.fontSize = size;
        }
      }
      measureCtx.font = `${e.bold ? 700 : 400} ${e.fontSize}px ${fam}`;
      const need = Math.max(...lines.map((ln) => measureCtx.measureText(ln).width)) * 1.04 + 6;
      if (need > e.w) {
        if (e.align === "center") e.x -= (need - e.w) / 2;
        e.w = Math.min(slide.w - Math.max(0, e.x), need);
      }
      delete e._lines;
      delete e._lineH;
    });
    const clean = document.createElement("canvas");
    clean.width = slide.w;
    clean.height = slide.h;
    const cctx = clean.getContext("2d", { willReadFrequently: true });
    cctx.drawImage(slide.original, 0, 0);
    paintOut(cctx, boxes, slide.w, slide.h);
    slide.clean = clean;
    slide.elements = elements;
    if (options.objects !== false) {
      try {
        const found = detectObjects(slide);
        await Promise.all(found.objects.filter((o) => o.type === "image").map((o) => imageFor(o.src).decode().catch(() => {})));
        slide.elements = [...found.objects, ...elements];
        slide.objectsNote = found.skipped || "";
      } catch (_error) {
        // Keep the flat background if detection fails.
      }
    }
    slide.status = "done";
    return slide;
  }


  /* ---------- Pictures and shapes: split the background into objects ---------- */
  // Works on slides with a plain background (most NotebookLM decks). Finds
  // non-background regions on the text-free image, turns solid blocks into
  // native rectangles / ellipses and everything else into pictures with a
  // transparent background, then clears them from the background image.
  function detectObjects(slide) {
    const W0 = slide.w, H0 = slide.h;
    const k = 4; // work at 1/4 size
    const sw = Math.ceil(W0 / k), sh = Math.ceil(H0 / k);
    const small = document.createElement("canvas");
    small.width = sw;
    small.height = sh;
    const sctx = small.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(slide.clean, 0, 0, sw, sh);
    const sd = sctx.getImageData(0, 0, sw, sh).data;
    const px = (x, y) => { const i = (y * sw + x) * 4; return [sd[i], sd[i + 1], sd[i + 2]]; };

    // 1. Background: most common border colour; must cover most of the border.
    const border = [];
    for (let x = 0; x < sw; x += 2) { border.push(px(x, 1), px(x, sh - 2)); }
    for (let y = 0; y < sh; y += 2) { border.push(px(1, y), px(sw - 2, y)); }
    const bins = new Map();
    border.forEach((c) => { const key = c.map((v) => v >> 4).join(","); bins.set(key, (bins.get(key) || 0) + 1); });
    const topKey = [...bins.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const inBin = border.filter((c) => c.map((v) => v >> 4).join(",") === topKey);
    const bg = [0, 1, 2].map((ch) => median(inBin.map((c) => c[ch])));
    const near = (c, t) => Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]) < t;
    if (border.filter((c) => near(c, 45)).length < border.length * 0.6) return { objects: [], skipped: "background not plain" };

    // 2. Foreground mask, dilated so parts of one illustration join up.
    const mask = new Uint8Array(sw * sh);
    for (let y = 0; y < sh; y += 1) for (let x = 0; x < sw; x += 1) if (!near(px(x, y), 40)) mask[y * sw + x] = 1;
    const grown = new Uint8Array(sw * sh);
    const R = 3;
    for (let y = 0; y < sh; y += 1) for (let x = 0; x < sw; x += 1) {
      if (!mask[y * sw + x]) continue;
      for (let dy = -R; dy <= R; dy += 1) for (let dx = -R; dx <= R; dx += 1) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < sw && yy < sh) grown[yy * sw + xx] = 1;
      }
    }

    // 3. Connected components → boxes.
    const seen = new Uint8Array(sw * sh);
    let boxes = [];
    const stack = [];
    for (let i = 0; i < sw * sh; i += 1) {
      if (!grown[i] || seen[i]) continue;
      let x0 = sw, y0 = sh, x1 = 0, y1 = 0, count = 0;
      stack.push(i);
      seen[i] = 1;
      while (stack.length) {
        const j = stack.pop();
        const x = j % sw, y = (j / sw) | 0;
        if (mask[j]) count += 1;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const n of [j - 1, j + 1, j - sw, j + sw]) {
          if (n < 0 || n >= sw * sh || seen[n] || !grown[n]) continue;
          if ((n === j - 1 && x === 0) || (n === j + 1 && x === sw - 1)) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
      if (count < 12) continue; // specks
      boxes.push({ x0: Math.max(0, x0 - 1), y0: Math.max(0, y0 - 1), x1: Math.min(sw - 1, x1 + 1), y1: Math.min(sh - 1, y1 + 1), count });
    }
    // Merge overlapping boxes.
    let merged = true;
    while (merged) {
      merged = false;
      for (let a = 0; a < boxes.length && !merged; a += 1) for (let b = a + 1; b < boxes.length && !merged; b += 1) {
        const A = boxes[a], B = boxes[b];
        if (A.x0 <= B.x1 + 1 && B.x0 <= A.x1 + 1 && A.y0 <= B.y1 + 1 && B.y0 <= A.y1 + 1) {
          boxes[a] = { x0: Math.min(A.x0, B.x0), y0: Math.min(A.y0, B.y0), x1: Math.max(A.x1, B.x1), y1: Math.max(A.y1, B.y1), count: A.count + B.count };
          boxes.splice(b, 1);
          merged = true;
        }
      }
    }
    const slideArea = sw * sh;
    boxes = boxes.filter((b) => {
      const area = (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);
      return area < slideArea * 0.85 && (area > slideArea * 0.0012 || b.x1 - b.x0 > sw * 0.1 || b.y1 - b.y0 > sh * 0.1);
    });
    if (!boxes.length) return { objects: [] };

    // 4. Classify at full resolution, cut out, clear from the background.
    const cctx = slide.clean.getContext("2d", { willReadFrequently: true });
    const full = cctx.getImageData(0, 0, W0, H0);
    const fd = full.data;
    const objects = [];
    const isFg = (i) => Math.abs(fd[i] - bg[0]) + Math.abs(fd[i + 1] - bg[1]) + Math.abs(fd[i + 2] - bg[2]) >= 40;
    for (const b of boxes) {
      // Tighten to the real pixels (the coarse box includes dilation padding).
      let tx0 = W0, ty0 = H0, tx1 = -1, ty1 = -1;
      const bx0 = Math.max(0, b.x0 * k - 4), by0 = Math.max(0, b.y0 * k - 4);
      const bx1 = Math.min(W0, (b.x1 + 1) * k + 4), by1 = Math.min(H0, (b.y1 + 1) * k + 4);
      for (let y = by0; y < by1; y += 1) for (let x = bx0; x < bx1; x += 1) {
        if (!isFg((y * W0 + x) * 4)) continue;
        if (x < tx0) tx0 = x; if (x > tx1) tx1 = x; if (y < ty0) ty0 = y; if (y > ty1) ty1 = y;
      }
      if (tx1 < 0) continue;
      const X0 = Math.max(0, tx0 - 2), Y0 = Math.max(0, ty0 - 2);
      const X1 = Math.min(W0, tx1 + 3), Y1 = Math.min(H0, ty1 + 3);
      const w = X1 - X0, h = Y1 - Y0;
      if (w < 3 || h < 3) continue;
      let fg = 0, core = 0, sr = 0, sg2 = 0, sb = 0, sq = 0;
      const cut = new ImageData(w, h);
      for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
        const i = ((Y0 + y) * W0 + (X0 + x)) * 4, o = (y * w + x) * 4;
        const c = [fd[i], fd[i + 1], fd[i + 2]];
        const d = Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]);
        cut.data[o] = c[0]; cut.data[o + 1] = c[1]; cut.data[o + 2] = c[2];
        // Soft edge: background → transparent, anti-aliased rim → partial.
        cut.data[o + 3] = d < 24 ? 0 : d > 70 ? 255 : Math.round(((d - 24) / 46) * 255);
        if (d >= 40) fg += 1;
        if (d >= 90) { core += 1; sr += c[0]; sg2 += c[1]; sb += c[2]; sq += lum(c) ** 2; } // colour stats on core pixels (not anti-aliased edges)
      }
      if (!fg) continue;
      const n = Math.max(1, core);
      const mean = [sr / n, sg2 / n, sb / n];
      const lumStd = core ? Math.sqrt(Math.max(0, sq / n - lum(mean) ** 2)) : 99;
      const fill = fg / Math.max(1, (w - 4) * (h - 4));
      const color = hex(...mean);
      let obj;
      const thin = Math.min(w, h) <= 12 && Math.max(w, h) >= 30;
      if ((thin && lumStd < 32) || (lumStd < 14 && fill > 0.88)) {
        obj = { type: "rect", fill: color, radius: 0 };
      } else if (lumStd < 14 && fill > 0.68 && fill < 0.84 && Math.abs(w - h) < Math.max(w, h) * 0.15) {
        obj = { type: "ellipse", fill: color };
      } else {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d").putImageData(cut, 0, 0);
        obj = { type: "image", src: c.toDataURL("image/png") };
      }
      objects.push({ id: id(), ...obj, x: X0, y: Y0, w, h, opacity: 1, detected: true });
      // Clear it from the background so moving it leaves no ghost.
      for (let y = Y0; y < Y1; y += 1) for (let x = X0; x < X1; x += 1) {
        const i = (y * W0 + x) * 4;
        fd[i] = bg[0]; fd[i + 1] = bg[1]; fd[i + 2] = bg[2];
      }
    }
    cctx.putImageData(full, 0, 0);
    // Big things behind small ones.
    objects.sort((a, b) => b.w * b.h - a.w * a.h);
    return { objects, bg: hex(...bg) };
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

  // "Label: rest" → [{text, label:true}, {text}] when the element styles labels.
  const LABEL_RE = /^((?:•\s*)?[^:\n]{2,40}:)(\s.*)$/;
  function lineRuns(el, line) {
    const m = el.labelColor ? line.match(LABEL_RE) : null;
    return m ? [{ text: m[1], label: true }, { text: m[2] }] : [{ text: line }];
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
        lines.forEach((line, i) => {
          const y = el.y * scale + lh * i + lh / 2;
          const runs = lineRuns(el, line);
          if (runs.length === 1) return ctx.fillText(line, x, y);
          // Two runs: measure the whole line to place it, then draw each run.
          const fontFor = (r) => fontString({ ...el, bold: r.label ? el.labelBold : el.bold }, scale);
          const widths = runs.map((r) => { ctx.font = fontFor(r); return ctx.measureText(r.text).width; });
          const total = widths.reduce((a, b) => a + b, 0);
          let cx = el.align === "center" ? x - total / 2 : el.align === "right" ? x - total : x;
          ctx.textAlign = "left";
          runs.forEach((r, k) => {
            ctx.font = fontFor(r);
            ctx.fillStyle = r.label ? el.labelColor : el.color;
            ctx.fillText(r.text, cx, y);
            cx += widths[k];
          });
          ctx.textAlign = el.align === "center" ? "center" : el.align === "right" ? "right" : "left";
          ctx.font = fontString(el, scale);
          ctx.fillStyle = el.color;
        });
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
      s.src = `${window.NT_VENDOR || "/tools/vendor"}/pptxgenjs/pptxgen.bundle.js`;
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
          const runs = el.labelColor
            ? String(el.text).split("\n").flatMap((line, i, all) => lineRuns(el, line).map((r, k, arr) => ({
                text: r.text,
                options: { ...(r.label ? { color: noHash(el.labelColor), bold: Boolean(el.labelBold) } : {}), ...(k === arr.length - 1 && i < all.length - 1 ? { breakLine: true } : {}) }
              })))
            : el.text;
          s.addText(runs, {
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
          const labelFont = el.labelColor ? await pick({ ...el, bold: el.labelBold }) : font;
          lines.forEach((line, n) => {
            const runs = lineRuns(el, line).map((r) => ({ ...r, f: r.label ? labelFont : font }));
            const widths = runs.map((r) => r.f.widthOfTextAtSize(r.text, size));
            const tw = widths.reduce((a, b) => a + b, 0);
            let x = el.align === "center" ? el.x * k + (el.w * k - tw) / 2 : el.align === "right" ? (el.x + el.w) * k - tw : el.x * k;
            const baseline = ph - (el.y * k + lh * n + lh / 2 + size * 0.35);
            runs.forEach((r, i) => {
              page.drawText(r.text, { x, y: baseline, size, font: r.f, color: rgbOf(r.label ? el.labelColor : el.color), opacity: op });
              x += widths[i];
            });
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

  return { lineRuns, W, id, loadPdf, renderOriginal, newSlide, blankSlide, analyze, skipAnalysis, drawSlide, slideCanvas, cssFamily, exportPptx, exportPdf, exportPngs };
})();
