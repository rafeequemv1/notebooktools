/* Split PDF for NotebookLM: into equal parts, every N pages, by ranges,
   or under a size limit. Runs in the browser. */
(() => {
  const P = NTPdf;
  const $ = (s) => document.querySelector(s);
  let file = null;
  let bytes = null;
  let doc = null;
  let total = 0;

  P.dropZone($("#splitDrop"), { label: "Drop a PDF to split" }, async ([f]) => {
    P.status($("#splitStatus"), "Reading…");
    try {
      file = f;
      bytes = await P.bytesOf(f);
      doc = await P.openPdfLib(bytes);
      total = doc.getPageCount();
    } catch (error) {
      file = null;
      return P.status($("#splitStatus"), "That file couldn't be opened as a PDF. If it has a password, remove it first.", "error");
    }
    $("#splitFile").hidden = false;
    $("#splitFile").innerHTML = `<span class="pdf-file-icon">PDF</span><span class="pdf-file-text"><span class="pdf-file-name">${NTTools.esc(f.name)}</span><span class="pdf-file-meta">${total} pages · ${P.fmtBytes(f.size)}</span></span>`;
    $("#splitOptions").hidden = false;
    $("#splitResults").innerHTML = "";
    $("#splitParts").value = String(Math.max(2, Math.ceil(f.size / (190 * 1024 * 1024)), total > 300 ? 3 : 2));
    P.status($("#splitStatus"), f.size > P.LIMITS.bytes ? `This file is ${P.fmtBytes(f.size)}, over NotebookLM's 200 MB limit per source. Split it below.` : "Choose how to split, then click Split PDF.");
    updateMode();
  });

  function mode() {
    return document.querySelector('input[name="splitMode"]:checked').value;
  }

  function updateMode() {
    document.querySelectorAll("[data-split-mode]").forEach((el) => (el.hidden = el.dataset.splitMode !== mode()));
  }
  document.querySelectorAll('input[name="splitMode"]').forEach((r) => r.addEventListener("change", updateMode));

  function plan() {
    const m = mode();
    if (m === "parts") {
      const n = Math.min(total, Math.max(2, Number($("#splitParts").value) || 2));
      const size = Math.ceil(total / n);
      return Array.from({ length: n }, (_, i) => range(i * size, Math.min(total, (i + 1) * size))).filter((r) => r.length);
    }
    if (m === "every") {
      const size = Math.max(1, Number($("#splitEvery").value) || 1);
      return Array.from({ length: Math.ceil(total / size) }, (_, i) => range(i * size, Math.min(total, (i + 1) * size)));
    }
    if (m === "ranges") {
      return $("#splitRanges").value.split(/\n|;/).map((line) => line.trim()).filter(Boolean).map((line) => P.parseRanges(line, total)).filter((r) => r.length);
    }
    return null; // size mode is planned while building
  }

  function range(from, to) {
    return Array.from({ length: to - from }, (_, i) => from + i);
  }

  async function bySize(limitMb) {
    const limit = limitMb * 1024 * 1024;
    const parts = [];
    let start = 0;
    while (start < total) {
      // Grow a chunk page by page (doubling, then back off) until it would pass the limit.
      let end = start + 1;
      let step = 1;
      let lastGood = start + 1;
      while (end <= total) {
        const size = (await P.copyPages(doc, range(start, end))).length;
        P.status($("#splitStatus"), `Measuring part ${parts.length + 1}: pages ${start + 1}–${end}…`);
        if (size > limit) break;
        lastGood = end;
        step *= 2;
        end = Math.min(total, lastGood + step);
        if (lastGood === total) break;
      }
      let lo = lastGood;
      let hi = Math.min(total, end);
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if ((await P.copyPages(doc, range(start, mid))).length > limit) hi = mid; else lo = mid;
      }
      parts.push(range(start, Math.max(lo, start + 1)));
      start = Math.max(lo, start + 1);
    }
    return parts;
  }

  $("#splitRun").addEventListener("click", async () => {
    if (!doc) return;
    const btn = $("#splitRun");
    btn.disabled = true;
    $("#splitResults").innerHTML = "";
    try {
      const parts = mode() === "size" ? await bySize(Number($("#splitSize").value) || 190) : plan();
      if (!parts?.length) throw new Error("Nothing to split. Check the pages you typed.");
      const name = P.baseName(file.name);
      const outputs = [];
      for (let i = 0; i < parts.length; i += 1) {
        P.status($("#splitStatus"), `Building part ${i + 1} of ${parts.length}…`);
        P.progress($("#splitBar"), i, parts.length);
        const out = await P.copyPages(doc, parts[i]);
        const pages = parts[i];
        outputs.push({ name: `${name} (part ${i + 1} of ${parts.length}, pages ${pages[0] + 1}-${pages[pages.length - 1] + 1}).pdf`, data: out, pages: pages.length });
      }
      P.progress($("#splitBar"), 1, 1);
      $("#splitResults").innerHTML = outputs.map((o, i) => `
        <div class="pdf-result"><span class="pdf-file-icon">PDF</span><span class="pdf-file-text"><span class="pdf-file-name">${NTTools.esc(o.name)}</span><span class="pdf-file-meta">${o.pages} page${o.pages === 1 ? "" : "s"} · ${P.fmtBytes(o.data.length)}</span></span>
        <button type="button" class="tool-btn" data-dl="${i}">Download</button></div>`).join("") +
        `<div class="pdf-run"><button type="button" class="tool-btn is-primary" id="splitZip">Download all (.zip)</button></div>`;
      $("#splitResults").onclick = (event) => {
        const dl = event.target.closest("[data-dl]");
        if (dl) P.saveBlob(P.pdfBlob(outputs[Number(dl.dataset.dl)].data), outputs[Number(dl.dataset.dl)].name);
        if (event.target.closest("#splitZip")) P.saveBlob(P.zip(outputs), `${name} (split).zip`);
      };
      P.status($("#splitStatus"), `Split into ${outputs.length} parts. Add each one to your notebook as its own source.`, "ok");
    } catch (error) {
      P.status($("#splitStatus"), error.message || "Split failed.", "error");
    }
    btn.disabled = false;
  });
})();
