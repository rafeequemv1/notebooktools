function cleanBlockText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stripTitleSuffix(title, pattern) {
  return String(title || "").replace(pattern, "").trim();
}

function buildConversationMarkdown(title, messages, sourceUrl) {
  const lines = [`# ${title}`, "", `Source: ${sourceUrl}`, ""];

  for (const message of messages) {
    lines.push(`## ${message.role}`, "", message.body, "");
  }

  return lines.join("\n").trim();
}

function normalizeChatGptRole(value) {
  const role = String(value || "").trim().toLowerCase();

  if (role === "user") {
    return "User";
  }

  if (role === "assistant") {
    return "Assistant";
  }

  return "";
}

function getChatGptMessageBody(roleNode) {
  const selectorCandidates = [".markdown.prose", ".markdown", ".whitespace-pre-wrap"];

  for (const selector of selectorCandidates) {
    const contentNode = roleNode.querySelector(selector);
    const text = cleanBlockText(contentNode?.innerText || contentNode?.textContent || "");

    if (text) {
      return text;
    }
  }

  return cleanBlockText(roleNode.innerText || roleNode.textContent || "");
}

function getChatGptMessages() {
  const turnMessages = Array.from(document.querySelectorAll("[data-turn-id]"))
    .flatMap((turn) => Array.from(turn.querySelectorAll("[data-message-author-role]")))
    .map((roleNode) => ({
      role: normalizeChatGptRole(roleNode.getAttribute("data-message-author-role")),
      body: getChatGptMessageBody(roleNode)
    }))
    .filter((item) => item.role && item.body);

  if (turnMessages.length) {
    return turnMessages;
  }

  return Array.from(document.querySelectorAll("[data-message-author-role]"))
    .map((roleNode) => ({
      role: normalizeChatGptRole(roleNode.getAttribute("data-message-author-role")),
      body: getChatGptMessageBody(roleNode)
    }))
    .filter((item) => item.role && item.body);
}

function extractChatGptConversation() {
  const messages = getChatGptMessages();

  if (!messages.length) {
    throw new Error("No ChatGPT messages found on this page yet.");
  }

  const url = new URL(location.href);
  const conversationId = String(url.pathname.match(/\/(?:c|share)\/([^/?#]+)/i)?.[1] || "").trim();
  const title = cleanBlockText(
    document.querySelector("main h1")?.textContent ||
    stripTitleSuffix(document.title, /\s*-\s*ChatGPT.*$/i) ||
    "ChatGPT Conversation"
  ) || "ChatGPT Conversation";
  const canonicalUrl = conversationId ? `https://chatgpt.com/c/${conversationId}` : url.href;
  const sourceTitle = `[CHATGPT] ${title}`;
  const plainText = messages.map((message) => `${message.role}\n\n${message.body}`).join("\n\n---\n\n");

  return {
    platform: "chatgpt",
    title: sourceTitle,
    url: canonicalUrl,
    plainText,
    markdown: buildConversationMarkdown(sourceTitle, messages, canonicalUrl),
    messages,
    messageCount: messages.length,
    exportedAt: new Date().toISOString()
  };
}

function isIgnoredGeminiText(text) {
  const value = cleanBlockText(text).toLowerCase();

  return !value || [
    "gemini can make mistakes",
    "upgrade",
    "new chat",
    "search chats",
    "library"
  ].includes(value);
}

function extractGeminiNodeText(node) {
  const blocks = Array.from(node?.querySelectorAll?.("p, li, pre, h1, h2, h3, h4, blockquote") || [])
    .map((item) => cleanBlockText(item.innerText || item.textContent || ""))
    .filter(Boolean);

  if (blocks.length) {
    return blocks.join("\n\n");
  }

  return cleanBlockText(node?.innerText || node?.textContent || "");
}

function getGeminiMessages() {
  const userNodes = Array.from(document.querySelectorAll(
    ".query-text-line, span.user-query-bubble-with-background, [data-test-id='luminous-collapsed-bubble']"
  ));
  const assistantNodes = Array.from(document.querySelectorAll(
    ".model-response-text .markdown, message-content .markdown, .message-content .markdown, .structured-content-container .markdown"
  ));

  const normalizeMessage = (role, node) => {
    const body = role === "User"
      ? cleanBlockText(node?.innerText || node?.textContent || "")
      : extractGeminiNodeText(node);

    if (!body || isIgnoredGeminiText(body)) {
      return null;
    }

    return { role, body, node };
  };

  const combined = [
    ...userNodes.map((node) => normalizeMessage("User", node)),
    ...assistantNodes.map((node) => normalizeMessage("Gemini", node))
  ].filter(Boolean);

  combined.sort((left, right) => {
    if (left.node === right.node) {
      return 0;
    }

    const position = left.node.compareDocumentPosition(right.node);

    if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1;
    }

    if (position & Node.DOCUMENT_POSITION_PRECEDING) {
      return 1;
    }

    return 0;
  });

  return combined.map(({ role, body }) => ({ role, body }));
}

function findGeminiTitle() {
  const candidates = [
    document.querySelector("top-bar-actions h1, top-bar-actions h2, top-bar-actions .conversation-title"),
    document.querySelector("[data-test-id='conversation-title'], [data-test-id='chat-title']")
  ]
    .map((node) => cleanBlockText(node?.textContent || ""))
    .filter((value) => value && !isIgnoredGeminiText(value));

  if (candidates.length) {
    return candidates[0];
  }

  const firstUser = getGeminiMessages().find((message) => message.role === "User");

  if (firstUser?.body) {
    return cleanBlockText(firstUser.body.split(/\r?\n/)[0] || "");
  }

  return stripTitleSuffix(document.title, /\s*-\s*Gemini.*$/i) || "Gemini Conversation";
}

function extractGeminiConversation() {
  const messages = getGeminiMessages();

  if (!messages.length) {
    throw new Error("No Gemini messages found on this page yet.");
  }

  const url = new URL(location.href);
  const conversationId = String(url.pathname.match(/\/app\/([^/?#]+)/i)?.[1] || "").trim();
  const title = cleanBlockText(findGeminiTitle()) || "Gemini Conversation";
  const sourceTitle = /^\[GEMINI\]/i.test(title) ? title : `[GEMINI] ${title}`;
  const canonicalUrl = conversationId ? `https://gemini.google.com/app/${conversationId}` : url.href;
  const plainText = messages.map((message) => `${message.role}\n\n${message.body}`).join("\n\n---\n\n");

  return {
    platform: "gemini",
    title: sourceTitle,
    url: canonicalUrl,
    plainText,
    markdown: buildConversationMarkdown(sourceTitle, messages, canonicalUrl),
    messages,
    messageCount: messages.length,
    exportedAt: new Date().toISOString()
  };
}

function getTweetArticles() {
  return Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
}

function extractTweetText(article) {
  const textNode = article.querySelector('[data-testid="tweetText"]');

  return cleanBlockText(textNode?.innerText || textNode?.textContent || "");
}

function extractTweetAuthor(article) {
  const userNode = article.querySelector('[data-testid="User-Name"]');

  return cleanBlockText(userNode?.innerText || userNode?.textContent || "").split("\n")[0] || "Author";
}

function extractXArticleBody() {
  const richText = document.querySelector('[data-testid="articleBodyRichText"]');

  if (richText) {
    return cleanBlockText(richText.innerText || richText.textContent || "");
  }

  const articleRoot = document.querySelector('article[data-testid="tweet"] [lang]');

  return cleanBlockText(articleRoot?.innerText || articleRoot?.textContent || "");
}

function extractXContent() {
  const url = new URL(location.href);
  const isArticle = /\/article\//i.test(url.pathname) || /\/i\/article\//i.test(url.pathname);
  const messages = [];

  if (isArticle) {
    const body = extractXArticleBody();

    if (!body) {
      throw new Error("No X article content found on this page yet.");
    }

    const title = cleanBlockText(
      document.querySelector("h1")?.textContent ||
      stripTitleSuffix(document.title, /\s*\/\s*X.*$/i) ||
      "X Article"
    ) || "X Article";

    messages.push({ role: "Article", body });
  } else {
    const tweets = getTweetArticles();

    for (const tweet of tweets) {
      const body = extractTweetText(tweet);

      if (!body) {
        continue;
      }

      messages.push({
        role: extractTweetAuthor(tweet),
        body
      });
    }

    if (!messages.length) {
      throw new Error("No posts found on this X page yet.");
    }
  }

  const title = cleanBlockText(
    document.querySelector('[data-testid="tweet"] h1')?.textContent ||
    document.querySelector("h1")?.textContent ||
    stripTitleSuffix(document.title, /\s*\/\s*X.*$/i) ||
    (isArticle ? "X Article" : "X Thread")
  ) || (isArticle ? "X Article" : "X Thread");
  const sourceTitle = `[X] ${title}`;
  const plainText = messages.map((message) => `${message.role}\n\n${message.body}`).join("\n\n---\n\n");

  return {
    platform: "x",
    title: sourceTitle,
    url: url.href.split("?")[0],
    plainText,
    markdown: buildConversationMarkdown(sourceTitle, messages, url.href.split("?")[0]),
    messages,
    messageCount: messages.length,
    exportedAt: new Date().toISOString()
  };
}

/* ---------- Shared helpers for the newer platforms ---------- */

const MIN_FALLBACK_TEXT_LENGTH = 200;
const MIN_EXTRACT_TEXT_LENGTH = 40;
const REDDIT_COMMENT_LIMIT = 50;
const PERPLEXITY_SOURCE_LIMIT = 30;

const MARKDOWN_SKIP_TAGS = new Set([
  "script", "style", "noscript", "svg", "template", "iframe", "button", "textarea", "input",
  "select", "option", "canvas", "video", "audio", "img", "picture", "object", "embed", "link", "meta"
]);

const MARKDOWN_BLOCK_TAGS = new Set([
  "address", "article", "aside", "dd", "details", "dialog", "div", "dl", "dt", "fieldset",
  "figcaption", "figure", "footer", "form", "header", "hgroup", "main", "nav", "section",
  "summary", "tr"
]);

const GENERIC_EXCLUDE_SELECTOR = [
  "nav", "aside", "footer", "header", "form", "dialog",
  "[role='navigation']", "[role='complementary']", "[role='banner']", "[role='contentinfo']",
  "[role='dialog']", "[role='menu']", "[role='toolbar']", "[role='tooltip']",
  "[contenteditable='true']", "[contenteditable='']"
].join(", ");

function queryAll(selector, root = document) {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch (_error) {
    return [];
  }
}

function dedupeNested(nodes) {
  const unique = Array.from(new Set(nodes));

  return unique.filter((node) => !unique.some((other) => other !== node && other.contains(node)));
}

function sortByDocumentPosition(items) {
  return items.sort((left, right) => {
    if (left.node === right.node) {
      return 0;
    }

    const position = left.node.compareDocumentPosition(right.node);

    if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1;
    }

    if (position & Node.DOCUMENT_POSITION_PRECEDING) {
      return 1;
    }

    return 0;
  });
}

function isHiddenForMarkdown(element, options) {
  if (element.hidden) {
    return true;
  }

  if (!options.keepAriaHidden && element.getAttribute("aria-hidden") === "true") {
    return true;
  }

  if (element.id && element.id.indexOf("notebooktools-") === 0) {
    return true;
  }

  const className = typeof element.className === "string" ? element.className : "";

  if (/(^|\s)(sr-only|visually-hidden|screen-reader-text|a11y-text)(\s|$)/.test(className)) {
    return true;
  }

  const style = window.getComputedStyle(element);

  return style.display === "none" || style.visibility === "hidden";
}

function inlineMarkdown(value) {
  return String(value || "").replace(/\s*\n+\s*/g, " ").trim();
}

function renderListMarkdown(listNode, options) {
  const ordered = listNode.localName === "ol";
  let index = Number(listNode.getAttribute("start")) || 1;
  const lines = [];

  for (const child of Array.from(listNode.children)) {
    if (child.localName !== "li") {
      continue;
    }

    const body = cleanMarkdownText(renderMarkdownNode(child, options))
      .replace(/\n{2,}/g, "\n")
      .split("\n")
      .join("\n  ");

    if (body) {
      lines.push(`${ordered ? `${index}.` : "-"} ${body}`);
      index += 1;
    }
  }

  return lines.length ? `\n\n${lines.join("\n")}\n\n` : "";
}

function renderTableMarkdown(tableNode, options) {
  const rows = queryAll("tr", tableNode)
    .map((row) => Array.from(row.children)
      .filter((cell) => cell.localName === "td" || cell.localName === "th")
      .map((cell) => inlineMarkdown(renderMarkdownNode(cell, options)).replace(/\|/g, "\\|")))
    .filter((cells) => cells.length);

  if (!rows.length) {
    return "";
  }

  const width = Math.max(...rows.map((cells) => cells.length));
  const toLine = (cells) => `| ${Array.from({ length: width }, (_v, i) => cells[i] || "").join(" | ")} |`;
  const lines = [toLine(rows[0]), `| ${Array.from({ length: width }, () => "---").join(" | ")} |`];

  rows.slice(1).forEach((cells) => lines.push(toLine(cells)));

  return `\n\n${lines.join("\n")}\n\n`;
}

function renderMarkdownNode(node, options) {
  if (node.nodeType === Node.TEXT_NODE) {
    return String(node.nodeValue || "").replace(/\s+/g, " ");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const tag = node.localName;

  if (MARKDOWN_SKIP_TAGS.has(tag)) {
    return "";
  }

  if (options.exclude) {
    try {
      if (node.matches(options.exclude)) {
        return "";
      }
    } catch (_error) {
      // Ignore invalid selectors.
    }
  }

  if (node.classList.contains("katex")) {
    const tex = node.querySelector('annotation[encoding="application/x-tex"]')?.textContent || "";

    if (tex.trim()) {
      return node.closest(".katex-display") ? `\n\n$$${tex.trim()}$$\n\n` : `$${tex.trim()}$`;
    }
  }

  if (isHiddenForMarkdown(node, options)) {
    return "";
  }

  const children = () => Array.from(node.childNodes).map((child) => renderMarkdownNode(child, options)).join("");

  switch (tag) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const text = inlineMarkdown(children());
      return text ? `\n\n${"#".repeat(Number(tag.slice(1)))} ${text}\n\n` : "";
    }
    case "br":
      return "\n";
    case "hr":
      return "\n\n---\n\n";
    case "pre": {
      const codeNode = node.querySelector("code");
      const code = String((codeNode || node).textContent || "").replace(/\n+$/, "");
      const language = String(codeNode?.className || "").match(/language-([\w+#.-]+)/)?.[1] || "";
      return code.trim() ? `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n` : "";
    }
    case "code": {
      const code = String(node.textContent || "");
      return code.trim() ? `\`${code.trim()}\`` : "";
    }
    case "strong":
    case "b": {
      const text = children();
      return text.trim() ? `${/^\s/.test(text) ? " " : ""}**${text.trim()}**${/\s$/.test(text) ? " " : ""}` : text;
    }
    case "em":
    case "i": {
      const text = children();
      return text.trim() ? `${/^\s/.test(text) ? " " : ""}*${text.trim()}*${/\s$/.test(text) ? " " : ""}` : text;
    }
    case "ul":
    case "ol":
      return renderListMarkdown(node, options);
    case "li":
      return `\n${children()}\n`;
    case "blockquote": {
      const text = cleanMarkdownText(children());
      return text ? `\n\n${text.split("\n").map((line) => `> ${line}`).join("\n")}\n\n` : "";
    }
    case "table":
      return renderTableMarkdown(node, options);
    case "p":
      return `\n\n${children()}\n\n`;
    default:
      return MARKDOWN_BLOCK_TAGS.has(tag) ? `\n${children()}\n` : children();
  }
}

function cleanMarkdownText(value) {
  const lines = String(value || "").replace(/ /g, " ").replace(/\r\n?/g, "\n").split("\n");
  let inFence = false;
  const output = [];

  for (const rawLine of lines) {
    if (/^\s*```/.test(rawLine)) {
      inFence = !inFence;
      output.push(rawLine.trim());
      continue;
    }

    if (inFence) {
      output.push(rawLine.replace(/\s+$/, ""));
      continue;
    }

    let line = rawLine.replace(/[ \t]{2,}/g, (match, offset) => (offset === 0 ? match : " ")).replace(/\s+$/, "");

    if (!/^\s+([-*]|\d+\.)\s/.test(line)) {
      line = line.replace(/^\s+/, "");
    }

    output.push(line);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function nodeToMarkdown(node, options = {}) {
  if (!node) {
    return "";
  }

  return cleanMarkdownText(renderMarkdownNode(node, options));
}

function firstLine(value, maxLength = 90) {
  const line = cleanBlockText(String(value || "").replace(/[#>*`]/g, "")).split(/\r?\n/).find(Boolean) || "";

  return line.length > maxLength ? `${line.slice(0, maxLength - 1).trim()}…` : line;
}

function cleanDocumentTitle(pattern) {
  return stripTitleSuffix(String(document.title || "").replace(/^\(\d+\+?\)\s*/, ""), pattern);
}

function canonicalPageUrl(keepParams = []) {
  const url = new URL(location.href);
  const kept = new URLSearchParams();

  for (const key of keepParams) {
    if (url.searchParams.has(key)) {
      kept.set(key, url.searchParams.get(key));
    }
  }

  url.hash = "";
  url.search = kept.toString();

  return url.href;
}

function buildExtractResult({ platform, tag, title, url, messages, appendix = [] }) {
  const cleanTitle = cleanBlockText(title) || "Untitled";
  const prefix = `[${tag}]`;
  const sourceTitle = cleanTitle.toUpperCase().indexOf(prefix) === 0 ? cleanTitle : `${prefix} ${cleanTitle}`;
  const sections = [...messages, ...appendix];
  const plainText = sections.map((message) => `${message.role}\n\n${message.body}`).join("\n\n---\n\n");

  return {
    platform,
    title: sourceTitle,
    url,
    plainText,
    markdown: buildConversationMarkdown(sourceTitle, sections, url),
    messages,
    messageCount: messages.length,
    exportedAt: new Date().toISOString()
  };
}

function collectRoleMessages(groups) {
  const items = [];

  for (const group of groups) {
    for (const node of group.nodes) {
      const body = group.extract ? group.extract(node) : nodeToMarkdown(node);

      if (body) {
        items.push({ role: group.role, body, node });
      }
    }
  }

  return sortByDocumentPosition(items).map(({ role, body }) => ({ role, body }));
}

/* ---------- Generic readable-text fallback ---------- */

function getGenericRoot(platform) {
  const spec = PLATFORM_SPECS[platform] || {};
  const selectors = [...(spec.fallbackRoots || []), "main", "[role='main']", "article", "#content", "#main"];
  let best = null;
  let bestLength = 0;

  for (const selector of selectors) {
    const node = queryAll(selector)[0];

    if (!node) {
      continue;
    }

    const length = cleanBlockText(node.innerText || "").length;

    if (length >= MIN_FALLBACK_TEXT_LENGTH) {
      return node;
    }

    if (length > bestLength) {
      best = node;
      bestLength = length;
    }
  }

  return best || document.body;
}

function getGenericText(platform) {
  const root = getGenericRoot(platform);

  return root ? nodeToMarkdown(root, { exclude: GENERIC_EXCLUDE_SELECTOR }) : "";
}

function genericPageHasContent(platform) {
  const root = getGenericRoot(platform);

  return cleanBlockText(root?.innerText || "").length > MIN_FALLBACK_TEXT_LENGTH;
}

function extractGenericPage(platform) {
  const spec = PLATFORM_SPECS[platform];
  const body = getGenericText(platform);

  if (!spec || body.length < MIN_EXTRACT_TEXT_LENGTH) {
    return null;
  }

  const pageTitle = cleanDocumentTitle(spec.titlePattern);
  const isSiteName = !pageTitle || pageTitle.replace(/\W/g, "").toLowerCase() === spec.tag.replace(/\W/g, "").toLowerCase();
  const title = (isSiteName ? "" : pageTitle) ||
    cleanBlockText(document.querySelector("main h1, article h1, h1")?.textContent || "") ||
    firstLine(body) ||
    spec.defaultTitle;

  return buildExtractResult({
    platform,
    tag: spec.tag,
    title,
    url: canonicalPageUrl(spec.keepParams || []),
    messages: [{ role: "Content", body }]
  });
}

/* ---------- Claude ---------- */

function getClaudeMessages() {
  const userNodes = dedupeNested(queryAll('[data-testid="user-message"]'));
  let assistantNodes = dedupeNested(queryAll(".font-claude-response, .font-claude-message"));

  if (!assistantNodes.length) {
    assistantNodes = dedupeNested(queryAll("[data-is-streaming]"))
      .filter((node) => !node.querySelector('[data-testid="user-message"]'));
  }

  return collectRoleMessages([
    { role: "User", nodes: userNodes },
    { role: "Claude", nodes: assistantNodes }
  ]);
}

function extractClaudeConversation() {
  const messages = getClaudeMessages();

  if (!messages.length) {
    return null;
  }

  const firstUser = messages.find((message) => message.role === "User");
  const title = cleanDocumentTitle(/\s*[-|–]\s*Claude\s*$/i) || firstLine(firstUser?.body) || "Claude Conversation";

  return buildExtractResult({
    platform: "claude",
    tag: "CLAUDE",
    title: /^claude$/i.test(title) ? (firstLine(firstUser?.body) || "Claude Conversation") : title,
    url: canonicalPageUrl(),
    messages
  });
}

/* ---------- Perplexity ---------- */

function getPerplexityAnswerNodes() {
  return dedupeNested(queryAll('[id^="markdown-content"], .prose'));
}

function getPerplexityMessages() {
  const answerNodes = getPerplexityAnswerNodes();

  if (/^\/page\//.test(location.pathname)) {
    return collectRoleMessages([{ role: "Section", nodes: answerNodes }]);
  }

  const questionNodes = dedupeNested(queryAll(
    'h1, [class*="group/query"], [data-testid="user-query"], [data-testid="query-text"], [data-testid="thread-title"]'
  )).filter((node) => !answerNodes.some((answer) => answer.contains(node) || node.contains(answer)) &&
    !node.closest("nav, aside, [role='navigation']"));

  return collectRoleMessages([
    { role: "Question", nodes: questionNodes, extract: (node) => cleanBlockText(node.innerText || node.textContent || "") },
    { role: "Answer", nodes: answerNodes }
  ]);
}

function getPerplexitySources() {
  const anchors = [
    ...getPerplexityAnswerNodes().flatMap((node) => queryAll("a[href]", node)),
    ...queryAll('[data-testid*="source"] a[href], [class*="citation"] a[href], a[class*="citation"][href]')
  ];
  const seen = new Set();
  const sources = [];

  for (const anchor of anchors) {
    let href = "";

    try {
      href = new URL(anchor.getAttribute("href"), location.href).href;
    } catch (_error) {
      continue;
    }

    if (!/^https?:/i.test(href) || /(^|\.)perplexity\.ai$/i.test(new URL(href).hostname) || seen.has(href)) {
      continue;
    }

    seen.add(href);
    sources.push(href);

    if (sources.length >= PERPLEXITY_SOURCE_LIMIT) {
      break;
    }
  }

  return sources;
}

function extractPerplexityThread() {
  const messages = getPerplexityMessages();

  if (!messages.length) {
    return null;
  }

  const sources = getPerplexitySources();
  const heading = cleanBlockText(document.querySelector("h1")?.textContent || "");
  const title = cleanDocumentTitle(/\s*[-|–]\s*Perplexity.*$/i) || heading ||
    firstLine(messages[0]?.body) || "Perplexity Thread";

  return buildExtractResult({
    platform: "perplexity",
    tag: "PERPLEXITY",
    title: /^perplexity/i.test(title) ? (heading || firstLine(messages[0]?.body) || "Perplexity Thread") : title,
    url: canonicalPageUrl(),
    messages,
    appendix: sources.length ? [{ role: "Sources", body: sources.map((href) => `- ${href}`).join("\n") }] : []
  });
}

/* ---------- Grok ---------- */

function hasAlignmentClass(node, depth = 4) {
  let current = node;

  for (let level = 0; current && level <= depth; level += 1) {
    if (current.classList && (current.classList.contains("items-end") ||
        current.classList.contains("justify-end") || current.classList.contains("flex-row-reverse"))) {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

function getGrokMessages() {
  const userTestNodes = dedupeNested(queryAll('[data-testid="user-message"]'));
  const assistantTestNodes = dedupeNested(queryAll('[data-testid="assistant-message"]'));

  if (userTestNodes.length || assistantTestNodes.length) {
    return collectRoleMessages([
      { role: "User", nodes: userTestNodes },
      { role: "Grok", nodes: assistantTestNodes }
    ]);
  }

  const bodyOf = (container) => nodeToMarkdown(
    container.querySelector(".response-content-markdown") || container.querySelector(".message-bubble") || container
  );
  const responseContainers = dedupeNested(queryAll('[id^="response-"]'));

  if (responseContainers.length) {
    return collectRoleMessages([
      { role: "User", nodes: responseContainers.filter((node) => hasAlignmentClass(node, 0)), extract: bodyOf },
      { role: "Grok", nodes: responseContainers.filter((node) => !hasAlignmentClass(node, 0)), extract: bodyOf }
    ]);
  }

  const bubbles = dedupeNested(queryAll(".message-bubble"));

  return collectRoleMessages([
    { role: "User", nodes: bubbles.filter((node) => hasAlignmentClass(node)) },
    { role: "Grok", nodes: bubbles.filter((node) => !hasAlignmentClass(node)) }
  ]);
}

function extractGrokConversation() {
  const messages = getGrokMessages();

  if (!messages.length) {
    return null;
  }

  const firstUser = messages.find((message) => message.role === "User");
  const title = cleanDocumentTitle(/\s*[-|–/]\s*(Grok|X)\s*$/i);

  return buildExtractResult({
    platform: "grok",
    tag: "GROK",
    title: title && !/^(grok|x)$/i.test(title) ? title : (firstLine(firstUser?.body) || "Grok Conversation"),
    url: canonicalPageUrl(["conversation"]),
    messages
  });
}

/* ---------- Kimi ---------- */

function getKimiMessages() {
  const items = dedupeNested(queryAll(
    ".chat-content-item-user, .chat-content-item-assistant, .segment-user, .segment-assistant, [data-role='user'], [data-role='assistant']"
  ));
  const isUser = (node) => /(^|[\s-])user(\s|$)/i.test(node.className || "") || node.getAttribute("data-role") === "user";
  const bodyOf = (node) => nodeToMarkdown(
    node.querySelector(".user-content, .markdown-container, .markdown, .segment-content-box") || node
  );

  return collectRoleMessages([
    { role: "User", nodes: items.filter(isUser), extract: bodyOf },
    { role: "Kimi", nodes: items.filter((node) => !isUser(node)), extract: bodyOf }
  ]);
}

function extractKimiConversation() {
  const messages = getKimiMessages();

  if (!messages.length) {
    return null;
  }

  const firstUser = messages.find((message) => message.role === "User");
  const title = cleanDocumentTitle(/\s*[-|–]\s*Kimi.*$/i);

  return buildExtractResult({
    platform: "kimi",
    tag: "KIMI",
    title: title && !/^kimi/i.test(title) ? title : (firstLine(firstUser?.body) || "Kimi Conversation"),
    url: canonicalPageUrl(),
    messages
  });
}

/* ---------- Reddit ---------- */

function redditSubredditFromPath() {
  const match = location.pathname.match(/\/r\/([^/]+)/i);

  return match ? `r/${match[1]}` : "";
}

function extractNewRedditPost() {
  const post = document.querySelector("shreddit-post");

  if (!post) {
    return null;
  }

  const title = cleanBlockText(post.getAttribute("post-title") ||
    post.querySelector('[slot="title"]')?.textContent || document.querySelector("h1")?.textContent || "");
  const author = cleanBlockText(post.getAttribute("author") || "");
  const subreddit = cleanBlockText(post.getAttribute("subreddit-prefixed-name") || redditSubredditFromPath());
  const bodyNode = post.querySelector('[slot="text-body"]') || document.querySelector('shreddit-post [slot="text-body"], [slot="text-body"]');
  const link = post.getAttribute("content-href") || "";
  const comments = queryAll("shreddit-comment")
    .filter((node) => {
      const depth = node.getAttribute("depth");
      return depth !== null ? depth === "0" : !node.parentElement?.closest("shreddit-comment");
    })
    .map((node) => {
      const bodySlot = node.querySelector(':scope > [slot="comment"]') ||
        queryAll('[slot="comment"]', node).find((slot) => slot.closest("shreddit-comment") === node);
      return { author: cleanBlockText(node.getAttribute("author") || ""), body: nodeToMarkdown(bodySlot) };
    });

  return { title, author, subreddit, body: nodeToMarkdown(bodyNode), link, comments };
}

function extractOldRedditPost() {
  const post = document.querySelector("#siteTable .thing.link") || document.querySelector(".thing.link");

  if (!post) {
    return null;
  }

  const comments = queryAll(".commentarea > .sitetable > .thing.comment").map((node) => ({
    author: cleanBlockText(node.getAttribute("data-author") || node.querySelector(":scope > .entry .author")?.textContent || ""),
    body: nodeToMarkdown(node.querySelector(":scope > .entry .usertext-body .md"))
  }));
  const subreddit = post.getAttribute("data-subreddit");

  return {
    title: cleanBlockText(post.querySelector("a.title")?.textContent || ""),
    author: cleanBlockText(post.getAttribute("data-author") || post.querySelector(".author")?.textContent || ""),
    subreddit: subreddit ? `r/${subreddit}` : redditSubredditFromPath(),
    body: nodeToMarkdown(post.querySelector(".expando .usertext-body .md, .usertext-body .md")),
    link: post.getAttribute("data-url") || "",
    comments
  };
}

function getRedditPostData() {
  const data = extractNewRedditPost() || extractOldRedditPost();

  if (!data || (!data.title && !data.body)) {
    return null;
  }

  data.comments = data.comments.filter((comment) => comment.body);

  return data;
}

function extractRedditThread() {
  const data = getRedditPostData();

  if (!data) {
    return null;
  }

  const isExternalLink = data.link && !/reddit\.com\/r\/[^/]+\/comments\//i.test(data.link) && /^https?:/i.test(data.link);
  const postBody = [isExternalLink ? `Link: ${data.link}` : "", data.body].filter(Boolean).join("\n\n") || "(No text body)";
  const messages = [{
    role: `Post by ${data.author ? `u/${data.author}` : "unknown"}${data.subreddit ? ` in ${data.subreddit}` : ""}`,
    body: postBody
  }];
  const comments = data.comments.slice(0, REDDIT_COMMENT_LIMIT);

  for (const comment of comments) {
    messages.push({ role: `Comment by ${comment.author ? `u/${comment.author}` : "unknown"}`, body: comment.body });
  }

  const url = new URL(canonicalPageUrl());
  url.hostname = "www.reddit.com";

  return buildExtractResult({
    platform: "reddit",
    tag: "REDDIT",
    title: data.title || cleanDocumentTitle(/\s*:\s*r?\/?[\w]+\s*$/i) || "Reddit Thread",
    url: url.href,
    messages,
    appendix: data.comments.length > comments.length
      ? [{ role: "Note", body: `Showing the first ${comments.length} of ${data.comments.length} loaded top-level comments.` }]
      : []
  });
}

/* ---------- LinkedIn ---------- */

const LINKEDIN_POST_SELECTOR = [
  "[data-urn*='activity']", "[data-urn*='ugcPost']", "[data-id*='activity']", ".feed-shared-update-v2",
  "[data-test-id='main-feed-activity-card']", "[data-activity-urn]"
].join(", ");

const LINKEDIN_TEXT_SELECTOR = [
  ".feed-shared-inline-show-more-text", ".update-components-text", ".feed-shared-update-v2__description",
  ".feed-shared-text", ".attributed-text-segment-list__content", "[data-test-id='main-feed-activity-card__commentary']"
].join(", ");

const LINKEDIN_AUTHOR_SELECTOR = [
  ".update-components-actor__title", ".update-components-actor__name", ".feed-shared-actor__name",
  ".update-components-actor__single-line-truncate", "[data-tracking-control-name*='actor-name']",
  "[data-test-id='main-feed-activity-card__entity-lockup'] a"
].join(", ");

function linkedInVisibleName(node) {
  if (!node) {
    return "";
  }

  const visible = node.querySelector('span[aria-hidden="true"]');

  return firstLine(visible?.textContent || node.innerText || node.textContent || "", 80);
}

function findLinkedInPostRoot() {
  const path = decodeURIComponent(location.pathname);
  const activityId = path.match(/urn:li:(?:activity|ugcPost|share):(\d+)/i)?.[1] || path.match(/activity-(\d+)/i)?.[1] || "";
  const candidates = queryAll(LINKEDIN_POST_SELECTOR);

  if (activityId) {
    const match = candidates.find((node) => [
      node.getAttribute("data-urn"), node.getAttribute("data-id"), node.getAttribute("data-activity-urn")
    ].some((value) => String(value || "").includes(activityId)));

    if (match) {
      return match;
    }
  }

  const main = document.querySelector("main");
  const inMain = main ? candidates.filter((node) => main.contains(node)) : candidates;

  return dedupeNested(inMain.length ? inMain : candidates)[0] || null;
}

function getLinkedInArticleData() {
  const bodyNode = document.querySelector(
    ".reader-article-content, [data-test-id='article-content-blocks'], .article-main__content, article .show-more-less-html__markup"
  );

  if (!bodyNode) {
    return null;
  }

  const title = cleanBlockText(document.querySelector(
    ".reader-article-header__title, h1.pulse-title, [data-test-id='article-title'], article h1, h1"
  )?.textContent || "");
  const author = linkedInVisibleName(document.querySelector(
    ".reader-author-info__author-name, .reader-author-info__container h2, [data-tracking-control-name*='author'], .base-main-card__title"
  ));
  const body = nodeToMarkdown(bodyNode, { keepAriaHidden: true });

  return body ? { kind: "article", title, author, body } : null;
}

function getLinkedInPostData() {
  const root = findLinkedInPostRoot();

  if (!root) {
    return null;
  }

  const body = dedupeNested(queryAll(LINKEDIN_TEXT_SELECTOR, root))
    .map((node) => nodeToMarkdown(node, { keepAriaHidden: true }))
    .filter(Boolean)
    .filter((text, index, list) => list.indexOf(text) === index)
    .join("\n\n---\n\n");
  const author = linkedInVisibleName(root.querySelector(LINKEDIN_AUTHOR_SELECTOR));

  return body ? { kind: "post", author, body } : null;
}

function getLinkedInData() {
  if (/^\/pulse\//.test(location.pathname)) {
    return getLinkedInArticleData() || getLinkedInPostData();
  }

  return getLinkedInPostData() || getLinkedInArticleData();
}

function extractLinkedInContent() {
  const data = getLinkedInData();

  if (!data) {
    return null;
  }

  const author = data.author || "";
  const title = data.kind === "article"
    ? (data.title || cleanDocumentTitle(/\s*\|\s*LinkedIn\s*$/i) || "LinkedIn Article")
    : [author, firstLine(data.body, 80)].filter(Boolean).join(": ") || "LinkedIn Post";

  return buildExtractResult({
    platform: "linkedin",
    tag: "LINKEDIN",
    title,
    url: canonicalPageUrl(),
    messages: [{
      role: `${data.kind === "article" ? "Article" : "Post"}${author ? ` by ${author}` : ""}`,
      body: data.body
    }]
  });
}

/* ---------- Google Docs ---------- */

function getGoogleDocExportUrl() {
  const match = location.pathname.match(/^\/document\/(u\/\d+\/)?d\/([^/]+)/);

  if (!match || match[2] === "e") {
    return "";
  }

  return `https://docs.google.com/document/${match[1] || ""}d/${match[2]}/export?format=txt`;
}

function cleanExportedText(value) {
  return String(value || "")
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractGoogleDoc() {
  const exportUrl = getGoogleDocExportUrl();

  if (!exportUrl) {
    return null;
  }

  const title = cleanDocumentTitle(/\s*-\s*Google\s+Docs\s*$/i) || "Google Doc";
  const url = canonicalPageUrl().replace(/\/(edit|view|preview|mobilebasic)[^/]*$/i, "/edit");
  let text = "";

  try {
    const response = await fetch(exportUrl, { credentials: "include", redirect: "follow" });
    const contentType = response.headers.get("content-type") || "";

    if (response.ok && !/text\/html/i.test(contentType)) {
      text = cleanExportedText(await response.text());
    }
  } catch (_error) {
    text = "";
  }

  if (!text) {
    // Let the extension panel retry the export with extension privileges.
    return {
      platform: "googledocs",
      title: `[GOOGLE DOCS] ${title}`,
      url,
      fetchTextUrl: exportUrl,
      plainText: "",
      markdown: "",
      messages: [],
      messageCount: 1,
      exportedAt: new Date().toISOString()
    };
  }

  return buildExtractResult({
    platform: "googledocs",
    tag: "GOOGLE DOCS",
    title,
    url,
    messages: [{ role: "Document", body: text }]
  });
}

/* ---------- Platform registry ---------- */

const PLATFORM_SPECS = {
  chatgpt: {
    tag: "CHATGPT",
    defaultTitle: "ChatGPT Conversation",
    titlePattern: /\s*[-|]\s*ChatGPT.*$/i,
    emptyMessage: "No ChatGPT messages found on this page yet.",
    extract: extractChatGptConversation,
    hasSpecific: () => getChatGptMessages().length > 0
  },
  gemini: {
    tag: "GEMINI",
    defaultTitle: "Gemini Conversation",
    titlePattern: /\s*[-|]\s*(Google\s+)?Gemini.*$/i,
    emptyMessage: "No Gemini messages found on this page yet.",
    extract: extractGeminiConversation,
    hasSpecific: () => getGeminiMessages().length > 0
  },
  x: {
    tag: "X",
    defaultTitle: "X Post",
    titlePattern: /\s*\/\s*X\s*$/i,
    fallbackRoots: ["[data-testid='primaryColumn']"],
    emptyMessage: "No posts found on this X page yet.",
    extract: extractXContent,
    hasSpecific: () => Boolean(extractXArticleBody()) || getTweetArticles().some((tweet) => extractTweetText(tweet))
  },
  claude: {
    tag: "CLAUDE",
    defaultTitle: "Claude Conversation",
    titlePattern: /\s*[-|–]\s*Claude\s*$/i,
    emptyMessage: "No Claude messages found on this page yet.",
    extract: extractClaudeConversation,
    hasSpecific: () => getClaudeMessages().length > 0
  },
  perplexity: {
    tag: "PERPLEXITY",
    defaultTitle: "Perplexity Thread",
    titlePattern: /\s*[-|–]\s*Perplexity.*$/i,
    emptyMessage: "No Perplexity answer found on this page yet.",
    extract: extractPerplexityThread,
    hasSpecific: () => getPerplexityAnswerNodes().some((node) => cleanBlockText(node.innerText || "").length > 0)
  },
  grok: {
    tag: "GROK",
    defaultTitle: "Grok Conversation",
    titlePattern: /\s*[-|–/]\s*(Grok|X)\s*$/i,
    keepParams: ["conversation"],
    fallbackRoots: ["[data-testid='primaryColumn']"],
    emptyMessage: "No Grok messages found on this page yet.",
    extract: extractGrokConversation,
    hasSpecific: () => getGrokMessages().length > 0
  },
  kimi: {
    tag: "KIMI",
    defaultTitle: "Kimi Conversation",
    titlePattern: /\s*[-|–]\s*Kimi.*$/i,
    fallbackRoots: [".chat-content-list", ".chat-detail-main"],
    emptyMessage: "No Kimi messages found on this page yet.",
    extract: extractKimiConversation,
    hasSpecific: () => getKimiMessages().length > 0
  },
  reddit: {
    tag: "REDDIT",
    defaultTitle: "Reddit Thread",
    titlePattern: /\s*:\s*r?\/?[\w]+\s*$/i,
    fallbackRoots: [".content[role='main']"],
    emptyMessage: "No Reddit post found on this page yet.",
    extract: extractRedditThread,
    hasSpecific: () => Boolean(getRedditPostData())
  },
  linkedin: {
    tag: "LINKEDIN",
    defaultTitle: "LinkedIn Post",
    titlePattern: /\s*\|\s*LinkedIn\s*$/i,
    emptyMessage: "No LinkedIn post found on this page yet.",
    extract: extractLinkedInContent,
    hasSpecific: () => Boolean(getLinkedInData())
  },
  googledocs: {
    tag: "GOOGLE DOCS",
    defaultTitle: "Google Doc",
    titlePattern: /\s*-\s*Google\s+Docs\s*$/i,
    fallbackRoots: ["#contents", "#doc-content"],
    emptyMessage: "Could not read this Google Doc.",
    extract: extractGoogleDoc,
    hasSpecific: () => Boolean(getGoogleDocExportUrl())
  }
};

async function extractForPlatform(platform) {
  const spec = PLATFORM_SPECS[platform];

  if (!spec) {
    throw new Error("Unsupported platform.");
  }

  let result = null;

  try {
    result = await spec.extract();
  } catch (_error) {
    result = null;
  }

  if (result && (result.messageCount > 0 || result.fetchTextUrl)) {
    return result;
  }

  const fallback = extractGenericPage(platform);

  if (fallback) {
    return fallback;
  }

  throw new Error(spec.emptyMessage || "Nothing to import on this page yet.");
}

function pageHasContent(platform, options = {}) {
  const spec = PLATFORM_SPECS[platform];

  if (!spec) {
    return false;
  }

  try {
    if (spec.hasSpecific()) {
      return true;
    }

    return options.specificOnly ? false : genericPageHasContent(platform);
  } catch (_error) {
    return false;
  }
}

window.NotebookToolsExtractors = {
  extractForPlatform,
  pageHasContent,
  supportedPlatforms: Object.keys(PLATFORM_SPECS)
};
