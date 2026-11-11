const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const SITE = require("../config/site");
const def = require("../models/User");
const { createStore } = require("../lib/store");
const { sign, requireAuth } = require("../middleware/auth");
const { createLimiter } = require("../lib/limits");
const { code: randomCode } = require("../lib/payments");
const notify = require("../lib/notify");

/**
 * Accounts.
 * - The site owner's admin account is created on start-up from ADMIN_EMAIL and
 *   ADMIN_PASSWORD (set by Prompt2Site when you deploy). Nobody can sign up as admin.
 * - Customers sign up with name, email and password and get a customer ID.
 *   When email is set up (SMTP_USER/SMTP_PASS) they must confirm their email
 *   with a 6-digit code first, so fake addresses can't be used.
 * - Too many wrong passwords or codes lock that email out for 15 minutes.
 */
const router = express.Router();
const users = createStore(def);

const adminEmail = () => String(process.env.ADMIN_EMAIL || SITE.owner?.email || "admin@example.com").trim().toLowerCase();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL = 15 * 60 * 1000;
const loginLimit = createLimiter({ max: 8, windowMs: 15 * 60 * 1000 });
const codeLimit = createLimiter({ max: 6, windowMs: 15 * 60 * 1000 });
const signupLimit = createLimiter({ max: 10, windowMs: 60 * 60 * 1000 });

const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, phone: u.phone || "", role: u.role, customerId: u.customerId || null });
const hashCode = (c) => crypto.createHash("sha256").update(String(c)).digest("hex");
const tooMany = (res, mins) => res.status(429).json({ message: `Too many attempts. Please try again in ${mins} minute(s).` });

/** Create (or update) the owner's admin account. Called once on start-up. */
async function seedAdmin() {
  const email = adminEmail();
  let password = process.env.ADMIN_PASSWORD;
  const existing = await users.findOne({ email });

  // Only one admin: anyone else marked admin becomes a customer.
  for (const u of await users.list({ role: "admin" })) {
    if (u.email !== email) await users.update(u._id, { role: "customer" });
  }

  // ADMIN_PASSWORD is applied when the admin is created, and again only when
  // ADMIN_PASSWORD_SET_AT changes (a reset) — so a password the owner changed
  // in the app isn't overwritten on every restart.
  const stamp = String(process.env.ADMIN_PASSWORD_SET_AT || "");
  if (existing) {
    const changes = { role: "admin", verified: true };
    if (password && stamp && existing.passwordStamp !== stamp) Object.assign(changes, { passwordHash: await bcrypt.hash(password, 10), passwordStamp: stamp });
    await users.update(existing._id, changes);
    return;
  }
  if (!password) {
    password = crypto.randomBytes(6).toString("base64url");
    console.log(`🔑 Admin login: ${email} / ${password}   (set ADMIN_PASSWORD in .env to choose your own)`);
  }
  await users.create({ name: SITE.owner?.name || "Owner", email, role: "admin", verified: true, phone: SITE.owner?.phone || "", passwordHash: await bcrypt.hash(password, 10), passwordStamp: stamp });
  console.log(`👤 Admin account ready for ${email}`);
}

async function newCustomerId() {
  for (let i = 0; i < 10; i++) {
    const id = `CUS-${randomCode(6)}`;
    if (!(await users.findOne({ customerId: id }))) return id;
  }
  return `CUS-${randomCode(10)}`;
}

/** Email a fresh 6-digit code (at most one per 30 seconds). */
async function sendCode(user, purpose) {
  if (user.codeSentAt && Date.now() - user.codeSentAt < 30000 && user.codePurpose === purpose) return true;
  const code = String(crypto.randomInt(100000, 1000000));
  await users.update(user._id, { codeHash: hashCode(code), codePurpose: purpose, codeExpires: Date.now() + CODE_TTL, codeTries: 0, codeSentAt: Date.now() });
  const sent = await notify.sendCode(user.email, code, purpose);
  if (!sent) await users.update(user._id, { codeSentAt: 0 });
  return sent;
}

async function checkCode(user, code, purpose) {
  if (!user || user.codePurpose !== purpose || !user.codeHash || user.codeExpires < Date.now()) return "The code has expired. Ask for a new one.";
  if (user.codeTries >= 5) return "Too many wrong codes. Ask for a new one.";
  if (hashCode(String(code || "").trim()) !== user.codeHash) {
    await users.update(user._id, { codeTries: (user.codeTries || 0) + 1 });
    return "That code isn't right.";
  }
  await users.update(user._id, { codeHash: "", codePurpose: "", codeExpires: 0, codeTries: 0 });
  return null;
}

// POST /api/auth/register { name, email, password, phone? }
router.post("/register", async (req, res, next) => {
  try {
    if (!signupLimit.hit(req.ip)) return tooMany(res, signupLimit.minutesLeft(req.ip));
    const name = String(req.body.name || "").trim().slice(0, 80);
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const phone = String(req.body.phone || "").trim().slice(0, 20);
    if (!name || !EMAIL.test(email)) return res.status(400).json({ message: "Please enter your name and a valid email" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    if (SITE.requireLogin && phone.replace(/\D/g, "").length < 10) return res.status(400).json({ message: "Please enter your mobile number (10 digits)" });
    if (email === adminEmail()) return res.status(400).json({ message: "This email belongs to the site owner. Please log in instead." });

    const existing = await users.findOne({ email });
    if (existing && existing.verified) return res.status(400).json({ message: "This email is already registered. Please log in." });

    const mustVerify = notify.canEmail();
    let user;
    if (existing) {
      // An unconfirmed sign-up: let them start again (e.g. they never got the code).
      user = await users.update(existing._id, { name, phone, passwordHash: await bcrypt.hash(password, 10) });
    } else {
      user = await users.create({ name, email, phone, role: "customer", customerId: await newCustomerId(), verified: !mustVerify, passwordHash: await bcrypt.hash(password, 10) });
    }

    if (mustVerify) {
      if (await sendCode(user, "verify")) {
        return res.status(202).json({ needsVerification: true, email, message: `We've emailed a 6-digit code to ${email}.` });
      }
      // The email couldn't be sent (e.g. the host blocks email). Don't lock the
      // customer out: create the account without the email check.
      console.error(`⚠️  Couldn't send the sign-up code to ${email} — account created without email confirmation.`);
      user = await users.update(user._id, { verified: true, codeHash: "", codePurpose: "" });
    }
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify { email, code }
router.post("/verify", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!codeLimit.hit(`v:${email}`)) return tooMany(res, codeLimit.minutesLeft(`v:${email}`));
    const user = await users.findOne({ email });
    const problem = await checkCode(user, req.body.code, "verify");
    if (problem) return res.status(400).json({ message: problem });
    const verified = await users.update(user._id, { verified: true });
    codeLimit.clear(`v:${email}`);
    res.json({ token: sign(verified), user: publicUser(verified) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/resend { email }
router.post("/resend", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const user = await users.findOne({ email });
    if (user && !user.verified && codeLimit.hit(`r:${email}`)) await sendCode(user, "verify");
    res.json({ message: "If that account is waiting for confirmation, a new code is on its way." });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login { email, password }
router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const key = `${email}|${req.ip}`;
    if (!loginLimit.hit(key)) return tooMany(res, loginLimit.minutesLeft(key));
    const user = await users.findOne({ email });
    if (!user || !(await bcrypt.compare(String(req.body.password || ""), user.passwordHash))) {
      return res.status(401).json({ message: "Wrong email or password" });
    }
    if (!user.verified) {
      // Ask for the code only if it can actually be emailed; otherwise let them in.
      if (notify.canEmail() && (await sendCode(user, "verify"))) {
        return res.status(403).json({ needsVerification: true, email, message: "Please confirm your email first — we've sent you a code." });
      }
      await users.update(user._id, { verified: true });
    }
    loginLimit.clear(key);
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot { email } — emails a reset code
router.post("/forgot", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!notify.canEmail()) return res.status(400).json({ message: "Password reset by email isn't set up on this site. Please contact the owner." });
    const user = await users.findOne({ email });
    if (user && codeLimit.hit(`f:${email}`)) await sendCode(user, "reset");
    res.json({ message: "If that email has an account, we've sent a reset code." });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset { email, code, password }
router.post("/reset", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!codeLimit.hit(`x:${email}`)) return tooMany(res, codeLimit.minutesLeft(`x:${email}`));
    const password = String(req.body.password || "");
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    const user = await users.findOne({ email });
    const problem = await checkCode(user, req.body.code, "reset");
    if (problem) return res.status(400).json({ message: problem });
    const updated = await users.update(user._id, { passwordHash: await bcrypt.hash(password, 10), verified: true });
    res.json({ token: sign(updated), user: publicUser(updated) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await users.get(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/password { current, password }
router.post("/password", requireAuth, async (req, res, next) => {
  try {
    const user = await users.get(req.user.id);
    if (!user || !(await bcrypt.compare(String(req.body.current || ""), user.passwordHash))) {
      return res.status(400).json({ message: "Your current password isn't right" });
    }
    const password = String(req.body.password || "");
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    await users.update(user._id, { passwordHash: await bcrypt.hash(password, 10) });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.seedAdmin = seedAdmin;
