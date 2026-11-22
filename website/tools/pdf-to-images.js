/* PDF slides to images: every page (or chosen pages) as PNG or JPG, sized
   for LinkedIn / Instagram or at full resolution. */
(() => {
  const P = NTPdf;
  const $ = (s) => document.querySelector(s);
  let file = null;
  let bytes = null;
  let total = 0;

  P.dropZone($("#piDrop"), { label: "Drop a slide deck PDF" }, async ([f]) => {
    file = f;
    bytes = await P.bytesOf(f);
    try {
      total = (await P.openPdfjs(bytes)).numPages;
    } catch (_error) {
      return P.status($("#piStatus"), "That file couldn't be opened as a PDF.", "error");
    }
    $("#piFile").hidden = false;
    $("#piFile").innerHTML = `<span class="pdf-file-icon">PDF</span><span class="pdf-file-text"><span class="pdf-file-name">${NTTools.esc(f.name)}</span><span class="pdf-file-meta">${total} pages · ${P.fmtBytes(f.size)}</span></span>`;
    $("#piOptions").hidden = false;
    $("#piThumbs").innerHTML = "";
    P.status($("#piStatus"), "Choose a format and size, then click Convert.");
  });

  $("#piRun").addEventListener("click", async () => {
    if (!bytes) return;
    const btn = $("#piRun");
    btn.disabled = true;
    try {
      const pdf = await P.openPdfjs(bytes);
      const pages = $("#piPages").value.trim() ? P.parseRanges($("#piPages").value, total) : Array.from({ length: total }, (_, i) => i);
      const format = $("#piFormat").value;
      const width = Number($("#piWidth").value);
      const type = format === "jpg" ? "image/jpeg" : "image/png";
      const name = P.baseName(file.name);
      const files = [];
      $("#piThumbs").innerHTML = "";
      for (let k = 0; k < pages.length; k += 1) {
        const n = pages[k] + 1;
        P.status($("#piStatus"), `Rendering page ${n} (${k + 1} of ${pages.length})…`);
        P.progress($("#piBar"), k, pages.length);
        const page = await pdf.getPage(n);
        const scale = width ? width / page.getViewport({ scale: 1 }).width : 2;
        const canvas = await P.renderPage(pdf, n, scale);
        const blob = await P.canvasBlob(canvas, type, 0.92);
        const data = new Uint8Array(await blob.arrayBuffer());
        const fileName = `${name} - ${String(n).padStart(2, "0")}.${format}`;
        files.push({ name: fileName, data });
        const thumb = document.createElement("button");
        thumb.type = "button";
        thumb.className = "pdf-thumb";
        thumb.title = `Download ${fileName}`;
        const img = document.createElement("img");
        img.src = URL.createObjectURL(blob);
        img.alt = `Page ${n}`;
        thumb.append(img, Object.assign(document.createElement("span"), { textContent: `Page ${n} · ${canvas.width}×${canvas.height}` }));
        thumb.addEventListener("click", () => P.saveBlob(blob, fileName));
        $("#piThumbs").append(thumb);
      }
      P.progress($("#piBar"), 1, 1);
      $("#piZipRow").hidden = false;
      $("#piZip").onclick = () => P.saveBlob(P.zip(files), `${name} (images).zip`);
      P.status($("#piStatus"), `${files.length} image${files.length === 1 ? "" : "s"} ready. Click one to download it, or download all.`, "ok");
    } catch (error) {
      P.status($("#piStatus"), error.message || "Conversion failed.", "error");
    }
    btn.disabled = false;
  });
})();
