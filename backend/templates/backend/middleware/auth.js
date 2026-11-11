const jwt = require("jsonwebtoken");
const crypto = require("crypto");

if (!process.env.JWT_SECRET) {
  console.log("⚠️  JWT_SECRET not set: using a temporary secret (everyone is logged out on restart).");
}
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");

const sign = (user) =>
  jwt.sign(
    { id: String(user._id), role: user.role, name: user.name, email: user.email, customerId: user.customerId || null },
    SECRET,
    { expiresIn: "7d" }
  );

function readUser(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(header.slice(7), SECRET);
  } catch {
    return null;
  }
}

/** Reads the logged-in user if there is one (req.user), but doesn't require it. */
function optionalAuth(req, res, next) {
  req.user = readUser(req);
  next();
}

function requireAuth(req, res, next) {
  req.user = readUser(req);
  if (!req.user) return res.status(401).json({ message: "Please log in" });
  next();
}

/** Only the site owner (the admin account set up when the site was built). */
function requireAdmin(req, res, next) {
  req.user = readUser(req);
  if (!req.user) return res.status(401).json({ message: "Please log in" });
  if (req.user.role !== "admin") return res.status(403).json({ message: "Only the site owner can do this" });
  next();
}

module.exports = { sign, readUser, optionalAuth, requireAuth, requireAdmin };
