const NotebookToolsBlogWorkflow = {
  getNotebookIdFromUrl(url = location.href) {
    const match = String(url).match(/\/notebook\/([^/?#]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  },

  safePdfFilename(title, fallback = "slide-deck") {
    const base = String(title || fallback)
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 72);

    return `${base || fallback}.pdf`;
  },

  async listReadySlideDecks(notebookId) {
    const artifacts = await NotebookToolsNotebookLM.listNotebookLmArtifacts(notebookId);
    return artifacts.filter((artifact) => artifact.typeCode === 8 && artifact.status === "ready");
  },

  async resolveSlideDeck(notebookId, artifactId) {
    if (artifactId) {
      return NotebookToolsNotebookLM.getNotebookLmSlideDeck(notebookId, artifactId);
    }

    const decks = await this.listReadySlideDecks(notebookId);

    if (!decks.length) {
      throw new Error("No ready slide decks found in this notebook.");
    }

    return NotebookToolsNotebookLM.getNotebookLmSlideDeck(notebookId, decks[0].id);
  },

  buildPrompt(slideDeck, extraInstructions = "", options = {}) {
    return NotebookToolsBlogPrompt.build({
      deckTitle: slideDeck?.title || "the slide deck",
      slideCount: slideDeck?.slides?.length || 0,
      importedPdfSource: Boolean(options.importedPdfSource),
      extraInstructions
    });
  },

  async copyPrompt(slideDeck, extraInstructions = "") {
    const prompt = this.buildPrompt(slideDeck, extraInstructions);
    await navigator.clipboard.writeText(prompt);
    return prompt;
  },

  emitProgress(onProgress, payload) {
    if (typeof onProgress === "function") {
      onProgress(payload);
    }
  },

  async createBlogDoc({
    notebookId,
    artifactId,
    chatPayload,
    onProgress,
    clipboardCopied = false,
    deckTitle = ""
  } = {}) {
    const targetNotebookId = String(notebookId || this.getNotebookIdFromUrl()).trim();

    if (!targetNotebookId) {
      throw new Error("Open a NotebookLM notebook first.");
    }

    this.emitProgress(onProgress, {
      phase: "preparing",
      message: "Reading chat and slide deck..."
    });

    const payload = chatPayload || NotebookToolsNotebookLmChatExtract.extractNotebookLmChat();
    const slideDeck = await this.resolveSlideDeck(targetNotebookId, artifactId);

    const slideImages = await NotebookToolsSlidePdfImages.extractFromDeck(slideDeck, {
      onProgress: (event) => {
        if (event.phase === "downloading") {
          this.emitProgress(onProgress, {
            phase: "downloading",
            message: "Downloading slide deck PDF...",
            current: 0,
            total: 0
          });
          return;
        }

        if (event.phase === "parsing") {
          this.emitProgress(onProgress, {
            phase: "parsing",
            message: "Opening PDF...",
            current: 0,
            total: slideDeck?.slides?.length || 0
          });
          return;
        }

        if (event.phase === "rendering") {
          this.emitProgress(onProgress, {
            phase: "rendering",
            message: event.image
              ? `Slide image ${event.current} of ${event.total} ready`
              : `Rendering slide ${event.current || 1} of ${event.total || slideDeck?.slides?.length || 0}...`,
            current: event.current || 0,
            total: event.total || 0,
            image: event.image || null
          });
        }
      }
    });

    if (!slideImages.length) {
      throw new Error("No slide images could be extracted from the deck PDF.");
    }

    this.emitProgress(onProgress, {
      phase: "assembling",
      message: "Combining blog text with slide images...",
      current: slideImages.length,
      total: slideImages.length
    });

    const article = NotebookToolsBlogAssembler.assemble({
      chatPayload: payload,
      slideDeck,
      slideImages
    });

    this.emitProgress(onProgress, {
      phase: "ready",
      message: `Blog file ready with ${slideImages.length} images`,
      current: slideImages.length,
      total: slideImages.length
    });

    this.emitProgress(onProgress, {
      phase: "exporting",
      message: "Building downloadable blog file (HTML, DOC, PDF)...",
      current: slideImages.length,
      total: slideImages.length
    });

    const result = await NotebookToolsBlogDocExport.prepareBlogDoc(article);

    let historyId = "";

    try {
      const historyEntry = await NotebookToolsBlogHistory.save({
        title: article.title,
        filename: result.filename,
        notebookId: targetNotebookId,
        deckTitle: deckTitle || slideDeck?.title || "",
        imageCount: result.imageCount,
        slideCount: slideImages.length,
        content: result.content,
        blocks: result.blocks
      });
      historyId = historyEntry.id;
    } catch (error) {
      console.warn("NotebookTools blog history:", error);
    }

    this.emitProgress(onProgress, {
      phase: "complete",
      message: `Ready to download — ${result.imageCount} images embedded`,
      current: result.imageCount,
      total: slideImages.length,
      filename: result.filename,
      content: result.content,
      blocks: result.blocks,
      clipboardCopied: Boolean(clipboardCopied),
      historyId,
      title: result.title
    });

    return {
      ...result,
      title: result.title || article.title,
      slideCount: slideImages.length,
      blocks: result.blocks,
      clipboardCopied: Boolean(clipboardCopied)
    };
  },

  async runFullAutoBlog({ notebookId, artifactId, onProgress } = {}) {
    const targetNotebookId = String(notebookId || this.getNotebookIdFromUrl()).trim();

    if (!targetNotebookId) {
      throw new Error("Open a NotebookLM notebook first.");
    }

    const slideDeck = await this.resolveSlideDeck(targetNotebookId, artifactId);
    const pdfUrl = NotebookToolsSlidePdfImages.getDeckPdfUrl(slideDeck);

    this.emitProgress(onProgress, {
      phase: "importing",
      message: "Downloading slide deck PDF..."
    });

    const pdfBytes = await NotebookToolsSlidePdfImages.fetchBinary(pdfUrl);
    const pdfFilename = this.safePdfFilename(slideDeck.title, "slide-deck");

    this.emitProgress(onProgress, {
      phase: "importing",
      message: `Downloaded PDF (${NotebookToolsSlidePdfImages.formatSize(pdfBytes.length)})`,
      detail: pdfBytes.length > 60 * 1024 * 1024 ? "File is large — compression may run next" : "Within upload size limit"
    });

    const compressedPdf = await NotebookToolsSlidePdfImages.compressForUpload(pdfBytes, {
      onProgress: (event) => {
        this.emitProgress(onProgress, {
          phase: "importing",
          message:
            event.phase === "compressing"
              ? event.message ||
                `Compressing PDF (${NotebookToolsSlidePdfImages.formatSize(event.originalSize || pdfBytes.length)})...`
              : "Preparing PDF for upload..."
        });
      }
    });

    if (compressedPdf.compressed) {
      this.emitProgress(onProgress, {
        phase: "importing",
        message: `Compressed PDF ${NotebookToolsSlidePdfImages.formatSize(compressedPdf.originalSize)} → ${NotebookToolsSlidePdfImages.formatSize(compressedPdf.finalSize)}`,
        detail: "Compressed for NotebookLM upload"
      });
    } else {
      this.emitProgress(onProgress, {
        phase: "importing",
        message: `PDF ready (${NotebookToolsSlidePdfImages.formatSize(compressedPdf.finalSize)}) — no compression needed`,
        detail: "Uploading original file"
      });
    }

    this.emitProgress(onProgress, {
      phase: "importing",
      message: "Uploading slide deck PDF as a file source...",
      detail: pdfFilename
    });

    const uploadResult = await NotebookToolsNotebookLM.addPdfBytesToNotebookLm(
      targetNotebookId,
      pdfFilename,
      compressedPdf.bytes,
      { title: slideDeck.title || pdfFilename.replace(/\.pdf$/i, "") }
    );

    this.emitProgress(onProgress, {
      phase: "importing",
      message: "Waiting for PDF source to finish processing..."
    });

    await NotebookToolsNotebookLM.waitForSourceReady(targetNotebookId, uploadResult.sourceId, {
      onProgress: (event) => {
        this.emitProgress(onProgress, {
          phase: "importing",
          message:
            event?.phase === "processing"
              ? "PDF source is processing on NotebookLM..."
              : "Waiting for PDF source import...",
          detail: event?.attempt ? `Check ${event.attempt}` : ""
        });
      }
    });

    this.emitProgress(onProgress, {
      phase: "writing",
      message: "Sending blog prompt to NotebookLM chat..."
    });

    const prompt = this.buildPrompt(slideDeck, "", { importedPdfSource: true });
    const { messageCountBefore } = await NotebookToolsBlogChatAutomation.submitPrompt(prompt);

    this.emitProgress(onProgress, {
      phase: "writing",
      message: "NotebookLM is writing the blog article..."
    });

    const reply = await NotebookToolsBlogChatAutomation.waitForAssistantReply({
      messageCountBefore,
      slideCount: slideDeck?.slides?.length || 0,
      minLength: Math.max(800, (slideDeck?.slides?.length || 0) * 380),
      onProgress: (event) => {
        this.emitProgress(onProgress, {
          phase: "writing",
          message: event.complete
            ? `Blog article complete (${event.length || 0} characters)`
            : `Writing blog article (${event.length || 0} characters)...`,
          detail: event.complete ? "Including conclusion and FAQs" : "Waiting for conclusion and FAQs"
        });
      }
    });

    await NotebookToolsBlogChatAutomation.copyBlogToClipboard(reply);

    this.emitProgress(onProgress, {
      phase: "blog-complete",
      message: "Blog written. Extracting slide images one by one..."
    });

    const chatPayload = NotebookToolsNotebookLmChatExtract.extractNotebookLmChat();

    return this.createBlogDoc({
      notebookId: targetNotebookId,
      artifactId,
      chatPayload,
      clipboardCopied: true,
      deckTitle: slideDeck?.title || "",
      onProgress
    });
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsBlogWorkflow = NotebookToolsBlogWorkflow;
}
