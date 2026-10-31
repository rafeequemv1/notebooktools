const NotebookToolsSnapshotAssembler = {
  clean: NotebookToolsBlogContentClean,
  blog: NotebookToolsBlogAssembler,

  toImageBlocks(snapshots = []) {
    return snapshots.map((snapshot, index) => ({
      index: index + 1,
      dataUrl: snapshot.dataUrl || "",
      alt: snapshot.caption || snapshot.action || snapshot.title || `Screenshot ${index + 1}`,
      caption: snapshot.caption || snapshot.action || "",
      width: snapshot.width || null,
      height: snapshot.height || null
    }));
  },

  sectionBodyLength(section) {
    return String(section?.lines?.join("\n") || "").trim().length;
  },

  stepHeadingFromSnapshot(snapshot, slideNumber) {
    const caption = String(snapshot?.caption || snapshot?.action || "").trim();

    if (caption) {
      const short = caption.length > 72 ? `${caption.slice(0, 69).trim()}…` : caption;
      return this.clean.normalizeHeadingCase(short);
    }

    const page = String(snapshot?.title || "").trim();

    if (page && !/^snapshot$/i.test(page)) {
      return this.clean.normalizeHeadingCase(`Step ${slideNumber}: ${page}`);
    }

    return `Step ${slideNumber}`;
  },

  buildSnapshotStepLead(snapshot, index, total, { guideTitle = "", guideContext = "" } = {}) {
    const step = index + 1;
    const caption = String(snapshot?.caption || snapshot?.action || "").trim();
    const page = String(snapshot?.title || "").trim();
    const parts = [];

    parts.push(
      `Step ${step} of ${total}${guideTitle ? ` — ${guideTitle}` : ""}: the screenshot below shows this part of the workflow.`
    );

    if (caption) {
      parts.push(`What you're doing here: ${caption.endsWith(".") ? caption : `${caption}.`}`);
    } else if (page) {
      parts.push(`This screen was captured from "${page}".`);
    }

    if (guideContext && step === 1) {
      parts.push(guideContext.endsWith(".") ? guideContext : `${guideContext}.`);
    }

    if (step > 1) {
      parts.push("Complete the actions on this screen before moving to the next step.");
    }

    return parts.join(" ");
  },

  buildGuideFallbackText(snapshot, index, total, guideContext = "") {
    const step = index + 1;
    const caption = String(snapshot?.caption || snapshot?.action || "").trim();
    const page = String(snapshot?.title || "").trim();
    const lines = [];

    if (caption) {
      lines.push(
        `On this screen, ${caption.endsWith(".") ? caption : `${caption}.`} Look at the screenshot and match each control to the labels shown.`
      );
      lines.push(
        "Click or type exactly as indicated, then wait for the page or panel to update. If nothing changes, re-check that you selected the correct item."
      );
    } else if (page) {
      lines.push(
        `This step takes place on ${page}. Use the screenshot to locate the relevant buttons, menus, and input fields.`
      );
      lines.push(
        "Work through the visible options from top to bottom. Confirm the screen matches what you expect before continuing."
      );
    } else {
      lines.push(
        `Follow the interface shown in screenshot ${step}. Identify the primary action on this screen and complete it carefully.`
      );
      lines.push(
        "Compare your live app to the screenshot — labels and layout should align. Resolve any differences before proceeding."
      );
    }

    if (guideContext && step === 1) {
      lines.push(guideContext);
    }

    if (step < total) {
      lines.push(`When this step is complete, continue to step ${step + 1}.`);
    } else {
      lines.push("After this step, review the quick reference at the end of the guide.");
    }

    return lines.join("\n\n");
  },

  ensureSectionHasBody(section, snapshot, index, total, guideContext = "") {
    if (this.sectionBodyLength(section) >= 120) {
      return section;
    }

    const fallback = this.buildGuideFallbackText(snapshot, index, total, guideContext);

    return {
      ...section,
      lines: [...(section.lines || []).filter(Boolean), ...fallback.split("\n").filter(Boolean)]
    };
  },

  findSectionForStep(sections, slideNumber, index) {
    const direct = sections.find((section) => Number(section.slideIndex) === slideNumber);

    if (direct) {
      return direct;
    }

    const stepPattern = new RegExp(`^(?:step|snapshot)\\s*${slideNumber}\\b`, "i");
    const matched = sections.find((section) => stepPattern.test(String(section.heading || "")));

    if (matched) {
      return matched;
    }

    const nonMeta = sections.filter((section) => !this.clean.isMetaSectionHeading(section.heading));

    return nonMeta[index] || sections[index] || { heading: "", lines: [], slideIndex: slideNumber };
  },

  buildGuideImageCaption(snapshot, slideNumber) {
    const caption = String(snapshot?.caption || snapshot?.action || "").trim();
    const page = String(snapshot?.title || "").trim();

    if (caption) {
      return `Screenshot ${slideNumber} — ${caption}`;
    }

    if (page) {
      return `Screenshot ${slideNumber} — ${page}`;
    }

    return `Screenshot ${slideNumber}`;
  },

  buildGuideInlineBlocks(sections, snapshots = [], options = {}) {
    const blocks = [];
    const images = this.toImageBlocks(snapshots);
    const total = images.length;
    const usedSlideNumbers = new Set();
    const guideContext = String(options.guideContext || "").trim();

    images.forEach((slideImage, index) => {
      const slideNumber = slideImage.index || index + 1;
      const snapshot = snapshots[index] || {};
      let section = this.findSectionForStep(sections, slideNumber, index);

      if (!this.clean.isMetaSectionHeading(section.heading)) {
        section = this.ensureSectionHasBody(section, snapshot, index, total, guideContext);
      }

      let heading = this.stepHeadingFromSnapshot(snapshot, slideNumber);

      const chatHeading = this.clean.normalizeHeadingCase(section.heading);

      if (chatHeading && !/^step\s*\d+$/i.test(chatHeading)) {
        const chatSplit = this.clean.splitHeadingLine(chatHeading);

        if (chatSplit.title && chatSplit.title.length <= 80) {
          heading = chatSplit.title;
        }
      }

      let body = section.lines.join("\n").trim();
      const headingSplit = this.clean.splitHeadingLine(section.heading || "");

      if (headingSplit.body) {
        body = [headingSplit.body, body].filter(Boolean).join("\n");
      }

      const isMetaSection = this.clean.isMetaSectionHeading(heading);

      blocks.push({ type: "heading", level: 2, text: heading });

      const lead = this.buildSnapshotStepLead(snapshot, index, total, options);

      if (lead) {
        blocks.push({ type: "paragraph", text: lead, stepLead: true });
      }

      if (!isMetaSection && slideImage?.dataUrl) {
        usedSlideNumbers.add(slideNumber);
        const imageBlock = this.blog.buildImageBlock(slideImage, slideNumber, null, heading, body);
        imageBlock.caption = this.buildGuideImageCaption(snapshot, slideNumber);
        imageBlock.alt = imageBlock.caption;
        imageBlock.forceCaption = true;
        imageBlock.stepScreenshot = true;
        blocks.push(imageBlock);
      }

      blocks.push(...this.clean.parseSectionBody(body, heading));
    });

    sections.forEach((section) => {
      const slideNumber = section.slideIndex;

      if (slideNumber && usedSlideNumbers.has(slideNumber)) {
        return;
      }

      if (this.clean.isMetaSectionHeading(section.heading)) {
        const heading = this.clean.normalizeHeadingCase(section.heading);
        const body = section.lines.join("\n").trim();

        blocks.push({ type: "heading", level: 2, text: heading });
        blocks.push(...this.clean.parseSectionBody(body, heading));
      }
    });

    return blocks;
  },

  assemble({
    chatPayload,
    snapshots = [],
    outputType = "blog",
    guideTitle = "",
    guideContext = ""
  } = {}) {
    const blogMarkdown = this.blog.extractBlogFromChat(chatPayload);
    const titleLine = blogMarkdown.split("\n").find((line) => /^#\s+/.test(line)) || "";
    const defaultTitle =
      outputType === "guide"
        ? String(guideTitle || "").trim() || "Web app tutorial"
        : outputType === "discuss"
          ? "Snapshot discussion"
          : "Blog article";
    const title =
      this.clean.normalizeHeadingCase(titleLine.replace(/^#\s+/, "").trim()) ||
      String(guideTitle || "").trim() ||
      snapshots[0]?.title ||
      defaultTitle;
    const bodyMarkdown = this.blog.stripTitleAndMeta(blogMarkdown);
    const metaLine = blogMarkdown
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !/^#{1,3}\s+/.test(line));
    const sections = this.blog.ensureAppendixSections(this.blog.splitBlogSections(bodyMarkdown), blogMarkdown);
    const imageBlocks = this.toImageBlocks(snapshots);
    const guideOptions = { guideTitle, guideContext };
    const rawBlocks =
      outputType === "guide"
        ? this.buildGuideInlineBlocks(sections, snapshots, guideOptions)
        : this.blog.buildInlineBlocks(sections, [], imageBlocks);

    if (title) {
      rawBlocks.unshift({ type: "heading", level: 1, text: title });
    }

    if (outputType === "guide" && metaLine) {
      rawBlocks.splice(1, 0, { type: "paragraph", text: metaLine });
    }

    const blocks = this.clean.sanitizeBlocks(rawBlocks).map((block) => {
      if (outputType !== "guide" || block.type !== "image") {
        return block;
      }

      const snapshot = snapshots[(block.slideIndex || 1) - 1];

      return {
        ...block,
        caption: this.buildGuideImageCaption(snapshot, block.slideIndex || 1),
        alt: this.buildGuideImageCaption(snapshot, block.slideIndex || 1),
        forceCaption: true,
        stepScreenshot: true
      };
    });

    return {
      title,
      metaDescription: metaLine || "",
      markdown: blogMarkdown,
      blocks,
      snapshotCount: snapshots.length,
      sectionCount: sections.length,
      outputType
    };
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsSnapshotAssembler = NotebookToolsSnapshotAssembler;
}
