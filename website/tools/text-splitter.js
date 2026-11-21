/* Text splitter: cut a long text into parts that each fit one NotebookLM
   source, breaking at paragraph (or sentence) boundaries. */
(() => {
  const { $, esc, words, fmt, copy, download, readFile } = window.NTTools;
  const input = $("#tsInput");
  const title = $("#tsTitle");
  const size = $("#tsSize");
  const custom = $("#tsCustom");
  const partsEl = $("#tsParts");
  const stats = $("#tsStats");
  let parts = [];

  function limit() {
    if (size.value === "custom") return Math.max(1000, Number(custom.value) || 0);
    return Number(size.value);
  }

  // Split into paragraphs; a paragraph longer than the limit is cut at
  // sentence ends, and a sentence longer than the limit by words.
  function units(text, max) {
    const out = [];
    for (const para of text.split(/\n\s*\n/)) {
      const p = para.trim();
      if (!p) continue;
      if (words(p) <= max) {
        out.push(p);
        continue;
      }
      for (const sentence of p.match(/[^.!?]+[.!?]+["'”’)]*\s*|[^.!?]+$/g) || [p]) {
        const s = sentence.trim();
        if (words(s) <= max) {
          out.push(s);
          continue;
        }
        const w = s.split(/\s+/);
        for (let i = 0; i < w.length; i += max) out.push(w.slice(i, i + max).join(" "));
      }
    }
    return out;
  }

  function split() {
    const text = input.value;
    const max = limit();
    const total = words(text);
    parts = [];
    let current = [];
    let count = 0;
    for (const unit of units(text, max)) {
      const n = words(unit);
      if (count + n > max && current.length) {
        parts.push(current.join("\n\n"));
        current = [];
        count = 0;
      }
      current.push(unit);
      count += n;
    }
    if (current.length) parts.push(current.join("\n\n"));

    const bytes = new Blob([text]).size;
    stats.textContent = total ? `${fmt(total)} words · ${(bytes / 1048576).toFixed(2)} MB` : "";
    render(total, max);
  }

  function name(i) {
    const base = (title.value.trim() || "Text").replace(/[\\/:*?"<>|]+/g, " ").trim();
    return parts.length > 1 ? `${base} (part ${i + 1} of ${parts.length})` : base;
  }

  function render(total, max) {
    if (!total) {
      partsEl.innerHTML = `<p class="tool-empty">Paste text or open a .txt / .md file to see how it splits.</p>`;
      return;
    }
    const fits = parts.length === 1;
    partsEl.innerHTML = `
      <p class="tool-note${fits ? "" : " is-warn"}">${fits
        ? `Fits in one source (limit ${fmt(max)} words). NotebookLM takes up to 500,000 words or 200 MB per source.`
        : `Split into ${parts.length} parts of at most ${fmt(max)} words. Add each part as its own source.`}</p>
      ${parts.map((p, i) => `
        <div class="tool-part">
          <span class="tool-part-name">${esc(name(i))}<span class="tool-part-meta">${fmt(words(p))} words</span></span>
          <button type="button" class="tool-btn" data-copy="${i}">Copy</button>
          <button type="button" class="tool-btn" data-dl="${i}">Download</button>
        </div>`).join("")}
      ${parts.length > 1 ? `<div class="tool-actions"><button type="button" class="tool-btn is-primary" data-dl-all>Download all parts</button></div>` : ""}`;
  }

  partsEl.addEventListener("click", (event) => {
    const c = event.target.closest("[data-copy]");
    if (c) return copy(parts[Number(c.dataset.copy)], c);
    const d = event.target.closest("[data-dl]");
    if (d) return download(`${name(Number(d.dataset.dl))}.txt`, parts[Number(d.dataset.dl)]);
    if (event.target.closest("[data-dl-all]")) {
      parts.forEach((p, i) => setTimeout(() => download(`${name(i)}.txt`, p), i * 300));
    }
  });

  $("#tsFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    input.value = await readFile(file);
    if (!title.value.trim()) title.value = file.name.replace(/\.[^.]+$/, "");
    split();
  });
  size.addEventListener("change", () => {
    custom.hidden = size.value !== "custom";
    split();
  });
  [input, title, custom].forEach((el) => el.addEventListener("input", split));
  split();
})();
