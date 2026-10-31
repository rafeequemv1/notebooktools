const NotebookToolsBlogChatAutomation = {
  sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  },

  findChatInput() {
    const selectors = [
      "textarea[placeholder*='Ask']",
      "textarea[aria-label='Query box']",
      "textarea[placeholder*='Start typing']",
      "textarea[aria-label*='Query']",
      "textarea.query-box-input"
    ];

    for (const selector of selectors) {
      const input = document.querySelector(selector);

      if (input instanceof HTMLTextAreaElement) {
        return input;
      }
    }

    return null;
  },

  findSendButton(input) {
    const candidates = [
      () => input?.closest("form")?.querySelector("button[type='submit']:not([disabled])"),
      () => input?.closest(".query-box")?.querySelector("button:not([disabled])"),
      () => document.querySelector("button[aria-label*='Send']:not([disabled])"),
      () => document.querySelector("button.send-button:not([disabled])")
    ];

    for (const getButton of candidates) {
      const button = getButton();

      if (button instanceof HTMLButtonElement) {
        return button;
      }
    }

    return null;
  },

  setInputValue(input, value) {
    input.focus();

    const descriptor = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    );

    if (descriptor?.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  },

  getAssistantMessages(messages) {
    return (messages || []).filter((message) => {
      const role = String(message?.role || "").toLowerCase();
      return role.includes("notebooklm") || role.includes("assistant") || role.includes("gemini");
    });
  },

  async submitPrompt(prompt) {
    const input = this.findChatInput();

    if (!input) {
      throw new Error("Could not find NotebookLM chat input.");
    }

    const messageCountBefore = NotebookToolsNotebookLmChatExtract.extractNotebookLmMessages().length;
    this.setInputValue(input, String(prompt || "").trim());
    await this.sleep(120);

    const sendButton = this.findSendButton(input);

    if (sendButton) {
      sendButton.click();
    } else {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          bubbles: true
        })
      );
    }

    return { messageCountBefore, input };
  },

  isBlogComplete(body, slideCount = 0) {
    const text = String(body || "");
    const lower = text.toLowerCase();
    const hasConclusion =
      /#{2,3}\s+conclusion\b/i.test(text) || /\bconclusion:\s+/i.test(text);
    const faqQuestions = text.match(/^###\s+.+\?\s*$/gim) || [];
    const hasFaq =
      /#{2,3}\s+(frequently asked questions|faqs?)\b/i.test(text) ||
      (lower.includes("frequently asked") && /\?/.test(text)) ||
      faqQuestions.length >= 3;
    const minExpected = Math.max(2500, Number(slideCount) * 380);

    return text.length >= minExpected && hasConclusion && hasFaq;
  },

  isGuideComplete(body, snapshotCount = 0) {
    const text = String(body || "");
    const count = Number(snapshotCount) || 0;
    const stepSections = (text.match(/^##\s+step\s*\d+/gim) || []).length;
    const hasTips = /#{2,3}\s+tips\b/i.test(text);
    const hasQuickRef = /#{2,3}\s+quick reference\b/i.test(text);
    const minExpected = Math.max(1600, count * 500);

    return (
      text.length >= minExpected &&
      stepSections >= Math.max(1, count) &&
      hasTips &&
      hasQuickRef
    );
  },

  async waitForAssistantReply(options = {}) {
    const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 420000;
    const minLength = Number(options.minLength) > 0 ? Number(options.minLength) : 200;
    const stableMs = Number(options.stableMs) > 0 ? Number(options.stableMs) : 6000;
    const slideCount = Number(options.slideCount) || 0;
    const requireAppendix = options.requireAppendix !== false;
    const requireGuideComplete = options.requireGuideComplete === true;
    const messageCountBefore = Number(options.messageCountBefore) || 0;
    const startedAt = Date.now();
    let lastBody = "";
    let stableSince = 0;
    let bestBody = "";

    while (Date.now() - startedAt < timeoutMs) {
      const messages = NotebookToolsNotebookLmChatExtract.extractNotebookLmMessages();
      const assistantMessages = this.getAssistantMessages(messages);
      const lastAssistant = assistantMessages[assistantMessages.length - 1];

      if (lastAssistant && messages.length > messageCountBefore) {
        const body = String(lastAssistant.body || "").trim();

        if (body.length > bestBody.length) {
          bestBody = body;
        }

        if (body.length >= minLength) {
          const complete = requireGuideComplete
            ? this.isGuideComplete(body, slideCount)
            : !requireAppendix || this.isBlogComplete(body, slideCount);

          if (body === lastBody) {
            if (!stableSince) {
              stableSince = Date.now();
            }

            if (Date.now() - stableSince >= stableMs && complete) {
              return { ...lastAssistant, body };
            }

            if (Date.now() - stableSince >= stableMs * 3 && body.length >= minLength) {
              return { ...lastAssistant, body };
            }
          } else {
            lastBody = body;
            stableSince = 0;

            if (typeof options.onProgress === "function") {
              options.onProgress({
                phase: "generating",
                length: body.length,
                elapsedMs: Date.now() - startedAt,
                complete
              });
            }
          }
        }
      }

      await this.sleep(1500);
    }

    if (bestBody.length >= minLength) {
      return { body: bestBody, role: "NotebookLM" };
    }

    throw new Error("Timed out waiting for NotebookLM to finish the blog article.");
  },

  async copyBlogToClipboard(message) {
    const body = String(message?.body || "").trim();

    if (!body) {
      throw new Error("No blog text available to copy.");
    }

    await navigator.clipboard.writeText(body);
    return body;
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsBlogChatAutomation = NotebookToolsBlogChatAutomation;
}
