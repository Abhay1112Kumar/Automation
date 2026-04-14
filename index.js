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

// 🌐 server
app.listen(PORT, () => {
  console.log("🌐 Server running on port", PORT);
});

app.get("/", (req, res) => {
  res.send("Bot is running ✅");
});

// 💰 gold rate API
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

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  // 📱 QR handled automatically
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        startBot();
      }
    }

    if (connection === "open") {
      console.log("✅ WhatsApp Connected!");
    }
  });

  // 💰 send message function
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

    console.log(msg);

    // send to all chats (you can filter group later)
    const chats = await sock.groupFetchAllParticipating();

    for (let id in chats) {
      if (chats[id].subject === GROUP_NAME) {
        await sock.sendMessage(id, { text: msg });
        console.log("✅ Sent to group");
      }
    }
  }

  // 🔐 API trigger (for cron)
  app.get("/send", async (req, res) => {
    if (req.query.key !== SECRET_KEY) {
      return res.status(403).send("❌ Unauthorized");
    }

    await sendGoldRate();
    res.send("✅ Sent");
  });
}

startBot();