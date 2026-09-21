"use strict";

// DD/MM/YYYY date parsing/validation, shared by board-request parsing and (formerly) OCR.

const DATE_RE = /(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/;

function normalizeDate(match) {
  let [, day, month, year] = match;
  day = day.padStart(2, "0");
  month = month.padStart(2, "0");
  if (year.length === 2) year = `20${year}`;
  return `${day}/${month}/${year}`;
}

// Guards against matching random numbers (phone numbers, clue counts, etc.) as a date -
// only a real calendar date within a sane range counts as "a full date".
function isValidDate(match) {
  const [, day, month, year] = match;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year.length === 2 ? `20${year}` : year);
  return d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2099;
}

// Finds and normalizes a DD/MM/YYYY date anywhere in `text`, or returns null.
function extractDate(text) {
  const match = text.match(DATE_RE);
  if (!match || !isValidDate(match)) return null;
  return normalizeDate(match);
}

module.exports = { DATE_RE, normalizeDate, isValidDate, extractDate };
