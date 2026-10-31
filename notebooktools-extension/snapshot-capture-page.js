const NotebookToolsSnapshotPageCapture = {
  isUnsupportedColorError(error) {
    const message = String(error?.message || error || "");

    return /unsupported color function|oklch|oklab|color\(|lab\(|lch\(/i.test(message);
  },

  buildCaptureOptions(rect = null) {
    const scale = window.devicePixelRatio || 1;
    const options = {
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      scale,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
      ignoreElements: (element) => {
        const id = element?.id || "";
        return id === "notebooktools-snapshot-overlay" || id === "notebooktools-snapshot-annotate";
      }
    };

    if (rect && rect.width > 0 && rect.height > 0) {
      options.x = window.scrollX + rect.x;
      options.y = window.scrollY + rect.y;
      options.width = rect.width;
      options.height = rect.height;
    } else {
      options.x = window.scrollX;
      options.y = window.scrollY;
      options.width = window.innerWidth;
      options.height = window.innerHeight;
    }

    return options;
  },

  async captureVisibleTabFallback(rect = null) {
    const response = await chrome.runtime.sendMessage({
      type: "notebooktools-capture-region",
      rect,
      devicePixelRatio: window.devicePixelRatio || 1,
      returnDataOnly: true
    });

    if (!response?.ok || !String(response.dataUrl || "").startsWith("data:image/")) {
      throw new Error(response?.error || "Visible tab capture failed.");
    }

    return response.dataUrl;
  },

  async capture(rect = null) {
    if (typeof html2canvas !== "function") {
      return this.captureVisibleTabFallback(rect);
    }

    try {
      const canvas = await html2canvas(document.body, this.buildCaptureOptions(rect));
      return canvas.toDataURL("image/png");
    } catch (error) {
      if (this.isUnsupportedColorError(error)) {
        return this.captureVisibleTabFallback(rect);
      }

      throw error;
    }
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsSnapshotPageCapture = NotebookToolsSnapshotPageCapture;
}
