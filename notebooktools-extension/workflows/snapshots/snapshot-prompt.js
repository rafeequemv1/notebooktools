const NotebookToolsSnapshotPrompt = {
  OUTPUT_TYPES: {
    discuss: "discuss",
    blog: "blog",
    guide: "guide"
  },

  formatSnapshotContext(snapshots = []) {
    const items = Array.isArray(snapshots) ? snapshots.filter((item) => item?.dataUrl) : [];

    if (!items.length) {
      return "";
    }

    return items
      .map((snapshot, index) => {
        const step = index + 1;
        const action = String(snapshot.caption || snapshot.action || "").trim();
        const page = String(snapshot.title || "").trim();
        const url = String(snapshot.url || "").trim();
        const lines = [`Screenshot ${step} (uploaded image source ${step}):`];

        if (action) {
          lines.push(`- Recorded action: ${action}`);
        } else {
          lines.push("- User context: (not provided — infer from the image)");
        }

        if (page) {
          lines.push(`- Page title when captured: ${page}`);
        }

        if (url && /^https?:\/\//i.test(url)) {
          lines.push(`- URL when captured: ${url}`);
        }

        lines.push(
          `- Your ## Step ${step} section must explain ONLY this screenshot — buttons, fields, menus, and outcomes visible on THIS screen`
        );

        return lines.join("\n");
      })
      .join("\n\n");
  },

  buildDiscuss({ snapshotCount = 0, pageTitle = "the captured screens" } = {}) {
    const count = Number(snapshotCount) > 0 ? Number(snapshotCount) : 0;

    return [
      `I uploaded ${count || "several"} screenshot image${count === 1 ? "" : "s"} from "${pageTitle}" to this notebook.`,
      "",
      "Please analyze what you see across the screenshots:",
      "- Summarize the product, flow, or UI shown",
      "- Call out key screens, actions, and user goals",
      "- Note anything confusing, missing, or worth improving",
      "- Answer follow-up questions I ask about specific screens",
      "",
      "Refer to screenshots by screen order (Snapshot 1, Snapshot 2, etc.).",
      "Do not describe image pixels or bracket placeholders — focus on product meaning."
    ].join("\n");
  },

  buildBlog({ snapshotCount = 0, pageTitle = "the captured screens", extraInstructions = "" } = {}) {
    const count = Number(snapshotCount) > 0 ? Number(snapshotCount) : 0;

    return [
      `Write a complete, publish-ready SEO blog article based on the ${count || ""} screenshot image source${count === 1 ? "" : "s"} from "${pageTitle}" in this notebook.`,
      "",
      "Use only information visible in the screenshots.",
      "",
      "Writing style:",
      "- Natural educational blog prose — not UI notes or bullet dumps",
      "- Each ## heading is a short title (under 12 words); explanation goes in paragraphs below",
      "- Sentence-case headings, short paragraphs, bullet lists where helpful",
      "- No bracket placeholders — write real content",
      "- Do not describe what images look like; do not mention screenshots, PDFs, or NotebookLM",
      "",
      "Structure:",
      "- Line 1: # title",
      "- Line 2: meta description (one sentence)",
      count > 0
        ? `- Then ${count} ## sections in screenshot order. Use headings like ## Snapshot 1: short title, ## Snapshot 2: … through Snapshot ${count}`
        : "- Then clear ## section headings in screenshot order",
      "- End with ## Conclusion (2–3 paragraphs)",
      "- Then ## Frequently Asked Questions with 4–6 Q&A pairs (### question, short answer)",
      extraInstructions ? extraInstructions.trim() : ""
    ]
      .filter(Boolean)
      .join("\n");
  },

  buildGuide({
    snapshotCount = 0,
    pageTitle = "the web app",
    guideTitle = "",
    guideContext = "",
    snapshots = [],
    extraInstructions = ""
  } = {}) {
    const count = Number(snapshotCount) > 0 ? Number(snapshotCount) : snapshots.length;
    const title = String(guideTitle || "").trim() || `How to use ${pageTitle}`;
    const context = String(guideContext || "").trim();
    const snapshotContext = this.formatSnapshotContext(snapshots);

    return [
      `Write a complete, screenshot-by-screenshot web app tutorial using the ${count || ""} uploaded image source${count === 1 ? "" : "s"} from "${pageTitle}" in this notebook.`,
      "",
      `Tutorial title: ${title}`,
      context ? `Overall goal: ${context}` : "",
      "",
      "IMPORTANT: Each uploaded image is a separate source numbered 1, 2, 3… The final document embeds each screenshot directly under its step. Your text must explain what happens on THAT exact screen.",
      "",
      snapshotContext,
      "",
      "Audience: a new user completing this workflow for the first time.",
      "",
      "Writing rules:",
      "- One ## Step N section per screenshot, in order — do not skip or merge steps",
      "- Use the user context line above as the basis for each step heading and opening sentence",
      "- Study each image source: name real buttons, menu items, fields, and labels you see on THAT screen",
      "- Write 3–5 short paragraphs OR a numbered sub-list (1. 2. 3.) per step — minimum 120 words per step",
      "- Connect steps: open with how this follows from the previous step; close with what to check before continuing",
      "- Conversational and helpful — like a colleague sitting beside them",
      "- Do not write generic filler; every sentence should help on that specific screen",
      "- No bracket placeholders; do not say \"the image shows\" or mention NotebookLM/PDFs",
      "",
      "Required structure:",
      `- Line 1: # ${title}`,
      "- Line 2: one-sentence overview of the full workflow",
      "- ## Before you begin — what to open, permissions, 2–4 sentences",
      count > 0
        ? [
            `- Exactly ${count} step sections, one per screenshot:`,
            "  ## Step 1: (short name from screenshot 1 context)",
            "  Opening sentence tying to screenshot 1. Then detailed instructions for that screen only.",
            "  … repeat for each screenshot through …",
            `  ## Step ${count}: (short name from screenshot ${count} context)`
          ].join("\n")
        : "- ## Step sections in screenshot order",
      "- ## Tips & troubleshooting — 3–5 issues tied to steps above",
      "- ## Quick reference — numbered checklist mirroring every step",
      extraInstructions ? extraInstructions.trim() : ""
    ]
      .filter(Boolean)
      .join("\n");
  },

  build(outputType, options = {}) {
    const type = String(outputType || "blog").toLowerCase();

    if (type === this.OUTPUT_TYPES.discuss) {
      return this.buildDiscuss(options);
    }

    if (type === this.OUTPUT_TYPES.guide) {
      return this.buildGuide(options);
    }

    return this.buildBlog(options);
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsSnapshotPrompt = NotebookToolsSnapshotPrompt;
}
