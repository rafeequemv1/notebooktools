/* ==========================================================================
   Flashcards and quizzes out of NotebookLM: Anki, Quizlet, Kahoot, Wayground
   (Quizizz), Moodle, CSV, Markdown and print/PDF.
   NotebookLM keeps a flashcard deck or quiz as an interactive page whose data
   sits in a data-app-data attribute (flashcards: [{f, b}], quiz: [{question,
   answerOptions: [{text, isCorrect, rationale}], hint}]). This reads that data
   through the NotebookLM client and writes it in each tool's import format.
   Works on the NotebookLM page (ribbon → Export) and in the notebooks hub.
   Exposes window.NotebookToolsStudyExport = { open, listSets, readSet, formats, build }.
   ========================================================================== */
(function () {
  "use strict";

  if (window.NotebookToolsStudyExport) return;

  const client = () => window.NotebookToolsNotebookLM;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeName = (s) => String(s || "export").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "export";
  const oneLine = (s) => String(s ?? "").replace(/\s*\n+\s*/g, " ").replace(/\s+/g, " ").trim();

  /* ---------- Reading ---------- */
  function decodeEntities(s) {
    const t = document.createElement("textarea");
    t.innerHTML = s;
    return t.value;
  }

  /** The app data in a flashcard/quiz page: { kind, items } or null */
  function parseAppData(html) {
    const m = String(html || "").match(/data-app-data="([^"]+)"/);
    if (!m) return null;
    let data;
    try { data = JSON.parse(decodeEntities(m[1])); } catch (_e) { return null; }
    if (Array.isArray(data.flashcards) && data.flashcards.length) {
      return { kind: "flashcards", items: data.flashcards.map((c) => ({ front: String(c.f ?? c.front ?? "").trim(), back: String(c.b ?? c.back ?? "").trim() })).filter((c) => c.front || c.back) };
    }
    if (Array.isArray(data.quiz) && data.quiz.length) {
      return {
        kind: "quiz",
        items: data.quiz.map((q) => ({
          question: String(q.question ?? "").trim(),
          hint: String(q.hint ?? "").trim(),
          options: (q.answerOptions || []).map((o) => ({ text: String(o.text ?? "").trim(), correct: !!o.isCorrect, why: String(o.rationale ?? "").trim() }))
        })).filter((q) => q.question && q.options.length)
      };
    }
    return null;
  }

  /** Flashcard decks and quizzes in a notebook (Studio type 4), newest first */
  async function listSets(notebookId, authOptions) {
    const all = await client().listNotebookLmArtifacts(notebookId, authOptions);
    return all.filter((a) => a.typeCode === 4 && !/generating|failed/i.test(String(a.status || "")))
      .map((a) => ({ id: a.id, title: a.title || "Untitled", notebookId, createdAt: a.createdAt || 0 }));
  }

  async function readSet(set, authOptions) {
    const html = await client().getNotebookLmArtifactHtml(set.notebookId, set.id, authOptions);
    const parsed = parseAppData(html);
    if (!parsed || !parsed.items.length) throw new Error("Couldn't read the cards or questions in this set. Open it once in NotebookLM, then try again.");
    return { ...set, ...parsed };
  }

  /* ---------- Writing ---------- */
  const tsvCell = (s) => String(s ?? "").replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
  const csvCell = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const csv = (rows) => "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
  const LETTERS = "ABCDEFGH";

  function quizAnswer(q) {
    const right = q.options.filter((o) => o.correct);
    return right.map((o) => o.text).join(" / ");
  }

  // Minimal .xlsx (one sheet, text and numbers) for Kahoot and Wayground imports
  function xlsx(rows, sheetName = "Sheet1") {
    const x = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
    const col = (i) => { let s = ""; i += 1; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
    const sheetRows = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      if (v === null || v === undefined || v === "") return "";
      const ref = `${col(ci)}${ri + 1}`;
      return typeof v === "number" ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${x(v)}</t></is></c>`;
    }).join("")}</row>`).join("");
    const files = [
      { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
      { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${x(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
      { name: "xl/_rels/workbook.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
      { name: "xl/worksheets/sheet1.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>` }
    ];
    const zip = window.NotebookToolsNotebookExport?.buildZip;
    if (!zip) throw new Error("Spreadsheet export is still loading. Try again in a moment.");
    return new Blob([zip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  function printable(set, withAnswers) {
    const title = esc(set.title);
    let body = "";
    if (set.kind === "flashcards") {
      body = `<div class="cards">${set.items.map((c, i) => `<div class="card"><div class="side"><small>${i + 1} · Front</small><p>${esc(c.front)}</p></div><div class="side back"><small>${i + 1} · Back</small><p>${esc(c.back)}</p></div></div>`).join("")}</div>`;
    } else {
      body = `<ol class="quiz">${set.items.map((q) => `<li><p class="q">${esc(q.question)}</p><ol class="opts" type="A">${q.options.map((o) => `<li>${esc(o.text)}</li>`).join("")}</ol></li>`).join("")}</ol>`;
      if (withAnswers) body += `<section class="key"><h2>Answer key</h2><ol>${set.items.map((q) => { const i = q.options.findIndex((o) => o.correct); const o = q.options[i]; return `<li><b>${i >= 0 ? LETTERS[i] : "?"}</b> ${esc(o?.text || "")}${o?.why ? `<br><span>${esc(o.why)}</span>` : ""}</li>`; }).join("")}</ol></section>`;
    }
    return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
      body{font:14px/1.45 Arial,sans-serif;color:#1f1f1f;margin:28px}h1{font:600 22px Arial;margin:0 0 18px}
      .cards{display:grid;gap:12px;grid-template-columns:1fr 1fr}.card{break-inside:avoid;border:1px dashed #9aa0a6;border-radius:8px;display:grid;grid-template-rows:1fr 1fr}
      .side{min-height:90px;padding:12px}.side.back{background:#f6f8fc;border-top:1px dashed #9aa0a6}.side small{color:#5f6368}.side p{margin:6px 0 0}
      .quiz>li{break-inside:avoid;margin-bottom:14px}.q{font-weight:600;margin:0 0 6px}.opts li{margin:2px 0}
      .key{break-before:page}.key li{margin-bottom:8px}.key span{color:#5f6368}
      @media print{body{margin:12mm}}</style></head><body><h1>${title}</h1>${body}<script>setTimeout(()=>print(),300)<\/script></body></html>`;
  }

  /** Formats for a kind: { id, label, hint } */
  function formats(kind) {
    return kind === "flashcards"
      ? [
        { id: "anki", label: "Anki", hint: "Text file: File → Import in Anki" },
        { id: "quizlet", label: "Quizlet", hint: "Copied: paste into Quizlet's Import box" },
        { id: "csv", label: "CSV", hint: "Spreadsheets, Brainscape, RemNote and others" },
        { id: "markdown", label: "Markdown", hint: "Obsidian, Notion, Docs" },
        { id: "print", label: "Print or PDF", hint: "Fold-over cards to print" }
      ]
      : [
        { id: "kahoot", label: "Kahoot", hint: "Spreadsheet for Kahoot's Import" },
        { id: "wayground", label: "Wayground (Quizizz)", hint: "Spreadsheet for Wayground's Import" },
        { id: "gift", label: "Moodle", hint: "GIFT file: Question bank → Import" },
        { id: "anki", label: "Anki", hint: "Question on the front, answer and why on the back" },
        { id: "csv", label: "CSV", hint: "Question, options, answer, explanation" },
        { id: "print", label: "Print or PDF", hint: "Worksheet with an answer key" }
      ];
  }

  /** { blob, filename } or { text, copied } for one set and format; notes: warnings */
  function build(set, format) {
    const base = safeName(set.title);
    const notes = [];
    if (set.kind === "flashcards") {
      const cards = set.items;
      if (format === "anki") {
        const text = `#separator:tab\n#html:true\n#notetype:Basic\n#deck:${oneLine(set.title)}\n` + cards.map((c) => `${tsvCell(c.front)}\t${tsvCell(c.back)}`).join("\n") + "\n";
        return { blob: new Blob([text], { type: "text/plain" }), filename: `${base} (Anki).txt`, notes };
      }
      if (format === "quizlet") {
        return { text: cards.map((c) => `${oneLine(c.front)}\t${oneLine(c.back)}`).join("\n"), filename: `${base} (Quizlet).txt`, notes };
      }
      if (format === "csv") return { blob: new Blob([csv([["Front", "Back"], ...cards.map((c) => [c.front, c.back])])], { type: "text/csv" }), filename: `${base}.csv`, notes };
      if (format === "markdown") return { blob: new Blob([`# ${set.title}\n\n` + cards.map((c, i) => `## ${i + 1}. ${oneLine(c.front)}\n\n${c.back}\n`).join("\n")], { type: "text/markdown" }), filename: `${base}.md`, notes };
      if (format === "print") return { html: printable(set, false), notes };
    } else {
      const qs = set.items;
      if (format === "kahoot") {
        // Kahoot's template: up to 4 answers (75 characters), question up to 120, answer numbers in "Correct answer(s)"
        let cut = 0, dropped = 0;
        const head = [
          ["Quiz template"], ["Add questions, at least two answer alternatives, time limit and choose correct answers (at least one). Have fun creating your awesome quiz!"], ["Remember: questions have a limit of 120 characters and answers can have 75 characters max. Text will turn red in Excel or Google Docs if you exceed this limit. If several answers are correct, separate them with a comma."], ["See an example question below (don't forget to overwrite this with your first question!)"], ["And remember,  if you're not using Excel you need to export to .xlsx format before you upload to Kahoot!"], [], [],
          ["", "Question - max 120 characters", "Answer 1 - max 75 characters", "Answer 2 - max 75 characters", "Answer 3 - max 75 characters", "Answer 4 - max 75 characters", "Time limit (sec) – 5, 10, 20, 30, 60, 90, 120, or 240 secs", "Correct answer(s) - choose at least one"]
        ];
        const rows = qs.map((q, i) => {
          let opts = q.options;
          if (opts.length > 4) { const keep = [...opts.filter((o) => o.correct), ...opts.filter((o) => !o.correct)].slice(0, 4); opts = q.options.filter((o) => keep.includes(o)); dropped += 1; }
          const clip = (s, n) => { const t = oneLine(s); if (t.length > n) { cut += 1; return t.slice(0, n - 1) + "…"; } return t; };
          const correct = opts.map((o, k) => (o.correct ? k + 1 : null)).filter(Boolean).join(",");
          return [i + 1, clip(q.question, 120), ...[0, 1, 2, 3].map((k) => (opts[k] ? clip(opts[k].text, 75) : "")), 30, /^\d+$/.test(correct) ? Number(correct) : correct];
        });
        if (cut) notes.push(`${cut} question or answer text${cut === 1 ? " was" : "s were"} shortened to fit Kahoot's limits.`);
        if (dropped) notes.push(`${dropped} question${dropped === 1 ? " had" : "s had"} more than 4 answers; the extra wrong answers were left out.`);
        return { blob: xlsx([...head, ...rows], "Sheet1"), filename: `${base} (Kahoot).xlsx`, notes };
      }
      if (format === "wayground") {
        const rows = [["Question Text", "Question Type", "Option 1", "Option 2", "Option 3", "Option 4", "Option 5", "Correct Answer", "Time in seconds", "Image Link", "Answer explanation"]];
        qs.forEach((q) => {
          const opts = q.options.slice(0, 5);
          const right = opts.map((o, k) => (o.correct ? k + 1 : null)).filter(Boolean);
          rows.push([oneLine(q.question), right.length > 1 ? "Checkbox" : "Multiple Choice", ...[0, 1, 2, 3, 4].map((k) => (opts[k] ? oneLine(opts[k].text) : "")), right.length === 1 ? right[0] : right.join(","), 30, "", oneLine(opts.find((o) => o.correct)?.why || "")]);
        });
        return { blob: xlsx(rows, "Sheet1"), filename: `${base} (Wayground).xlsx`, notes };
      }
      if (format === "gift") {
        const g = (s) => oneLine(s).replace(/([~=#{}:\\])/g, "\\$1");
        const text = qs.map((q, i) => `::Q${i + 1}:: ${g(q.question)} {\n${q.options.map((o) => `  ${o.correct ? "=" : "~"}${g(o.text)}${o.why ? ` #${g(o.why)}` : ""}`).join("\n")}\n}`).join("\n\n") + "\n";
        return { blob: new Blob([`// ${oneLine(set.title)}\n\n` + text], { type: "text/plain" }), filename: `${base} (Moodle GIFT).txt`, notes };
      }
      if (format === "anki") {
        const text = `#separator:tab\n#html:true\n#notetype:Basic\n#deck:${oneLine(set.title)}\n` + qs.map((q) => {
          const front = `${tsvCell(q.question)}<br><br>${q.options.map((o, k) => `${LETTERS[k]}. ${tsvCell(o.text)}`).join("<br>")}`;
          const right = q.options.map((o, k) => (o.correct ? `<b>${LETTERS[k]}. ${tsvCell(o.text)}</b>${o.why ? `<br>${tsvCell(o.why)}` : ""}` : null)).filter(Boolean).join("<br>");
          return `${front}\t${right}`;
        }).join("\n") + "\n";
        return { blob: new Blob([text], { type: "text/plain" }), filename: `${base} (Anki).txt`, notes };
      }
      if (format === "csv") {
        const n = Math.max(...qs.map((q) => q.options.length));
        const head = ["Question", ...Array.from({ length: n }, (_, k) => `Option ${LETTERS[k]}`), "Correct answer", "Explanation", "Hint"];
        const rows = qs.map((q) => [q.question, ...Array.from({ length: n }, (_, k) => q.options[k]?.text || ""), quizAnswer(q), q.options.find((o) => o.correct)?.why || "", q.hint]);
        return { blob: new Blob([csv([head, ...rows])], { type: "text/csv" }), filename: `${base}.csv`, notes };
      }
      if (format === "print") return { html: printable(set, true), notes };
    }
    throw new Error("That format isn't available for this set.");
  }

  function save(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /** Runs one export; returns a short message for the person */
  async function run(set, format) {
    const out = build(set, format);
    if (out.html) {
      const w = window.open("", "_blank");
      if (!w) throw new Error("Allow pop-ups for this page to print.");
      w.document.write(out.html);
      w.document.close();
      return "Print view opened. Choose Save as PDF to keep a file.";
    }
    if (out.text !== undefined) {
      try { await navigator.clipboard.writeText(out.text); } catch (_e) { save(new Blob([out.text], { type: "text/plain" }), out.filename); return "Saved a Quizlet text file. In Quizlet: Create → Import, paste it in."; }
      return "Copied for Quizlet. In Quizlet: Create → Import, paste, and keep Tab between term and definition.";
    }
    save(out.blob, out.filename);
    const tips = {
      anki: "In Anki: File → Import, choose the file. Fields are set up for you.",
      kahoot: "In Kahoot: create a kahoot → Add question → Import spreadsheet.",
      wayground: "In Wayground: create a quiz → Import from spreadsheet.",
      gift: "In Moodle: Question bank → Import → GIFT format.",
      csv: "Saved as CSV.",
      markdown: "Saved as Markdown."
    };
    return [`Saved ${out.filename}.`, tips[format] || "", ...(out.notes || [])].filter(Boolean).join(" ");
  }

  /* ---------- Dialog ---------- */
  let root = null;
  const state = { notebookId: "", notebookTitle: "", auth: undefined, sets: [], loading: false, error: "", selected: null, set: null, reading: false, message: "", dark: false, read: new Map() };

  function isDarkPage() {
    for (const node of [document.body, document.documentElement]) {
      const m = node && getComputedStyle(node).backgroundColor.match(/[\d.]+/g);
      if (!m) continue;
      const [r, g, b, a = 1] = m.map(Number);
      if (Number(a) === 0) continue;
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
    }
    return false;
  }

  function render() {
    if (!root) return;
    root.classList.toggle("is-dark", state.dark);
    const list = state.loading
      ? `<p class="nse-muted">Looking for flashcards and quizzes in this notebook…</p>`
      : state.error
        ? `<p class="nse-warn">${esc(state.error)}</p>`
        : state.sets.length
          ? `<div class="nse-sets">${state.sets.map((s) => { const r = state.read.get(s.id); return `<button type="button" class="nse-set${state.selected === s.id ? " is-on" : ""}" data-set="${esc(s.id)}"><span class="nse-set-ic">${r ? (r.kind === "quiz" ? "?" : "▤") : "•"}</span><span class="nse-set-t">${esc(s.title)}</span>${r ? `<span class="nse-set-n">${r.items.length} ${r.kind === "quiz" ? "questions" : "cards"}</span>` : ""}</button>`; }).join("")}</div>`
          : `<p class="nse-muted">No flashcards or quizzes in this notebook yet. Make them in NotebookLM's Studio panel, then come back.</p>`;
    const fmts = state.set
      ? `<p class="nse-label">Export ${state.set.kind === "quiz" ? "this quiz" : "these flashcards"} to</p><div class="nse-formats">${formats(state.set.kind).map((f) => `<button type="button" class="nse-format" data-format="${f.id}"><b>${esc(f.label)}</b><span>${esc(f.hint)}</span></button>`).join("")}</div>`
      : state.reading ? `<p class="nse-muted">Reading the set…</p>` : state.sets.length ? `<p class="nse-muted">Choose a set above.</p>` : "";
    root.innerHTML = `
      <div class="nse-backdrop" data-close></div>
      <section class="nse-dialog" role="dialog" aria-modal="true" aria-label="Export flashcards and quizzes">
        <header class="nse-head"><div><h2>Flashcards &amp; quizzes</h2><p>${esc(state.notebookTitle || "This notebook")}</p></div><button type="button" class="nse-x" data-close aria-label="Close">×</button></header>
        <div class="nse-body">${list}${fmts}<p class="nse-note${/couldn|allow|isn't|failed/i.test(state.message) ? " is-warn" : ""}">${esc(state.message)}</p></div>
      </section>`;
  }

  async function choose(id) {
    const set = state.sets.find((s) => s.id === id);
    if (!set) return;
    state.selected = id;
    state.set = null;
    state.reading = true;
    state.message = "";
    render();
    try {
      state.set = state.read.get(id) || await readSet(set, state.auth);
      state.read.set(id, state.set);
    } catch (error) {
      state.message = error.message || "Couldn't read this set.";
    }
    state.reading = false;
    render();
  }

  async function onClick(event) {
    if (event.target.closest("[data-close]")) return close();
    const s = event.target.closest("[data-set]");
    if (s) return void choose(s.dataset.set);
    const f = event.target.closest("[data-format]");
    if (f && state.set) {
      try {
        state.message = await run(state.set, f.dataset.format);
      } catch (error) {
        state.message = error.message || "Export failed.";
      }
      render();
    }
  }

  function onKey(event) {
    if (event.key === "Escape") close();
  }

  /** open({ notebookId, notebookTitle, authOptions }) */
  async function open(opts = {}) {
    if (!client()) throw new Error("NotebookLM tools are still loading. Try again in a moment.");
    Object.assign(state, { notebookId: opts.notebookId, notebookTitle: opts.notebookTitle || "", auth: opts.authOptions, sets: [], loading: true, error: "", selected: null, set: null, reading: false, message: "", dark: isDarkPage(), read: new Map() });
    if (!root) {
      root = document.createElement("div");
      root.className = "nse";
      root.addEventListener("click", onClick);
      document.addEventListener("keydown", onKey, true);
      document.body.append(root);
    }
    root.hidden = false;
    document.dispatchEvent(new CustomEvent("notebooktools-dropdown-open", { detail: "study-export" }));
    render();
    try {
      state.sets = await listSets(state.notebookId, state.auth);
    } catch (error) {
      state.error = error.message || "Couldn't list this notebook's Studio files.";
    }
    state.loading = false;
    render();
    const pick = opts.select && state.sets.find((x) => x.id === opts.select);
    if (pick || state.sets.length === 1) void choose((pick || state.sets[0]).id);
  }

  function close() {
    if (root) root.hidden = true;
  }

  window.NotebookToolsStudyExport = { open, close, listSets, readSet, parseAppData, formats, build };
})();
