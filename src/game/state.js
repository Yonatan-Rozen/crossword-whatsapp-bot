"use strict";

// Plain JSON-file persistence (no native modules) - this workspace's folder path
// contains characters that break native module builds (better-sqlite3/node-gyp) on Windows.

const fs = require("fs");
const path = require("path");
const config = require("../config");

const dbFile = path.resolve(config.paths.dbFile);

function defaultState() {
  return {
    board: {
      date: null,
      answerKey: {},
      solved: {},
      frozen: false,
      createdAt: null,
    },
    scores: {}, // userJid -> { score, lastScoredAt }
    meta: { shabbatLocked: false, awaitingDate: false },
  };
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(dbFile, "utf8"));
  } catch {
    return defaultState();
  }
}

let data = load();

// Atomic-ish write: write to a temp file then rename, so a crash mid-write can't corrupt state.
function persist() {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const tmpFile = `${dbFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
  fs.renameSync(tmpFile, dbFile);
}

function getBoardRow() {
  return data.board;
}

// Starts a fresh board: wipes solved progress and all per-user scores/cooldowns.
function startNewBoard(date, answerKey) {
  data.board = {
    date,
    answerKey,
    solved: {},
    frozen: false,
    createdAt: Date.now(),
  };
  data.scores = {};
  persist();
}

function getAnswerKey() {
  return data.board.answerKey;
}

function getSolved() {
  return data.board.solved;
}

function isClueSolved(clueKey) {
  return Boolean(data.board.solved[clueKey]);
}

function markSolved(clueKey, solverJid, text) {
  data.board.solved[clueKey] = { solverJid, text, ts: Date.now() };
  persist();
}

function isBoardFrozen() {
  return Boolean(data.board.frozen);
}

function setBoardFrozen(frozen) {
  data.board.frozen = frozen;
  persist();
}

function getUserScore(userJid) {
  return data.scores[userJid] || { userJid, score: 0, lastScoredAt: null };
}

function awardPoint(userJid, now) {
  const current = data.scores[userJid] || {
    userJid,
    score: 0,
    lastScoredAt: null,
  };
  data.scores[userJid] = {
    userJid,
    score: current.score + 1,
    lastScoredAt: now,
  };
  persist();
}

function allScoresSorted() {
  return Object.values(data.scores).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.lastScoredAt || 0) - (b.lastScoredAt || 0);
  });
}

function isShabbatLocked() {
  return Boolean(data.meta.shabbatLocked);
}

function setShabbatLocked(locked) {
  data.meta.shabbatLocked = locked;
  persist();
}

// True after a board photo was posted, until a date is found in a following message.
function isAwaitingDate() {
  return Boolean(data.meta.awaitingDate);
}

function setAwaitingDate(awaiting) {
  data.meta.awaitingDate = awaiting;
  persist();
}

module.exports = {
  getBoardRow,
  startNewBoard,
  getAnswerKey,
  getSolved,
  isClueSolved,
  markSolved,
  isBoardFrozen,
  setBoardFrozen,
  getUserScore,
  awardPoint,
  allScoresSorted,
  isShabbatLocked,
  setShabbatLocked,
  isAwaitingDate,
  setAwaitingDate,
};
