/**
 * Daily limits per user, so one account can't use up the shared AI key or
 * the free Render/Netlify plans. Change them in .env:
 *   LIMIT_AI_PER_DAY (default 40)        plans, chat edits, static sites
 *   LIMIT_PREVIEWS_PER_DAY (default 60)
 *   LIMIT_DEPLOYS_PER_DAY (default 15)
 * AI calls made with the user's own OpenRouter key don't count.
 */
const Usage = require("../models/Usage");

const LIMITS = () => ({
  ai: Number(process.env.LIMIT_AI_PER_DAY || 40),
  preview: Number(process.env.LIMIT_PREVIEWS_PER_DAY || 60),
  deploy: Number(process.env.LIMIT_DEPLOYS_PER_DAY || 15),
});
const LABEL = { ai: "AI requests", preview: "previews", deploy: "deploys" };
const today = () => new Date().toISOString().slice(0, 10);

/** Count one use, or throw a 429 error if the daily limit is reached. */
async function consume(userId, kind) {
  const limit = LIMITS()[kind];
  if (!limit || limit < 0) return;
  const day = today();
  // Make sure today's record exists, then increment only while under the
  // limit (one atomic update, so two requests at once can't both slip through).
  await Usage.updateOne({ userId, day }, { $setOnInsert: { ai: 0, preview: 0, deploy: 0 } }, { upsert: true });
  const doc = await Usage.findOneAndUpdate({ userId, day, [kind]: { $lt: limit } }, { $inc: { [kind]: 1 } }, { new: true });
  if (doc) return;
  const e = new Error(
    `You've reached today's limit of ${limit} ${LABEL[kind]}. It resets at midnight UTC.` +
      (kind === "ai" ? " Tip: add your own OpenRouter key in ⚙️ Settings for unlimited AI." : "")
  );
  e.status = 429;
  throw e;
}

/** Give a use back (when the task failed before doing anything). */
async function refund(userId, kind) {
  await Usage.updateOne({ userId, day: today(), [kind]: { $gt: 0 } }, { $inc: { [kind]: -1 } }).catch(() => {});
}

async function usageFor(userId) {
  const doc = (await Usage.findOne({ userId, day: today() }).lean()) || {};
  const limits = LIMITS();
  return Object.fromEntries(Object.keys(limits).map((k) => [k, { used: doc[k] || 0, limit: limits[k] }]));
}

module.exports = { consume, refund, usageFor };
