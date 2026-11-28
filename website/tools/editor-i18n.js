/* Translates the slide editor's interface on the translated editor pages
   (/es/, /pt/, /zh-tw/). The editor builds its interface in English; this
   swaps visible labels, tooltips and status messages for the page's language
   (<html lang>) as they appear. Untranslated text stays in English. */
(function () {
  "use strict";

  const lang = (document.documentElement.lang || "en").toLowerCase();
  const key = lang.startsWith("zh") ? "zh" : lang.slice(0, 2);

  const EXACT = {
    es: {
      "Drop slide PDF or images": "Suelta el PDF o las imágenes",
      "or": "o",
      "Choose files": "Elegir archivos",
      "Try with a sample set": "Probar con un ejemplo",
      "Making the sample…": "Preparando el ejemplo…",
      "Stays on your device. Nothing is uploaded.": "Se queda en tu dispositivo. No se sube nada.",
      "Editable text (OCR)": "Texto editable (OCR)",
      "Movable pictures and shapes": "Imágenes y formas movibles",
      "Edit text": "Edita el texto",
      "right on the slide: click, double-click to type, drag to move.": "directamente en la diapositiva: clic, doble clic para escribir, arrastra para mover.",
      "Format, animate and add transitions": "Da formato, anima y añade transiciones",
      ", then present from the browser.": " y presenta desde el navegador.",
      "Download PowerPoint": "Descargar PowerPoint",
      "with real text boxes, transitions and animations.": "con cuadros de texto reales, transiciones y animaciones.",
      "Private": "Privado",
      ": the deck never leaves your browser.": ": la presentación nunca sale de tu navegador.",
      "Your presentations": "Tus presentaciones",
      "Translate": "Traducir",
      "Translate the slides": "Traducir las diapositivas",
      "Translate the slides into another language": "Traducir las diapositivas a otro idioma",
      "Into": "A",
      "All slides": "Todas las diapositivas",
      "This slide": "Esta diapositiva",
      "Speaker notes too": "También las notas del orador",
      "Runs in Chrome on this computer. Nothing is uploaded. The first time, Chrome downloads the language. Ctrl+Z undoes it.": "Funciona en Chrome en este ordenador. No se sube nada. La primera vez, Chrome descarga el idioma. Ctrl+Z lo deshace.",
      "Translation uses the translator built into Chrome on a computer (version 138 or newer), so your slides stay on your device. This browser doesn't have it. Open this page in Chrome on a computer.": "La traducción usa el traductor integrado en Chrome para ordenador (versión 138 o posterior), así tus diapositivas no salen de tu dispositivo. Este navegador no lo tiene. Abre esta página en Chrome en un ordenador.",
      "Starting the translation…": "Iniciando la traducción…",
      "Waiting for the text on every slide to be read…": "Esperando a que se lea el texto de todas las diapositivas…",
      "There was no text to translate yet.": "Todavía no hay texto que traducir.",
      "Open": "Abrir", "Text": "Texto", "Shape": "Forma", "Picture": "Imagen", "Original": "Original", "Present": "Presentar",
      "Open another deck": "Abrir otra presentación", "Undo (Ctrl+Z)": "Deshacer (Ctrl+Z)", "Redo (Ctrl+Shift+Z)": "Rehacer (Ctrl+Mayús+Z)",
      "Add a text box": "Añadir un cuadro de texto", "Add a shape": "Añadir una forma", "Add a picture": "Añadir una imagen",
      "Compare with the original slide": "Comparar con la diapositiva original", "Present from this slide (F5)": "Presentar desde esta diapositiva (F5)",
      "Full-screen editor": "Editor a pantalla completa", "More formats": "Más formatos",
      "PowerPoint (.pptx), editable": "PowerPoint (.pptx), editable", "PDF with real text": "PDF con texto real",
      "PNG images (.zip)": "Imágenes PNG (.zip)", "This slide as PNG": "Esta diapositiva en PNG", "All pictures (.zip)": "Todas las imágenes (.zip)",
      "Slides": "Diapositivas", "New slide": "Nueva diapositiva", "Opening your deck": "Abriendo tu presentación",
      "Design": "Diseño", "Motion": "Animación", "Background": "Fondo", "Transition": "Transición", "No transition": "Sin transición",
      "Read text again": "Volver a leer el texto", "Delete slide": "Eliminar diapositiva",
      "Opening…": "Abriendo…", "Downloaded.": "Descargado.", "Export failed.": "La exportación falló.", "Ready.": "Listo.",
      "Reading the text on each slide. You can start editing slides that are ready.": "Leyendo el texto de cada diapositiva. Ya puedes editar las que estén listas.",
      "Opened. Text stays part of the slide image.": "Abierto. El texto sigue siendo parte de la imagen.",
      "Click or → for next · ← back · Esc to exit": "Clic o → para avanzar · ← atrás · Esc para salir",
      "Your PowerPoint is downloading. Next time, skip the PDF.": "Tu PowerPoint se está descargando. La próxima vez, sáltate el PDF.",
      "Your download has started. Next time, skip the PDF.": "Tu descarga ha empezado. La próxima vez, sáltate el PDF.",
      "The free NotebookTools extension opens NotebookLM slide decks in this editor right inside NotebookLM, and adds bulk import, folders and a prompt library.": "La extensión gratuita NotebookTools abre las presentaciones de NotebookLM en este editor dentro de NotebookLM, y añade importación masiva, carpetas y una biblioteca de prompts.",
      "Add to Chrome, free": "Añadir a Chrome, gratis", "Not now": "Ahora no", "Don't show again": "No volver a mostrar",
      "Click anything on the slide to format it · double-click text to type": "Haz clic en cualquier elemento para darle formato · doble clic en el texto para escribir", "Slide picture": "Imagen de la diapositiva", "Colour": "Color", "Remove text boxes": "Quitar cuadros de texto", "Speaker notes": "Notas del orador", "Use slide picture": "Usar imagen de la diapositiva", "Use on all slides": "Usar en todas las diapositivas", "Speed": "Velocidad", "Order on this slide": "Orden en esta diapositiva", "Line up with the slide": "Alinear con la diapositiva", "Straighten": "Enderezar", "Split": "Dividir", "Merge": "Unir", "Size (cm)": "Tamaño (cm)", "Position (cm)": "Posición (cm)", "Rotation": "Rotación", "Reset shape": "Restablecer forma", "Replace": "Reemplazar", "On this slide": "En esta diapositiva", "Layer": "Capa", "Earlier": "Antes", "Later": "Después", "Insert shape": "Insertar forma", "Fill": "Relleno", "Arrange": "Organizar", "Add text": "Añadir texto",
    },
    pt: {
      "Drop slide PDF or images": "Solte o PDF ou as imagens",
      "or": "ou",
      "Choose files": "Escolher arquivos",
      "Try with a sample set": "Testar com um exemplo",
      "Making the sample…": "Preparando o exemplo…",
      "Stays on your device. Nothing is uploaded.": "Fica no seu dispositivo. Nada é enviado.",
      "Editable text (OCR)": "Texto editável (OCR)",
      "Movable pictures and shapes": "Imagens e formas móveis",
      "Edit text": "Edite o texto",
      "right on the slide: click, double-click to type, drag to move.": "direto no slide: clique, clique duas vezes para digitar, arraste para mover.",
      "Format, animate and add transitions": "Formate, anime e adicione transições",
      ", then present from the browser.": " e apresente pelo navegador.",
      "Download PowerPoint": "Baixar PowerPoint",
      "with real text boxes, transitions and animations.": "com caixas de texto de verdade, transições e animações.",
      "Private": "Privado",
      ": the deck never leaves your browser.": ": a apresentação nunca sai do seu navegador.",
      "Your presentations": "Suas apresentações",
      "Translate": "Traduzir",
      "Translate the slides": "Traduzir os slides",
      "Translate the slides into another language": "Traduzir os slides para outro idioma",
      "Into": "Para",
      "All slides": "Todos os slides",
      "This slide": "Este slide",
      "Speaker notes too": "As notas do apresentador também",
      "Runs in Chrome on this computer. Nothing is uploaded. The first time, Chrome downloads the language. Ctrl+Z undoes it.": "Funciona no Chrome neste computador. Nada é enviado. Na primeira vez, o Chrome baixa o idioma. Ctrl+Z desfaz.",
      "Translation uses the translator built into Chrome on a computer (version 138 or newer), so your slides stay on your device. This browser doesn't have it. Open this page in Chrome on a computer.": "A tradução usa o tradutor integrado ao Chrome para computador (versão 138 ou mais recente), então seus slides ficam no seu dispositivo. Este navegador não tem esse recurso. Abra esta página no Chrome em um computador.",
      "Starting the translation…": "Iniciando a tradução…",
      "Waiting for the text on every slide to be read…": "Aguardando a leitura do texto de todos os slides…",
      "There was no text to translate yet.": "Ainda não há texto para traduzir.",
      "Open": "Abrir", "Text": "Texto", "Shape": "Forma", "Picture": "Imagem", "Original": "Original", "Present": "Apresentar",
      "Open another deck": "Abrir outra apresentação", "Undo (Ctrl+Z)": "Desfazer (Ctrl+Z)", "Redo (Ctrl+Shift+Z)": "Refazer (Ctrl+Shift+Z)",
      "Add a text box": "Adicionar caixa de texto", "Add a shape": "Adicionar forma", "Add a picture": "Adicionar imagem",
      "Compare with the original slide": "Comparar com o slide original", "Present from this slide (F5)": "Apresentar a partir deste slide (F5)",
      "Full-screen editor": "Editor em tela cheia", "More formats": "Mais formatos",
      "PowerPoint (.pptx), editable": "PowerPoint (.pptx), editável", "PDF with real text": "PDF com texto real",
      "PNG images (.zip)": "Imagens PNG (.zip)", "This slide as PNG": "Este slide em PNG", "All pictures (.zip)": "Todas as imagens (.zip)",
      "Slides": "Slides", "New slide": "Novo slide", "Opening your deck": "Abrindo sua apresentação",
      "Design": "Design", "Motion": "Animação", "Background": "Fundo", "Transition": "Transição", "No transition": "Sem transição",
      "Read text again": "Ler o texto de novo", "Delete slide": "Excluir slide",
      "Opening…": "Abrindo…", "Downloaded.": "Baixado.", "Export failed.": "A exportação falhou.", "Ready.": "Pronto.",
      "Reading the text on each slide. You can start editing slides that are ready.": "Lendo o texto de cada slide. Você já pode editar os slides prontos.",
      "Opened. Text stays part of the slide image.": "Aberto. O texto continua fazendo parte da imagem.",
      "Click or → for next · ← back · Esc to exit": "Clique ou → para avançar · ← voltar · Esc para sair",
      "Your PowerPoint is downloading. Next time, skip the PDF.": "Seu PowerPoint está sendo baixado. Da próxima vez, pule o PDF.",
      "Your download has started. Next time, skip the PDF.": "Seu download começou. Da próxima vez, pule o PDF.",
      "The free NotebookTools extension opens NotebookLM slide decks in this editor right inside NotebookLM, and adds bulk import, folders and a prompt library.": "A extensão grátis NotebookTools abre as apresentações do NotebookLM neste editor dentro do NotebookLM e adiciona importação em massa, pastas e uma biblioteca de prompts.",
      "Add to Chrome, free": "Adicionar ao Chrome, grátis", "Not now": "Agora não", "Don't show again": "Não mostrar de novo",
      "Click anything on the slide to format it · double-click text to type": "Clique em qualquer item para formatar · clique duas vezes no texto para digitar", "Slide picture": "Imagem do slide", "Colour": "Cor", "Remove text boxes": "Remover caixas de texto", "Speaker notes": "Anotações do apresentador", "Use slide picture": "Usar imagem do slide", "Use on all slides": "Usar em todos os slides", "Speed": "Velocidade", "Order on this slide": "Ordem neste slide", "Line up with the slide": "Alinhar ao slide", "Straighten": "Endireitar", "Split": "Dividir", "Merge": "Juntar", "Size (cm)": "Tamanho (cm)", "Position (cm)": "Posição (cm)", "Rotation": "Rotação", "Reset shape": "Redefinir forma", "Replace": "Substituir", "On this slide": "Neste slide", "Layer": "Camada", "Earlier": "Antes", "Later": "Depois", "Insert shape": "Inserir forma", "Fill": "Preenchimento", "Arrange": "Organizar", "Add text": "Adicionar texto",
    },
    zh: {
      "Drop slide PDF or images": "拖放簡報 PDF 或圖片",
      "or": "或",
      "Choose files": "選擇檔案",
      "Try with a sample set": "用範例試試看",
      "Making the sample…": "正在準備範例…",
      "Stays on your device. Nothing is uploaded.": "檔案留在你的裝置上，不會上傳。",
      "Editable text (OCR)": "可編輯文字（OCR）",
      "Movable pictures and shapes": "可移動的圖片和圖形",
      "Edit text": "編輯文字",
      "right on the slide: click, double-click to type, drag to move.": "直接在投影片上：按一下選取、按兩下輸入、拖曳移動。",
      "Format, animate and add transitions": "設定格式、動畫和轉場",
      ", then present from the browser.": "，然後直接在瀏覽器中播放。",
      "Download PowerPoint": "下載 PowerPoint",
      "with real text boxes, transitions and animations.": "，包含真正的文字方塊、轉場和動畫。",
      "Private": "私密",
      ": the deck never leaves your browser.": "：簡報不會離開你的瀏覽器。",
      "Your presentations": "你的簡報",
      "Translate": "翻譯",
      "Translate the slides": "翻譯投影片",
      "Translate the slides into another language": "將投影片翻譯成其他語言",
      "Into": "翻譯成",
      "All slides": "所有投影片",
      "This slide": "這張投影片",
      "Speaker notes too": "也翻譯講者備忘稿",
      "Runs in Chrome on this computer. Nothing is uploaded. The first time, Chrome downloads the language. Ctrl+Z undoes it.": "在這台電腦的 Chrome 中執行，不會上傳任何內容。第一次使用時，Chrome 會下載該語言。按 Ctrl+Z 可復原。",
      "Translation uses the translator built into Chrome on a computer (version 138 or newer), so your slides stay on your device. This browser doesn't have it. Open this page in Chrome on a computer.": "翻譯功能使用電腦版 Chrome（138 版或更新版本）內建的翻譯器，投影片不會離開你的裝置。這個瀏覽器沒有此功能，請在電腦上用 Chrome 開啟此頁面。",
      "Starting the translation…": "正在開始翻譯…",
      "Waiting for the text on every slide to be read…": "正在等待讀取所有投影片的文字…",
      "There was no text to translate yet.": "目前還沒有可翻譯的文字。",
      "Open": "開啟", "Text": "文字", "Shape": "圖形", "Picture": "圖片", "Original": "原始", "Present": "播放",
      "Open another deck": "開啟其他簡報", "Undo (Ctrl+Z)": "復原 (Ctrl+Z)", "Redo (Ctrl+Shift+Z)": "重做 (Ctrl+Shift+Z)",
      "Add a text box": "新增文字方塊", "Add a shape": "新增圖形", "Add a picture": "新增圖片",
      "Compare with the original slide": "與原始投影片比較", "Present from this slide (F5)": "從這張投影片開始播放 (F5)",
      "Full-screen editor": "全螢幕編輯", "More formats": "更多格式",
      "PowerPoint (.pptx), editable": "PowerPoint (.pptx)，可編輯", "PDF with real text": "含真實文字的 PDF",
      "PNG images (.zip)": "PNG 圖片 (.zip)", "This slide as PNG": "這張投影片存成 PNG", "All pictures (.zip)": "所有圖片 (.zip)",
      "Slides": "投影片", "New slide": "新增投影片", "Opening your deck": "正在開啟你的簡報",
      "Design": "設計", "Motion": "動畫", "Background": "背景", "Transition": "轉場", "No transition": "無轉場",
      "Read text again": "重新讀取文字", "Delete slide": "刪除投影片",
      "Opening…": "正在開啟…", "Downloaded.": "已下載。", "Export failed.": "匯出失敗。", "Ready.": "完成。",
      "Reading the text on each slide. You can start editing slides that are ready.": "正在讀取每張投影片的文字。已完成的投影片可以先開始編輯。",
      "Opened. Text stays part of the slide image.": "已開啟。文字仍是投影片圖片的一部分。",
      "Click or → for next · ← back · Esc to exit": "按一下或 → 下一張 · ← 上一張 · Esc 結束",
      "Your PowerPoint is downloading. Next time, skip the PDF.": "你的 PowerPoint 正在下載。下次可以直接跳過 PDF。",
      "Your download has started. Next time, skip the PDF.": "已開始下載。下次可以直接跳過 PDF。",
      "The free NotebookTools extension opens NotebookLM slide decks in this editor right inside NotebookLM, and adds bulk import, folders and a prompt library.": "免費的 NotebookTools 擴充功能會在 NotebookLM 裡直接用這個編輯器開啟簡報，還提供大量匯入、資料夾和提示詞庫。",
      "Add to Chrome, free": "免費加到 Chrome", "Not now": "稍後再說", "Don't show again": "不要再顯示",
      "Click anything on the slide to format it · double-click text to type": "按一下投影片上的任何項目即可設定格式 · 按兩下文字即可輸入", "Slide picture": "投影片圖片", "Colour": "顏色", "Remove text boxes": "移除文字方塊", "Speaker notes": "演講者備忘稿", "Use slide picture": "使用投影片圖片", "Use on all slides": "套用到所有投影片", "Speed": "速度", "Order on this slide": "在這張投影片上的順序", "Line up with the slide": "對齊投影片", "Straighten": "拉直", "Split": "分割", "Merge": "合併", "Size (cm)": "大小 (公分)", "Position (cm)": "位置 (公分)", "Rotation": "旋轉", "Reset shape": "重設圖形", "Replace": "取代", "On this slide": "在這張投影片", "Layer": "圖層", "Earlier": "較早", "Later": "較晚", "Insert shape": "插入圖形", "Fill": "填滿", "Arrange": "排列", "Add text": "新增文字",
    },
  };

  // Messages with numbers in them
  const PATTERNS = {
    es: [
      [/^Translating into (.+): slide (\d+) of (\d+)$/, "Traduciendo a $1: diapositiva $2 de $3"],
      [/^Downloading (.+) in Chrome…$/, "Descargando $1 en Chrome…"],
      [/^Downloading (.+) in Chrome · (\d+)%$/, "Descargando $1 en Chrome · $2%"],
      [/^Translated (\d+) text box(?:es)? into (.+)\. Ctrl\+Z puts the original words back\.$/, "Se tradujeron $1 cuadros de texto a $2. Ctrl+Z recupera el texto original."],
      [/^Chrome can't translate (.+) into (.+) on this computer yet\.$/, "Chrome todavía no puede traducir de $1 a $2 en este ordenador."],
      [/^The translation stopped: (.*)$/, "La traducción se detuvo: $1"],
      [/^(\d+) text boxes\. Double-click text on the slide to edit it; drag to move\.$/, "$1 cuadros de texto. Haz doble clic en el texto de la diapositiva para editarlo; arrastra para mover."],
      [/^Slide (\d+) of (\d+)$/, "Diapositiva $1 de $2"],
      [/^Slide (\d+)$/, "Diapositiva $1"],
      [/^Opening slide (\d+) of (\d+)…$/, "Abriendo la diapositiva $1 de $2…"],
      [/^Reading text: slide (\d+) of (\d+)$/, "Leyendo texto: diapositiva $1 de $2"],
      [/^Reading text: slide (\d+) of (\d+) · (\d+)%$/, "Leyendo texto: diapositiva $1 de $2 · $3%"],
      [/^Reading text… (\d+)%$/, "Leyendo texto… $1%"],
      [/^Exporting slide (\d+) of (\d+)…$/, "Exportando la diapositiva $1 de $2…"],
      [/^Ready\. (\d+) text boxes(?: and (\d+) pictures?)? found.*$/, (m, a, b) => `Listo. ${a} cuadros de texto${b ? ` y ${b} imágenes` : ""} encontrados. Haz doble clic en cualquier texto para editarlo; arrastra las imágenes para moverlas.`],
      [/^PowerPoint downloaded.*$/, "PowerPoint descargado. Se abre en PowerPoint, Keynote o Google Slides (Archivo → Importar)."],
      [/^(\d+) pictures? downloaded\.$/, "$1 imágenes descargadas."],
    ],
    pt: [
      [/^Translating into (.+): slide (\d+) of (\d+)$/, "Traduzindo para $1: slide $2 de $3"],
      [/^Downloading (.+) in Chrome…$/, "Baixando $1 no Chrome…"],
      [/^Downloading (.+) in Chrome · (\d+)%$/, "Baixando $1 no Chrome · $2%"],
      [/^Translated (\d+) text box(?:es)? into (.+)\. Ctrl\+Z puts the original words back\.$/, "$1 caixas de texto traduzidas para $2. Ctrl+Z traz o texto original de volta."],
      [/^Chrome can't translate (.+) into (.+) on this computer yet\.$/, "O Chrome ainda não traduz de $1 para $2 neste computador."],
      [/^The translation stopped: (.*)$/, "A tradução parou: $1"],
      [/^(\d+) text boxes\. Double-click text on the slide to edit it; drag to move\.$/, "$1 caixas de texto. Clique duas vezes no texto do slide para editar; arraste para mover."],
      [/^Slide (\d+) of (\d+)$/, "Slide $1 de $2"],
      [/^Slide (\d+)$/, "Slide $1"],
      [/^Opening slide (\d+) of (\d+)…$/, "Abrindo o slide $1 de $2…"],
      [/^Reading text: slide (\d+) of (\d+)$/, "Lendo texto: slide $1 de $2"],
      [/^Reading text: slide (\d+) of (\d+) · (\d+)%$/, "Lendo texto: slide $1 de $2 · $3%"],
      [/^Reading text… (\d+)%$/, "Lendo texto… $1%"],
      [/^Exporting slide (\d+) of (\d+)…$/, "Exportando o slide $1 de $2…"],
      [/^Ready\. (\d+) text boxes(?: and (\d+) pictures?)? found.*$/, (m, a, b) => `Pronto. ${a} caixas de texto${b ? ` e ${b} imagens` : ""} encontradas. Clique duas vezes em qualquer texto para editar; arraste as imagens para mover.`],
      [/^PowerPoint downloaded.*$/, "PowerPoint baixado. Abre no PowerPoint, Keynote ou Google Slides (Arquivo → Importar)."],
      [/^(\d+) pictures? downloaded\.$/, "$1 imagens baixadas."],
    ],
    zh: [
      [/^Translating into (.+): slide (\d+) of (\d+)$/, "正在翻譯成$1：第 $2 張，共 $3 張"],
      [/^Downloading (.+) in Chrome…$/, "正在 Chrome 中下載$1…"],
      [/^Downloading (.+) in Chrome · (\d+)%$/, "正在 Chrome 中下載$1 · $2%"],
      [/^Translated (\d+) text box(?:es)? into (.+)\. Ctrl\+Z puts the original words back\.$/, "已將 $1 個文字方塊翻譯成$2。按 Ctrl+Z 可還原原文。"],
      [/^Chrome can't translate (.+) into (.+) on this computer yet\.$/, "這台電腦上的 Chrome 目前還無法將$1翻譯成$2。"],
      [/^The translation stopped: (.*)$/, "翻譯已停止：$1"],
      [/^(\d+) text boxes\. Double-click text on the slide to edit it; drag to move\.$/, "$1 個文字方塊。按兩下投影片上的文字即可編輯；拖曳即可移動。"],
      [/^Slide (\d+) of (\d+)$/, "第 $1 張，共 $2 張"],
      [/^Slide (\d+)$/, "第 $1 張"],
      [/^Opening slide (\d+) of (\d+)…$/, "正在開啟第 $1 張，共 $2 張…"],
      [/^Reading text: slide (\d+) of (\d+)$/, "正在讀取文字：第 $1 張，共 $2 張"],
      [/^Reading text: slide (\d+) of (\d+) · (\d+)%$/, "正在讀取文字：第 $1 張，共 $2 張 · $3%"],
      [/^Reading text… (\d+)%$/, "正在讀取文字… $1%"],
      [/^Exporting slide (\d+) of (\d+)…$/, "正在匯出第 $1 張，共 $2 張…"],
      [/^Ready\. (\d+) text boxes(?: and (\d+) pictures?)? found.*$/, (m, a, b) => `完成。找到 ${a} 個文字方塊${b ? `和 ${b} 張圖片` : ""}。按兩下任何文字即可編輯；拖曳圖片即可移動。`],
      [/^PowerPoint downloaded.*$/, "PowerPoint 已下載。可在 PowerPoint、Keynote 或 Google 簡報中開啟（檔案 → 匯入）。"],
      [/^(\d+) pictures? downloaded\.$/, "已下載 $1 張圖片。"],
    ],
  };

  const exact = EXACT[key];
  const patterns = PATTERNS[key] || [];
  if (!exact) return;

  function tr(text) {
    const core = text.trim();
    if (!core) return null;
    if (Object.prototype.hasOwnProperty.call(exact, core)) return text.replace(core, exact[core]);
    for (const [re, to] of patterns) if (re.test(core)) return text.replace(core, core.replace(re, to));
    return null;
  }

  const ATTRS = ["title", "aria-label", "placeholder"];
  // never the slides' own text (the stage, thumbnails, anything being typed)
  const SKIP = "[data-no-i18n], .se-stage, .se-thumbs, [contenteditable], textarea, input, .se-present-stage";
  function walk(root) {
    if (root.nodeType === 3) {
      if (root.parentElement?.closest(SKIP)) return;
      const t = tr(root.nodeValue);
      if (t !== null && t !== root.nodeValue) root.nodeValue = t;
      return;
    }
    if (root.nodeType !== 1 || root.closest?.(SKIP)) return;
    for (const a of ATTRS) {
      const v = root.getAttribute(a);
      if (v) { const t = tr(v); if (t !== null && t !== v) root.setAttribute(a, t); }
    }
    for (const child of root.childNodes) walk(child);
  }

  function start() {
    const app = document.getElementById("seApp");
    if (!app) return;
    walk(app);
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") walk(r.target);
        else if (r.type === "attributes") walk(r.target);
        else r.addedNodes.forEach(walk);
      }
    }).observe(app, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    // the install card is added to the editor; the presenter overlay may sit on <body>
    new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.matches?.(".se-install, .se-present")) walk(n); }))).observe(document.body, { childList: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
