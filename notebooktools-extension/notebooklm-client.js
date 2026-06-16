const NOTEBOOKLM_HOME_URL = "https://notebooklm.google.com/";
const NOTEBOOKLM_BATCH_EXECUTE_URL =
  "https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute";

const NOTEBOOKLM_RPC_IDS = {
  listNotebooks: "wXbhsf",
  createNotebook: "CCqFvf",
  addSources: "izAoDd"
};

const NOTEBOOKLM_TOKEN_CACHE_TTL_MS = 2 * 60 * 1000;
const notebookLmTokenCache = new Map();

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeNotebookLmAuthUser(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? String(parsed) : null;
}

function extractNotebookLmBootstrapValue(key, html) {
  const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
  const match = pattern.exec(String(html || ""));

  if (!match) {
    return "";
  }

  try {
    return JSON.parse(`"${match[1]}"`);
  } catch (_error) {
    return match[1];
  }
}

function extractUuid(value) {
  const match = String(value || "").match(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i
  );

  return match ? match[0] : "";
}

function findUuidDeep(value) {
  const direct = typeof value === "string" ? extractUuid(value) : "";

  if (direct) {
    return direct;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUuidDeep(item);

      if (found) {
        return found;
      }
    }
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const found = findUuidDeep(item);

      if (found) {
        return found;
      }
    }
  }

  return "";
}

function extractNotebookLmAuthUserFromUrl(url) {
  try {
    return normalizeNotebookLmAuthUser(new URL(String(url || "")).searchParams.get("authuser"));
  } catch (_error) {
    return null;
  }
}

async function detectNotebookLmAuthUser() {
  if (!chrome?.tabs?.query) {
    return null;
  }

  const tabs = await chrome.tabs.query({ url: "https://notebooklm.google.com/*" });
  const notebookTabs = tabs.filter((tab) => /^https:\/\/notebooklm\.google\.com\//i.test(tab.url || ""));
  const activeTab = notebookTabs.find((tab) => tab.active) || null;
  const activeAuthUser = extractNotebookLmAuthUserFromUrl(activeTab?.url || "");

  if (activeAuthUser !== null) {
    return activeAuthUser;
  }

  for (const tab of notebookTabs) {
    const authUser = extractNotebookLmAuthUserFromUrl(tab.url || "");

    if (authUser !== null) {
      return authUser;
    }
  }

  return null;
}

function parseBatchExecuteResponse(rawText) {
  const rows = [];

  for (const line of String(rawText || "").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("[[")) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmed);

      for (const item of parsed) {
        if (item?.[0] !== "wrb.fr") {
          continue;
        }

        rows.push({
          rpcId: item[1],
          data: item[2] ? JSON.parse(item[2]) : null
        });
      }
    } catch (_error) {
      // NotebookLM responses can include non-JSON framing lines. Ignore them.
    }
  }

  return rows;
}

async function getNotebookLmTokens(options = {}) {
  const authUser = normalizeNotebookLmAuthUser(options.authUser) ?? await detectNotebookLmAuthUser();
  const cacheKey = authUser || "default";
  const cached = notebookLmTokenCache.get(cacheKey);

  if (
    !options.forceRefresh &&
    cached &&
    Date.now() - cached.cachedAt < NOTEBOOKLM_TOKEN_CACHE_TTL_MS
  ) {
    return { ...cached, authUser };
  }

  const url = new URL(NOTEBOOKLM_HOME_URL);

  if (authUser !== null) {
    url.searchParams.set("authuser", authUser);
    url.searchParams.set("pageId", "none");
  }

  const response = await fetch(url.toString(), {
    credentials: "include",
    redirect: "error"
  });

  if (!response.ok) {
    throw new Error("Open NotebookLM and sign in before importing.");
  }

  const html = await response.text();
  const atToken = extractNotebookLmBootstrapValue("SNlM0e", html);
  const blToken = extractNotebookLmBootstrapValue("cfb2h", html);

  if (!atToken || !blToken) {
    throw new Error("Could not read NotebookLM session tokens. Refresh NotebookLM once, then try again.");
  }

  const tokens = {
    atToken,
    blToken,
    cachedAt: Date.now()
  };

  notebookLmTokenCache.set(cacheKey, tokens);
  return { ...tokens, authUser };
}

async function callNotebookLmRpc(rpcId, args, tokens, options = {}) {
  const endpoint = new URL(NOTEBOOKLM_BATCH_EXECUTE_URL);
  const sourcePath = options.sourcePath || "/";
  const authUser = normalizeNotebookLmAuthUser(options.authUser ?? tokens.authUser);
  const requestId = String(Math.floor(Math.random() * 900000) + 100000);
  const requestPayload = JSON.stringify([[[rpcId, JSON.stringify(args), null, "generic"]]]);

  endpoint.searchParams.set("rpcids", rpcId);
  endpoint.searchParams.set("source-path", sourcePath);
  endpoint.searchParams.set("bl", tokens.blToken);
  endpoint.searchParams.set("_reqid", requestId);
  endpoint.searchParams.set("rt", "c");

  if (authUser !== null) {
    endpoint.searchParams.set("authuser", authUser);
  }

  const body = new URLSearchParams({
    "f.req": requestPayload,
    at: tokens.atToken
  });

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "X-Same-Domain": "1"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`NotebookLM request failed (${response.status}).`);
  }

  const rawText = await response.text();

  if (/source limit|SOURCE_LIMIT_REACHED/i.test(rawText)) {
    throw new Error("This notebook appears to be at the NotebookLM source limit.");
  }

  return {
    rawText,
    rows: parseBatchExecuteResponse(rawText)
  };
}

function mapNotebookRecord(record) {
  if (!Array.isArray(record)) {
    return null;
  }

  const id = typeof record[2] === "string" && extractUuid(record[2])
    ? record[2]
    : findUuidDeep(record);
  const title = cleanText(record[0]) || "Untitled notebook";
  const emoji = cleanText(record[3]);

  return id ? { id, title: emoji ? `${emoji} ${title}` : title } : null;
}

async function listNotebookLmNotebooks(options = {}) {
  const tokens = await getNotebookLmTokens(options);
  const response = await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.listNotebooks,
    [null, 500],
    tokens
  );
  const notebooks = Array.isArray(response.rows?.[0]?.data?.[0])
    ? response.rows[0].data[0]
    : [];

  return notebooks.map(mapNotebookRecord).filter(Boolean);
}

async function createNotebookLmNotebook(title, options = {}) {
  const tokens = await getNotebookLmTokens(options);
  const safeTitle = String(title || "").trim() || "NotebookTools YouTube";
  const response = await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.createNotebook,
    [safeTitle],
    tokens
  );
  const notebookId = findUuidDeep(response.rows?.[0]?.data) || extractUuid(response.rawText);

  if (!notebookId) {
    throw new Error("NotebookLM did not return the new notebook ID.");
  }

  return {
    id: notebookId,
    title: safeTitle
  };
}

async function addYoutubeToNotebookLm(notebookId, youtubeUrl, options = {}) {
  const tokens = await getNotebookLmTokens(options);
  const targetNotebookId = String(notebookId || "").trim();
  const url = String(youtubeUrl || "").trim();

  if (!targetNotebookId) {
    throw new Error("Choose a NotebookLM notebook first.");
  }

  if (!url) {
    throw new Error("Choose a YouTube video first.");
  }

  const payload = [
    [[null, null, null, null, null, null, null, [url], null, null, 1]],
    targetNotebookId,
    [2],
    [1, null, null, null, null, null, null, null, null, null, [1]]
  ];

  await callNotebookLmRpc(NOTEBOOKLM_RPC_IDS.addSources, payload, tokens, {
    sourcePath: `/notebook/${targetNotebookId}`
  });

  return true;
}

window.NotebookToolsNotebookLM = {
  addYoutubeToNotebookLm,
  createNotebookLmNotebook,
  listNotebookLmNotebooks
};
