/**
 * Hosts preview builds of generated apps at /preview/<id>/ on this server.
 * Previews run in demo mode (sample data in the browser), expire after 2 hours,
 * and each user keeps at most 3.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ROOT } = require("./build");

const DIR = path.join(ROOT, "previews");
const TTL = 2 * 60 * 60 * 1000;
const owners = new Map(); // id -> { userId, at }

function savePreview(distDir, userId) {
  fs.mkdirSync(DIR, { recursive: true });
  const id = crypto.randomBytes(9).toString("hex");
  fs.cpSync(distDir, path.join(DIR, id), { recursive: true });
  owners.set(id, { userId: String(userId), at: Date.now() });

  const mine = [...owners.entries()].filter(([, o]) => o.userId === String(userId)).sort((a, b) => b[1].at - a[1].at);
  for (const [oldId] of mine.slice(3)) removePreview(oldId);
  return id;
}

function removePreview(id) {
  owners.delete(id);
  fs.rm(path.join(DIR, id), { recursive: true, force: true }, () => {});
}

setInterval(() => {
  for (const [id, o] of owners) if (Date.now() - o.at > TTL) removePreview(id);
}, 15 * 60 * 1000).unref();

// Old previews from before a restart
try {
  fs.rmSync(DIR, { recursive: true, force: true });
} catch {}

module.exports = { savePreview, PREVIEW_DIR: DIR };
