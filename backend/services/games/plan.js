/** Prompt -> game config: the AI chooses an engine + settings; a keyword fallback works without AI. */
const { ask, parseJson } = require("../ai");
const { ENGINES, WORLDS, PLAYERS, COLLECTIBLES, TEMPLATES, PALETTES, byId } = require("./library");
const { normalizeGame } = require("./normalize");

const SYSTEM = `You design small 3D browser games by choosing ONE ready-made engine and filling in its settings. Reply with ONE JSON object only (no markdown).

Engines (pick the closest one to what the user describes):
${Object.entries(ENGINES).map(([k, v]) => `- ${k}: ${v.label}`).join("\n")}
 runner = endless 3-lane runner; racer = car traffic dodging; flyer = fly through rings, avoid rocks; stack = drop blocks to build a tower; helix = ball falling down a rotating tower; maze = 3D maze, collect gems against a timer; penalty = football penalties; shooter = shoot approaching enemies; snake = classic snake; quiz = multiple choice quiz (needs "quiz"); memory = card matching (needs "memory").

JSON shape:
{"engine":"runner","title":"max 4 words","kicker":"short genre label","tagline":"one catchy line","description":"1-2 sentences","world":"${WORLDS.join("|")}","player":"${PLAYERS.join("|")}","collectible":"${COLLECTIBLES.join("|")}","collectName":"what is collected, plural, e.g. Coins","difficulty":"easy|normal|hard","speed":1,"lives":3,
"colors":{"sky":"#hex","fog":"#hex (same as sky)","ground":"#hex","player":"#hex","obstacle":"#hex","collect":"#hex","accent":"#hex","scenery":"#hex"},
"quiz":{"mode":"custom","perGame":10,"seconds":15,"questions":[{"q":"...","options":["a","b","c","d"],"answer":0}]},
"memory":{"items":["🍎","🍌", ... 8 short emoji or words]}}
Rules: only include "quiz" for the quiz engine and "memory" for the memory engine. Quiz: 10-15 factual questions about the user's topic, 4 options each, "answer" = index of the correct option, correct and unambiguous. Memory: 8-10 distinct emoji that fit the theme. Colours: a dark sky/ground with bright, high-contrast player/obstacle/collect/accent colours matching the theme. Use "mode":"math" for a maths quiz (then no questions needed).`;

const KEYWORDS = [
  ["quiz", /quiz|trivia|question|mcq|test my|knowledge|exam/],
  ["memory", /memory|cards?\b.*match|match.*\bcards?\b|\bpairs?\b|flip/],
  ["penalty", /penalty|football|soccer|goal ?keeper|kick/],
  ["shooter", /shoot|invader|blaster|gun|defend|alien|zombie|laser/],
  ["snake", /snake|worm/],
  ["maze", /maze|labyrinth|escape|treasure hunt/],
  ["helix", /helix|tower drop|fall|spiral|bounce/],
  ["stack", /stack|tower build|build.*tower|blocks?/],
  ["flyer", /fly|flight|plane|jet|rocket|ring|wings|glide/],
  ["racer", /\b(race|racing|racer|cars?|drive|driving|traffic|rally|drift|truck)\b/],
  ["runner", /\b(run|runner|running|dash|sprint|jump|parkour|endless)\b/],
];
const WORLD_WORDS = [
  ["space", /space|galaxy|star|planet|alien|rocket|cosmic/],
  ["night", /night|neon|cyber|dark|retro|arcade/],
  ["city", /city|urban|street|rooftop|skyscraper/],
  ["desert", /desert|sand|egypt|canyon|dune|pyramid/],
  ["snow", /snow|ice|winter|frozen|arctic/],
  ["candy", /candy|sweet|sugar|cake|kids|cute/],
  ["ocean", /ocean|sea|water|beach|island|underwater/],
  ["jungle", /jungle|rainforest|tropic|safari/],
  ["forest", /forest|woods|garden|nature|temple/],
];
const first = (list, p) => (list.find(([, re]) => re.test(p)) || [])[0];

/** Choose a game from keywords alone (no AI). */
function keywordPlan(prompt) {
  const p = String(prompt || "").toLowerCase();
  const engine = first(KEYWORDS, p) || "runner";
  const world = first(WORLD_WORDS, p);
  const tpl = TEMPLATES.find((t) => t.engine === engine && (!world || t.world === world)) || TEMPLATES.find((t) => t.engine === engine) || TEMPLATES[0];
  const title = String(prompt || "").trim().split(/\s+/).slice(0, 4).join(" ");
  const out = { ...tpl, template: tpl.id };
  if (world) out.world = world;
  if (title && title.length > 3 && !/^(make|create|build|a|an|the)$/i.test(title)) out.title = title.replace(/^(make|create|build)\s+(me\s+)?(a|an|the)?\s*/i, "").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40) || tpl.title;
  if (world && world !== tpl.world) out.colors = { ...PALETTES[world] };
  return normalizeGame(out, { base: tpl });
}

async function planGame(prompt, { apiKey, onProgress } = {}) {
  const user = `Game idea: ${String(prompt || "").slice(0, 1500)}`;
  try {
    const { value } = await ask({
      system: SYSTEM,
      user,
      apiKey,
      json: true,
      maxTokens: 3500,
      label: "Designing the game",
      onProgress,
      accept: (text) => {
        const raw = parseJson(text);
        if (!ENGINES[raw.engine]) throw new Error(`"engine" must be one of ${Object.keys(ENGINES).join(", ")}`);
        const g = normalizeGame(raw);
        if (g.engine === "quiz" && g.quiz.mode === "custom" && g.quiz.questions.length < 5) throw new Error("the quiz needs at least 8 valid questions (q, options[4], answer index)");
        return g;
      },
    });
    return { game: value, source: "ai" };
  } catch (err) {
    if (/OPENROUTER_API_KEY|401/.test(err.message)) throw err;
    return { game: keywordPlan(prompt), source: "keywords", note: `AI wasn't available, so a closest-match template was used (${err.message.slice(0, 120)}).` };
  }
}

/** "Make it harder", "change the theme to space", "add 5 questions about ..." */
async function editGame(game, instruction, { apiKey, onProgress } = {}) {
  const { value } = await ask({
    system: `${SYSTEM}\n\nYou are EDITING an existing game. You receive its JSON and an instruction. Return the FULL updated JSON, changing only what the instruction needs. Keep the same engine unless the user explicitly asks for a different kind of game. Keep existing quiz questions / memory items unless told to change them.`,
    user: `Current game:\n${JSON.stringify(game)}\n\nInstruction: ${String(instruction).slice(0, 800)}`,
    apiKey,
    json: true,
    maxTokens: 3500,
    label: "Editing the game",
    onProgress,
    accept: (text) => normalizeGame({ ...game, ...parseJson(text) }, { base: byId(game.template) || undefined }),
  });
  return value;
}

module.exports = { planGame, editGame, keywordPlan };
