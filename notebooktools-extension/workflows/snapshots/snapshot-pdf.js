const NotebookToolsSnapshotPdf = {
  dataUrlToUint8Array(dataUrl) {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);

    for (let index = 0; index < raw.length; index += 1) {
      out[index] = raw.charCodeAt(index);
    }

    return out;
  },

  async pngToJpegBytes(pngDataUrl, quality = 0.82) {
    const image = new Image();
    image.src = pngDataUrl;

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Could not read snapshot image."));
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext("2d");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);

    const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
    return this.dataUrlToUint8Array(jpegDataUrl);
  },

  formatSize(bytes) {
    const value = Number(bytes) || 0;

    if (value < 1024) {
      return `${value} B`;
    }

    if (value < 1024 * 1024) {
      return `${(value / 1024).toFixed(1)} KB`;
    }

    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  },

  safeFilename(title, fallback = "snapshots") {
    const base = String(title || fallback)
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 72);

    return `${base || fallback}.pdf`;
  },

  async buildPdfFromSnapshots(snapshots = [], options = {}) {
    const items = (snapshots || []).filter((item) => item?.dataUrl);

    if (!items.length) {
      throw new Error("No snapshot images to upload.");
    }

    if (!PDFLib?.PDFDocument) {
      throw new Error("PDF library is not available.");
    }

    const pdfDoc = await PDFLib.PDFDocument.create();
    const quality = Number(options.jpegQuality) > 0 ? Number(options.jpegQuality) : 0.82;

    for (let index = 0; index < items.length; index += 1) {
      const snapshot = items[index];

      if (typeof options.onProgress === "function") {
        options.onProgress({
          phase: "rendering",
          current: index + 1,
          total: items.length
        });
      }

      const jpegBytes = await this.pngToJpegBytes(snapshot.dataUrl, quality);
      const image = await pdfDoc.embedJpg(jpegBytes);
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height
      });
    }

    const bytes = await pdfDoc.save();
    return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsSnapshotPdf = NotebookToolsSnapshotPdf;
}
