const NotebookToolsSnapshotUpload = {
  dataUrlToBytes(dataUrl) {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);

    for (let index = 0; index < raw.length; index += 1) {
      out[index] = raw.charCodeAt(index);
    }

    return out;
  },

  safeImageFilename(index, title = "") {
    const label = String(title || "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);

    const suffix = label ? `-${label}` : "";
    return `snapshot-${String(index + 1).padStart(2, "0")}${suffix}.png`;
  },

  async uploadSnapshotsAsImages(notebookId, snapshots = [], options = {}) {
    const targetNotebookId = String(notebookId || "").trim();
    const items = (snapshots || []).filter((item) => item?.dataUrl);

    if (!targetNotebookId) {
      throw new Error("Choose a NotebookLM notebook first.");
    }

    if (!items.length) {
      throw new Error("No snapshots to upload.");
    }

    const sourceIds = [];

    for (let index = 0; index < items.length; index += 1) {
      const snapshot = items[index];
      const bytes = this.dataUrlToBytes(snapshot.dataUrl);
      const filename = this.safeImageFilename(index, snapshot.caption || snapshot.title);
      const title = snapshot.caption || snapshot.title || `Snapshot ${index + 1}`;

      if (typeof options.onProgress === "function") {
        options.onProgress({
          phase: "uploading",
          current: index + 1,
          total: items.length,
          message: `Uploading image ${index + 1} of ${items.length}...`
        });
      }

      const uploadResult = await NotebookToolsNotebookLM.addImageBytesToNotebookLm(
        targetNotebookId,
        filename,
        bytes,
        { title }
      );

      if (typeof options.onProgress === "function") {
        options.onProgress({
          phase: "processing",
          current: index + 1,
          total: items.length,
          message: `Processing image ${index + 1} of ${items.length}...`
        });
      }

      await NotebookToolsNotebookLM.waitForSourceReady(targetNotebookId, uploadResult.sourceId, {
        onProgress: (event) => {
          if (typeof options.onProgress === "function") {
            options.onProgress({
              phase: "processing",
              current: index + 1,
              total: items.length,
              message:
                event?.phase === "processing"
                  ? `Processing image ${index + 1} on NotebookLM...`
                  : `Waiting for image ${index + 1}...`
            });
          }
        }
      });

      sourceIds.push(uploadResult.sourceId);
    }

    return sourceIds;
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsSnapshotUpload = NotebookToolsSnapshotUpload;
}
