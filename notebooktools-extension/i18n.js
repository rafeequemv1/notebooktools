const NotebookToolsI18n = (() => {
  const MESSAGES = {
    en: {
      settings: "Settings",
      theme: "Theme",
      themeLight: "Light",
      themeDark: "Dark",
      language: "Language",
      cardTags: "Card tags",
      cardTagsHint: "Choose which labels appear on cards and lists.",
      done: "Done",
      tabImport: "Import",
      tabBulk: "Bulk",
      tabPrompts: "Prompts",
      openNotebooks: "Open notebooks",
      yourNotebooks: "Your notebooks",
      searchNotebooks: "Search notebooks",
      newNotebook: "New notebook",
      tabSources: "Sources",
      tabStudio: "Studio",
      backNotebooks: "← Notebooks",
      openInNotebookLM: "Open in NotebookLM",
      tagNotebookSources: "Source count",
      tagNotebookSourcesDesc: "Sources pill on notebook cards",
      tagNotebookStudio: "Studio counts",
      tagNotebookStudioDesc: "Cached studio output counts on cards",
      tagNotebookFolder: "Folder column",
      tagNotebookFolderDesc: "Folder name in list view",
      tagSourceType: "Source type",
      tagSourceTypeDesc: "Web, PDF, YouTube badges",
      tagSourceFolder: "Source folders",
      tagSourceFolderDesc: "Folder labels on source rows",
      tagPromptType: "Prompt type",
      tagPromptTypeDesc: "Text, slides, podcast on your prompts",
      tagPromptCategory: "Template style",
      tagPromptCategoryDesc: "Business, pop, artistic on templates",
      autoOpen: "Auto-open"
    },
    es: {
      settings: "Ajustes",
      theme: "Tema",
      themeLight: "Claro",
      themeDark: "Oscuro",
      language: "Idioma",
      cardTags: "Etiquetas en tarjetas",
      cardTagsHint: "Elige qué etiquetas se muestran en tarjetas y listas.",
      done: "Listo",
      tabImport: "Importar",
      tabBulk: "Masivo",
      tabPrompts: "Prompts",
      openNotebooks: "Abrir cuadernos",
      yourNotebooks: "Tus cuadernos",
      searchNotebooks: "Buscar cuadernos",
      newNotebook: "Nuevo cuaderno",
      tabSources: "Fuentes",
      tabStudio: "Estudio",
      backNotebooks: "← Cuadernos",
      openInNotebookLM: "Abrir en NotebookLM",
      tagNotebookSources: "Recuento de fuentes",
      tagNotebookSourcesDesc: "Etiqueta de fuentes en tarjetas",
      tagNotebookFolder: "Columna de carpeta",
      tagNotebookFolderDesc: "Carpeta en vista de lista",
      tagSourceType: "Tipo de fuente",
      tagSourceTypeDesc: "Web, PDF, YouTube",
      tagSourceFolder: "Carpetas de fuentes",
      tagSourceFolderDesc: "Etiquetas de carpeta en fuentes",
      tagPromptType: "Tipo de prompt",
      tagPromptTypeDesc: "Texto, diapositivas, podcast",
      tagPromptCategory: "Estilo de plantilla",
      tagPromptCategoryDesc: "Negocios, pop, artístico",
      autoOpen: "Abrir auto"
    },
    de: {
      settings: "Einstellungen",
      theme: "Design",
      themeLight: "Hell",
      themeDark: "Dunkel",
      language: "Sprache",
      cardTags: "Karten-Tags",
      cardTagsHint: "Wähle, welche Labels auf Karten erscheinen.",
      done: "Fertig",
      tabImport: "Import",
      tabBulk: "Bulk",
      tabPrompts: "Prompts",
      openNotebooks: "Notebooks öffnen",
      yourNotebooks: "Deine Notebooks",
      searchNotebooks: "Notebooks suchen",
      newNotebook: "Neues Notebook",
      tabSources: "Quellen",
      tabStudio: "Studio",
      backNotebooks: "← Notebooks",
      openInNotebookLM: "In NotebookLM öffnen",
      tagNotebookSources: "Quellenanzahl",
      tagNotebookSourcesDesc: "Quellen-Badge auf Karten",
      tagNotebookFolder: "Ordnerspalte",
      tagNotebookFolderDesc: "Ordner in Listenansicht",
      tagSourceType: "Quellentyp",
      tagSourceTypeDesc: "Web, PDF, YouTube",
      tagSourceFolder: "Quellenordner",
      tagSourceFolderDesc: "Ordner-Labels bei Quellen",
      tagPromptType: "Prompt-Typ",
      tagPromptTypeDesc: "Text, Folien, Podcast",
      tagPromptCategory: "Vorlagenstil",
      tagPromptCategoryDesc: "Business, Pop, Artistic",
      autoOpen: "Auto-öffnen"
    },
    fr: {
      settings: "Paramètres",
      theme: "Thème",
      themeLight: "Clair",
      themeDark: "Sombre",
      language: "Langue",
      cardTags: "Tags sur les cartes",
      cardTagsHint: "Choisissez les étiquettes affichées sur les cartes.",
      done: "Terminé",
      tabImport: "Importer",
      tabBulk: "Lot",
      tabPrompts: "Prompts",
      openNotebooks: "Ouvrir les notebooks",
      yourNotebooks: "Vos notebooks",
      searchNotebooks: "Rechercher",
      newNotebook: "Nouveau notebook",
      tabSources: "Sources",
      tabStudio: "Studio",
      backNotebooks: "← Notebooks",
      openInNotebookLM: "Ouvrir dans NotebookLM",
      tagNotebookSources: "Nombre de sources",
      tagNotebookSourcesDesc: "Badge sources sur les cartes",
      tagNotebookFolder: "Colonne dossier",
      tagNotebookFolderDesc: "Dossier en vue liste",
      tagSourceType: "Type de source",
      tagSourceTypeDesc: "Web, PDF, YouTube",
      tagSourceFolder: "Dossiers sources",
      tagSourceFolderDesc: "Labels dossier sur les sources",
      tagPromptType: "Type de prompt",
      tagPromptTypeDesc: "Texte, slides, podcast",
      tagPromptCategory: "Style modèle",
      tagPromptCategoryDesc: "Business, pop, artistique",
      autoOpen: "Ouverture auto"
    },
    pt: {
      settings: "Configurações",
      theme: "Tema",
      themeLight: "Claro",
      themeDark: "Escuro",
      language: "Idioma",
      cardTags: "Tags nos cards",
      cardTagsHint: "Escolha quais etiquetas aparecem nos cards.",
      done: "Concluir",
      tabImport: "Importar",
      tabBulk: "Em lote",
      tabPrompts: "Prompts",
      openNotebooks: "Abrir notebooks",
      yourNotebooks: "Seus notebooks",
      searchNotebooks: "Buscar notebooks",
      newNotebook: "Novo notebook",
      tabSources: "Fontes",
      tabStudio: "Estúdio",
      backNotebooks: "← Notebooks",
      openInNotebookLM: "Abrir no NotebookLM",
      tagNotebookSources: "Contagem de fontes",
      tagNotebookSourcesDesc: "Badge de fontes nos cards",
      tagNotebookFolder: "Coluna de pasta",
      tagNotebookFolderDesc: "Pasta na lista",
      tagSourceType: "Tipo de fonte",
      tagSourceTypeDesc: "Web, PDF, YouTube",
      tagSourceFolder: "Pastas de fontes",
      tagSourceFolderDesc: "Labels de pasta nas fontes",
      tagPromptType: "Tipo de prompt",
      tagPromptTypeDesc: "Texto, slides, podcast",
      tagPromptCategory: "Estilo do modelo",
      tagPromptCategoryDesc: "Business, pop, artístico",
      autoOpen: "Abrir auto"
    },
    ja: {
      settings: "設定",
      theme: "テーマ",
      themeLight: "ライト",
      themeDark: "ダーク",
      language: "言語",
      cardTags: "カードタグ",
      cardTagsHint: "カードに表示するラベルを選びます。",
      done: "完了",
      tabImport: "インポート",
      tabBulk: "一括",
      tabPrompts: "プロンプト",
      openNotebooks: "ノートブックを開く",
      yourNotebooks: "ノートブック",
      searchNotebooks: "検索",
      newNotebook: "新規ノートブック",
      tabSources: "ソース",
      tabStudio: "スタジオ",
      backNotebooks: "← ノートブック",
      openInNotebookLM: "NotebookLMで開く",
      tagNotebookSources: "ソース数",
      tagNotebookSourcesDesc: "カードのソース数",
      tagNotebookFolder: "フォルダ列",
      tagNotebookFolderDesc: "リストのフォルダ名",
      tagSourceType: "ソース種別",
      tagSourceTypeDesc: "Web、PDF、YouTube",
      tagSourceFolder: "ソースフォルダ",
      tagSourceFolderDesc: "ソース行のフォルダ",
      tagPromptType: "プロンプト種別",
      tagPromptTypeDesc: "テキスト、スライドなど",
      tagPromptCategory: "テンプレート",
      tagPromptCategoryDesc: "ビジネス、ポップなど",
      autoOpen: "自動で開く"
    },
    zh: {
      settings: "设置",
      theme: "主题",
      themeLight: "浅色",
      themeDark: "深色",
      language: "语言",
      cardTags: "卡片标签",
      cardTagsHint: "选择卡片和列表中显示的标签。",
      done: "完成",
      tabImport: "导入",
      tabBulk: "批量",
      tabPrompts: "提示词",
      openNotebooks: "打开笔记本",
      yourNotebooks: "你的笔记本",
      searchNotebooks: "搜索笔记本",
      newNotebook: "新建笔记本",
      tabSources: "来源",
      tabStudio: "工作室",
      backNotebooks: "← 笔记本",
      openInNotebookLM: "在 NotebookLM 中打开",
      tagNotebookSources: "来源数量",
      tagNotebookSourcesDesc: "卡片上的来源数",
      tagNotebookFolder: "文件夹列",
      tagNotebookFolderDesc: "列表视图中的文件夹",
      tagSourceType: "来源类型",
      tagSourceTypeDesc: "网页、PDF、YouTube",
      tagSourceFolder: "来源文件夹",
      tagSourceFolderDesc: "来源行的文件夹标签",
      tagPromptType: "提示词类型",
      tagPromptTypeDesc: "文本、幻灯片、播客",
      tagPromptCategory: "模板风格",
      tagPromptCategoryDesc: "商务、流行、艺术",
      autoOpen: "自动打开"
    }
  };

  const LANGUAGES = [
    { id: "en", label: "English" },
    { id: "es", label: "Español" },
    { id: "de", label: "Deutsch" },
    { id: "fr", label: "Français" },
    { id: "pt", label: "Português" },
    { id: "ja", label: "日本語" },
    { id: "zh", label: "中文" }
  ];

  let currentLang = "en";

  function t(key, fallback = "") {
    const pack = MESSAGES[currentLang] || MESSAGES.en;
    return pack[key] ?? MESSAGES.en[key] ?? (fallback || key);
  }

  function setLanguage(lang) {
    currentLang = MESSAGES[lang] ? lang : "en";
    document.documentElement.lang = currentLang === "zh" ? "zh-CN" : currentLang;
  }

  function apply(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.dataset.i18n;

      if (key) {
        node.textContent = t(key);
      }
    });

    root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      const key = node.dataset.i18nPlaceholder;

      if (key) {
        node.setAttribute("placeholder", t(key));
      }
    });

    root.querySelectorAll("[data-i18n-title]").forEach((node) => {
      const key = node.dataset.i18nTitle;

      if (key) {
        node.setAttribute("title", t(key));
        node.setAttribute("aria-label", t(key));
      }
    });
  }

  async function init(language) {
    setLanguage(language || "en");
    apply();
  }

  return { LANGUAGES, t, setLanguage, apply, init, getLanguage: () => currentLang };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsI18n = NotebookToolsI18n;
}
