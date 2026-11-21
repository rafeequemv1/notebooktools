/* Answer cleaner: tidy text copied out of a NotebookLM chat answer.
   Removes citation numbers and the "…" markers, and gives plain text or
   Markdown. */
(() => {
  const { $, words, fmt, copy, download } = window.NTTools;
  const input = $("#acInput");
  const output = $("#acOutput");
  const stats = $("#acStats");

  function removeCitations(text) {
    return text
      // [1], [1, 2], [3-5]
      .replace(/\s*\[\d{1,3}(?:\s*[,–-]\s*\d{1,3})*\]/g, "")
      // Copied citation chips: " 6" or " 9 10" or " 6 …" right before punctuation or a line end
      .replace(/(?<=[^\s\d])(?:\s+\d{1,3}){1,6}(?:\s*(?:…|\.\.\.))?(?=\s*[.,;:!?)]|\s*$)/gm, "")
      // Leftover lone ellipsis markers before punctuation: "degradation … ."
      .replace(/\s+(?:…|\.\.\.)(?=\s*[.,;:!?])/g, "")
      .replace(/[ \t]+([.,;:!?])/g, "$1");
  }

  function toPlain(text) {
    return text
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1$2")
      .replace(/^\s*[○•◦▪]\s+/gm, "- ");
  }

  function toMarkdown(text) {
    return text.replace(/^\s*[○•◦▪]\s+/gm, "- ");
  }

  function run() {
    let text = input.value.replace(/\r\n?/g, "\n");
    if ($("#acCitations").checked) text = removeCitations(text);
    text = $("#acFormat").value === "plain" ? toPlain(text) : toMarkdown(text);
    if ($("#acSpacing").checked) text = text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");
    output.value = text.trim();
    const n = words(output.value);
    stats.textContent = n ? `${fmt(n)} words` : "";
    $("#acCopy").disabled = !n;
    $("#acDownload").disabled = !n;
  }

  input.addEventListener("input", run);
  ["#acCitations", "#acFormat", "#acSpacing"].forEach((s) => $(s).addEventListener("change", run));
  $("#acCopy").addEventListener("click", (e) => copy(output.value, e.currentTarget));
  $("#acDownload").addEventListener("click", () => {
    const md = $("#acFormat").value !== "plain";
    download(md ? "notebooklm-answer.md" : "notebooklm-answer.txt", output.value + "\n", md ? "text/markdown" : "text/plain");
  });
  $("#acSample").addEventListener("click", () => {
    input.value = `Autophagy takes four primary forms 5 …:

○ **Macroautophagy:** The most researched form, where cytoplasmic components are engulfed in a double-membrane vesicle called an **autophagosome**, which then fuses with a lysosome for degradation 6 … .
○ **Microautophagy:** Involves the direct engulfment of material by the lysosome through membrane invagination 9 10 .
○ **Chaperone-mediated autophagy (CMA):** A highly selective process [11, 12].`;
    run();
  });
  run();
})();
