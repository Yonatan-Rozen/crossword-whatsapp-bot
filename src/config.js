"use strict";

// Central configuration for the crossword WhatsApp bot.
// Edit GROUP_JID after running `npm run list-groups` once the bot has logged in.

module.exports = {
  // WhatsApp group JID this bot manages, e.g. "123456789-1234567890@g.us"
  groupJid: process.env.CROSSWORD_GROUP_JID || "120363045586937238@g.us",

  // A player must wait this long since their last *scored* correct answer to score again.
  scoreCooldownMs: 60 * 60 * 1000,

  emoji: {
    correct: "👍🏻",
    wrong: "❌",
  },

  // Regex for answer submissions like "12 מאוזן - פתרון" or "3 מאונך-מילה"
  answerPattern: /^\s*(\d+)\s*(מאוזן|מאונך)\s*-\s*(.+?)\s*$/,

  showBoardCommands: ["תראה", "?"],

  // Manually ends the current board early (before it's fully solved) and freezes it, after
  // a confirmation reply.
  endBoardCommand: "סיום תשבץ",
  endBoardConfirmWord: "כן",

  // A free-text board request ("לוח תרתי משמע" / "תשבץ הפוך על הפוך 04/09/2026") must start
  // with one of these words - otherwise unrelated chat messages are silently ignored. A
  // direct 14across.co.il link is always recognized regardless of this prefix.
  newBoardTriggerWords: ["לוח", "תשבץ"],

  paths: {
    dataDir: "data",
    dbFile: "data/state.json",
    authDir: "data/auth",
    shabbatTimesFile: "shabbat-times.json",
    seriesDirectoryFile: "data/series-directory.json",
  },
};
