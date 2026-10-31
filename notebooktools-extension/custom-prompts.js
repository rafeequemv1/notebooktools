const CUSTOM_PROMPTS_KEY = "notebooktoolsCustomPrompts";

const PROMPT_TYPES = ["text", "presentation", "infographic", "podcast", "other"];
const DEFAULT_PROMPT_TYPE = "other";

const PROMPT_TYPE_LABELS = {
  text: "Text",
  presentation: "Presentation",
  infographic: "Infographic",
  podcast: "Podcast",
  other: "Other"
};

function normalizePromptType(value) {
  const cleaned = String(value || "").trim().toLowerCase();
  return PROMPT_TYPES.includes(cleaned) ? cleaned : DEFAULT_PROMPT_TYPE;
}

const NotebookToolsCustomPrompts = {
  PROMPT_TYPES,
  DEFAULT_PROMPT_TYPE,
  PROMPT_TYPE_LABELS,

  async list() {
    const stored = await chrome.storage.local.get(CUSTOM_PROMPTS_KEY);
    const items = stored[CUSTOM_PROMPTS_KEY];

    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .filter((item) => item && item.id && item.prompt)
      .map((item) => ({
        ...item,
        type: normalizePromptType(item.type)
      }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  async save({ title, prompt, id = null, type = DEFAULT_PROMPT_TYPE }) {
    const cleanedTitle = String(title || "").trim() || "Untitled prompt";
    const cleanedPrompt = String(prompt || "").trim();
    const cleanedType = normalizePromptType(type);

    if (!cleanedPrompt) {
      throw new Error("Prompt text cannot be empty.");
    }

    const items = await this.list();
    const now = Date.now();

    if (id) {
      const index = items.findIndex((item) => item.id === id);

      if (index === -1) {
        throw new Error("Prompt not found.");
      }

      items[index] = {
        ...items[index],
        title: cleanedTitle,
        prompt: cleanedPrompt,
        type: cleanedType,
        updatedAt: now
      };
    } else {
      items.unshift({
        id: `custom-${now}-${Math.random().toString(36).slice(2, 8)}`,
        title: cleanedTitle,
        prompt: cleanedPrompt,
        type: cleanedType,
        createdAt: now,
        updatedAt: now
      });
    }

    await chrome.storage.local.set({ [CUSTOM_PROMPTS_KEY]: items });
    return id ? items.find((item) => item.id === id) : items[0];
  },

  async rename(id, title) {
    const items = await this.list();
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error("Prompt not found.");
    }

    const cleanedTitle = String(title || "").trim();

    if (!cleanedTitle) {
      throw new Error("Title cannot be empty.");
    }

    items[index] = {
      ...items[index],
      title: cleanedTitle,
      updatedAt: Date.now()
    };

    await chrome.storage.local.set({ [CUSTOM_PROMPTS_KEY]: items });
    return items[index];
  },

  async remove(id) {
    const items = await this.list();
    const next = items.filter((item) => item.id !== id);
    await chrome.storage.local.set({ [CUSTOM_PROMPTS_KEY]: next });
    return next;
  },

  async getById(id) {
    return (await this.list()).find((item) => item.id === id) || null;
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsCustomPrompts = NotebookToolsCustomPrompts;
}
