const NotebookToolsBlogAssembler = {
  clean: NotebookToolsBlogContentClean,

  extractBlogFromChat(chatPayload) {
    const messages = Array.isArray(chatPayload?.messages) ? chatPayload.messages : [];
    const assistantMessages = messages.filter((message) => {
      const role = String(message?.role || "").toLowerCase();
      return role.includes("notebooklm") || role.includes("assistant") || role.includes("gemini");
    });

    let bestBody = "";

    for (const message of assistantMessages) {
      const body = String(message?.body || "").trim();

      if (body.length > bestBody.length) {
        bestBody = body;
      }
    }

    const recent = assistantMessages.slice(-4);

    for (const message of recent) {
      const body = String(message?.body || "").trim();

      if (body.length > bestBody.length) {
        bestBody = body;
      }
    }

    if (bestBody.length >= 120) {
      return bestBody;
    }

    throw new Error("No blog draft found in chat. Paste the prompt, wait for NotebookLM to reply, then try again.");
  },

  parseSectionHeading(heading) {
    const raw = this.clean.normalizeHeadingCase(this.clean.stripBracketSuffix(String(heading || "").trim()));
    const slideMatch = raw.match(/^slide\s*(\d+)\s*[.:—–\-]\s*(.*)$/i);

    if (slideMatch) {
      return {
        slideIndex: Number(slideMatch[1]),
        title: String(slideMatch[2] || raw).trim() || raw
      };
    }

    const snapshotMatch = raw.match(/^snapshot\s*(\d+)\s*[.:—–\-]?\s*(.*)$/i);

    if (snapshotMatch) {
      return {
        slideIndex: Number(snapshotMatch[1]),
        title: String(snapshotMatch[2] || raw).trim() || `Snapshot ${snapshotMatch[1]}`
      };
    }

    const stepMatch = raw.match(/^step\s*(\d+)\s*[.:—–\-]?\s*(.*)$/i);

    if (stepMatch) {
      return {
        slideIndex: Number(stepMatch[1]),
        title: String(stepMatch[2] || raw).trim() || `Step ${stepMatch[1]}`
      };
    }

    const numMatch = raw.match(/^(\d+)\s*[.:—–\-]\s*(.+)$/);

    if (numMatch) {
      return {
        slideIndex: Number(numMatch[1]),
        title: numMatch[2].trim()
      };
    }

    return { slideIndex: null, title: raw };
  },

  splitBlogSections(markdown) {
    const text = String(markdown || "").trim();
    const lines = text.split("\n");
    const sections = [];
    let current = { heading: "", lines: [], slideIndex: null };

    for (const line of lines) {
      const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingRaw = headingMatch[2].trim();
        const isMeta = this.clean.isMetaSectionHeading(headingRaw);

        if (level === 2 || isMeta) {
          if (current.heading || current.lines.length) {
            sections.push(current);
          }

          const split = this.clean.splitHeadingLine(headingRaw);
          const parsed = this.parseSectionHeading(split.title || headingRaw);
          current = {
            heading: parsed.title || split.title || this.clean.normalizeHeadingCase(headingRaw),
            lines: split.body ? [split.body] : [],
            slideIndex: isMeta ? null : parsed.slideIndex
          };
          continue;
        }
      }

      current.lines.push(line);
    }

    if (current.heading || current.lines.length) {
      sections.push(current);
    }

    if (!sections.length) {
      return [{ heading: "", lines: lines.filter(Boolean), slideIndex: null }];
    }

    return sections;
  },

  sectionHeadingKey(heading) {
    return String(heading || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  },

  hasSectionHeading(sections, pattern) {
    return sections.some((section) => pattern.test(this.sectionHeadingKey(section.heading)));
  },

  extractMarkdownSection(markdown, headingPattern) {
    const text = String(markdown || "");
    const match = text.match(
      new RegExp(`(?:^|\\n)#{2,3}\\s+(${headingPattern})\\s*\\n([\\s\\S]*?)(?=\\n#{2,3}\\s+|$)`, "i")
    );

    if (!match) {
      return null;
    }

    return {
      heading: this.clean.normalizeHeadingCase(match[1]),
      lines: String(match[2] || "")
        .trim()
        .split("\n")
        .filter(Boolean),
      slideIndex: null
    };
  },

  extractInlineConclusionFromSections(sections) {
    const extra = [];

    for (let index = sections.length - 1; index >= 0; index -= 1) {
      const section = sections[index];

      if (this.clean.isMetaSectionHeading(section.heading)) {
        break;
      }

      const body = section.lines.join("\n");
      const match =
        body.match(/\n\nCONCLUSION:\s*([\s\S]+)$/i) ||
        body.match(/^CONCLUSION:\s*([\s\S]+)$/i) ||
        body.match(/\n###\s+Conclusion\s*\n([\s\S]+)$/i) ||
        body.match(/\n##\s+Conclusion\s*\n([\s\S]+)$/i);

      if (!match) {
        continue;
      }

      const before = body.slice(0, match.index).trim();

      section.lines = before ? before.split("\n") : [];
      extra.push({
        heading: "Conclusion",
        lines: match[1].trim().split("\n").filter(Boolean),
        slideIndex: null
      });
      break;
    }

    return extra;
  },

  extractTrailingFaqSection(markdown) {
    const text = String(markdown || "");
    const fromHeader = this.extractMarkdownSection(text, "frequently asked questions|faqs?");

    if (fromHeader) {
      return fromHeader;
    }

    const lines = text.split("\n");
    const faqStart = lines.findIndex((line) => /^###\s+.+\?\s*$/.test(String(line || "").trim()));

    if (faqStart === -1) {
      return null;
    }

    return {
      heading: "Frequently Asked Questions",
      lines: lines.slice(faqStart),
      slideIndex: null
    };
  },

  ensureAppendixSections(sections, markdown) {
    const next = [...sections];
    const hasConclusion = this.hasSectionHeading(next, /^conclusion$/);
    const hasFaq = this.hasSectionHeading(next, /frequently asked questions|^faqs?$/);

    if (!hasConclusion) {
      const conclusionSection = this.extractMarkdownSection(markdown, "conclusion");

      if (conclusionSection) {
        next.push(conclusionSection);
      } else {
        next.push(...this.extractInlineConclusionFromSections(next));
      }
    }

    if (!hasFaq) {
      const faqSection = this.extractTrailingFaqSection(markdown);

      if (faqSection) {
        next.push(faqSection);
      }
    }

    return next;
  },

  getSlideByNumber(slides, slideNumber) {
    if (!slideNumber) {
      return null;
    }

    return (
      slides.find((slide) => Number(slide.index) === Number(slideNumber)) ||
      slides[Number(slideNumber) - 1] ||
      null
    );
  },

  getImageBySlideNumber(slideImages, slideNumber) {
    if (!slideNumber) {
      return null;
    }

    return (
      slideImages.find((slide) => Number(slide.index) === Number(slideNumber)) ||
      slideImages[Number(slideNumber) - 1] ||
      null
    );
  },

  buildImageBlock(slideImage, slideNumber, deckSlide, heading, bodyText = "") {
    const alt = this.clean.stripBracketSuffix(
      slideImage?.alt || deckSlide?.text || heading || `Slide ${slideNumber}`
    );
    let caption = String(slideImage?.caption || "").trim();

    if (this.clean.isWeakCaption(caption, heading, bodyText)) {
      caption = "";
    }

    return {
      type: "image",
      slideIndex: slideImage.index || slideNumber,
      dataUrl: slideImage.dataUrl || "",
      imageUrl: slideImage.imageUrl || "",
      width: slideImage.width || deckSlide?.width || null,
      height: slideImage.height || deckSlide?.height || null,
      alt,
      caption
    };
  },

  buildInlineBlocks(sections, slides = [], slideImages = []) {
    const blocks = [];
    const deckSlides = Array.isArray(slides) ? slides : [];
    const imagesFromPdf = Array.isArray(slideImages) ? slideImages.filter((slide) => slide?.dataUrl) : [];
    const usableSlides = imagesFromPdf.length
      ? imagesFromPdf
      : deckSlides.filter((slide) => slide.imageUrl || slide.text || slide.description);
    const usedSlideNumbers = new Set();

    sections.forEach((section, index) => {
      let body = section.lines.join("\n").trim();
      const slideNumber = section.slideIndex || index + 1;
      const deckSlide = this.getSlideByNumber(deckSlides, slideNumber);
      let heading =
        this.clean.normalizeHeadingCase(section.heading) ||
        this.clean.normalizeHeadingCase(deckSlide?.text || deckSlide?.description || "") ||
        `Section ${slideNumber}`;

      const headingSplit = this.clean.splitHeadingLine(heading);

      if (headingSplit.title) {
        heading = headingSplit.title;
      }

      if (headingSplit.body) {
        body = [headingSplit.body, body].filter(Boolean).join("\n");
      }

      const isMetaSection = this.clean.isMetaSectionHeading(heading);
      const sectionBlocks = this.clean.parseSectionBody(body, heading);

      blocks.push({ type: "heading", level: 2, text: heading });
      blocks.push(...sectionBlocks);

      if (isMetaSection) {
        return;
      }

      const slideImage = this.getImageBySlideNumber(usableSlides, slideNumber) || usableSlides[index];

      if (slideImage?.dataUrl || slideImage?.imageUrl) {
        usedSlideNumbers.add(slideNumber);
        blocks.push(this.buildImageBlock(slideImage, slideNumber, deckSlide, heading, body));
      }
    });

    usableSlides.forEach((slide, index) => {
      const slideNumber = slide.index || index + 1;

      if (usedSlideNumbers.has(slideNumber)) {
        return;
      }

      if (!slide?.dataUrl && !slide?.imageUrl) {
        return;
      }

      const deckSlide = this.getSlideByNumber(deckSlides, slideNumber);
      const heading = this.clean.normalizeHeadingCase(deckSlide?.text || deckSlide?.description || "");

      if (heading) {
        blocks.push({
          type: "heading",
          level: 2,
          text: heading
        });
      }

      blocks.push(this.buildImageBlock(slide, slideNumber, deckSlide, heading));
    });

    return blocks;
  },

  stripTitleAndMeta(markdown) {
    const lines = String(markdown || "").trim().split("\n");
    const cleaned = [];
    let skippedTitle = false;

    for (const line of lines) {
      if (!skippedTitle && /^#\s+/.test(line)) {
        skippedTitle = true;
        continue;
      }

      if (skippedTitle && cleaned.length === 0 && line.trim() && !/^#{1,3}\s+/.test(line)) {
        continue;
      }

      cleaned.push(line);
    }

    return cleaned.join("\n").trim();
  },

  assemble({ chatPayload, slideDeck, slideImages = [] }) {
    const blogMarkdown = this.extractBlogFromChat(chatPayload);
    const titleLine = blogMarkdown.split("\n").find((line) => /^#\s+/.test(line)) || "";
    const title =
      this.clean.normalizeHeadingCase(titleLine.replace(/^#\s+/, "").trim()) ||
      slideDeck?.title ||
      "Blog article";
    const bodyMarkdown = this.stripTitleAndMeta(blogMarkdown);
    const metaLine = blogMarkdown
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !/^#{1,3}\s+/.test(line));
    const sections = this.ensureAppendixSections(this.splitBlogSections(bodyMarkdown), blogMarkdown);
    const blocks = this.buildInlineBlocks(sections, slideDeck?.slides || [], slideImages);

    if (title) {
      blocks.unshift({ type: "heading", level: 1, text: title });
    }

    return {
      title,
      metaDescription: metaLine || "",
      markdown: blogMarkdown,
      blocks: this.clean.sanitizeBlocks(blocks),
      slideCount: slideImages.length || slideDeck?.slides?.length || 0,
      sectionCount: sections.length
    };
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsBlogAssembler = NotebookToolsBlogAssembler;
}
