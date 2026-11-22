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
