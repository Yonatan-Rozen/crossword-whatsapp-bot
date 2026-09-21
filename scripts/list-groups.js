"use strict";

// One-time helper: log in, list every group this account has joined with its JID,
// so you can copy the right one into CROSSWORD_GROUP_JID / config.js.

const { createClient } = require("../src/whatsapp/client");

createClient((sock) => {
  sock.ev.on("connection.update", async ({ connection }) => {
    if (connection !== "open") return;
    const groups = await sock.groupFetchAllParticipating();
    console.log("\nJoined groups:\n");
    for (const g of Object.values(groups)) {
      console.log(`${g.subject}  ->  ${g.id}`);
    }
    process.exit(0);
  });
}).catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
