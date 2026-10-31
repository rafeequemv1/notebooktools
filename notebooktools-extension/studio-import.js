const NotebookToolsStudioImport = {
  getSelectedArtifactType(selectEl) {
    const value = selectEl?.value || "";
    return NotebookToolsSettings.YOUTUBE_STUDIO_ARTIFACT_TYPES.some((type) => type.id === value)
      ? value
      : "mind_map";
  },

  getArtifactLabel(type) {
    return NotebookToolsSettings.getYoutubeStudioArtifactLabel(type);
  },

  populateArtifactOptions(selectEl, selectedType) {
    if (!selectEl) {
      return;
    }

    selectEl.innerHTML = NotebookToolsSettings.YOUTUBE_STUDIO_ARTIFACT_TYPES.map(
      (type) => `<option value="${type.id}">${type.label}</option>`
    ).join("");
    selectEl.value = selectedType;
  },

  syncStudioButton(buttonEl, type = this.getSelectedArtifactType()) {
    if (!buttonEl) {
      return;
    }

    const artifactLabel = this.getArtifactLabel(type);
    buttonEl.textContent = `Create ${artifactLabel.toLowerCase()}`;
  },

  formatWaitMessage(phase, artifactLabel, sourceKind = "page") {
    if (phase === "processing") {
      return sourceKind === "youtube"
        ? "Video added. Waiting for NotebookLM to finish processing..."
        : "Page added. Waiting for NotebookLM to finish processing...";
    }

    if (phase === "generating") {
      return `Creating ${artifactLabel.toLowerCase()}...`;
    }

    return "Sending to NotebookLM...";
  },

  async initControls({ typeSelect, openTabToggle, studioButton, onTypeChange } = {}) {
    const savedType = await NotebookToolsSettings.getYoutubeStudioArtifactType();
    const savedOpenTab = await NotebookToolsSettings.getYoutubeStudioOpenTab();

    this.populateArtifactOptions(typeSelect, savedType);
    this.syncStudioButton(studioButton, savedType);

    if (openTabToggle) {
      openTabToggle.checked = savedOpenTab;
      openTabToggle.addEventListener("change", () => {
        NotebookToolsSettings.setYoutubeStudioOpenTab(openTabToggle.checked);
      });
    }

    typeSelect?.addEventListener("change", async () => {
      const nextType = this.getSelectedArtifactType(typeSelect);
      await NotebookToolsSettings.setYoutubeStudioArtifactType(nextType);
      this.syncStudioButton(studioButton, nextType);
      onTypeChange?.(nextType);
    });
  },

  async runPipeline({
    notebookId,
    kind,
    url,
    artifactType,
    beforeSourceIds,
    onStatus
  }) {
    const targetNotebookId = String(notebookId || "").trim();
    const artifactLabel = this.getArtifactLabel(artifactType);
    const sourceKind = kind === "youtube" ? "youtube" : "page";
    let resolvedBeforeSourceIds = beforeSourceIds;

    if (!Array.isArray(resolvedBeforeSourceIds)) {
      const existingSources = await NotebookToolsNotebookLM.listNotebookLmSources(targetNotebookId);
      resolvedBeforeSourceIds = existingSources.map((source) => source.id);
    }

    onStatus?.({
      message: sourceKind === "youtube" ? "Adding video..." : "Adding page...",
      loading: true
    });

    if (kind === "youtube") {
      await NotebookToolsNotebookLM.addYoutubeToNotebookLm(targetNotebookId, url);
    } else {
      await NotebookToolsNotebookLM.addWebpageToNotebookLm(targetNotebookId, url);
    }

    const waitOptions = {
      beforeSourceIds: resolvedBeforeSourceIds,
      onProgress: ({ phase }) => {
        onStatus?.({
          message: this.formatWaitMessage(phase, artifactLabel, sourceKind),
          loading: true
        });
      }
    };

    const source =
      kind === "youtube"
        ? await NotebookToolsNotebookLM.waitForYoutubeSourceReady(targetNotebookId, url, waitOptions)
        : await NotebookToolsNotebookLM.waitForWebSourceReady(targetNotebookId, url, waitOptions);

    onStatus?.({
      message: `Starting ${artifactLabel.toLowerCase()}...`,
      loading: true
    });

    const artifact = await NotebookToolsNotebookLM.createNotebookLmArtifact(
      targetNotebookId,
      artifactType,
      {
        sourceIds: [source.id],
        instructions: ""
      }
    );

    if (!artifact?.id) {
      throw new Error(`${artifactLabel} could not be started.`);
    }

    onStatus?.({
      message: `Generating ${artifactLabel.toLowerCase()}...`,
      loading: true
    });

    await NotebookToolsNotebookLM.waitForNotebookLmArtifactReady(targetNotebookId, artifact.id, {
      onProgress: () => {
        onStatus?.({
          message: `Generating ${artifactLabel.toLowerCase()}...`,
          loading: true
        });
      }
    });

    return { source, artifact, artifactLabel };
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsStudioImport = NotebookToolsStudioImport;
}
