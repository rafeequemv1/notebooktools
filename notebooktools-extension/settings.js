const AUTO_OPEN_NOTEBOOK_KEY = "autoOpenNotebookAfterImport";
const YOUTUBE_STUDIO_OPEN_TAB_KEY = "youtubeStudioOpenTab";
const YOUTUBE_STUDIO_ARTIFACT_TYPE_KEY = "youtubeStudioArtifactType";
const APP_SETTINGS_KEY = "notebooktoolsAppSettings";

const YOUTUBE_STUDIO_ARTIFACT_TYPES = [
  { id: "mind_map", label: "Mind map" },
  { id: "slide_deck", label: "Slides" },
  { id: "audio", label: "Podcast" },
  { id: "flashcards", label: "Flashcards" },
  { id: "infographic", label: "Infographic" }
];

const CARD_TAG_OPTIONS = [
  { id: "notebookSources", labelKey: "tagNotebookSources", descKey: "tagNotebookSourcesDesc" },
  { id: "notebookStudio", labelKey: "tagNotebookStudio", descKey: "tagNotebookStudioDesc" },
  { id: "notebookFolder", labelKey: "tagNotebookFolder", descKey: "tagNotebookFolderDesc" },
  { id: "sourceType", labelKey: "tagSourceType", descKey: "tagSourceTypeDesc" },
  { id: "sourceFolder", labelKey: "tagSourceFolder", descKey: "tagSourceFolderDesc" },
  { id: "promptType", labelKey: "tagPromptType", descKey: "tagPromptTypeDesc" },
  { id: "promptCategory", labelKey: "tagPromptCategory", descKey: "tagPromptCategoryDesc" }
];

const DEFAULT_CARD_TAGS = Object.fromEntries(CARD_TAG_OPTIONS.map((option) => [option.id, true]));

const changeListeners = new Set();

const NotebookToolsSettings = {
  CARD_TAG_OPTIONS,
  YOUTUBE_STUDIO_ARTIFACT_TYPES,

  async getAppSettings() {
    const stored = await chrome.storage.local.get(APP_SETTINGS_KEY);
    const raw = stored[APP_SETTINGS_KEY] || {};

    return {
      language: typeof raw.language === "string" ? raw.language : "en",
      cardTags: {
        ...DEFAULT_CARD_TAGS,
        ...(raw.cardTags && typeof raw.cardTags === "object" ? raw.cardTags : {})
      }
    };
  },

  async setAppSettings(partial) {
    const current = await this.getAppSettings();
    const next = {
      language: partial.language ?? current.language,
      cardTags: {
        ...current.cardTags,
        ...(partial.cardTags || {})
      }
    };

    await chrome.storage.local.set({ [APP_SETTINGS_KEY]: next });
    return next;
  },

  isCardTagEnabled(settings, tagId) {
    return settings?.cardTags?.[tagId] !== false;
  },

  onChange(listener) {
    changeListeners.add(listener);

    return () => changeListeners.delete(listener);
  },

  async notifyChange() {
    const settings = await this.getAppSettings();

    for (const listener of changeListeners) {
      try {
        listener(settings);
      } catch (_error) {
        // Ignore listener errors.
      }
    }
  },

  async getAutoOpenNotebook() {
    const stored = await chrome.storage.local.get(AUTO_OPEN_NOTEBOOK_KEY);
    return stored[AUTO_OPEN_NOTEBOOK_KEY] === true;
  },

  async setAutoOpenNotebook(enabled) {
    await chrome.storage.local.set({ [AUTO_OPEN_NOTEBOOK_KEY]: enabled === true });
  },

  async getYoutubeStudioOpenTab() {
    const stored = await chrome.storage.local.get(YOUTUBE_STUDIO_OPEN_TAB_KEY);
    return stored[YOUTUBE_STUDIO_OPEN_TAB_KEY] !== false;
  },

  async setYoutubeStudioOpenTab(enabled) {
    await chrome.storage.local.set({ [YOUTUBE_STUDIO_OPEN_TAB_KEY]: enabled !== false });
  },

  async getYoutubeStudioArtifactType() {
    const stored = await chrome.storage.local.get(YOUTUBE_STUDIO_ARTIFACT_TYPE_KEY);
    const value = stored[YOUTUBE_STUDIO_ARTIFACT_TYPE_KEY];
    return YOUTUBE_STUDIO_ARTIFACT_TYPES.some((type) => type.id === value) ? value : "mind_map";
  },

  async setYoutubeStudioArtifactType(type) {
    if (!YOUTUBE_STUDIO_ARTIFACT_TYPES.some((item) => item.id === type)) {
      return;
    }

    await chrome.storage.local.set({ [YOUTUBE_STUDIO_ARTIFACT_TYPE_KEY]: type });
  },

  getYoutubeStudioArtifactLabel(type) {
    return YOUTUBE_STUDIO_ARTIFACT_TYPES.find((item) => item.id === type)?.label || "Studio output";
  },

  async openNotebookIfEnabled(notebookId) {
    if (!notebookId) {
      return;
    }

    const enabled = await this.getAutoOpenNotebook();

    if (!enabled) {
      return;
    }

    await this.openNotebookTab(notebookId);
  },

  async openNotebookTab(notebookId) {
    if (!notebookId) {
      return;
    }

    await chrome.tabs.create({
      url: `https://notebooklm.google.com/notebook/${encodeURIComponent(notebookId)}`
    });
  },

  async openYoutubeStudioTabIfEnabled(notebookId) {
    if (!notebookId) {
      return;
    }

    const enabled = await this.getYoutubeStudioOpenTab();

    if (!enabled) {
      return;
    }

    await this.openNotebookTab(notebookId);
  },

  async openYoutubeStudioArtifactIfEnabled(notebookId, artifactId, authUser) {
    if (!notebookId || !artifactId) {
      return;
    }

    const enabled = await this.getYoutubeStudioOpenTab();

    if (!enabled) {
      return;
    }

    const url =
      typeof NotebookToolsStore !== "undefined" && NotebookToolsStore.notebookArtifactUrl
        ? NotebookToolsStore.notebookArtifactUrl(notebookId, artifactId, authUser)
        : `https://notebooklm.google.com/notebook/${encodeURIComponent(notebookId)}?artifactId=${encodeURIComponent(artifactId)}`;

    await chrome.tabs.create({ url });
  },

  async openNotebookArtifactIfEnabled(notebookId, artifactId, authUser) {
    if (!notebookId || !artifactId) {
      return;
    }

    const enabled = await this.getAutoOpenNotebook();

    if (!enabled) {
      return;
    }

    const url =
      typeof NotebookToolsStore !== "undefined" && NotebookToolsStore.notebookArtifactUrl
        ? NotebookToolsStore.notebookArtifactUrl(notebookId, artifactId, authUser)
        : `https://notebooklm.google.com/notebook/${encodeURIComponent(notebookId)}?artifactId=${encodeURIComponent(artifactId)}`;

    await chrome.tabs.create({ url });
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsSettings = NotebookToolsSettings;
}
