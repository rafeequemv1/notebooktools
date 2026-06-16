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
    messageCount: messages.length
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
    messageCount: messages.length
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
    messageCount: messages.length
  };
}

function extractForPlatform(platform) {
  switch (platform) {
    case "chatgpt":
      return extractChatGptConversation();
    case "gemini":
      return extractGeminiConversation();
    case "x":
      return extractXContent();
    default:
      throw new Error("Unsupported platform.");
  }
}

function pageHasContent(platform) {
  try {
    switch (platform) {
      case "chatgpt":
        return getChatGptMessages().length > 0;
      case "gemini":
        return getGeminiMessages().length > 0;
      case "x":
        return Boolean(extractXArticleBody()) || getTweetArticles().some((tweet) => extractTweetText(tweet));
      default:
        return false;
    }
  } catch (_error) {
    return false;
  }
}

window.NotebookToolsExtractors = {
  extractForPlatform,
  pageHasContent
};
