/* Shared helpers for the PDF and image tools. Everything runs in this browser
   tab: files are read with the File API and never uploaded. pdf-lib edits
   PDFs, pdf.js reads and renders them, Tesseract.js does OCR; all three are
   served from /tools/vendor/. */
window.NTPdf = (() => {
  const VENDOR = window.NT_VENDOR || "/tools/vendor";
  let pdfLibPromise = null;
  let pdfjsPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.append(s);
    });
  }

  function pdfLib() {
    pdfLibPromise ||= loadScript(`${VENDOR}/pdf-lib/pdf-lib.min.js`).then(() => window.PDFLib);
    return pdfLibPromise;
  }

  function pdfjs() {
    pdfjsPromise ||= import(`${VENDOR}/pdfjs/pdf.min.mjs`).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = `${VENDOR}/pdfjs/pdf.worker.min.mjs`;
      return lib;
    });
    return pdfjsPromise;
  }

  async function openPdfjs(bytes) {
    const lib = await pdfjs();
    return lib.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
  }

  async function openPdfLib(bytes) {
    const { PDFDocument } = await pdfLib();
    return PDFDocument.load(bytes, { ignoreEncryption: true });
  }

  /* ---------- Files ---------- */
  function bytesOf(file) {
    return file.arrayBuffer().then((buf) => new Uint8Array(buf));
  }

  function fmtBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }

  function baseName(name) {
    return String(name || "file").replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*]+/g, "-").trim() || "file";
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function pdfBlob(bytes) {
    return new Blob([bytes], { type: "application/pdf" });
  }

  /**
   * Drop zone. el gets a dashed box with a button; calls onFiles(File[]).
   * options: { accept, multiple, label, hint }
   */
  function dropZone(el, options, onFiles) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = options.accept || ".pdf,application/pdf";
    input.multiple = Boolean(options.multiple);
    input.hidden = true;
    el.classList.add("pdf-drop");
    el.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
      <p class="pdf-drop-title">${options.label || "Drop a PDF here"}</p>
      <p class="pdf-drop-hint">${options.hint || "or"} <button type="button" class="tool-btn is-primary pdf-drop-btn">Choose ${options.multiple ? "files" : "a file"}</button></p>
      ${options.sample ? `<button type="button" class="pdf-sample-btn">Try with a sample ${options.multiple ? "set" : "file"}</button>` : ""}
      <p class="pdf-drop-private">Stays on your device. Nothing is uploaded.</p>`;
    el.append(input);
    el.querySelector(".pdf-drop-btn").addEventListener("click", () => input.click());
    el.querySelector(".pdf-sample-btn")?.addEventListener("click", async (event) => {
      const btn = event.currentTarget;
      btn.disabled = true;
      btn.textContent = "Making the sample…";
      try {
        onFiles(await sample(options.sample));
      } finally {
        btn.disabled = false;
        btn.textContent = `Try with a sample ${options.multiple ? "set" : "file"}`;
      }
    });
    input.addEventListener("change", () => {
      if (input.files.length) onFiles([...input.files]);
      input.value = "";
    });
    ["dragenter", "dragover"].forEach((type) => el.addEventListener(type, (event) => {
      event.preventDefault();
      el.classList.add("is-over");
    }));
    ["dragleave", "drop"].forEach((type) => el.addEventListener(type, () => el.classList.remove("is-over")));
    el.addEventListener("drop", (event) => {
      event.preventDefault();
      const files = [...(event.dataTransfer?.files || [])];
      if (files.length) onFiles(options.multiple ? files : files.slice(0, 1));
    });
    return { open: () => input.click() };
  }

  /* ---------- Pages ---------- */
  // "1-3, 5, 8-" → [0,1,2,4,7,8,...] (0-based, in order, unique, in range)
  function parseRanges(text, total) {
    const out = [];
    const seen = new Set();
    for (const raw of String(text || "").split(/[,;\s]+/)) {
      const part = raw.trim();
      if (!part) continue;
      const m = part.match(/^(\d*)\s*-\s*(\d*)$/);
      let from;
      let to;
      if (m) {
        from = m[1] ? Number(m[1]) : 1;
        to = m[2] ? Number(m[2]) : total;
      } else if (/^\d+$/.test(part)) {
        from = to = Number(part);
      } else {
        throw new Error(`“${part}” isn't a page or range. Use numbers like 1-3, 5, 8-.`);
      }
      if (from > to) [from, to] = [to, from];
      for (let p = Math.max(1, from); p <= Math.min(total, to); p += 1) {
        if (!seen.has(p)) {
          seen.add(p);
          out.push(p - 1);
        }
      }
    }
    return out;
  }

  async function copyPages(srcDoc, indices) {
    const { PDFDocument } = await pdfLib();
    const out = await PDFDocument.create();
    const pages = await out.copyPages(srcDoc, indices);
    pages.forEach((p) => out.addPage(p));
    return out.save({ useObjectStreams: true });
  }

  // Render one page (1-based) to a canvas at a given scale.
  async function renderPage(pdf, pageNumber, scale = 1.5) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    page.cleanup();
    return canvas;
  }

  function canvasBlob(canvas, type = "image/png", quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  // Text of one page, with line breaks where the text moves down a line.
  async function pageText(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    let out = "";
    let lastY = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > Math.max(2, (item.height || 10) * 0.6)) {
        out += Math.abs(y - lastY) > (item.height || 10) * 1.8 ? "\n\n" : "\n";
      } else if (out && !out.endsWith(" ") && item.str && !item.str.startsWith(" ")) {
        out += " ";
      }
      out += item.str;
      if (item.hasEOL) out += "\n";
      lastY = y;
    }
    page.cleanup();
    return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, " ").trim();
  }

  function words(text) {
    const m = String(text || "").match(/\S+/g);
    return m ? m.length : 0;
  }

  /* ---------- ZIP (stored) ---------- */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // files: [{ name, data: Uint8Array | string }]
  function zip(files) {
    const enc = new TextEncoder();
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    const day = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint16(10, time, true); h.setUint16(12, day, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(12, time, true); c.setUint16(14, day, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const size = central.reduce((s, p) => s + p.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, size, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: "application/zip" });
  }

  /* ---------- UI bits ---------- */
  function status(el, message, type = "") {
    el.textContent = message || "";
    el.className = `pdf-status${type ? ` is-${type}` : ""}`;
    el.hidden = !message;
  }

  function progress(el, done, total) {
    el.hidden = false;
    el.querySelector("span").style.width = `${Math.round((done / Math.max(1, total)) * 100)}%`;
  }


  /* ---------- Sample files (made in the browser, nothing downloaded) ---------- */
  const SAMPLE_TEXT = [
    "Sleep is not a pause in learning; it is part of it. During the day the hippocampus stores new experiences quickly but fragilely. At night, those traces are replayed and gradually moved into the neocortex, where they last.",
    "Deep, slow-wave sleep dominates the first half of the night. Studies that wake people during this stage show weaker recall the next morning, especially for facts and word lists.",
    "REM sleep, which grows longer towards morning, seems to link new memories to older ones. People woken from REM are more likely to find creative solutions to puzzles they practised the day before.",
    "A short nap can help too. In one well-known study, a 90 minute afternoon nap improved recall of new facts by about 20 percent compared with staying awake.",
    "Timing matters. Reviewing material shortly before sleep, and again the next day, tends to beat cramming the same hours into one evening. This is the spacing effect working together with sleep.",
    "Caffeine late in the day, alcohol and irregular bedtimes all fragment sleep. The cost is not only tiredness: fragmented nights reduce the time spent in the stages that consolidate memory."
  ];

  function wrap(text, font, size, width) {
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  async function textPdf(title, chapters, pagesPerChapter = 2) {
    const { PDFDocument, StandardFonts, rgb } = await pdfLib();
    const doc = await PDFDocument.create();
    doc.setTitle(title);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let n = 0;
    for (let c = 0; c < chapters.length; c += 1) {
      for (let k = 0; k < pagesPerChapter; k += 1) {
        n += 1;
        const page = doc.addPage([612, 792]);
        let y = 720;
        if (k === 0) {
          page.drawText(`Chapter ${c + 1}`, { x: 72, y, size: 12, font: bold, color: rgb(0.04, 0.34, 0.82) });
          y -= 30;
          page.drawText(chapters[c], { x: 72, y, size: 24, font: bold });
          y -= 36;
        }
        for (let p = 0; p < 4 && y > 110; p += 1) {
          for (const line of wrap(SAMPLE_TEXT[(c + k + p) % SAMPLE_TEXT.length], font, 11.5, 468)) {
            page.drawText(line, { x: 72, y, size: 11.5, font, color: rgb(0.15, 0.15, 0.15) });
            y -= 17;
          }
          y -= 12;
        }
        page.drawText(`${title} · ${n}`, { x: 72, y: 40, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
      }
    }
    return doc.save();
  }

  // A page that looks photographed: off-white, slightly rotated, a little noise.
  function scanCanvas(lines, heading) {
    const canvas = document.createElement("canvas");
    canvas.width = 1275;
    canvas.height = 1650;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4f1ea";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-0.006);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    ctx.fillStyle = "#1d1d1d";
    ctx.font = "bold 46px Georgia, serif";
    ctx.fillText(heading, 120, 190);
    ctx.font = "30px Georgia, serif";
    let y = 280;
    for (const para of lines) {
      let line = "";
      for (const word of para.split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > 1030) {
          ctx.fillText(line, 120, y);
          y += 46;
          line = word;
        } else line = next;
      }
      ctx.fillText(line, 120, y);
      y += 74;
    }
    ctx.restore();
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const d = (Math.random() - 0.5) * 18;
      img.data[i] += d; img.data[i + 1] += d; img.data[i + 2] += d;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  async function scanPdf(pages = 3) {
    const { PDFDocument } = await pdfLib();
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i += 1) {
      const canvas = scanCanvas(SAMPLE_TEXT.slice(i, i + 3), `Scanned notes, page ${i + 1}`);
      const png = new Uint8Array(await (await canvasBlob(canvas, "image/png")).arrayBuffer());
      const img = await doc.embedPng(png);
      doc.addPage([612, 792]).drawImage(img, { x: 0, y: 0, width: 612, height: 792 });
    }
    return doc.save();
  }

  async function slidesPdf() {
    const { PDFDocument, StandardFonts, rgb } = await pdfLib();
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const slides = [
      ["How sleep builds memory", "A 6-slide summary"],
      ["Deep sleep", "Replays the day and moves memories into long-term storage"],
      ["REM sleep", "Links new memories to what you already know"],
      ["Naps count", "A 90 minute nap improved recall by about 20%"],
      ["Spacing works", "Review before sleep, then again the next day"],
      ["Protect your nights", "Less late caffeine, alcohol and irregular bedtimes"]
    ];
    const colors = [[0.04, 0.34, 0.82], [0.1, 0.5, 0.33], [0.55, 0.27, 0.76], [0.92, 0.45, 0.05], [0.8, 0.15, 0.3], [0.12, 0.12, 0.14]];
    slides.forEach(([title, sub], i) => {
      const page = doc.addPage([960, 540]);
      const [r, g, b] = colors[i];
      page.drawRectangle({ x: 0, y: 0, width: 960, height: 540, color: rgb(r, g, b) });
      page.drawRectangle({ x: 64, y: 400, width: 70, height: 8, color: rgb(1, 1, 1) });
      page.drawText(title, { x: 64, y: 300, size: 54, font: bold, color: rgb(1, 1, 1) });
      wrap(sub, font, 26, 820).forEach((line, k) => page.drawText(line, { x: 64, y: 240 - k * 34, size: 26, font, color: rgb(1, 1, 1) }));
      page.drawText(`${i + 1} / ${slides.length}`, { x: 860, y: 40, size: 16, font, color: rgb(1, 1, 1) });
    });
    return doc.save();
  }

  async function whiteboardImage() {
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 820;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fbfbf8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#c9c9c4";
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
    ctx.fillStyle = "#1a3d8f";
    ctx.font = "bold 64px Arial, sans-serif";
    ctx.fillText("Sleep and memory: key points", 90, 150);
    ctx.font = "44px Arial, sans-serif";
    ["1. Deep sleep moves memories into long-term storage", "2. REM sleep links new and old memories", "3. A 90 minute nap improves recall", "4. Review before bed, then again tomorrow"].forEach((t, i) => {
      ctx.fillStyle = i % 2 ? "#b3261e" : "#1d1d1d";
      ctx.fillText(t, 90, 280 + i * 110);
    });
    const blob = await canvasBlob(canvas, "image/png");
    return new File([blob], "whiteboard-notes.png", { type: "image/png" });
  }

  // Slides drawn as flat images (gradients, titles, bullets), like a NotebookLM deck.
  async function imageDeckPdf() {
    const { PDFDocument } = await pdfLib();
    const doc = await PDFDocument.create();
    const slides = [
      { bg: ["#0b3d91", "#1a73e8"], ink: "#ffffff", kicker: "STUDY GUIDE", title: "How Sleep Builds Memory", body: ["What happens to what you learn after the lights go out"] },
      { bg: ["#fdf6e3", "#f3e5c0"], ink: "#2b2b2b", kicker: "STAGE 1", title: "Deep sleep replays the day", body: ["The hippocampus replays new memories", "Traces move into long-term storage", "Strongest in the first half of the night"] },
      { bg: ["#1e1b2e", "#3b2f63"], ink: "#f1ecff", kicker: "STAGE 2", title: "REM links old and new", body: ["Connects new memories to what you know", "Linked to creative problem solving", "Longer periods towards morning"] },
      { bg: ["#e8f5e9", "#c8e6c9"], ink: "#1b4332", kicker: "EVIDENCE", title: "Naps count too", body: ["A 90 minute nap improved recall by about 20%", "Compared with staying awake"] },
      { bg: ["#fff3e0", "#ffd8a8"], ink: "#5c2c00", kicker: "TAKEAWAY", title: "Study with sleep in mind", body: ["Review shortly before bed", "Review again the next day", "Protect regular bedtimes"] }
    ];
    for (const s of slides) {
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 900;
      const ctx = canvas.getContext("2d");
      const g = ctx.createLinearGradient(0, 0, 1600, 900);
      g.addColorStop(0, s.bg[0]);
      g.addColorStop(1, s.bg[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1600, 900);
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = s.ink;
      ctx.beginPath();
      ctx.arc(1380, 160, 260, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = s.ink;
      ctx.font = "600 30px Arial, sans-serif";
      ctx.fillText(s.kicker, 110, 230);
      ctx.font = "bold 84px Arial, sans-serif";
      ctx.fillText(s.title, 110, 340);
      ctx.font = "44px Arial, sans-serif";
      s.body.forEach((line, i) => ctx.fillText(s.body.length > 1 ? `•  ${line}` : line, 110, 470 + i * 78));
      const png = new Uint8Array(await (await canvasBlob(canvas, "image/png")).arrayBuffer());
      const img = await doc.embedPng(png);
      doc.addPage([960, 540]).drawImage(img, { x: 0, y: 0, width: 960, height: 540 });
    }
    return doc.save();
  }

  const pdfFile = (bytes, name) => new File([bytes], name, { type: "application/pdf" });

  async function sample(kind) {
    const chapters = ["Why we sleep", "Deep sleep and facts", "REM and connections", "The power of naps", "Spacing and review", "Habits that protect sleep", "Sleep across a lifetime", "What we still don't know", "Studying with sleep in mind", "Summary and checklist", "Further reading", "Glossary"];
    if (kind === "book") return [pdfFile(await textPdf("Sleep and Memory (sample textbook)", chapters, 2), "sleep-and-memory-textbook.pdf")];
    if (kind === "handouts") {
      return Promise.all(["Lecture 1 - Why we sleep", "Lecture 2 - Deep sleep", "Lecture 3 - REM sleep"].map(async (t, i) =>
        pdfFile(await textPdf(t, [t.split(" - ")[1]], 2 + (i % 2)), `${t.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`)));
    }
    if (kind === "mixed") {
      const { PDFDocument } = await pdfLib();
      const out = await PDFDocument.create();
      for (const bytes of [await textPdf("Sleep and Memory (sample)", chapters.slice(0, 2), 1), await scanPdf(1)]) {
        const src = await PDFDocument.load(bytes);
        (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
      }
      return [pdfFile(await out.save(), "sleep-notes-with-scanned-page.pdf")];
    }
    if (kind === "scan") return [pdfFile(await scanPdf(3), "scanned-lecture-notes.pdf")];
    if (kind === "batch") {
      return [
        pdfFile(await textPdf("Sleep and Memory (sample textbook)", chapters, 2), "sleep-and-memory-textbook.pdf"),
        pdfFile(await textPdf("Lecture 1 - Why we sleep", ["Why we sleep"], 2), "lecture-1.pdf"),
        pdfFile(await scanPdf(2), "scanned-notes.pdf")
      ];
    }
    if (kind === "slides") return [pdfFile(await slidesPdf(), "how-sleep-builds-memory-slides.pdf")];
    if (kind === "image") return [await whiteboardImage()];
    if (kind === "deck") return [pdfFile(await imageDeckPdf(), "notebooklm-style-slide-deck.pdf")];
    return [];
  }

  /* ---------- OCR (Tesseract.js, English, self-hosted) ---------- */
  let workerPromise = null;
  let ocrProgress = () => {};

  async function ocrWorker() {
    workerPromise ||= (async () => {
      await loadScript(`${VENDOR}/tesseract/tesseract.min.js`);
      return window.Tesseract.createWorker("eng", 1, {
        workerPath: `${VENDOR}/tesseract/worker.min.js`,
        corePath: `${VENDOR}/tesseract/core`,
        langPath: `${VENDOR}/tesseract/lang`,
        workerBlobURL: false,
        gzip: true,
        logger: (m) => ocrProgress(m)
      });
    })();
    return workerPromise;
  }

  // image: canvas, <img>, Blob or File. Returns plain text.
  async function ocr(image, onProgress = () => {}) {
    ocrProgress = onProgress;
    const worker = await ocrWorker();
    const { data } = await worker.recognize(image);
    return String(data.text || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  // OCR with positions: Tesseract blocks → paragraphs → lines → words (bbox in image px).
  async function ocrBlocks(image, onProgress = () => {}) {
    ocrProgress = onProgress;
    const worker = await ocrWorker();
    const { data } = await worker.recognize(image, {}, { blocks: true, text: true });
    return data.blocks || [];
  }

  // A second worker that reads one line at a time (page segmentation mode 7),
  // for a closer look at lines the page pass wasn't sure about.
  let lineWorkerPromise = null;
  async function lineWorker() {
    lineWorkerPromise ||= (async () => {
      await loadScript(`${VENDOR}/tesseract/tesseract.min.js`);
      const worker = await window.Tesseract.createWorker("eng", 1, {
        workerPath: `${VENDOR}/tesseract/worker.min.js`,
        corePath: `${VENDOR}/tesseract/core`,
        langPath: `${VENDOR}/tesseract/lang`,
        workerBlobURL: false,
        gzip: true
      });
      await worker.setParameters({ tessedit_pageseg_mode: "7" });
      return worker;
    })();
    return lineWorkerPromise;
  }

  async function ocrLine(image) {
    const worker = await lineWorker();
    const { data } = await worker.recognize(image, {}, { blocks: true, text: true });
    return data.blocks || [];
  }

  // NotebookLM limits, for the "will it fit" messages.
  const LIMITS = { words: 500000, bytes: 200 * 1024 * 1024, sources: 50 };

  return {
    pdfLib, pdfjs, openPdfjs, openPdfLib, bytesOf, fmtBytes, baseName, saveBlob, pdfBlob,
    dropZone, parseRanges, copyPages, renderPage, canvasBlob, pageText, words, zip, status, progress, ocr, ocrBlocks, ocrLine, sample, LIMITS
  };
})();
