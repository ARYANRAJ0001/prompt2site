/**
 * Extra files for the generated backend: email alerts, linked-data checks,
 * image uploads and the admin dashboard's statistics.
 */
const J = (v) => JSON.stringify(v, null, 2);

const LINKS_JS = `const { createStore } = require("./store");

/**
 * Linked fields (e.g. a booking's "room") store the id of an item in another
 * collection. This checks the item exists (and, for private data, that it
 * belongs to the same user).
 */
const defs = {};
const defFor = (name) => (defs[name] ||= require(\`../models/\${name}\`));

async function checkLinks(def, value, user) {
  const errors = [];
  for (const field of def.fields) {
    if (field.type !== "relation" || !value[field.name]) continue;
    const target = defFor(field.model);
    const scope = target.ownedByUser ? { user: user?.id } : {};
    const found = await createStore(target).get(value[field.name], scope);
    if (!found) errors.push(\`The selected \${field.label.toLowerCase()} doesn't exist\`);
  }
  return errors;
}

/** Turn linked ids into readable titles (used in notification emails). */
async function linkTitle(field, id) {
  try {
    const target = defFor(field.model);
    const item = await createStore(target).get(id);
    return item ? String(item[target.titleField] ?? id) : id;
  } catch {
    return id;
  }
}

module.exports = { checkLinks, linkTitle };
`;

function uploadRoute(bp) {
  // Visitors need to upload too if a public form has an image field.
  const hasImage = (m) => m.fields.some((f) => f.type === "image");
  const publicImages = bp.models.some((m) => m.public.create && !m.ownedByUser && hasImage(m));
  const privateImages = bp.models.some((m) => m.ownedByUser && hasImage(m));
  const guard = !bp.auth ? "" : publicImages ? "optionalAuth, " : privateImages ? "requireAuth, " : "requireAdmin, ";
  return `const express = require("express");
const crypto = require("crypto");
${bp.auth ? 'const { requireAuth, requireAdmin, optionalAuth } = require("../middleware/auth");\n' : ""}
/**
 * POST /api/upload { image: "data:image/jpeg;base64,..." } -> { url }
 * With CLOUDINARY_URL set (cloudinary://KEY:SECRET@CLOUD), images go to
 * Cloudinary and a normal https link is returned. Without it, the (already
 * resized) image is stored inside the database record itself.
 */
const router = express.Router();
const IMAGE = /^data:image\\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

async function toCloudinary(dataUrl) {
  const m = String(process.env.CLOUDINARY_URL).match(/^cloudinary:\\/\\/([^:]+):([^@]+)@(.+)$/);
  if (!m) throw new Error("CLOUDINARY_URL should look like cloudinary://API_KEY:API_SECRET@CLOUD_NAME");
  const [, apiKey, secret, cloud] = m;
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = ${J(bp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app")};
  const signature = crypto.createHash("sha1").update(\`folder=\${folder}&timestamp=\${timestamp}\${secret}\`).digest("hex");
  const res = await fetch(\`https://api.cloudinary.com/v1_1/\${cloud}/image/upload\`, {
    method: "POST",
    body: new URLSearchParams({ file: dataUrl, api_key: apiKey, timestamp: String(timestamp), folder, signature }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Cloudinary upload failed");
  return data.secure_url;
}

router.post("/", ${guard}async (req, res, next) => {
  try {
    const image = String(req.body.image || "");
    if (!IMAGE.test(image)) return res.status(400).json({ message: "Please choose a PNG, JPG, WEBP or GIF image" });
    if (image.length > 2500000) return res.status(400).json({ message: "That image is too large (max about 1.8 MB)" });
    if (!process.env.CLOUDINARY_URL) return res.json({ url: image, stored: "database" });
    res.json({ url: await toCloudinary(image), stored: "cloudinary" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
`;
}

function statsRoute(bp) {
  const models = bp.models.map((m) => ({ name: m.name, key: m.key, label: m.label, icon: m.icon, recent: m.newestFirst && !m.ownedByUser, payments: Boolean(m.payment?.enabled) }));
  return `const express = require("express");
const { createStore } = require("../lib/store");
${bp.auth ? 'const { requireAdmin } = require("../middleware/auth");\n' : ""}
/** GET /api/stats — numbers for the admin dashboard. */
const router = express.Router();
const MODELS = ${J(models)};
const day = (d) => new Date(d).toISOString().slice(0, 10);

router.get("/", ${bp.auth ? "requireAdmin, " : ""}async (req, res, next) => {
  try {
    const today = day(Date.now());
    const days = [...Array(14)].map((_, i) => day(Date.now() - (13 - i) * 86400000));
    const out = [];
    for (const m of MODELS) {
      const def = require(\`../models/\${m.name}\`);
      const rows = await createStore(def).list({});
      const perDay = Object.fromEntries(days.map((d) => [d, 0]));
      for (const r of rows) if (r.createdAt && perDay[day(r.createdAt)] !== undefined) perDay[day(r.createdAt)]++;
      const pay = m.payments
        ? {
            received: rows.filter((r) => r.paymentStatus === "paid").reduce((n, r) => n + (Number(r.amount) || 0), 0),
            toVerify: rows.filter((r) => r.paymentStatus === "verifying").length,
            unpaid: rows.filter((r) => r.paymentStatus === "unpaid").length,
          }
        : null;
      out.push({
        ...m,
        pay,
        total: rows.length,
        today: perDay[today] || 0,
        last14: days.map((d) => ({ day: d, count: perDay[d] })),
        recentItems: m.recent && !def.ownedByUser
          ? rows.slice(0, 5).map((r) => ({ _id: r._id, title: r[def.titleField], reference: r.reference, amount: r.amount, paymentStatus: r.paymentStatus, createdAt: r.createdAt }))
          : [],
      });
    }
    res.json({ models: out });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
`;
}

function siteConfig(bp) {
  return `/** Site settings used by the backend (from the app's plan). */
module.exports = ${J({
    name: bp.name,
    auth: bp.auth,
    currency: bp.currency,
    notifyEmail: bp.notifyEmail || "",
    // public details only — secrets (passwords, WhatsApp key) are environment variables
    owner: { name: bp.owner?.name || "", email: bp.owner?.email || "", phone: bp.owner?.phone || "", upiId: bp.owner?.upiId || "", payeeName: bp.owner?.payeeName || "" },
    acceptPayments: Boolean(bp.acceptPayments && bp.owner?.upiId),
    requireLogin: Boolean(bp.requireLogin),
  })};
`;
}

function seedFile(bp) {
  // Seed linked-to collections first so links can be resolved by title.
  const order = [...bp.models].sort(
    (a, b) => a.fields.filter((f) => f.type === "relation").length - b.fields.filter((f) => f.type === "relation").length
  );
  const seeds = order
    .filter((m) => !m.ownedByUser && !m.submission && (bp.sampleData[m.name] || []).length)
    .map((m) => ({
      model: m.name,
      links: m.fields
        .filter((f) => f.type === "relation")
        .map((f) => ({ field: f.name, model: f.model, titleField: bp.models.find((t) => t.name === f.model).titleField })),
      rows: bp.sampleData[m.name],
    }));

  return `const { createStore } = require("../lib/store");

/** Sample data inserted the first time the app starts (only into empty collections). */
const SAMPLE = ${J(seeds)};

async function seed() {
  for (const { model, rows, links } of SAMPLE) {
    const store = createStore(require(\`../models/\${model}\`));
    if ((await store.count()) > 0) continue;
    for (const sample of rows) {
      const row = { ...sample };
      // Sample links name the linked item by its title; store its id instead.
      for (const link of links) {
        if (!row[link.field]) continue;
        const target = await createStore(require(\`../models/\${link.model}\`)).findOne({ [link.titleField]: row[link.field] });
        if (target) row[link.field] = String(target._id);
        else delete row[link.field];
      }
      await store.create(row);
    }
    console.log(\`🌱 Added \${rows.length} sample \${model} records\`);
  }
}

module.exports = { seed };
`;
}

module.exports = { LINKS_JS, uploadRoute, statsRoute, siteConfig, seedFile };
