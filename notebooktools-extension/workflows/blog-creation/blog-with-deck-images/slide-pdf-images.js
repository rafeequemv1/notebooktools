const NotebookToolsSlidePdfImages = {
  pdfjsPromise: null,

  async loadPdfJs() {
    if (this.pdfjsPromise) {
      return this.pdfjsPromise;
    }

    this.pdfjsPromise = (async () => {
      const pdfModule = await import(
        chrome.runtime.getURL("vendor/pdfjs/pdf.min.mjs")
      );
      const pdfjsLib = pdfModule.default || pdfModule;

      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
        "vendor/pdfjs/pdf.worker.min.mjs"
      );

      return pdfjsLib;
    })();

    return this.pdfjsPromise;
  },

  getDeckPdfUrl(slideDeck) {
    const pdfUrl = String(slideDeck?.pdfUrl || "").trim();

    if (pdfUrl && /^https?:\/\//i.test(pdfUrl)) {
      return pdfUrl;
    }

    if (slideDeck?.pptxUrl) {
      throw new Error(
        "Only PDF slide decks are supported for inline images. Re-export or regenerate the deck as PDF in NotebookLM."
      );
    }

    throw new Error(
      "No PDF found for this slide deck. Open the deck in Studio and wait until it is fully ready."
    );
  },

  async fetchBinary(url) {
    const targetUrl = String(url || "").trim();

    if (!targetUrl) {
      throw new Error("Missing PDF URL.");
    }

    const fetchDirect = async () => {
      const response = await fetch(targetUrl, {
        credentials: "include",
        mode: "cors",
        referrer: "https://notebooklm.google.com/",
        referrerPolicy: "strict-origin-when-cross-origin"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return new Uint8Array(await response.arrayBuffer());
    };

    try {
      return await fetchDirect();
    } catch (_error) {
      if (!chrome?.runtime?.sendMessage) {
        throw new Error("Could not download the slide deck PDF.");
      }

      const response = await chrome.runtime.sendMessage({
        type: "notebooktools-fetch-media",
        url: targetUrl
      });

      if (!response?.ok || !Array.isArray(response.buffer)) {
        throw new Error(response?.error || "Could not download the slide deck PDF.");
      }

      return Uint8Array.from(response.buffer);
    }
  },

  async renderPdfPage(pdfjsLib, pdfDocument, pageNumber, scale = 1.6, quality = 0.88) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("Could not create slide image canvas.");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport
    }).promise;

    return {
      dataUrl: canvas.toDataURL("image/jpeg", quality),
      width: canvas.width,
      height: canvas.height
    };
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

  dataUrlToUint8Array(dataUrl) {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);

    for (let index = 0; index < raw.length; index += 1) {
      out[index] = raw.charCodeAt(index);
    }

    return out;
  },

  async compressForUpload(pdfBytes, options = {}) {
    const thresholdBytes =
      Number(options.thresholdBytes) > 0 ? Number(options.thresholdBytes) : 60 * 1024 * 1024;
    const targetMaxBytes =
      Number(options.targetMaxBytes) > 0 ? Number(options.targetMaxBytes) : 60 * 1024 * 1024;
    const originalSize = pdfBytes?.length || 0;

    if (!originalSize) {
      throw new Error("PDF file is empty.");
    }

    if (originalSize <= thresholdBytes) {
      return {
        bytes: pdfBytes,
        compressed: false,
        originalSize,
        finalSize: originalSize
      };
    }

    const PDFLib = globalThis.PDFLib;

    if (!PDFLib?.PDFDocument) {
      throw new Error("PDF compression is unavailable. Reload the extension and try again.");
    }

    const pdfjsLib = await this.loadPdfJs();
    const srcDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const pageCount = srcDoc.numPages;
    const presets = [
      { scale: 1.5, quality: 0.85 },
      { scale: 1.25, quality: 0.78 },
      { scale: 1.1, quality: 0.7 },
      { scale: 1.0, quality: 0.62 },
      { scale: 0.85, quality: 0.55 }
    ];

    const emit = (payload) => {
      if (typeof options.onProgress === "function") {
        options.onProgress(payload);
      }
    };

    emit({
      phase: "compressing",
      message: `Compressing PDF (${this.formatSize(originalSize)}) for upload...`,
      current: 0,
      total: pageCount,
      originalSize
    });

    let bestBytes = pdfBytes;

    for (const preset of presets) {
      const outDoc = await PDFLib.PDFDocument.create();

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const rendered = await this.renderPdfPage(
          pdfjsLib,
          srcDoc,
          pageNumber,
          preset.scale,
          preset.quality
        );
        const jpegBytes = this.dataUrlToUint8Array(rendered.dataUrl);
        const image = await outDoc.embedJpg(jpegBytes);
        const dims = image.scale(1);
        const page = outDoc.addPage([dims.width, dims.height]);

        page.drawImage(image, {
          x: 0,
          y: 0,
          width: dims.width,
          height: dims.height
        });

        emit({
          phase: "compressing",
          message: `Compressing PDF — page ${pageNumber} of ${pageCount}`,
          current: pageNumber,
          total: pageCount,
          originalSize,
          preset
        });

        await this.yieldToUi();
      }

      bestBytes = new Uint8Array(await outDoc.save());

      if (bestBytes.length <= targetMaxBytes) {
        return {
          bytes: bestBytes,
          compressed: true,
          originalSize,
          finalSize: bestBytes.length
        };
      }
    }

    return {
      bytes: bestBytes,
      compressed: true,
      originalSize,
      finalSize: bestBytes.length
    };
  },

  yieldToUi() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  },

  async extractFromPdfBytes(pdfBytes, slides = [], options = {}) {
    const pdfjsLib = await this.loadPdfJs();
    const pdfDocument = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const pageCount = pdfDocument.numPages;
    const images = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      if (typeof options.onProgress === "function" && pageNumber === 1) {
        options.onProgress({
          phase: "rendering",
          current: 0,
          total: pageCount
        });
      }

      const slideMeta = slides[pageNumber - 1] || {};
      const rendered = await this.renderPdfPage(pdfjsLib, pdfDocument, pageNumber);
      const image = {
        index: pageNumber,
        dataUrl: rendered.dataUrl,
        width: rendered.width,
        height: rendered.height,
        alt: slideMeta.description || slideMeta.text || `Slide ${pageNumber}`,
        caption: ""
      };

      images.push(image);

      if (typeof options.onProgress === "function") {
        options.onProgress({
          phase: "rendering",
          current: pageNumber,
          total: pageCount,
          image
        });
      }

      await this.yieldToUi();
    }

    return images;
  },

  async extractFromDeck(slideDeck, options = {}) {
    const pdfUrl = this.getDeckPdfUrl(slideDeck);

    if (typeof options.onProgress === "function") {
      options.onProgress({ phase: "downloading" });
    }

    const pdfBytes = await this.fetchBinary(pdfUrl);

    if (typeof options.onProgress === "function") {
      options.onProgress({ phase: "parsing" });
    }

    return this.extractFromPdfBytes(pdfBytes, slideDeck?.slides || [], options);
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsSlidePdfImages = NotebookToolsSlidePdfImages;
}
