/** Turn anything (AI output, a user's edits) into a safe, complete game config. */
const { ENGINES, WORLDS, PLAYERS, COLLECTIBLES, PALETTES, NAMES, byId } = require("./library");

const text = (v, max, fallback = "") => {
  const s = String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return s || fallback;
};
const hex = (v, fallback) => (/^#[0-9a-fA-F]{6}$/.test(String(v || "").trim()) ? String(v).trim().toLowerCase() : fallback);
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const num = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function slug(s) {
  return (String(s || "game").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)) || "game";
}

function normalizeQuiz(raw = {}) {
  const mode = raw.mode === "math" ? "math" : "custom";
  const questions = [];
  for (const q of Array.isArray(raw.questions) ? raw.questions : []) {
    const question = text(q?.q ?? q?.question, 200);
    const options = (Array.isArray(q?.options) ? q.options : []).map((o) => text(o, 80)).filter(Boolean).slice(0, 4);
    let answer = Number(q?.answer);
    if (typeof q?.answer === "string" && Number.isNaN(answer)) answer = options.findIndex((o) => o.toLowerCase() === q.answer.trim().toLowerCase());
    if (!question || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) continue;
    questions.push({ q: question, options, answer });
    if (questions.length >= 60) break;
  }
  return {
    mode: mode === "custom" && !questions.length ? "math" : mode,
    questions,
    perGame: Math.round(num(raw.perGame, 3, 30, 10)),
    seconds: Math.round(num(raw.seconds, 5, 60, 15)),
  };
}

function normalizeMemory(raw = {}) {
  const items = [];
  for (const it of Array.isArray(raw.items) ? raw.items : []) {
    const s = text(it, 14);
    if (s && !items.includes(s)) items.push(s);
    if (items.length >= 12) break;
  }
  return { items: items.length >= 4 ? items : ["🍎", "🍌", "🍇", "🍒", "🍉", "🍍", "🥝", "🍓"] };
}

function normalizeGame(raw, { base } = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const tpl = base || byId(r.template) || null;
  const engine = oneOf(r.engine, Object.keys(ENGINES), tpl?.engine || "runner");
  const meta = ENGINES[engine];
  const world = oneOf(r.world, WORLDS, tpl?.world || "night");
  const pal = { ...PALETTES[world], ...(tpl && tpl.world === world ? tpl.colors : {}) };
  const rc = r.colors && typeof r.colors === "object" ? r.colors : {};
  const colors = {};
  for (const k of Object.keys(PALETTES.night)) colors[k] = hex(rc[k], pal[k]);
  // Keep the sky and fog the same colour so the horizon blends in.
  colors.fog = hex(rc.fog, colors.sky);
  const title = text(r.title, 40, tpl?.title || "My Game");
  const game = {
    id: slug(r.id || title),
    engine,
    title,
    kicker: text(r.kicker, 30, meta.label),
    tagline: text(r.tagline, 90, tpl?.tagline || "Beat the high score"),
    description: text(r.description, 240, tpl?.description || ""),
    controls: text(r.controls, 120, meta.controls),
    world,
    player: oneOf(r.player, PLAYERS, tpl?.player || "runner"),
    collectible: oneOf(r.collectible, COLLECTIBLES, tpl?.collectible || "coin"),
    collectName: text(r.collectName, 16, tpl?.collectName || meta.collect),
    difficulty: oneOf(r.difficulty, ["easy", "normal", "hard"], tpl?.difficulty || "normal"),
    speed: Math.round(num(r.speed, 0.6, 1.8, 1) * 20) / 20,
    lives: Math.round(num(r.lives, 1, 9, tpl?.lives || 3)),
    usesLives: meta.usesLives,
    sound: r.sound !== false,
    sampleTop: Math.round(num(r.sampleTop, 50, 100000, engine === "quiz" || engine === "memory" ? 1200 : 900)),
    colors,
  };
  if (r.timeLimit != null || tpl?.timeLimit) game.timeLimit = Math.round(num(r.timeLimit ?? tpl?.timeLimit, 20, 600, 75));
  if (engine === "maze" && !game.timeLimit) game.timeLimit = 75;
  if (engine === "quiz") game.quiz = normalizeQuiz(r.quiz || tpl?.quiz);
  if (engine === "memory") game.memory = normalizeMemory(r.memory || tpl?.memory);
  game.sampleNames = NAMES;
  return game;
}

module.exports = { normalizeGame, slug, text };
