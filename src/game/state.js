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
      seriesName: null,
      crosswordId: null,
      boardRows: null,
      answerKey: {},
      solved: {},
      frozen: false,
      createdAt: null,
      remindedUsers: [],
      pendingEnd: null,
    },
    scores: {}, // userJid -> { score, lastScoredAt }
    meta: { shabbatLocked: false },
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
function startNewBoard({
  date,
  seriesName,
  crosswordId,
  boardRows,
  answerKey,
}) {
  data.board = {
    date,
    seriesName,
    crosswordId,
    boardRows,
    answerKey,
    solved: {},
    frozen: false,
    createdAt: Date.now(),
    remindedUsers: [],
    pendingEnd: null,
  };
  data.scores = {};
  persist();
}

// A board is "active" once loaded and not yet frozen (manually ended or fully completed).
function hasActiveBoard() {
  return Boolean(data.board.date) && !data.board.frozen;
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

// One-time cooldown-abuse reminder bookkeeping (per board, per user).
function hasBeenReminded(userJid) {
  return (data.board.remindedUsers || []).includes(userJid);
}

function markReminded(userJid) {
  if (!data.board.remindedUsers) data.board.remindedUsers = [];
  if (!data.board.remindedUsers.includes(userJid)) {
    data.board.remindedUsers.push(userJid);
    persist();
  }
}

// Two-step "סיום תשבץ" -> "כן" confirmation state.
function setPendingEnd(pending) {
  data.board.pendingEnd = pending;
  persist();
}

function clearPendingEnd() {
  data.board.pendingEnd = null;
  persist();
}

function isPendingEnd() {
  return Boolean(data.board.pendingEnd);
}

module.exports = {
  getBoardRow,
  startNewBoard,
  hasActiveBoard,
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
  hasBeenReminded,
  markReminded,
  setPendingEnd,
  clearPendingEnd,
  isPendingEnd,
};
