"use strict";

const config = require("../config");
const model = require("../board/model");
const state = require("./state");

// Strips niqqud/punctuation/whitespace so answers can be compared loosely.
const FINAL_LETTERS = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

function normalize(text) {
  return text
    .normalize("NFC")
    .replace(/[\u0591-\u05C7]/g, "") // Hebrew niqqud/cantillation marks
    .replace(/["'\-.,!?]/g, "")
    .replace(/\s+/g, "")
    .replace(/[ךםןףץ]/g, (ch) => FINAL_LETTERS[ch]) // treat final letter forms as equivalent to regular forms
    .trim();
}

// Grades one "X מאוזן/מאונך - text" submission from a given user.
// Returns { outcome: 'correct' | 'wrong', scored: boolean }.
function gradeSubmission({ number, direction, text, userJid }) {
  const clueKey = `${number}:${direction}`;
  const entry = model.getEntry(Number(number), direction);
  if (!entry)
    return { outcome: "wrong", scored: false, reason: "unknown-clue" };

  if (state.isClueSolved(clueKey)) {
    return { outcome: "wrong", scored: false, reason: "already-solved" };
  }

  const answerKey = state.getAnswerKey();
  const correctText = answerKey[clueKey];
  if (!correctText)
    return { outcome: "wrong", scored: false, reason: "no-known-answer" };

  if (normalize(text) !== normalize(correctText)) {
    return { outcome: "wrong", scored: false, reason: "incorrect-text" };
  }

  // Store the canonical scraped answer (not the user's raw text) so the rendered board
  // always shows consistent letters regardless of whether the user typed a final letter form.
  state.markSolved(clueKey, userJid, correctText);

  const { lastScoredAt } = state.getUserScore(userJid);
  const now = Date.now();
  const eligible =
    !lastScoredAt || now - lastScoredAt >= config.scoreCooldownMs;
  if (eligible) {
    state.awardPoint(userJid, now);
  }

  return { outcome: "correct", scored: eligible, clueKey };
}

function isBoardComplete() {
  const solved = state.getSolved();
  const allKeys = model.allClueKeys();
  return allKeys.length > 0 && allKeys.every((key) => Boolean(solved[key]));
}

module.exports = { gradeSubmission, isBoardComplete, normalize };
