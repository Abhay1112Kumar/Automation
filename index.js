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

app.listen(PORT, () => {
  console.log("🌐 Server running on port", PORT);
});

app.get("/", (req, res) => {
  res.send("Bot running ✅");
});

// 💰 GOLD RATE API
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

// 🚀 BOT START
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["GoldBot", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  // 📱 CONNECTION HANDLER (FIXED STABLE VERSION)
  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    // QR
    if (qr) {
      console.log("\n📱 SCAN THIS QR:");
      console.log(qr);
      qrcode.generate(qr, { small: true });
    }

    // OPEN
    if (connection === "open") {
      console.log("✅ WhatsApp Connected Successfully!");
    }

    // CLOSE (NO LOOP CRASH)
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      console.log("❌ Connection closed. Code:", statusCode);

      // If logged out → STOP completely
      if (statusCode === DisconnectReason.loggedOut) {
        console.log("🚫 Logged out. Delete auth folder & rescan QR.");
        return;
      }

      // Safe restart after delay
      console.log("🔁 Reconnecting in 5s...");
      setTimeout(() => startBot(), 5000);
    }
  });

  // 💰 SEND MESSAGE
  async function sendGoldRate() {
    try {
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
          console.log("✅ Message sent to group");
        }
      }
    } catch (err) {
      console.log("❌ Send error:", err.message);
    }
  }

  // 🔐 API TRIGGER (FOR CRON)
  app.get("/send", async (req, res) => {
    if (req.query.key !== SECRET_KEY) {
      return res.status(403).send("❌ Unauthorized");
    }

    await sendGoldRate();
    res.send("✅ Sent");
  });
}

startBot();