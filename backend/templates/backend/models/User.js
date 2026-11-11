const mongoose = require("mongoose");

/**
 * Accounts.
 *   admin    — the site owner. Exactly one, created on start-up from ADMIN_EMAIL /
 *              ADMIN_PASSWORD. Nobody can sign up as admin.
 *   customer — anyone who signs up. Gets a customer ID like CUS-7K2Q9X.
 */
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "customer"], default: "customer" },
    customerId: { type: String, index: true, sparse: true },
    verified: { type: Boolean, default: false },
    // one-time email codes (sign-up verification, password reset)
    codeHash: { type: String, default: "" },
    codePurpose: { type: String, default: "" },
    codeExpires: { type: Number, default: 0 },
    codeTries: { type: Number, default: 0 },
    codeSentAt: { type: Number, default: 0 },
    // which ADMIN_PASSWORD_SET_AT the admin password was last applied from
    passwordStamp: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = {
  name: "User",
  fields: [],
  searchFields: [],
  ownedByUser: false,
  Model: mongoose.models.User || mongoose.model("User", schema),
};
