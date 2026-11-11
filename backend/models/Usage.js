const mongoose = require("mongoose");

/** How many AI calls, previews and deploys a user made on a given day. */
const usageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  day: { type: String, required: true }, // YYYY-MM-DD (UTC)
  ai: { type: Number, default: 0 },
  preview: { type: Number, default: 0 },
  deploy: { type: Number, default: 0 },
});
usageSchema.index({ userId: 1, day: 1 }, { unique: true });

module.exports = mongoose.model("Usage", usageSchema);
