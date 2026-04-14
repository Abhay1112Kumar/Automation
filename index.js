require("dotenv").config();

const { Client, RemoteAuth } = require("whatsapp-web.js");
const { MongoStore } = require("wwebjs-mongo");
const mongoose = require("mongoose");
const qrcode = require("qrcode-terminal");
const express = require("express");
const getGoldRate = require("./goldRate");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const GROUP_NAME = "V";
const SECRET_KEY = process.env.SECRET_KEY;
const MONGO_URI = process.env.MONGO_URI;

// 🌐 Server
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// 🧠 Mongo store
const store = new MongoStore({ mongoose });

// 📦 Dynamic Chrome resolver (IMPORTANT FIX)
function getChromePath() {
  try {
    const base = path.join(__dirname, ".cache", "puppeteer", "chrome");
    if (!fs.existsSync(base)) return null;

    const versions = fs.readdirSync(base);
    if (!versions.length) return null;

    const latest = versions[0];

    return path.join(
      base,
      latest,
      "chrome-linux64",
      "chrome"
    );
  } catch (e) {
    console.log("⚠️ Chrome path error:", e.message);
    return null;
  }
}

// 🤖 WhatsApp client
const client = new Client({
  authStrategy: new RemoteAuth({
    store: store,
    backupSyncIntervalMs: 300000
  }),
  puppeteer: {
    executablePath: getChromePath(), // 🔥 FIXED
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  }
});

// 📱 QR
client.on("qr", (qr) => {
  console.log("📱 Scan QR below:");
  console.log(qr);
  qrcode.generate(qr, { small: true });
});

// ✅ Ready
client.on("ready", () => {
  console.log("✅ WhatsApp Bot Ready!");
});

// 💾 Auth saved
client.on("authenticated", () => {
  console.log("✅ Session saved in MongoDB");
});

// 🧪 Debug
client.on("loading_screen", (percent, message) => {
  console.log("⏳ Loading:", percent, message);
});

client.on("auth_failure", (msg) => {
  console.log("❌ Auth failure:", msg);
});

client.on("disconnected", (reason) => {
  console.log("❌ Disconnected:", reason);
});

// 🌐 Health route
app.get("/", (req, res) => {
  res.send("✅ Bot is running");
});

// 🔐 Cron/API trigger
app.get("/send", async (req, res) => {
  try {
    if (req.query.key !== SECRET_KEY) {
      return res.status(403).send("❌ Unauthorized");
    }

    await sendGoldRate();
    res.send("✅ Sent");

  } catch (err) {
    console.error(err.message);
    res.status(500).send("❌ Failed");
  }
});

// 💰 Gold rate sender
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

  const chats = await client.getChats();
  const group = chats.find(c => c.isGroup && c.name === GROUP_NAME);

  if (group) {
    await group.sendMessage(msg);
    console.log("✅ Message sent");
  } else {
    console.log("❌ Group not found");
  }
}

// 🚀 Mongo → start bot
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");

    console.log("🚀 Starting WhatsApp...");
    await client.initialize();

  })
  .catch(err => {
    console.log("❌ Mongo error:", err.message);
  });