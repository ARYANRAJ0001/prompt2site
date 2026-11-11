/**
 * Chat-style editing: "add a delivery address field to orders",
 * "make it dark", "show bookings as a calendar"...
 *
 * The AI rewrites the plan (never code). If the AI is unavailable, a small
 * set of built-in commands still works.
 */
const { ask, parseJson } = require("./ai");
const { normalizeBlueprint, pascal, camel, singular } = require("./blueprint");

const COLORS = {
  red: "#dc2626", maroon: "#7f1d1d", orange: "#ea580c", amber: "#d97706", yellow: "#ca8a04", gold: "#b8860b",
  green: "#16a34a", "dark green": "#166534", teal: "#0d9488", cyan: "#0891b2", blue: "#2563eb", "dark blue": "#1e3a8a",
  navy: "#1e3a8a", "sky blue": "#0284c7", indigo: "#4f46e5", purple: "#7c3aed", violet: "#7c3aed", pink: "#db2777",
  rose: "#e11d48", brown: "#78350f", black: "#111827", gray: "#4b5563", grey: "#4b5563", white: "#f3f4f6",
};
const LAYOUTS = ["cards", "table", "gallery", "calendar", "board"];
const clone = (v) => JSON.parse(JSON.stringify(v));

function findModel(bp, text) {
  const t = String(text || "").toLowerCase().replace(/\b(the|page|section|list)\b/g, "").trim();
  if (!t) return bp.models.length === 1 ? bp.models[0] : null;
  const score = (m) =>
    [m.label, m.singular, m.name, m.key].map((s) => String(s).toLowerCase()).some((s) => s === t || singular(s) === singular(t))
      ? 3
      : [m.label, m.name].some((s) => String(s).toLowerCase().includes(singular(t)) || singular(t).includes(String(s).toLowerCase()))
        ? 1
        : 0;
  return [...bp.models].sort((a, b) => score(b) - score(a)).find((m) => score(m) > 0) || null;
}

/** Built-in commands, used when the AI can't help. Returns a new plan or null. */
function applyRules(bp0, instruction) {
  const bp = clone(bp0);
  const text = String(instruction).trim().replace(/[.!]+$/, "");
  let m;

  if ((m = text.match(/(?:add|include|need|want)\s+(?:a |an )?(.+?)\s+field\s*(?:(?:to|in|on|for)\s+(?:the\s+)?(.+?))?$/i))) {
    const model = findModel(bp, m[2]);
    if (!model) return null;
    const label = m[1].replace(/^(new|another)\s+/i, "").trim();
    const type = /^(yes|no|boolean|checkbox)\b/i.test(label) ? "boolean" : undefined;
    model.fields.push({ name: camel(label), label: label[0].toUpperCase() + label.slice(1), ...(type ? { type } : {}) });
    return bp;
  }
  if ((m = text.match(/(?:remove|delete|drop)\s+(?:the\s+)?(.+?)\s+field\s*(?:from\s+(?:the\s+)?(.+?))?$/i))) {
    const name = camel(m[1]);
    const models = m[2] ? [findModel(bp, m[2])].filter(Boolean) : bp.models;
    let removed = false;
    for (const model of models) {
      const before = model.fields.length;
      model.fields = model.fields.filter((f) => f.name !== name && f.label.toLowerCase() !== m[1].toLowerCase());
      removed ||= model.fields.length < before;
    }
    return removed ? bp : null;
  }
  if ((m = text.match(/(?:rename|call)\s+(?:the\s+)?(?:app|site|website|business)\s+(?:to\s+|as\s+)?["“']?(.+?)["”']?$/i)) ||
      (m = text.match(/(?:change|set)\s+(?:the\s+)?(?:app|site|website)?\s*name\s+to\s+["“']?(.+?)["”']?$/i))) {
    bp.name = m[1];
    if (bp.hero.title === bp0.name) bp.hero.title = m[1];
    return bp;
  }
  if ((m = text.match(/(?:accent|second(?:ary)?)\s+colou?r\s+(?:to\s+)?(#[0-9a-f]{3,6}|[a-z ]+)$/i))) {
    const c = m[1].startsWith("#") ? m[1] : COLORS[m[1].toLowerCase().trim()];
    if (!c) return null;
    bp.theme.accent = c;
    return bp;
  }
  if ((m = text.match(/colou?r\s+(?:to\s+|as\s+)?(#[0-9a-f]{3,6}|[a-z ]+)$/i)) || (m = text.match(/make (?:it|the site|everything)\s+([a-z ]+)$/i))) {
    const word = m[1].toLowerCase().trim();
    if (word === "dark" || word === "light") {
      bp.theme.mode = word;
      return bp;
    }
    const c = m[1].startsWith("#") ? m[1] : COLORS[word];
    if (!c) return null;
    bp.theme.primary = c;
    return bp;
  }
  if (/\bdark\s*(mode|theme)?\b/i.test(text) && !/\bnot\b/i.test(text)) {
    bp.theme.mode = "dark";
    return bp;
  }
  if (/\blight\s*(mode|theme)\b/i.test(text)) {
    bp.theme.mode = "light";
    return bp;
  }
  if (/(remove|delete|no)\s+(the\s+)?contact(\s+us)?\s+form/i.test(text)) {
    bp.contactForm = false;
    return bp;
  }
  if (/(add|enable|need|want|include)\s+(a\s+)?contact(\s+us)?(\s+form|\s+page)?/i.test(text)) {
    bp.contactForm = true;
    return bp;
  }
  if ((m = text.match(/([^\s,;:<>]+@[^\s,;:<>]+\.[a-z]{2,})/i)) && /(email|send|notify|mail|alert)/i.test(text)) {
    bp.notifyEmail = m[1];
    return bp;
  }
  if ((m = text.match(/(?:show|display|use|make)\s+(?:the\s+)?(.+?)\s+(?:as|in)\s+(?:a\s+)?(cards?|table|gallery|calendar|board|kanban)(?:\s+view|\s+layout)?$/i))) {
    const model = findModel(bp, m[1]);
    if (!model) return null;
    const want = m[2].toLowerCase().replace(/s$/, "").replace("kanban", "board").replace("card", "cards");
    if (!LAYOUTS.includes(want)) return null;
    model.layout = want;
    return bp;
  }
  if ((m = text.match(/(?:add|create|new)\s+(?:a |an )?(.+?)\s+(?:page|section)$/i))) {
    const label = m[1].trim();
    bp.models.push({
      name: pascal(singular(label)),
      label: label[0].toUpperCase() + label.slice(1),
      icon: "📄",
      public: { list: true, create: false },
      fields: [
        { name: "name", type: "text", required: true },
        { name: "description", type: "textarea" },
      ],
    });
    return bp;
  }
  return null;
}

/** Human-readable list of what changed between two (normalised) plans. */
function describeChanges(a, b) {
  const out = [];
  if (a.name !== b.name) out.push(`Renamed the site to "${b.name}"`);
  if (a.theme.primary !== b.theme.primary) out.push(`Main colour → ${b.theme.primary}`);
  if (a.theme.accent !== b.theme.accent) out.push(`Accent colour → ${b.theme.accent}`);
  if (a.theme.mode !== b.theme.mode) out.push(`${b.theme.mode === "dark" ? "Dark" : "Light"} mode`);
  if (a.theme.font !== b.theme.font) out.push(`Font → ${b.theme.font}`);
  if (a.hero.title !== b.hero.title) out.push(`Heading → "${b.hero.title}"`);
  if (a.notifyEmail !== b.notifyEmail) out.push(b.notifyEmail ? `Form submissions will be emailed to ${b.notifyEmail}` : "Turned off email alerts");
  if (a.contactForm !== b.contactForm) out.push(b.contactForm ? "Added a Contact us form" : "Removed the Contact us form");
  if (a.auth !== b.auth) out.push(b.auth ? "Turned on login" : "Turned off login");
  for (const m of b.models) {
    const old = a.models.find((x) => x.name === m.name);
    if (!old) {
      if (!m.autoContact) out.push(`New page: ${m.label}`);
      continue;
    }
    if (old.label !== m.label) out.push(`Renamed page "${old.label}" → "${m.label}"`);
    if (old.layout !== m.layout) out.push(`${m.label}: shown as ${m.layout}`);
    const added = m.fields.filter((f) => !old.fields.some((x) => x.name === f.name));
    const removed = old.fields.filter((f) => !m.fields.some((x) => x.name === f.name));
    if (added.length) out.push(`${m.label}: added ${added.map((f) => `"${f.label}" (${f.type})`).join(", ")}`);
    if (removed.length) out.push(`${m.label}: removed ${removed.map((f) => `"${f.label}"`).join(", ")}`);
    const retyped = m.fields.filter((f) => old.fields.some((x) => x.name === f.name && x.type !== f.type));
    if (retyped.length) out.push(`${m.label}: ${retyped.map((f) => `"${f.label}" is now ${f.type}`).join(", ")}`);
  }
  for (const m of a.models) if (!b.models.some((x) => x.name === m.name) && !m.autoContact) out.push(`Removed page: ${m.label}`);
  if (!out.length && JSON.stringify(a) !== JSON.stringify(b)) out.push("Updated text and settings");
  return out;
}

const SYSTEM = "You edit JSON blueprints of web apps. You answer with the complete updated JSON object only.";

async function editPlan(blueprint, instruction, { apiKey, onProgress } = {}) {
  const current = normalizeBlueprint(blueprint);
  const { sampleData, ...withoutSamples } = current;

  let aiError = null;
  try {
    const { value } = await ask({
      label: "Updating the plan",
      system: SYSTEM,
      user: `Here is a web app plan as JSON:
${JSON.stringify(withoutSamples)}

Change it as the user asks: "${instruction}"

Rules:
- Return the COMPLETE updated plan as JSON (same structure, every model and field), without "sampleData".
- Only change what the user asked for. Keep model "name" values the same unless asked to rename them.
- Field types: text, textarea, number, price, boolean, date, time, select (with "options"), email, phone, url, image, relation (with "model").
- Layouts: cards, table, gallery, calendar, board. "notifyEmail" is where form submissions are emailed. "contactForm": true adds a Contact us form.`,
      apiKey,
      json: true,
      maxTokens: 3500,
      onProgress,
      accept: (text) => {
        const next = normalizeBlueprint({ ...parseJson(text), sampleData });
        if (JSON.stringify(next) === JSON.stringify(current)) throw new Error("nothing changed");
        if (next.models.filter((m) => !m.autoContact).length < current.models.filter((m) => !m.autoContact).length - 1) {
          throw new Error("too many pages were removed");
        }
        return next;
      },
    });
    return { blueprint: value, changes: describeChanges(current, value), source: "ai" };
  } catch (err) {
    aiError = err;
  }

  const ruled = applyRules(current, instruction);
  if (ruled) {
    const next = normalizeBlueprint(ruled);
    return { blueprint: next, changes: describeChanges(current, next), source: "rules" };
  }

  const e = new Error(
    "I couldn't make that change automatically. Try a simple command like: \"add a delivery address field to orders\", " +
      "\"make the colour green\", \"dark mode\", \"add a contact form\", \"send messages to me@gmail.com\" or \"show bookings as a calendar\". " +
      "You can also edit the plan below directly."
  );
  e.details = aiError?.message || null;
  throw e;
}

module.exports = { editPlan, applyRules, describeChanges };
