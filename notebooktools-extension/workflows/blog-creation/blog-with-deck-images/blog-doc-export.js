const NotebookToolsBlogDocExport = {
  EXPORT_FORMATS: ["html", "csv", "doc", "pdf"],

  escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  escapeCsv(value) {
    const text = String(value ?? "").replace(/"/g, '""');

    if (/[",\n\r]/.test(text)) {
      return `"${text}"`;
    }

    return text;
  },

  safeFilename(value, extension = "html") {
    const ext = String(extension || "html").replace(/^\./, "");
    const base = String(value || "blog-article")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);

    return `${base || "blog-article"}.${ext}`;
  },

  getDownloadMimeType(filename) {
    const lower = String(filename || "").toLowerCase();

    if (lower.endsWith(".html") || lower.endsWith(".htm")) {
      return "text/html;charset=utf-8";
    }

    if (lower.endsWith(".csv")) {
      return "text/csv;charset=utf-8";
    }

    if (lower.endsWith(".doc")) {
      return "application/msword;charset=utf-8";
    }

    if (lower.endsWith(".pdf")) {
      return "application/pdf";
    }

    return "application/octet-stream";
  },

  dataUrlToUint8Array(dataUrl) {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);

    for (let index = 0; index < raw.length; index += 1) {
      out[index] = raw.charCodeAt(index);
    }

    return out;
  },

  async fetchImageAsDataUrl(imageUrl) {
    const targetUrl = String(imageUrl || "").trim();

    if (!targetUrl) {
      throw new Error("Missing image URL.");
    }

    const fetchDirect = async () => {
      const response = await fetch(targetUrl, {
        credentials: "include",
        mode: "cors",
        referrer: "https://notebook.google.com/",
        referrerPolicy: "strict-origin-when-cross-origin"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.blob();
    };

    let blob;

    try {
      blob = await fetchDirect();
    } catch (_error) {
      if (!chrome?.runtime?.sendMessage) {
        throw new Error("Could not fetch slide image.");
      }

      const response = await chrome.runtime.sendMessage({
        type: "notebooktools-fetch-media",
        url: targetUrl
      });

      if (!response?.ok || !Array.isArray(response.buffer)) {
        throw new Error(response?.error || "Could not fetch slide image.");
      }

      blob = new Blob([Uint8Array.from(response.buffer)], {
        type: response.type || "image/png"
      });
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read slide image."));
      reader.readAsDataURL(blob);
    });
  },

  readDataUrlDimensions(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        resolve({
          width: img.naturalWidth || 0,
          height: img.naturalHeight || 0
        });
      };

      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = String(dataUrl || "");
    });
  },

  getDisplaySize(block, maxWidth = 720) {
    const nativeWidth = Number(block.width) || 0;
    const nativeHeight = Number(block.height) || 0;

    if (!nativeWidth || !nativeHeight) {
      return { width: maxWidth, height: Math.round((maxWidth * 9) / 16) };
    }

    if (nativeWidth <= maxWidth) {
      return { width: nativeWidth, height: nativeHeight };
    }

    const scale = maxWidth / nativeWidth;

    return {
      width: maxWidth,
      height: Math.round(nativeHeight * scale)
    };
  },

  async hydrateImageBlocks(blocks) {
    const next = [];

    for (const block of blocks) {
      if (block.type !== "image") {
        next.push(block);
        continue;
      }

      let hydrated = { ...block };

      if (block.dataUrl) {
        if (!hydrated.width || !hydrated.height) {
          const dimensions = await this.readDataUrlDimensions(block.dataUrl);
          hydrated = { ...hydrated, ...dimensions };
        }

        next.push(hydrated);
        continue;
      }

      if (!block.imageUrl) {
        next.push({ ...hydrated, fetchError: true });
        continue;
      }

      try {
        const dataUrl = await this.fetchImageAsDataUrl(block.imageUrl);
        const dimensions = await this.readDataUrlDimensions(dataUrl);
        next.push({ ...hydrated, dataUrl, ...dimensions });
      } catch (_error) {
        next.push({ ...hydrated, dataUrl: "", fetchError: true });
      }
    }

    return next;
  },

  renderImageHtml(block) {
    const clean = NotebookToolsBlogContentClean;
    const alt = this.escapeHtml(clean.stripBracketSuffix(block.alt || "Illustration"));
    const src = block.dataUrl;
    const size = this.getDisplaySize(block);
    const showCaption =
      block.forceCaption ||
      (block.caption && !clean.isWeakCaption(block.caption, block.heading || "", block.body || ""));
    const caption = showCaption
      ? `<figcaption>${clean.parseInlineMarkdown(block.caption)}</figcaption>`
      : "";

    if (!src) {
      return "";
    }

    const figureClass = block.stepScreenshot
      ? "article-figure step-screenshot"
      : "article-figure";

    return `
<figure class="${figureClass}">
  <img src="${src}" alt="${alt}" width="${size.width}" height="${size.height}" loading="lazy" />
  ${caption}
</figure>`;
  },

  formatInline(text) {
    return NotebookToolsBlogContentClean.parseInlineMarkdown(text);
  },

  estimateReadMinutes(blocks) {
    const text = (blocks || [])
      .map((block) => {
        if (block.type === "paragraph" || block.type === "heading") {
          return block.text || "";
        }

        if (block.type === "list") {
          return (block.items || []).join(" ");
        }

        return "";
      })
      .join(" ");

    const words = text.split(/\s+/).filter(Boolean).length;

    return Math.max(4, Math.round(words / 220));
  },

  groupBlocksIntoSections(blocks) {
    const sections = [];
    let current = null;

    for (const block of blocks || []) {
      if (block.type === "heading" && block.level === 1) {
        continue;
      }

      if (block.type === "heading" && block.level === 2) {
        if (current) {
          sections.push(current);
        }

        current = {
          heading: block,
          blocks: [],
          isMeta: NotebookToolsBlogContentClean.isMetaSectionHeading(block.text),
          isFaq: /frequently asked questions|^faqs?$/i.test(
            NotebookToolsBlogContentClean.stripBracketSuffix(block.text || "").toLowerCase()
          )
        };
        continue;
      }

      if (!current) {
        current = { heading: null, blocks: [], isMeta: false, isFaq: false };
      }

      current.blocks.push(block);
    }

    if (current) {
      sections.push(current);
    }

    return sections;
  },

  getParagraphClass(text, block = {}) {
    const value = String(text || "").trim();

    if (block.stepLead || /^Step \d+ of \d+/i.test(value)) {
      return " step-lead";
    }

    if (/^(insight|key takeaway|core principle|conclusion):/i.test(value)) {
      return " callout";
    }

    if (/^case study:/i.test(value)) {
      return " case-study";
    }

    return "";
  },

  renderBlockHtml(block) {
    if (block.type === "heading") {
      const tag = block.level === 1 ? "h1" : block.level === 3 ? "h3" : "h2";
      const className =
        block.level === 3 && /\?$/.test(String(block.text || "").trim()) ? ' class="faq-question"' : "";
      return `<${tag}${className}>${this.formatInline(block.text)}</${tag}>`;
    }

    if (block.type === "list") {
      const tag = block.ordered ? "ol" : "ul";
      const items = (block.items || [])
        .map((item) => `<li>${this.formatInline(item)}</li>`)
        .join("");

      return items ? `<${tag}>${items}</${tag}>` : "";
    }

    if (block.type === "paragraph") {
      const className = this.getParagraphClass(block.text, block);
      return `<p class="article-paragraph${className}">${this.formatInline(block.text)}</p>`;
    }

    if (block.type === "image" && block.dataUrl) {
      return this.renderImageHtml(block);
    }

    if (block.type === "image" && block.fetchError) {
      return "";
    }

    return "";
  },

  getArticleStyles() {
    return `
    :root {
      color-scheme: light;
      --text: #1c1917;
      --muted: #57534e;
      --soft: #78716c;
      --border: #e7e5e4;
      --accent: #0d9488;
      --accent-dark: #0f766e;
      --surface: #ffffff;
      --bg: #fafaf9;
      --callout: #f0fdfa;
      --callout-border: #99f6e4;
      --case: #fffbeb;
      --case-border: #fde68a;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif;
      font-size: 18px;
      line-height: 1.8;
      margin: 0;
      padding: 40px 20px 72px;
    }
    .article {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      box-shadow: 0 20px 50px rgba(28, 25, 23, 0.06);
      margin: 0 auto;
      max-width: 720px;
      overflow: hidden;
      padding: 0;
    }
    .article-header {
      border-bottom: 1px solid var(--border);
      padding: 44px 44px 32px;
    }
    .article-kicker {
      color: var(--accent-dark);
      font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      margin: 0 0 12px;
      text-transform: uppercase;
    }
    h1 {
      color: #0c0a09;
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      font-size: clamp(2rem, 5vw, 2.65rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.12;
      margin: 0 0 16px;
    }
    .article-dek {
      color: var(--muted);
      font-size: 1.15rem;
      line-height: 1.65;
      margin: 0 0 18px;
    }
    .article-byline {
      color: var(--soft);
      font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 0.82rem;
      margin: 0;
    }
    .article-body { padding: 8px 44px 44px; }
    .content-section {
      margin: 0;
      padding: 28px 0 8px;
    }
    .content-section + .content-section {
      border-top: 1px solid var(--border);
      margin-top: 12px;
      padding-top: 36px;
    }
    .content-section.meta-section {
      background: linear-gradient(180deg, #fafaf9 0%, #ffffff 100%);
      border-radius: 12px;
      margin-top: 20px;
      padding: 28px 24px;
    }
    .content-section.faq-section .faq-question {
      border-left: 3px solid var(--accent);
      padding-left: 14px;
    }
    h2 {
      color: #0c0a09;
      font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 1.28rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.35;
      margin: 0 0 16px;
    }
    h3, .faq-question {
      color: #1c1917;
      font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 1.02rem;
      font-weight: 600;
      line-height: 1.45;
      margin: 1.5rem 0 0.55rem;
    }
    .article-paragraph {
      margin: 0 0 1.15rem;
    }
    .article-paragraph.callout {
      background: var(--callout);
      border: 1px solid var(--callout-border);
      border-radius: 12px;
      color: #134e4a;
      font-size: 0.98rem;
      margin: 1.25rem 0;
      padding: 16px 18px;
    }
    .article-paragraph.case-study {
      background: var(--case);
      border-left: 4px solid var(--case-border);
      border-radius: 0 10px 10px 0;
      margin: 1.25rem 0;
      padding: 14px 18px;
    }
    strong { color: #0c0a09; font-weight: 700; }
    ul, ol {
      margin: 0 0 1.25rem;
      padding-left: 1.35rem;
    }
    li {
      margin: 0.45rem 0;
      padding-left: 0.15rem;
    }
    li::marker { color: var(--accent-dark); }
    .article-figure {
      margin: 1.75rem 0 2rem;
    }
    .article-figure img {
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(28, 25, 23, 0.08);
      display: block;
      height: auto;
      margin: 0 auto;
      max-width: 100%;
      width: auto;
    }
    figcaption {
      color: var(--soft);
      font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 0.84rem;
      line-height: 1.5;
      margin-top: 0.75rem;
      text-align: center;
    }
    .step-screenshot {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 14px;
    }
    .step-screenshot img {
      border-color: #cbd5e1;
    }
    .article-paragraph.step-lead {
      background: var(--callout);
      border-left: 4px solid var(--accent);
      border-radius: 0 10px 10px 0;
      color: var(--muted);
      font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 0.95rem;
      margin: 0.5rem 0 1rem;
      padding: 0.85rem 1rem;
    }
    .article-footer {
      border-top: 1px solid var(--border);
      color: var(--soft);
      font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 0.8rem;
      margin: 0;
      padding: 20px 44px 28px;
      text-align: center;
    }
    @media (max-width: 640px) {
      body { font-size: 17px; padding: 20px 12px 48px; }
      .article-header, .article-body, .article-footer { padding-left: 22px; padding-right: 22px; }
      .content-section.meta-section { padding: 20px 16px; }
    }`;
  },

  buildPortableHtml({ title, blocks, metaDescription = "", exportedAt = new Date().toISOString() }) {
    const safeBlocks = NotebookToolsBlogContentClean.sanitizeBlocks(blocks || []);
    const sections = this.groupBlocksIntoSections(safeBlocks);
    const readMinutes = this.estimateReadMinutes(safeBlocks);
    const dek = NotebookToolsBlogContentClean.cleanLine(metaDescription || "");

    const body = sections
      .map((section) => {
        const sectionClass = section.isFaq
          ? "content-section faq-section"
          : section.isMeta
            ? "content-section meta-section"
            : "content-section";
        const headingHtml = section.heading ? this.renderBlockHtml(section.heading) : "";
        const inner = section.blocks.map((block) => this.renderBlockHtml(block)).filter(Boolean).join("\n");

        return `<section class="${sectionClass}">\n${headingHtml}\n${inner}\n</section>`;
      })
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${this.escapeHtml(title)}</title>
  ${dek ? `<meta name="description" content="${this.escapeHtml(dek)}">` : ""}
  <style>${this.getArticleStyles()}</style>
</head>
<body>
  <article class="article">
    <header class="article-header">
      <p class="article-kicker">Educational guide</p>
      <h1>${this.formatInline(title)}</h1>
      ${dek ? `<p class="article-dek">${this.formatInline(dek)}</p>` : ""}
      <p class="article-byline">${readMinutes} min read · Published ${this.escapeHtml(new Date(exportedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }))}</p>
    </header>
    <div class="article-body">
      ${body}
    </div>
    <footer class="article-footer">End of article</footer>
  </article>
</body>
</html>`;
  },

  buildWordHtml({ title, blocks, metaDescription = "", exportedAt = new Date().toISOString() }) {
    const html = this.buildPortableHtml({ title, blocks, metaDescription, exportedAt });
    return html.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n<!-- Word export -->");
  },

  buildCsv({ title, blocks }) {
    const rows = [["title", "slide_index", "heading", "body", "caption", "has_image"]];
    let currentHeading = "";
    let currentBody = "";

    for (const block of blocks || []) {
      if (block.type === "heading" && block.level === 1) {
        continue;
      }

      if (block.type === "heading") {
        currentHeading = block.text || "";
        currentBody = "";
        continue;
      }

      if (block.type === "paragraph") {
        currentBody = block.text || "";
        continue;
      }

      if (block.type === "image") {
        rows.push([
          title,
          block.slideIndex || "",
          currentHeading,
          currentBody,
          block.caption || block.alt || "",
          block.dataUrl ? "yes" : "no"
        ]);
        currentHeading = "";
        currentBody = "";
      }
    }

    if (currentHeading || currentBody) {
      rows.push([title, "", currentHeading, currentBody, "", "no"]);
    }

    return `${rows.map((row) => row.map((cell) => this.escapeCsv(cell)).join(",")).join("\n")}\n`;
  },

  wrapPdfText(text, font, fontSize, maxWidth) {
    const words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
    const lines = [];
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);

      if (width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }

    if (line) {
      lines.push(line);
    }

    return lines.length ? lines : [""];
  },

  async buildPdf({ title, blocks }) {
    const PDFLib = globalThis.PDFLib;

    if (!PDFLib?.PDFDocument) {
      throw new Error("PDF export is unavailable. Reload the extension and try again.");
    }

    const pdfDoc = await PDFLib.PDFDocument.create();
    const regular = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 48;
    const contentWidth = pageWidth - margin * 2;
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let cursorY = pageHeight - margin;

    const ensureSpace = (height) => {
      if (cursorY - height >= margin) {
        return;
      }

      page = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - margin;
    };

    const drawLines = (lines, font, fontSize, gap = 6) => {
      for (const line of lines) {
        ensureSpace(fontSize + gap);
        page.drawText(line, {
          x: margin,
          y: cursorY - fontSize,
          size: fontSize,
          font
        });
        cursorY -= fontSize + gap;
      }
    };

    drawLines([String(title || "Blog article")], bold, 22, 10);
    cursorY -= 8;

    for (const block of blocks || []) {
      if (block.type === "heading" && block.level === 1) {
        continue;
      }

      if (block.type === "heading") {
        const headingText = NotebookToolsBlogContentClean.stripBracketSuffix(block.text);
        cursorY -= 10;
        drawLines(
          this.wrapPdfText(headingText, block.level === 3 ? regular : bold, block.level === 3 ? 12 : 16, contentWidth),
          block.level === 3 ? regular : bold,
          block.level === 3 ? 12 : 16,
          8
        );
        continue;
      }

      if (block.type === "list") {
        const items = block.items || [];

        for (let index = 0; index < items.length; index += 1) {
          const prefix = block.ordered ? `${index + 1}. ` : "• ";
          drawLines(
            this.wrapPdfText(`${prefix}${items[index]}`, regular, 11, contentWidth),
            regular,
            11,
            4
          );
        }

        continue;
      }

      if (block.type === "paragraph") {
        const paragraphText = NotebookToolsBlogContentClean.stripInlineBracketNotes(block.text);
        drawLines(this.wrapPdfText(paragraphText, regular, 11, contentWidth), regular, 11, 5);
        continue;
      }

      if (block.type === "image" && block.dataUrl) {
        const bytes = this.dataUrlToUint8Array(block.dataUrl);
        const isPng = /^data:image\/png/i.test(String(block.dataUrl || ""));
        const image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const maxImageWidth = contentWidth;
        const scale = Math.min(1, maxImageWidth / image.width);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;

        ensureSpace(drawHeight + 24);
        page.drawImage(image, {
          x: margin + (contentWidth - drawWidth) / 2,
          y: cursorY - drawHeight,
          width: drawWidth,
          height: drawHeight
        });
        cursorY -= drawHeight + 12;

        if (
          block.caption &&
          !NotebookToolsBlogContentClean.isWeakCaption(block.caption, block.heading || "", block.body || "")
        ) {
          drawLines(
            this.wrapPdfText(block.caption, regular, 9, contentWidth),
            regular,
            9,
            4
          );
        }

        cursorY -= 8;
      }
    }

    return new Uint8Array(await pdfDoc.save());
  },

  async buildFormat({ title, blocks, format, exportedAt, metaDescription = "" }) {
    const normalized = String(format || "html").toLowerCase();
    const safeBlocks = NotebookToolsBlogContentClean.sanitizeBlocks(blocks || []);
    const safeTitle = NotebookToolsBlogContentClean.normalizeHeadingCase(title || "Blog article");

    if (normalized === "html") {
      return {
        format: "html",
        filename: this.safeFilename(safeTitle, "html"),
        content: this.buildPortableHtml({
          title: safeTitle,
          blocks: safeBlocks,
          metaDescription,
          exportedAt
        }),
        isBinary: false
      };
    }

    if (normalized === "doc") {
      return {
        format: "doc",
        filename: this.safeFilename(safeTitle, "doc"),
        content: this.buildWordHtml({
          title: safeTitle,
          blocks: safeBlocks,
          metaDescription,
          exportedAt
        }),
        isBinary: false
      };
    }

    if (normalized === "csv") {
      return {
        format: "csv",
        filename: this.safeFilename(safeTitle, "csv"),
        content: this.buildCsv({ title: safeTitle, blocks: safeBlocks }),
        isBinary: false
      };
    }

    if (normalized === "pdf") {
      return {
        format: "pdf",
        filename: this.safeFilename(safeTitle, "pdf"),
        content: await this.buildPdf({ title: safeTitle, blocks: safeBlocks }),
        isBinary: true
      };
    }

    throw new Error(`Unsupported export format: ${format}`);
  },

  downloadFile(filename, content) {
    const isBinary = content instanceof Uint8Array;
    const payload = isBinary ? content : `\ufeff${content}`;
    const blob = new Blob([payload], {
      type: this.getDownloadMimeType(filename)
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async downloadFormat({ title, blocks }, format) {
    const built = await this.buildFormat({ title, blocks, format });
    this.downloadFile(built.filename, built.content);
    return built;
  },

  downloadDoc(filename, content) {
    this.downloadFile(filename, content);
  },

  async exportBlogDoc(article, options = {}) {
    const prepared = await this.prepareBlogDoc(article);
    const format = options.format || "html";

    if (options.autoDownload !== false) {
      await this.downloadFormat(
        { title: prepared.title, blocks: prepared.blocks },
        format
      );
    }

    return prepared;
  },

  async prepareBlogDoc(article, options = {}) {
    let blocks = await this.hydrateImageBlocks(article.blocks || []);
    blocks = NotebookToolsBlogContentClean.sanitizeBlocks(blocks);
    const imageCount = blocks.filter((block) => block.type === "image" && block.dataUrl).length;
    const imageLabel = String(options.imageLabel || "slide").trim() || "slide";

    if (!imageCount) {
      throw new Error(
        `No ${imageLabel} images could be embedded. Check that sources are ready, then reload the extension and try again.`
      );
    }

    const title = article.title || "Blog article";
    const htmlBuilt = await this.buildFormat({
      title,
      blocks,
      format: "html",
      metaDescription: article.metaDescription || ""
    });

    return {
      title,
      blocks,
      imageCount,
      filename: htmlBuilt.filename,
      content: htmlBuilt.content,
      format: "html"
    };
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsBlogDocExport = NotebookToolsBlogDocExport;
}
