const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/notebooktools-%E2%80%94-import-to/fhjgbniefbimnklnnomlhkkiekcjddmj";

document.querySelectorAll(".chrome-store-link").forEach((link) => {
  link.href = CHROME_STORE_URL;
});

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function initBlogToc() {
  const body = document.querySelector(".blog-article-body");
  const layout = document.querySelector(".blog-article-layout");

  if (!body || !layout) {
    return;
  }

  const headings = [...body.querySelectorAll("h2")];

  if (headings.length < 2) {
    return;
  }

  const usedIds = new Set();

  headings.forEach((heading) => {
    if (!heading.id) {
      let id = slugify(heading.textContent);
      let unique = id;
      let suffix = 2;

      while (usedIds.has(unique)) {
        unique = `${id}-${suffix}`;
        suffix += 1;
      }

      heading.id = unique;
      usedIds.add(unique);
    } else {
      usedIds.add(heading.id);
    }
  });

  const nav = document.createElement("nav");
  nav.className = "blog-toc-sidebar";
  nav.setAttribute("aria-label", "On this page");

  const label = document.createElement("p");
  label.className = "blog-toc-label";
  label.textContent = "On this page";

  const list = document.createElement("ul");
  list.className = "blog-toc-nav";

  headings.forEach((heading) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent.trim();
    item.appendChild(link);
    list.appendChild(item);
  });

  nav.appendChild(label);
  nav.appendChild(list);
  layout.insertBefore(nav, layout.firstChild);
  layout.classList.add("blog-article-layout--with-toc");
}

async function copyText(text, button, originalLabel) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  button.textContent = "Copied!";
  button.classList.add("is-copied");

  window.setTimeout(() => {
    button.textContent = originalLabel;
    button.classList.remove("is-copied");
  }, 2000);
}

async function copyPromptText(button) {
  const block = button.closest(".blog-prompt-block, .blog-prompt-card");
  const textEl = block?.querySelector(".blog-prompt-text");

  if (!textEl) {
    return;
  }

  await copyText(textEl.textContent.trim(), button, button.textContent);
}

function enhancePromptBlocks() {
  document.querySelectorAll(".blog-prompt-block").forEach((block) => {
    if (block.querySelector(".blog-prompt-block-head")) {
      return;
    }

    const label = block.querySelector(".blog-prompt-label");
    const copy = block.querySelector(".blog-prompt-copy");

    if (!label || !copy) {
      return;
    }

    const head = document.createElement("div");
    head.className = "blog-prompt-block-head";
    label.remove();
    copy.remove();
    head.appendChild(label);
    head.appendChild(copy);
    block.insertBefore(head, block.firstChild);
    copy.textContent = "Copy";
  });
}

function initPromptCopy() {
  document.querySelectorAll(".blog-prompt-copy").forEach((button) => {
    button.addEventListener("click", () => {
      copyPromptText(button);
    });
  });

  document.querySelectorAll(".blog-prompt-copy-section").forEach((button) => {
    button.addEventListener("click", async () => {
      const group = button.closest(".blog-prompt-group");
      const prompts = group?.querySelectorAll(".blog-prompt-text");

      if (!prompts?.length) {
        return;
      }

      const combined = [...prompts]
        .map((prompt, index) => `--- Prompt ${index + 1} ---\n${prompt.textContent.trim()}`)
        .join("\n\n");

      await copyText(combined, button, button.textContent);
    });
  });
}

function initPromptFilter() {
  const toolbar = document.querySelector(".blog-prompt-filter");

  if (!toolbar) {
    return;
  }

  const buttons = [...toolbar.querySelectorAll(".blog-prompt-filter-btn")];
  const cards = [...document.querySelectorAll(".blog-prompt-card[data-prompt-style]")];
  const groups = [...document.querySelectorAll(".blog-prompt-group")];

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;

      buttons.forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });

      cards.forEach((card) => {
        const match = filter === "all" || card.dataset.promptStyle === filter;
        card.classList.toggle("is-hidden", !match);
      });

      groups.forEach((group) => {
        const visibleCards = group.querySelectorAll(".blog-prompt-card:not(.is-hidden)");
        group.style.display = visibleCards.length ? "" : "none";
      });
    });
  });
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const href = link.getAttribute("href");

    if (!href || href === "#") {
      return;
    }

    const target = document.querySelector(href);

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

initBlogToc();
enhancePromptBlocks();
initPromptCopy();
initPromptFilter();
