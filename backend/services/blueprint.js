/**
 * Blueprint = a small JSON description of an app (name, theme, pages, data
 * models, sample data). The AI only ever writes this; the code generator
 * turns it into the actual project. A blueprint is short enough for free
 * models and can be repaired when it's slightly wrong — code can't.
 */
const { ask, parseJson } = require("./ai");
const { findPreset } = require("./presets");

const FIELD_TYPES = ["text", "textarea", "number", "price", "boolean", "date", "time", "select", "email", "phone", "url", "image", "relation"];
const LAYOUTS = ["cards", "table", "gallery", "calendar", "board"];
const TYPE_ALIASES = {
  string: "text", str: "text", varchar: "text", name: "text", title: "text",
  longtext: "textarea", paragraph: "textarea", description: "textarea", richtext: "textarea", content: "textarea", markdown: "textarea",
  int: "number", integer: "number", float: "number", decimal: "number", double: "number", rating: "number", quantity: "number",
  money: "price", currency: "price", amount: "price", cost: "price",
  bool: "boolean", checkbox: "boolean", toggle: "boolean", yesno: "boolean",
  datetime: "date", timestamp: "date", day: "date",
  enum: "select", choice: "select", dropdown: "select", options: "select", category: "select", status: "select",
  mail: "email", tel: "phone", telephone: "phone", mobile: "phone",
  relation: "relation", ref: "relation", reference: "relation", foreignkey: "relation", belongsto: "relation", lookup: "relation", objectid: "relation",
  link: "url", website: "url", photo: "image", picture: "image", img: "image", imageurl: "image", avatar: "image", thumbnail: "image",
};
const RESERVED_FIELDS = new Set(["_id", "id", "__v", "user", "userid", "owner", "createdat", "updatedat", "password"]);
const SYSTEM_FIELDS = new Set(["reference", "accesskey", "customerid", "customeremail", "amount", "paymentstatus", "paymentref", "paymentclaimedat", "paidat"]);
const RESERVED_MODELS = new Set(["user", "users", "account", "auth", "session", "admin"]);

// ------------------------------------------------------------- helpers

const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
/** First emoji/character, without cutting multi-part emoji like 🧑‍🏫 in half. */
const icon = (v, fallback) => {
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  const first = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)][0]?.segment;
  return first && !/^[A-Za-z0-9]$/.test(first) ? first : fallback;
};

function words(s) {
  return String(s || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}
const pascal = (s) => words(s).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("");
const camel = (s) => {
  const p = pascal(s);
  return p ? p[0].toLowerCase() + p.slice(1) : "";
};
const human = (s) => {
  const w = words(s).join(" ").toLowerCase();
  return w ? w[0].toUpperCase() + w.slice(1) : "";
};

function plural(word) {
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + "ies";
  if (/(s|x|z|ch|sh)$/i.test(word)) return word + "es";
  return word + "s";
}
function singular(word) {
  if (/ies$/i.test(word)) return word.slice(0, -3) + "y";
  if (/(ses|xes|zes|ches|shes)$/i.test(word)) return word.slice(0, -2);
  if (/[^s]s$/i.test(word)) return word.slice(0, -1);
  return word;
}

const hex = (v, fallback) => (/^#[0-9a-f]{6}$/i.test(String(v || "").trim()) ? String(v).trim() : /^#[0-9a-f]{3}$/i.test(String(v || "").trim()) ? "#" + String(v).trim().slice(1).split("").map((c) => c + c).join("") : fallback);

function guessType(name, type) {
  const t = String(type || "").toLowerCase().replace(/[^a-z]/g, "");
  if (FIELD_TYPES.includes(t)) return t;
  if (TYPE_ALIASES[t]) return TYPE_ALIASES[t];
  const n = String(name).toLowerCase();
  if (/price|cost|amount|fee|salary|budget/.test(n)) return "price";
  if (/email/.test(n)) return "email";
  if (/phone|mobile|contact number/.test(n)) return "phone";
  if (/image|photo|picture|avatar|thumbnail|cover/.test(n)) return "image";
  if (/url|website|link/.test(n)) return "url";
  if (/date|deadline|birthday|^due/.test(n)) return "date";
  if (/time$|^time|slot/.test(n)) return "time";
  if (/description|content|body|notes?|bio|message|details|summary|address/.test(n)) return "textarea";
  if (/^(is|has)[A-Z]|available|active|done|completed|featured|vegetarian|published|paid/.test(name)) return "boolean";
  if (/count|qty|quantity|stock|age|guests|people|rating|year|number|size|capacity|duration|calories/.test(n)) return "number";
  return "text";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,64}$/;
const QR_RE = /^(data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s"'<>]+)$/;

/** "98765 43210" -> "+919876543210" (Indian numbers), "+44 7700…" kept. "" if not a phone. */
function normalizePhone(v) {
  const s = String(v || "").replace(/[\s\-().]/g, "");
  if (/^[6-9]\d{9}$/.test(s)) return `+91${s}`;
  if (/^0[6-9]\d{9}$/.test(s)) return `+91${s.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(s)) return `+${s}`;
  if (/^\+\d{8,15}$/.test(s)) return s;
  if (/^00\d{8,15}$/.test(s)) return `+${s.slice(2)}`;
  return "";
}

const QTY_RE = /quantity|qty|tickets?|seats?|units|count|people|persons|travell?ers|participants|plates|boxes|kg|pieces|copies|members|^hours$|^nights$/i;
const START_RE = /start|from|check.?in|pickup|pick.?up|arrival|begin|move.?in/i;
const END_RE = /end|^to$|until|check.?out|return|drop|departure|move.?out/i;

/**
 * How a form's payment amount is calculated (always on the server):
 *   link  — price of the chosen item (e.g. Room) × quantity × days (if it has start/end dates)
 *   field — the form's own price field (e.g. a donation amount the visitor types)
 *   fixed — a set amount (e.g. ₹500 consultation fee)
 */
function pricingFor(m, models, raw) {
  const link = m.fields.find((f) => f.type === "relation" && models.find((t) => t.name === f.model)?.priceField);
  const own = m.fields.find((f) => f.type === "price");
  const fixed = Math.max(0, Math.round(Number(raw.fixed ?? raw.amount ?? 0) * 100) / 100) || 0;
  let from = ["link", "field", "fixed"].includes(raw.from) ? raw.from : link ? "link" : own ? "field" : "fixed";
  if (from === "link" && !link) from = own ? "field" : "fixed";
  if (from === "field" && !own) from = link ? "link" : "fixed";

  const dates = m.fields.filter((f) => f.type === "date");
  const start = dates.find((f) => START_RE.test(f.name));
  const end = dates.find((f) => f !== start && END_RE.test(f.name));
  const qty = m.fields.find((f) => f.type === "number" && QTY_RE.test(f.name));

  const out = { enabled: false, from };
  if (from === "link") {
    const target = models.find((t) => t.name === link.model);
    Object.assign(out, { link: link.name, quantity: qty?.name || null, start: start && end ? start.name : null, end: start && end ? end.name : null });
    out.label = `Price of the chosen ${target.singular.toLowerCase()}${qty ? ` × ${qty.label.toLowerCase()}` : ""}${start && end ? " × days" : ""}`;
  } else if (from === "field") {
    Object.assign(out, { field: own.name });
    out.label = `The ${own.label.toLowerCase()} the customer enters`;
  } else {
    Object.assign(out, { fixed });
    out.label = fixed ? `A fixed amount of ${fixed}` : "Set a fixed amount to collect payments";
  }
  if (from === "fixed") out.fixed = fixed;
  // Enquiries, messages and applications don't take money unless asked to.
  const enquiry = /enquir|inquir|message|contact|applica|apply|feedback|review|question|request|lead|quote|volunteer/i.test(`${m.name} ${m.label}`);
  const possible = from !== "fixed" || fixed > 0;
  out.enabled = raw.enabled !== undefined ? Boolean(raw.enabled) && possible : possible && !enquiry;
  return out;
}
const CONTACT_MODEL = {
  name: "ContactMessage",
  label: "Contact us",
  singular: "Message",
  icon: "✉️",
  autoContact: true,
  public: { list: false, create: true },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "email", type: "email", required: true },
    { name: "phone", type: "phone" },
    { name: "message", type: "textarea", required: true },
  ],
};

// ------------------------------------------------------------- normalize

function normalizeField(raw, used) {
  if (!raw) return null;
  if (typeof raw === "string") raw = { name: raw };
  let name = camel(raw.name || raw.key || raw.label || "");
  if (!name || RESERVED_FIELDS.has(name.toLowerCase())) return null;
  if (/^\d/.test(name)) name = "f" + name;
  name = name.slice(0, 30);
  if (used.has(name)) return null;
  used.add(name);

  let type = guessType(name, raw.type);
  const target = raw.model || raw.ref || raw.target || raw.to || raw.relation || "";
  if (type === "relation" && !target) type = "text";
  let options = Array.isArray(raw.options) ? raw.options : Array.isArray(raw.enum) ? raw.enum : Array.isArray(raw.values) ? raw.values : [];
  options = [...new Set(options.map((o) => clip(o, 40)).filter(Boolean))].slice(0, 12);
  if (type === "select" && options.length < 2) type = "text";
  if (type !== "select") options = [];

  return {
    name,
    label: clip(raw.label, 40) || human(name),
    type,
    required: Boolean(raw.required),
    ...(options.length ? { options } : {}),
    ...(type === "relation" ? { model: String(target) } : {}),
  };
}

function normalizeModel(raw, auth, usedNames) {
  if (!raw || typeof raw !== "object") return null;
  let name = pascal(singular(raw.name || raw.model || raw.label || ""));
  if (!name || RESERVED_MODELS.has(name.toLowerCase())) return null;
  if (/^\d/.test(name)) name = "M" + name;
  name = name.slice(0, 30);
  if (usedNames.has(name)) return null;
  usedNames.add(name);

  const used = new Set();
  let fields = (Array.isArray(raw.fields) ? raw.fields : Object.entries(raw.fields || {}).map(([k, v]) => (typeof v === "string" ? { name: k, type: v } : { name: k, ...v })))
    .map((f) => normalizeField(f, used))
    .filter(Boolean)
    .slice(0, 12);
  if (!fields.length) fields = [{ name: "name", label: "Name", type: "text", required: true }];

  // Display hints
  // The title is shown on every card, so it must be readable text (never a link).
  const titled = (f) => f && f.type !== "relation" && !(f.model && f.type === "relation");
  if (!fields.some((f) => titled(f) && !f.model && ["text", "textarea", "email", "phone", "select"].includes(f.type))) {
    fields.unshift({ name: used.has("name") ? "title" : "name", label: "Name", type: "text", required: true });
  }
  const plainFields = fields.filter((f) => !f.model);
  const textFields = plainFields.filter((f) => ["text", "email", "phone"].includes(f.type));
  const pick = (want) => {
    const f = want && plainFields.find((x) => x.name === camel(want));
    return f ? f.name : null;
  };
  const titleField = pick(raw.titleField) || (plainFields.find((f) => /^(name|title|fullName|subject)$/.test(f.name) && f.type !== "select") || textFields[0] || plainFields[0]).name;
  if (!fields.find((f) => f.name === titleField).required) fields.find((f) => f.name === titleField).required = true;

  const pub = raw.public || raw.access || {};
  const publicList = auth ? (Array.isArray(pub) ? pub.includes("list") || pub.includes("read") : pub.list ?? pub.read ?? !raw.ownedByUser) : true;
  const publicCreate = auth ? (Array.isArray(pub) ? pub.includes("create") : Boolean(pub.create)) : true;
  const ownedByUser = auth && Boolean(raw.ownedByUser || raw.private || raw.perUser);

  // Submitted forms get system fields (reference, amount, paymentStatus…);
  // a form field with the same name is renamed so they don't clash.
  if (!ownedByUser && publicCreate && auth) {
    for (const f of fields) {
      if (SYSTEM_FIELDS.has(f.name.toLowerCase())) {
        let n = `form${f.name[0].toUpperCase()}${f.name.slice(1)}`;
        while (used.has(n)) n += "2";
        used.add(n);
        f.name = n;
      }
    }
  }
  const labelPlural = clip(raw.label || raw.title, 40) || human(plural(name));
  const hasImage = fields.some((f) => f.type === "image");
  const hasDate = fields.some((f) => f.type === "date");
  const hasSelect = fields.some((f) => f.type === "select");
  const layoutOk = (l) => l === "cards" || l === "table" || (l === "gallery" && hasImage) || (l === "calendar" && hasDate) || (l === "board" && hasSelect);
  const statusLike = fields.some((f) => f.type === "select" && /status|stage|state|progress/i.test(f.name));
  const layout = layoutOk(raw.layout)
    ? raw.layout
    : ownedByUser && statusLike
      ? "board"
      : !publicList && !ownedByUser
        ? "table"
        : "cards";
  return {
    name,
    key: camel(plural(name)),
    label: labelPlural,
    singular: clip(raw.singular, 40) || human(name),
    icon: icon(raw.icon, "📄"),
    description: clip(raw.description, 160),
    ownedByUser,
    public: { list: ownedByUser ? false : Boolean(publicList), create: ownedByUser ? false : Boolean(publicCreate) },
    // Catalogues (menu, products) keep their order; submissions and private
    // records show the newest first.
    newestFirst: ownedByUser || !publicList,
    layout,
    // Email the owner when a visitor submits one of these.
    notify: !ownedByUser && Boolean(publicCreate) && raw.notify !== false,
    ...(raw.autoContact ? { autoContact: true } : {}),
    // Forms visitors submit (orders, bookings, enquiries) are tracked with a
    // reference number, the customer's account and (optionally) a payment.
    submission: !ownedByUser && Boolean(publicCreate) && auth,
    _pay: raw.payment ?? raw.payments ?? (raw.fixedAmount ? { fixed: raw.fixedAmount } : null),
    showOnHome: raw.showOnHome !== undefined ? Boolean(raw.showOnHome) : Boolean(publicList && !ownedByUser),
    fields,
    titleField,
    subtitleField: pick(raw.subtitleField) || (fields.find((f) => f.type === "select" && f.name !== titleField) || {}).name || null,
    imageField: (fields.find((f) => f.type === "image") || {}).name || null,
    priceField: (fields.find((f) => f.type === "price") || {}).name || null,
  };
}

function sampleValue(field, i) {
  switch (field.type) {
    case "number": return [3, 5, 8, 12][i % 4];
    case "price": return [199, 349, 499, 799][i % 4];
    case "boolean": return i % 2 === 0;
    case "date": return new Date(Date.now() + (i + 2) * 86400000).toISOString().slice(0, 10);
    case "time": return ["10:00", "13:30", "18:00", "20:15"][i % 4];
    case "select": return field.options[i % field.options.length];
    case "email": return `person${i + 1}@example.com`;
    case "phone": return `+91 98765 4321${i}`;
    case "url": return "https://example.com";
    case "image": return "";
    case "textarea": return `A short description for item ${i + 1}.`;
    case "relation": return "";
    default: return `${field.label} ${i + 1}`;
  }
}

// Photos uploaded in the builder are kept in the plan as small data URLs.
const IMAGE_DATA_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_CHARS = 400000; // ~300 KB

function normalizeRecord(model, raw, i, own = false) {
  const out = {};
  for (const f of model.fields) {
    let v = raw ? raw[f.name] ?? raw[Object.keys(raw).find((k) => camel(k) === f.name)] : undefined;
    if (v === undefined || v === null || v === "") {
      if (f.required || !raw) v = sampleValue(f, i);
      else continue;
    }
    if (f.type === "number" || f.type === "price") v = Number(String(v).replace(/[^0-9.-]/g, "")) || sampleValue(f, i);
    else if (f.type === "boolean") v = v === true || v === "true" || v === "yes" || v === 1;
    else if (f.type === "select") v = f.options.includes(String(v)) ? String(v) : f.options.find((o) => o.toLowerCase() === String(v).toLowerCase()) || f.options[0];
    else if (f.type === "date") v = /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : sampleValue(f, i);
    else if (f.type === "relation") v = clip(v, 120); // a title of the linked item; resolved to an id when seeding
    else if (f.type === "image" && IMAGE_DATA_RE.test(String(v)) && String(v).length <= MAX_IMAGE_CHARS) v = String(v);
    else if (f.type === "image" || f.type === "url") v = /^https:\/\/[^\s"'<>]+$/.test(String(v)) ? String(v) : f.type === "url" ? "https://example.com" : "";
    else v = clip(v, f.type === "textarea" ? (own ? 2000 : 400) : 120);
    if (v !== "") out[f.name] = v;
  }
  return out;
}

/** Turn whatever the AI (or a user edit) produced into a valid blueprint. */
function normalizeBlueprint(raw, prompt = "") {
  if (!raw || typeof raw !== "object") throw new Error("blueprint is not an object");
  const bp = raw.blueprint && typeof raw.blueprint === "object" ? raw.blueprint : raw;

  const auth = bp.auth === undefined ? true : Boolean(bp.auth?.enabled ?? bp.auth);
  const usedNames = new Set();
  let rawModels = Array.isArray(bp.models) ? bp.models : Array.isArray(bp.entities) ? bp.entities : Array.isArray(bp.resources) ? bp.resources : [];

  // "Contact us" form: added or removed by the contactForm switch.
  const contactForm = bp.contactForm === true;
  rawModels = rawModels.filter((m) => !(m && m.autoContact) || contactForm);
  const hasForm = rawModels.some((m) => m && m.autoContact);
  if (contactForm && !hasForm && rawModels.length < 6) {
    rawModels = [...rawModels, CONTACT_MODEL];
  }

  const models = rawModels
    .map((m) => normalizeModel(m, auth, usedNames))
    .filter(Boolean)
    .slice(0, 6);
  if (!models.length) throw new Error("the blueprint has no data models");

  // Linked fields must point at another model in this plan that the people
  // filling in the form are allowed to see; otherwise they become plain text.
  for (const m of models) {
    for (const f of m.fields) {
      if (f.type !== "relation") continue;
      const want = pascal(singular(String(f.model || "")));
      const target = models.find((t) => t.name === want || t.key.toLowerCase() === String(f.model).toLowerCase() || t.label.toLowerCase() === String(f.model).toLowerCase());
      const visible = target && target !== m && (target.public.list || (m.ownedByUser && target.ownedByUser) || (!m.public.create && !m.ownedByUser));
      if (visible) f.model = target.name;
      else {
        f.type = "text";
        delete f.model;
      }
    }
  }

  const name = clip(bp.name || bp.appName || bp.title, 40) || clip(prompt, 40) || "My App";
  const theme = bp.theme || {};
  const hero = bp.hero || {};
  const features = (Array.isArray(bp.features) ? bp.features : [])
    .map((f) => (typeof f === "string" ? { title: f } : f))
    .filter((f) => f && (f.title || f.name))
    .slice(0, 6)
    .map((f) => ({ icon: icon(f.icon, "✨"), title: clip(f.title || f.name, 50), text: clip(f.text || f.description, 160) }));

  // The items each page starts with. Once the owner edits them in the builder
  // ("Your content"), they're theirs: up to 60 per page, photos allowed, and an
  // empty list stays empty.
  const sampleIn = bp.sampleData || bp.samples || bp.seed || {};
  const contentEdited = Array.isArray(bp.contentEdited) ? bp.contentEdited.filter((n) => models.some((m) => m.name === n)) : [];
  const sampleData = {};
  for (const m of models) {
    const own = contentEdited.includes(m.name);
    const rows = sampleIn[m.name] || sampleIn[m.key] || sampleIn[m.label] || sampleIn[Object.keys(sampleIn).find((k) => pascal(singular(k)) === m.name)] || [];
    const list = (Array.isArray(rows) ? rows : []).slice(0, own ? 60 : 8).map((r, i) => normalizeRecord(m, r, i, own));
    sampleData[m.name] = list.length || own ? list : m.ownedByUser || m.autoContact ? [] : [0, 1, 2].map((i) => normalizeRecord(m, null, i));
  }
  // Point sample links at real sample items (by title).
  for (const m of models) {
    for (const f of m.fields.filter((x) => x.type === "relation")) {
      const target = models.find((t) => t.name === f.model);
      const titles = (sampleData[target.name] || []).map((r) => String(r[target.titleField] ?? "")).filter(Boolean);
      sampleData[m.name].forEach((row, i) => {
        if (!titles.length) delete row[f.name];
        else if (!titles.includes(row[f.name])) row[f.name] = titles[i % titles.length];
      });
    }
    // keep keys in field order (so normalising twice gives the same result)
    sampleData[m.name] = sampleData[m.name].map((row) =>
      Object.fromEntries(m.fields.filter((f) => row[f.name] !== undefined).map((f) => [f.name, row[f.name]]))
    );
  }

  // ---- payments: how each form's amount is worked out (on the server)
  for (const m of models) {
    const raw = m._pay && typeof m._pay === "object" ? m._pay : m._pay === true ? { enabled: true } : m._pay === false ? { enabled: false } : {};
    delete m._pay;
    m.payment = m.submission && !m.public.list ? pricingFor(m, models, raw) : null;
  }
  const requireLogin = auth && (bp.requireLogin === undefined ? true : Boolean(bp.requireLogin));
  // Orders and bookings need an account; the "Contact us" form never does.
  for (const m of models) m.loginRequired = Boolean(m.submission && requireLogin && !m.autoContact);

  const ownerIn = bp.owner && typeof bp.owner === "object" ? bp.owner : {};
  const email = (v) => (EMAIL_RE.test(String(v || "").trim()) ? String(v).trim().slice(0, 120) : "");
  const owner = {
    name: clip(ownerIn.name, 60),
    email: email(ownerIn.email) || email(bp.notifyEmail),
    phone: normalizePhone(ownerIn.phone || ownerIn.mobile || ownerIn.whatsapp),
    upiId: UPI_RE.test(String(ownerIn.upiId || "").trim()) ? String(ownerIn.upiId).trim() : "",
    payeeName: clip(ownerIn.payeeName, 50),
    qrImage: QR_RE.test(String(ownerIn.qrImage || "")) && String(ownerIn.qrImage).length < 600000 ? String(ownerIn.qrImage) : "",
    // How the site sends email — the owner decides:
    //   platform: through the builder's sender (nothing to set up)
    //   brevo:    the owner's own Brevo account (key kept private by the builder)
    //   gmail:    the owner's own Gmail + App Password (not on Render's free plan)
    emailMode: ["platform", "brevo", "gmail"].includes(ownerIn.emailMode) ? ownerIn.emailMode : "platform",
    senderEmail: email(ownerIn.senderEmail),
    senderName: clip(ownerIn.senderName, 60),
    emailsOff: Boolean(ownerIn.emailsOff),
  };

  const contact = bp.contact && typeof bp.contact === "object" ? bp.contact : {};
  return {
    version: 1,
    name,
    tagline: clip(bp.tagline, 90) || clip(hero.subtitle, 90) || "",
    description: clip(bp.description, 300) || clip(prompt, 300),
    theme: {
      primary: hex(theme.primary || theme.primaryColor, "#4f46e5"),
      accent: hex(theme.accent || theme.secondary || theme.accentColor, "#f59e0b"),
      mode: theme.mode === "light" ? "light" : theme.mode === "dark" || theme.dark === true ? "dark" : "crystal",
      font: ["sans", "serif", "rounded", "mono"].includes(theme.font) ? theme.font : "sans",
    },
    hero: {
      title: clip(hero.title || hero.heading, 80) || name,
      subtitle: clip(hero.subtitle || hero.text || bp.tagline, 200) || "",
      cta: clip(hero.cta || hero.button, 30) || `View ${models[0].label}`,
    },
    features,
    about: clip(bp.about, 500),
    contact: {
      email: clip(contact.email, 80),
      phone: clip(contact.phone, 40),
      address: clip(contact.address, 160),
    },
    currency: clip(bp.currency, 3) || "₹",
    // Where visitor submissions (bookings, orders, messages) are emailed.
    notifyEmail: email(bp.notifyEmail) || owner.email,
    // The site owner: gets email + WhatsApp alerts, receives UPI payments, is the admin.
    owner,
    acceptPayments: Boolean(bp.acceptPayments ?? bp.payments?.enabled) && auth,
    // Customers must create an account (with a customer ID) before ordering/booking.
    // On by default: customers register (and confirm their email) before ordering.
    requireLogin,
    contactForm: models.some((m) => m.autoContact),
    auth,
    models,
    sampleData,
    contentEdited,
  };
}

// ------------------------------------------------------------- AI prompt

const SYSTEM = "You design web apps as compact JSON blueprints. You answer with one JSON object only.";

function plannerPrompt(prompt) {
  return `Design a full-stack web app for: "${prompt}"

Answer with ONE JSON object in exactly this shape (example values shown for a restaurant):
{
  "name": "Spice Garden",
  "tagline": "Authentic Indian food in the heart of the city",
  "theme": { "primary": "#b91c1c", "accent": "#f59e0b", "mode": "crystal", "font": "serif" },   // mode: crystal (black glass, the default), dark, or light only if the user asks for a light/white site
  "hero": { "title": "Taste the tradition", "subtitle": "Fresh dishes cooked every day", "cta": "See the menu" },
  "features": [ { "icon": "🍛", "title": "Fresh food", "text": "Cooked daily with local ingredients" } ],
  "auth": true,
  "models": [
    { "name": "MenuItem", "label": "Menu", "icon": "🍽️", "public": { "list": true, "create": false },
      "fields": [
        { "name": "name", "type": "text", "required": true },
        { "name": "price", "type": "price", "required": true },
        { "name": "category", "type": "select", "options": ["Starter", "Main", "Dessert"] },
        { "name": "vegetarian", "type": "boolean" },
        { "name": "description", "type": "textarea" }
      ] },
    { "name": "Reservation", "label": "Book a table", "icon": "📅", "public": { "list": false, "create": true }, "layout": "table",
      "fields": [ { "name": "name", "type": "text", "required": true }, { "name": "phone", "type": "phone", "required": true },
                  { "name": "date", "type": "date", "required": true }, { "name": "guests", "type": "number" } ] }
  ],
  "sampleData": { "MenuItem": [ { "name": "Paneer Tikka", "price": 249, "category": "Starter", "vegetarian": true, "description": "..." } ] },
  "contact": { "email": "hello@example.com", "phone": "+91 98765 43210", "address": "..." }
}

Rules:
- 1 to 4 models for THIS app (not a restaurant unless asked). Each model: 3 to 8 fields.
- Field types: text, textarea, number, price, boolean, date, time, select (with "options"), email, phone, url, image,
  and relation (link to another model, e.g. { "name": "room", "type": "relation", "model": "Room" }).
- For forms customers pay for (orders, bookings, enrollments, tickets) add "payment": {"enabled": true}.
  The amount is the price of a linked item (add a relation field to it, plus a quantity number field) or "payment": {"fixed": 500}.
- Optional "layout" per model: cards, table, gallery (needs an image field), calendar (needs a date field), board (needs a select field like status).
- "public.list": visitors can see the list. "public.create": visitors can submit (bookings, orders, contact forms, signups).
- "ownedByUser": true for private per-user data (todos, expenses, notes). Then visitors can't see it.
- 3 features, realistic names and text, 3 sampleData items for each public model.
- No code. JSON only. Keep it under 90 lines.`;
}

/**
 * prompt -> { blueprint, source: "ai" | "preset" | "generic", warning? }
 */
async function planApp(prompt, { apiKey, onProgress } = {}) {
  try {
    const { value, model } = await ask({
      label: "Planning the app",
      system: SYSTEM,
      user: plannerPrompt(prompt),
      apiKey,
      json: true,
      maxTokens: 2500,
      onProgress,
      accept: (text) => {
        const bp = normalizeBlueprint(parseJson(text), prompt);
        const totalFields = bp.models.reduce((n, m) => n + m.fields.length, 0);
        if (totalFields < 3) throw new Error("the models have almost no fields");
        return bp;
      },
    });
    return { blueprint: value, source: "ai", model };
  } catch (error) {
    console.log("[blueprint] AI planning failed, using a built-in plan:", error.message);
    const preset = findPreset(prompt);
    const bp = normalizeBlueprint(preset.blueprint, prompt);
    return {
      blueprint: bp,
      source: preset.generic ? "generic" : "preset",
      warning: preset.generic
        ? "The AI couldn't plan this app, so a simple starter plan was used. Edit the plan below (models and fields), then build."
        : `The AI couldn't plan this app, so the built-in "${preset.title}" plan was used. You can edit it below.`,
      reason: error.message,
    };
  }
}

module.exports = { planApp, normalizeBlueprint, FIELD_TYPES, pascal, camel, plural, singular, human };
