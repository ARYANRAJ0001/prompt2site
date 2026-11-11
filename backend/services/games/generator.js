/** Turn a game config into the files of a deployable game (static 3D site + accounts/leaderboard backend). */
const fs = require("fs");
const path = require("path");
const { slug } = require("./normalize");

const TEMPLATE = path.join(__dirname, "..", "..", "templates", "game");
const THREE = path.join(__dirname, "..", "..", "node_modules", "three", "build", "three.module.min.js");

const read = (p) => fs.readFileSync(p, "utf8");
function walk(dir, base = dir, out = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else out[path.relative(base, full).split(path.sep).join("/")] = read(full);
  }
  return out;
}

let cache = null;
/** The engine/runtime files, read once. */
function runtime() {
  if (!cache) {
    const files = walk(path.join(TEMPLATE, "frontend"));
    delete files["config.js"];
    for (const k of Object.keys(files)) if (k.startsWith("lib/")) delete files[k]; // dev-only copy
    files["lib/three.module.min.js"] = read(THREE);
    cache = files;
  }
  return cache;
}

const configJs = (game, apiUrl) => `window.GAME_CONFIG = ${JSON.stringify(game).replace(/[\u2028\u2029]/g, " ")};\nwindow.GAME_API = ${JSON.stringify(apiUrl || "")};\n`;

/** The website part only (this is what goes to Netlify). */
function siteFiles(game, apiUrl) {
  return { ...runtime(), "config.js": configJs(game, apiUrl) };
}

/** Everything that goes to GitHub: frontend/ + backend/. */
function generateGame(game) {
  const files = {};
  for (const [p, c] of Object.entries(siteFiles(game, ""))) files[`frontend/${p}`] = c;
  for (const [p, c] of Object.entries(walk(path.join(TEMPLATE, "backend")))) files[`backend/${p}`] = c;
  files["backend/game.json"] = JSON.stringify({ title: game.title, engine: game.engine }, null, 2);
  files["README.md"] = `# ${game.title}\n\n${game.tagline}\n\nA 3D browser game made with Prompt2Site.\n\n- \`frontend/\` — the game (plain HTML/JS + three.js; open it with any static server)\n- \`backend/\` — accounts and leaderboard (Node + Express, MongoDB optional)\n\nIn \`frontend/config.js\` set \`window.GAME_API\` to your backend's URL.\n`;
  files["render.yaml"] = `services:\n  - type: web\n    name: ${slug(game.title)}-api\n    runtime: node\n    rootDir: backend\n    buildCommand: npm install\n    startCommand: npm start\n    plan: free\n    envVars:\n      - key: MONGO_URI\n        sync: false\n      - key: JWT_SECRET\n        generateValue: true\n`;
  return files;
}

module.exports = { generateGame, siteFiles, configJs };
