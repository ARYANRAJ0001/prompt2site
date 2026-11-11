const axios = require("axios");
const crypto = require("crypto");

function api() {
  const t = require("./token").token("RENDER_API_KEY");
  if (!process.env.RENDER_OWNER_ID) throw new Error("RENDER_OWNER_ID is not set on the backend (Render → Workspace settings, starts with tea-)");
  return axios.create({
    baseURL: "https://api.render.com/v1",
    timeout: 120000,
    headers: { Authorization: `Bearer ${t}`, Accept: "application/json", "Content-Type": "application/json" },
  });
}

const message = (err) => err.response?.data?.message || (err.response?.data && JSON.stringify(err.response.data)) || err.message;

/** Give each generated app its own database name on the shared cluster. */
function withDbName(uri, dbName) {
  if (!uri) return "";
  const [base, query] = uri.split("?");
  const m = base.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)(\/.*)?$/);
  return m ? `${m[1]}/${dbName}${query ? `?${query}` : ""}` : uri;
}

/** The email keys every app may have — cleared when the owner switches mode. */
const EMAIL_KEYS = ["BREVO_API_KEY", "EMAIL_FROM", "EMAIL_FROM_NAME", "SMTP_USER", "SMTP_PASS", "SMTP_HOST", "SMTP_PORT", "EMAILS_OFF"];

/**
 * How the app sends email, as the site owner chose in "Your business details":
 *   brevo    — the owner's own Brevo key + their verified sender
 *   gmail    — the owner's own Gmail + App Password (SMTP; blocked on Render's free plan)
 *   platform — the builder's Brevo (preferred) or Gmail
 *   emailsOff — the owner turned emails off
 */
function emailSettings(blueprint, secrets = {}) {
  const o = blueprint?.owner || {};
  const vars = [];
  if (o.emailsOff) return [{ key: "EMAILS_OFF", value: "true" }];
  if (o.senderName) vars.push({ key: "EMAIL_FROM_NAME", value: o.senderName });
  if (o.emailMode === "brevo" && secrets.brevoKey && o.senderEmail) {
    return [...vars, { key: "BREVO_API_KEY", value: secrets.brevoKey }, { key: "EMAIL_FROM", value: o.senderEmail }];
  }
  if (o.emailMode === "gmail" && secrets.gmailPassword && o.senderEmail) {
    return [...vars, { key: "SMTP_USER", value: o.senderEmail }, { key: "SMTP_PASS", value: secrets.gmailPassword }];
  }
  if (process.env.BREVO_API_KEY) {
    vars.push({ key: "BREVO_API_KEY", value: process.env.BREVO_API_KEY.trim() });
    const from = process.env.EMAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER;
    if (from) vars.push({ key: "EMAIL_FROM", value: from });
    return vars;
  }
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  if (user && pass) {
    vars.push({ key: "SMTP_USER", value: user }, { key: "SMTP_PASS", value: pass.replace(/\s+/g, "") });
    if (process.env.SMTP_HOST) vars.push({ key: "SMTP_HOST", value: process.env.SMTP_HOST });
    if (process.env.SMTP_PORT) vars.push({ key: "SMTP_PORT", value: process.env.SMTP_PORT });
  }
  return vars;
}

/**
 * Settings the generated backend needs: the owner's admin account, email and
 * WhatsApp alerts, image uploads and its own public URL (for links in emails).
 * Gmail: GMAIL_USER + GMAIL_APP_PASSWORD on this server (or any SMTP_* settings).
 *   secrets — { whatsappKey, adminPassword, adminPasswordSetAt } from the project
 *   appUrl  — the Netlify URL of the generated site
 */
function appSettings(blueprint, { secrets = {}, appUrl = "", includePassword = false } = {}) {
  const vars = [];
  vars.push(...emailSettings(blueprint, secrets));
  if (blueprint?.notifyEmail) vars.push({ key: "NOTIFY_EMAIL", value: blueprint.notifyEmail });
  if (blueprint?.owner?.email) vars.push({ key: "ADMIN_EMAIL", value: blueprint.owner.email });
  if (blueprint?.owner?.phone) vars.push({ key: "WHATSAPP_PHONE", value: blueprint.owner.phone });
  if (secrets.whatsappKey) vars.push({ key: "WHATSAPP_APIKEY", value: secrets.whatsappKey });
  if (appUrl) vars.push({ key: "APP_URL", value: appUrl });
  if (includePassword && secrets.adminPassword) {
    vars.push({ key: "ADMIN_PASSWORD", value: secrets.adminPassword }, { key: "ADMIN_PASSWORD_SET_AT", value: secrets.adminPasswordSetAt || String(Date.now()) });
  }
  if (process.env.CLOUDINARY_URL) vars.push({ key: "CLOUDINARY_URL", value: process.env.CLOUDINARY_URL });
  return vars;
}

/**
 * Create a Render web service for backend/ in the repo.
 * Generated apps never receive this server's own secrets.
 */
async function createService({ repoUrl, branch, name, blueprint, secrets, appUrl, plain = false }) {
  const rd = api();
  const serviceName = `${name}-api-${Date.now().toString(36)}`.slice(0, 60);
  // Generated backends are our own template code (not AI-written), so they
  // can share your cluster; each app gets its own database name.
  const mongo = process.env.GENERATED_APPS_MONGO_URI || process.env.MONGO_URI || "";
  const envVars = [
    { key: "NODE_ENV", value: "production" },
    { key: "JWT_SECRET", value: crypto.randomBytes(32).toString("hex") },
  ];
  if (mongo) envVars.push({ key: "MONGO_URI", value: withDbName(mongo, `p2s_${name.replace(/-/g, "_")}_${Date.now().toString(36)}`.slice(0, 60)) });
  // `plain` apps (games) get no owner/email settings and none of this server's keys.
  if (!plain) envVars.push(...appSettings(blueprint, { secrets, appUrl, includePassword: true }));

  let data;
  try {
    ({ data } = await rd.post("/services", {
      type: "web_service",
      name: serviceName,
      ownerId: process.env.RENDER_OWNER_ID,
      repo: repoUrl,
      branch,
      autoDeploy: "yes",
      rootDir: "backend",
      envVars,
      serviceDetails: {
        runtime: "node",
        plan: process.env.RENDER_PLAN || "free",
        region: process.env.RENDER_REGION || "singapore",
        envSpecificDetails: { buildCommand: "npm install", startCommand: "npm start" },
      },
    }));
  } catch (err) {
    throw new Error(`Render couldn't create the backend: ${message(err)}`);
  }
  const service = data.service || data;
  return {
    serviceId: service.id,
    url: service.serviceDetails?.url || `https://${service.slug || serviceName}.onrender.com`,
    dashboardUrl: service.dashboardUrl || null,
    database: mongo ? "mongodb" : "memory",
  };
}

/** Wait until the deployed backend answers /api/health. */
async function waitUntilLive(url, { timeoutMs = 9 * 60 * 1000, onProgress } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await axios.get(`${url}/api/health`, { timeout: 15000 });
      if (res.data?.status === "ok") return res.data;
    } catch {
      /* still building */
    }
    onProgress?.(`Waiting for the backend to start on Render (${Math.round((Date.now() - started) / 1000)}s — free plan takes 2–6 min)`);
    await new Promise((r) => setTimeout(r, 10000));
  }
  return null;
}

/**
 * On redeploy: update the app's settings (owner email/phone, WhatsApp key,
 * Gmail, site URL) while keeping its own secrets (JWT_SECRET, MONGO_URI).
 * ADMIN_PASSWORD is only sent when resetting it (includePassword).
 * WHATSAPP_APIKEY is removed when the owner cleared it.
 */
async function syncSettings(serviceId, blueprint, options = {}) {
  const wanted = appSettings(blueprint, options);
  const keys = new Set(wanted.map((v) => v.key));
  const remove = [...(options.secrets && !options.secrets.whatsappKey ? ["WHATSAPP_APIKEY"] : []), ...EMAIL_KEYS.filter((k) => !keys.has(k))];
  const rd = api();
  try {
    const { data } = await rd.get(`/services/${serviceId}/env-vars`, { params: { limit: 100 } });
    const current = Object.fromEntries((data || []).map((row) => [row.envVar?.key ?? row.key, row.envVar?.value ?? row.value]));
    const next = { ...current };
    for (const { key, value } of wanted) next[key] = value;
    for (const key of remove) delete next[key];
    const same = Object.keys(next).length === Object.keys(current).length && Object.entries(next).every(([k, v]) => current[k] === v);
    if (same) return { changed: false };
    await rd.put(`/services/${serviceId}/env-vars`, Object.entries(next).map(([key, value]) => ({ key, value })));
    return { changed: true };
  } catch (err) {
    return { changed: false, note: message(err) };
  }
}

/** Start a new deploy (so changed settings take effect without a code change). */
async function triggerDeploy(serviceId) {
  try {
    await api().post(`/services/${serviceId}/deploys`, { clearCache: "do_not_clear" });
    return { ok: true };
  } catch (err) {
    return { ok: false, note: message(err) };
  }
}

async function deleteService(serviceId) {
  try {
    await api().delete(`/services/${serviceId}`);
    return { ok: true };
  } catch (err) {
    if (err.response?.status === 404) return { ok: true, note: "already gone" };
    return { ok: false, note: message(err) };
  }
}

module.exports = { emailSettings, createService, waitUntilLive, withDbName, syncSettings, triggerDeploy, deleteService, appSettings };
