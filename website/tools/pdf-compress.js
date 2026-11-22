/* Compress PDF. "Keep text" re-saves the file compactly (lossless, small
   gains). "Scanned" redraws each page as a JPEG at the chosen quality: much
   smaller for scans and photos, but text becomes an image. */
(() => {
  const P = NTPdf;
  const $ = (s) => document.querySelector(s);
  let file = null;
  let bytes = null;

  P.dropZone($("#cpDrop"), { label: "Drop a PDF to compress", sample: "scan" }, async ([f]) => {
    file = f;
    bytes = await P.bytesOf(f);
    $("#cpFile").hidden = false;
    $("#cpFile").innerHTML = `<span class="pdf-file-icon">PDF</span><span class="pdf-file-text"><span class="pdf-file-name">${NTTools.esc(f.name)}</span><span class="pdf-file-meta">${P.fmtBytes(f.size)}${f.size > P.LIMITS.bytes ? " · over NotebookLM's 200 MB limit" : ""}</span></span>`;
    $("#cpOptions").hidden = false;
    $("#cpResults").innerHTML = "";
    P.status($("#cpStatus"), "Pick a mode, then click Compress.");
    sync();
  });

  function mode() {
    return document.querySelector('input[name="cpMode"]:checked').value;
  }
  function sync() {
    $("#cpQualityWrap").hidden = mode() !== "scan";
  }
  document.querySelectorAll('input[name="cpMode"]').forEach((r) => r.addEventListener("change", sync));

  async function lossless() {
    const doc = await P.openPdfLib(bytes);
    doc.setProducer("NotebookTools");
    return doc.save({ useObjectStreams: true, addDefaultPage: false });
  }

  async function rasterize() {
    const [q, dpi] = $("#cpQuality").value.split(":").map(Number);
    const { PDFDocument } = await P.pdfLib();
    const pdf = await P.openPdfjs(bytes);
    const out = await PDFDocument.create();
    for (let i = 1; i <= pdf.numPages; i += 1) {
      P.status($("#cpStatus"), `Compressing page ${i} of ${pdf.numPages}…`);
      P.progress($("#cpBar"), i - 1, pdf.numPages);
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const canvas = await P.renderPage(pdf, i, dpi / 72);
      const jpg = new Uint8Array(await (await P.canvasBlob(canvas, "image/jpeg", q)).arrayBuffer());
      const img = await out.embedJpg(jpg);
      out.addPage([base.width, base.height]).drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      canvas.width = canvas.height = 0;
    }
    return out.save({ useObjectStreams: true });
  }

  $("#cpRun").addEventListener("click", async () => {
    if (!bytes) return;
    const btn = $("#cpRun");
    btn.disabled = true;
    try {
      const out = mode() === "scan" ? await rasterize() : await lossless();
      P.progress($("#cpBar"), 1, 1);
      const saved = 1 - out.length / file.size;
      const name = `${P.baseName(file.name)} (compressed).pdf`;
      if (out.length >= file.size) {
        P.status($("#cpStatus"), mode() === "scan" ? "That didn't make it smaller. Try a lower quality." : "This PDF is already compact. Try the Scanned mode for scans and image-heavy files.", "error");
      } else {
        $("#cpResults").innerHTML = `<div class="pdf-result"><span class="pdf-file-icon">PDF</span><span class="pdf-file-text"><span class="pdf-file-name">${NTTools.esc(name)}</span><span class="pdf-file-meta">${P.fmtBytes(file.size)} → ${P.fmtBytes(out.length)} (${Math.round(saved * 100)}% smaller)</span></span><button type="button" class="tool-btn is-primary" id="cpSave">Download</button></div>`;
        $("#cpSave").onclick = () => P.saveBlob(P.pdfBlob(out), name);
        P.status($("#cpStatus"), out.length > P.LIMITS.bytes ? "Smaller, but still over 200 MB. Split it into parts too." : "Done. Ready to add to NotebookLM.", out.length > P.LIMITS.bytes ? "error" : "ok");
      }
    } catch (error) {
      P.status($("#cpStatus"), error.message || "Compression failed.", "error");
    }
    btn.disabled = false;
  });
})();
