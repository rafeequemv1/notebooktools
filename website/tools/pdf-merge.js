/* Merge PDFs: combine several PDFs (and images) into one, in the order you set. */
(() => {
  const P = NTPdf;
  const $ = (s) => document.querySelector(s);
  let items = []; // { file, pages }

  P.dropZone($("#mergeDrop"), { label: "Drop PDFs to merge", multiple: true, accept: ".pdf,application/pdf,image/png,image/jpeg" }, async (files) => {
    for (const f of files) {
      let pages = 1;
      if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) {
        try {
          pages = (await P.openPdfLib(await P.bytesOf(f))).getPageCount();
        } catch (_error) {
          P.status($("#mergeStatus"), `“${f.name}” couldn't be opened as a PDF and was skipped.`, "error");
          continue;
        }
      }
      items.push({ file: f, pages });
    }
    render();
  });

  function render() {
    const totalPages = items.reduce((s, i) => s + i.pages, 0);
    const totalSize = items.reduce((s, i) => s + i.file.size, 0);
    $("#mergeList").innerHTML = items.map((it, i) => `
      <div class="pdf-file"><span class="pdf-file-icon${/image/.test(it.file.type) ? " is-img" : ""}">${/image/.test(it.file.type) ? "IMG" : "PDF"}</span>
        <span class="pdf-file-text"><span class="pdf-file-name">${i + 1}. ${NTTools.esc(it.file.name)}</span><span class="pdf-file-meta">${it.pages} page${it.pages === 1 ? "" : "s"} · ${P.fmtBytes(it.file.size)}</span></span>
        <span class="pdf-file-actions">
          <button type="button" class="pdf-icon-btn" data-up="${i}" aria-label="Move up"${i === 0 ? " disabled" : ""}>↑</button>
          <button type="button" class="pdf-icon-btn" data-down="${i}" aria-label="Move down"${i === items.length - 1 ? " disabled" : ""}>↓</button>
          <button type="button" class="pdf-icon-btn" data-rm="${i}" aria-label="Remove">×</button>
        </span></div>`).join("");
    $("#mergeRunRow").hidden = items.length < 2;
    if (items.length) P.status($("#mergeStatus"), `${items.length} file${items.length === 1 ? "" : "s"} · ${totalPages} pages · about ${P.fmtBytes(totalSize)}${items.length < 2 ? ". Add at least one more." : ""}`);
  }

  $("#mergeList").addEventListener("click", (event) => {
    const t = event.target.closest("button");
    if (!t) return;
    const i = Number(t.dataset.up ?? t.dataset.down ?? t.dataset.rm);
    if ("up" in t.dataset) [items[i - 1], items[i]] = [items[i], items[i - 1]];
    if ("down" in t.dataset) [items[i + 1], items[i]] = [items[i], items[i + 1]];
    if ("rm" in t.dataset) items.splice(i, 1);
    render();
  });

  $("#mergeRun").addEventListener("click", async () => {
    const btn = $("#mergeRun");
    btn.disabled = true;
    try {
      const { PDFDocument } = await P.pdfLib();
      const out = await PDFDocument.create();
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i];
        P.status($("#mergeStatus"), `Adding ${i + 1} of ${items.length}: ${it.file.name}…`);
        P.progress($("#mergeBar"), i, items.length);
        const data = await P.bytesOf(it.file);
        if (/image/.test(it.file.type)) {
          const img = /png/.test(it.file.type) ? await out.embedPng(data) : await out.embedJpg(data);
          const page = out.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        } else {
          const src = await PDFDocument.load(data, { ignoreEncryption: true });
          (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
        }
      }
      const bytes = await out.save({ useObjectStreams: true });
      P.progress($("#mergeBar"), 1, 1);
      const name = `${P.baseName(items[0].file.name)} (merged).pdf`;
      P.saveBlob(P.pdfBlob(bytes), name);
      const over = bytes.length > P.LIMITS.bytes;
      P.status($("#mergeStatus"), `Merged ${items.length} files into ${out.getPageCount()} pages (${P.fmtBytes(bytes.length)}).${over ? " That's over NotebookLM's 200 MB per source; split it or compress it first." : " Ready to add to NotebookLM as one source."}`, over ? "error" : "ok");
    } catch (error) {
      P.status($("#mergeStatus"), error.message || "Merge failed.", "error");
    }
    btn.disabled = false;
  });
})();
