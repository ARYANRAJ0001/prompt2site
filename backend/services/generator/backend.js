/**
 * Blueprint -> generated Express + MongoDB backend (a map of path -> file text).
 *
 * Everything that comes from the blueprint (names, labels, sample data) is
 * inserted with JSON.stringify, so AI-written text can never break or inject
 * code. Identifiers (model and field names) were already reduced to letters
 * and digits by the blueprint normaliser.
 */
const J = (v) => JSON.stringify(v, null, 2);
const fs = require("fs");
const path = require("path");
const { LINKS_JS, uploadRoute, statsRoute, siteConfig, seedFile } = require("./backendExtras");

// Shared backend code (auth, payments, alerts, CRUD) lives as plain files in templates/backend.
const BACKEND_TEMPLATES = path.join(__dirname, "..", "..", "templates", "backend");
function backendTemplates(dir = BACKEND_TEMPLATES, out = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) backendTemplates(full, out);
    else out[`backend/${path.relative(BACKEND_TEMPLATES, full).split(path.sep).join("/")}`] = fs.readFileSync(full, "utf8");
  }
  return out;
}

const mongooseType = (field) => {
  if (field.type === "number" || field.type === "price") return "Number";
  if (field.type === "boolean") return "Boolean";
  return "String";
};

function accessFor(model, auth) {
  if (!auth) return { list: "public", create: "public", manage: "public" };
  if (model.ownedByUser) return { list: "user", create: "user", manage: "user" };
  return { list: model.public.list ? "public" : "admin", create: model.public.create ? "public" : "admin", manage: "admin" };
}

const PREFIXES = { Order: "ORD", Booking: "BKG", Reservation: "RES", Appointment: "APT", Message: "MSG", ContactMessage: "MSG", Enquiry: "ENQ", Enrollment: "ENR", Registration: "REG", Application: "APL", Donation: "DON", Ticket: "TKT", Subscription: "SUB", Admission: "ADM", Request: "REQ", Slot: "SLT" };
function refPrefix(model) {
  if (PREFIXES[model.name]) return PREFIXES[model.name];
  const end = Object.keys(PREFIXES).find((k) => model.name.endsWith(k));
  if (end) return PREFIXES[end];
  return (model.name.replace(/[^A-Z]/gi, "").toUpperCase() + "XXX").slice(0, 3);
}

function modelFile(model, auth) {
  const schemaLines = model.fields.map((f) => {
    const parts = [`type: ${mongooseType(f)}`];
    if (f.required) parts.push("required: true");
    if (mongooseType(f) === "String") parts.push("trim: true");
    if (f.type === "select") parts.push(`enum: ${JSON.stringify(f.options)}`);
    if (f.type === "boolean") parts.push("default: false");
    return `    ${f.name}: { ${parts.join(", ")} },`;
  });
  if (model.ownedByUser) schemaLines.push("    user: { type: String, required: true, index: true },");
  if (model.submission) {
    schemaLines.push(
      "    // added by the server, not the form:",
      "    reference: { type: String, index: true },",
      "    accessKey: { type: String },",
      "    userId: { type: String, index: true },",
      "    customerId: { type: String },",
      "    customerEmail: { type: String },"
    );
    if (model.payment?.enabled) {
      schemaLines.push(
        "    amount: { type: Number, default: 0 },",
        "    receiptLines: { type: Array, default: [] }, // the bill, saved when ordered",
        '    paymentStatus: { type: String, enum: ["none", "unpaid", "verifying", "paid"], default: "none" },',
        "    paymentRef: { type: String },",
        "    paymentClaimedAt: { type: String },",
        "    paidAt: { type: String },"
      );
    }
  }

  return `const mongoose = require("mongoose");

/**
 * ${model.singular} (${model.label})
 * Field definitions are also used for request validation (lib/validate.js)
 * and by the in-memory database when MongoDB isn't configured.
 */
const fields = ${J(model.fields)};

const schema = new mongoose.Schema(
  {
${schemaLines.join("\n")}
  },
  { timestamps: true }
);

module.exports = {
  name: ${J(model.name)},
  key: ${J(model.key)},
  label: ${J(model.label)},
  singular: ${J(model.singular)},
  titleField: ${J(model.titleField)},
  priceField: ${J(model.priceField)},
  // Who may view the list / add new ones / edit & delete: "public", "user" (own only) or "admin"
  access: ${J(accessFor(model, auth))},
  // A form visitors submit: gets a reference like ${refPrefix(model)}-7K2Q9X, alerts and tracking
  submission: ${Boolean(model.submission)},
  // must the visitor be logged in to submit? (the contact form never needs it)
  loginRequired: ${Boolean(model.submission && model.loginRequired)},
  prefix: ${J(refPrefix(model))},
  notify: ${Boolean(model.notify)},
  // How the payment amount is worked out (null = no payment)
  payment: ${J(model.payment?.enabled ? model.payment : null)},
  fields,
  searchFields: ${J(model.fields.filter((f) => ["text", "textarea", "select", "email", "phone"].includes(f.type)).map((f) => f.name))},
  ownedByUser: ${model.ownedByUser},
  newestFirst: ${Boolean(model.newestFirst)},
  Model: mongoose.models[${J(model.name)}] || mongoose.model(${J(model.name)}, schema),
};
`;
}

function routeFile(model) {
  return `/**
 * API for ${model.label}: /api/${model.key}
 * All the rules (who can see, add and edit; reference numbers; payments;
 * email and WhatsApp alerts) are in lib/crud.js and models/${model.name}.js.
 */
module.exports = require("../lib/crud")(require("../models/${model.name}"));
`;
}

const STORE_JS = `const crypto = require("crypto");
const mongoose = require("mongoose");
const { usingMongo } = require("../config/db");

/**
 * One data API for both MongoDB and the built-in in-memory database
 * (used when MONGO_URI isn't set — data then resets on restart).
 */
const memory = new Map();
const table = (name) => {
  if (!memory.has(name)) memory.set(name, []);
  return memory.get(name);
};
const newId = () => crypto.randomBytes(12).toString("hex");
const escapeRegex = (s) => String(s).replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
const matches = (item, filter) => Object.entries(filter).every(([k, v]) => String(item[k]) === String(v));

function createStore(def) {
  const { Model, name, searchFields = [] } = def;

  const searchQuery = (q) =>
    q && searchFields.length
      ? { $or: searchFields.map((f) => ({ [f]: { $regex: escapeRegex(q), $options: "i" } })) }
      : {};

  return {
    async list(filter = {}, { q } = {}) {
      const dir = def.newestFirst ? -1 : 1;
      if (usingMongo()) {
        return Model.find({ ...filter, ...searchQuery(q) }).sort({ createdAt: dir, _id: dir }).limit(500).lean();
      }
      const needle = q ? String(q).toLowerCase() : "";
      const rows = table(name)
        .filter((item) => matches(item, filter))
        .filter((item) => !needle || searchFields.some((f) => String(item[f] ?? "").toLowerCase().includes(needle)));
      return dir === -1 ? rows.slice().reverse() : rows.slice();
    },

    async get(id, filter = {}) {
      if (usingMongo()) {
        if (!mongoose.isValidObjectId(id)) return null;
        return Model.findOne({ _id: id, ...filter }).lean();
      }
      return table(name).find((item) => item._id === id && matches(item, filter)) || null;
    },

    async create(data) {
      if (usingMongo()) return (await Model.create(data)).toObject();
      const now = new Date().toISOString();
      const item = { _id: newId(), ...data, createdAt: now, updatedAt: now };
      table(name).push(item);
      return item;
    },

    async update(id, data, filter = {}) {
      if (usingMongo()) {
        if (!mongoose.isValidObjectId(id)) return null;
        return Model.findOneAndUpdate({ _id: id, ...filter }, data, { new: true, runValidators: true }).lean();
      }
      const item = table(name).find((it) => it._id === id && matches(it, filter));
      if (!item) return null;
      Object.assign(item, data, { updatedAt: new Date().toISOString() });
      return item;
    },

    async remove(id, filter = {}) {
      if (usingMongo()) {
        if (!mongoose.isValidObjectId(id)) return false;
        return Boolean(await Model.findOneAndDelete({ _id: id, ...filter }));
      }
      const rows = table(name);
      const index = rows.findIndex((it) => it._id === id && matches(it, filter));
      if (index === -1) return false;
      rows.splice(index, 1);
      return true;
    },

    async count(filter = {}) {
      if (usingMongo()) return Model.countDocuments(filter);
      return table(name).filter((item) => matches(item, filter)).length;
    },

    async findOne(filter) {
      if (usingMongo()) return Model.findOne(filter).lean();
      return table(name).find((item) => matches(item, filter)) || null;
    },
  };
}

module.exports = { createStore };
`;

const VALIDATE_JS = `/**
 * Checks a request body against a model's field list.
 * Unknown fields are dropped; values are converted to the right type.
 */
const EMAIL = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const URL_RE = /^https?:\\/\\/[^\\s]+$/i;
const DATE = /^\\d{4}-\\d{2}-\\d{2}$/;
const TIME = /^\\d{2}:\\d{2}$/;
const IMAGE_DATA = /^data:image\\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

function validate(fields, body = {}, { partial = false } = {}) {
  const value = {};
  const errors = [];

  for (const field of fields) {
    let v = body[field.name];
    const empty = v === undefined || v === null || v === "";

    if (empty) {
      if (field.type === "boolean" && !partial) value[field.name] = false;
      else if (field.required && !partial) errors.push(\`\${field.label} is required\`);
      else if (partial && body[field.name] !== undefined && !field.required && field.type !== "select") value[field.name] = field.type === "boolean" ? false : "";
      continue;
    }

    switch (field.type) {
      case "number":
      case "price":
        v = Number(v);
        if (!Number.isFinite(v)) errors.push(\`\${field.label} must be a number\`);
        if (field.type === "price" && v < 0) errors.push(\`\${field.label} can't be negative\`);
        break;
      case "boolean":
        v = v === true || v === "true" || v === "on" || v === 1 || v === "1";
        break;
      case "select":
        v = String(v);
        if (!field.options.includes(v)) errors.push(\`\${field.label} must be one of: \${field.options.join(", ")}\`);
        break;
      case "email":
        v = String(v).trim();
        if (!EMAIL.test(v)) errors.push(\`\${field.label} must be a valid email\`);
        break;
      case "url":
        v = String(v).trim();
        if (!URL_RE.test(v)) errors.push(\`\${field.label} must be a link starting with http:// or https://\`);
        break;
      case "image":
        v = String(v).trim();
        if (!URL_RE.test(v) && !IMAGE_DATA.test(v)) errors.push(\`\${field.label} must be an uploaded image or an image link\`);
        else if (v.length > 2500000) errors.push(\`\${field.label} is too large (max about 1.8 MB)\`);
        break;
      case "relation":
        v = String(v).trim();
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(v)) errors.push(\`Please choose a valid \${field.label.toLowerCase()}\`);
        break;
      case "date":
        v = String(v).slice(0, 10);
        if (!DATE.test(v)) errors.push(\`\${field.label} must be a date (YYYY-MM-DD)\`);
        break;
      case "time":
        v = String(v).slice(0, 5);
        if (!TIME.test(v)) errors.push(\`\${field.label} must be a time (HH:MM)\`);
        break;
      default:
        v = String(v).trim().slice(0, field.type === "textarea" ? 5000 : 300);
    }
    value[field.name] = v;
  }

  return { value, errors };
}

module.exports = { validate };
`;

const DB_JS = `const mongoose = require("mongoose");

let mongo = false;

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log("⚠️  MONGO_URI not set: using the in-memory database (data resets on restart).");
    return;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    mongo = true;
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    console.log("⚠️  Falling back to the in-memory database.");
  }
}

module.exports = { connectDB, usingMongo: () => mongo };
`;

function serverFile(bp) {
  const mounts = bp.models.map((m) => `app.use(${J("/api/" + m.key)}, require("./routes/${m.key}"));`).join("\n");
  return `require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB, usingMongo } = require("./config/db");
const { seed } = require("./data/seed");

const app = express();
app.set("trust proxy", 1); // correct visitor IPs behind Render's proxy (for rate limits)

// CORS_ORIGIN can limit which sites may call the API (comma-separated).
const origins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors(origins.length ? { origin: origins } : {}));
app.use(express.json({ limit: "4mb" })); // room for uploaded images

app.get("/", (req, res) => res.json({ name: ${J(bp.name)}, health: "/api/health" }));
app.get("/api/health", (req, res) => res.json({ status: "ok", database: usingMongo() ? "mongodb" : "memory" }));

${bp.auth ? 'app.use("/api/auth", require("./routes/auth"));\n' : ""}app.use("/api/upload", require("./routes/upload"));
app.use("/api/stats", require("./routes/stats"));
${mounts}

app.use((req, res) => res.status(404).json({ message: "Not found" }));
app.use((err, req, res, next) => {
  console.error(err);
  if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
  res.status(500).json({ message: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
${bp.auth ? '  await require("./routes/auth").seedAdmin();\n' : ""}  await seed();
  app.listen(PORT, () => console.log(\`✅ ${bp.name.replace(/[`$\\]/g, "")} API running on port \${PORT}\`));
})();
`;
}

function generateBackend(bp) {
  const files = {
    "backend/package.json": J({
      name: `${slug(bp.name)}-backend`,
      version: "1.0.0",
      private: true,
      main: "server.js",
      scripts: { start: "node server.js", dev: "node --watch server.js" },
      engines: { node: ">=18" },
      dependencies: {
        bcryptjs: "^2.4.3",
        cors: "^2.8.5",
        dotenv: "^16.4.5",
        express: "^4.21.0",
        jsonwebtoken: "^9.0.2",
        mongoose: "^8.7.0",
        nodemailer: "^6.9.15",
      },
    }) + "\n",
    "backend/.env.example": [
      "PORT=5000",
      "# Leave empty to use the in-memory database",
      "MONGO_URI=",
      "JWT_SECRET=change-me-to-a-long-random-string",
      "",
      "# The owner's admin login (created on first start; nobody else can become admin)",
      `ADMIN_EMAIL=${bp.owner?.email || ""}`,
      "ADMIN_PASSWORD=choose-a-strong-password",
      "ADMIN_PASSWORD_SET_AT=1   # change this (any new value) to apply a new ADMIN_PASSWORD on restart",
      "",
      "# WhatsApp alerts (free, CallMeBot): your number + the API key CallMeBot sends you",
      `WHATSAPP_PHONE=${bp.owner?.phone || ""}`,
      "WHATSAPP_APIKEY=",
      "",
      "# Your website's address, for links in emails (e.g. https://my-site.netlify.app)",
      "APP_URL=",
      "",
      "# Email alerts for new bookings/orders/messages (Gmail: your address + an App Password)",
      "# Email on Render's free plan (it blocks SMTP): Brevo's API, free 300/day",
      "BREVO_API_KEY=",
      "EMAIL_FROM=      # a sender email you verified in Brevo",
      "# Or Gmail (works locally / on paid hosting)",
      "SMTP_USER=",
      "SMTP_PASS=",
      `NOTIFY_EMAIL=${bp.notifyEmail || ""}`,
      "# Other providers: SMTP_HOST=smtp.example.com and SMTP_PORT=587",
      "",
      "# Optional: store uploaded images on Cloudinary (cloudinary://KEY:SECRET@CLOUD)",
      "CLOUDINARY_URL=",
      "# Optional: only allow your frontend, e.g. https://my-site.netlify.app",
      "CORS_ORIGIN=",
      "",
    ].join("\n"),
    "backend/server.js": serverFile(bp),
    "backend/config/db.js": DB_JS,
    "backend/lib/store.js": STORE_JS,
    "backend/lib/validate.js": VALIDATE_JS,
    "backend/data/seed.js": seedFile(bp),
    "backend/config/site.js": siteConfig(bp),
    "backend/lib/links.js": LINKS_JS,
    ...backendTemplates(),
    "backend/routes/upload.js": uploadRoute(bp),
    "backend/routes/stats.js": statsRoute(bp),
  };
  if (!bp.auth) {
    delete files["backend/routes/auth.js"];
    delete files["backend/models/User.js"];
  }
  for (const m of bp.models) {
    files[`backend/models/${m.name}.js`] = modelFile(m, bp.auth);
    files[`backend/routes/${m.key}.js`] = routeFile(m);
  }
  return files;
}

function slug(s) {
  return (
    String(s || "app")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "app"
  );
}

module.exports = { generateBackend, slug, refPrefix };
