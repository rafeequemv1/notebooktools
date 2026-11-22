/* Extract or remove pages: click page thumbnails (or type ranges), then keep
   only those pages or delete them. */
(() => {
  const P = NTPdf;
  const $ = (s) => document.querySelector(s);
  let file = null;
  let bytes = null;
  let total = 0;
  let picked = new Set();

  P.dropZone($("#pagesDrop"), { label: "Drop a PDF to pick pages", sample: "book" }, async ([f]) => {
    file = f;
    picked = new Set();
    $("#pagesThumbs").innerHTML = "";
    P.status($("#pagesStatus"), "Reading pages…");
    try {
      bytes = await P.bytesOf(f);
      const pdf = await P.openPdfjs(bytes);
      total = pdf.numPages;
      $("#pagesFile").hidden = false;
      $("#pagesFile").innerHTML = `<span class="pdf-file-icon">PDF</span><span class="pdf-file-text"><span class="pdf-file-name">${NTTools.esc(f.name)}</span><span class="pdf-file-meta">${total} pages · ${P.fmtBytes(f.size)}</span></span>`;
      $("#pagesOptions").hidden = false;
      const grid = $("#pagesThumbs");
      for (let i = 1; i <= total; i += 1) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pdf-thumb";
        btn.dataset.page = String(i - 1);
        btn.innerHTML = `<span>Page ${i}</span>`;
        grid.append(btn);
      }
      sync();
      // Render thumbnails lazily, a few at a time.
      for (let i = 1; i <= Math.min(total, 400); i += 1) {
        if (file !== f) return;
        const canvas = await P.renderPage(pdf, i, 0.25);
        grid.children[i - 1]?.prepend(canvas);
        if (i % 8 === 0) P.status($("#pagesStatus"), `Loading thumbnails… ${i} of ${total}`);
      }
      P.status($("#pagesStatus"), "Click pages to pick them, or type page ranges.");
    } catch (_error) {
      P.status($("#pagesStatus"), "That file couldn't be opened as a PDF.", "error");
    }
  });

  function sync() {
    const keep = document.querySelector('input[name="pagesMode"]:checked').value === "keep";
    [...$("#pagesThumbs").children].forEach((el) => {
      const on = picked.has(Number(el.dataset.page));
      el.classList.toggle("is-on", on);
      el.classList.toggle("is-off", !keep && on);
    });
    $("#pagesRun").textContent = keep ? `Extract ${picked.size || ""} page${picked.size === 1 ? "" : "s"}`.replace("  ", " ") : `Remove ${picked.size || ""} page${picked.size === 1 ? "" : "s"}`.replace("  ", " ");
    $("#pagesRun").disabled = !picked.size || (!keep && picked.size >= total);
    $("#pagesCount").textContent = picked.size ? `${picked.size} of ${total} picked` : "";
  }

  $("#pagesThumbs").addEventListener("click", (event) => {
    const el = event.target.closest(".pdf-thumb");
    if (!el) return;
    const n = Number(el.dataset.page);
    picked.has(n) ? picked.delete(n) : picked.add(n);
    $("#pagesRanges").value = compact([...picked].sort((a, b) => a - b));
    sync();
  });

  function compact(list) {
    const out = [];
    for (let i = 0; i < list.length; i += 1) {
      let j = i;
      while (list[j + 1] === list[j] + 1) j += 1;
      out.push(j > i ? `${list[i] + 1}-${list[j] + 1}` : `${list[i] + 1}`);
      i = j;
    }
    return out.join(", ");
  }

  $("#pagesRanges").addEventListener("input", () => {
    try {
      picked = new Set(P.parseRanges($("#pagesRanges").value, total));
      P.status($("#pagesStatus"), "");
    } catch (error) {
      P.status($("#pagesStatus"), error.message, "error");
    }
    sync();
  });
  document.querySelectorAll('input[name="pagesMode"]').forEach((r) => r.addEventListener("change", sync));
  $("#pagesAll").addEventListener("click", () => { picked = new Set(Array.from({ length: total }, (_, i) => i)); $("#pagesRanges").value = compact([...picked]); sync(); });
  $("#pagesNone").addEventListener("click", () => { picked = new Set(); $("#pagesRanges").value = ""; sync(); });

  $("#pagesRun").addEventListener("click", async () => {
    const keep = document.querySelector('input[name="pagesMode"]:checked').value === "keep";
    const indices = keep
      ? [...picked].sort((a, b) => a - b)
      : Array.from({ length: total }, (_, i) => i).filter((i) => !picked.has(i));
    try {
      const doc = await P.openPdfLib(bytes);
      const out = await P.copyPages(doc, indices);
      const name = `${P.baseName(file.name)} (${keep ? "pages" : "without pages"} ${compact([...picked].sort((a, b) => a - b))}).pdf`.slice(0, 180);
      P.saveBlob(P.pdfBlob(out), name);
      P.status($("#pagesStatus"), `Saved ${indices.length} page${indices.length === 1 ? "" : "s"} (${P.fmtBytes(out.length)}).`, "ok");
    } catch (error) {
      P.status($("#pagesStatus"), error.message || "Could not save the pages.", "error");
    }
  });
})();
