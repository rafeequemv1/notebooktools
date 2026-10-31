const NotebookToolsBlogPrompt = {
  build({
    deckTitle = "the slide deck",
    slideCount = 0,
    importedPdfSource = false,
    extraInstructions = ""
  } = {}) {
    const count = Number(slideCount) > 0 ? Number(slideCount) : 0;
    const intro = importedPdfSource
      ? `Write a complete, publish-ready SEO blog article based on the slide deck PDF that was just uploaded to this notebook ("${deckTitle}").`
      : `Write a complete, publish-ready SEO blog article based on the slide deck PDF in this notebook ("${deckTitle}").`;

    return [
      intro,
      "",
      "Use only information from the PDF source.",
      "",
      "Writing style:",
      "- Natural, readable educational blog prose — not slide notes or speaker bullets",
      "- Each ## heading must be a short title only (under 12 words). Put all explanation in paragraphs below the heading.",
      "- Sentence-case section headings (not ALL CAPS)",
      "- Short paragraphs (2–4 sentences) with blank lines between them",
      "- Use bullet lists with - for steps, frameworks, or comparisons",
      "- No bracket placeholders like [example] — write real content instead",
      "- Do not describe what images look like or include alt-text in the article",
      "- Do not mention PDFs, slides, decks, or NotebookLM",
      "",
      "Structure:",
      "- Line 1: # title",
      "- Line 2: meta description (one sentence)",
      count > 0
        ? `- Then ${count} ## sections in the same order as the PDF`
        : "- Then clear ## section headings",
      "- End with ## Conclusion (2–3 paragraphs summarizing key takeaways)",
      "- Then ## Frequently Asked Questions with 4–6 Q&A pairs (### question, short answer paragraph)",
      extraInstructions ? extraInstructions.trim() : ""
    ]
      .filter(Boolean)
      .join("\n");
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsBlogPrompt = NotebookToolsBlogPrompt;
}
