/* PDF to text / Markdown. Reads the text layer with pdf.js; pages with no
   text (scans) can be read with OCR. Runs in the browser. */
(() => {
  const P = NTPdf;
  const $ = (s) => document.querySelector(s);
  let file = null;
  let bytes = null;
  let result = "";

  P.dropZone($("#ptDrop"), { label: "Drop a PDF to get its text" }, async ([f]) => {
    file = f;
    bytes = await P.bytesOf(f);
    $("#ptFile").hidden = false;
    $("#ptFile").innerHTML = `<span class="pdf-file-icon">PDF</span><span class="pdf-file-text"><span class="pdf-file-name">${NTTools.esc(f.name)}</span><span class="pdf-file-meta">${P.fmtBytes(f.size)}</span></span>`;
    $("#ptOptions").hidden = false;
    void run();
  });

  ["#ptFormat", "#ptMarkers", "#ptOcr", "#ptJoin"].forEach((id) => $(id).addEventListener("change", () => file && run()));

  // Join lines that wrap mid-sentence (PDF line breaks), keep paragraph breaks.
  function unwrap(text) {
    return text
      .replace(/([^\n])\n(?!\n)(?=[a-z0-9(“"'])/g, "$1 ")
      .replace(/-\s+\n?([a-z])/g, "$1")
      .replace(/ {2,}/g, " ");
  }

  function toMarkdown(text) {
    return text
      .split(/\n{2,}/)
      .map((para) => {
        const line = para.trim();
        if (/^[•●▪◦·\-–]\s+/.test(line)) return line.split("\n").map((l) => l.replace(/^[•●▪◦·\-–]\s+/, "- ")).join("\n");
        if (line.length < 80 && !/[.:;,]$/.test(line) && /^[A-Z0-9]/.test(line) && line.split(/\s+/).length <= 10 && !line.includes("\n")) return `## ${line}`;
        return line;
      })
      .join("\n\n");
  }

  async function run() {
    const session = file;
    $("#ptRun").hidden = true;
    try {
      const pdf = await P.openPdfjs(bytes);
      const md = $("#ptFormat").value === "md";
      const parts = [];
      let scanned = 0;
      for (let i = 1; i <= pdf.numPages; i += 1) {
        if (file !== session) return;
        P.status($("#ptStatus"), `Reading page ${i} of ${pdf.numPages}…`);
        P.progress($("#ptBar"), i - 1, pdf.numPages);
        let text = await P.pageText(pdf, i);
        if (text.replace(/\s/g, "").length < 20) {
          scanned += 1;
          if ($("#ptOcr").checked) {
            const canvas = await P.renderPage(pdf, i, 2);
            text = await P.ocr(canvas, (m) => m.status === "recognizing text" && P.status($("#ptStatus"), `Reading scanned page ${i} with OCR… ${Math.round(m.progress * 100)}%`));
          }
        }
        if ($("#ptJoin").checked) text = unwrap(text);
        if (md) text = toMarkdown(text);
        parts.push($("#ptMarkers").checked ? `${md ? `<!-- Page ${i} -->` : `--- Page ${i} ---`}\n\n${text}` : text);
      }
      P.progress($("#ptBar"), 1, 1);
      const title = P.baseName(file.name);
      result = `${md ? `# ${title}\n\n` : ""}${parts.join("\n\n")}`.trim() + "\n";
      $("#ptOutput").value = result;
      const n = P.words(result);
      const note = scanned && !$("#ptOcr").checked ? ` ${scanned} page${scanned === 1 ? "" : "s"} had no text layer (scanned). Turn on OCR to read them.` : "";
      P.status($("#ptStatus"), `${NTTools.fmt(n)} words from ${pdf.numPages} pages.${n > P.LIMITS.words ? " That's over NotebookLM's 500,000 words per source; use the Text Splitter." : ""}${note}`, n > P.LIMITS.words || note ? "" : "ok");
      $("#ptCopy").disabled = $("#ptDownload").disabled = false;
    } catch (error) {
      P.status($("#ptStatus"), "That file couldn't be read as a PDF.", "error");
    }
  }

  $("#ptCopy").addEventListener("click", (e) => NTTools.copy(result, e.currentTarget));
  $("#ptDownload").addEventListener("click", () => NTTools.download(`${P.baseName(file.name)}.${$("#ptFormat").value === "md" ? "md" : "txt"}`, result, $("#ptFormat").value === "md" ? "text/markdown" : "text/plain"));
})();
