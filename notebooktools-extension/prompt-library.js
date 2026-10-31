const NotebookToolsPromptLibraryUI = (() => {
  const FILTERS = [
    { id: "all", label: "All" },
    { id: "business", label: "Business" },
    { id: "pop", label: "Pop" },
    { id: "artistic", label: "Artistic" },
    { id: "premium", label: "Premium" }
  ];

  const CUSTOM_TYPE_FILTERS = [
    { id: "all", label: "All" },
    { id: "text", label: "Text" },
    { id: "presentation", label: "Slides" },
    { id: "infographic", label: "Infographic" },
    { id: "podcast", label: "Podcast" },
    { id: "other", label: "Other" }
  ];

  const PREVIEW_COPY = {
    editorial: { kicker: "Cover", title: "Ideas", sub: "Why this matters now" },
    minimal: { kicker: "01. Intro", title: "Overview", sub: "Clean structure" },
    "yellow-black": { kicker: "Feature", title: "Signal", sub: "Editorial point of view" },
    agency: { kicker: "Pitch", title: "Launch", sub: "Creative direction" },
    seminar: { kicker: "Talk", title: "Focus", sub: "One clear message" },
    manga: { kicker: "Scene 1", title: "Story", sub: "Learn through panels" },
    magazine: { kicker: "No.1", title: "Edit", sub: "Trend notes" },
    "retro-dev": { kicker: "Build", title: "Agents", sub: "System layers" },
    "street-pop": { kicker: "Pop", title: "Vibes", sub: "Street energy" },
    watercolor: { kicker: "Art", title: "Mood", sub: "Painted narrative" },
    "neon-tech": { kicker: "Fig.1", title: "Model", sub: "Structural map" },
    mockup: { kicker: "Product", title: "Studio", sub: "Device showcase" },
    sports: { kicker: "Live", title: "Drive", sub: "High intensity" },
    "calm-product": { kicker: "Flow", title: "Artifact", sub: "Calm clarity" }
  };

  let activeFilter = "all";
  let activeCustomFilter = "all";
  let customPrompts = [];
  let editingCustomId = null;
  let renamingCustomId = null;
  let appSettings = null;
  let lastDetailId = null;

  function setAppSettings(settings) {
    appSettings = settings;
  }

  function isTagEnabled(tagId) {
    return NotebookToolsSettings.isCardTagEnabled(appSettings, tagId);
  }

  function categoryBadge(prompt) {
    if (!isTagEnabled("promptCategory")) {
      return "";
    }

    return `<span class="pl-badge">${NotebookToolsStore.escapeHtml(prompt.badge)}</span>`;
  }

  function typeBadge(type) {
    if (!isTagEnabled("promptType")) {
      return "";
    }

    return `<span class="pl-type-badge">${NotebookToolsStore.escapeHtml(typeLabel(type))}</span>`;
  }

  function typeLabel(type) {
    return NotebookToolsCustomPrompts.PROMPT_TYPE_LABELS[type] || "Other";
  }

  function getBuiltInPrompt(id) {
    return NotebookToolsPromptLibrary.slideDecks.find((item) => item.id === id) || null;
  }

  async function getPromptRecord(id) {
    if (String(id).startsWith("custom-")) {
      return customPrompts.find((item) => item.id === id) || null;
    }

    return getBuiltInPrompt(id);
  }

  function renderPreview(prompt, large = false) {
    const copy = PREVIEW_COPY[prompt.preview] || PREVIEW_COPY.editorial;
    const modifier = `pl-preview--${prompt.preview}`;

    return `
      <div class="pl-preview ${modifier}${large ? " pl-preview-large" : ""}">
        <div class="pl-preview-inner">
          <span class="pl-preview-accent" aria-hidden="true"></span>
          <span class="pl-preview-kicker">${NotebookToolsStore.escapeHtml(copy.kicker)}</span>
          <span class="pl-preview-title">${NotebookToolsStore.escapeHtml(copy.title)}</span>
          <span class="pl-preview-sub">${NotebookToolsStore.escapeHtml(copy.sub)}</span>
        </div>
      </div>
    `;
  }

  function renderCard(prompt) {
    return `
      <article class="pl-card" data-prompt-id="${prompt.id}" data-category="${prompt.category}">
        ${renderPreview(prompt)}
        <div class="pl-card-body">
          ${categoryBadge(prompt)}
          <h3 class="pl-card-title">${NotebookToolsStore.escapeHtml(prompt.title)}</h3>
          <p class="pl-card-desc">${NotebookToolsStore.escapeHtml(prompt.description)}</p>
          <div class="pl-card-actions">
            <button type="button" class="pl-copy-btn" data-copy-id="${prompt.id}">Copy</button>
            <button type="button" class="pl-view-btn" data-view-id="${prompt.id}">Preview</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderCustomCard(prompt) {
    const snippet = prompt.prompt.slice(0, 100) + (prompt.prompt.length > 100 ? "..." : "");
    const promptType = prompt.type || NotebookToolsCustomPrompts.DEFAULT_PROMPT_TYPE;

    return `
      <article class="pl-my-card" data-custom-id="${prompt.id}" data-custom-type="${promptType}">
        <div class="pl-my-card-body">
          <div class="pl-my-card-head">
            <h3 class="pl-my-card-title">${NotebookToolsStore.escapeHtml(prompt.title)}</h3>
            <div class="pl-my-card-tools">
              ${typeBadge(promptType)}
              <button type="button" class="pl-more-btn" data-more-id="${prompt.id}" aria-label="Prompt actions" title="Actions">⋯</button>
            </div>
          </div>
          <p class="pl-my-card-snippet">${NotebookToolsStore.escapeHtml(snippet)}</p>
          <div class="pl-card-actions">
            <button type="button" class="pl-copy-btn" data-copy-id="${prompt.id}">Copy</button>
            <button type="button" class="pl-view-btn" data-view-id="${prompt.id}">View</button>
          </div>
        </div>
      </article>
    `;
  }

  function openPromptMenu(root, anchor, promptId) {
    closePromptMenus();

    const menu = document.createElement("div");
    menu.className = "pl-more-menu";
    menu.innerHTML = `
      <button type="button" class="pl-more-item" data-rename-id="${promptId}">Rename</button>
      <button type="button" class="pl-more-item" data-edit-id="${promptId}">Edit</button>
      <button type="button" class="pl-more-item is-danger" data-delete-id="${promptId}">Delete</button>
    `;

    document.body.append(menu);

    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(8, rect.right - 140)}px`;
    menu.style.top = `${rect.bottom + 4}px`;
  }

  function closePromptMenus() {
    document.querySelectorAll(".pl-more-menu").forEach((node) => node.remove());
  }

  function getFilteredCustomPrompts() {
    if (activeCustomFilter === "all") {
      return customPrompts;
    }

    return customPrompts.filter((prompt) => (prompt.type || "other") === activeCustomFilter);
  }

  function renderCustomList(root) {
    const list = root.querySelector("#plMyList");

    if (!list) {
      return;
    }

    if (!customPrompts.length) {
      list.innerHTML = `<p class="pl-my-empty">No saved prompts yet.</p>`;
      return;
    }

    const filtered = getFilteredCustomPrompts();

    if (!filtered.length) {
      list.innerHTML = `<p class="pl-my-empty">No prompts in this type yet.</p>`;
      return;
    }

    list.innerHTML = filtered.map(renderCustomCard).join("");
  }

  function renderDetail(prompt, isCustom = false) {
    if (isCustom) {
      const promptType = prompt.type || NotebookToolsCustomPrompts.DEFAULT_PROMPT_TYPE;

      return `
        <button type="button" class="pl-detail-back" data-close-detail aria-label="Back to prompts">
          <span aria-hidden="true">←</span> Back
        </button>
        <div>
          ${typeBadge(promptType)}
          <h3 class="pl-detail-title">${NotebookToolsStore.escapeHtml(prompt.title)}</h3>
        </div>
        <pre class="pl-detail-text">${NotebookToolsStore.escapeHtml(prompt.prompt)}</pre>
        <div class="pl-detail-actions">
          <button type="button" class="pl-detail-copy" data-copy-id="${prompt.id}">Copy prompt</button>
          <button type="button" class="pl-detail-rename" data-rename-id="${prompt.id}">Rename</button>
          <button type="button" class="pl-detail-edit" data-edit-id="${prompt.id}">Edit</button>
        </div>
      `;
    }

    return `
      <button type="button" class="pl-detail-back" data-close-detail aria-label="Back to prompts">
        <span aria-hidden="true">←</span> Back
      </button>
      <div class="pl-detail-preview">${renderPreview(prompt, true)}</div>
      <div>
        ${categoryBadge(prompt)}
        <h3 class="pl-detail-title">${NotebookToolsStore.escapeHtml(prompt.title)}</h3>
      </div>
      <pre class="pl-detail-text">${NotebookToolsStore.escapeHtml(prompt.prompt)}</pre>
      <button type="button" class="pl-detail-copy" data-copy-id="${prompt.id}">Copy prompt</button>
    `;
  }

  async function copyPromptText(text, button) {
    const original = button.textContent;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    button.textContent = "Copied!";
    button.classList.add("is-copied");

    window.setTimeout(() => {
      button.textContent = original;
      button.classList.remove("is-copied");
    }, 1800);
  }

  function applyFilter(root) {
    const cards = root.querySelectorAll(".pl-card");
    let visible = 0;

    cards.forEach((card) => {
      const match = activeFilter === "all" || card.dataset.category === activeFilter;
      card.classList.toggle("is-hidden", !match);
      if (match) {
        visible += 1;
      }
    });

    const empty = root.querySelector(".pl-empty");
    if (empty) {
      empty.hidden = visible > 0;
    }
  }

  function resetCustomForm(root) {
    editingCustomId = null;
    const form = root.querySelector("#plMyForm");
    const title = root.querySelector("#plMyTitle");
    const text = root.querySelector("#plMyText");
    const type = root.querySelector("#plMyType");
    const saveBtn = root.querySelector("#plMySave");

    if (title) {
      title.value = "";
    }

    if (text) {
      text.value = "";
    }

    if (type) {
      type.value = NotebookToolsCustomPrompts.DEFAULT_PROMPT_TYPE;
    }

    if (saveBtn) {
      saveBtn.textContent = "Save";
    }

    form?.setAttribute("hidden", "");
  }

  function resetRenameForm(root) {
    renamingCustomId = null;
    const form = root.querySelector("#plRenameForm");
    const title = root.querySelector("#plRenameTitle");

    if (title) {
      title.value = "";
    }

    form?.setAttribute("hidden", "");
  }

  function openCustomForm(root, prompt = null) {
    resetRenameForm(root);
    const form = root.querySelector("#plMyForm");
    const title = root.querySelector("#plMyTitle");
    const text = root.querySelector("#plMyText");
    const type = root.querySelector("#plMyType");
    const saveBtn = root.querySelector("#plMySave");

    editingCustomId = prompt?.id || null;

    if (title) {
      title.value = prompt?.title || "";
    }

    if (text) {
      text.value = prompt?.prompt || "";
    }

    if (type) {
      type.value = prompt?.type || NotebookToolsCustomPrompts.DEFAULT_PROMPT_TYPE;
    }

    if (saveBtn) {
      saveBtn.textContent = prompt ? "Update" : "Save";
    }

    form?.removeAttribute("hidden");
    title?.focus();
  }

  function openRenameForm(root, prompt) {
    resetCustomForm(root);
    const form = root.querySelector("#plRenameForm");
    const title = root.querySelector("#plRenameTitle");

    renamingCustomId = prompt?.id || null;

    if (title) {
      title.value = prompt?.title || "";
    }

    form?.removeAttribute("hidden");
    title?.focus();
    title?.select();
  }

  async function saveCustomPrompt(root) {
    const title = root.querySelector("#plMyTitle")?.value || "";
    const prompt = root.querySelector("#plMyText")?.value || "";
    const type = root.querySelector("#plMyType")?.value || NotebookToolsCustomPrompts.DEFAULT_PROMPT_TYPE;

    await NotebookToolsCustomPrompts.save({
      id: editingCustomId,
      title,
      prompt,
      type
    });

    customPrompts = await NotebookToolsCustomPrompts.list();
    renderCustomList(root);
    resetCustomForm(root);
  }

  async function saveRenamePrompt(root) {
    const title = root.querySelector("#plRenameTitle")?.value || "";

    await NotebookToolsCustomPrompts.rename(renamingCustomId, title);
    customPrompts = await NotebookToolsCustomPrompts.list();
    renderCustomList(root);
    resetRenameForm(root);
  }

  async function openDetail(root, promptId) {
    const prompt = await getPromptRecord(promptId);
    const detail = root.querySelector(".pl-detail");

    if (!prompt || !detail) {
      return;
    }

    const isCustom = String(promptId).startsWith("custom-");
    lastDetailId = promptId;
    detail.innerHTML = renderDetail(prompt, isCustom);
    detail.classList.add("is-open");
  }

  function closeDetail(root) {
    const detail = root.querySelector(".pl-detail");

    if (detail) {
      detail.classList.remove("is-open");
      detail.innerHTML = "";
      lastDetailId = null;
    }
  }

  function refreshDisplay(root) {
    const grid = root.querySelector(".pl-grid");

    if (grid) {
      const prompts = NotebookToolsPromptLibrary.slideDecks;
      grid.innerHTML = prompts.map(renderCard).join("");
      applyFilter(root);
    }

    renderCustomList(root);

    if (lastDetailId) {
      void openDetail(root, lastDetailId);
    }
  }

  function bind(root) {
    root.addEventListener("click", async (event) => {
      const copyButton = event.target.closest("[data-copy-id]");
      const viewButton = event.target.closest("[data-view-id]");
      const deleteButton = event.target.closest("[data-delete-id]");
      const editButton = event.target.closest("[data-edit-id]");
      const renameButton = event.target.closest("[data-rename-id]");
      const closeButton = event.target.closest("[data-close-detail]");
      const filterButton = event.target.closest(".pl-filter");
      const customFilterButton = event.target.closest(".pl-custom-filter");
      const card = event.target.closest(".pl-card");
      const customCard = event.target.closest(".pl-my-card");
      const addButton = event.target.closest("#plMyAddButton");
      const moreButton = event.target.closest("[data-more-id]");

      if (moreButton) {
        event.preventDefault();
        event.stopPropagation();
        openPromptMenu(root, moreButton, moreButton.dataset.moreId);
        return;
      }
      if (addButton) {
        event.preventDefault();
        closePromptMenus();
        openCustomForm(root);
        return;
      }

      if (copyButton) {
        event.preventDefault();
        event.stopPropagation();
        const prompt = await getPromptRecord(copyButton.dataset.copyId);

        if (prompt) {
          await copyPromptText(prompt.prompt, copyButton);
        }

        return;
      }

      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        closePromptMenus();

        if (window.confirm("Delete this prompt?")) {
          await NotebookToolsCustomPrompts.remove(deleteButton.dataset.deleteId);
          customPrompts = await NotebookToolsCustomPrompts.list();
          renderCustomList(root);
        }

        return;
      }

      if (renameButton) {
        event.preventDefault();
        event.stopPropagation();
        closePromptMenus();
        closeDetail(root);
        const prompt = await getPromptRecord(renameButton.dataset.renameId);

        if (prompt) {
          openRenameForm(root, prompt);
        }

        return;
      }

      if (editButton) {
        event.preventDefault();
        closePromptMenus();
        closeDetail(root);
        const prompt = await getPromptRecord(editButton.dataset.editId);

        if (prompt) {
          openCustomForm(root, prompt);
        }

        return;
      }

      if (viewButton) {
        event.preventDefault();
        event.stopPropagation();
        await openDetail(root, viewButton.dataset.viewId);
        return;
      }

      if (closeButton) {
        event.preventDefault();
        closeDetail(root);
        return;
      }

      if (customFilterButton) {
        event.preventDefault();
        activeCustomFilter = customFilterButton.dataset.customFilter || "all";
        root.querySelectorAll(".pl-custom-filter").forEach((button) => {
          button.classList.toggle("is-active", button === customFilterButton);
        });
        renderCustomList(root);
        return;
      }

      if (filterButton) {
        event.preventDefault();
        activeFilter = filterButton.dataset.filter || "all";
        root.querySelectorAll(".pl-filter").forEach((button) => {
          button.classList.toggle("is-active", button === filterButton);
        });
        applyFilter(root);
        return;
      }

      if (card && !event.target.closest("button")) {
        await openDetail(root, card.dataset.promptId);
        return;
      }

      if (customCard && !event.target.closest("button")) {
        await openDetail(root, customCard.dataset.customId);
      }
    });

    root.querySelector("#plMyForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        await saveCustomPrompt(root);
      } catch (error) {
        window.alert(error.message || "Could not save prompt.");
      }
    });

    root.querySelector("#plMyCancel")?.addEventListener("click", () => {
      resetCustomForm(root);
    });

    root.querySelector("#plRenameForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        await saveRenamePrompt(root);
      } catch (error) {
        window.alert(error.message || "Could not rename prompt.");
      }
    });

    root.querySelector("#plRenameCancel")?.addEventListener("click", () => {
      resetRenameForm(root);
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".pl-more-btn") && !event.target.closest(".pl-more-menu")) {
        closePromptMenus();
      }
    });
  }

  async function mount(container) {
    const prompts = NotebookToolsPromptLibrary.slideDecks;
    customPrompts = await NotebookToolsCustomPrompts.list();

    container.innerHTML = `
      <div class="prompt-library">
        <section class="pl-my-section">
          <div class="pl-my-head">
            <h2 class="pl-section-label">My prompts</h2>
            <button type="button" class="pl-my-add-btn" id="plMyAddButton">+ Add</button>
          </div>
          <div class="pl-my-filters" role="toolbar" aria-label="Filter my prompts">
            ${CUSTOM_TYPE_FILTERS.map((filter) => `
              <button type="button" class="pl-custom-filter${filter.id === "all" ? " is-active" : ""}" data-custom-filter="${filter.id}">
                ${filter.label}
              </button>
            `).join("")}
          </div>
          <form class="pl-my-form" id="plMyForm" hidden>
            <input id="plMyTitle" type="text" class="pl-my-input" placeholder="Title" maxlength="80" aria-label="Prompt title">
            <select id="plMyType" class="pl-my-select" aria-label="Prompt type">
              ${NotebookToolsCustomPrompts.PROMPT_TYPES.map((type) => `
                <option value="${type}">${typeLabel(type)}</option>
              `).join("")}
            </select>
            <textarea id="plMyText" class="pl-my-textarea" placeholder="Paste your prompt text..." rows="4" aria-label="Prompt text"></textarea>
            <div class="pl-my-form-actions">
              <button type="submit" class="button compact" id="plMySave">Save</button>
              <button type="button" class="text-button" id="plMyCancel">Cancel</button>
            </div>
          </form>
          <form class="pl-rename-form" id="plRenameForm" hidden>
            <input id="plRenameTitle" type="text" class="pl-my-input" placeholder="New title" maxlength="80" aria-label="New title">
            <div class="pl-my-form-actions">
              <button type="submit" class="button compact">Rename</button>
              <button type="button" class="text-button" id="plRenameCancel">Cancel</button>
            </div>
          </form>
          <div class="pl-my-list" id="plMyList"></div>
        </section>

        <div class="pl-divider"></div>

        <h2 class="pl-section-label">Slide templates</h2>
        <div class="pl-filters" role="toolbar" aria-label="Filter prompts">
          ${FILTERS.map((filter) => `
            <button type="button" class="pl-filter${filter.id === "all" ? " is-active" : ""}" data-filter="${filter.id}">
              ${filter.label}
            </button>
          `).join("")}
        </div>
        <div class="pl-grid">
          ${prompts.map(renderCard).join("")}
        </div>
        <p class="pl-empty" hidden>No prompts in this category yet.</p>
        <div class="pl-detail" aria-hidden="true"></div>
      </div>
    `;

    bind(container);
    renderCustomList(container);
    applyFilter(container);
  }

  return { mount, closeDetail, setAppSettings, refreshDisplay };
})();
