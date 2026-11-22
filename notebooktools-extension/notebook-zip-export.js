/* ==========================================================================
   Whole-notebook export: every source's text and every note of one or many
   notebooks, as Markdown or plain text files in a single ZIP. Works anywhere
   the NotebookLM client is loaded (notebooks page, NotebookLM page).
   Exposes window.NotebookToolsNotebookExport.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- Tiny ZIP writer (stored, no compression) ---------- */
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, day };
  }

  // files: [{ name, data: string | Uint8Array }] → Blob
  function buildZip(files) {
    const encoder = new TextEncoder();
    const { time, day } = dosDateTime();
    const chunks = [];
    const central = [];
    let offset = 0;

    for (const file of files) {
      const name = encoder.encode(file.name);
      const data = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
      const crc = crc32(data);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // UTF-8 names
      local.setUint16(8, 0, true); // stored
      local.setUint16(10, time, true);
      local.setUint16(12, day, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      chunks.push(new Uint8Array(local.buffer), name, data);

      const entry = new DataView(new ArrayBuffer(46));
      entry.setUint32(0, 0x02014b50, true);
      entry.setUint16(4, 20, true);
      entry.setUint16(6, 20, true);
      entry.setUint16(8, 0x0800, true);
      entry.setUint16(10, 0, true);
      entry.setUint16(12, time, true);
      entry.setUint16(14, day, true);
      entry.setUint32(16, crc, true);
      entry.setUint32(20, data.length, true);
      entry.setUint32(24, data.length, true);
      entry.setUint16(28, name.length, true);
      entry.setUint32(42, offset, true);
      central.push(new Uint8Array(entry.buffer), name);

      offset += 30 + name.length + data.length;
    }

    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);

    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
  }

  /* ---------- Content ---------- */
  function safeName(value, fallback = "untitled") {
    const cleaned = String(value || "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80)
      .replace(/[. ]+$/, "");
    return cleaned || fallback;
  }

  function uniqueName(name, used) {
    let candidate = name;
    let n = 2;
    while (used.has(candidate.toLowerCase())) candidate = `${name} (${n++})`;
    used.add(candidate.toLowerCase());
    return candidate;
  }

  function stripMarkdown(text) {
    return String(text || "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  }

  function sourceDoc(source, content, format) {
    const lines = [];
    if (format === "md") {
      lines.push(`# ${source.title || "Untitled source"}`, "");
      const meta = [`Type: ${source.type || "Other"}`];
      if (source.url) meta.push(`Link: ${source.url}`);
      lines.push(meta.map((m) => `- ${m}`).join("\n"), "", content || "_No text could be extracted from this source._");
    } else {
      lines.push(source.title || "Untitled source", "=".repeat(Math.min(60, (source.title || "Untitled source").length)), "");
      lines.push(`Type: ${source.type || "Other"}`);
      if (source.url) lines.push(`Link: ${source.url}`);
      lines.push("", stripMarkdown(content) || "(No text could be extracted from this source.)");
    }
    return `${lines.join("\n")}\n`;
  }

  function noteDoc(note, format) {
    return format === "md"
      ? `# ${note.title || "Untitled note"}\n\n${note.body || ""}\n`
      : `${note.title || "Untitled note"}\n${"=".repeat(Math.min(60, (note.title || "Untitled note").length))}\n\n${stripMarkdown(note.body)}\n`;
  }

  /**
   * Export notebooks to a ZIP.
   * notebooks: [{ id, title }]
   * options: { format: "md" | "txt", authOptions, onProgress(message, done, total) }
   * Returns { blob, filename, sources, notes, failed }.
   */
  async function exportNotebooks(notebooks, options = {}) {
    const client = window.NotebookToolsNotebookLM;
    if (!client) throw new Error("NotebookLM client is not loaded.");
    const format = options.format === "txt" ? "txt" : "md";
    const ext = format === "md" ? "md" : "txt";
    const auth = options.authOptions || {};
    const progress = options.onProgress || (() => {});
    const files = [];
    const usedFolders = new Set();
    const totals = { sources: 0, notes: 0, failed: 0 };
    const multi = notebooks.length > 1;

    for (let n = 0; n < notebooks.length; n += 1) {
      const notebook = notebooks[n];
      const label = notebook.title || "Untitled notebook";
      const folder = multi ? `${uniqueName(safeName(label, "notebook"), usedFolders)}/` : "";
      const used = new Set();
      progress(`Reading “${label}”…`, n, notebooks.length);

      const sources = await client.listNotebookLmSources(notebook.id, auth).catch(() => []);
      const notes = client.listNotebookLmNotes
        ? await client.listNotebookLmNotes(notebook.id, auth).catch(() => [])
        : [];
      const index = [];

      for (let i = 0; i < sources.length; i += 1) {
        const source = sources[i];
        progress(`“${label}”: source ${i + 1} of ${sources.length}`, n, notebooks.length);
        let content = "";
        try {
          content = (await client.getNotebookLmSourceContent(notebook.id, source.id, auth)).content || "";
        } catch (_error) {
          totals.failed += 1;
        }
        const file = `${String(i + 1).padStart(2, "0")} ${uniqueName(safeName(source.title, "source"), used)}.${ext}`;
        let doc = sourceDoc(source, content, format);
        const mine = window.NotebookToolsSourceNotes ? await window.NotebookToolsSourceNotes.get(notebook.id, source.id) : null;
        if (mine && (mine.note?.trim() || mine.highlights?.length)) {
          const extra = window.NotebookToolsSourceNotes.markdown(mine);
          doc += `\n---\n\n${format === "md" ? extra : stripMarkdown(extra)}`;
        }
        files.push({ name: `${folder}sources/${file}`, data: doc });
        index.push({ kind: "source", title: source.title, file: `sources/${file}`, type: source.type, url: source.url });
        totals.sources += 1;
      }

      const usedNotes = new Set();
      for (const note of notes) {
        const file = `${uniqueName(safeName(note.title, "note"), usedNotes)}.${ext}`;
        files.push({ name: `${folder}notes/${file}`, data: noteDoc(note, format) });
        index.push({ kind: "note", title: note.title, file: `notes/${file}` });
        totals.notes += 1;
      }

      const srcRows = index.filter((r) => r.kind === "source");
      const noteRows = index.filter((r) => r.kind === "note");
      const readme = format === "md"
        ? [
            `# ${label}`,
            "",
            `Exported from NotebookLM with NotebookTools on ${new Date().toLocaleString()}.`,
            "",
            `## Sources (${srcRows.length})`,
            "",
            ...(srcRows.length ? srcRows.map((r) => `- [${r.title || "Untitled"}](${encodeURI(r.file)}) · ${r.type || "Other"}${r.url ? ` · ${r.url}` : ""}`) : ["_None_"]),
            "",
            `## Notes (${noteRows.length})`,
            "",
            ...(noteRows.length ? noteRows.map((r) => `- [${r.title || "Untitled"}](${encodeURI(r.file)})`) : ["_None_"]),
            ""
          ].join("\n")
        : [
            label,
            `Exported from NotebookLM with NotebookTools on ${new Date().toLocaleString()}.`,
            "",
            `Sources (${srcRows.length}):`,
            ...srcRows.map((r) => `  - ${r.title || "Untitled"} [${r.file}]${r.url ? ` ${r.url}` : ""}`),
            "",
            `Notes (${noteRows.length}):`,
            ...noteRows.map((r) => `  - ${r.title || "Untitled"} [${r.file}]`),
            ""
          ].join("\n");
      files.push({ name: `${folder}${format === "md" ? "README.md" : "README.txt"}`, data: readme });
    }

    progress("Building ZIP…", notebooks.length, notebooks.length);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = multi
      ? `notebooktools-export-${notebooks.length}-notebooks-${stamp}.zip`
      : `${safeName(notebooks[0]?.title, "notebook")} (${stamp}).zip`;
    return { blob: buildZip(files), filename, ...totals };
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }


  /* ---------- Dialog: pick format, show progress, download ---------- */
  const STYLE_ID = "ntz-style";
  const CSS = `
  .ntz-backdrop{--b:#fff;--p:#f3f6fb;--l:rgba(31,31,31,.1);--i:#1f1f1f;--m:#5f6368;--h:rgba(11,87,208,.07);--a:#0b57d0;--oa:#fff;
    align-items:center;background:rgba(15,20,30,.36);display:flex;font-family:"Google Sans Text","Google Sans",Roboto,Arial,sans-serif;inset:0;justify-content:center;padding:24px;position:fixed;z-index:2147483646}
  .ntz-backdrop.is-dark{--b:#232427;--p:#2c2d31;--l:rgba(255,255,255,.1);--i:#e8eaed;--m:#9aa0a6;--h:rgba(138,180,248,.1);--a:#a8c7fa;--oa:#062e6f;background:rgba(0,0,0,.55)}
  .ntz-backdrop *{box-sizing:border-box;font-family:inherit}
  .ntz-card{background:var(--b);border:1px solid var(--l);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.3);color:var(--i);padding:20px;width:min(440px,100%)}
  .ntz-card h2{font-size:18px;font-weight:500;margin:0}
  .ntz-sub{color:var(--m);font-size:13px;line-height:1.45;margin:4px 0 16px}
  .ntz-label{color:var(--m);font-size:11px;font-weight:500;letter-spacing:.06em;margin:0 0 8px;text-transform:uppercase}
  .ntz-opts{display:grid;gap:6px;margin-bottom:16px}
  .ntz-opt{align-items:flex-start;background:var(--p);border:1px solid transparent;border-radius:12px;cursor:pointer;display:flex;gap:10px;padding:10px 12px}
  .ntz-opt:has(input:checked){border-color:var(--a)}
  .ntz-opt input{accent-color:var(--a);margin:3px 0 0}
  .ntz-opt b{display:block;font-size:13.5px;font-weight:500}
  .ntz-opt span span{color:var(--m);display:block;font-size:12px;margin-top:2px}
  .ntz-note{color:var(--m);font-size:12px;line-height:1.45;margin:0 0 16px}
  .ntz-bar{background:var(--p);border-radius:999px;height:4px;margin:4px 0 8px;overflow:hidden}
  .ntz-bar span{background:var(--a);display:block;height:100%;transition:width .2s;width:0}
  .ntz-status{color:var(--m);font-size:12.5px;min-height:18px}
  .ntz-status.is-error{color:#c5221f}.ntz-backdrop.is-dark .ntz-status.is-error{color:#f2b8b5}
  .ntz-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
  .ntz-btn{background:transparent;border:1px solid var(--l);border-radius:999px;color:var(--i);cursor:pointer;font-size:14px;font-weight:500;height:36px;padding:0 18px}
  .ntz-btn:hover:not(:disabled){background:var(--h)}
  .ntz-btn.is-primary{background:var(--a);border-color:var(--a);color:var(--oa)}
  .ntz-btn.is-primary:hover:not(:disabled){background:var(--a);filter:brightness(1.08)}
  .ntz-btn:disabled{cursor:default;opacity:.5}`;

  function isDark() {
    const root = document.documentElement;
    if (root.dataset.theme) return root.dataset.theme === "dark";
    for (const node of [document.body, root]) {
      const m = node && getComputedStyle(node).backgroundColor.match(/[\d.]+/g);
      if (!m || Number(m[3] ?? 1) === 0) continue;
      const [r, g, b] = m.map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  async function openDialog(notebooks, options = {}) {
    const list = (notebooks || []).filter((n) => n && n.id);
    if (!list.length) return;
    if (window.NotebookToolsPlan && !(await window.NotebookToolsPlan.can("notebook-export"))) {
      window.NotebookToolsPlan.showUpgrade("notebook-export");
      return;
    }
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.append(style);
    }
    document.querySelector(".ntz-backdrop")?.remove();

    const what = list.length === 1 ? `“${list[0].title || "Untitled notebook"}”` : `${list.length} notebooks`;
    const root = document.createElement("div");
    root.className = `ntz-backdrop${isDark() ? " is-dark" : ""}`;
    root.innerHTML = `
      <div class="ntz-card" role="dialog" aria-modal="true" aria-labelledby="ntz-title">
        <h2 id="ntz-title">Export ${esc(what)}</h2>
        <p class="ntz-sub">Every source's text and every note, in one ZIP${list.length > 1 ? ", one folder per notebook" : ""}. A README lists what's inside.</p>
        <p class="ntz-label">Format</p>
        <div class="ntz-opts">
          <label class="ntz-opt"><input type="radio" name="ntz-format" value="md" checked><span><b>Markdown (.md)</b><span>Keeps headings and lists. Opens in Obsidian, Notion, VS Code.</span></span></label>
          <label class="ntz-opt"><input type="radio" name="ntz-format" value="txt"><span><b>Plain text (.txt)</b><span>Works anywhere.</span></span></label>
        </div>
        <p class="ntz-note">Chat history isn't stored with the notebook. Export a chat from the notebook's Export menu.</p>
        <div class="ntz-progress" hidden><div class="ntz-bar"><span></span></div></div>
        <div class="ntz-status" role="status"></div>
        <div class="ntz-actions">
          <button type="button" class="ntz-btn" data-close>Cancel</button>
          <button type="button" class="ntz-btn is-primary" data-go>Download ZIP</button>
        </div>
      </div>`;
    document.body.append(root);

    let running = false;
    const status = root.querySelector(".ntz-status");
    const go = root.querySelector("[data-go]");
    const close = () => { if (!running) root.remove(); };
    root.addEventListener("click", (event) => {
      if (event.target === root || event.target.closest("[data-close]")) close();
    });
    root.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
    go.focus();

    go.addEventListener("click", async () => {
      running = true;
      go.disabled = true;
      root.querySelector("[data-close]").disabled = true;
      root.querySelector(".ntz-progress").hidden = false;
      const bar = root.querySelector(".ntz-bar span");
      const format = root.querySelector('input[name="ntz-format"]:checked').value;
      try {
        const result = await exportNotebooks(list, {
          format,
          authOptions: options.authOptions,
          onProgress: (message, done, total) => {
            status.textContent = message;
            bar.style.width = `${Math.round(((done + 0.5) / Math.max(1, total)) * 100)}%`;
          }
        });
        bar.style.width = "100%";
        download(result.blob, result.filename);
        status.textContent = `Downloaded ${result.sources} source${result.sources === 1 ? "" : "s"} and ${result.notes} note${result.notes === 1 ? "" : "s"}${result.failed ? ` (${result.failed} source${result.failed === 1 ? "" : "s"} had no readable text)` : ""}.`;
        go.textContent = "Done";
      } catch (error) {
        status.textContent = error.message || "Export failed.";
        status.classList.add("is-error");
        go.disabled = false;
      }
      running = false;
      root.querySelector("[data-close]").disabled = false;
      root.querySelector("[data-close]").textContent = "Close";
    });
  }

  window.NotebookToolsNotebookExport = { exportNotebooks, buildZip, download, safeName, openDialog };
})();
