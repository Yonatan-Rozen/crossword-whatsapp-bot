"use strict";

const path = require("path");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const config = require("../config");

// `onSocket` is invoked with every socket instance (initial connect + each reconnect)
// so callers can (re)attach message handlers to whichever socket is currently live.
async function createClient(onSocket) {
  // @whiskeysockets/baileys ships as ESM-only, so a CommonJS project must load it via dynamic import().
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
  } = await import("@whiskeysockets/baileys");

  const authDir = path.resolve(config.paths.authDir);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "warn" }),
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log("Scan this QR code with WhatsApp (Linked Devices):");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      // connectionReplaced (440) means another process/device logged into this same session -
      // reconnecting would just fight it for the connection forever, so don't retry on that one.
      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut &&
        statusCode !== DisconnectReason.connectionReplaced;
      console.log("Connection closed.", { statusCode, shouldReconnect });
      if (statusCode === DisconnectReason.connectionReplaced) {
        console.error(
          "Another process is connected with this same WhatsApp session (only run one bot instance / list-groups at a time). Exiting.",
        );
      }
      if (shouldReconnect) {
        createClient(onSocket).catch((err) =>
          console.error("Reconnect failed:", err),
        );
      }
    } else if (connection === "open") {
      console.log("WhatsApp connection open.");
    }
  });

  if (onSocket) onSocket(sock);

  return sock;
}

module.exports = { createClient };
