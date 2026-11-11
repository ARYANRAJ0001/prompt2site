const express = require("express");
const User = require("../models/User");
const { requireAuth, signToken } = require("../middleware/auth");

const router = express.Router();
const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email });

router.post("/signup", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!name || !email || !password) return res.status(400).json({ success: false, message: "Name, email and password are required" });
    if (password.length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    if (await User.exists({ email })) return res.status(400).json({ success: false, message: "This email is already registered. Please log in." });

    const user = await User.create({ name, email, password });
    res.status(201).json({ success: true, token: signToken(user), user: publicUser(user) });
  } catch (err) {
    if (err.name === "ValidationError") return res.status(400).json({ success: false, message: "Please enter a valid email" });
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user || !(await user.checkPassword(String(req.body.password || "")))) {
      return res.status(401).json({ success: false, message: "Wrong email or password" });
    }
    res.json({ success: true, token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, (req, res) => res.json({ success: true, user: publicUser(req.user) }));

module.exports = router;
