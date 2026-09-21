"use strict";

const fs = require("fs");
const path = require("path");
const config = require("../config");
const state = require("../game/state");

const CHECK_INTERVAL_MS = 60 * 1000;
let lastWarnedAt = 0;

function readTimes() {
  const filePath = path.resolve(config.paths.shabbatTimesFile);
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const start = new Date(raw.start);
    const end = new Date(raw.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
      return null;
    return { start, end };
  } catch {
    return null;
  }
}

async function tick(sock) {
  const times = readTimes();
  const now = Date.now();
  const currentlyLocked = state.isShabbatLocked();

  if (!times) {
    if (now - lastWarnedAt > 60 * 60 * 1000) {
      console.warn(
        `No valid ${config.paths.shabbatTimesFile} found - Shabbat auto-lock is inactive.`,
      );
      lastWarnedAt = now;
    }
    return;
  }

  const withinShabbat =
    now >= times.start.getTime() && now < times.end.getTime();

  if (withinShabbat && !currentlyLocked) {
    await sock.groupSettingUpdate(config.groupJid, "announcement");
    await sock.sendMessage(config.groupJid, {
      text: "שבת שלום 🕯️ הצ׳אט ננעל עד צאת השבת.",
    });
    state.setShabbatLocked(true);
  } else if (!withinShabbat && currentlyLocked) {
    await sock.groupSettingUpdate(config.groupJid, "not_announcement");
    await sock.sendMessage(config.groupJid, {
      text: "שבוע טוב! הצ׳אט נפתח מחדש 🎉",
    });
    state.setShabbatLocked(false);
  } else if (
    !withinShabbat &&
    now > times.end.getTime() &&
    now - lastWarnedAt > 60 * 60 * 1000
  ) {
    console.warn(
      `${config.paths.shabbatTimesFile} only has a past Shabbat window - update it with next week's start/end.`,
    );
    lastWarnedAt = now;
  }
}

function startShabbatScheduler(sock) {
  const intervalId = setInterval(() => {
    tick(sock).catch((err) =>
      console.error("Shabbat scheduler tick failed:", err),
    );
  }, CHECK_INTERVAL_MS);
  tick(sock).catch((err) =>
    console.error("Shabbat scheduler tick failed:", err),
  );
  return intervalId;
}

module.exports = { startShabbatScheduler, readTimes };
