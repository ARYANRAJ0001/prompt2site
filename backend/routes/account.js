const express = require("express");
const axios = require("axios");
const { requireAuth } = require("../middleware/auth");
const { usageFor } = require("../services/usage");

const router = express.Router();
router.use(requireAuth);

// GET /api/account/usage -> today's usage and limits
router.get("/usage", async (req, res, next) => {
  try {
    res.json({ success: true, usage: await usageFor(req.user._id) });
  } catch (err) {
    next(err);
  }
});

// GET /api/account/key-check -> checks the OpenRouter key in X-OpenRouter-Key (or the server's)
router.get("/key-check", async (req, res) => {
  const own = typeof req.headers["x-openrouter-key"] === "string" && req.headers["x-openrouter-key"].trim();
  const key = own || process.env.OPENROUTER_API_KEY;
  if (!key) return res.json({ success: false, message: "No OpenRouter key is set." });
  try {
    const { data } = await axios.get("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` }, timeout: 15000 });
    const d = data?.data || {};
    res.json({
      success: true,
      whose: own ? "yours" : "the server's",
      label: d.label || "",
      freeTier: Boolean(d.is_free_tier),
      usage: d.usage ?? null,
      limit: d.limit ?? null,
      remaining: d.limit_remaining ?? null,
    });
  } catch (err) {
    const status = err.response?.status;
    res.json({
      success: false,
      whose: own ? "yours" : "the server's",
      message: status === 401 ? "That key isn't valid." : `Couldn't check the key (${err.response?.data?.error?.message || err.message}).`,
    });
  }
});

module.exports = router;
