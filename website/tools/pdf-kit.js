/* Shared helpers for the PDF and image tools. Everything runs in this browser
   tab: files are read with the File API and never uploaded. pdf-lib edits
   PDFs, pdf.js reads and renders them, Tesseract.js does OCR; all three are
   served from /tools/vendor/. */
window.NTPdf = (() => {
  const VENDOR = "/tools/vendor";
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
      <p class="pdf-drop-private">Stays on your device. Nothing is uploaded.</p>`;
    el.append(input);
    el.querySelector(".pdf-drop-btn").addEventListener("click", () => input.click());
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

  // NotebookLM limits, for the "will it fit" messages.
  const LIMITS = { words: 500000, bytes: 200 * 1024 * 1024, sources: 50 };

  return {
    pdfLib, pdfjs, openPdfjs, openPdfLib, bytesOf, fmtBytes, baseName, saveBlob, pdfBlob,
    dropZone, parseRanges, copyPages, renderPage, canvasBlob, pageText, words, zip, status, progress, ocr, LIMITS
  };
})();
