const NotebookToolsBulkRunner = (() => {
  function isSourceLimitError(message) {
    return /source limit|SOURCE_LIMIT_REACHED/i.test(String(message || ""));
  }

  async function importItem(notebookId, item) {
    if (item.type === "youtube") {
      await NotebookToolsNotebookLM.addYoutubeToNotebookLm(notebookId, item.url);
      return;
    }

    await NotebookToolsNotebookLM.addWebpageToNotebookLm(notebookId, item.url);
  }

  async function run({
    items,
    notebookId,
    onProgress = () => {},
    shouldCancel = () => false
  }) {
    const summary = {
      success: 0,
      failed: 0,
      skipped: 0,
      cancelled: false,
      stoppedByLimit: false
    };

    for (let index = 0; index < items.length; index += 1) {
      if (shouldCancel()) {
        summary.cancelled = true;
        break;
      }

      const item = items[index];

      if (!item.selected || item.status !== "pending") {
        continue;
      }

      onProgress({ index, item, phase: "importing" });

      try {
        await importItem(notebookId, item);
        item.status = "success";
        item.error = "";
        summary.success += 1;
      } catch (error) {
        const message = error?.message || "Import failed.";
        item.status = "failed";
        item.error = message;
        summary.failed += 1;

        if (isSourceLimitError(message)) {
          summary.stoppedByLimit = true;

          for (let rest = index + 1; rest < items.length; rest += 1) {
            const pending = items[rest];

            if (pending.selected && pending.status === "pending") {
              pending.status = "skipped";
              pending.error = "Notebook source limit reached.";
              summary.skipped += 1;
              onProgress({ index: rest, item: pending, phase: "skipped", summary });
            }
          }

          onProgress({ index, item, phase: "failed", summary });
          break;
        }
      }

      onProgress({ index, item, phase: "done", summary });

      if (index < items.length - 1 && !shouldCancel()) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 600);
        });
      }
    }

    return summary;
  }

  return { run };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsBulkRunner = NotebookToolsBulkRunner;
}
