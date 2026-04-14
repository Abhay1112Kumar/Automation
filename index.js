require("dotenv").config();

const express = require("express");
const qrcode = require("qrcode-terminal");
const axios = require("axios");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 3000;

const GROUP_NAME = "V";
const SECRET_KEY = process.env.SECRET_KEY;

// 🌐 Server
app.listen(PORT, () => {
  console.log("🌐 Server running on port", PORT);
});

app.get("/", (req, res) => {
  res.send("Bot is running ✅");
});

// 💰 Gold API
async function getGoldRate() {
  const metalRes = await axios.get("https://metals.live/api/spot");
  const goldUSD = metalRes.data.gold;

  const fxRes = await axios.get("https://open.er-api.com/v6/latest/USD");
  const usdInr = fxRes.data.rates.INR;

  const per10g_24k = ((goldUSD / 31.1035) * 10 * usdInr).toFixed(2);
  const per10g_22k = (per10g_24k * 0.916).toFixed(2);
  const per10g_18k = (per10g_24k * 0.75).toFixed(2);

  return { per10g_24k, per10g_22k, per10g_18k };
}

// 🚀 Bot
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  // 🔥 IMPORTANT: QR HANDLING FIX (THIS WAS MISSING)
  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    // 📱 QR DISPLAY
    if (qr) {
      console.log("📱 SCAN THIS QR:");
      console.log(qr);
      qrcode.generate(qr, { small: true });
    }

    // 🔁 reconnect logic
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("🔁 Reconnecting...");
        startBot();
      }
    }

    if (connection === "open") {
      console.log("✅ WhatsApp Connected!");
    }
  });

  // 💰 Send message
  async function sendGoldRate() {
    const rates = await getGoldRate();

    const today = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    const msg = `🌅 *Good Morning!*
💰 *Gold Rate — ${today}*

🔶 24K: ₹${rates.per10g_24k}
🔷 22K: ₹${rates.per10g_22k}
🔸 18K: ₹${rates.per10g_18k}`;

    const chats = await sock.groupFetchAllParticipating();

    for (let id in chats) {
      if (chats[id].subject === GROUP_NAME) {
        await sock.sendMessage(id, { text: msg });
        console.log("✅ Sent to group");
      }
    }
  }

  // 🔐 API trigger (cron)
  app.get("/send", async (req, res) => {
    if (req.query.key !== SECRET_KEY) {
      return res.status(403).send("❌ Unauthorized");
    }

    await sendGoldRate();
    res.send("✅ Sent");
  });
}

// ▶️ start bot
startBot();