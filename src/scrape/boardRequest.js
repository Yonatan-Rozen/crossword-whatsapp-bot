"use strict";

// Parses a WhatsApp message into a board-load request: either a direct 14across.co.il
// answers.php link, or free text like "לוח תרתי משמע 04/09/2026".

const config = require("../config");
const { DATE_RE, normalizeDate, isValidDate } = require("../util/dates");
const { resolveSeriesByName } = require("./seriesDirectory");

const URL_RE = /https?:\/\/(?:www\.)?14across\.co\.il\/answers\.php\?[^\s]+/i;

function parseFromUrl(urlText) {
  const query = urlText.split("?")[1] || "";
  const params = new URLSearchParams(query);
  const crosswordId = Number(params.get("crossword"));
  const name = params.get("name") || null;
  const date = params.get("date") || null;
  if (!crosswordId) return null;
  return { crosswordId, name, date };
}

function stripTriggerWord(text) {
  for (const word of config.newBoardTriggerWords) {
    if (text.startsWith(word)) return text.slice(word.length).trim();
  }
  return null;
}

// Returns { crosswordId, name, date } (crosswordId/name resolved via directory lookup for
// free text; date may be null meaning "latest available"), or null if `text` doesn't look
// like a board request at all (so unrelated chat messages are silently ignored).
async function parseBoardRequest(text) {
  const trimmed = text.trim();

  const urlMatch = trimmed.match(URL_RE);
  if (urlMatch) return parseFromUrl(urlMatch[0]);

  const rest = stripTriggerWord(trimmed);
  if (rest === null) return null; // no URL and no recognized trigger word - not a board request

  const dateMatch = rest.match(DATE_RE);
  const date =
    dateMatch && isValidDate(dateMatch) ? normalizeDate(dateMatch) : null;
  const searchText = dateMatch ? rest.replace(dateMatch[0], "").trim() : rest;
  if (!searchText) return null;

  const series = await resolveSeriesByName(searchText);
  if (!series) return null;

  return { crosswordId: series.id, name: series.name, date };
}

module.exports = { parseBoardRequest };
