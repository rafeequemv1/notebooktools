const NotebookToolsSnapshotWorkflow = {
  getNotebookIdFromUrl(url = location.href) {
    const match = String(url).match(/\/notebook\/([^/?#]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  },

  emitProgress(onProgress, payload) {
    if (typeof onProgress === "function") {
      onProgress(payload);
    }
  },

  getAssistantMessages(messages) {
    return NotebookToolsBlogChatAutomation.getAssistantMessages(messages);
  },

  tryIsResponseReady({ messageCountBefore = 0, outputType = "blog", snapshotCount = 0 } = {}) {
    const messages = NotebookToolsNotebookLmChatExtract.extractNotebookLmMessages();

    if (messages.length <= Number(messageCountBefore)) {
      return false;
    }

    const assistantMessages = this.getAssistantMessages(messages);
    const lastAssistant = assistantMessages[assistantMessages.length - 1];
    const body = String(lastAssistant?.body || "").trim();
    const type = String(outputType || "blog").toLowerCase();
    const count = Number(snapshotCount) || 0;
    const minLength = Math.max(type === "guide" ? 1600 : 600, count * (type === "guide" ? 500 : 280));

    if (body.length < minLength) {
      return false;
    }

    if (type === "blog") {
      return NotebookToolsBlogChatAutomation.isBlogComplete(body, count);
    }

    if (type === "guide") {
      return NotebookToolsBlogChatAutomation.isGuideComplete(body, count);
    }

    const sectionCount = (body.match(/^##\s+/gm) || []).length;
    return sectionCount >= Math.max(1, Math.min(count, 2));
  },

  async waitForSnapshotArticle({ messageCountBefore, outputType, snapshotCount, onProgress } = {}) {
    const type = String(outputType || "blog").toLowerCase();
    const minLength = Math.max(type === "guide" ? 1600 : 600, Number(snapshotCount) * (type === "guide" ? 500 : 280));

    return NotebookToolsBlogChatAutomation.waitForAssistantReply({
      messageCountBefore,
      slideCount: Number(snapshotCount) || 0,
      minLength,
      requireAppendix: type === "blog",
      requireGuideComplete: type === "guide",
      onProgress: (event) => {
        this.emitProgress(onProgress, {
          phase: "writing",
          message: event.complete
            ? `Article ready (${event.length || 0} characters)`
            : `Writing (${event.length || 0} characters)...`,
          detail: event.complete
            ? "Picking up response and building DOC..."
            : type === "blog"
              ? "Waiting for conclusion and FAQs"
              : type === "guide"
                ? "Waiting for all steps, tips, and quick reference"
                : "Still generating"
        });
      }
    });
  },

  async buildDocFromReadyChat({ session, outputType, onProgress } = {}) {
    const snapshots = session?.snapshots || [];
    const type = String(outputType || session.outputType || "blog").toLowerCase();

    if (!snapshots.length) {
      throw new Error("No snapshots available for this notebook.");
    }

    this.emitProgress(onProgress, {
      phase: "assembling",
      message: "Response ready — embedding snapshot images..."
    });

    const chatPayload = NotebookToolsNotebookLmChatExtract.extractNotebookLmChat();
    const result = await this.createDocument({
      notebookId: session.notebookId,
      chatPayload,
      snapshots,
      outputType: type,
      guideTitle: session.guideTitle || "",
      guideContext: session.guideContext || "",
      onProgress
    });

    if (session.notebookId) {
      await NotebookToolsSnapshotStore.setDocReady(session.notebookId, {
        docTitle: result.title,
        docImageCount: result.imageCount || snapshots.length
      });
    }

    return result;
  },

  async watchAndBuildDoc({ session, messageCountBefore, outputType, onProgress } = {}) {
    const snapshots = session?.snapshots || [];
    const type = String(outputType || session.outputType || "blog").toLowerCase();
    const countBefore = Number(messageCountBefore) || 0;

    if (!this.tryIsResponseReady({
      messageCountBefore: countBefore,
      outputType: type,
      snapshotCount: snapshots.length
    })) {
      this.emitProgress(onProgress, {
        phase: "writing",
        message: "Waiting for NotebookLM to finish writing...",
        detail: "Will build DOC automatically when the reply is complete"
      });

      await this.waitForSnapshotArticle({
        messageCountBefore: countBefore,
        outputType: type,
        snapshotCount: snapshots.length,
        onProgress
      });
    } else {
      this.emitProgress(onProgress, {
        phase: "writing",
        message: "Article already complete in chat.",
        detail: "Building DOC with inline snapshot images..."
      });
    }

    return this.buildDocFromReadyChat({ session, outputType: type, onProgress });
  },

  async loadSession(notebookId) {
    const targetNotebookId = String(notebookId || this.getNotebookIdFromUrl()).trim();
    return NotebookToolsSnapshotStore.getSession(targetNotebookId);
  },

  async ensureSessionForNotebook(notebookId, options = {}) {
    const targetNotebookId = String(notebookId || this.getNotebookIdFromUrl()).trim();

    if (!targetNotebookId) {
      throw new Error("Open a NotebookLM notebook first.");
    }

    let session = await NotebookToolsSnapshotStore.getSession(targetNotebookId);

    if (session?.snapshots?.length && session?.sourceIds?.length) {
      return session;
    }

    const snapshots = session?.snapshots?.length
      ? session.snapshots
      : (await NotebookToolsSnapshotStore.list()).filter((item) => item?.dataUrl);

    if (!snapshots.length) {
      throw new Error(
        "No snapshots found. Open the Snapshots side panel, capture screens, then click Send snapshots to notebook."
      );
    }

    if (!session?.sourceIds?.length) {
      this.emitProgress(options.onProgress, {
        phase: "importing",
        message: `Uploading ${snapshots.length} snapshot image${snapshots.length === 1 ? "" : "s"} to this notebook...`
      });

      const sourceIds = await NotebookToolsSnapshotUpload.uploadSnapshotsAsImages(
        targetNotebookId,
        snapshots,
        {
          onProgress: (event) => {
            this.emitProgress(options.onProgress, {
              phase: "importing",
              message: event.message || "Uploading snapshot images..."
            });
          }
        }
      );

      session = await NotebookToolsSnapshotStore.setSession({
        notebookId: targetNotebookId,
        snapshots,
        sourceIds,
        pageTitle: snapshots[0]?.title || "Captured screens",
        outputType: options.outputType || session?.outputType || "blog",
        uploadedAt: Date.now()
      });
    }

    return session;
  },

  async createDocument({
    notebookId,
    chatPayload,
    snapshots = [],
    outputType = "blog",
    guideTitle = "",
    guideContext = "",
    onProgress
  } = {}) {
    const targetNotebookId = String(notebookId || this.getNotebookIdFromUrl()).trim();

    if (!targetNotebookId) {
      throw new Error("Open a NotebookLM notebook first.");
    }

    if (!snapshots.length) {
      throw new Error("No snapshots available for this session. Capture screenshots in the side panel first.");
    }

    this.emitProgress(onProgress, {
      phase: "assembling",
      message: "Combining article with snapshot images..."
    });

    const payload = chatPayload || NotebookToolsNotebookLmChatExtract.extractNotebookLmChat();
    const article = NotebookToolsSnapshotAssembler.assemble({
      chatPayload: payload,
      snapshots,
      outputType,
      guideTitle: guideTitle || "",
      guideContext: guideContext || ""
    });

    this.emitProgress(onProgress, {
      phase: "exporting",
      message: "Building downloadable document (HTML, DOC, PDF)..."
    });

    const result = await NotebookToolsBlogDocExport.prepareBlogDoc(article, {
      imageLabel: "snapshot"
    });

    this.emitProgress(onProgress, {
      phase: "complete",
      message: `Ready to download — ${result.imageCount} images embedded`,
      filename: result.filename,
      content: result.content,
      blocks: result.blocks,
      title: result.title
    });

    return {
      ...result,
      title: result.title || article.title,
      blocks: result.blocks,
      snapshotCount: snapshots.length
    };
  },

  async runDiscuss({ session, onProgress } = {}) {
    const snapshots = session?.snapshots || [];

    if (!snapshots.length) {
      throw new Error("No snapshots in session.");
    }

    const prompt = NotebookToolsSnapshotPrompt.build("discuss", {
      snapshotCount: snapshots.length,
      pageTitle: session.pageTitle || snapshots[0]?.title || "the captured screens",
      snapshots
    });

    this.emitProgress(onProgress, {
      phase: "writing",
      message: "Sending discussion prompt to NotebookLM..."
    });

    const { messageCountBefore } = await NotebookToolsBlogChatAutomation.submitPrompt(prompt);

    this.emitProgress(onProgress, {
      phase: "writing",
      message: "NotebookLM is analyzing your snapshots..."
    });

    await NotebookToolsBlogChatAutomation.waitForAssistantReply({
      messageCountBefore,
      slideCount: 0,
      minLength: 200,
      requireAppendix: false,
      stableMs: 4000,
      onProgress: (event) => {
        this.emitProgress(onProgress, {
          phase: "writing",
          message: `Analyzing snapshots (${event.length || 0} characters)...`,
          detail: event.complete ? "Reply complete" : "Still generating"
        });
      }
    });

    this.emitProgress(onProgress, {
      phase: "complete",
      message: "Discussion ready in chat. Ask follow-up questions anytime."
    });

    return { discussed: true };
  },

  async runGenerate({
    session,
    outputType = "blog",
    onProgress
  } = {}) {
    const snapshots = session?.snapshots || [];
    const type = String(outputType || "blog").toLowerCase();

    if (!snapshots.length) {
      throw new Error("No snapshots in session.");
    }

    const prompt = NotebookToolsSnapshotPrompt.build(type, {
      snapshotCount: snapshots.length,
      pageTitle: session.pageTitle || snapshots[0]?.title || "the web app",
      guideTitle: session.guideTitle || "",
      guideContext: session.guideContext || "",
      guideContext: session.guideContext || "",
      snapshots
    });

    this.emitProgress(onProgress, {
      phase: "writing",
      message: type === "guide" ? "Requesting web app guide..." : "Requesting blog article..."
    });

    const { messageCountBefore } = await NotebookToolsBlogChatAutomation.submitPrompt(prompt);

    if (session.notebookId) {
      await NotebookToolsSnapshotStore.setAwaitingDoc(session.notebookId, {
        messageCountBefore,
        outputType: type,
        awaitingStartedAt: Date.now()
      });
    }

    this.emitProgress(onProgress, {
      phase: "writing",
      message: "NotebookLM is writing...",
      detail: "Watching chat — DOC will be built when the reply is complete"
    });

    const minLength = Math.max(type === "guide" ? 1600 : 600, snapshots.length * (type === "guide" ? 500 : 280));

    await NotebookToolsBlogChatAutomation.waitForAssistantReply({
      messageCountBefore,
      slideCount: snapshots.length,
      minLength,
      requireAppendix: type === "blog",
      requireGuideComplete: type === "guide",
      onProgress: (event) => {
        this.emitProgress(onProgress, {
          phase: "writing",
          message: event.complete
            ? `Draft complete (${event.length || 0} characters)`
            : `Writing (${event.length || 0} characters)...`,
          detail: event.complete
            ? "Picking up response and building DOC..."
            : type === "blog"
              ? "Including conclusion and FAQs"
              : "Building sections"
        });
      }
    });

    if (type !== "discuss") {
      const messages = NotebookToolsNotebookLmChatExtract.extractNotebookLmMessages();
      const lastAssistant = messages.filter((message) => {
        const role = String(message?.role || "").toLowerCase();
        return role.includes("notebooklm") || role.includes("assistant") || role.includes("gemini");
      }).slice(-1)[0];

      if (lastAssistant) {
        await NotebookToolsBlogChatAutomation.copyBlogToClipboard(lastAssistant).catch(() => {});
      }
    }

    this.emitProgress(onProgress, {
      phase: "assembling",
      message: "Embedding snapshot images into document..."
    });

    const chatPayload = NotebookToolsNotebookLmChatExtract.extractNotebookLmChat();
    const result = await this.createDocument({
      notebookId: session.notebookId,
      chatPayload,
      snapshots,
      outputType: type,
      guideTitle: session.guideTitle || "",
      guideContext: session.guideContext || "",
      onProgress
    });

    if (session.notebookId) {
      await NotebookToolsSnapshotStore.setDocReady(session.notebookId, {
        docTitle: result.title,
        docImageCount: result.imageCount || snapshots.length
      });
    }

    return result;
  },

  async resumeAwaitingDoc({ onProgress } = {}) {
    const currentNotebookId = this.getNotebookIdFromUrl();

    if (!currentNotebookId) {
      throw new Error("Open a NotebookLM notebook first.");
    }

    const session = await this.ensureSessionForNotebook(currentNotebookId);

    if (!session?.awaitingDoc || !session?.snapshots?.length) {
      return null;
    }

    return this.watchAndBuildDoc({
      session,
      messageCountBefore: session.messageCountBefore,
      outputType: session.outputType,
      onProgress
    });
  },

  async runFullAuto({ outputType, autoDownloadDoc = true, onProgress } = {}) {
    const currentNotebookId = this.getNotebookIdFromUrl();

    if (!currentNotebookId) {
      throw new Error("Open a NotebookLM notebook first.");
    }

    const session = await this.ensureSessionForNotebook(currentNotebookId, {
      outputType,
      onProgress
    });
    const type = String(outputType || session.outputType || "blog").toLowerCase();

    if (type === "discuss") {
      return this.runDiscuss({ session, onProgress });
    }

    const result = await this.runGenerate({
      session,
      outputType: type,
      onProgress
    });

    if (autoDownloadDoc && result?.blocks?.length) {
      this.emitProgress(onProgress, {
        phase: "exporting",
        message: "Downloading DOC with inline snapshot images..."
      });

      await NotebookToolsBlogDocExport.downloadFormat(
        { title: result.title, blocks: result.blocks },
        "doc"
      );

      this.emitProgress(onProgress, {
        phase: "complete",
        message: `DOC downloaded — ${result.imageCount || result.snapshotCount || 0} images embedded`,
        filename: result.filename,
        content: result.content,
        blocks: result.blocks,
        title: result.title,
        docDownloaded: true
      });
    }

    return result;
  },

  async runFromSession({ outputType, autoDownloadDoc = false, onProgress } = {}) {
    const currentNotebookId = this.getNotebookIdFromUrl();

    if (!currentNotebookId) {
      throw new Error("Open a NotebookLM notebook first.");
    }

    const session = await this.ensureSessionForNotebook(currentNotebookId, {
      outputType,
      onProgress
    });
    const type = String(outputType || session.outputType || "blog").toLowerCase();

    if (type === "discuss") {
      return this.runDiscuss({ session, onProgress });
    }

    const result = await this.runGenerate({ session, outputType: type, onProgress });

    if (autoDownloadDoc && result?.blocks?.length) {
      await NotebookToolsBlogDocExport.downloadFormat(
        { title: result.title, blocks: result.blocks },
        "doc"
      );
    }

    return result;
  },

  async buildDocFromChat({ session, outputType, onProgress } = {}) {
    const currentNotebookId = this.getNotebookIdFromUrl();
    const activeSession =
      session ||
      (await this.ensureSessionForNotebook(currentNotebookId, {
        outputType,
        onProgress
      }));

    if (!activeSession?.snapshots?.length) {
      throw new Error("No snapshots available for this notebook.");
    }

    return this.createDocument({
      notebookId: activeSession.notebookId,
      snapshots: activeSession.snapshots,
      outputType: outputType || activeSession.outputType || "blog",
      guideTitle: activeSession.guideTitle || "",
      guideContext: activeSession.guideContext || "",
      onProgress
    });
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsSnapshotWorkflow = NotebookToolsSnapshotWorkflow;
}
