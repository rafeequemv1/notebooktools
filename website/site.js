/* Shared site chrome behaviour: mobile menu + header scroll state. */
(function () {
  var header = document.querySelector(".site-header");
  if (!header) return;

  var toggle = header.querySelector(".nav-toggle");
  var nav = header.querySelector(".site-nav");

  function setOpen(open) {
    header.classList.toggle("is-open", open);
    document.documentElement.classList.toggle("nav-open", open);
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setOpen(!header.classList.contains("is-open"));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia("(min-width: 861px)").addEventListener("change", function (mq) {
      if (mq.matches) setOpen(false);
    });
  }


  // "Who it's for" dropdown: click / keyboard toggle (hover handled in CSS on desktop).
  document.querySelectorAll(".nav-menu").forEach(function (menu) {
    var btn = menu.querySelector(".nav-menu-btn");
    if (!btn) return;
    function set(open) {
      menu.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      set(!menu.classList.contains("is-open"));
    });
    document.addEventListener("click", function (e) {
      if (!menu.contains(e.target)) set(false);
    });
    menu.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { set(false); btn.focus(); }
    });
  });

  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
})();

/* Install buttons that fit the visitor's browser. The extension installs from
   the Chrome Web Store in Chrome and in Edge; phones, Safari and Firefox can't
   install it, so there the button sends the link to the visitor's computer. */
(function () {
  var STORE = "chromewebstore.google.com/detail/notebooktools";
  var ua = navigator.userAgent || "";
  var mobile = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua) || (navigator.userAgentData && navigator.userAgentData.mobile) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var edge = /Edg\//.test(ua);
  var firefox = /Firefox\//.test(ua);
  var safari = /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(ua);
  var kind = mobile ? "mobile" : edge ? "edge" : firefox || safari ? "other" : "chrome";
  document.documentElement.setAttribute("data-browser", kind);
  if (kind === "chrome") return;

  var lang = (document.documentElement.lang || "en").slice(0, 2);
  var T = {
    en: { send: "Send it to my computer", sendShort: "Send to computer", subject: "Install NotebookTools on my computer", body: "NotebookTools adds bulk import, folders, prompts and exports to Gemini Notebook (NotebookLM). It runs in Chrome or Edge on a computer:", sent: "Link ready. Open it on your computer to install.", edgeNote: "Works in Edge: on the store page, click <b>Allow extensions from other stores</b>, then <b>Add to Chrome</b>.", otherNote: "NotebookTools runs in Chrome or Edge on a computer. Send yourself the link, or edit a slide deck right here.", mobileNote: "NotebookTools runs in Chrome or Edge on a computer. Send yourself the link for later.", tryEditor: "Edit a slide deck free" },
    es: { send: "Envíalo a mi ordenador", sendShort: "Enviar al ordenador", subject: "Instalar NotebookTools en mi ordenador", body: "NotebookTools añade importación masiva, carpetas, prompts y exportaciones a Gemini Notebook (NotebookLM). Funciona en Chrome o Edge en un ordenador:", sent: "Enlace listo. Ábrelo en tu ordenador para instalarlo.", edgeNote: "Funciona en Edge: en la tienda, haz clic en <b>Permitir extensiones de otras tiendas</b> y luego en <b>Añadir a Chrome</b>.", otherNote: "NotebookTools funciona en Chrome o Edge en un ordenador. Envíate el enlace.", mobileNote: "NotebookTools funciona en Chrome o Edge en un ordenador. Envíate el enlace para después.", tryEditor: "Edita una presentación gratis" },
    pt: { send: "Enviar para meu computador", sendShort: "Enviar ao computador", subject: "Instalar o NotebookTools no meu computador", body: "O NotebookTools adiciona importação em massa, pastas, prompts e exportações ao Gemini Notebook (NotebookLM). Funciona no Chrome ou Edge em um computador:", sent: "Link pronto. Abra no computador para instalar.", edgeNote: "Funciona no Edge: na loja, clique em <b>Permitir extensões de outras lojas</b> e depois em <b>Usar no Chrome</b>.", otherNote: "O NotebookTools funciona no Chrome ou Edge em um computador. Envie o link para você.", mobileNote: "O NotebookTools funciona no Chrome ou Edge em um computador. Envie o link para depois.", tryEditor: "Edite uma apresentação grátis" },
    fr: { send: "M’envoyer le lien", sendShort: "Envoyer sur PC", subject: "Installer NotebookTools sur mon ordinateur", body: "NotebookTools ajoute l’import en masse, les dossiers, les prompts et les exports à Gemini Notebook (NotebookLM). Il fonctionne dans Chrome ou Edge sur ordinateur :", sent: "Lien prêt. Ouvrez-le sur votre ordinateur pour l’installer.", edgeNote: "Fonctionne dans Edge : sur la boutique, cliquez sur <b>Autoriser les extensions d’autres magasins</b>, puis sur <b>Ajouter à Chrome</b>.", otherNote: "NotebookTools fonctionne dans Chrome ou Edge sur ordinateur. Envoyez-vous le lien.", mobileNote: "NotebookTools fonctionne dans Chrome ou Edge sur ordinateur. Envoyez-vous le lien pour plus tard.", tryEditor: "Modifier un diaporama gratuitement" },
    de: { send: "An meinen Computer senden", sendShort: "An Computer senden", subject: "NotebookTools auf meinem Computer installieren", body: "NotebookTools ergänzt Gemini Notebook (NotebookLM) um Massenimport, Ordner, Prompts und Exporte. Es läuft in Chrome oder Edge auf dem Computer:", sent: "Link bereit. Öffne ihn am Computer, um die Erweiterung zu installieren.", edgeNote: "Funktioniert in Edge: Klicke im Store auf <b>Erweiterungen aus anderen Stores zulassen</b> und dann auf <b>Zu Chrome hinzufügen</b>.", otherNote: "NotebookTools läuft in Chrome oder Edge auf dem Computer. Schick dir den Link.", mobileNote: "NotebookTools läuft in Chrome oder Edge auf dem Computer. Schick dir den Link für später.", tryEditor: "Präsentation kostenlos bearbeiten" },
    it: { send: "Invia al mio computer", sendShort: "Invia al computer", subject: "Installare NotebookTools sul mio computer", body: "NotebookTools aggiunge importazione in blocco, cartelle, prompt ed esportazioni a Gemini Notebook (NotebookLM). Funziona in Chrome o Edge su computer:", sent: "Link pronto. Aprilo sul computer per installarlo.", edgeNote: "Funziona in Edge: nello store, fai clic su <b>Consenti estensioni da altri store</b> e poi su <b>Aggiungi a Chrome</b>.", otherNote: "NotebookTools funziona in Chrome o Edge su computer. Inviati il link.", mobileNote: "NotebookTools funziona in Chrome o Edge su computer. Inviati il link per dopo.", tryEditor: "Modifica una presentazione gratis" }
  };
  var t = T[lang] || T.en;
  var track = function (action) { try { if (typeof window.piqo === "function") window.piqo("Install CTA", { browser: kind, action: action }); } catch (e) { /* analytics never breaks the page */ } };
  var EDGE_ICON = '<svg class="chrome-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1b8be0"/><path d="M3.6 15.6C5 19.3 8.8 21.6 12.9 21.1c3.1-.4 5.6-2.4 6.8-5-2.1 1.4-5.6 1.8-7.8.4-1.6-1-2.1-2.9-1.2-4.3-2.7.2-5.5 1.4-7.1 3.4z" fill="#3cc56b"/><path d="M8.4 12.4c.6-2.6 3.4-4.2 6.2-3.6 2.6.5 4.4 2.6 4.2 4.8 1.6-3.6-.4-7.6-4.4-8.6-4.8-1.2-9.4 2-10.2 6.6 1.2-.2 2.8.2 4.2.8z" fill="#fff" opacity=".92"/></svg>';
  var SEND_ICON = '<svg class="chrome-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/></svg>';
  var isButton = function (a) { return /\b(button|header-chrome|header-cta)\b/.test(a.className); };

  function toast(msg) {
    var el = document.createElement("div");
    el.className = "nt-send-toast";
    el.setAttribute("role", "status");
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add("is-leaving"); }, 3200);
    setTimeout(function () { el.remove(); }, 3600);
  }
  function sendToComputer() {
    var url = "https://www.notebooktools.com/?utm_source=send-to-computer";
    if (navigator.share) {
      navigator.share({ title: t.subject, text: t.body, url: url }).then(function () { track("share"); toast(t.sent); }).catch(function () {});
      return;
    }
    track("email");
    location.href = "mailto:?subject=" + encodeURIComponent(t.subject) + "&body=" + encodeURIComponent(t.body + "\n\n" + url);
  }

  document.querySelectorAll('a[href*="' + STORE + '"]').forEach(function (a) {
    if (kind === "edge") {
      if (!isButton(a)) return;
      var walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
      for (var n = walker.nextNode(); n; n = walker.nextNode()) n.nodeValue = n.nodeValue.replace(/Chrome/g, "Edge");
      var icon = a.querySelector("svg.chrome-icon");
      if (icon) icon.outerHTML = EDGE_ICON;
      a.addEventListener("click", function () { track("store"); });
      return;
    }
    // Phones, Safari, Firefox: send the link to a computer instead
    if (isButton(a)) {
      var short = /header-cta|button-sm|header-chrome/.test(a.className);
      a.innerHTML = SEND_ICON + "<span>" + (short ? t.sendShort : t.send) + "</span>";
    }
    a.removeAttribute("target");
    a.addEventListener("click", function (e) { e.preventDefault(); sendToComputer(); });
  });

  // The homepage hero says what to do in this browser
  var actions = document.querySelector(".hero-actions");
  if (actions) {
    var note = document.createElement("p");
    note.className = "hero-browser-note";
    note.innerHTML = kind === "edge" ? t.edgeNote : kind === "other" ? t.otherNote : t.mobileNote;
    actions.insertAdjacentElement("afterend", note);
    // On a computer without Chrome or Edge, the slide editor works right here
    var ghost = actions.querySelector(".button-ghost");
    if (kind === "other" && ghost) { ghost.href = "/tools/edit-notebooklm-slides"; ghost.textContent = t.tryEditor; }
  }
})();
