"use strict";

// Extracts a DD/MM/YYYY date from a photographed crossword board using local OCR (tesseract.js).

const { createWorker } = require("tesseract.js");

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

async function extractDateFromImage(buffer) {
  const worker = await createWorker("eng");
  try {
    await worker.setParameters({ tessedit_char_whitelist: "0123456789/.-" });
    const {
      data: { text },
    } = await worker.recognize(buffer);

    const match = text.match(DATE_RE);
    if (!match) {
      return { date: null, rawText: text };
    }

    return { date: normalizeDate(match), rawText: text };
  } finally {
    await worker.terminate();
  }
}

module.exports = { extractDateFromImage, normalizeDate, isValidDate, DATE_RE };
