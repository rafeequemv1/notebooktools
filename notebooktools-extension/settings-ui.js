const NotebookToolsSettingsUI = (() => {
  let modalEl = null;
  let open = false;

  function renderCardTagToggles(settings) {
    const host = modalEl?.querySelector("#settingsCardTags");

    if (!host) {
      return;
    }

    host.innerHTML = NotebookToolsSettings.CARD_TAG_OPTIONS.map((option) => {
      const checked = NotebookToolsSettings.isCardTagEnabled(settings, option.id) ? " checked" : "";

      return `
        <label class="settings-toggle-row">
          <span class="settings-toggle-copy">
            <span class="settings-toggle-label" data-i18n="${option.labelKey}">${NotebookToolsI18n.t(option.labelKey)}</span>
            <span class="settings-toggle-desc" data-i18n="${option.descKey}">${NotebookToolsI18n.t(option.descKey)}</span>
          </span>
          <input type="checkbox" class="settings-toggle-input" data-card-tag="${option.id}"${checked} />
        </label>
      `;
    }).join("");
  }

  async function populateForm() {
    const settings = await NotebookToolsSettings.getAppSettings();
    const theme = await NotebookToolsTheme.get();

    const themeSelect = modalEl?.querySelector("#settingsTheme");
    const languageSelect = modalEl?.querySelector("#settingsLanguage");

    if (themeSelect) {
      themeSelect.value = theme;
    }

    if (languageSelect) {
      languageSelect.value = settings.language || "en";
    }

    renderCardTagToggles(settings);
    NotebookToolsI18n.apply(modalEl);
  }

  async function saveFromForm() {
    const theme = modalEl?.querySelector("#settingsTheme")?.value || "light";
    const language = modalEl?.querySelector("#settingsLanguage")?.value || "en";
    const cardTags = {};

    modalEl?.querySelectorAll("[data-card-tag]").forEach((input) => {
      cardTags[input.dataset.cardTag] = input.checked;
    });

    await NotebookToolsTheme.set(theme);
    await NotebookToolsSettings.setAppSettings({ language, cardTags });
    await NotebookToolsI18n.init(language);
    NotebookToolsI18n.apply(document);
    await NotebookToolsSettings.notifyChange();
  }

  function showModal() {
    if (!modalEl) {
      return;
    }

    open = true;
    modalEl.hidden = false;
    populateForm();
  }

  function hideModal() {
    if (!modalEl) {
      return;
    }

    open = false;
    modalEl.hidden = true;
  }

  function bind() {
    document.querySelectorAll("[data-open-settings]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showModal();
      });
    });

    modalEl?.querySelectorAll("[data-settings-close]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        await saveFromForm();
        hideModal();
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && open) {
        hideModal();
      }
    });
  }

  function ensureModal() {
    if (document.querySelector("#settingsModal")) {
      modalEl = document.querySelector("#settingsModal");
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="nt-modal settings-modal" id="settingsModal" hidden>
        <div class="nt-modal-backdrop" data-settings-close></div>
        <div class="nt-modal-card settings-card" role="dialog" aria-modal="true" aria-labelledby="settingsModalTitle">
          <h2 class="nt-modal-title" id="settingsModalTitle" data-i18n="settings">Settings</h2>
          <div class="settings-fields">
            <label class="settings-field">
              <span class="settings-field-label" data-i18n="theme">Theme</span>
              <select id="settingsTheme" class="settings-select">
                <option value="light" data-i18n="themeLight">Light</option>
                <option value="dark" data-i18n="themeDark">Dark</option>
              </select>
            </label>
            <label class="settings-field">
              <span class="settings-field-label" data-i18n="language">Language</span>
              <select id="settingsLanguage" class="settings-select">
                ${NotebookToolsI18n.LANGUAGES.map(
                  (lang) => `<option value="${lang.id}">${lang.label}</option>`
                ).join("")}
              </select>
            </label>
          </div>
          <div class="settings-section">
            <h3 class="settings-section-title" data-i18n="cardTags">Card tags</h3>
            <p class="settings-section-hint" data-i18n="cardTagsHint">Choose which labels appear on cards and lists.</p>
            <div class="settings-toggle-list" id="settingsCardTags"></div>
          </div>
          <div class="nt-modal-actions">
            <button type="button" class="button compact" data-settings-close data-i18n="done">Done</button>
          </div>
        </div>
      </div>
    `;

    document.body.append(wrapper.firstElementChild);
    modalEl = document.querySelector("#settingsModal");
  }

  function init() {
    ensureModal();
    bind();
  }

  return { init, show: showModal, hide: hideModal };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsSettingsUI = NotebookToolsSettingsUI;
}
