const NotebookToolsBlogHistory = {
  STORAGE_KEY: "notebooktoolsBlogHistory",
  MAX_ITEMS: 20,

  stripBlocksForStorage(blocks) {
    if (!Array.isArray(blocks)) {
      return null;
    }

    return blocks.map((block) => {
      if (block.type !== "image") {
        return block;
      }

      return {
        ...block,
        dataUrl: "",
        imageUrl: block.imageUrl || ""
      };
    });
  },

  async list(notebookId = "") {
    const stored = await chrome.storage.local.get(this.STORAGE_KEY);
    const items = Array.isArray(stored[this.STORAGE_KEY]) ? stored[this.STORAGE_KEY] : [];
    const notebookKey = String(notebookId || "").trim();

    if (!notebookKey) {
      return items;
    }

    return items.filter((item) => item.notebookId === notebookKey);
  },

  async save(entry) {
    const stored = await chrome.storage.local.get(this.STORAGE_KEY);
    const items = Array.isArray(stored[this.STORAGE_KEY]) ? stored[this.STORAGE_KEY] : [];
    const record = {
      id: entry.id || crypto.randomUUID(),
      title: String(entry.title || "Blog article").trim(),
      filename: String(entry.filename || "blog-article.html").trim(),
      notebookId: String(entry.notebookId || "").trim(),
      deckTitle: String(entry.deckTitle || "").trim(),
      imageCount: Number(entry.imageCount) || 0,
      slideCount: Number(entry.slideCount) || 0,
      createdAt: entry.createdAt || new Date().toISOString(),
      content: String(entry.content || ""),
      blocks: Array.isArray(entry.blocks) ? entry.blocks : null
    };

    const variants = [
      record,
      { ...record, blocks: this.stripBlocksForStorage(record.blocks) },
      { ...record, blocks: null }
    ];

    let next = [record, ...items.filter((item) => item.id !== record.id)];

    while (next.length > this.MAX_ITEMS) {
      next = next.slice(0, this.MAX_ITEMS);
    }

    for (const variant of variants) {
      const attempt = [{ ...variant, id: record.id }, ...items.filter((item) => item.id !== record.id)].slice(
        0,
        this.MAX_ITEMS
      );

      try {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: attempt });
        return { ...variant, id: record.id };
      } catch (_error) {
        continue;
      }
    }

    while (next.length) {
      try {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: next });
        return record;
      } catch (_error) {
        next = next.slice(0, -1);

        if (!next.length) {
          throw new Error("Could not save blog history. The document may be too large.");
        }
      }
    }

    throw new Error("Could not save blog history.");
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsBlogHistory = NotebookToolsBlogHistory;
}
