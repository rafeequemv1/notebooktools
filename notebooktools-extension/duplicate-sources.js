const NotebookToolsDuplicateSources = (() => {
  const MATCH_LABELS = {
    url: "Same URL",
    youtube_id: "Same YouTube video",
    title: "Similar titles",
    content: "Similar content"
  };

  function normalizeTitle(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/\s*\(\d+\)\s*$/, "")
      .replace(/\s*-\s*copy\s*$/i, "")
      .replace(/\s+copy\s*$/i, "")
      .replace(/\s*\[duplicate\]\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function levenshtein(a, b) {
    if (a.length === 0) {
      return b.length;
    }

    if (b.length === 0) {
      return a.length;
    }

    const matrix = [];

    for (let row = 0; row <= b.length; row += 1) {
      matrix[row] = [row];
    }

    for (let col = 0; col <= a.length; col += 1) {
      matrix[0][col] = col;
    }

    for (let row = 1; row <= b.length; row += 1) {
      for (let col = 1; col <= a.length; col += 1) {
        if (b.charAt(row - 1) === a.charAt(col - 1)) {
          matrix[row][col] = matrix[row - 1][col - 1];
        } else {
          matrix[row][col] = Math.min(
            matrix[row - 1][col - 1] + 1,
            matrix[row][col - 1] + 1,
            matrix[row - 1][col] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  function titleSimilarity(left, right) {
    const a = normalizeTitle(left);
    const b = normalizeTitle(right);

    if (!a || !b) {
      return 0;
    }

    if (a === b) {
      return 1;
    }

    const maxLen = Math.max(a.length, b.length);
    return 1 - levenshtein(a, b) / maxLen;
  }

  function wordShingles(text, size = 3) {
    if (!text) {
      return new Set();
    }

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    if (words.length < size) {
      return new Set(words);
    }

    const shingles = new Set();

    for (let index = 0; index <= words.length - size; index += 1) {
      shingles.add(words.slice(index, index + size).join(" "));
    }

    return shingles;
  }

  function jaccardSimilarity(left, right) {
    if (left.size === 0 && right.size === 0) {
      return 1;
    }

    if (left.size === 0 || right.size === 0) {
      return 0;
    }

    let intersection = 0;

    for (const item of left) {
      if (right.has(item)) {
        intersection += 1;
      }
    }

    return intersection / (left.size + right.size - intersection);
  }

  function contentSimilarity(left, right) {
    return jaccardSimilarity(wordShingles(left, 3), wordShingles(right, 3));
  }

  function sourceTimestamp(source) {
    if (source?.createdAt) {
      const time = new Date(source.createdAt).getTime();
      return Number.isFinite(time) ? time : 0;
    }

    return 0;
  }

  function sortSourcesOldestFirst(items) {
    return [...items].sort(
      (a, b) => sourceTimestamp(a) - sourceTimestamp(b) || a.title.localeCompare(b.title)
    );
  }

  function normalizeUrlKey(source) {
    if (source.youtubeVideoId) {
      return `youtube:${source.youtubeVideoId}`;
    }

    if (!source.url) {
      return null;
    }

    try {
      const parsed = new URL(source.url.trim().toLowerCase());
      parsed.protocol = "https:";
      parsed.hostname = parsed.hostname.replace(/^www\./, "");
      parsed.hash = "";
      return parsed.href.replace(/\/$/, "");
    } catch (_error) {
      return source.url.trim().toLowerCase();
    }
  }

  function findDuplicateGroups(sources, options = {}) {
    const {
      titleThreshold = 0.85,
      includeExactUrlMatches = true,
      contentMap = null,
      contentThreshold = 0.7
    } = options;

    if (!Array.isArray(sources) || sources.length < 2) {
      return [];
    }

    const groups = [];
    const used = new Set();

    if (includeExactUrlMatches) {
      const buckets = {};

      for (const source of sources) {
        const key = normalizeUrlKey(source);

        if (!key) {
          continue;
        }

        buckets[key] = buckets[key] || [];
        buckets[key].push(source);
      }

      for (const [key, bucket] of Object.entries(buckets)) {
        if (bucket.length < 2) {
          continue;
        }

        const sorted = sortSourcesOldestFirst(bucket);

        groups.push({
          id: `url-${groups.length}`,
          sources: sorted,
          matchType: key.startsWith("youtube:") ? "youtube_id" : "url",
          similarity: 1,
          representativeId: sorted[0].id
        });

        sorted.forEach((source) => used.add(source.id));
      }
    }

    const remaining = sources.filter((source) => !used.has(source.id));

    for (let index = 0; index < remaining.length; index += 1) {
      if (used.has(remaining[index].id)) {
        continue;
      }

      const group = [remaining[index]];
      const anchorTitle = remaining[index].title;

      for (let next = index + 1; next < remaining.length; next += 1) {
        if (used.has(remaining[next].id)) {
          continue;
        }

        if (titleSimilarity(anchorTitle, remaining[next].title) >= titleThreshold) {
          group.push(remaining[next]);
        }
      }

      if (group.length > 1) {
        const sorted = sortSourcesOldestFirst(group);
        const averageSimilarity =
          group.slice(1).reduce((sum, source) => sum + titleSimilarity(anchorTitle, source.title), 0) /
          (group.length - 1);

        groups.push({
          id: `title-${groups.length}`,
          sources: sorted,
          matchType: "title",
          similarity: averageSimilarity,
          representativeId: sorted[0].id
        });

        sorted.forEach((source) => used.add(source.id));
      }
    }

    if (contentMap) {
      const contentCandidates = sources.filter((source) => !used.has(source.id) && contentMap[source.id]);

      for (let index = 0; index < contentCandidates.length; index += 1) {
        if (used.has(contentCandidates[index].id)) {
          continue;
        }

        const group = [contentCandidates[index]];
        const anchorContent = contentMap[contentCandidates[index].id];

        for (let next = index + 1; next < contentCandidates.length; next += 1) {
          if (used.has(contentCandidates[next].id)) {
            continue;
          }

          const nextContent = contentMap[contentCandidates[next].id];

          if (!nextContent) {
            continue;
          }

          if (contentSimilarity(anchorContent, nextContent) >= contentThreshold) {
            group.push(contentCandidates[next]);
          }
        }

        if (group.length > 1) {
          const sorted = sortSourcesOldestFirst(group);

          groups.push({
            id: `content-${groups.length}`,
            sources: sorted,
            matchType: "content",
            similarity: contentThreshold,
            representativeId: sorted[0].id
          });

          sorted.forEach((source) => used.add(source.id));
        }
      }
    }

    return groups;
  }

  function getDeletionSummary(groups, selectedGroups) {
    let toDelete = 0;
    let toKeep = 0;
    const keptSources = [];

    for (const group of groups) {
      const selection = selectedGroups[group.id];

      if (selection?.action === "delete" && selection.keepSourceId) {
        const kept = group.sources.find((source) => source.id === selection.keepSourceId);

        if (kept) {
          keptSources.push(kept);
        }

        toKeep += 1;
        toDelete += group.sources.length - 1;
      } else {
        toKeep += group.sources.length;
      }
    }

    return { toDelete, toKeep, keptSources };
  }

  function defaultSelections(groups, keepPreference = "oldest") {
    const selections = {};

    for (const group of groups) {
      const sorted = group.sources;
      const keepId =
        keepPreference === "newest" ? sorted[sorted.length - 1].id : sorted[0].id;

      selections[group.id] = {
        action: "delete",
        keepSourceId: keepId
      };
    }

    return selections;
  }

  function matchLabel(matchType) {
    return MATCH_LABELS[matchType] || "Similar";
  }

  return {
    findDuplicateGroups,
    getDeletionSummary,
    defaultSelections,
    matchLabel,
    titleSimilarity
  };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsDuplicateSources = NotebookToolsDuplicateSources;
}
