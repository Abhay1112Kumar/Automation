const axios = require("axios");

async function getGoldRate() {
  try {
    const metalRes = await axios.get("https://metals.live/api/spot");

    const goldUSD = metalRes.data.find(item => item.gold)?.gold;

    const fxRes = await axios.get("https://open.er-api.com/v6/latest/USD");
    const usdInr = fxRes.data.rates.INR;

    if (!goldUSD || !usdInr) {
      throw new Error("Invalid API response");
    }

    const per10g_24k = ((goldUSD / 31.1035) * 10 * usdInr).toFixed(2);
    const per10g_22k = (per10g_24k * 0.916).toFixed(2);
    const per10g_18k = (per10g_24k * 0.75).toFixed(2);

    console.log("Gold USD:", goldUSD, "| USD-INR:", usdInr);

    return { per10g_24k, per10g_22k, per10g_18k };

  } catch (err) {
    console.error("❌ Gold API error:", err.message);
    return null;
  }
}

module.exports = getGoldRate;