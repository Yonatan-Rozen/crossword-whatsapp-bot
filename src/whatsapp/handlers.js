"use strict";

const config = require("../config");
const model = require("../board/model");
const state = require("../game/state");
const { gradeSubmission, isBoardComplete } = require("../game/grading");
const { renderBoardImage } = require("../board/render");
const { DATE_RE, normalizeDate, isValidDate } = require("../ocr/dateFromImage");
const { fetchAnswerKey } = require("../scrape/answerKey");

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

// A board photo just arrives as a trigger - the actual date comes from whatever
// message follows it, so we just arm a flag and wait.
async function handleBoardImage(sock, jid) {
  state.setAwaitingDate(true);
  await sock.sendMessage(jid, {
    text: "קיבלתי את תמונת הלוח! מה התאריך של הלוח? (למשל 19/06/2026)",
  });
}

async function handleDateMessage(sock, jid, date) {
  state.setAwaitingDate(false);

  let answerKey;
  try {
    ({ entries: answerKey } = await fetchAnswerKey(date));
  } catch (err) {
    console.error("Scrape failed:", err);
    await sock.sendMessage(jid, {
      text: `זיהיתי את התאריך ${date} אבל לא הצלחתי להביא את הפתרונות מהאתר. נסו שוב או דווחו לאדמין.`,
    });
    return;
  }

  state.startNewBoard(date, answerKey);
  await sock.sendMessage(jid, {
    text: `לוח חדש נטען לתאריך ${date} 🧩\nאפשר להתחיל לענות בפורמט: "12 מאוזן - תשובה". שלחו "${config.showBoardCommand}" כדי לראות את מצב הלוח.`,
  });
}

async function handleShowBoard(sock, jid) {
  const board = state.getBoardRow();
  const image = await renderBoardImage({
    date: board?.date,
    solved: state.getSolved(),
    caption: "מצב הלוח הנוכחי",
  });
  await sock.sendMessage(jid, { image, caption: "מצב הלוח הנוכחי" });
}

async function announceCompletion(sock, jid) {
  const board = state.getBoardRow();
  const image = await renderBoardImage({
    date: board?.date,
    solved: state.getSolved(),
    caption: "הלוח הושלם! כל הכבוד לכולם 🎉",
  });
  await sock.sendMessage(jid, {
    image,
    caption: "הלוח הושלם! כל הכבוד לכולם 🎉",
  });

  await sock.sendMessage(jid, { text: buildLeaderboardText() });
  state.setBoardFrozen(true);
}

// Ends the current board early (e.g. it wasn't fully solved) - announce results and stop taking answers.
async function handleEndBoard(sock, jid) {
  if (state.isBoardFrozen()) return;

  const lines = ["תודה לכל המשתתפים! 🙌", "", buildLeaderboardText()];
  await sock.sendMessage(jid, { text: lines.join("\n") });
  state.setBoardFrozen(true);
}

async function handleAnswerSubmission(sock, msg, match) {
  const jid = msg.key.remoteJid;
  const [, number, direction, text] = match;
  const senderJid = getSenderJid(msg);

  if (state.isBoardFrozen()) {
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

        if (messageType === "imageMessage") {
          const caption = (msg.message.imageMessage.caption || "").trim();
          const captionDateMatch = caption.match(DATE_RE);
          const captionHasValidDate =
            Boolean(captionDateMatch) && isValidDate(captionDateMatch);
          const isBoardTrigger =
            captionHasValidDate ||
            config.newBoardTriggerWords.some((word) => caption.includes(word));

          if (!isBoardTrigger) continue; // not a board photo - ignore silently

          if (captionHasValidDate) {
            await handleDateMessage(
              sock,
              msg.key.remoteJid,
              normalizeDate(captionDateMatch),
            );
          } else {
            await handleBoardImage(sock, msg.key.remoteJid);
          }
          continue;
        }

        const text = getMessageText(msg.message).trim();
        if (!text) continue;

        if (state.isAwaitingDate()) {
          const dateMatch = text.match(DATE_RE);
          if (dateMatch && isValidDate(dateMatch)) {
            await handleDateMessage(
              sock,
              msg.key.remoteJid,
              normalizeDate(dateMatch),
            );
            continue;
          }
        }

        if (text === config.showBoardCommand) {
          await handleShowBoard(sock, msg.key.remoteJid);
          continue;
        }

        if (text === config.endBoardCommand) {
          await handleEndBoard(sock, msg.key.remoteJid);
          continue;
        }

        const match = text.match(config.answerPattern);
        if (match) {
          await handleAnswerSubmission(sock, msg, match);
        }
      } catch (err) {
        console.error("Failed to handle message:", err);
      }
    }
  });
}

module.exports = { registerHandlers };
