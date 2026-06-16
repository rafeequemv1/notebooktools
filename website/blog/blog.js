(function () {
  const cards = document.querySelectorAll("[data-blog-category]");
  const links = document.querySelectorAll(".blog-category-link");
  if (!cards.length || !links.length) return;

  function setActive(category) {
    links.forEach((link) => {
      const match = link.dataset.category === category;
      link.classList.toggle("is-active", match);
      if (match) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    cards.forEach((card) => {
      const show = category === "all" || card.dataset.blogCategory === category;
      card.hidden = !show;
    });
  }

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setActive(link.dataset.category || "all");
      history.replaceState(null, "", link.getAttribute("href") || "#");
    });
  });

  const initial = new URLSearchParams(window.location.search).get("category") || "all";
  setActive(initial);
})();
