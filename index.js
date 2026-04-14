require("dotenv").config();

const express = require("express");
const qrcode = require("qrcode-terminal");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 3000;

const GROUP_NAME = "V";

app.get("/", (req, res) => {
  res.send("Bot Running ✅");
});

app.listen(PORT, () => {
  console.log("🌐 Server running on port", PORT);
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // IMPORTANT: forces QR in logs
    browser: ["GoldBot", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  // 🔥 CONNECTION HANDLER (FINAL FIX)
  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    // QR DISPLAY FIX (VERY IMPORTANT)
    if (qr) {
      console.log("\n📱 SCAN THIS QR:\n");
      qrcode.generate(qr, { small: true });

      console.log("\n(If QR not visible above, copy raw QR from logs)\n");
    }

    if (connection === "open") {
      console.log("✅ WhatsApp Connected Successfully!");
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;

      console.log("❌ Connection closed. Code:", code);

      // stop loop if logged out
      if (code === DisconnectReason.loggedOut) {
        console.log("🚫 Logged out. Delete auth folder & redeploy.");
        return;
      }

      // safe reconnect
      setTimeout(() => {
        console.log("🔁 Reconnecting safely...");
        startBot();
      }, 5000);
    }
  });
}

startBot();