const NOTEBOOKLM_HOME_URL = "https://notebooklm.google.com/";
const NOTEBOOKLM_BATCH_EXECUTE_URL =
  "https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute";

const NOTEBOOKLM_RPC_IDS = {
  listNotebooks: "wXbhsf",
  createNotebook: "CCqFvf",
  createNotebookDiscovery: "AzXHBd",
  getUserSettings: "ZwVcOc",
  deleteNotebook: "WWINqb",
  renameNotebook: "s0tc2d",
  addSources: "izAoDd",
  getNotebook: "rLM1Ne",
  deleteSource: "tGMBJ",
  updateSource: "b7Wfje",
  getSource: "hizoJc",
  checkSourceFreshness: "yR9Yof",
  refreshSource: "FLmJqe",
  listLabels: "I3xc3c",
  updateLabel: "le8sX",
  createLabel: "agX4Bc",
  createArtifact: "R7cb6c",
  listArtifacts: "gArtLc",
  deleteArtifact: "V5N4be",
  renameArtifact: "rc3d8d",
  getNotes: "cFji9",
  getInteractiveHtml: "v9rmvd",
  addSourceFile: "o4cbdc"
};

const NOTEBOOKLM_UPLOAD_URL = "https://notebooklm.google.com/upload/_/";
const NOTEBOOKLM_RPC_TEMPLATE_BLOCK = [
  2,
  null,
  null,
  [1, null, null, null, null, null, null, null, null, null, [1]]
];

const NOTEBOOKLM_LABEL_OPTS = [2, null, null, [1, null, null, null, null, null, null, null, null, null, [1]]];

const LIST_NOTEBOOKS_PARAMS_RECENT = [null, 500];
const LIST_NOTEBOOKS_PARAMS = [null, 1, null, [2]];
const LIST_NOTEBOOKS_PARAMS_EXTENDED = [
  null,
  1,
  null,
  NOTEBOOKLM_LABEL_OPTS,
  null,
  [[null, null, []], [[]], [null, []]]
];

const SOURCE_TYPE_LABELS = {
  1: "Doc",
  2: "Slides",
  3: "PDF",
  4: "Text",
  5: "Web",
  8: "Markdown",
  9: "YouTube",
  10: "Media",
  11: "Word",
  13: "Image",
  14: "Sheets",
  16: "CSV",
  17: "EPUB"
};

const NOTEBOOK_SOURCE_LIMIT = 50;

const REFRESHABLE_SOURCE_TYPE_CODES = new Set([1, 2, 3, 5, 9, 14]);

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

function extractDiscoveryEngineParent(html) {
  const text = String(html || "");
  const match = text.match(/projects\/(\d+)\/locations\/([a-z0-9_-]+)/i);

  if (match) {
    return `projects/${match[1]}/locations/${match[2]}`;
  }

  return "";
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
  if (chrome?.storage?.local) {
    const stored = await chrome.storage.local.get("notebooktoolsAuthUser");

    if (stored.notebooktoolsAuthUser !== undefined && stored.notebooktoolsAuthUser !== null) {
      return normalizeNotebookLmAuthUser(stored.notebooktoolsAuthUser);
    }
  }

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
          data: item[2] ? JSON.parse(item[2]) : null,
          statusCode: Array.isArray(item[5]) ? Number(item[5][0]) || 0 : 0
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
  const sessionId = extractNotebookLmBootstrapValue("FdrFJe", html);
  const discoveryParent = extractDiscoveryEngineParent(html);

  if (!atToken || !blToken) {
    throw new Error("Could not read NotebookLM session tokens. Refresh NotebookLM once, then try again.");
  }

  const tokens = {
    atToken,
    blToken,
    sessionId,
    discoveryParent,
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
  endpoint.searchParams.set("hl", "en");

  if (tokens.sessionId) {
    endpoint.searchParams.set("f.sid", tokens.sessionId);
  }

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
      Origin: "https://notebooklm.google.com",
      Referer: "https://notebooklm.google.com/",
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

function extractSourceCountFromNotebookRecord(record) {
  if (!Array.isArray(record) || record.length < 2) {
    return null;
  }

  const sourcesData = record[1];

  if (!Array.isArray(sourcesData)) {
    return 0;
  }

  let count = 0;

  for (const source of sourcesData) {
    if (Array.isArray(source) && source.length >= 2) {
      count += 1;
    }
  }

  return count;
}

function unwrapNotebookRecord(data) {
  if (!Array.isArray(data)) {
    return null;
  }

  if (Array.isArray(data[0]) && (typeof data[0][0] === "string" || Array.isArray(data[0][1]))) {
    return data[0];
  }

  if (typeof data[0] === "string" || Array.isArray(data[1])) {
    return data;
  }

  return null;
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
  const sourceCount = extractSourceCountFromNotebookRecord(record);

  return id
    ? {
        id,
        title: emoji ? `${emoji} ${title}` : title,
        sourceCount: typeof sourceCount === "number" ? sourceCount : null
      }
    : null;
}

function looksLikeNotebookRecord(record) {
  if (!Array.isArray(record)) {
    return false;
  }

  return Boolean(findUuidDeep(record)) || typeof record[0] === "string";
}

function extractNotebookListFromRpcData(data) {
  if (!data) {
    return [];
  }

  if (Array.isArray(data[0])) {
    const inner = data[0];

    if (!inner.length || looksLikeNotebookRecord(inner[0])) {
      return inner;
    }
  }

  if (Array.isArray(data) && data.length && looksLikeNotebookRecord(data[0])) {
    return data;
  }

  return [];
}

function getRpcRow(rows, rpcId) {
  if (!Array.isArray(rows) || !rows.length) {
    return null;
  }

  return rows.find((row) => row.rpcId === rpcId) || rows[0];
}

function buildRpcError(code, rpcId, context = {}) {
  const operation = context.operation || "";

  if (code === 8) {
    return new Error("NotebookLM daily limit reached. Try again tomorrow.");
  }

  if (code === 3 && operation === "create") {
    return new Error("NotebookLM_CREATE_REJECTED");
  }

  if (code === 7 && operation === "create") {
    return new Error("NotebookLM_CREATE_DENIED");
  }

  if (code === 3) {
    return new Error(
      "NotebookLM rejected the request. Refresh notebooklm.google.com and try again."
    );
  }

  if (code === 7 || code === 16) {
    return new Error("NotebookLM session expired. Open notebooklm.google.com, sign in, then retry.");
  }

  return new Error(`NotebookLM returned error code ${code} for ${rpcId || "RPC"}.`);
}

function buildAddSourcesRpcPayload(sourceSpecs, notebookId) {
  return [sourceSpecs, String(notebookId || "").trim(), NOTEBOOKLM_RPC_TEMPLATE_BLOCK];
}

function buildCreateNotebookAttempts(title, discoveryParent) {
  const safeTitle = String(title || "").trim() || "NotebookTools";
  const attempts = [
    {
      rpcId: NOTEBOOKLM_RPC_IDS.createNotebook,
      payload: [safeTitle, null, null, NOTEBOOKLM_RPC_TEMPLATE_BLOCK]
    }
  ];

  if (discoveryParent) {
    attempts.push({
      rpcId: NOTEBOOKLM_RPC_IDS.createNotebookDiscovery,
      payload: [
        discoveryParent,
        [safeTitle, null, null, null, null, [null, null, null, null, null, null, 1]]
      ]
    });
  }

  return attempts;
}

function extractCreatedNotebookId(response, rpcId = NOTEBOOKLM_RPC_IDS.createNotebook) {
  const row = getRpcRow(response?.rows, rpcId);
  const data = row?.data;

  if (typeof data === "string") {
    const direct = extractUuid(data);

    if (direct) {
      return direct;
    }
  }

  if (typeof data?.[2] === "string") {
    const direct = extractUuid(data[2]);

    if (direct) {
      return direct;
    }
  }

  if (Array.isArray(data?.[1]) && typeof data[1][2] === "string") {
    const nested = extractUuid(data[1][2]);

    if (nested) {
      return nested;
    }
  }

  if (Array.isArray(data?.[0])) {
    const mapped = mapNotebookRecord(data[0]);

    if (mapped?.id) {
      return mapped.id;
    }
  }

  const mapped = mapNotebookRecord(data);

  if (mapped?.id) {
    return mapped.id;
  }

  return findUuidDeep(data) || extractUuid(response?.rawText);
}

async function getNotebookLmAccountLimits(tokens, options = {}) {
  const response = await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.getUserSettings,
    [null, [1, null, null, null, null, null, null, null, null, null, [1]]],
    tokens,
    options
  );
  const row = getRpcRow(response.rows, NOTEBOOKLM_RPC_IDS.getUserSettings);
  const limits = row?.data?.[0]?.[1];

  if (!Array.isArray(limits)) {
    return { notebookLimit: null, sourceLimit: null };
  }

  const notebookLimit = Number(limits[1]) > 0 ? Number(limits[1]) : null;
  const sourceLimit = Number(limits[2]) > 0 ? Number(limits[2]) : null;

  return { notebookLimit, sourceLimit };
}

async function buildCreateNotebookFailureError(lastError, listOptions, tokens) {
  if (
    lastError?.message === "NotebookLM_CREATE_REJECTED" ||
    lastError?.message === "NotebookLM_CREATE_DENIED"
  ) {
    try {
      const notebooks = await listNotebookLmNotebooks({ ...listOptions, forceRefresh: true });
      const limits = await getNotebookLmAccountLimits(tokens, listOptions);
      const notebookLimit = limits.notebookLimit || 100;

      if (notebooks.length >= Math.max(notebookLimit - 1, 0)) {
        return new Error(
          `NotebookLM notebook limit reached (${notebooks.length}/${notebookLimit}). Delete old notebooks at notebooklm.google.com, then try again.`
        );
      }
    } catch (_error) {
      // Fall through to the generic message below.
    }

    return new Error(
      "NotebookLM rejected the create request. Open notebooklm.google.com, sign in, refresh the page, then try again."
    );
  }

  return (
    lastError ||
    new Error(
      "NotebookLM did not return the new notebook ID. Open notebooklm.google.com, sign in, then try again."
    )
  );
}

async function findCreatedNotebookId(title, options = {}) {
  const safeTitle = cleanText(title);
  const notebooks = await listNotebookLmNotebooks(options);
  const matches = notebooks.filter((notebook) => {
    const notebookTitle = cleanText(notebook.title);

    return (
      notebookTitle === safeTitle ||
      notebookTitle.endsWith(safeTitle) ||
      notebookTitle.includes(safeTitle)
    );
  });

  if (matches.length === 1) {
    return matches[0].id;
  }

  if (matches.length > 1) {
    return matches[0].id;
  }

  return "";
}

function parseNotebookListResponse(response, rpcId = NOTEBOOKLM_RPC_IDS.listNotebooks) {
  const row = getRpcRow(response?.rows, rpcId);
  return extractNotebookListFromRpcData(row?.data);
}

async function listNotebookLmNotebooks(options = {}) {
  const tokens = await getNotebookLmTokens(options);
  const listParamsVariants = [
    LIST_NOTEBOOKS_PARAMS_RECENT,
    LIST_NOTEBOOKS_PARAMS_EXTENDED,
    LIST_NOTEBOOKS_PARAMS
  ];
  let notebooks = [];

  for (const params of listParamsVariants) {
    const response = await callNotebookLmRpc(
      NOTEBOOKLM_RPC_IDS.listNotebooks,
      params,
      tokens
    );
    const parsed = parseNotebookListResponse(response).map(mapNotebookRecord).filter(Boolean);

    if (parsed.length > notebooks.length) {
      notebooks = parsed;
    }

    if (notebooks.length >= 500) {
      break;
    }
  }

  return notebooks;
}

async function findNewNotebookByDiff(beforeIds, options = {}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) {
      await sleepMs(600 + attempt * 400);
    }

    const notebooks = await listNotebookLmNotebooks({
      ...options,
      forceRefresh: true
    });
    const created = notebooks.filter((notebook) => !beforeIds.has(notebook.id));

    if (created.length === 1) {
      return created[0];
    }

    if (created.length > 1) {
      return created[0];
    }
  }

  return null;
}

function extractAllText(value) {
  const parts = [];

  if (typeof value === "string" && value.trim()) {
    parts.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      parts.push(...extractAllText(item));
    }
  }

  return parts;
}

function parseProtoTimestamp(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const seconds = Number(value[0]) || 0;
  const nanos = Number(value[1]) || 0;

  if (!seconds && !nanos) {
    return null;
  }

  return new Date(seconds * 1000 + nanos / 1e6).toISOString();
}

function extractYoutubeVideoIdFromUrl(url) {
  if (typeof NotebookToolsStore !== "undefined" && NotebookToolsStore.normalizeYouTubeVideoUrl) {
    const normalized = NotebookToolsStore.normalizeYouTubeVideoUrl(url);

    if (normalized) {
      try {
        return new URL(normalized).searchParams.get("v") || "";
      } catch (_error) {
        return "";
      }
    }
  }

  return "";
}

function mapSourceRecord(src) {
  if (!Array.isArray(src) || src.length < 2) {
    return null;
  }

  const srcIds = src[0];
  let srcId = "";

  if (Array.isArray(srcIds) && srcIds[0]) {
    srcId = String(srcIds[0]);
  } else if (typeof srcIds === "string") {
    srcId = srcIds;
  } else {
    srcId = findUuidDeep(src);
  }

  if (!srcId) {
    return null;
  }

  const title = cleanText(src[1]) || "Untitled source";
  let typeCode = null;
  let url = "";
  let createdAt = null;
  let youtubeVideoId = "";

  if (Array.isArray(src[2])) {
    const metadata = src[2];
    typeCode = metadata[4];

    if (typeCode === 9 && Array.isArray(metadata[5])) {
      if (metadata[5][0]) {
        url = String(metadata[5][0]);
      }

      if (metadata[5][1]) {
        youtubeVideoId = String(metadata[5][1]);
      }
    } else if (typeCode === 5 && Array.isArray(metadata[7]) && metadata[7][0]) {
      url = String(metadata[7][0]);
    } else if ([1, 2, 3, 14].includes(typeCode) && Array.isArray(metadata[9]) && metadata[9][0]) {
      url = `https://drive.google.com/file/d/${metadata[9][0]}/view`;
    }

    if (Array.isArray(metadata[3])) {
      createdAt =
        parseProtoTimestamp(metadata[3][1]) || parseProtoTimestamp(metadata[3][0]);
    }
  }

  if (!youtubeVideoId && url) {
    youtubeVideoId = extractYoutubeVideoIdFromUrl(url);
  }

  return {
    id: srcId,
    title,
    typeCode,
    type: SOURCE_TYPE_LABELS[typeCode] || "Other",
    url,
    createdAt,
    youtubeVideoId: youtubeVideoId || null
  };
}

function mapLabelRecord(label) {
  if (!Array.isArray(label) || label.length < 3) {
    return null;
  }

  const sourceIds = Array.isArray(label[1])
    ? label[1]
        .map((entry) => (Array.isArray(entry) ? entry[0] : entry))
        .filter(Boolean)
        .map(String)
    : [];

  return {
    id: String(label[2]),
    name: cleanText(label[0]) || "Label",
    emoji: cleanText(label[3]),
    sourceIds
  };
}

function parseSourcesFromNotebookData(data) {
  const record = unwrapNotebookRecord(data);

  if (!record || !Array.isArray(record[1])) {
    return [];
  }

  return record[1].map(mapSourceRecord).filter(Boolean);
}

function parseLabelsFromResponse(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  const labels = Array.isArray(data[0]) ? data[0] : data;
  return labels.map(mapLabelRecord).filter(Boolean);
}

async function fetchNotebookLmRecord(notebookId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();

  if (!targetNotebookId) {
    throw new Error("Choose a notebook first.");
  }

  const tokens = await getNotebookLmTokens(options);
  const response = await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.getNotebook,
    [
      targetNotebookId,
      null,
      [2, null, null, [1, null, null, null, null, null, null, null, null, null, [1]]],
      null,
      0
    ],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  return unwrapNotebookRecord(response.rows?.[0]?.data);
}

async function listNotebookLmSources(notebookId, options = {}) {
  const record = await fetchNotebookLmRecord(notebookId, options);
  return parseSourcesFromNotebookData(record);
}

async function listNotebookLmLabels(notebookId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();

  if (!targetNotebookId) {
    throw new Error("Choose a notebook first.");
  }

  const tokens = await getNotebookLmTokens(options);
  const response = await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.listLabels,
    [NOTEBOOKLM_LABEL_OPTS, targetNotebookId],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  return parseLabelsFromResponse(response.rows?.[0]?.data);
}

async function deleteNotebookLmSource(notebookId, sourceId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const targetSourceId = String(sourceId || "").trim();

  if (!targetNotebookId || !targetSourceId) {
    throw new Error("Choose a source first.");
  }

  const tokens = await getNotebookLmTokens(options);

  await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.deleteSource,
    [[[targetSourceId]], [2]],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  return true;
}

async function renameNotebookLmSource(notebookId, sourceId, newTitle, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const targetSourceId = String(sourceId || "").trim();
  const safeTitle = String(newTitle || "").trim();

  if (!targetNotebookId || !targetSourceId) {
    throw new Error("Choose a source first.");
  }

  if (!safeTitle) {
    throw new Error("Source title cannot be empty.");
  }

  const tokens = await getNotebookLmTokens(options);

  await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.updateSource,
    [null, [targetSourceId], [[[safeTitle]]]],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  return { id: targetSourceId, title: safeTitle };
}

async function getNotebookLmSourceContent(notebookId, sourceId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const targetSourceId = String(sourceId || "").trim();

  if (!targetNotebookId || !targetSourceId) {
    throw new Error("Choose a source first.");
  }

  const tokens = await getNotebookLmTokens(options);
  const response = await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.getSource,
    [[targetSourceId], [2], [2]],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );
  const result = response.rows?.[0]?.data;
  let title = "";
  let typeCode = null;

  if (Array.isArray(result?.[0])) {
    const sourceMeta = result[0];

    if (typeof sourceMeta[1] === "string") {
      title = cleanText(sourceMeta[1]);
    }

    if (Array.isArray(sourceMeta[2]) && sourceMeta[2][4] !== undefined) {
      typeCode = sourceMeta[2][4];
    }
  }

  const contentBlocks = Array.isArray(result?.[3]?.[0]) ? result[3][0] : [];
  const content = extractAllText(contentBlocks).join("\n\n").trim();

  return {
    id: targetSourceId,
    title: title || "Untitled source",
    typeCode,
    type: SOURCE_TYPE_LABELS[typeCode] || "Other",
    content
  };
}

async function createNotebookLmLabel(notebookId, name, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const safeName = String(name || "").trim() || "New folder";

  if (!targetNotebookId) {
    throw new Error("Choose a notebook first.");
  }

  const tokens = await getNotebookLmTokens(options);

  await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.createLabel,
    [NOTEBOOKLM_LABEL_OPTS, targetNotebookId, null, null, null, [[safeName, ""]]],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  return safeName;
}

async function renameNotebookLmLabel(notebookId, labelId, newName, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const targetLabelId = String(labelId || "").trim();
  const safeName = String(newName || "").trim();

  if (!targetNotebookId || !targetLabelId) {
    throw new Error("Choose a folder first.");
  }

  if (!safeName) {
    throw new Error("Folder name cannot be empty.");
  }

  const tokens = await getNotebookLmTokens(options);

  await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.updateLabel,
    [NOTEBOOKLM_LABEL_OPTS, targetNotebookId, targetLabelId, [[[safeName]]]],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  return safeName;
}

async function setNotebookLmSourceLabels(notebookId, sourceId, labelIds, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const targetSourceId = String(sourceId || "").trim();
  const wanted = new Set((labelIds || []).map(String));

  if (!targetNotebookId || !targetSourceId) {
    throw new Error("Choose a source first.");
  }

  const labels = await listNotebookLmLabels(targetNotebookId, options);

  for (const label of labels) {
    const hasSource = label.sourceIds.includes(targetSourceId);
    const shouldHave = wanted.has(label.id);

    if (hasSource === shouldHave) {
      continue;
    }

    const tokens = await getNotebookLmTokens(options);
    const fieldMask = shouldHave
      ? [[null, [[targetSourceId]]]]
      : [[null, null, [[targetSourceId]]]];

    await callNotebookLmRpc(
      NOTEBOOKLM_RPC_IDS.updateLabel,
      [NOTEBOOKLM_LABEL_OPTS, targetNotebookId, label.id, fieldMask],
      tokens,
      { sourcePath: `/notebook/${targetNotebookId}` }
    );
  }

  return true;
}

async function getNotebookLmSourceCount(notebookId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();

  if (!targetNotebookId) {
    throw new Error("Choose a notebook first.");
  }

  const tokens = await getNotebookLmTokens(options);
  const response = await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.getNotebook,
    [
      targetNotebookId,
      null,
      [2, null, null, [1, null, null, null, null, null, null, null, null, null, [1]]],
      null,
      0
    ],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  const record = unwrapNotebookRecord(response.rows?.[0]?.data);
  const count = extractSourceCountFromNotebookRecord(record);

  return typeof count === "number" ? count : 0;
}

async function renameNotebookLmNotebook(notebookId, newTitle, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const safeTitle = String(newTitle || "").trim();

  if (!targetNotebookId) {
    throw new Error("Choose a notebook first.");
  }

  if (!safeTitle) {
    throw new Error("Notebook name cannot be empty.");
  }

  const tokens = await getNotebookLmTokens(options);

  await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.renameNotebook,
    [targetNotebookId, [[null, null, null, [null, safeTitle]]]],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  return { id: targetNotebookId, title: safeTitle };
}

async function deleteNotebookLmNotebook(notebookId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();

  if (!targetNotebookId) {
    throw new Error("Choose a notebook first.");
  }

  const tokens = await getNotebookLmTokens(options);

  await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.deleteNotebook,
    [[targetNotebookId], [2]],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  return true;
}

async function createNotebookLmNotebook(title, options = {}) {
  const tokens = await getNotebookLmTokens(options);
  const safeTitle = String(title || "").trim() || "NotebookTools";
  const listOptions = { ...options, authUser: tokens.authUser };
  const beforeNotebooks = await listNotebookLmNotebooks(listOptions);
  const beforeIds = new Set(beforeNotebooks.map((notebook) => notebook.id));
  const attempts = buildCreateNotebookAttempts(safeTitle, tokens.discoveryParent);
  let lastError = null;
  let notebookId = "";

  for (const attempt of attempts) {
    try {
      const response = await callNotebookLmRpc(attempt.rpcId, attempt.payload, tokens);
      const row = getRpcRow(response.rows, attempt.rpcId);
      const statusCode = Number(row?.statusCode) || 0;

      if (statusCode) {
        lastError = buildRpcError(statusCode, attempt.rpcId, { operation: "create" });
        continue;
      }

      notebookId = extractCreatedNotebookId(response, attempt.rpcId);

      if (notebookId) {
        break;
      }

      const createdAfterRpc = await findNewNotebookByDiff(beforeIds, listOptions);

      if (createdAfterRpc?.id) {
        notebookId = createdAfterRpc.id;
        break;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (!notebookId) {
    const byTitle = await findCreatedNotebookId(safeTitle, {
      ...listOptions,
      forceRefresh: true
    });

    if (byTitle) {
      notebookId = byTitle;
    }
  }

  if (!notebookId) {
    const created = await findNewNotebookByDiff(beforeIds, listOptions);

    if (created?.id) {
      notebookId = created.id;
    }
  }

  if (!notebookId) {
    throw await buildCreateNotebookFailureError(lastError, listOptions, tokens);
  }

  return {
    id: notebookId,
    title: safeTitle,
    sourceCount: 0
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

  const payload = buildAddSourcesRpcPayload(
    [[[null, null, null, null, null, null, null, [url], null, null, 1]]],
    targetNotebookId
  );

  await callNotebookLmRpc(NOTEBOOKLM_RPC_IDS.addSources, payload, tokens, {
    sourcePath: `/notebook/${targetNotebookId}`
  });

  return true;
}

async function addWebpageToNotebookLm(notebookId, pageUrl, options = {}) {
  const tokens = await getNotebookLmTokens(options);
  const targetNotebookId = String(notebookId || "").trim();
  const url = String(pageUrl || "").trim();

  if (!targetNotebookId) {
    throw new Error("Choose a NotebookLM notebook first.");
  }

  if (!url) {
    throw new Error("Open a webpage first.");
  }

  const payload = buildAddSourcesRpcPayload(
    [[[null, null, [url], null, null, null, null, null, null, null, 1]]],
    targetNotebookId
  );

  await callNotebookLmRpc(NOTEBOOKLM_RPC_IDS.addSources, payload, tokens, {
    sourcePath: `/notebook/${targetNotebookId}`
  });

  return true;
}

async function addTextToNotebookLm(notebookId, title, content, options = {}) {
  const tokens = await getNotebookLmTokens(options);
  const targetNotebookId = String(notebookId || "").trim();
  const sourceTitle = cleanText(title) || "Selected text";
  const bodyContent = String(content || "").trim();

  if (!targetNotebookId) {
    throw new Error("Choose a NotebookLM notebook first.");
  }

  if (!bodyContent) {
    throw new Error("No text was selected.");
  }

  const payload = buildAddSourcesRpcPayload(
    [[[null, [sourceTitle, bodyContent], null, 2, null, null, null, null, null, null, 1]]],
    targetNotebookId
  );

  await callNotebookLmRpc(NOTEBOOKLM_RPC_IDS.addSources, payload, tokens, {
    sourcePath: `/notebook/${targetNotebookId}`
  });

  return true;
}

function formatNotebookLmAuthUserHeader(authUser) {
  return normalizeNotebookLmAuthUser(authUser) ?? "0";
}

function buildNotebookLmUploadUrl(authUser) {
  const uploadUrl = new URL(NOTEBOOKLM_UPLOAD_URL);
  const normalizedAuthUser = normalizeNotebookLmAuthUser(authUser);

  if (normalizedAuthUser !== null) {
    uploadUrl.searchParams.set("authuser", normalizedAuthUser);
  }

  return uploadUrl;
}

function extractRegisteredFileSourceId(response, notebookId, filename) {
  const notebookKey = String(notebookId || "").trim();
  const filenameKey = String(filename || "").trim();
  const candidates = [];

  const collect = (value) => {
    if (typeof value !== "string") {
      return;
    }

    const id = extractUuid(value);

    if (!id || id === notebookKey || id === filenameKey) {
      return;
    }

    if (!candidates.includes(id)) {
      candidates.push(id);
    }
  };

  const walk = (value) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
      return;
    }

    collect(value);
  };

  walk(response?.rows?.[0]?.data);

  if (candidates.length === 1) {
    return candidates[0];
  }

  const deep = findUuidDeep(response?.rows?.[0]?.data);

  if (deep && deep !== notebookKey) {
    return deep;
  }

  return candidates[0] || "";
}

async function registerNotebookLmFileSource(notebookId, filename, options = {}) {
  const tokens = await getNotebookLmTokens(options);
  const targetNotebookId = String(notebookId || "").trim();
  const safeFilename = String(filename || "").trim();

  if (!targetNotebookId) {
    throw new Error("Choose a NotebookLM notebook first.");
  }

  if (!safeFilename) {
    throw new Error("Choose a file name first.");
  }

  const payload = [[[safeFilename]], targetNotebookId, NOTEBOOKLM_RPC_TEMPLATE_BLOCK];
  const response = await callNotebookLmRpc(NOTEBOOKLM_RPC_IDS.addSourceFile, payload, tokens, {
    sourcePath: `/notebook/${targetNotebookId}`
  });
  const sourceId = extractRegisteredFileSourceId(response, targetNotebookId, safeFilename);

  if (!sourceId) {
    throw new Error("NotebookLM did not return a file source ID.");
  }

  return { sourceId, tokens };
}

async function startNotebookLmResumableUpload({
  notebookId,
  filename,
  fileSize,
  sourceId,
  contentType,
  tokens
}) {
  const targetNotebookId = String(notebookId || "").trim();
  const safeFilename = String(filename || "").trim();
  const uploadUrl = buildNotebookLmUploadUrl(tokens.authUser);
  const authUserHeader = formatNotebookLmAuthUserHeader(tokens.authUser);
  const body = JSON.stringify({
    PROJECT_ID: targetNotebookId,
    SOURCE_NAME: safeFilename,
    SOURCE_ID: String(sourceId || "").trim()
  });

  const response = await fetch(uploadUrl.toString(), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Origin: "https://notebooklm.google.com",
      Referer: "https://notebooklm.google.com/",
      "x-goog-authuser": authUserHeader,
      "x-goog-upload-command": "start",
      "x-goog-upload-header-content-length": String(fileSize),
      "x-goog-upload-header-content-type": contentType,
      "x-goog-upload-protocol": "resumable"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Could not start PDF upload (${response.status}).`);
  }

  const sessionUrl = response.headers.get("x-goog-upload-url");

  if (!sessionUrl) {
    throw new Error("NotebookLM did not return an upload session.");
  }

  return sessionUrl;
}

async function uploadNotebookLmFileBytes(uploadUrl, bytes, tokens) {
  const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const authUserHeader = formatNotebookLmAuthUserHeader(tokens.authUser);

  const response = await fetch(uploadUrl, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Origin: "https://notebooklm.google.com",
      Referer: "https://notebooklm.google.com/",
      "x-goog-authuser": authUserHeader,
      "x-goog-upload-command": "upload, finalize",
      "x-goog-upload-offset": "0"
    },
    body: payload
  });

  if (!response.ok) {
    throw new Error(`Could not upload PDF bytes (${response.status}).`);
  }
}

async function addFileBytesToNotebookLm(notebookId, filename, fileBytes, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const safeFilename = String(filename || "upload.bin").trim();
  const bytes = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes || []);
  const contentType = String(options.contentType || "application/octet-stream").trim();
  const displayTitle = cleanText(options.title) || safeFilename.replace(/\.[^.]+$/, "");

  if (!targetNotebookId) {
    throw new Error("Choose a NotebookLM notebook first.");
  }

  if (!bytes.length) {
    throw new Error("File is empty.");
  }

  const { sourceId, tokens } = await registerNotebookLmFileSource(
    targetNotebookId,
    safeFilename,
    options
  );

  const sessionUrl = await startNotebookLmResumableUpload({
    notebookId: targetNotebookId,
    filename: safeFilename,
    fileSize: bytes.length,
    sourceId,
    contentType,
    tokens
  });

  await uploadNotebookLmFileBytes(sessionUrl, bytes, tokens);

  if (displayTitle && displayTitle !== safeFilename.replace(/\.[^.]+$/, "")) {
    await renameNotebookLmSource(targetNotebookId, sourceId, displayTitle, options);
  }

  return {
    sourceId,
    filename: safeFilename,
    title: displayTitle
  };
}

async function addPdfBytesToNotebookLm(notebookId, filename, pdfBytes, options = {}) {
  return addFileBytesToNotebookLm(notebookId, filename, pdfBytes, {
    ...options,
    contentType: "application/pdf"
  });
}

async function addImageBytesToNotebookLm(notebookId, filename, imageBytes, options = {}) {
  const safeFilename = String(filename || "snapshot.png").trim();
  const lower = safeFilename.toLowerCase();
  const contentType = lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg" : "image/png";

  return addFileBytesToNotebookLm(notebookId, safeFilename, imageBytes, {
    ...options,
    contentType
  });
}

const CREATE_ARTIFACT_OPTS = [
  2,
  null,
  null,
  [1, null, null, null, null, null, null, null, null, null, [1]],
  [[1, 4, 8, 2, 3, 6]]
];

const ARTIFACT_TYPE_NAMES = {
  1: "Audio",
  2: "Report",
  3: "Video",
  4: "Quiz",
  7: "Infographic",
  8: "Slide deck",
  9: "Data table"
};

function tripleSourceIds(sourceIds) {
  return sourceIds.map((id) => [[id]]);
}

function doubleSourceIds(sourceIds) {
  return sourceIds.map((id) => [id]);
}

function padArtifactRow(typeCode, sourceIds, slots = {}) {
  const row = [null, null, typeCode, tripleSourceIds(sourceIds)];
  const maxIndex = Math.max(2, ...Object.keys(slots).map(Number));

  while (row.length <= maxIndex) {
    row.push(null);
  }

  for (const [index, value] of Object.entries(slots)) {
    row[Number(index)] = value;
  }

  return row;
}

function buildCreateArtifactParams(notebookId, type, sourceIds, config = {}) {
  const instructions = String(config.instructions || "").trim();
  const language = String(config.language || "en");
  const doubles = doubleSourceIds(sourceIds);
  let content;

  switch (type) {
    case "audio":
      content = padArtifactRow(1, sourceIds, {
        6: [
          null,
          [
            instructions,
            config.length || 2,
            null,
            doubles,
            language,
            null,
            config.format || 1
          ]
        ]
      });
      break;
    case "video":
      content = padArtifactRow(3, sourceIds, {
        8: [
          null,
          null,
          [doubles, language, instructions, null, config.format || 1, config.style || 1]
        ]
      });
      break;
    case "report":
      content = padArtifactRow(2, sourceIds, {
        7: [
          null,
          [
            config.title || "Briefing Doc",
            config.description || "",
            null,
            doubles,
            language,
            instructions,
            null,
            true
          ]
        ]
      });
      break;
    case "quiz":
      content = padArtifactRow(4, sourceIds, {
        9: [
          null,
          [2, null, instructions, null, null, null, null, [config.quantity || 2, config.difficulty || 2]]
        ]
      });
      break;
    case "flashcards":
      content = padArtifactRow(4, sourceIds, {
        9: [
          null,
          [1, null, instructions, null, null, null, [config.difficulty || 2, config.quantity || 2]]
        ]
      });
      break;
    case "mind_map":
      content = padArtifactRow(4, sourceIds, {
        9: [null, [4, null, instructions]]
      });
      break;
    case "infographic":
      content = padArtifactRow(7, sourceIds, {
        14: [[instructions, language, null, config.orientation || 2, config.detail || 2, config.style || 1]]
      });
      break;
    case "slide_deck":
      content = padArtifactRow(8, sourceIds, {
        16: [[instructions, language, config.format || 1, config.length || 1]]
      });
      break;
    case "data_table":
      content = padArtifactRow(9, sourceIds, {
        18: [null, [instructions, language]]
      });
      break;
    default:
      throw new Error("Unsupported studio type.");
  }

  return [CREATE_ARTIFACT_OPTS, notebookId, content];
}

function findUrlDeep(value) {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUrlDeep(item);

      if (found) {
        return found;
      }
    }
  }

  return "";
}

function readUrlAtIndex(value, index) {
  if (!Array.isArray(value) || index < 0 || index >= value.length) {
    return "";
  }

  const candidate = value[index];

  return typeof candidate === "string" && /^https?:\/\//i.test(candidate) ? candidate : "";
}

function extractAudioArtifact(record) {
  const block = Array.isArray(record) ? record[6] : null;

  if (!Array.isArray(block)) {
    return { audioUrl: "", downloadUrl: "" };
  }

  return {
    audioUrl: readUrlAtIndex(block, 2),
    downloadUrl: readUrlAtIndex(block, 3)
  };
}

function extractVideoArtifact(record) {
  const block = Array.isArray(record) ? record[8] : null;

  if (!Array.isArray(block)) {
    return { videoUrl: "", downloadUrl: "" };
  }

  return {
    videoUrl: readUrlAtIndex(block, 1) || readUrlAtIndex(block, 3),
    downloadUrl: readUrlAtIndex(block, 3)
  };
}

function extractArtifactMediaUrl(record, typeCode) {
  if (!Array.isArray(record)) {
    return "";
  }

  if (typeCode === 1) {
    const { audioUrl, downloadUrl } = extractAudioArtifact(record);
    return audioUrl || downloadUrl || findUrlDeep(record[6]) || findUrlDeep(record);
  }

  if (typeCode === 3) {
    const { videoUrl, downloadUrl } = extractVideoArtifact(record);
    return videoUrl || downloadUrl || findUrlDeep(record[8]) || findUrlDeep(record);
  }

  return findUrlDeep(record[8]) || findUrlDeep(record);
}

function extractArtifactDownloadUrl(record, typeCode) {
  if (!Array.isArray(record)) {
    return "";
  }

  if (typeCode === 1) {
    return extractAudioArtifact(record).downloadUrl;
  }

  if (typeCode === 3) {
    return extractVideoArtifact(record).downloadUrl;
  }

  return "";
}

function mapArtifactStatus(record, statusCode) {
  if (statusCode === 1) {
    return "generating";
  }

  if (statusCode === 3) {
    return "ready";
  }

  if (statusCode === 2) {
    return "failed";
  }

  const typeCode = Array.isArray(record) ? record[2] : null;

  if ((typeCode === 1 || typeCode === 3) && extractArtifactMediaUrl(record, typeCode)) {
    return "ready";
  }

  return "unknown";
}

function extractArtifactDuration(record, typeCode) {
  if (!Array.isArray(record)) {
    return null;
  }

  const block = typeCode === 1 ? record[6] : typeCode === 3 ? record[8] : null;

  if (!Array.isArray(block) || !Array.isArray(block[6])) {
    return null;
  }

  const seconds = Number(block[6][0]) || 0;
  const nanos = Number(block[6][1]) || 0;

  return seconds + nanos / 1e9;
}

function mapArtifactRecord(record) {
  if (!Array.isArray(record) || record.length < 5) {
    return null;
  }

  const typeCode = record[2];
  const statusCode = record[4];

  return {
    id: String(record[0] || ""),
    title: cleanText(record[1]) || "Untitled",
    typeCode,
    type: ARTIFACT_TYPE_NAMES[typeCode] || "Artifact",
    status: mapArtifactStatus(record, statusCode),
    mediaUrl: extractArtifactMediaUrl(record, typeCode),
    downloadUrl: extractArtifactDownloadUrl(record, typeCode),
    duration: extractArtifactDuration(record, typeCode)
  };
}

function readArtifactField(record, index, fallback = null) {
  return Array.isArray(record) && record.length > index ? record[index] : fallback;
}

function parseSlideDeckArtifact(record) {
  if (!Array.isArray(record) || record[2] !== 8) {
    return null;
  }

  const block = readArtifactField(record, 16);

  if (!Array.isArray(block)) {
    return null;
  }

  const slideRows = readArtifactField(block, 2, []);
  const slides = Array.isArray(slideRows)
    ? slideRows
        .map((entry, index) => {
          const imageMeta = Array.isArray(entry?.[0]) ? entry[0] : null;

          return {
            index: index + 1,
            imageUrl: imageMeta?.[0] ? String(imageMeta[0]) : "",
            width: Number(imageMeta?.[1]) || null,
            height: Number(imageMeta?.[2]) || null,
            description: entry?.[1] ? String(entry[1]) : "",
            text: entry?.[2] ? String(entry[2]) : ""
          };
        })
        .filter((slide) => slide.imageUrl || slide.text || slide.description)
    : [];

  return {
    id: String(record[0] || ""),
    title: cleanText(readArtifactField(block, 1)) || cleanText(record[1]) || "Slide deck",
    slides,
    pdfUrl: readArtifactField(block, 3) ? String(readArtifactField(block, 3)) : "",
    pptxUrl: readArtifactField(block, 4) ? String(readArtifactField(block, 4)) : ""
  };
}

async function createNotebookLmArtifact(notebookId, type, config = {}, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const sourceIds = Array.isArray(config.sourceIds) ? config.sourceIds.filter(Boolean) : [];

  if (!targetNotebookId) {
    throw new Error("Choose a notebook first.");
  }

  if (!sourceIds.length) {
    throw new Error("Choose at least one source.");
  }

  const tokens = await getNotebookLmTokens(options);
  const params = buildCreateArtifactParams(targetNotebookId, type, sourceIds, config);
  const response = await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.createArtifact,
    params,
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  const record = Array.isArray(response.rows?.[0]?.data?.[0])
    ? response.rows[0].data[0]
    : Array.isArray(response.rows?.[0]?.data)
      ? response.rows[0].data
      : null;

  return mapArtifactRecord(record) || { id: findUuidDeep(response.rows?.[0]?.data), status: "generating" };
}


async function deleteNotebookLmArtifact(notebookId, artifactId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const targetArtifactId = String(artifactId || "").trim();

  if (!targetNotebookId || !targetArtifactId) {
    throw new Error("Choose a Studio file first.");
  }

  const tokens = await getNotebookLmTokens(options);

  await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.deleteArtifact,
    [[2], targetArtifactId],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  return true;
}

async function listNotebookLmArtifacts(notebookId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();

  if (!targetNotebookId) {
    throw new Error("Choose a notebook first.");
  }

  const tokens = await getNotebookLmTokens(options);
  const response = await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.listArtifacts,
    [
      CREATE_ARTIFACT_OPTS,
      targetNotebookId,
      'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"'
    ],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  const data = response.rows?.[0]?.data;
  const rows = Array.isArray(data?.[0]) ? data[0] : Array.isArray(data) ? data : [];

  return rows.map(mapArtifactRecord).filter(Boolean);
}

async function listNotebookLmArtifactRecords(notebookId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();

  if (!targetNotebookId) {
    throw new Error("Choose a notebook first.");
  }

  const tokens = await getNotebookLmTokens(options);
  const response = await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.listArtifacts,
    [
      CREATE_ARTIFACT_OPTS,
      targetNotebookId,
      'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"'
    ],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  const data = response.rows?.[0]?.data;
  const rows = Array.isArray(data?.[0]) ? data[0] : Array.isArray(data) ? data : [];

  return rows.filter(Array.isArray);
}

async function getNotebookLmSlideDeck(notebookId, artifactId, options = {}) {
  const targetArtifactId = String(artifactId || "").trim();
  const records = await listNotebookLmArtifactRecords(notebookId, options);
  const record = records.find((entry) => String(entry[0] || "") === targetArtifactId);

  if (!record) {
    throw new Error("Slide deck not found.");
  }

  const deck = parseSlideDeckArtifact(record);

  if (!deck) {
    throw new Error("This artifact is not a slide deck.");
  }

  return deck;
}

function mapNoteRecord(record) {
  if (!Array.isArray(record) || !record[0]) {
    return null;
  }

  if (record[2] === 2) {
    return null;
  }

  const inner = record[1];

  if (!Array.isArray(inner)) {
    return null;
  }

  const body = inner[1];
  const title = cleanText(inner[4]) || "Untitled";
  const isMindMap = typeof body === "string" && body.trim().startsWith("{");

  return {
    id: String(record[0]),
    title,
    body: typeof body === "string" ? body : "",
    isMindMap
  };
}

function findHtmlDeep(value) {
  if (typeof value === "string" && /<[a-z][\s\S]*>/i.test(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findHtmlDeep(item);

      if (found) {
        return found;
      }
    }
  }

  return "";
}

async function listNotebookLmNotes(notebookId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();

  if (!targetNotebookId) {
    throw new Error("Choose a notebook first.");
  }

  const tokens = await getNotebookLmTokens(options);
  const response = await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.getNotes,
    [targetNotebookId, null, null, NOTEBOOKLM_LABEL_OPTS],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  const data = response.rows?.[0]?.data;
  const rows = Array.isArray(data?.[0]) ? data[0] : Array.isArray(data) ? data : [];

  return rows.map(mapNoteRecord).filter(Boolean).filter((note) => !note.isMindMap);
}

async function getNotebookLmArtifactHtml(notebookId, artifactId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const targetArtifactId = String(artifactId || "").trim();

  if (!targetNotebookId || !targetArtifactId) {
    throw new Error("Choose an artifact first.");
  }

  const tokens = await getNotebookLmTokens(options);
  const response = await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.getInteractiveHtml,
    [targetArtifactId],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  return findHtmlDeep(response.rows?.[0]?.data);
}

function parseSourceFreshnessResponse(data) {
  if (!Array.isArray(data?.[0])) {
    return null;
  }

  const freshFlag = data[0][1];

  if (freshFlag === true) {
    return "fresh";
  }

  if (freshFlag === false) {
    return "stale";
  }

  return null;
}

function isRefreshableSourceType(typeCode) {
  return REFRESHABLE_SOURCE_TYPE_CODES.has(typeCode);
}

async function checkNotebookLmSourceFreshness(notebookId, sourceId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const targetSourceId = String(sourceId || "").trim();

  if (!targetNotebookId || !targetSourceId) {
    throw new Error("Choose a source first.");
  }

  const tokens = await getNotebookLmTokens(options);
  const response = await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.checkSourceFreshness,
    [null, [targetSourceId], [2]],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );

  return parseSourceFreshnessResponse(response.rows?.[0]?.data);
}

async function refreshNotebookLmSource(notebookId, sourceId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const targetSourceId = String(sourceId || "").trim();

  if (!targetNotebookId || !targetSourceId) {
    throw new Error("Choose a source first.");
  }

  const tokens = await getNotebookLmTokens(options);
  await callNotebookLmRpc(
    NOTEBOOKLM_RPC_IDS.refreshSource,
    [null, [targetSourceId], [2]],
    tokens,
    { sourcePath: `/notebook/${targetNotebookId}` }
  );
}

function sleepMs(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function sourceMatchesYoutubeVideo(source, videoId) {
  if (!source || !videoId) {
    return false;
  }

  if (source.youtubeVideoId === videoId) {
    return true;
  }

  return Boolean(source.url && source.url.includes(videoId));
}

function findYoutubeSourceForVideo(sources, videoId, beforeSourceIds = new Set()) {
  const matches = sources.filter(
    (source) => source.typeCode === 9 && sourceMatchesYoutubeVideo(source, videoId)
  );

  if (!matches.length) {
    return null;
  }

  const fresh = matches.filter((source) => !beforeSourceIds.has(source.id));

  if (fresh.length) {
    return fresh[fresh.length - 1];
  }

  return matches[matches.length - 1];
}

function normalizePageUrlKey(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    parsed.protocol = "https:";
    parsed.hostname = parsed.hostname.replace(/^www\./, "");
    parsed.hash = "";
    return parsed.href.replace(/\/$/, "");
  } catch (_error) {
    return String(value || "").trim().toLowerCase();
  }
}

function sourceMatchesWebpage(source, pageUrl) {
  if (!source || source.typeCode !== 5 || !pageUrl || !source.url) {
    return false;
  }

  return normalizePageUrlKey(source.url) === normalizePageUrlKey(pageUrl);
}

function findWebSourceForUrl(sources, pageUrl, beforeSourceIds = new Set()) {
  const matches = sources.filter((source) => sourceMatchesWebpage(source, pageUrl));

  if (!matches.length) {
    return null;
  }

  const fresh = matches.filter((source) => !beforeSourceIds.has(source.id));

  if (fresh.length) {
    return fresh[fresh.length - 1];
  }

  return matches[matches.length - 1];
}

async function isNotebookLmSourceContentReady(notebookId, sourceId, options = {}) {
  try {
    const payload = await getNotebookLmSourceContent(notebookId, sourceId, options);
    return Boolean(payload.content && payload.content.trim().length >= 40);
  } catch (_error) {
    return false;
  }
}

async function waitForYoutubeSourceReady(notebookId, youtubeUrl, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const videoId = extractYoutubeVideoIdFromUrl(youtubeUrl);
  const beforeSourceIds = new Set((options.beforeSourceIds || []).map(String));
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 180000;
  const intervalMs = Number(options.intervalMs) > 0 ? Number(options.intervalMs) : 2500;
  const startedAt = Date.now();
  let lastSource = null;

  if (!targetNotebookId) {
    throw new Error("Choose a notebook first.");
  }

  if (!videoId) {
    throw new Error("Invalid YouTube video URL.");
  }

  while (Date.now() - startedAt < timeoutMs) {
    const sources = await listNotebookLmSources(targetNotebookId, options);
    const match = findYoutubeSourceForVideo(sources, videoId, beforeSourceIds);

    if (match) {
      lastSource = match;

      if (await isNotebookLmSourceContentReady(targetNotebookId, match.id, options)) {
        return match;
      }

      if (typeof options.onProgress === "function") {
        options.onProgress({
          phase: "processing",
          source: match,
          elapsedMs: Date.now() - startedAt
        });
      }
    } else if (typeof options.onProgress === "function") {
      options.onProgress({
        phase: "waiting",
        elapsedMs: Date.now() - startedAt
      });
    }

    await sleepMs(intervalMs);
  }

  if (lastSource) {
    return lastSource;
  }

  throw new Error("Video import is still processing. Try again in a minute.");
}

async function waitForWebSourceReady(notebookId, pageUrl, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const normalizedUrl = String(pageUrl || "").trim();
  const beforeSourceIds = new Set((options.beforeSourceIds || []).map(String));
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 180000;
  const intervalMs = Number(options.intervalMs) > 0 ? Number(options.intervalMs) : 2500;
  const startedAt = Date.now();
  let lastSource = null;

  if (!targetNotebookId) {
    throw new Error("Choose a notebook first.");
  }

  if (!normalizedUrl) {
    throw new Error("Open a webpage first.");
  }

  while (Date.now() - startedAt < timeoutMs) {
    const sources = await listNotebookLmSources(targetNotebookId, options);
    const match = findWebSourceForUrl(sources, normalizedUrl, beforeSourceIds);

    if (match) {
      lastSource = match;

      if (await isNotebookLmSourceContentReady(targetNotebookId, match.id, options)) {
        return match;
      }

      if (typeof options.onProgress === "function") {
        options.onProgress({
          phase: "processing",
          source: match,
          elapsedMs: Date.now() - startedAt
        });
      }
    } else if (typeof options.onProgress === "function") {
      options.onProgress({
        phase: "waiting",
        elapsedMs: Date.now() - startedAt
      });
    }

    await sleepMs(intervalMs);
  }

  if (lastSource) {
    return lastSource;
  }

  throw new Error("Page import is still processing. Try again in a minute.");
}

function sourceUrlMatches(source, targetUrl) {
  if (!source?.url || !targetUrl) {
    return false;
  }

  const sourceKey = normalizePageUrlKey(source.url);
  const targetKey = normalizePageUrlKey(targetUrl);

  if (sourceKey === targetKey) {
    return true;
  }

  return sourceKey.includes(targetKey) || targetKey.includes(sourceKey);
}

function findFreshSource(sources, beforeSourceIds = new Set(), preferUrl = "") {
  const fresh = sources.filter((source) => !beforeSourceIds.has(source.id));

  if (!fresh.length) {
    return null;
  }

  if (preferUrl) {
    const urlMatch = fresh.find((source) => sourceUrlMatches(source, preferUrl));

    if (urlMatch) {
      return urlMatch;
    }
  }

  return fresh[fresh.length - 1];
}

async function waitForNewSourceReady(notebookId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const beforeSourceIds = new Set((options.beforeSourceIds || []).map(String));
  const preferUrl = String(options.preferUrl || "").trim();
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 180000;
  const intervalMs = Number(options.intervalMs) > 0 ? Number(options.intervalMs) : 2500;
  const startedAt = Date.now();
  let lastSource = null;

  if (!targetNotebookId) {
    throw new Error("Choose a notebook first.");
  }

  while (Date.now() - startedAt < timeoutMs) {
    const sources = await listNotebookLmSources(targetNotebookId, options);
    const match = findFreshSource(sources, beforeSourceIds, preferUrl);

    if (match) {
      lastSource = match;

      if (await isNotebookLmSourceContentReady(targetNotebookId, match.id, options)) {
        return match;
      }

      if (typeof options.onProgress === "function") {
        options.onProgress({
          phase: "processing",
          source: match,
          elapsedMs: Date.now() - startedAt
        });
      }
    } else if (typeof options.onProgress === "function") {
      options.onProgress({
        phase: "waiting",
        elapsedMs: Date.now() - startedAt
      });
    }

    await sleepMs(intervalMs);
  }

  if (lastSource) {
    return lastSource;
  }

  throw new Error("Source import is still processing. Try again in a minute.");
}

async function waitForSourceReady(notebookId, sourceId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const targetSourceId = String(sourceId || "").trim();
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 180000;
  const intervalMs = Number(options.intervalMs) > 0 ? Number(options.intervalMs) : 2500;
  const startedAt = Date.now();

  if (!targetNotebookId || !targetSourceId) {
    throw new Error("Choose a source first.");
  }

  while (Date.now() - startedAt < timeoutMs) {
    if (await isNotebookLmSourceContentReady(targetNotebookId, targetSourceId, options)) {
      const sources = await listNotebookLmSources(targetNotebookId, options);
      return sources.find((source) => source.id === targetSourceId) || { id: targetSourceId };
    }

    if (typeof options.onProgress === "function") {
      options.onProgress({
        phase: "processing",
        sourceId: targetSourceId,
        elapsedMs: Date.now() - startedAt
      });
    }

    await sleepMs(intervalMs);
  }

  throw new Error("PDF source is still processing. Try again in a minute.");
}

async function waitForNotebookLmArtifactReady(notebookId, artifactId, options = {}) {
  const targetNotebookId = String(notebookId || "").trim();
  const targetArtifactId = String(artifactId || "").trim();
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 300000;
  const intervalMs = Number(options.intervalMs) > 0 ? Number(options.intervalMs) : 3000;
  const startedAt = Date.now();

  if (!targetNotebookId || !targetArtifactId) {
    throw new Error("Choose an artifact first.");
  }

  while (Date.now() - startedAt < timeoutMs) {
    const artifacts = await listNotebookLmArtifacts(targetNotebookId, options);
    const artifact = artifacts.find((item) => item.id === targetArtifactId);

    if (artifact?.status === "ready") {
      return artifact;
    }

    if (artifact?.status === "failed") {
      throw new Error("Mind map generation failed.");
    }

    if (typeof options.onProgress === "function") {
      options.onProgress({
        phase: "generating",
        artifact,
        elapsedMs: Date.now() - startedAt
      });
    }

    await sleepMs(intervalMs);
  }

  throw new Error("Mind map is still generating. Open the notebook to check progress.");
}

if (typeof window !== "undefined") {
  window.NotebookToolsNotebookLM = {
    NOTEBOOK_SOURCE_LIMIT,
    REFRESHABLE_SOURCE_TYPE_CODES,
    addPdfBytesToNotebookLm,
    addFileBytesToNotebookLm,
    addImageBytesToNotebookLm,
    addTextToNotebookLm,
    addWebpageToNotebookLm,
    addYoutubeToNotebookLm,
    checkNotebookLmSourceFreshness,
    createNotebookLmArtifact,
    createNotebookLmLabel,
    createNotebookLmNotebook,
    deleteNotebookLmNotebook,
    deleteNotebookLmArtifact,
    deleteNotebookLmSource,
    getNotebookLmArtifactHtml,
    getNotebookLmSlideDeck,
    getNotebookLmSourceContent,
    getNotebookLmSourceCount,
    isRefreshableSourceType,
    listNotebookLmArtifactRecords,
    listNotebookLmArtifacts,
    listNotebookLmLabels,
    listNotebookLmNotes,
    listNotebookLmSources,
    parseSlideDeckArtifact,
    refreshNotebookLmSource,
    renameNotebookLmLabel,
    renameNotebookLmNotebook,
    renameNotebookLmSource,
    setNotebookLmSourceLabels,
    listNotebookLmNotebooks,
    waitForNotebookLmArtifactReady,
    waitForNewSourceReady,
    waitForSourceReady,
    waitForWebSourceReady,
    waitForYoutubeSourceReady
  };
}
