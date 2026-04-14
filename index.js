const express = require("express");
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("Gold Bot is running 🚀");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

async function startBot() {
  console.log("🚀 Starting WhatsApp...");

  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["GoldBot", "Chrome", "1.0.0"]
  });

  // SAVE SESSION
  sock.ev.on("creds.update", saveCreds);

  // CONNECTION HANDLER
  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    // QR CODE
    if (qr) {
      console.log("\n📱 SCAN THIS QR:\n");
      qrcode.generate(qr, { small: true });
    }

    // CONNECTED
    if (connection === "open") {
      console.log("✅ WhatsApp Connected Successfully");
    }

    // CLOSED
    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      console.log("❌ Connection closed. Code:", statusCode);

      // 🚫 STOP LOOPING ON RENDER (IMPORTANT)
      if (
        statusCode === DisconnectReason.loggedOut ||
        statusCode === 405 ||
        statusCode === 401
      ) {
        console.log("🚫 Session expired. Delete auth folder & rescan QR.");
        process.exit(1);
      }

      console.log("🔁 Restarting safely in 10 seconds...");
      setTimeout(startBot, 10000);
    }
  });
}

startBot();