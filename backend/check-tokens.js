/**
 * Checks every key in backend/.env (never prints the secrets).
 *   npm run check
 */
const fs = require("fs"), path = require("path");
const file = path.join(__dirname, ".env");
if (!fs.existsSync(file)) { console.log("❌ No .env in", __dirname, "— run: cp .env.example .env  and fill it in"); process.exit(); }
require("dotenv").config({ path: file, override: true });
const v = (k) => String(process.env[k] || "").trim().replace(/^['"]|['"]$/g, "");
const info = (k) => (v(k) ? `starts "${v(k).slice(0, 4)}", ${v(k).length} chars` : "EMPTY");
const show = (ok, name, msg) => console.log(`${ok ? "✅" : "❌"} ${name.padEnd(16)} ${msg}`);
const get = async (url, headers) => { const r = await fetch(url, { headers }); let d = {}; try { d = await r.json(); } catch {} return { r, d }; };

(async () => {
  console.log("Checking", file, "\n");
  try { const { r, d } = await get("https://api.github.com/user", { Authorization: `Bearer ${v("GITHUB_TOKEN")}`, "User-Agent": "p2s" });
    const scopes = r.headers.get("x-oauth-scopes") || "";
    show(r.ok, "GITHUB_TOKEN", r.ok ? `user ${d.login}${scopes ? ` · scopes: ${scopes}` : ""}${scopes && !scopes.includes("repo") ? " ⚠️ tick 'repo'" : ""}` : `${r.status} ${d.message} (${info("GITHUB_TOKEN")})`);
  } catch (e) { show(false, "GITHUB_TOKEN", e.message); }

  try { const { r, d } = await get("https://api.netlify.com/api/v1/user", { Authorization: `Bearer ${v("NETLIFY_TOKEN")}` });
    show(r.ok, "NETLIFY_TOKEN", r.ok ? `user ${d.email}` : `${r.status} ${d.message || ""} (${info("NETLIFY_TOKEN")})`);
  } catch (e) { show(false, "NETLIFY_TOKEN", e.message); }

  try { const { r, d } = await get("https://api.render.com/v1/owners?limit=20", { Authorization: `Bearer ${v("RENDER_API_KEY")}`, Accept: "application/json" });
    if (!r.ok) show(false, "RENDER_API_KEY", `${r.status} ${d.message || ""} (${info("RENDER_API_KEY")})`);
    else {
      const owners = (Array.isArray(d) ? d : []).map((o) => o.owner || o);
      show(true, "RENDER_API_KEY", `workspaces: ${owners.map((o) => `${o.name} (${o.id})`).join(", ")}`);
      const ok = owners.some((o) => o.id === v("RENDER_OWNER_ID"));
      show(ok, "RENDER_OWNER_ID", ok ? v("RENDER_OWNER_ID") : `"${v("RENDER_OWNER_ID") || "EMPTY"}" — use one of the ids above (starts with tea-)`);
    }
  } catch (e) { show(false, "RENDER_API_KEY", e.message); }

  try { const { r, d } = await get("https://openrouter.ai/api/v1/key", { Authorization: `Bearer ${v("OPENROUTER_API_KEY")}` });
    show(r.ok, "OPENROUTER", r.ok ? `ok${d.data?.is_free_tier ? " (free tier)" : ""}` : `${r.status} ${d.error?.message || ""} (${info("OPENROUTER_API_KEY")})`);
  } catch (e) { show(false, "OPENROUTER", e.message); }

  try { const mongoose = require("mongoose");
    await mongoose.connect(v("MONGO_URI"), { serverSelectionTimeoutMS: 8000 });
    show(true, "MONGO_URI", "connected"); await mongoose.disconnect();
  } catch (e) { show(false, "MONGO_URI", e.message.split("\n")[0]); }

  if (!v("GMAIL_USER") || !v("GMAIL_APP_PASSWORD")) show(false, "GMAIL", "GMAIL_USER / GMAIL_APP_PASSWORD empty (emails off)");
  else try {
    await require("nodemailer").createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: v("GMAIL_USER"), pass: v("GMAIL_APP_PASSWORD").replace(/\s+/g, "") } }).verify();
    show(true, "GMAIL", `login ok (${v("GMAIL_USER")})`);
  } catch (e) { show(false, "GMAIL", e.message.split("\n")[0]); }

  if (!v("BREVO_API_KEY")) show(false, "BREVO_API_KEY", "empty — deployed sites on Render's free plan can't send email without it (Render blocks Gmail/SMTP)");
  else try {
    const { r, d } = await get("https://api.brevo.com/v3/senders", { "api-key": v("BREVO_API_KEY"), Accept: "application/json" });
    if (!r.ok) show(false, "BREVO_API_KEY", `${r.status} ${d.message || ""} (${info("BREVO_API_KEY")})`);
    else {
      const from = v("EMAIL_FROM") || v("GMAIL_USER");
      const s = (d.senders || []).find((x) => x.email.toLowerCase() === from.toLowerCase());
      show(true, "BREVO_API_KEY", `ok · senders: ${(d.senders || []).map((x) => `${x.email}${x.active ? "" : " (not verified)"}`).join(", ") || "none"}`);
      show(Boolean(s && s.active), "EMAIL_FROM", s ? (s.active ? from : `${from} isn't verified yet — click the link Brevo emailed you`) : `"${from || "EMPTY"}" — add it in Brevo → Senders and verify it`);
    }
  } catch (e) { show(false, "BREVO_API_KEY", e.message); }

  show(Boolean(v("JWT_SECRET")), "JWT_SECRET", v("JWT_SECRET") ? "set" : "EMPTY — add any long random text");
  process.exit(0);
})();
