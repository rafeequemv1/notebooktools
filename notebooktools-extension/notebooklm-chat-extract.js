function cleanNotebookLmText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function buildNotebookLmMarkdown(title, messages, sourceUrl) {
  const lines = [`# ${title}`, "", `Source: ${sourceUrl}`, ""];

  for (const message of messages) {
    lines.push(`## ${message.role}`, "", message.body, "");
  }

  return lines.join("\n").trim();
}

function getNotebookLmTitle() {
  const candidates = [
    document.querySelector("h1"),
    document.querySelector("[data-test-id='notebook-title']"),
    document.querySelector(".notebook-title"),
    document.querySelector("header h1")
  ];

  for (const node of candidates) {
    const value = cleanNotebookLmText(node?.textContent || "");

    if (value) {
      return value;
    }
  }

  return cleanNotebookLmText(document.title.replace(/\s*-\s*NotebookLM.*$/i, "")) || "NotebookLM Chat";
}

function getNotebookLmUrl() {
  const match = location.pathname.match(/\/notebook\/([^/?#]+)/i);
  return match?.[1]
    ? `https://notebooklm.google.com/notebook/${encodeURIComponent(match[1])}`
    : location.href.split("?")[0];
}

function isNotebookLmNotebookPage() {
  return /\/notebook\/[^/?#]+/i.test(location.pathname);
}

function extractMessageBody(node) {
  const clone = node.cloneNode(true);

  clone.querySelectorAll("button, [aria-label], .mat-mdc-button, .action-row").forEach((el) => {
    el.remove();
  });

  return cleanNotebookLmText(clone.innerText || clone.textContent || "");
}

function extractNotebookLmMessages() {
  const messages = [];
  const bubbles = document.querySelectorAll(".from-user-container, .to-user-container");

  for (const bubble of bubbles) {
    const body = extractMessageBody(bubble);

    if (!body) {
      continue;
    }

    messages.push({
      role: bubble.classList.contains("from-user-container") ? "You" : "NotebookLM",
      body
    });
  }

  if (messages.length) {
    return messages;
  }

  const chatRoot =
    document.querySelector("chat-panel .chat-panel-content") ||
    document.querySelector("[role='log']") ||
    document.querySelector("chat-panel");

  if (!chatRoot) {
    return messages;
  }

  const blocks = chatRoot.querySelectorAll(
    ".from-user-container, .to-user-container, [data-testid*='message'], [role='article']"
  );

  for (const block of blocks) {
    const body = extractMessageBody(block);

    if (!body) {
      continue;
    }

    const roleHint = `${block.className} ${block.getAttribute("aria-label") || ""}`.toLowerCase();
    const role = roleHint.includes("user") || block.classList.contains("from-user-container")
      ? "You"
      : "NotebookLM";

    messages.push({ role, body });
  }

  return messages;
}

function extractNotebookLmChat() {
  const messages = extractNotebookLmMessages();

  if (!messages.length) {
    throw new Error("No chat messages found yet. Ask NotebookLM something first.");
  }

  const title = getNotebookLmTitle();
  const url = getNotebookLmUrl();
  const plainText = messages.map((message) => `${message.role}\n\n${message.body}`).join("\n\n---\n\n");

  return {
    platform: "notebooklm",
    title,
    url,
    plainText,
    markdown: buildNotebookLmMarkdown(title, messages, url),
    messages,
    messageCount: messages.length,
    exportedAt: new Date().toISOString()
  };
}

window.NotebookToolsNotebookLmChatExtract = {
  extractNotebookLmChat,
  extractNotebookLmMessages,
  isNotebookLmNotebookPage
};
