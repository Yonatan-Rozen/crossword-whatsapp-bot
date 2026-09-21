"use strict";

// Fetches and caches the name<->id directory of crossword series from 14across.co.il's
// answers page `<select name="crossword">` dropdown, so free-text board requests ("give me
// today's תרתי משמע") can be resolved to a `crossword` id without the user needing a link.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const config = require("../config");

const directoryFile = path.resolve(config.paths.seriesDirectoryFile);
const SOURCE_URL = "https://www.14across.co.il/answers.php";

async function fetchDirectory() {
  const res = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
    },
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const list = [];
  $('select[name="crossword"] option').each((_, el) => {
    const id = $(el).attr("value");
    const name = $(el).text().trim();
    if (id && name) list.push({ id: Number(id), name });
  });
  return list;
}

function saveDirectory(list) {
  fs.mkdirSync(path.dirname(directoryFile), { recursive: true });
  fs.writeFileSync(directoryFile, JSON.stringify(list, null, 2));
}

function loadCachedDirectory() {
  try {
    return JSON.parse(fs.readFileSync(directoryFile, "utf8"));
  } catch {
    return null;
  }
}

// Loads the cached directory if present, otherwise fetches and caches it.
async function loadOrFetchDirectory() {
  const cached = loadCachedDirectory();
  if (cached && cached.length > 0) return cached;
  const list = await fetchDirectory();
  saveDirectory(list);
  return list;
}

// Strips niqqud/punctuation/whitespace differences so fuzzy name matching is lenient.
function normalize(text) {
  return text
    .normalize("NFC")
    .replace(/["'\-.,]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Finds the best series match for `searchText` against the cached directory. Returns
// `{ id, name }` or `null` if nothing matches well enough.
async function resolveSeriesByName(searchText) {
  const directory = await loadOrFetchDirectory();
  const needle = normalize(searchText);
  if (!needle) return null;

  // Exact/substring match first (either direction), then fall back to "most words in common".
  let best = null;
  for (const entry of directory) {
    const hay = normalize(entry.name);
    if (hay === needle) return entry;
    if (hay.includes(needle) || needle.includes(hay)) {
      if (!best || hay.length < normalize(best.name).length) best = entry;
    }
  }
  if (best) return best;

  const needleWords = new Set(needle.split(" ").filter(Boolean));
  let bestScore = 0;
  for (const entry of directory) {
    const hayWords = normalize(entry.name).split(" ").filter(Boolean);
    const score = hayWords.filter((w) => needleWords.has(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore > 0 ? best : null;
}

module.exports = { loadOrFetchDirectory, resolveSeriesByName, fetchDirectory };
