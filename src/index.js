"use strict";

const config = require("./config");
const { createClient } = require("./whatsapp/client");
const { registerHandlers } = require("./whatsapp/handlers");
const { startShabbatScheduler } = require("./shabbat/scheduler");

if (!config.groupJid) {
  console.warn(
    'CROSSWORD_GROUP_JID is not set. Run "npm run list-groups" after scanning the QR code to find it, ' +
      "then set it in src/config.js or the CROSSWORD_GROUP_JID env var.",
  );
}

let schedulerStarted = false;

createClient((sock) => {
  registerHandlers(sock);

  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open" && !schedulerStarted && config.groupJid) {
      schedulerStarted = true;
      startShabbatScheduler(sock);
    }
  });
}).catch((err) => {
  console.error("Failed to start bot:", err);
  process.exit(1);
});
