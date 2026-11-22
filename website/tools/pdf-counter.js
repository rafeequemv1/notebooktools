/* PDF page & word counter: will this fit in NotebookLM? Several files at once. */
(() => {
  const P = NTPdf;
  const $ = (s) => document.querySelector(s);
  let rows = [];

  P.dropZone($("#pcDrop"), { label: "Drop PDFs to check", multiple: true }, async (files) => {
    for (const f of files) {
      const row = { name: f.name, size: f.size, pages: 0, words: 0, scanned: 0, error: "" };
      rows.push(row);
      render();
      try {
        const pdf = await P.openPdfjs(await P.bytesOf(f));
        row.pages = pdf.numPages;
        for (let i = 1; i <= pdf.numPages; i += 1) {
          const text = await P.pageText(pdf, i);
          const w = P.words(text);
          row.words += w;
          if (w < 5) row.scanned += 1;
          if (i % 10 === 0) { P.status($("#pcStatus"), `Counting “${f.name}”: page ${i} of ${pdf.numPages}…`); render(); }
        }
      } catch (_error) {
        row.error = "Couldn't open this PDF";
      }
      render();
    }
    P.status($("#pcStatus"), "");
  });

  function meter(label, value, max, fmtValue, fmtMax) {
    const pct = Math.min(100, (value / max) * 100);
    return `<div class="pdf-meter-card${value > max ? " is-over" : ""}"><b>${fmtValue}</b><span>${label} · limit ${fmtMax}</span><i><em style="width:${pct}%"></em></i></div>`;
  }

  function render() {
    const words = rows.reduce((s, r) => s + r.words, 0);
    const pages = rows.reduce((s, r) => s + r.pages, 0);
    const size = rows.reduce((s, r) => s + r.size, 0);
    const biggest = rows.reduce((m, r) => (r.words > m.words ? r : m), { words: 0, size: 0 });
    const tooBig = rows.filter((r) => r.words > P.LIMITS.words || r.size > P.LIMITS.bytes);
    $("#pcResult").hidden = !rows.length;
    $("#pcMeters").innerHTML =
      meter("words in the largest file", biggest.words, P.LIMITS.words, NTTools.fmt(biggest.words), "500,000") +
      meter("size of the largest file", Math.max(...rows.map((r) => r.size), 0), P.LIMITS.bytes, P.fmtBytes(Math.max(...rows.map((r) => r.size), 0)), "200 MB") +
      meter("files = sources", rows.length, P.LIMITS.sources, String(rows.length), "50 (free plan)") +
      `<div class="pdf-meter-card"><b>${NTTools.fmt(pages)}</b><span>pages · ${NTTools.fmt(words)} words in total · ${P.fmtBytes(size)}</span></div>`;
    const scanned = rows.filter((r) => r.pages && r.scanned / r.pages > 0.5);
    const verdict = tooBig.length
      ? `<p class="pdf-verdict is-over"><strong>${tooBig.length} file${tooBig.length === 1 ? " is" : "s are"} over NotebookLM's per-source limit</strong> (500,000 words or 200 MB). Split ${tooBig.length === 1 ? "it" : "them"} with the <a href="/tools/split-pdf-for-notebooklm">PDF splitter</a> first.</p>`
      : rows.length > P.LIMITS.sources
        ? `<p class="pdf-verdict is-over"><strong>Each file fits, but ${rows.length} files is more than 50 sources.</strong> Use two notebooks on the free plan, or <a href="/tools/merge-pdf">merge</a> related PDFs.</p>`
        : rows.length ? `<p class="pdf-verdict is-ok"><strong>Everything fits.</strong> ${rows.length} source${rows.length === 1 ? "" : "s"} of ${P.LIMITS.sources} on the free plan.</p>` : "";
    $("#pcVerdict").innerHTML = verdict + (scanned.length ? `<p class="pdf-verdict">${scanned.length} file${scanned.length === 1 ? " looks" : "s look"} scanned (little or no text). NotebookLM reads scans, but results are better with real text: try <a href="/tools/pdf-to-text">PDF to text</a> with OCR.</p>` : "");
    $("#pcList").innerHTML = rows.map((r) => `
      <div class="pdf-file"><span class="pdf-file-icon">PDF</span><span class="pdf-file-text"><span class="pdf-file-name">${NTTools.esc(r.name)}</span>
      <span class="pdf-file-meta">${r.error || `${NTTools.fmt(r.pages)} pages · ${NTTools.fmt(r.words)} words · ${P.fmtBytes(r.size)}${r.words > P.LIMITS.words || r.size > P.LIMITS.bytes ? " · over the limit" : ""}`}</span></span></div>`).join("");
  }

  $("#pcClear").addEventListener("click", () => { rows = []; render(); });
})();
