"use strict";

// Central configuration for the crossword WhatsApp bot.
// Edit GROUP_JID after running `npm run list-groups` once the bot has logged in.

module.exports = {
  // WhatsApp group JID this bot manages, e.g. "123456789-1234567890@g.us"
  groupJid: process.env.CROSSWORD_GROUP_JID || "120363045586937238@g.us",

  // 14across.co.il answers page is fixed to one crossword series; only the date changes per board.
  // Confirmed 2026-09-07: crossword=5/"הפוך על הפוך" does NOT match crossword_board.py's grid,
  // but crossword=12/"תרתי משמע" matches it exactly (same 24 clue slots & lengths).
  answersPage: {
    baseUrl: "https://www.14across.co.il/answers.php",
    wantsold: 1,
    crossword: 12,
    name: "תרתי משמע, דקל בנו",
  },

  // A player must wait this long since their last *scored* correct answer to score again.
  scoreCooldownMs: 60 * 60 * 1000,

  emoji: {
    correct: "👍🏻",
    wrong: "❌",
  },

  // Regex for answer submissions like "12 מאוזן - פתרון" or "3 מאונך-מילה"
  answerPattern: /^\s*(\d+)\s*(מאוזן|מאונך)\s*-\s*(.+?)\s*$/,

  showBoardCommand: "תראה",

  // Manually ends the current board early (before it's fully solved) and freezes it.
  endBoardCommand: "סוף התשבץ",

  // An uploaded image is only treated as a new board if its caption contains one of these
  // words (or a date directly) - otherwise unrelated photos in the group are ignored.
  newBoardTriggerWords: ["לוח", "תשבץ"],

  paths: {
    dataDir: "data",
    dbFile: "data/state.json",
    authDir: "data/auth",
    shabbatTimesFile: "shabbat-times.json",
  },
};
