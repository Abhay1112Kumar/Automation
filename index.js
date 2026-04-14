require("dotenv").config();

const { Client, RemoteAuth } = require("whatsapp-web.js");
const { MongoStore } = require("wwebjs-mongo");
const mongoose = require("mongoose");
const qrcode = require("qrcode-terminal");
const express = require("express");
const getGoldRate = require("./goldRate");

const app = express();
const PORT = process.env.PORT || 3000;

const GROUP_NAME = "V";
const SECRET_KEY = process.env.SECRET_KEY;
const MONGO_URI = process.env.MONGO_URI;

// 🌐 Start server
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// 🧠 Mongo Store
const store = new MongoStore({ mongoose });

// 🤖 WhatsApp Client
const client = new Client({
  authStrategy: new RemoteAuth({
    store: store,
    backupSyncIntervalMs: 300000
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  }
});

// 📱 QR (first time only)
client.on("qr", (qr) => {
  console.log("📱 Scan QR:");
  qrcode.generate(qr, { small: true });
});

// ✅ Ready
client.on("ready", () => {
  console.log("✅ WhatsApp Bot Ready!");
});

// 💾 Session stored
client.on("authenticated", () => {
  console.log("✅ Session saved in MongoDB");
});

// 🌐 Health route
app.get("/", (req, res) => {
  res.send("✅ Bot is running");
});

// 🔥 API trigger
app.get("/send", async (req, res) => {
  try {
    if (req.query.key !== SECRET_KEY) {
      return res.status(403).send("❌ Unauthorized");
    }

    console.log("⏰ Triggered at:", new Date());

    await sendGoldRate();
    res.send("✅ Gold rate sent");

  } catch (err) {
    console.error("❌ API error:", err.message);
    res.status(500).send("❌ Failed");
  }
});

// 💰 Send gold rate
async function sendGoldRate() {
  try {
    const rates = await getGoldRate();

    if (!rates || !rates.per10g_24k) {
      throw new Error("Invalid gold data");
    }

    const today = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    const message = `🌅 *Good Morning!*
💰 *Gold Rate Today — ${today}*

🔶 *24K (10g):* ₹${rates.per10g_24k}
🔷 *22K (10g):* ₹${rates.per10g_22k}
🔸 *18K (10g):* ₹${rates.per10g_18k}

📍 _Rates are indicative. Verify with local jeweller._`;

    const chats = await client.getChats();
    const group = chats.find(c => c.isGroup && c.name === GROUP_NAME);

    if (group) {
      await group.sendMessage(message);
      console.log("✅ Message sent to group");
    } else {
      console.log("❌ Group not found");
    }

  } catch (err) {
    console.error("❌ Send error:", err.message);
  }
}

// ✅ CONNECT MONGODB FIRST → THEN START WHATSAPP
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");

    // 🚀 Start WhatsApp AFTER DB ready
    client.initialize();

  })
  .catch(err => {
    console.log("❌ Mongo error:", err.message);
  });