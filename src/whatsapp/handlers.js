"use strict";

const config = require("../config");
const state = require("../game/state");
const { gradeSubmission, isBoardComplete } = require("../game/grading");
const { renderBoardImage } = require("../board/render");
const { fetchAnswerKey } = require("../scrape/answerKey");
const { parseBoardRequest } = require("../scrape/boardRequest");
const {
  solveLayout,
  clueLengthsFromEntries,
} = require("../board/layoutSolver");

function getMessageText(message) {
  return message.conversation || message.extendedTextMessage?.text || "";
}

function getSenderJid(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

function buildLeaderboardText() {
  const scores = state.allScoresSorted();
  if (scores.length === 0) return "אף אחד לא צבר נקודות בסבב זה.";

  const [first, second] = scores;
  const lines = [
    `🥇 ${first.userJid.split("@")[0]} - ${first.score} תשובות נכונות`,
  ];
  if (second)
    lines.push(
      `🥈 ${second.userJid.split("@")[0]} - ${second.score} תשובות נכונות`,
    );
  return lines.join("\n");
}

async function sendBoardImage(sock, jid, caption) {
  const board = state.getBoardRow();
  const image = await renderBoardImage({
    boardRows: board.boardRows,
    date: board.date,
    solved: state.getSolved(),
    caption,
  });
  await sock.sendMessage(jid, { image, caption });
}

// Tries to resolve `text` (a link or free text) into a new board request. Returns true if
// the message was recognized and handled (regardless of success/failure), false if it wasn't
// a board request at all so the caller should keep trying other handlers.
async function handleBoardRequest(sock, jid, text) {
  let request;
  try {
    request = await parseBoardRequest(text);
  } catch (err) {
    console.error("Failed to parse board request:", err);
    return false;
  }
  if (!request) return false;

  let scraped;
  try {
    scraped = await fetchAnswerKey(request);
  } catch (err) {
    console.error("Scrape failed:", err);
    await sock.sendMessage(jid, {
      text: "לא הצלחתי להביא את הפתרונות מהאתר. נסו שוב או דווחו לאדמין.",
    });
    return true;
  }

  const { entries, resolvedDate, resolvedTitle } = scraped;
  if (Object.keys(entries).length === 0) {
    await sock.sendMessage(jid, {
      text: "לא מצאתי תשובות עבור הבקשה הזו. ודאו שהקישור/השם נכונים.",
    });
    return true;
  }

  const boardRows = solveLayout(clueLengthsFromEntries(entries));
  if (!boardRows) {
    await sock.sendMessage(jid, {
      text: "מצאתי את הפתרונות אבל לא הצלחתי לשחזר את מבנה הלוח. דווחו לאדמין.",
    });
    return true;
  }

  const date = resolvedDate || request.date;
  const seriesName = resolvedTitle || request.name;

  state.startNewBoard({
    date,
    seriesName,
    crosswordId: request.crosswordId,
    boardRows,
    answerKey: entries,
  });

  await sock.sendMessage(jid, {
    text: `לוח חדש נטען: ${seriesName || ""} ${date || ""} 🧩\nאפשר להתחיל לענות בפורמט: "12 מאוזן - תשובה". שלחו "?" כדי לראות את מצב הלוח.`,
  });
  return true;
}

async function handleShowBoard(sock, jid) {
  if (!state.hasActiveBoard()) {
    await sock.sendMessage(jid, { text: "אין לוח פעיל כרגע." });
    return;
  }
  await sendBoardImage(sock, jid, "מצב הלוח הנוכחי");
}

async function announceCompletion(sock, jid) {
  await sendBoardImage(sock, jid, "הלוח הושלם! כל הכבוד לכולם 🎉");
  await sock.sendMessage(jid, { text: buildLeaderboardText() });
  state.setBoardFrozen(true);
}

// Step 1: "סיום תשבץ" - ask for confirmation before actually ending the board.
async function handleEndBoardRequest(sock, jid) {
  if (!state.hasActiveBoard()) return;
  state.setPendingEnd(true);
  await sock.sendMessage(jid, {
    text: `לסיים את התשבץ הנוכחי? שלחו "${config.endBoardConfirmWord}" לאישור.`,
  });
}

// Step 2: "כן" confirmation - auto-fills unsolved answers, announces results, freezes the board.
async function handleEndBoardConfirmed(sock, jid) {
  state.clearPendingEnd();
  if (state.isBoardFrozen() || !state.hasActiveBoard()) return;

  const answerKey = state.getAnswerKey();
  const solved = state.getSolved();
  for (const clueKey of Object.keys(answerKey)) {
    if (!solved[clueKey]) {
      state.markSolved(clueKey, null, answerKey[clueKey]);
    }
  }

  const lines = ["תודה לכל המשתתפים! 🙌", "", buildLeaderboardText()];
  await sock.sendMessage(jid, { text: lines.join("\n") });
  await sendBoardImage(sock, jid, "הלוח הסופי");
  state.setBoardFrozen(true);
}

async function handleAnswerSubmission(sock, msg, match) {
  const jid = msg.key.remoteJid;
  const [, number, direction, text] = match;
  const senderJid = getSenderJid(msg);

  if (!state.hasActiveBoard() || state.isBoardFrozen()) {
    await sock.sendMessage(jid, {
      react: { text: config.emoji.wrong, key: msg.key },
    });
    return;
  }

  const result = gradeSubmission({
    number,
    direction,
    text,
    userJid: senderJid,
  });
  const emoji =
    result.outcome === "correct" ? config.emoji.correct : config.emoji.wrong;
  await sock.sendMessage(jid, { react: { text: emoji, key: msg.key } });

  if (result.outcome === "correct" && result.reminder) {
    state.markReminded(senderJid);
    await sock.sendMessage(jid, {
      text: "שימו לב: כדי שתשובה תיספר לניקוד צריך לחכות שעה מהתשובה הנכונה האחרונה שלכם שנוקדה.",
    });
  }

  if (result.outcome === "correct" && isBoardComplete()) {
    await announceCompletion(sock, jid);
  }
}

function registerHandlers(sock) {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.message) continue;
        if (msg.key.remoteJid !== config.groupJid) continue;

        const messageType = Object.keys(msg.message)[0];
        if (
          messageType !== "conversation" &&
          messageType !== "extendedTextMessage"
        )
          continue;

        const text = getMessageText(msg.message).trim();
        if (!text) continue;

        if (state.isPendingEnd() && text === config.endBoardConfirmWord) {
          await handleEndBoardConfirmed(sock, msg.key.remoteJid);
          continue;
        }

        if (config.showBoardCommands.includes(text)) {
          await handleShowBoard(sock, msg.key.remoteJid);
          continue;
        }

        if (text === config.endBoardCommand) {
          await handleEndBoardRequest(sock, msg.key.remoteJid);
          continue;
        }

        const match = text.match(config.answerPattern);
        if (match) {
          await handleAnswerSubmission(sock, msg, match);
          continue;
        }

        await handleBoardRequest(sock, msg.key.remoteJid, text);
      } catch (err) {
        console.error("Failed to handle message:", err);
      }
    }
  });
}

module.exports = { registerHandlers };
