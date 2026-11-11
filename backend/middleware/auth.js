const jwt = require("jsonwebtoken");
const User = require("../models/User");

function secret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set on the backend");
  return process.env.JWT_SECRET;
}

const signToken = (user) => jwt.sign({ userId: String(user._id) }, secret(), { expiresIn: "7d" });

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return res.status(401).json({ success: false, message: "Please log in" });
  try {
    const { userId } = jwt.verify(header.slice(7), secret());
    const user = await User.findById(userId).select("-password").lean();
    if (!user) return res.status(401).json({ success: false, message: "Your account wasn't found. Please log in again." });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Your login expired. Please log in again." });
    }
    next(err);
  }
}

module.exports = { requireAuth, signToken };
