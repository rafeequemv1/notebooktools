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
    delete slide._map;
    delete slide._painted;
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
    if (/^[$€£¥]?\d+([.,]\d+)?([%xX×kKmMbB]|bn)?$/.test(w)) return true; // 3.2x, $40, 10k, 2.5M
    if (/^[\p{L}][\p{L}'’\-]*$/u.test(w)) {
      if (w.length === 1) return /^[aAI]$/.test(w);
      if (w.length >= 3 && !/[aeiouyAEIOUYÀ-ɏ]/.test(w)) return /^[A-Z]{2,6}$/.test(w); // acronyms only
      return !/(.)\1\1/.test(w);
    }
    return /^[\p{L}\p{N}][\p{L}\p{N}'’\-./()]*$/u.test(w) && /[\p{L}]{2}/u.test(w);
  }

  // Join a line's words. Wide letter spacing (bold titles) makes OCR split
  // words ("Rama n Fi ngerpri nt"): a gap much narrower than the line's real
  // spaces is no space at all.
  const COMMON_SHORT = new Set(["a", "i", "an", "as", "at", "be", "by", "do", "go", "he", "if", "in", "is", "it", "me", "my", "no", "of", "on", "or", "so", "to", "up", "us", "we", "vs", "the", "and", "for", "are", "was", "not", "but", "all", "any", "can", "has", "its", "new", "one", "our", "out", "two", "who", "why", "how"]);
  function joinWords(ws) {
    if (ws.length < 2) return (ws[0]?.text || "").trim();
    const h = median(ws.map((w) => w.bbox.y1 - w.bbox.y0));
    const gaps = ws.slice(1).map((w, i) => w.bbox.x0 - ws[i].bbox.x1);
    const sorted = [...gaps].sort((a, b) => a - b);
    const wide = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))];
    let out = ws[0].text.trim();
    ws.slice(1).forEach((w, i) => {
      const t = w.text.trim();
      // ...but only for pieces that aren't words on their own ("n", "nt", "Fi"), never "of graphene"
      const prev = out.split(" ").pop();
      const piece = (x) => !COMMON_SHORT.has(x.toLowerCase()) && (x.length <= 2 || !/[aeiouy]/i.test(x));
      const tight = gaps[i] < Math.min(h * 0.22, wide * 0.5) && /[\p{L}]$/u.test(out) && /^[\p{L}]/u.test(t) && (piece(prev) || piece(t));
      // A lone "." read off a colon, right after a word: "Verification . The" → "Verification: The"
      if (t === "." && (w.confidence ?? 100) < 75 && /[\p{L}]$/u.test(out) && ws[i + 2] && /^[A-Z]/.test(ws[i + 2].text)) { out += ":"; return; }
      out += (tight ? "" : " ") + t;
    });
    return out.replace(/\s+/g, " ").trim();
  }

  // Common OCR misreads on slides.
  const SUBSCRIPT_2 = /\b(SiO|TiO|SnO|ZrO|HfO|MnO|NO|MoS|WS|MoSe|WSe|MoTe|WTe|NbSe|TaS|PtSe)[,₂2](?=[\s.,;:)]|$)/g;
  function fixText(text) {
    return String(text)
      .replace(/\b(1[5-9]\d0|20[0-9]0)5\b/g, "$1s") // 19305 → 1930s
      .replace(/(\d{4}s?)\s*-\s*(\d{4})/g, "$1–$2") // 1930s-2004 → 1930s–2004
      .replace(SUBSCRIPT_2, "$1₂") // SiO, → SiO₂
      .replace(/\bH[,2]O\b/g, "H₂O")
      .replace(/\bCO[,2](?=\s+[a-z]|[.;:)]|$)/g, "CO₂")
      .replace(/\s*(?:[—–-]+\s*>|=>)\s*/g, " → ") // —> arrows
      .replace(/\s+([,.;:!?])(?=\s|$)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
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
        const listMark = (w, next) => /^\d{1,2}[.)]$/.test(w.text.trim()) && next && /^[\p{Lu}"“‘(]/u.test(next.text.trim());
        while (cur.length && (junkEnd(cur[0]) || weak(cur[0])) && !/^[•»«¢]$/.test(cur[0].text.trim()) && !listMark(cur[0], cur[1])) cur.shift();
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
      const text = fixText(joinWords(ws)).replace(BULLET_RE, (m) => (m.trim() ? "• " : ""));
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
  function ringSpread(img, b, pad, others = []) {
    const { data, width, height } = img;
    const lums = [];
    // Pixels inside other lines of text aren't background (tight line spacing)
    const inText = (x, y) => others.some((o) => o !== b && x >= o.x0 - 2 && x <= o.x1 + 2 && y >= o.y0 - 2 && y <= o.y1 + 2);
    const add = (x, y) => { if (x >= 0 && y >= 0 && x < width && y < height && !inText(x, y)) { const i = (y * width + x) * 4; lums.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]); } };
    for (let x = b.x0 - pad; x <= b.x1 + pad; x += 3) { add(x, b.y0 - pad); add(x, b.y1 + pad); }
    for (let y = b.y0 - pad; y <= b.y1 + pad; y += 3) { add(b.x0 - pad, y); add(b.x1 + pad, y); }
    if (lums.length < 4) return 0;
    const mean = lums.reduce((a, v) => a + v, 0) / lums.length;
    return Math.sqrt(lums.reduce((a, v) => a + (v - mean) ** 2, 0) / lums.length);
  }

  function weightedMedian(pairs) {
    const sorted = [...pairs].sort((a, b) => a[0] - b[0]);
    const half = sorted.reduce((n, p) => n + p[1], 0) / 2;
    let acc = 0;
    for (const [v, w] of sorted) { acc += w; if (acc >= half) return v; }
    return sorted.length ? sorted[sorted.length - 1][0] : 0;
  }
  const rgbOf = (hx) => [1, 3, 5].map((k) => parseInt(String(hx).slice(k, k + 2), 16) || 0);
  const boxOf = (ws) => ({ x0: Math.min(...ws.map((w) => w.bbox.x0)), y0: Math.min(...ws.map((w) => w.bbox.y0)), x1: Math.max(...ws.map((w) => w.bbox.x1)), y1: Math.max(...ws.map((w) => w.bbox.y1)) });
  // Typical stroke width of regular text at a size (slides are read at 1600 px
  // wide). Bold is judged against the slide's own body text, since fonts differ.
  const strokeNorm = (size) => 0.085 * size + 1.4;
  const BOLD_STEP = 1.12;

  /** Colour and weight of a line, and of its "Label:" lead-in when it has one. */
  function lineStyle(img, sg) {
    const words = sg.words.filter((w, i) => !(i === 0 && /^[•»«·●▪◦*®©¢eo]$/.test(w.text.trim())));
    const colon = words.slice(0, 6).findIndex((w) => /:$/.test(w.text.trim()));
    const hasLabel = colon >= 0 && colon < words.length - 1;
    const rest = hasLabel ? words.slice(colon + 1) : words;
    const box = boxOf(rest.length ? rest : sg.words);
    const st = sampleStyle(img, box);
    sg.bg = st.bg;
    sg.color = st.color;
    sg.stroke = strokeRatio(img, box, st.bg, sg.h) * sg.h;
    sg.weight = sg.stroke / strokeNorm(sg.h); // ~0.8–1.0 regular, higher when bold (depends on the font)
    sg.serif = serifScore(img, words.length ? words : sg.words, st.bg);
    // Share of the line's letters in words that lean (per word, so a line with one
    // italic title in it stays upright)
    const longWords = (words.length ? words : sg.words).filter((w) => (w.text.match(/\p{L}/gu) || []).length >= 4);
    const leaning = longWords.filter((w) => slantOf(img, [w], st.bg) >= 4);
    const chars = (list) => list.reduce((n, w) => n + w.text.length, 0);
    sg.italicShare = longWords.length ? chars(leaning) / chars(longWords) : 0;
    sg.label = null;
    if (hasLabel) {
      const lb = boxOf(words.slice(0, colon + 1));
      const ls = strokeRatio(img, lb, st.bg, sg.h) * sg.h;
      sg.label = { color: sampleStyle(img, lb).color, stroke: ls, weight: ls / strokeNorm(sg.h) };
    }
  }

  /** Ink just past either end of a short label: OCR read only part of it. */
  function cutOff(img, sg) {
    const { data, width, height } = img;
    const h = sg.y1 - sg.y0;
    const reach = Math.max(6, Math.round(h * 0.7));
    const bg = sg.bg || [255, 255, 255];
    const ink0 = sg.color ? rgbOf(sg.color) : null;
    const inkShare = (xa, xb) => {
      let ink = 0, all = 0;
      for (let y = Math.max(0, sg.y0 + 2); y < Math.min(height, sg.y1 - 2); y += 1) for (let x = Math.max(0, xa); x < Math.min(width, xb); x += 1) {
        const i = (y * width + x) * 4;
        all += 1;
        const offBg = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 160;
        // Only ink in the text's own colour: a cut-off letter, not a neighbouring picture
        const likeText = !ink0 || Math.abs(data[i] - ink0[0]) + Math.abs(data[i + 1] - ink0[1]) + Math.abs(data[i + 2] - ink0[2]) < 120;
        if (offBg && likeText) ink += 1;
      }
      return all ? ink / all : 0;
    };
    return inkShare(sg.x1 + 2, sg.x1 + reach) > 0.06 || inkShare(sg.x0 - reach, sg.x0 - 2) > 0.06;
  }

  // Serif "feet": at the baseline a serif face has extra horizontal ink beyond
  // its stems. Compares the ink just above the baseline with the ink across the
  // middle of the x-height (both rows cross the same stems). ~1.0–1.3 for sans,
  // higher for serif. 0 when the line is too small to tell.
  // Measured on the line's words without digits: a "1" with a flat foot looks like a serif.
  function serifScore(img, words, bg) {
    const { data, width, height } = img;
    const letters = words.filter((w) => !/\d/.test(w.text) && /\p{L}{2}/u.test(w.text));
    if (!letters.length) return 0;
    const box = boxOf(letters);
    const y0 = Math.max(0, Math.round(box.y0)), y1 = Math.min(height, Math.round(box.y1));
    const h = y1 - y0;
    if (box.x1 - box.x0 < 20 || h < 12) return 0;
    const rows = new Array(h).fill(0);
    const inkAt = (x, y) => { const i = (y * width + x) * 4; return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 160; };
    for (const wd of letters) {
      const xa = Math.max(0, Math.round(wd.bbox.x0)), xb = Math.min(width, Math.round(wd.bbox.x1));
      for (let y = 0; y < h; y += 1) for (let x = xa; x < xb; x += 1) if (inkAt(x, y0 + y)) rows[y] += 1;
    }
    const peak = Math.max(...rows);
    if (!peak) return 0;
    // x-height band: the dense rows; baseline = its last row
    let top = -1, bottom = -1;
    for (let y = 0; y < h; y += 1) if (rows[y] >= peak * 0.45) { if (top < 0) top = y; bottom = y; }
    const band = bottom - top;
    if (band < 6) return 0;
    const mid = Math.round(top + band * 0.5);
    const at = (y) => (rows[y] || 0);
    const foot = Math.max(at(bottom), at(bottom - 1));
    const stems = (at(mid - 1) + at(mid) + at(mid + 1)) / 3;
    return stems ? foot / stems : 0;
  }

  // Letter slant in degrees: shear the line's ink back by each angle and see which
  // makes the vertical strokes line up into the sharpest columns. ~0 upright,
  // ~10-15 italic. Measured on letters only (digits and symbols vary).
  function slantOf(img, words, bg) {
    const { data, width, height } = img;
    const letters = words.filter((w) => /\p{L}{2}/u.test(w.text));
    if (!letters.length) return 0;
    const box = boxOf(letters);
    const x0 = Math.max(0, Math.round(box.x0)), x1 = Math.min(width, Math.round(box.x1));
    const y0 = Math.max(0, Math.round(box.y0)), y1 = Math.min(height, Math.round(box.y1));
    const w = x1 - x0, h = y1 - y0;
    if (w < 30 || h < 12) return 0;
    // Left edges of strokes only (where ink starts): stems line up far more clearly
    // than filled letter shapes
    const ink = [];
    const isInk = (x, y) => { const i = (y * width + x) * 4; return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 200; };
    for (const wd of letters) {
      const xa = Math.max(1, Math.round(wd.bbox.x0)), xb = Math.min(width, Math.round(wd.bbox.x1));
      for (let y = y0; y < y1; y += 1) for (let x = xa; x < xb; x += 1) if (isInk(x, y) && !isInk(x - 1, y)) ink.push(x - x0, y - y0);
    }
    if (ink.length < 30) return 0;
    const sharp = (deg) => {
      const t = Math.tan((deg * Math.PI) / 180);
      const cols = new Float32Array(w + h);
      for (let j = 0; j < ink.length; j += 2) cols[Math.round(ink[j] + (ink[j + 1] - h) * t + h * 0.5)] += 1;
      let sq = 0;
      for (const v of cols) sq += v * v;
      return sq;
    };
    let best = 0, bestVal = -1;
    for (let deg = -6; deg <= 24; deg += 1) { const v = sharp(deg); if (v > bestVal) { bestVal = v; best = deg; } }
    // Lean only counts if it sharpens the strokes clearly over upright
    return bestVal > sharp(0) * 1.05 ? best : 0;
  }

  // Stroke thickness of the text in a box, as a share of the font size:
  // ~0.08–0.10 for regular weight, ~0.13+ for bold. Ink area divided by
  // half its outline gives the average stroke width.
  function strokeRatio(img, box, bg, fontSize) {
    const { data, width, height } = img;
    const x0 = Math.max(0, Math.round(box.x0)), x1 = Math.min(width, Math.round(box.x1));
    const y0 = Math.max(0, Math.round(box.y0)), y1 = Math.min(height, Math.round(box.y1));
    const w = x1 - x0, h = y1 - y0;
    if (w < 4 || h < 4 || !fontSize) return 0;
    const ink = new Uint8Array(w * h);
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const i = ((y0 + y) * width + (x0 + x)) * 4;
      if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 160) ink[y * w + x] = 1;
    }
    let area = 0, edge = 0;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      if (!ink[y * w + x]) continue;
      area += 1;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !ink[y * w + x - 1] || !ink[y * w + x + 1] || !ink[(y - 1) * w + x] || !ink[(y + 1) * w + x]) edge += 1;
    }
    return edge ? (2 * area) / edge / fontSize : 0;
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
        // Sizes of very short lines are guessed from their height ("ness" has no tall
        // letters and looks half its size), so they get a looser match
        const loose = seg.text.length < 8 || last.text.length < 8;
        if (Math.max(h, lh) / Math.max(1, Math.min(h, lh)) > (loose ? 2.2 : 1.28)) return false;
        const gap = seg.y0 - last.y1;
        // Lines in a paragraph sit close; a half-line gap or a bullet starts a new paragraph.
        if (gap < -lh * 0.35 || gap > Math.max(h, lh) * (loose ? 0.75 : 0.5)) return false;
        if (/^•/.test(seg.text)) return false;
        // A heading line on its own ("Mechanism:", "Concept:") is its own paragraph
        if (/:$/.test(last.text) && last.text.split(/\s+/).length <= 5 && seg.color && last.color
          && (seg.bold !== last.bold || dist(rgbOf(seg.color), rgbOf(last.color)) > 45)) return false;
        // A line in another colour or weight starts its own paragraph (red heading over black text)
        // (a line of a few letters can't be judged for weight, so only a clear colour change counts)
        if (seg.color && last.color) {
          const short = Math.min(seg.text.replace(/[^\p{L}]/gu, "").length, last.text.replace(/[^\p{L}]/gu, "").length) < 6;
          const colourGap = dist(rgbOf(seg.color), rgbOf(last.color));
          if (short ? colourGap > 120 : seg.bold !== last.bold || colourGap > 60) return false;
        }
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
      const serifBest = Math.max(scores.Georgia || 0, scores.GeorgiaB || 0);
      const sansBest = Math.max(scores.Arial || 0, scores.ArialB || 0);
      best.familyMargin = best.family === "Georgia" ? serifBest - sansBest : sansBest - serifBest;
      best.textLength = text.length;
    }
    return best;
  }

  /* Text the page pass never saw: labels inside boxes and on pictures, white text
     on colour. A second pass in sparse-text mode on a contrast map of the slide
     (each pixel's difference from its local background, drawn as dark on white),
     so any colour of text on any background reads as dark ink. New lines that
     don't overlap what was already found are added. */
  function contrastMap(slide) {
    const W = slide.w, H = slide.h;
    const src = slide.original.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H);
    const d = src.data;
    // Local background: median of a 7x7 neighbourhood on a 1/6 copy (a ~42 px window).
    // Text covers less than half of any such window, so the median is the background,
    // and it follows shape edges instead of smearing dark halos around them.
    const k = 6, R = 3, sw = Math.ceil(W / k), sh = Math.ceil(H / k);
    const small = new Uint8ClampedArray(sw * sh * 3);
    for (let y = 0; y < sh; y += 1) for (let x = 0; x < sw; x += 1) {
      const i = (Math.min(H - 1, y * k + 2) * W + Math.min(W - 1, x * k + 2)) * 4;
      const o = (y * sw + x) * 3;
      small[o] = d[i]; small[o + 1] = d[i + 1]; small[o + 2] = d[i + 2];
    }
    const med = new Uint8ClampedArray(sw * sh * 3);
    const win = new Array((2 * R + 1) ** 2);
    for (let y = 0; y < sh; y += 1) for (let x = 0; x < sw; x += 1) for (let c = 0; c < 3; c += 1) {
      let n = 0;
      for (let dy = -R; dy <= R; dy += 1) for (let dx = -R; dx <= R; dx += 1) {
        const yy = Math.min(sh - 1, Math.max(0, y + dy)), xx = Math.min(sw - 1, Math.max(0, x + dx));
        win[n++] = small[(yy * sw + xx) * 3 + c];
      }
      win.length = n;
      win.sort((a, b) => a - b);
      med[(y * sw + x) * 3 + c] = win[n >> 1];
    }
    for (let y = 0; y < H; y += 1) {
      const sy = Math.min(sh - 1, Math.floor(y / k));
      for (let x = 0; x < W; x += 1) {
        const i = (y * W + x) * 4, m = (sy * sw + Math.min(sw - 1, Math.floor(x / k))) * 3;
        const diff = Math.abs(d[i] - med[m]) + Math.abs(d[i + 1] - med[m + 1]) + Math.abs(d[i + 2] - med[m + 2]);
        const v = Math.max(0, 255 - diff * 1.6);
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }
    // Erase long straight lines (box borders, rules, axes): the OCR's layout step
    // treats a bordered box as a picture and skips the words inside it
    const L = 56;
    const dark = (i) => d[i * 4] < 140;
    const clearRun = (from, to, step) => { for (let i = from; i <= to; i += step) { const j = i * 4; d[j] = d[j + 1] = d[j + 2] = 255; } };
    for (let y = 0; y < H; y += 1) {
      let start = -1;
      for (let x = 0; x <= W; x += 1) {
        const on = x < W && (dark(y * W + x) || (y > 0 && dark((y - 1) * W + x) && dark((y + 1 < H ? y + 1 : y) * W + x)));
        if (on && start < 0) start = x;
        if (!on && start >= 0) { if (x - start >= L) clearRun(y * W + start, y * W + x - 1, 1); start = -1; }
      }
    }
    for (let x = 0; x < W; x += 1) {
      let start = -1;
      for (let y = 0; y <= H; y += 1) {
        const on = y < H && dark(y * W + x);
        if (on && start < 0) start = y;
        if (!on && start >= 0) { if (y - start >= L) clearRun(start * W + x, (y - 1) * W + x, W); start = -1; }
      }
    }
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    out.getContext("2d").putImageData(src, 0, 0);
    return out;
  }

  async function addSparseText(slide, segs, img, onProgress) {
    if (typeof P.ocrSparse !== "function") return;
    let blocks;
    try {
      slide._map = contrastMap(slide); // kept for re-reading fragments, dropped after analysis
      blocks = await P.ocrSparse(slide._map);
    } catch (_error) {
      return;
    }
    const found = segmentsOf(blocks, img);
    for (const sg of found) {
      if ((sg.conf < 70) || sg.quality < 0.7 || (sg.text.match(/\p{L}|\d/gu) || []).length < 2) continue;
      const area = Math.max(1, (sg.x1 - sg.x0) * (sg.y1 - sg.y0));
      const clash = segs.some((k) => {
        const ix = Math.max(0, Math.min(k.x1, sg.x1) - Math.max(k.x0, sg.x0));
        const iy = Math.max(0, Math.min(k.y1, sg.y1) - Math.max(k.y0, sg.y0));
        return ix * iy > area * 0.2;
      });
      if (!clash) { sg.sparse = true; segs.push(sg); continue; }
      // A fuller reading of a line the first pass only got part of
      // ("Conduction Band" for "onduction Band", "G peak" for "peak")
      const part = segs.find((k) => sg.text.length > k.text.length && sg.text.toLowerCase().endsWith(k.text.toLowerCase().replace(/^•\s*/, "")) && sg.text.length - k.text.length <= 3
        && Math.min(k.x1, sg.x1) - Math.max(k.x0, sg.x0) > (k.x1 - k.x0) * 0.6 && Math.abs((k.y0 + k.y1) / 2 - (sg.y0 + sg.y1) / 2) < (k.y1 - k.y0) * 0.6);
      if (part && /^[\p{Lu}\d]/u.test(sg.text)) Object.assign(part, sg, { sparse: true });
    }
    void onProgress;
  }

  /* Lines the page pass wasn't sure of ("[ion through" for "matter through"):
     read each again on its own, enlarged 2x, as a single line, and keep the
     better reading. Chart numbers and specks are left alone. */
  async function rereadUnsure(slide, segs, img) {
    if (typeof P.ocrLine !== "function") return;
    const unsure = segs
      .filter((sg) => (sg.conf < 82 || sg.quality < 0.85) && (sg.text.match(/\p{L}/gu) || []).length >= 4 && sg.y1 - sg.y0 >= 10 && sg.x1 - sg.x0 < slide.w * 0.9)
      .sort((a, b) => a.conf - b.conf)
      .slice(0, 14);
    // Lines that start in lowercase with nothing above them may have lost a first
    // letter that touches a drawing ("onduction Band"): look a bit further left
    const fragments = segs.filter((sg) => /^[a-z]/.test(sg.text) && !unsure.includes(sg)
      && !segs.some((o) => o !== sg && o.y1 <= sg.y0 + 2 && o.y1 > sg.y0 - (sg.y1 - sg.y0) * 1.8 && Math.min(o.x1, sg.x1) > Math.max(o.x0, sg.x0)));
    // Read a crop of the slide (or of the contrast map) as one line, mapped back to slide pixels
    const readCrop = async (src, x0, y0, w, h, scale) => {
      const crop = document.createElement("canvas");
      crop.width = Math.round(w * scale);
      crop.height = Math.round(h * scale);
      const cx = crop.getContext("2d");
      cx.imageSmoothingQuality = "high";
      cx.drawImage(src, x0, y0, w, h, 0, 0, crop.width, crop.height);
      const blocks = await P.ocrLine(crop);
      const words = [];
      for (const b of blocks) for (const pa of b.paragraphs || []) for (const l of pa.lines || []) for (const wd of l.words || []) {
        if (!wd.text || !wd.text.trim()) continue;
        // Whole pixels: the colour and stroke samplers index the image with these
        words.push({ ...wd, bbox: { x0: Math.round(x0 + wd.bbox.x0 / scale), y0: Math.round(y0 + wd.bbox.y0 / scale), x1: Math.round(x0 + wd.bbox.x1 / scale), y1: Math.round(y0 + wd.bbox.y1 / scale) } });
      }
      return words.length ? segmentsOf([{ paragraphs: [{ lines: [{ words }] }] }], null)[0] || null : null;
    };
    const box = (sg, leftBy) => {
      const pad = Math.round((sg.y1 - sg.y0) * 0.35);
      const x0 = Math.max(0, sg.x0 - pad - leftBy), y0 = Math.max(0, sg.y0 - pad);
      return [x0, y0, Math.min(slide.w, sg.x1 + pad) - x0, Math.min(slide.h, sg.y1 + pad) - y0];
    };
    try {
      for (const sg of unsure) {
        const again = await readCrop(slide.original, ...box(sg, 0), 2);
        if (!again) continue;
        // Better only if clearly more confident and at least as word-like, and about as long
        const lenOk = again.text.length >= sg.text.length * 0.6 && again.text.length <= sg.text.length * 1.6 + 4;
        if (lenOk && again.conf > sg.conf + 4 && again.quality >= sg.quality) Object.assign(sg, again);
      }
      // A recovered first letter: the same text with a capital in front
      for (const sg of fragments.slice(0, 6)) {
        const h = sg.y1 - sg.y0;
        let done = false;
        for (const leftBy of [0.8, 1.2, 1.6]) {
          for (const scale of [2, 3]) {
            const again = await readCrop(slide._map || slide.original, ...box(sg, Math.round(h * leftBy)), scale);
            if (again && /^[A-Z0-9]/.test(again.text) && again.text.toLowerCase().endsWith(sg.text.toLowerCase()) && again.text.length - sg.text.length <= 2 && again.conf >= 65) {
              Object.assign(sg, again);
              done = true;
              break;
            }
          }
          if (done) break;
        }
      }
    } catch (_error) {
      /* OCR worker unavailable: keep the first reading */
    }
  }

  /* Real paragraphs: a box's lines are joined into paragraphs so the text re-wraps
     when edited, and the box width is chosen so the lines still break exactly where
     they did on the slide: wide enough for every line, too narrow for the next word.
     When no width does both, the box keeps its line breaks. */
  function makeParagraphs(e, lines, measure) {
    if (lines.length < 2) return;
    const lw = lines.map((ln) => measure(ln));
    const maxW = Math.max(...lw);
    const paras = [];
    let cur = [];
    lines.forEach((ln, i) => {
      const prev = lines[i - 1];
      const fresh = i === 0
        || /^(•\s|\d{1,2}[.)]\s)/.test(ln) // bullet or numbered item
        || (lw[i - 1] < maxW * 0.75 && /[.!?:"”)]$/.test(prev)) // previous sentence ended short
        || lw[i - 1] < maxW * 0.6 // previous line much shorter than the box
        || (/[.!?]$/.test(prev) && LABEL_RE.test(ln)); // a new "Label:" item
      if (fresh && cur.length) { paras.push(cur); cur = []; }
      cur.push(i);
    });
    paras.push(cur);
    if (paras.every((p) => p.length === 1)) return;
    const indent = measure("• ");
    let lo = 0, hi = Infinity;
    for (const p of paras) {
      const bullet = /^•\s/.test(lines[p[0]]);
      p.forEach((li, j) => {
        const ind = bullet && j > 0 ? indent : 0;
        lo = Math.max(lo, lw[li] + ind);
        if (j < p.length - 1) hi = Math.min(hi, measure(`${lines[li]} ${lines[p[j + 1]].split(/\s+/)[0]}`) + ind);
      });
    }
    if (!(hi - lo > 3)) return;
    const join = (p) => p.map((li) => lines[li]).reduce((acc, ln) => (acc.endsWith("-") && /^[a-z]/.test(ln) ? acc + ln : `${acc} ${ln}`));
    const width = lo + (hi - lo) * 0.4;
    if (e.align === "center") e.x += (e.w - width) / 2;
    e.w = width;
    e.text = paras.map(join).join("\n");
  }

  const longest0 = (group) => [...group].sort((a, b) => b.text.length - a.text.length)[0];

  async function analyze(slide, onProgress = () => {}, options = {}) {
    slide.status = "working";
    const added = slide.elements.slice(); // anything added by hand while the slide waited
    const blocks = await P.ocrBlocks(slide.original, (m) => {
      if (m.status === "recognizing text") onProgress(m.progress);
    });
    const octx = slide.original.getContext("2d", { willReadFrequently: true });
    const img = octx.getImageData(0, 0, slide.w, slide.h);
    const elements = [];
    const boxes = [];

    // 1. Keep real text: confident, plausible words, on a calm background.
    const dropped = [];
    const allSegs = segmentsOf(blocks, img);
    await addSparseText(slide, allSegs, img, onProgress);
    // Chart ticks: numbers lined up in a row or column with even steps (0 100 200,
    // 500 1000 1500), or tiny numbers. A row of years ("2012 2015 2019") or a
    // lone figure is real text.
    const numeric = (sg) => (sg.text.match(/\d/g) || []).length > (sg.text.match(/\p{L}/gu) || []).length * 1.5 && !/\p{L}{4,}/u.test(sg.text);
    const textSize = median(allSegs.filter((sg) => sg.text.length >= 12).map((sg) => sg.h)) || 30;
    const ticks = new Set();
    // "01 02 03" step badges are labels, not a scale
    const nums = allSegs.filter((sg) => numeric(sg) && !/^0\d/.test(sg.text.trim())).map((sg) => ({ sg, v: parseFloat(sg.text.replace(/[^\d.\-−]/g, "").replace("−", "-")) })).filter((n) => Number.isFinite(n.v));
    const evenRun = (list) => {
      for (let i = 0; i + 2 < list.length; i += 1) {
        const d1 = list[i + 1].v - list[i].v, d2 = list[i + 2].v - list[i + 1].v;
        // Years a few apart are a timeline, not a chart scale
        const years = [list[i], list[i + 1], list[i + 2]].every((x) => x.v >= 1800 && x.v <= 2100 && Number.isInteger(x.v)) && Math.abs(d1) <= 10;
        if (d1 !== 0 && !years && Math.abs(d1 - d2) <= Math.abs(d1) * 0.02) return true;
      }
      return false;
    };
    for (const n of nums) {
      const h = n.sg.y1 - n.sg.y0;
      const row = nums.filter((o) => Math.abs((o.sg.y0 + o.sg.y1) / 2 - (n.sg.y0 + n.sg.y1) / 2) < h * 0.6).sort((a, b) => a.sg.x0 - b.sg.x0);
      const col = nums.filter((o) => Math.abs(o.sg.x1 - n.sg.x1) < h || Math.abs((o.sg.x0 + o.sg.x1) / 2 - (n.sg.x0 + n.sg.x1) / 2) < h).sort((a, b) => a.sg.y0 - b.sg.y0);
      if ((row.length >= 3 && evenRun(row)) || (col.length >= 3 && evenRun(col))) ticks.add(n.sg);
    }
    const isTick = (sg) => numeric(sg) && (ticks.has(sg) || ((sg.y1 - sg.y0) / 0.72 < textSize * 0.6 && !/\p{L}/u.test(sg.text)));
    // Chart evidence: numbers (axis ticks, values), read before any re-reading.
    // Letters from drawings ("OH", "HO" on a molecule) don't count.
    const chartish = allSegs.filter((sg) => {
      const digits = (sg.text.match(/\d/g) || []).length;
      return digits > 0 && digits >= (sg.text.match(/\p{L}/gu) || []).length;
    });
    await rereadUnsure(slide, allSegs, img);
    const segs = allSegs.filter((sg) => {
      const h = sg.y1 - sg.y0;
      const letters = sg.text.replace(/[^\p{L}\p{N}]/gu, "").length;
      const why = letters < 2 || h < 8 ? "tiny"
        : /notebook\s?[li1|]*m/i.test(sg.text) && sg.y0 > slide.h * 0.85 && sg.text.length < 20 ? "watermark"
        : sg.conf < 60 ? `conf ${Math.round(sg.conf)}`
        : sg.quality < (sg.conf >= 80 ? 0.5 : 0.7) ? `quality ${sg.quality.toFixed(2)}`
        : letters <= 3 && sg.conf < 80 ? "short"
        : isTick(sg) ? "numbers (chart)"
        : Math.min(...[0.12, 0.2, 0.35].map((f) => ringBusy(img, sg, Math.max(3, Math.round(h * f))))) > 0.3 ? "busy background" : "";
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
    segs.forEach((sg) => lineStyle(img, sg));
    // The slide's regular weight: what its longer lines (mostly body text) measure
    const long = segs.filter((sg) => sg.text.length >= 15 && sg.weight > 0);
    const baseWeight = long.length >= 2 ? weightedMedian(long.map((sg) => [sg.weight, sg.text.length])) : 0.95;
    segs.forEach((sg) => { sg.bold = sg.weight > baseWeight * BOLD_STEP; });


    const converted = new Set(); // lines turned into text boxes (the rest stay in the picture)
    // 2. Paragraphs, style, boxes.
    const groupsFound = groupSegments(segs);

    for (const group of groupsFound) {
      const x0 = Math.min(...group.map((g) => g.x0));
      const y0 = Math.min(...group.map((g) => g.y0));
      const x1 = Math.max(...group.map((g) => g.x1));
      const y1 = Math.max(...group.map((g) => g.y1));
      // Text over a photo or strong gradient: keep it in the picture (removing it would leave patches).
      const behind = ringSpread(img, { x0, y0, x1, y1 }, 10, segs.filter((o) => !group.includes(o)));
      if (behind > 45) { dropped.push(`on a picture: ${group[0].text}`); continue; }
      // Short one-line labels stay in the picture when they're part of a figure:
      // a fragment ("onduction"), a label OCR only half read ("Dirac Point (E"),
      // or a label among a chart's numbers and ticks.
      if (group.length === 1) {
        const sg = group[0];
        const nWords = sg.text.replace(/^•\s*/, "").split(/\s+/).length;
        if (nWords <= 4) {
          const near = chartish.filter((d) => d !== sg && d.x1 > sg.x0 - sg.h * 4 && d.x0 < sg.x1 + sg.h * 4 && d.y1 > sg.y0 - sg.h * 4 && d.y0 < sg.y1 + sg.h * 4).length;
          const opens = (sg.text.match(/\(/g) || []).length, closes = (sg.text.match(/\)/g) || []).length;
          const above = allSegs.some((o) => o !== sg && o.y1 <= sg.y0 + 2 && o.y1 > sg.y0 - Math.max(sg.h, sg.y1 - sg.y0, o.y1 - o.y0) * 1.8 && Math.min(o.x1, sg.x1) > Math.max(o.x0, sg.x0));
          const why = /^[a-z]/.test(sg.text) && !above ? "fragment"
            : opens !== closes ? "unmatched bracket" // the rest of the label is on lines left in the picture
            : near >= 3 ? "in a chart"
            : nWords <= 3 && cutOff(img, sg) ? "cut off" : "";
          if (why) { dropped.push(`${why}: ${sg.text}`); continue; }
        }
      }
      const lineH = median(group.map((g) => g.h));
      const style = sampleStyle(img, { x0, y0, x1, y1 });
      // Match the font on lines without a "Label:" lead-in (labels are often bold/grey).
      const plain = group.filter((g) => !/^[^:]{2,30}:\s/.test(g.text) && g.text.length >= 6);
      const probe = (plain.length ? plain : group).slice().sort((a, b) => b.text.length - a.text.length).slice(0, 2);
      const votes = probe.map((g) => matchFont(img, g, style.bg)).filter(Boolean);
      const margin = votes.length ? votes.reduce((a, v) => a + (v.boldMargin || 0), 0) / votes.length : 0;
      // Weight from stroke width (reliable); serif only when it clearly fits better on longer lines
      const chars = (pred) => group.filter(pred).reduce((n, g) => n + g.text.length, 0);
      const bold = chars((g) => g.bold) > chars(() => true) / 2;
      // How much better a serif fits (negative: sans fits better). Condensed and italic
      // sans fonts can look serif-ish, so only a clear lead counts on its own.
      const serifLead = votes.length ? votes.reduce((n, v) => n + (v.family === "Georgia" ? 1 : -1) * (v.familyMargin || 0), 0) / votes.length : -1;
      // Serif feet along the baseline, averaged over the paragraph; the drawn-font
      // comparison only settles the close cases
      const scored = group.filter((g) => g.serif > 0);
      const serifAvg = scored.length ? scored.reduce((n, g) => n + g.serif * g.text.length, 0) / scored.reduce((n, g) => n + g.text.length, 0) : 0;
      // Neither signal is reliable alone (geometric sans fonts have flat feet too), so
      // serif needs both to agree; when unsure the text stays sans
      const serif = serifAvg >= 1.4 && serifLead > 0.02;
      void margin;
      const font = votes.length
        ? { family: serif ? "Georgia" : "Arial", bold, size: votes[0].size }
        : { family: "Arial", bold, size: lineH * 0.8 };
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
      // "Label:" lead-ins (NotebookLM style): their own colour and weight, measured per line.
      let label = null;
      const labelled = group.filter((g) => g.label && LABEL_RE.test(g.text));
      if (labelled.length) {
        const labWeight = median(labelled.map((g) => g.label.weight));
        const restWeight = median(labelled.map((g) => g.weight));
        // In a bold paragraph the label is bold too; otherwise only when clearly heavier
        const lbold = font.bold || labWeight > restWeight * 1.18 || labWeight > baseWeight * BOLD_STEP;
        const lcolor = labelled[0].label.color;
        const differs = dist(rgbOf(lcolor), rgbOf(style.color)) > 45;
        if (differs || lbold !== font.bold) label = { color: differs ? lcolor : style.color, bold: lbold };
      }
      const pad = Math.max(4, Math.round(fontSize * 0.2));
      const inkRgb = [1, 3, 5].map((k) => parseInt(style.color.slice(k, k + 2), 16));
      const elId = id();
      group.forEach((g) => { converted.add(g); boxes.push({ x0: g.x0 - pad, y0: g.y0 - pad, x1: g.x1 + pad, y1: g.y1 + pad, bg: style.bg, ink: inkRgb, seg: g, elId }); });
      // Box wide enough for the longest line in our font, so it doesn't re-wrap.
      measureCtx.font = `${font.bold ? 700 : 400} ${fontSize}px ${font.family === "Georgia" ? "Georgia, serif" : "Arial, sans-serif"}`;
      const textW = Math.max(...group.map((g) => measureCtx.measureText(g.text).width));
      const boxW = Math.min(slide.w - Math.max(0, x0 - 4), Math.max(x1 - x0, textW) * 1.04 + 6);
      elements.push({
        id: elId,
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
        // Italic when most of the paragraph's letters lean clearly
        italic: group.reduce((n, g) => n + g.italicShare * g.text.length, 0) > group.reduce((n, g) => n + g.text.length, 0) * 0.6,
        align,
        fontFamily: font.family,
        _lines: group.map((g) => ({ w: g.x1 - g.x0 })),
        _lineH: lineH,
        _serifAvg: serifAvg,
        ...(label ? { labelColor: label.color, labelBold: label.bold } : {})
      });
    }
    // Headings (much larger than the body text, or big text near the top) are bold.
    const bodySize = median(elements.map((e) => e.fontSize));
    const isHeading = (e) => e.fontSize >= Math.max(44, bodySize * 1.4) || (e.y < slide.h * 0.22 && e.fontSize >= bodySize * 1.25 && e.fontSize >= 36);
    // Paragraphs of similar size on one slide share a font: use the majority family and weight.
    // Only multi-line paragraphs take part; titles and short labels keep their own font.
    // Text next to a clearly serif paragraph of about the same size is serif too
    // when it leans that way (reference lists, captions).
    elements.forEach((e) => {
      if (e.fontFamily === "Georgia" || !(e._serifAvg >= 1.3)) return;
      if (elements.some((o) => o.fontFamily === "Georgia" && Math.abs(o.fontSize - e.fontSize) <= e.fontSize * 0.25)) e.fontFamily = "Georgia";
    });
    const body = elements.filter((e) => !isHeading(e) && e.text.includes("\n"));
    body.forEach((e) => {
      const peers = body.filter((o) => Math.abs(o.fontSize - e.fontSize) <= e.fontSize * 0.25);
      if (peers.length < 2) return;
      const weight = (pred) => peers.filter(pred).reduce((n, o) => n + o.text.length, 0);
      const total = weight(() => true);
      e.fontFamily = weight((o) => o.fontFamily === "Georgia") > total / 2 ? "Georgia" : "Arial";
    });
    // Then re-fit size and box width to the final font so nothing re-wraps.
    elements.forEach((e) => {
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
      makeParagraphs(e, lines, (t) => measureCtx.measureText(t).width);
      delete e._lines;
      delete e._lineH;
      delete e._serifAvg;
    });
    // Cleaning a line's box mustn't clip a neighbouring line that stays in the picture
    for (const b of boxes) {
      for (const o of allSegs) {
        if (converted.has(o) || o.x1 < b.x0 || o.x0 > b.x1) continue;
        // Only real text left in the picture is protected, not OCR noise read off a drawing
        if (o.conf < 60 || o.quality < 0.5 || o.text.replace(/[^\p{L}\p{N}]/gu, "").length < 3) continue;
        const below = (o.y0 + o.y1) / 2 > (b.seg.y0 + b.seg.y1) / 2;
        if (below && o.y0 < b.y1) b.y1 = Math.max(b.seg.y0 + 2, o.y0 - 1);
        if (!below && o.y1 > b.y0) b.y0 = Math.min(b.seg.y1 - 2, o.y1 + 1);
      }
    }
    // Cleaning that would have to stop inside a line's own letters leaves half-erased
    // ghosts: keep that paragraph in the picture instead
    const ghosts = new Set(boxes.filter((b) => b.y1 < b.seg.y1 - 2 || b.y0 > b.seg.y0 + 2).map((b) => b.elId));
    if (ghosts.size) {
      for (let i = elements.length - 1; i >= 0; i -= 1) if (ghosts.has(elements[i].id)) { dropped.push(`would leave a ghost: ${elements[i].text.split("\n")[0]}`); elements.splice(i, 1); }
      for (let i = boxes.length - 1; i >= 0; i -= 1) if (ghosts.has(boxes[i].elId)) boxes.splice(i, 1);
    }
    const clean = document.createElement("canvas");
    clean.width = slide.w;
    clean.height = slide.h;
    const cctx = clean.getContext("2d", { willReadFrequently: true });
    cctx.drawImage(slide.original, 0, 0);
    paintOut(cctx, boxes, slide.w, slide.h);
    slide._painted = boxes; // where text was removed (pictures stay see-through there)
    slide.clean = clean;
    slide.elements = [...elements, ...added];
    if (options.objects !== false) {
      try {
        const found = detectObjects(slide);
        await Promise.all(found.objects.filter((o) => o.type === "image").map((o) => imageFor(o.src).decode().catch(() => {})));
        slide.elements = [...found.objects, ...elements, ...added];
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
    const cctx = slide.clean.getContext("2d", { willReadFrequently: true });
    const full = cctx.getImageData(0, 0, W0, H0);
    const fd = full.data;

    // Work at half size to find where pictures are.
    const k = 2, sw = Math.ceil(W0 / k), sh = Math.ceil(H0 / k);
    const small = document.createElement("canvas");
    small.width = sw;
    small.height = sh;
    const sx = small.getContext("2d", { willReadFrequently: true });
    sx.drawImage(slide.clean, 0, 0, sw, sh);
    const sd = sx.getImageData(0, 0, sw, sh).data;

    // 1. Busy pixels: edges and texture. Smooth gradients and the flat inside of
    //    boxes and cards are never busy, so they stay in the background.
    const busy = new Uint8Array(sw * sh);
    for (let y = 1; y < sh - 1; y += 1) for (let x = 1; x < sw - 1; x += 1) {
      const i = (y * sw + x) * 4, l = i - 4, r = i + 4, u = i - sw * 4, dn = i + sw * 4;
      const g = Math.abs(sd[r] - sd[l]) + Math.abs(sd[r + 1] - sd[l + 1]) + Math.abs(sd[r + 2] - sd[l + 2])
        + Math.abs(sd[dn] - sd[u]) + Math.abs(sd[dn + 1] - sd[u + 1]) + Math.abs(sd[dn + 2] - sd[u + 2]);
      if (g > 48) busy[y * sw + x] = 1;
    }

    // 2. Connected groups of busy pixels (8-connected), then sorted: box outlines,
    //    straight lines and lone thin strokes stay in the background; anything else
    //    is (part of) a picture. Lines attached to a drawing (chart axes, a leader
    //    line touching a diagram) belong to that drawing.
    const seen = new Uint8Array(sw * sh);
    const parts = [];
    const stack = [];
    const pix = [];
    for (let i0 = 0; i0 < sw * sh; i0 += 1) {
      if (!busy[i0] || seen[i0]) continue;
      let x0 = sw, y0 = sh, x1 = 0, y1 = 0, n = 0, mx = 0, my = 0, mxx = 0, myy = 0, mxy = 0;
      pix.length = 0;
      stack.push(i0);
      seen[i0] = 1;
      while (stack.length) {
        const j = stack.pop();
        pix.push(j);
        const x = j % sw, y = (j / sw) | 0;
        n += 1; mx += x; my += y; mxx += x * x; myy += y * y; mxy += x * y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx, yy = y + dy;
          if ((dx || dy) && xx >= 0 && yy >= 0 && xx < sw && yy < sh) {
            const q = yy * sw + xx;
            if (busy[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
          }
        }
      }
      const w = x1 - x0 + 1, h = y1 - y0 + 1, ext = Math.max(w, h);
      if (n < 60 && ext < 20) continue; // specks
      if (Math.min(w, h) <= 5) continue; // a straight line: rule, border, band edge
      // A box or card: its pixels all sit along its own edges
      const rim = Math.max(6, Math.round(Math.min(w, h) * 0.06));
      let onRim = 0;
      for (const j of pix) { const x = j % sw, y = (j / sw) | 0; if (x - x0 < rim || x1 - x < rim || y - y0 < rim || y1 - y < rim) onRim += 1; }
      if (w >= 30 && h >= 16 && onRim / n > 0.85) continue;
      // A lone thin stroke (a diagonal leader line, an arrow) stays in the background
      const cx = mx / n, cy = my / n;
      const vxx = mxx / n - cx * cx, vyy = myy / n - cy * cy, vxy = mxy / n - cx * cy;
      const tr = vxx + vyy, det = vxx * vyy - vxy * vxy;
      const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det)), l2 = Math.max(0.01, tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det)));
      if (l1 / l2 > 60 && n / ext < 6) continue;
      // An arrow or connector: long and thin with a small head, mostly empty
      if (Math.max(w, h) >= 3 * Math.min(w, h) && Math.min(w, h) <= 22 && n / (w * h) < 0.35) continue;
      parts.push({ x0, y0, x1, y1, n });
    }
    let boxes = parts.map((b) => ({ ...b }));

    // Solid shapes: strong-coloured flat fills whose edges are all straight (bars).
    // One alone is decoration (stays in the background, like boxes); three or more
    // alike in a row or column are a chart and become one picture.
    const solids = [];
    {
      const done = new Uint8Array(sw * sh);
      const col = (j) => [sd[j * 4], sd[j * 4 + 1], sd[j * 4 + 2]];
      const bgc = [0, 1, 2].map((c) => median([0, sw - 1, (sh - 1) * sw, sh * sw - 1, sw >> 1, (sh >> 1) * sw].map((j) => sd[j * 4 + c])));
      for (let i0 = 0; i0 < sw * sh; i0 += 7) {
        if (busy[i0] || done[i0]) continue;
        const c0 = col(i0);
        if (Math.abs(c0[0] - bgc[0]) + Math.abs(c0[1] - bgc[1]) + Math.abs(c0[2] - bgc[2]) < 150) continue;
        let x0 = sw, y0 = sh, x1 = 0, y1 = 0, n = 0;
        stack.push(i0);
        done[i0] = 1;
        while (stack.length) {
          const j = stack.pop();
          const x = j % sw, y = (j / sw) | 0;
          n += 1;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          for (const q of [j - 1, j + 1, j - sw, j + sw]) {
            if (q < 0 || q >= sw * sh || done[q] || busy[q] === 1) continue;
            const c = col(q);
            if (Math.abs(c[0] - c0[0]) + Math.abs(c[1] - c0[1]) + Math.abs(c[2] - c0[2]) > 30) continue;
            done[q] = 1;
            stack.push(q);
          }
        }
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        if (n > w * h * 0.85 && w * h > 60 && w * h < sw * sh * 0.25) solids.push({ x0, y0, x1, y1, n, c: c0 });
      }
    }
    const alike = (a, b) => Math.abs(a.c[0] - b.c[0]) + Math.abs(a.c[1] - b.c[1]) + Math.abs(a.c[2] - b.c[2]) < 40;
    // Bars of a chart sit close together: gaps under ~2.5 bar widths (icons that
    // happen to share a colour are far apart)
    const rowOf = (a) => {
      const horiz = solids.filter((b) => alike(a, b) && Math.abs(b.y1 - a.y1) <= 3).sort((p, q) => p.x0 - q.x0);
      const vert = solids.filter((b) => alike(a, b) && Math.abs(b.x0 - a.x0) <= 3).sort((p, q) => p.y0 - q.y0);
      const close = (list, gapOf, sizeOf) => list.length >= 3 && list.slice(1).every((b, i) => gapOf(list[i], b) <= 2.5 * (sizeOf(list[i]) + sizeOf(b)) / 2);
      if (close(horiz, (p, q) => q.x0 - p.x1, (b) => b.x1 - b.x0 + 1)) return horiz;
      if (close(vert, (p, q) => q.y0 - p.y1, (b) => b.y1 - b.y0 + 1)) return vert;
      return [];
    };
    for (const a of solids) {
      const row = rowOf(a);
      if (row.length >= 3) boxes.push({ x0: Math.min(...row.map((b) => b.x0)), y0: Math.min(...row.map((b) => b.y0)), x1: Math.max(...row.map((b) => b.x1)), y1: Math.max(...row.map((b) => b.y1)), n: row.reduce((t, b) => t + b.n, 0) });
    }

    // 4. Parts close together are one picture (text is already gone, so labels
    //    don't glue pictures together).
    const GAP = 14;
    let merged = true;
    while (merged) {
      merged = false;
      for (let a = 0; a < boxes.length && !merged; a += 1) for (let b = a + 1; b < boxes.length && !merged; b += 1) {
        const A = boxes[a], B = boxes[b];
        if (A.x0 <= B.x1 + GAP && B.x0 <= A.x1 + GAP && A.y0 <= B.y1 + GAP && B.y0 <= A.y1 + GAP) {
          boxes[a] = { x0: Math.min(A.x0, B.x0), y0: Math.min(A.y0, B.y0), x1: Math.max(A.x1, B.x1), y1: Math.max(A.y1, B.y1), n: A.n + B.n };
          boxes.splice(b, 1);
          merged = true;
        }
      }
    }
    const slideArea = sw * sh;
    boxes = boxes.filter((b) => {
      const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
      // Big enough to be a picture, not the whole slide (a full-slide photo stays the background)
      return w * h < slideArea * 0.8 && w * h > slideArea * 0.002 && Math.max(w, h) >= 24 && b.n / (w * h) > 0.02;
    });
    if (!boxes.length) return { objects: [] };

    // 5. Cut each picture out against what's behind it, with soft transparent
    //    edges, and fill the hole it leaves. On the slide's own background that's a
    //    smooth surface fitted to the whole background (a gradient); inside a card
    //    it's the card, measured just around the picture.
    const objects = [];
    const src = new Uint8ClampedArray(fd);
    const painted = slide._painted || [];
    const inPic = (x, y) => boxes.some((b) => x >= b.x0 - 4 && x <= b.x1 + 4 && y >= b.y0 - 4 && y <= b.y1 + 4);
    const fit = fitBackground(sd, busy, sw, sh, inPic);
    for (const b of boxes) {
      const X0 = Math.max(0, b.x0 * k - 6), Y0 = Math.max(0, b.y0 * k - 6);
      const X1 = Math.min(W0, (b.x1 + 1) * k + 6), Y1 = Math.min(H0, (b.y1 + 1) * k + 6);
      const w = X1 - X0, h = Y1 - Y0;
      if (w < 8 || h < 8) continue;
      let surf = localSurface(src, W0, H0, X0, Y0, X1, Y1);
      if (fit && surroundMatches(fit, src, W0, H0, X0, Y0, X1, Y1, k)) surf = fit.over(X0, Y0, w, h, k);
      const cut = new ImageData(w, h);
      let tx0 = w, ty0 = h, tx1 = -1, ty1 = -1;
      for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
        const i = ((Y0 + y) * W0 + (X0 + x)) * 4, o = (y * w + x) * 4, s3 = (y * w + x) * 3;
        const bgc = [surf[s3], surf[s3 + 1], surf[s3 + 2]];
        const c = [src[i], src[i + 1], src[i + 2]];
        let d = Math.abs(c[0] - bgc[0]) + Math.abs(c[1] - bgc[1]) + Math.abs(c[2] - bgc[2]);
        // Where a label was removed, only clearly drawn pixels belong to the picture
        if (d < 50 && painted.some((p) => X0 + x >= p.x0 && X0 + x < p.x1 && Y0 + y >= p.y0 && Y0 + y < p.y1)) d = 0;
        const a = d <= 18 ? 0 : d >= 60 ? 1 : (d - 18) / 42;
        // Edge pixels: take the background's share out of the colour (no fringe on a new background)
        for (let ch = 0; ch < 3; ch += 1) cut.data[o + ch] = a > 0 && a < 1 ? Math.max(0, Math.min(255, (c[ch] - (1 - a) * bgc[ch]) / a)) : c[ch];
        cut.data[o + 3] = Math.round(a * 255);
        if (a > 0) {
          if (x < tx0) tx0 = x; if (x > tx1) tx1 = x; if (y < ty0) ty0 = y; if (y > ty1) ty1 = y;
          // The background behind the picture becomes its surroundings
          for (let ch = 0; ch < 3; ch += 1) fd[i + ch] = bgc[ch];
        }
      }
      if (tx1 < 0) continue;
      // A single flat one-colour shape (a badge circle, a plain card) is decoration:
      // it stays in the background
      if (flatShape(cut, w, h)) {
        for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
          const i = ((Y0 + y) * W0 + (X0 + x)) * 4;
          for (let c = 0; c < 3; c += 1) fd[i + c] = src[i + c];
        }
        continue;
      }
      const cw = tx1 - tx0 + 1, ch2 = ty1 - ty0 + 1;
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch2;
      canvas.getContext("2d").putImageData(cut, -tx0, -ty0, tx0, ty0, cw, ch2);
      objects.push({ id: id(), type: "image", src: canvas.toDataURL("image/png"), x: X0 + tx0, y: Y0 + ty0, w: cw, h: ch2, opacity: 1, detected: true });
    }
    cctx.putImageData(full, 0, 0);
    // Big pictures behind small ones
    objects.sort((a, b) => b.w * b.h - a.w * a.h);
    return { objects };
  }

  // Smooth background model: per colour channel, a quadratic surface in x and y
  // fitted to calm background pixels (robustly: twice, dropping poor fits). Null
  // when the background isn't smooth (photos, split panels fit poorly).
  function fitBackground(sd, busy, sw, sh, inPic) {
    let pts = [];
    for (let y = 2; y < sh - 2; y += 4) for (let x = 2; x < sw - 2; x += 4) {
      if (busy[y * sw + x] || inPic(x, y)) continue;
      const i = (y * sw + x) * 4;
      pts.push([x / sw, y / sh, sd[i], sd[i + 1], sd[i + 2]]);
    }
    if (pts.length < 60) return null;
    const basis = (u, v) => [1, u, v, u * u, u * v, v * v];
    const solve = (list) => [2, 3, 4].map((ch) => {
      const A = Array.from({ length: 6 }, () => new Array(6).fill(0)), bv = new Array(6).fill(0);
      for (const p of list) { const f = basis(p[0], p[1]); for (let r = 0; r < 6; r += 1) { bv[r] += f[r] * p[ch]; for (let c = 0; c < 6; c += 1) A[r][c] += f[r] * f[c]; } }
      for (let r = 0; r < 6; r += 1) A[r][r] += 1e-6;
      // Gaussian elimination
      for (let c = 0; c < 6; c += 1) {
        let piv = c;
        for (let r = c + 1; r < 6; r += 1) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
        [A[c], A[piv]] = [A[piv], A[c]]; [bv[c], bv[piv]] = [bv[piv], bv[c]];
        for (let r = 0; r < 6; r += 1) if (r !== c) { const f = A[r][c] / A[c][c]; for (let q = c; q < 6; q += 1) A[r][q] -= f * A[c][q]; bv[r] -= f * bv[c]; }
      }
      return bv.map((v, r) => v / A[r][r]);
    });
    const at = (co, u, v) => co.map((cf) => basis(u, v).reduce((t, f, j) => t + f * cf[j], 0));
    let co = solve(pts);
    for (let it = 0; it < 2; it += 1) {
      const keep = pts.filter((p) => { const c = at(co, p[0], p[1]); return Math.abs(c[0] - p[2]) + Math.abs(c[1] - p[3]) + Math.abs(c[2] - p[4]) < 30; });
      if (keep.length < pts.length * 0.6) return null; // not one smooth background
      pts = keep;
      co = solve(pts);
    }
    return {
      at: (u, v) => at(co, u, v),
      // rgb triples over a box given in full-size pixels (k = full / half scale)
      over(X0, Y0, w, h, k) {
        const out = new Float32Array(w * h * 3);
        for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
          const c = at(co, (X0 + x) / k / sw, (Y0 + y) / k / sh);
          out.set(c, (y * w + x) * 3);
        }
        return out;
      }
    };
  }

  // Does the area just around a box look like the fitted background (not a card)?
  function surroundMatches(fit, d, W, H, X0, Y0, X1, Y1, k) {
    let n = 0, near = 0;
    const test = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4;
      const c = fit.at(x / k / Math.ceil(W / k), y / k / Math.ceil(H / k));
      n += 1;
      if (Math.abs(c[0] - d[i]) + Math.abs(c[1] - d[i + 1]) + Math.abs(c[2] - d[i + 2]) < 24) near += 1;
    };
    for (let x = X0; x < X1; x += 6) { test(x, Y0 - 4); test(x, Y1 + 3); }
    for (let y = Y0; y < Y1; y += 6) { test(X0 - 4, y); test(X1 + 3, y); }
    return n > 0 && near / n > 0.7;
  }

  // Mostly one colour (ignoring soft edges and a little text inside): a plain shape.
  function flatShape(cut, w, h) {
    const d = cut.data;
    const bins = new Map();
    let solid = 0;
    for (let i = 0; i < w * h; i += 1) {
      if (d[i * 4 + 3] < 250) continue;
      solid += 1;
      const key = ((d[i * 4] >> 4) << 8) | ((d[i * 4 + 1] >> 4) << 4) | (d[i * 4 + 2] >> 4);
      bins.set(key, (bins.get(key) || 0) + 1);
    }
    if (solid < 50) return true;
    const top = Math.max(...bins.values());
    return top / solid > 0.97;
  }

  // Background colour across a box, from thin strips just outside each side
  // (typical colour of each stretch, so a gradient or a card is followed), blended
  // across the box. Returns rgb triples, row by row.
  function localSurface(d, W, H, X0, Y0, X1, Y1) {
    const w = X1 - X0, h = Y1 - Y0;
    const strip = (xa, ya, xb, yb) => {
      const px = [];
      for (let y = Math.max(0, ya); y < Math.min(H, yb); y += 1) for (let x = Math.max(0, xa); x < Math.min(W, xb); x += 2) {
        const i = (y * W + x) * 4;
        px.push([d[i], d[i + 1], d[i + 2]]);
      }
      if (!px.length) return null;
      const lums = px.map((p) => p[0] * 0.2126 + p[1] * 0.7152 + p[2] * 0.0722);
      const m = median(lums);
      const keep = px.filter((_p, j) => Math.abs(lums[j] - m) < 25);
      return [0, 1, 2].map((c) => median((keep.length ? keep : px).map((p) => p[c])));
    };
    const cols = Math.max(2, Math.min(16, Math.round(w / 60))), rows = Math.max(2, Math.min(10, Math.round(h / 60)));
    const sides = { top: [], bottom: [], left: [], right: [] };
    for (let j = 0; j < cols; j += 1) {
      const a = X0 + Math.round((w * j) / cols), z = X0 + Math.round((w * (j + 1)) / cols);
      sides.top.push(strip(a, Y0 - 5, z, Y0));
      sides.bottom.push(strip(a, Y1, z, Y1 + 5));
    }
    for (let j = 0; j < rows; j += 1) {
      const a = Y0 + Math.round((h * j) / rows), z = Y0 + Math.round((h * (j + 1)) / rows);
      sides.left.push(strip(X0 - 5, a, X0, z));
      sides.right.push(strip(X1, a, X1 + 5, z));
    }
    // Missing sides (picture at the slide edge) borrow from the others
    const all = [...sides.top, ...sides.bottom, ...sides.left, ...sides.right].filter(Boolean);
    const fallback = all.length ? [0, 1, 2].map((c) => median(all.map((p) => p[c]))) : [255, 255, 255];
    for (const key of Object.keys(sides)) sides[key] = sides[key].map((p) => p || fallback);
    const at = (arr, t) => {
      const f = Math.min(arr.length - 1, Math.max(0, t * arr.length - 0.5));
      const i = Math.floor(f), j = Math.min(arr.length - 1, i + 1), u = f - i;
      return [0, 1, 2].map((c) => arr[i][c] * (1 - u) + arr[j][c] * u);
    };
    const out = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y += 1) {
      const ty = (y + 0.5) / h;
      const l = at(sides.left, ty), r = at(sides.right, ty);
      for (let x = 0; x < w; x += 1) {
        const tx = (x + 0.5) / w;
        const t = at(sides.top, tx), bt = at(sides.bottom, tx);
        for (let c = 0; c < 3; c += 1) out[(y * w + x) * 3 + c] = ((t[c] * (1 - ty) + bt[c] * ty) + (l[c] * (1 - tx) + r[c] * tx)) / 2;
      }
    }
    return out;
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
  // Lines as drawn: paragraphs wrapped to the box width. A bulleted paragraph
  // ("• …") keeps its wrapped lines under the text, not under the bullet.
  // Each line: { text, indent, first } (first = first line of its paragraph).
  function layoutLines(text, maxWidth, measure) {
    const out = [];
    for (const para of String(text).split("\n")) {
      const bullet = /^•\s/.test(para);
      const indent = bullet ? measure("• ") : 0;
      let line = "";
      let first = true;
      for (const word of para.split(/(\s+)/)) {
        const next = line + word;
        const room = maxWidth - (first ? 0 : indent);
        if (measure(next.trimEnd()) > room && line.trim()) {
          out.push({ text: line.trimEnd(), indent: first ? 0 : indent, first });
          line = word.trimStart();
          first = false;
        } else line = next;
      }
      out.push({ text: line.trimEnd(), indent: first ? 0 : indent, first });
    }
    return out;
  }

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

  /* ---------- Shapes as paths (shared by canvas drawing) ---------- */
  function shapePath(ctx, el, x, y, w, h) {
    ctx.beginPath();
    if (el.type === "rect") {
      const r = Math.min((el.radius || 0) * (w / el.w || 1), w / 2, h / 2);
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    } else if (el.type === "ellipse") {
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    } else if (el.type === "triangle") {
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    }
  }

  // Line endpoints inside its box: flip = rising line (bottom-left → top-right).
  function lineEnds(el, x, y, w, h) {
    return el.flip ? [x, y + h, x + w, y] : [x, y, x + w, y + h];
  }

  /**
   * Draw a slide. options:
   *  original: draw the untouched page image
   *  hidden:   Set of element ids not to draw (animations not played yet)
   *  anim:     { id, type, p } element currently animating, p = 0..1
   */
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
      if (options.hidden?.has(el.id)) continue;
      const x = el.x * scale, y = el.y * scale, bw = el.w * scale, bh = el.h * scale;
      ctx.save();
      ctx.globalAlpha = el.opacity ?? 1;
      // Entrance animation in progress.
      const a = options.anim && options.anim.id === el.id ? options.anim : null;
      if (a) {
        const p = Math.max(0, Math.min(1, a.p));
        const ease = 1 - (1 - p) ** 3;
        if (a.type === "fade") ctx.globalAlpha *= ease;
        if (a.type === "fly") { ctx.globalAlpha *= Math.min(1, p * 2); ctx.translate(0, (1 - ease) * h * 0.35); }
        if (a.type === "rise") { ctx.globalAlpha *= ease; ctx.translate(0, (1 - ease) * h * 0.06); }
        if (a.type === "zoom") { ctx.globalAlpha *= ease; ctx.translate(x + bw / 2, y + bh / 2); ctx.scale(0.3 + 0.7 * ease, 0.3 + 0.7 * ease); ctx.translate(-(x + bw / 2), -(y + bh / 2)); }
        if (a.type === "wipe") { ctx.beginPath(); ctx.rect(x - 4, y - 4, (bw + 8) * ease, bh + 8); ctx.clip(); }
      }
      if (el.rotate) {
        ctx.translate(x + bw / 2, y + bh / 2);
        ctx.rotate((el.rotate * Math.PI) / 180);
        ctx.translate(-(x + bw / 2), -(y + bh / 2));
      }
      if (el.type === "rect" || el.type === "ellipse" || el.type === "triangle") {
        shapePath(ctx, el, x, y, bw, bh);
        if (el.fill && el.fill !== "none") { ctx.fillStyle = el.fill; ctx.fill(); }
        if (el.stroke && el.strokeWidth) { ctx.strokeStyle = el.stroke; ctx.lineWidth = el.strokeWidth * scale; ctx.stroke(); }
      } else if (el.type === "line") {
        const [x1, y1, x2, y2] = lineEnds(el, x, y, bw, bh);
        const lw = Math.max(1, (el.strokeWidth || 4) * scale);
        ctx.strokeStyle = el.stroke || "#1f1f1f";
        ctx.fillStyle = el.stroke || "#1f1f1f";
        ctx.lineWidth = lw;
        ctx.lineCap = "round";
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const head = el.arrow ? Math.max(lw * 3.5, 10 * scale) : 0;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2 - Math.cos(ang) * head * 0.8, y2 - Math.sin(ang) * head * 0.8);
        ctx.stroke();
        if (el.arrow) {
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - head * Math.cos(ang - 0.45), y2 - head * Math.sin(ang - 0.45));
          ctx.lineTo(x2 - head * Math.cos(ang + 0.45), y2 - head * Math.sin(ang + 0.45));
          ctx.closePath();
          ctx.fill();
        }
      } else if (el.type === "image") {
        const img = imageFor(el.src);
        if (img.complete && img.naturalWidth) ctx.drawImage(img, x, y, bw, bh);
        if (el.stroke && el.strokeWidth) { ctx.strokeStyle = el.stroke; ctx.lineWidth = el.strokeWidth * scale; ctx.strokeRect(x, y, bw, bh); }
      } else if (el.type === "text") {
        if (el.highlight) { ctx.fillStyle = el.highlight; ctx.fillRect(x, y, bw, bh); }
        if (el.stroke && el.strokeWidth) { ctx.strokeStyle = el.stroke; ctx.lineWidth = el.strokeWidth * scale; ctx.strokeRect(x, y, bw, bh); }
        ctx.font = fontString(el, scale);
        ctx.fillStyle = el.color;
        ctx.textBaseline = "middle";
        const lh = el.fontSize * el.lineHeight * scale;
        const laid = layoutLines(el.text, bw, (t) => ctx.measureText(t).width);
        const lines = laid.map((l) => l.text);
        const textH = lines.length * lh;
        const top = el.valign === "middle" ? y + (bh - textH) / 2 : el.valign === "bottom" ? y + bh - textH : y;
        const fontFor = (r) => fontString({ ...el, bold: r.label ? el.labelBold : el.bold }, scale);
        lines.forEach((line, i) => {
          const ly = top + lh * i + lh / 2;
          const runs = laid[i].first ? lineRuns(el, line) : [{ text: line }];
          const widths = runs.map((r) => { ctx.font = fontFor(r); return ctx.measureText(r.text).width; });
          const total = widths.reduce((s2, v) => s2 + v, 0);
          let cx = el.align === "center" ? x + (bw - total) / 2 : el.align === "right" ? x + bw - total : x + laid[i].indent;
          // Justify: spread words of full lines (not the last line of a paragraph).
          const justify = el.align === "justify" && runs.length === 1 && i < lines.length - 1 && line.includes(" ") && laid[i + 1] && !laid[i + 1].first;
          ctx.textAlign = "left";
          if (justify) {
            ctx.font = fontFor(runs[0]);
            const words = line.split(" ");
            const ww = words.map((wd) => ctx.measureText(wd).width);
            const gap = (bw - ww.reduce((s2, v) => s2 + v, 0)) / (words.length - 1);
            let wx = x;
            words.forEach((wd, k2) => { ctx.fillText(wd, wx, ly); wx += ww[k2] + gap; });
          } else {
            runs.forEach((r, k2) => {
              ctx.font = fontFor(r);
              ctx.fillStyle = r.label ? el.labelColor : el.color;
              ctx.fillText(r.text, cx, ly);
              cx += widths[k2];
            });
          }
          if (el.underline || el.strike) {
            const startX = justify ? x : (el.align === "center" ? x + (bw - total) / 2 : el.align === "right" ? x + bw - total : x);
            const lineW = justify ? bw : total;
            ctx.fillStyle = el.color;
            const t = Math.max(1, el.fontSize * scale * 0.06);
            if (el.underline) ctx.fillRect(startX, ly + el.fontSize * scale * 0.42, lineW, t);
            if (el.strike) ctx.fillRect(startX, ly + el.fontSize * scale * 0.02, lineW, t);
          }
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

  // Slide transitions written into the PowerPoint (PresentationML, p: namespace).
  const TRANSITION_XML = {
    fade: "<p:fade/>",
    push: '<p:push dir="u"/>',
    wipe: '<p:wipe dir="r"/>',
    split: '<p:split orient="horz" dir="out"/>',
    cover: '<p:cover dir="l"/>',
    uncover: '<p:pull dir="l"/>',
    cut: "<p:cut/>",
    bars: '<p:randomBar dir="vert"/>',
    dissolve: "<p:dissolve/>",
    circle: "<p:circle/>",
    zoom: '<p:zoom dir="in"/>'
  };

  // One click-triggered entrance effect for shape id `spid`. ids: counter object.
  function entranceXml(type, spid, ids, durMs) {
    const n = () => (ids.v += 1);
    const set = `<p:set><p:cBhvr><p:cTn id="${n()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`;
    const effect = (filter) => `<p:animEffect transition="in" filter="${filter}"><p:cBhvr><p:cTn id="${n()}" dur="${durMs}"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:animEffect>`;
    const move = (attr, from) => `<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="${n()}" dur="${durMs}" fill="hold"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl><p:attrNameLst><p:attrName>${attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:strVal val="${from}"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="#${attr}"/></p:val></p:tav></p:tavLst></p:anim>`;
    const preset = { appear: [1, 0], fade: [10, 0], fly: [2, 4], rise: [42, 0], zoom: [53, 16], wipe: [22, 8] }[type] || [10, 0];
    let body = set;
    if (type === "fade") body += effect("fade");
    if (type === "wipe") body += effect("wipe(left)");
    if (type === "fly") body += move("ppt_y", "#ppt_y+1");
    if (type === "rise") body += effect("fade") + move("ppt_y", "#ppt_y+.1");
    if (type === "zoom") body += effect("fade") + `<p:animScale><p:cBhvr><p:cTn id="${n()}" dur="${durMs}" fill="hold"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr><p:by x="100000" y="100000"/><p:from x="30000" y="30000"/><p:to x="100000" y="100000"/></p:animScale>`;
    const outer = n(), mid = n(), inner = n();
    return `<p:par><p:cTn id="${outer}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${mid}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${inner}" presetID="${preset[0]}" presetClass="entr" presetSubtype="${preset[1]}" fill="hold" nodeType="clickEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${body}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`;
  }

  // Add transitions and animations to the slide XML files of a pptx.
  async function addMotion(buffer, deck) {
    const JSZip = window.JSZip;
    if (!JSZip) return new Blob([buffer]);
    const zip = await JSZip.loadAsync(buffer);
    for (let i = 0; i < deck.slides.length; i += 1) {
      const slide = deck.slides[i];
      const path = `ppt/slides/slide${i + 1}.xml`;
      const file = zip.file(path);
      if (!file) continue;
      let xml = await file.async("string");
      let extra = "";
      const tr = slide.transition;
      if (tr && tr.type && tr.type !== "none" && TRANSITION_XML[tr.type]) {
        const spd = (tr.dur || 0.7) <= 0.5 ? "fast" : (tr.dur || 0.7) >= 1.2 ? "slow" : "med";
        extra += `<p:transition spd="${spd}">${TRANSITION_XML[tr.type]}</p:transition>`;
      }
      const animated = slide.elements.filter((e) => e.anim && e.anim.type && e.anim.type !== "none").sort((a, b) => (a.anim.order || 0) - (b.anim.order || 0));
      if (animated.length) {
        const ids = { v: 2 };
        const clicks = [];
        for (const el of animated) {
          const m = xml.match(new RegExp(`<p:cNvPr id="(\\d+)" name="${el.id}"`));
          if (m) clicks.push(entranceXml(el.anim.type, m[1], ids, Math.round((el.anim.dur || 0.5) * 1000)));
        }
        if (clicks.length) {
          extra += `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${clicks.join("")}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
        }
      }
      if (!extra) continue;
      // Order in <p:sld>: cSld, clrMapOvr, transition, timing, extLst.
      if (xml.includes("</p:clrMapOvr>")) xml = xml.replace("</p:clrMapOvr>", `</p:clrMapOvr>${extra}`);
      else xml = xml.replace("</p:cSld>", `</p:cSld>${extra}`);
      zip.file(path, xml);
    }
    return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  }

  async function exportPptx(deck, filename, onProgress = () => {}) {
    const PptxGenJS = await pptxLib();
    const pptx = new PptxGenJS();
    const widthIn = 13.333;
    const first = deck.slides[0];
    const k = widthIn / first.w; // inches per editor px
    const pt = (px) => Math.max(0.25, Math.round(px * k * 72 * 10) / 10);
    pptx.defineLayout({ name: "NT", width: widthIn, height: first.h * k });
    pptx.layout = "NT";
    pptx.title = deck.title || "Slides";
    deck.slides.forEach((slide, i) => {
      onProgress(i, deck.slides.length);
      const s = pptx.addSlide();
      if (slide.bgMode === "color") s.background = { color: noHash(slide.bgColor) };
      else s.background = { data: bareData((slide.clean || slide.original).toDataURL("image/jpeg", 0.9)) };
      for (const el of slide.elements) {
        const box = { x: el.x * k, y: el.y * k, w: el.w * k, h: el.h * k, objectName: el.id, ...(el.rotate ? { rotate: el.rotate } : {}) };
        const transparency = Math.round((1 - (el.opacity ?? 1)) * 100);
        const outline = el.stroke && el.strokeWidth ? { line: { color: noHash(el.stroke), width: pt(el.strokeWidth) } } : { line: { type: "none" } };
        if (el.type === "text") {
          const sizePt = Math.max(1, Math.round(el.fontSize * k * 72 * 10) / 10);
          // One PowerPoint paragraph per paragraph; "• " becomes a real bullet with a
          // hanging indent; "Label:" lead-ins keep their colour and weight
          measureCtx.font = fontString(el, 1);
          const bulletPt = Math.round(measureCtx.measureText("• ").width * k * 72 * 10) / 10;
          const runs = String(el.text).split("\n").flatMap((para, li, all) => {
            const bullet = /^•\s/.test(para);
            const body = bullet ? para.replace(/^•\s*/, "") : para;
            const parts = el.labelColor ? lineRuns(el, body) : [{ text: body }];
            return parts.map((r, ri, arr) => ({
              text: r.text,
              options: {
                ...(r.label ? { color: noHash(el.labelColor), bold: Boolean(el.labelBold) } : {}),
                ...(bullet ? { bullet: { indent: bulletPt } } : {}),
                ...(ri === arr.length - 1 && li < all.length - 1 ? { breakLine: true } : {})
              }
            }));
          });
          s.addText(runs, {
            ...box,
            fontFace: el.fontFamily,
            fontSize: sizePt,
            color: noHash(el.color),
            bold: Boolean(el.bold),
            italic: Boolean(el.italic),
            ...(el.underline ? { underline: { style: "sng" } } : {}),
            ...(el.strike ? { strike: "sngStrike" } : {}),
            ...(el.highlight ? { fill: { color: noHash(el.highlight) } } : {}),
            ...(el.stroke && el.strokeWidth ? outline : {}),
            align: el.align || "left",
            valign: el.valign || "top",
            margin: 0,
            // Exact spacing in points: a multiple is applied on top of the font's own
            // line height (~1.15) and spreads the lines further apart than on the slide
            lineSpacing: Math.round(sizePt * (el.lineHeight || 1.2) * 10) / 10,
            paraSpaceBefore: 0,
            paraSpaceAfter: 0,
            fit: "none",
            transparency
          });
        } else if (el.type === "rect" || el.type === "ellipse" || el.type === "triangle") {
          const shape = el.type === "rect" ? (el.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect) : el.type === "ellipse" ? pptx.ShapeType.ellipse : pptx.ShapeType.triangle;
          s.addShape(shape, {
            ...box,
            fill: el.fill && el.fill !== "none" ? { color: noHash(el.fill), transparency } : { type: "none" },
            ...outline,
            ...(el.type === "rect" && el.radius ? { rectRadius: Math.min(0.5, el.radius / Math.min(el.w, el.h)) } : {})
          });
        } else if (el.type === "line") {
          s.addShape(pptx.ShapeType.line, {
            ...box,
            ...(el.flip ? { flipV: true } : {}),
            line: { color: noHash(el.stroke || "#1f1f1f"), width: pt(el.strokeWidth || 4), transparency, ...(el.arrow ? { endArrowType: "triangle" } : {}) }
          });
        } else if (el.type === "image") {
          s.addImage({ ...box, data: bareData(el.src), transparency });
        }
      }
      if (slide.notes) s.addNotes(slide.notes);
    });
    onProgress(deck.slides.length, deck.slides.length);
    const hasMotion = deck.slides.some((sl) => (sl.transition && sl.transition.type && sl.transition.type !== "none") || sl.elements.some((e) => e.anim && e.anim.type && e.anim.type !== "none"));
    if (!hasMotion) return pptx.writeFile({ fileName: filename });
    const buffer = await pptx.write({ outputType: "arraybuffer" });
    P.saveBlob(await addMotion(buffer, deck), filename);
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
        const fillOpt = el.fill && el.fill !== "none" ? { color: rgbOf(el.fill), opacity: op } : {};
        const strokeOpt = el.stroke && el.strokeWidth ? { borderColor: rgbOf(el.stroke), borderWidth: el.strokeWidth * k, borderOpacity: op } : {};
        if (el.type === "rect") page.drawRectangle({ x: el.x * k, y: ph - (el.y + el.h) * k, width: el.w * k, height: el.h * k, ...fillOpt, ...strokeOpt });
        else if (el.type === "ellipse") page.drawEllipse({ x: (el.x + el.w / 2) * k, y: ph - (el.y + el.h / 2) * k, xScale: (el.w / 2) * k, yScale: (el.h / 2) * k, ...fillOpt, ...strokeOpt });
        else if (el.type === "triangle") page.drawSvgPath(`M ${el.w * k / 2} 0 L ${el.w * k} ${el.h * k} L 0 ${el.h * k} Z`, { x: el.x * k, y: ph - el.y * k, ...fillOpt, ...strokeOpt });
        else if (el.type === "line") {
          const [x1, y1, x2, y2] = lineEnds(el, el.x * k, el.y * k, el.w * k, el.h * k);
          page.drawLine({ start: { x: x1, y: ph - y1 }, end: { x: x2, y: ph - y2 }, thickness: (el.strokeWidth || 4) * k, color: rgbOf(el.stroke || "#1f1f1f"), opacity: op });
          if (el.arrow) {
            const ang = Math.atan2(y2 - y1, x2 - x1), hd = Math.max((el.strokeWidth || 4) * k * 3.5, 8);
            page.drawSvgPath(`M ${x2} ${y2} L ${x2 - hd * Math.cos(ang - 0.45)} ${y2 - hd * Math.sin(ang - 0.45)} L ${x2 - hd * Math.cos(ang + 0.45)} ${y2 - hd * Math.sin(ang + 0.45)} Z`, { x: 0, y: ph, color: rgbOf(el.stroke || "#1f1f1f"), opacity: op });
          }
        }
        else if (el.type === "image") {
          const bytes = Uint8Array.from(atob(el.src.split(",")[1] || ""), (c) => c.charCodeAt(0));
          const img = /png/.test(el.src.slice(0, 30)) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          page.drawImage(img, { x: el.x * k, y: ph - (el.y + el.h) * k, width: el.w * k, height: el.h * k, opacity: op });
        } else if (el.type === "text") {
          if (el.highlight) page.drawRectangle({ x: el.x * k, y: ph - (el.y + el.h) * k, width: el.w * k, height: el.h * k, color: rgbOf(el.highlight), opacity: op });
          const font = await pick(el);
          const size = el.fontSize * k;
          const lh = size * el.lineHeight;
          const laid = layoutLines(safe(font, el.text), el.w * k, (s) => font.widthOfTextAtSize(s, size));
          const labelFont = el.labelColor ? await pick({ ...el, bold: el.labelBold }) : font;
          laid.forEach(({ text: line, indent, first }, n) => {
            const runs = (first ? lineRuns(el, line) : [{ text: line }]).map((r) => ({ ...r, f: r.label ? labelFont : font }));
            const widths = runs.map((r) => r.f.widthOfTextAtSize(r.text, size));
            const tw = widths.reduce((a, b) => a + b, 0);
            let x = el.align === "center" ? el.x * k + (el.w * k - tw) / 2 : el.align === "right" ? (el.x + el.w) * k - tw : el.x * k + indent;
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

  return { layoutLines, _test: { segmentsOf: (...a) => segmentsOf(...a), strokeRatio: (...a) => strokeRatio(...a), sampleStyle: (...a) => sampleStyle(...a), serifScore: (...a) => serifScore(...a), contrastMap: (...a) => contrastMap(...a), slantOf: (...a) => slantOf(...a) }, lineRuns, shapePath, lineEnds, W, id, loadPdf, renderOriginal, newSlide, blankSlide, analyze, skipAnalysis, drawSlide, slideCanvas, cssFamily, exportPptx, exportPdf, exportPngs };
})();
