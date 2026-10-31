const NotebookToolsBlogContentClean = {
  IMAGE_DESCRIPTION_PATTERN:
    /\b(diagram|wireframe|schematic|illustration|gauge|timeline|callout|centre|center|connected by|outer ring|points to|labelled|labeled|semi-circular|circular|showing|depicts|featuring)\b/i,

  isMetaSectionHeading(heading) {
    const normalized = this.stripBracketSuffix(heading)
      .replace(/^#+\s*/, "")
      .trim()
      .toLowerCase();

    return (
      normalized === "conclusion" ||
      normalized === "faqs" ||
      normalized === "faq" ||
      normalized === "frequently asked questions" ||
      normalized === "tips & troubleshooting" ||
      normalized === "tips and troubleshooting" ||
      normalized.startsWith("tips &") ||
      normalized.startsWith("tips and") ||
      normalized === "quick reference" ||
      normalized === "before you begin" ||
      normalized === "getting started" ||
      normalized === "overview"
    );
  },

  isImageDescriptionBracket(content) {
    const inner = String(content || "")
      .replace(/^\[/, "")
      .replace(/\]\.?$/, "")
      .trim();

    if (!inner) {
      return false;
    }

    if (/^(A|An|Two|The)\s+/i.test(inner)) {
      return true;
    }

    if (/^(Points to|Connected|Showing|Featuring)\b/i.test(inner)) {
      return true;
    }

    if (this.IMAGE_DESCRIPTION_PATTERN.test(inner)) {
      return true;
    }

    if (inner.length >= 40) {
      return true;
    }

    return false;
  },

  removeBracketBlocks(text) {
    let output = "";
    const source = String(text || "");
    let index = 0;

    while (index < source.length) {
      const open = source.indexOf("[", index);

      if (open === -1) {
        output += source.slice(index);
        break;
      }

      output += source.slice(index, open);
      const close = source.indexOf("]", open + 1);

      if (close === -1) {
        break;
      }

      const bracket = source.slice(open, close + 1);

      if (!this.isImageDescriptionBracket(bracket)) {
        output += bracket;
      }

      index = close + 1;
    }

    return this.removeBracketFragmentLines(output);
  },

  removeBracketFragmentLines(text) {
    return String(text || "")
      .split("\n")
      .filter((line) => !this.isBracketFragmentLine(line))
      .join("\n");
  },

  isBracketFragmentLine(line) {
    const trimmed = String(line || "").trim();

    if (!trimmed) {
      return false;
    }

    if (/^\[/.test(trimmed) || /\]\.?$/.test(trimmed)) {
      return true;
    }

    if (/^['’]/.test(trimmed) && /(centre|center|ring|diagram|connected|outer)/i.test(trimmed)) {
      return true;
    }

    if (
      /^(brand'|creator\s*\/\s*brand|rolls-royce|four seasons|dom pérignon|private aviation)/i.test(trimmed)
    ) {
      return true;
    }

    if (/^(at the|connected by|outer ring|with .+ at the)/i.test(trimmed)) {
      return true;
    }

    return false;
  },

  stripPlaceholders(text) {
    return String(text || "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  },

  splitHeadingLine(line) {
    let text = this.stripPlaceholders(this.stripBracketSuffix(String(line || "").trim()));

    if (!text) {
      return { title: "", body: "" };
    }

    const phaseMatch = text.match(/^(phase\s+\d+:\s*[^.]+?)(?:\s*\.\s+|\s+-\s+)(.+)$/i);

    if (phaseMatch && phaseMatch[1].length <= 120) {
      return {
        title: this.normalizeHeadingCase(phaseMatch[1]),
        body: phaseMatch[2]
      };
    }

    if (text.includes(" . ")) {
      const parts = text.split(/\s\.\s+/);
      const title = parts[0].trim();
      const body = parts.slice(1).join(". ").trim();

      if (title && body && title.length <= 140) {
        return {
          title: this.normalizeHeadingCase(title),
          body
        };
      }
    }

    if (text.includes(" - ") && text.length > 80) {
      const idx = text.indexOf(" - ");
      const title = text.slice(0, idx).replace(/\.\s*$/, "").trim();
      const body = text.slice(idx + 3).trim();

      if (title.length >= 8 && title.length <= 110 && body.length > 12) {
        return {
          title: this.normalizeHeadingCase(title),
          body
        };
      }
    }

    if (text.length > 100) {
      const sentenceMatch = text.match(/^(.{8,96}?)(?:\.\s+)([A-Za-z0-9"'].+)$/);

      if (sentenceMatch) {
        return {
          title: this.normalizeHeadingCase(sentenceMatch[1]),
          body: sentenceMatch[2]
        };
      }
    }

    if (text.length > 72) {
      const words = text.split(/\s+/);
      const titleWords = words.slice(0, Math.min(10, words.length));
      const title = titleWords.join(" ");
      const body = words.slice(titleWords.length).join(" ").trim();

      return {
        title: this.normalizeHeadingCase(title),
        body
      };
    }

    return {
      title: this.normalizeHeadingCase(text),
      body: ""
    };
  },

  normalizeInlineLists(text) {
    return String(text || "")
      .replace(/\s\.\s+-\s+/g, "\n- ")
      .replace(/:\s+-\s+/g, ":\n- ")
      .replace(/\s+(CASE STUDY|INSIGHT|EXAMPLE|KEY TAKEAWAY|STRATEGIC FOCUS|CONCLUSION):/gi, "\n\n$1:")
      .replace(/\s+(FRUSTRATION HOOKS|ASPIRATION HOOKS):/gi, "\n\n$1\n")
      .replace(/(?:^|\n)(\d+)\.\s+/g, "\n$1. ");
  },

  isLabelLine(line) {
    return /^(CASE STUDY|INSIGHT|EXAMPLE|KEY TAKEAWAY|STRATEGIC FOCUS|FRUSTRATION HOOKS|ASPIRATION HOOKS|CONCLUSION):?\s*$/i.test(
      String(line || "").trim()
    );
  },

  parseLabelLine(line) {
    const match = String(line || "").trim().match(/^([A-Za-z\s]+):\s*(.*)$/);

    if (!match) {
      return null;
    }

    const label = match[1].trim();

    if (
      !/^(CASE STUDY|INSIGHT|KEY TAKEAWAY|STRATEGIC FOCUS|FRUSTRATION HOOKS|ASPIRATION HOOKS|CONCLUSION)$/i.test(
        label
      )
    ) {
      return null;
    }

    return {
      label: this.normalizeHeadingCase(label),
      body: match[2].trim()
    };
  },

  stripBracketSuffix(text) {
    return this.removeBracketBlocks(String(text || ""))
      .replace(/\s{2,}/g, " ")
      .trim();
  },

  stripInlineBracketNotes(text) {
    return this.removeBracketBlocks(String(text || ""))
      .replace(/\s*\*\*\s*\*\*/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  },

  isSkippableLine(line) {
    const trimmed = String(line || "").trim();

    if (!trimmed) {
      return true;
    }

    if (/^\[/.test(trimmed)) {
      return true;
    }

    if (/\]$/.test(trimmed)) {
      return true;
    }

    if (/^\[[^\]]+\]\.?$/.test(trimmed)) {
      return true;
    }

    if (/^\*\*\[[^\]]+\]\*\*\.?$/.test(trimmed)) {
      return true;
    }

    if (/^\[Points to\b/i.test(trimmed)) {
      return true;
    }

    if (/^\[A\s/i.test(trimmed)) {
      return true;
    }

    if (/^a\s+circular\s+diagram\b/i.test(trimmed)) {
      return true;
    }

    if (/^circular\s+diagram\s+with\b/i.test(trimmed)) {
      return true;
    }

    if (/^\[Two\s/i.test(trimmed)) {
      return true;
    }

    if (/^\[(Current|Desired|Mechanism|Framework|Example)\b/i.test(trimmed)) {
      return true;
    }

    if (this.IMAGE_DESCRIPTION_PATTERN.test(trimmed)) {
      return true;
    }

    return false;
  },

  normalizeHeadingCase(text) {
    const cleaned = this.stripBracketSuffix(text);

    if (!cleaned) {
      return "";
    }

    if (cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned) && cleaned.length > 6) {
      return cleaned
        .toLowerCase()
        .replace(/\b([a-z])/g, (match) => match.toUpperCase());
    }

    return cleaned;
  },

  cleanLine(line) {
    let text = this.stripPlaceholders(this.stripInlineBracketNotes(String(line || "").trim()));

    if (this.isSkippableLine(text)) {
      return "";
    }

    text = text.replace(/\s+\./g, ".").replace(/\.{2,}/g, ".").replace(/\s+\./g, ".").trim();

    return text;
  },

  isWeakCaption(caption, heading = "", body = "") {
    const value = String(caption || "").trim();

    if (!value) {
      return true;
    }

    if (this.isSkippableLine(value)) {
      return true;
    }

    if (this.isImageDescriptionBracket(`[${value}]`)) {
      return true;
    }

    const normalizedCaption = value.toLowerCase();
    const normalizedHeading = String(heading || "").toLowerCase();
    const normalizedBody = String(body || "").toLowerCase();

    if (normalizedCaption === normalizedHeading) {
      return true;
    }

    if (normalizedBody && normalizedBody.includes(normalizedCaption)) {
      return true;
    }

    if (normalizedCaption.includes(normalizedHeading) && normalizedCaption.length - normalizedHeading.length < 40) {
      return true;
    }

    return /\[[^\]]{12,}\]/.test(value);
  },

  parseInlineMarkdown(text) {
    const cleaned = this.stripInlineBracketNotes(text);
    const escaped = String(cleaned || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return escaped
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  },

  sanitizeBlocks(blocks) {
    const next = [];

    for (const block of blocks || []) {
      if (block.type === "heading") {
        const split = this.splitHeadingLine(block.text);
        const title = split.title || this.normalizeHeadingCase(block.text);

        if (title) {
          next.push({ ...block, text: title });
        }

        if (split.body) {
          next.push(...this.parseSectionBody(split.body, title));
        }

        continue;
      }

      if (block.type === "paragraph") {
        const text = this.cleanLine(block.text);

        if (text) {
          next.push({ ...block, text });
        }

        continue;
      }

      if (block.type === "list") {
        const items = (block.items || []).map((item) => this.cleanLine(item)).filter(Boolean);

        if (items.length) {
          next.push({ ...block, items });
        }

        continue;
      }

      if (block.type === "image") {
        const caption = this.isWeakCaption(block.caption, block.heading || "", block.body || "")
          ? ""
          : this.cleanLine(block.caption);
        const alt = this.stripBracketSuffix(block.alt || "Illustration") || "Illustration";

        next.push({ ...block, caption, alt });
        continue;
      }

      next.push(block);
    }

    return next;
  },

  parseSectionBody(bodyText, heading = "") {
    const normalizedBody = this.normalizeInlineLists(this.removeBracketBlocks(String(bodyText || "")));
    const lines = normalizedBody.split("\n");
    const blocks = [];
    let listItems = [];
    let listOrdered = false;

    const flushList = () => {
      if (!listItems.length) {
        return;
      }

      blocks.push({
        type: "list",
        ordered: listOrdered,
        items: listItems.map((item) => this.cleanLine(item)).filter(Boolean)
      });
      listItems = [];
      listOrdered = false;
    };

    for (const line of lines) {
      const trimmed = String(line || "").trim();

      if (!trimmed) {
        flushList();
        continue;
      }

      if (this.isSkippableLine(trimmed)) {
        continue;
      }

      const labelLine = this.parseLabelLine(trimmed);

      if (labelLine) {
        flushList();

        if (labelLine.label) {
          blocks.push({ type: "heading", level: 3, text: labelLine.label });
        }

        if (labelLine.body) {
          blocks.push({ type: "paragraph", text: this.cleanLine(labelLine.body) });
        }

        continue;
      }

      if (this.isLabelLine(trimmed)) {
        flushList();
        blocks.push({
          type: "heading",
          level: 3,
          text: this.normalizeHeadingCase(trimmed.replace(/:$/, ""))
        });
        continue;
      }

      if (/^#{1,3}\s+/.test(trimmed)) {
        flushList();
        const subheading = this.normalizeHeadingCase(trimmed.replace(/^#{1,3}\s+/, ""));

        if (subheading) {
          blocks.push({ type: "heading", level: 3, text: subheading });
        }

        continue;
      }

      if (/^\d+\.\s+/.test(trimmed)) {
        const item = this.cleanLine(trimmed.replace(/^\d+\.\s+/, ""));

        if (!item) {
          continue;
        }

        if (!listOrdered && listItems.length) {
          flushList();
        }

        listOrdered = true;
        listItems.push(item);
        continue;
      }

      if (/^[-*•]\s+/.test(trimmed)) {
        const item = this.cleanLine(trimmed.replace(/^[-*•]\s+/, ""));

        if (!item) {
          continue;
        }

        if (listOrdered && listItems.length) {
          flushList();
        }

        listOrdered = false;
        listItems.push(item);
        continue;
      }

      flushList();
      const paragraph = this.cleanLine(trimmed);

      if (paragraph) {
        blocks.push({ type: "paragraph", text: paragraph });
      }
    }

    flushList();
    return blocks;
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsBlogContentClean = NotebookToolsBlogContentClean;
}
