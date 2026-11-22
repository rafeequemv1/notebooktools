/* Image to text (OCR) with Tesseract.js, in the browser. Several images at
   once; paste from the clipboard works too. */
(() => {
  const P = NTPdf;
  const $ = (s) => document.querySelector(s);
  const results = [];

  async function handle(files) {
    const images = files.filter((f) => /^image\//.test(f.type));
    if (!images.length) return P.status($("#ocrStatus"), "Choose PNG, JPG, WEBP or other images.", "error");
    $("#ocrResult").hidden = false;
    for (let i = 0; i < images.length; i += 1) {
      const f = images[i];
      P.status($("#ocrStatus"), `Loading the text reader… (first time only, about 8 MB)`);
      try {
        const text = await P.ocr(f, (m) => {
          if (m.status === "recognizing text") P.status($("#ocrStatus"), `Reading ${images.length > 1 ? `image ${i + 1} of ${images.length}` : "the image"}… ${Math.round(m.progress * 100)}%`);
        });
        results.push(images.length > 1 || results.length ? `## ${f.name || "Pasted image"}\n\n${text}` : text);
      } catch (error) {
        results.push(`## ${f.name}\n\n(Could not read this image.)`);
      }
      $("#ocrOutput").value = results.join("\n\n");
    }
    const n = P.words($("#ocrOutput").value);
    P.status($("#ocrStatus"), n ? `${NTTools.fmt(n)} words found. Check names and numbers before you use it.` : "No text found. Try a sharper, straighter photo.", n ? "ok" : "error");
    $("#ocrCopy").disabled = $("#ocrDownload").disabled = !n;
  }

  P.dropZone($("#ocrDrop"), { label: "Drop images or screenshots", hint: "paste with Ctrl+V, or", multiple: true, accept: "image/*" }, handle);
  document.addEventListener("paste", (event) => {
    const files = [...(event.clipboardData?.files || [])].filter((f) => /^image\//.test(f.type));
    if (files.length) handle(files);
  });
  $("#ocrCopy").addEventListener("click", (e) => NTTools.copy($("#ocrOutput").value, e.currentTarget));
  $("#ocrDownload").addEventListener("click", () => NTTools.download("image-text.md", $("#ocrOutput").value, "text/markdown"));
  $("#ocrClear").addEventListener("click", () => { results.length = 0; $("#ocrOutput").value = ""; P.status($("#ocrStatus"), ""); });
})();
