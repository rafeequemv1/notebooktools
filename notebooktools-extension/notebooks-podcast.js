const NotebookToolsPodcast = (() => {
  const PROGRESS_KEY = "notebooktools_podcast_progress";

  let viewEl = null;
  let listEl = null;
  let statusEl = null;
  let searchEl = null;
  let scanBtn = null;
  let playerEl = null;
  let audioEl = null;
  let titleEl = null;
  let metaEl = null;
  let timeEl = null;
  let progressEl = null;
  let progressFillEl = null;
  let playBtn = null;
  let prevBtn = null;
  let nextBtn = null;

  let notebooks = [];
  let authOptions = {};
  let playlist = [];
  let progressMap = {};
  let currentIndex = -1;
  let isPlaying = false;
  let scanning = false;
  let searchQuery = "";
  let onOpenNotebook = null;
  let activeBlobUrl = "";
  let loadingAudio = false;

  function revokePodcastBlob() {
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
      activeBlobUrl = "";
    }
  }

  async function assignAudioSource(item) {
    revokePodcastBlob();

    if (!item) {
      return false;
    }

    setStatus("Loading audio...", "loading");

    const blobUrl = await NotebookToolsMediaPlayback.resolveBlobUrl(item.mediaUrl, {
      downloadUrl: item.downloadUrl
    });

    if (blobUrl) {
      activeBlobUrl = blobUrl;
      audioEl.src = blobUrl;
      setStatus("");
      return true;
    }

    const direct = playbackSrc(item);

    if (direct) {
      audioEl.src = direct;
      setStatus("");
      return true;
    }

    setStatus("No playback URL for this podcast.", "error");
    return false;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "0:00";
    }

    const total = Math.floor(seconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;

    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  async function loadProgress() {
    try {
      const stored = await chrome.storage.local.get(PROGRESS_KEY);
      progressMap = stored[PROGRESS_KEY] || {};
    } catch (_error) {
      progressMap = {};
    }
  }

  async function saveProgress() {
    try {
      await chrome.storage.local.set({ [PROGRESS_KEY]: progressMap });
    } catch (_error) {
      // Ignore storage errors.
    }
  }

  function setStatus(message, type = "") {
    if (!statusEl) {
      return;
    }

    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      statusEl.className = "podcast-status";
      return;
    }

    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = `podcast-status${type ? ` is-${type}` : ""}`;
  }

  function filteredPlaylist() {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return playlist;
    }

    return playlist.filter((item) => {
      const haystack = `${item.title} ${item.notebookTitle}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  function currentItem() {
    return currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null;
  }

  function playbackSrc(item) {
    return item?.mediaUrl || item?.downloadUrl || "";
  }

  async function refreshItemUrl(item) {
    if (!item?.notebookId || !item?.id) {
      return "";
    }

    const artifacts = await NotebookToolsNotebookLM.listNotebookLmArtifacts(
      item.notebookId,
      authOptions
    );
    const fresh = artifacts.find((artifact) => artifact.id === item.id);

    if (!fresh) {
      return "";
    }

    const index = playlist.findIndex((entry) => entry.id === item.id);

    if (index >= 0) {
      playlist[index] = {
        ...playlist[index],
        mediaUrl: fresh.mediaUrl,
        downloadUrl: fresh.downloadUrl,
        duration: fresh.duration ?? playlist[index].duration
      };
    }

    return playbackSrc(playlist[index] || fresh);
  }

  async function scanNotebooks() {
    if (scanning) {
      return;
    }

    scanning = true;
    scanBtn.disabled = true;
    playlist = [];
    currentIndex = -1;
    isPlaying = false;
    renderList();
    updatePlayerUi();

    const nextPlaylist = [];

    for (let index = 0; index < notebooks.length; index += 1) {
      const notebook = notebooks[index];
      setStatus(`Scanning ${index + 1}/${notebooks.length}: ${notebook.title}`, "loading");

      try {
        const artifacts = await NotebookToolsNotebookLM.listNotebookLmArtifacts(
          notebook.id,
          authOptions
        );

        for (const artifact of artifacts) {
          if (
            artifact.typeCode === 1 &&
            artifact.status === "ready" &&
            (artifact.mediaUrl || artifact.downloadUrl)
          ) {
            nextPlaylist.push({
              ...artifact,
              notebookId: notebook.id,
              notebookTitle: notebook.title
            });
          }
        }
      } catch (_error) {
        // Skip notebooks that fail to load.
      }
    }

    playlist = nextPlaylist.sort((a, b) => a.notebookTitle.localeCompare(b.notebookTitle));
    scanning = false;
    scanBtn.disabled = false;
    setStatus(
      playlist.length
        ? `Found ${playlist.length} podcast${playlist.length === 1 ? "" : "s"} across your notebooks.`
        : "No audio overviews found. Generate one in Studio first.",
      playlist.length ? "" : "error"
    );
    renderList();
  }

  function renderList() {
    if (!listEl) {
      return;
    }

    if (scanning) {
      listEl.innerHTML = `<p class="podcast-empty">Scanning notebooks for audio overviews...</p>`;
      return;
    }

    const items = filteredPlaylist();

    if (!playlist.length) {
      listEl.innerHTML = `<p class="podcast-empty">Click <strong>Scan notebooks</strong> to find Audio Overviews from all notebooks.</p>`;
      return;
    }

    if (!items.length) {
      listEl.innerHTML = `<p class="podcast-empty">No podcasts match your search.</p>`;
      return;
    }

    listEl.innerHTML = items
      .map((item) => {
        const globalIndex = playlist.findIndex((entry) => entry.id === item.id);
        const active = globalIndex === currentIndex;
        const progress = progressMap[item.id]?.progress || 0;
        const listened = progressMap[item.id]?.isListened;
        const durationLabel =
          typeof item.duration === "number" && item.duration > 0
            ? formatTime(item.duration)
            : "";

        return `
          <article class="podcast-item${active ? " is-active" : ""}${listened ? " is-listened" : ""}" data-podcast-index="${globalIndex}">
            <button type="button" class="podcast-item-play" data-play-index="${globalIndex}" aria-label="Play ${NotebookToolsStore.escapeHtml(item.title)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <div class="podcast-item-body">
              <h3 class="podcast-item-title">${NotebookToolsStore.escapeHtml(item.title)}</h3>
              <p class="podcast-item-meta">
                <button type="button" class="podcast-item-notebook" data-open-notebook-id="${item.notebookId}">${NotebookToolsStore.escapeHtml(item.notebookTitle)}</button>
                ${durationLabel ? `<span class="podcast-item-duration">${durationLabel}</span>` : ""}
                ${listened ? '<span class="podcast-item-badge">Listened</span>' : ""}
              </p>
              ${progress > 0 && !listened ? `<div class="podcast-item-progress"><span style="width:${Math.round(progress * 100)}%"></span></div>` : ""}
            </div>
          </article>
        `;
      })
      .join("");

    listEl.querySelectorAll("[data-play-index]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        playAtIndex(Number(btn.dataset.playIndex));
      });
    });

    listEl.querySelectorAll(".podcast-item").forEach((row) => {
      row.addEventListener("click", () => {
        playAtIndex(Number(row.dataset.podcastIndex));
      });
    });

    listEl.querySelectorAll("[data-open-notebook-id]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const notebook = notebooks.find((item) => item.id === btn.dataset.openNotebookId);

        if (notebook && typeof onOpenNotebook === "function") {
          onOpenNotebook(notebook);
        }
      });
    });
  }

  function updatePlayerUi() {
    const item = currentItem();

    if (!playerEl || !audioEl) {
      return;
    }

    playerEl.hidden = !item;

    if (!item) {
      return;
    }

    titleEl.textContent = item.title;
    metaEl.textContent = item.notebookTitle;
    playBtn.textContent = isPlaying ? "Pause" : "Play";
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= playlist.length - 1;

    const current = audioEl.currentTime || 0;
    const duration = audioEl.duration || item.duration || 0;
    timeEl.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    progressFillEl.style.width = duration > 0 ? `${(current / duration) * 100}%` : "0%";
  }

  async function playAtIndex(index) {
    if (index < 0 || index >= playlist.length || loadingAudio) {
      return;
    }

    loadingAudio = true;
    currentIndex = index;
    const item = playlist[index];
    const saved = progressMap[item.id]?.progress;

    const ready = await assignAudioSource(item);

    if (!ready) {
      loadingAudio = false;
      return;
    }

    audioEl.load();

    if (typeof saved === "number" && saved > 0 && saved < 0.98) {
      try {
        audioEl.currentTime = saved * (item.duration || audioEl.duration || saved);
      } catch (_error) {
        // Ignore seek errors before metadata loads.
      }
    }

    renderList();
    updatePlayerUi();

    try {
      await audioEl.play();
      isPlaying = true;
    } catch (_error) {
      isPlaying = false;
    }

    loadingAudio = false;
    updatePlayerUi();
  }

  function pause() {
    audioEl?.pause();
    isPlaying = false;
    updatePlayerUi();
  }

  async function resume() {
    try {
      await audioEl?.play();
      isPlaying = true;
    } catch (_error) {
      isPlaying = false;
    }

    updatePlayerUi();
  }

  function togglePlay() {
    if (!currentItem()) {
      if (playlist.length) {
        void playAtIndex(0);
      }

      return;
    }

    if (isPlaying) {
      pause();
    } else {
      void resume();
    }
  }

  function bindAudioEvents() {
    if (!audioEl) {
      return;
    }

    audioEl.addEventListener("timeupdate", () => {
      const item = currentItem();

      if (!item || !audioEl.duration) {
        updatePlayerUi();
        return;
      }

      const progress = audioEl.currentTime / audioEl.duration;
      const entry = progressMap[item.id] || {};
      progressMap[item.id] = {
        ...entry,
        progress,
        isListened: entry.isListened || progress >= 0.9,
        lastPlayedAt: new Date().toISOString()
      };
      void saveProgress();
      updatePlayerUi();
    });

    audioEl.addEventListener("play", () => {
      isPlaying = true;
      updatePlayerUi();
    });

    audioEl.addEventListener("pause", () => {
      isPlaying = false;
      updatePlayerUi();
    });

    audioEl.addEventListener("ended", () => {
      const item = currentItem();

      if (item) {
        progressMap[item.id] = {
          ...(progressMap[item.id] || {}),
          progress: 1,
          isListened: true,
          lastPlayedAt: new Date().toISOString()
        };
        void saveProgress();
      }

      if (currentIndex + 1 < playlist.length) {
        void playAtIndex(currentIndex + 1);
      } else {
        isPlaying = false;
        updatePlayerUi();
        renderList();
      }
    });

    audioEl.addEventListener("error", async () => {
      const item = currentItem();
      const code = audioEl.error?.code;

      if (!item || (code !== 2 && code !== 4 && code != null)) {
        setStatus("Could not play this podcast. Try scanning again.", "error");
        return;
      }

      setStatus("Refreshing playback link...", "loading");

      try {
        const freshUrl = await refreshItemUrl(item);

        if (freshUrl) {
          const ready = await assignAudioSource(playlist[currentIndex] || item);

          if (ready) {
            audioEl.load();
            await audioEl.play();
            isPlaying = true;
            setStatus("");
            updatePlayerUi();
            return;
          }
        }
      } catch (_error) {
        // Fall through.
      }

      setStatus("Playback link expired. Scan again or open in NotebookLM.", "error");
      isPlaying = false;
      updatePlayerUi();
    });

    progressEl?.addEventListener("click", (event) => {
      if (!audioEl.duration) {
        return;
      }

      const rect = progressEl.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      audioEl.currentTime = Math.max(0, Math.min(audioEl.duration, ratio * audioEl.duration));
    });
  }

  function show() {
    viewEl?.removeAttribute("hidden");
    renderList();
    updatePlayerUi();
  }

  function hide() {
    pause();
    revokePodcastBlob();
    viewEl?.setAttribute("hidden", "");
  }

  function open(options = {}) {
    notebooks = Array.isArray(options.notebooks) ? options.notebooks : [];
    authOptions = options.authOptions || {};
    onOpenNotebook = options.onOpenNotebook || null;
    searchQuery = searchEl?.value || "";
    show();
  }

  function close() {
    hide();
  }

  function init() {
    viewEl = document.querySelector("#podcastView");
    listEl = document.querySelector("#podcastList");
    statusEl = document.querySelector("#podcastStatus");
    searchEl = document.querySelector("#podcastSearch");
    scanBtn = document.querySelector("#podcastScanButton");
    playerEl = document.querySelector("#podcastPlayer");
    audioEl = document.querySelector("#podcastAudio");
    titleEl = document.querySelector("#podcastPlayerTitle");
    metaEl = document.querySelector("#podcastPlayerMeta");
    timeEl = document.querySelector("#podcastPlayerTime");
    progressEl = document.querySelector("#podcastPlayerProgress");
    progressFillEl = document.querySelector("#podcastPlayerProgressFill");
    playBtn = document.querySelector("#podcastPlayButton");
    prevBtn = document.querySelector("#podcastPrevButton");
    nextBtn = document.querySelector("#podcastNextButton");

    void loadProgress();
    bindAudioEvents();

    searchEl?.addEventListener("input", () => {
      searchQuery = searchEl.value;
      renderList();
    });

    scanBtn?.addEventListener("click", () => {
      void scanNotebooks();
    });

    playBtn?.addEventListener("click", () => {
      togglePlay();
    });

    prevBtn?.addEventListener("click", () => {
      if (currentIndex > 0) {
        void playAtIndex(currentIndex - 1);
      }
    });

    nextBtn?.addEventListener("click", () => {
      if (currentIndex + 1 < playlist.length) {
        void playAtIndex(currentIndex + 1);
      }
    });
  }

  return { init, open, close, show, hide };
})();
