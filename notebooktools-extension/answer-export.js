/* ==========================================================================
   Export one answer as a clean document.

   "Export chat" saves the whole conversation. Teachers making an exam paper,
   worksheet or lesson plan want just the last answer, laid out as a page:
   headings, numbered lists, tables and bold kept; citation chips, buttons
   and the prompt left out. Saves as a print-ready PDF view, a Word file
   (.doc, HTML that Word opens and edits) or Markdown.
   ========================================================================== */
(function () {
  "use strict";

  const KEEP = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "u", "s", "sub", "sup", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "blockquote", "code", "pre", "hr"]);
  const SKIP = new Set(["button", "svg", "mat-icon", "script", "style", "img", "input", "textarea", "select", "noscript", "template", "canvas", "video", "audio"]);
  const BLOCK = /^(block|flex|grid|list-item|table|flow-root)/;
  const NOISE = /citation|action|copy|feedback|toolbar|thumb|chip|suggest|tooltip|menu/i;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function lastAnswerNode() {
    const answers = document.querySelectorAll(".to-user-container");
    for (let i = answers.length - 1; i >= 0; i -= 1) {
      if ((answers[i].innerText || "").trim()) return answers[i];
    }
    const fallback = Array.from(document.querySelectorAll("[role='log'] [role='article'], chat-panel [data-testid*='message']"))
      .filter((n) => !/user/i.test(`${n.className} ${n.getAttribute("aria-label") || ""}`));
    return fallback[fallback.length - 1] || null;
  }

  function isHidden(el) {
    if (el.getAttribute("aria-hidden") === "true" || el.hidden) return true;
    const style = getComputedStyle(el);
    return style.display === "none" || style.visibility === "hidden";
  }

  /** The answer's DOM as small, safe HTML: only structural tags, no attributes. */
  function cleanHtml(node) {
    function walk(el) {
      let out = "";
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          out += esc(child.textContent);
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = child.tagName.toLowerCase();
        if (SKIP.has(tag) || isHidden(child)) continue;
        const cls = typeof child.className === "string" ? child.className : "";
        if (NOISE.test(cls) && !KEEP.has(tag)) continue;
        const inner = walk(child);
        if (KEEP.has(tag)) {
          if (tag === "br" || tag === "hr") {
            out += `<${tag}>`;
          } else if (tag === "td" || tag === "th") {
            const span = Number(child.getAttribute("colspan")) > 1 ? ` colspan="${Number(child.getAttribute("colspan"))}"` : "";
            out += `<${tag}${span}>${inner}</${tag}>`;
          } else if (tag === "ol") {
            const start = Number(child.getAttribute("start")) > 1 ? ` start="${Number(child.getAttribute("start"))}"` : "";
            const type = /^[aAiI]$/.test(child.getAttribute("type") || "") ? ` type="${child.getAttribute("type")}"` : "";
            out += `<ol${start}${type}>${inner}</ol>`;
          } else {
            out += `<${tag}>${inner}</${tag}>`;
          }
          continue;
        }
        // Unknown wrapper: a block with only inline content becomes a paragraph
        if (BLOCK.test(getComputedStyle(child).display) && inner.trim()) {
          out += /<(p|h[1-6]|ul|ol|table|blockquote|pre|hr)\b/.test(inner) ? inner : `<p>${inner}</p>`;
        } else {
          out += inner;
        }
      }
      return out;
    }
    return walk(node)
      .replace(/<p>\s*(<br>\s*)*<\/p>/g, "")
      .replace(/(<br>\s*){3,}/g, "<br><br>")
      .trim();
  }

  function title() {
    // getNotebookLmTitle is a top-level function of notebooklm-chat-extract.js
    const fromChat = typeof getNotebookLmTitle === "function" ? getNotebookLmTitle() : "";
    const raw = fromChat || document.querySelector("h1")?.textContent || document.title || "Answer";
    return raw.replace(/\s*-\s*(NotebookLM|Gemini Notebook).*$/i, "").trim() || "Answer";
  }

  function safeFilename(name, ext) {
    const base = String(name || "answer").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 72);
    return `${base || "answer"}.${ext}`;
  }

  const PAGE_CSS = `
    @page { size: A4; margin: 18mm 18mm 20mm; }
    body { color: #111; font: 11.5pt/1.55 Arial, Helvetica, sans-serif; margin: 0; }
    .page { margin: 0 auto; max-width: 720px; padding: 32px 24px 48px; }
    h1 { font-size: 18pt; margin: 0 0 10pt; text-align: center; }
    h2 { font-size: 14pt; margin: 16pt 0 6pt; }
    h3 { font-size: 12.5pt; margin: 14pt 0 5pt; }
    h4, h5, h6 { font-size: 11.5pt; margin: 12pt 0 4pt; }
    p { margin: 0 0 7pt; }
    ul, ol { margin: 0 0 8pt; padding-left: 22pt; }
    ol ol { list-style-type: lower-alpha; margin-top: 4pt; }
    ol[type="a" s] { list-style-type: lower-alpha; } ol[type="A" s] { list-style-type: upper-alpha; }
    ol[type="i" s] { list-style-type: lower-roman; } ol[type="I" s] { list-style-type: upper-roman; }
    li { margin: 0 0 4pt; }
    li > p { margin: 0 0 3pt; }
    table { border-collapse: collapse; margin: 6pt 0 12pt; width: 100%; }
    th, td { border: 1px solid #888; padding: 5pt 7pt; text-align: left; vertical-align: top; }
    th { background: #f1f1f1; }
    blockquote { border-left: 3px solid #bbb; color: #333; margin: 0 0 8pt; padding: 2pt 0 2pt 10pt; }
    hr { border: 0; border-top: 1px solid #999; margin: 12pt 0; }
    h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
    li, tr { page-break-inside: avoid; break-inside: avoid; }
    .hint { background: #e8f0fe; border-radius: 10px; color: #0b57d0; font: 500 13px/1.4 Arial, sans-serif; margin: 12px auto 0; max-width: 720px; padding: 10px 14px; }
    @media print { .hint { display: none; } .page { padding: 0; max-width: none; } }`;

  function pdfHtml(docTitle, body) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(docTitle)}</title><style>${PAGE_CSS}</style></head>
<body><div class="hint">Press Ctrl+P (⌘P on Mac) and choose <b>Save as PDF</b>. Tip: turn off “Headers and footers” for a clean page.</div><div class="page">${body}</div></body></html>`;
  }

  function wordHtml(docTitle, body) {
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(docTitle)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page WordSection1 { size: 595.3pt 841.9pt; margin: 51pt 51pt 57pt 51pt; }
  div.WordSection1 { page: WordSection1; }
  body { font-family: Arial, sans-serif; font-size: 11.5pt; line-height: 1.5; }
  h1 { font-size: 18pt; text-align: center; } h2 { font-size: 14pt; } h3 { font-size: 12.5pt; }
  ol ol { list-style-type: lower-alpha; }
  table { border-collapse: collapse; } th, td { border: 1px solid #888; padding: 4pt 6pt; vertical-align: top; }
</style></head><body><div class="WordSection1">${body}</div></body></html>`;
  }

  function toMarkdown(html) {
    const box = document.createElement("div");
    box.innerHTML = html;
    function md(node, depth = 0) {
      let out = "";
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          out += child.textContent.replace(/\s+/g, " ");
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = child.tagName.toLowerCase();
        const inner = () => md(child, depth).trim();
        if (/^h[1-6]$/.test(tag)) out += `\n\n${"#".repeat(Number(tag[1]))} ${inner()}\n\n`;
        else if (tag === "p") out += `\n\n${inner()}\n\n`;
        else if (tag === "br") out += "  \n";
        else if (tag === "hr") out += "\n\n---\n\n";
        else if (tag === "strong" || tag === "b") out += `**${inner()}**`;
        else if (tag === "em" || tag === "i") out += `*${inner()}*`;
        else if (tag === "code") out += `\`${inner()}\``;
        else if (tag === "blockquote") out += `\n\n${inner().split("\n").map((l) => `> ${l}`).join("\n")}\n\n`;
        else if (tag === "ul" || tag === "ol") {
          let n = Number(child.getAttribute("start")) || 1;
          const type = child.getAttribute("type") || (depth > 0 ? "a" : "1");
          const items = Array.from(child.children).filter((li) => li.tagName === "LI").map((li) => {
            const text = md(li, depth + 1).trim().replace(/\n{2,}/g, "\n");
            const mark = /^[aA]$/.test(type) ? String.fromCharCode((type === "a" ? 96 : 64) + n) : n;
            n += 1;
            const bullet = tag === "ol" ? (/^[aA]$/.test(type) ? `${mark})` : `${mark}.`) : "-";
            return `${"   ".repeat(depth)}${bullet} ${text}`;
          });
          out += `\n${items.join("\n")}\n`;
        } else if (tag === "table") {
          const rows = Array.from(child.querySelectorAll("tr")).map((tr) => Array.from(tr.children).map((c) => md(c).trim().replace(/\|/g, "\\|").replace(/\n+/g, " ")));
          if (rows.length) {
            const cols = Math.max(...rows.map((r) => r.length));
            const line = (r) => `| ${Array.from({ length: cols }, (_, i) => r[i] || "").join(" | ")} |`;
            out += `\n\n${line(rows[0])}\n| ${Array(cols).fill("---").join(" | ")} |\n${rows.slice(1).map(line).join("\n")}\n\n`;
          }
        } else out += md(child, depth);
      }
      return out;
    }
    return md(box).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  function download(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /** format: "pdf" | "word" | "markdown". Returns a short message for a toast. */
  async function exportLastAnswer(format) {
    const node = lastAnswerNode();
    if (!node) throw new Error("No answer yet. Ask Gemini Notebook something first.");
    const body = cleanHtml(node);
    if (!body.replace(/<[^>]+>/g, "").trim()) throw new Error("The last answer is empty.");
    const docTitle = title();

    if (format === "word") {
      download(safeFilename(docTitle, "doc"), `﻿${wordHtml(docTitle, body)}`, "application/msword");
      return "Saved the answer as a Word file";
    }
    if (format === "markdown") {
      download(safeFilename(docTitle, "md"), toMarkdown(body), "text/markdown;charset=utf-8");
      return "Saved the answer as Markdown";
    }
    const url = URL.createObjectURL(new Blob([pdfHtml(docTitle, body)], { type: "text/html;charset=utf-8" }));
    const view = window.open(url, "_blank");
    if (!view) {
      URL.revokeObjectURL(url);
      throw new Error("Pop-up blocked. Allow pop-ups for this site to save a PDF.");
    }
    try {
      view.addEventListener("load", () => window.setTimeout(() => view.print(), 300), { once: true });
    } catch (_error) {
      /* the page itself says how to print */
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    return "PDF view opened. Choose Save as PDF.";
  }

  window.NotebookToolsAnswerExport = { exportLastAnswer, cleanHtml, toMarkdown };
})();
