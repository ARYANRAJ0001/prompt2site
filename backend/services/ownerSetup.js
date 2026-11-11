/**
 * The site owner's business details: checks before deploy, the generated
 * app's admin password, and test alerts (email + WhatsApp via CallMeBot).
 */
const crypto = require("crypto");
const axios = require("axios");
const nodemailer = require("nodemailer");

/** What's missing before the app can go live. */
function ownerProblems(bp) {
  const o = bp.owner || {};
  const problems = [];
  if (!o.email) problems.push("your email (customers' orders and enquiries are sent there, and it's your admin login)");
  if (!o.phone) problems.push("your mobile number (for WhatsApp alerts and the chat button)");
  const paid = bp.models.some((m) => m.payment?.enabled);
  if (bp.acceptPayments && paid && !o.upiId) problems.push("your UPI ID (to receive payments) — or turn off UPI payments");
  return problems;
}

/** e.g. "kite-7QmX-42rd" — easy to read out, ~60 bits. */
function newAdminPassword() {
  const words = ["mango", "river", "lotus", "tiger", "cloud", "maple", "pearl", "comet", "spice", "amber", "coral", "cedar"];
  const pick = () => words[crypto.randomInt(words.length)];
  const chunk = () => crypto.randomBytes(3).toString("base64url").slice(0, 4);
  return `${pick()}-${chunk()}-${chunk()}`;
}

function mailer() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  return {
    from: process.env.SMTP_FROM || user,
    transport: nodemailer.createTransport({ host: process.env.SMTP_HOST || "smtp.gmail.com", port, secure: port === 465, auth: { user, pass } }),
  };
}

/**
 * Send an email. `via` (optional) is a site's own choice:
 *   { brevoKey, from, name } or { gmail: { user, pass }, name }
 * Without it, the builder's own Brevo or Gmail settings are used.
 */
async function sendEmail(to, subject, text, via = null) {
  const name = via?.name || "Prompt2Site";
  const key = via ? via.brevoKey : String(process.env.BREVO_API_KEY || "").trim();
  const from = via ? via.from : process.env.EMAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER;
  if (key && from) {
    try {
      await axios.post(process.env.BREVO_URL || "https://api.brevo.com/v3/smtp/email", { sender: { name, email: from }, to: [{ email: to }], subject, textContent: text }, { headers: { "api-key": key }, timeout: 15000 });
      return { ok: true };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { ok: false, note: `Email failed (Brevo): ${msg}${/unrecogni[sz]ed IP|authori[sz]ed IP/i.test(msg) ? " — in Brevo, turn off Security → Authorised IPs" : ""}` };
    }
  }
  if (via && "gmail" in via && !via.gmail) return { ok: false, note: "Add your Gmail address and App Password first." };
  if (via && via.brevoKey === undefined && !via.gmail && !via.platform) return { ok: false, note: "Add your Brevo key and sender email first." };
  if (via?.gmail) {
    try {
      const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: via.gmail, connectionTimeout: 10000 });
      await t.sendMail({ from: { name, address: via.gmail.user }, to, subject, text });
      return { ok: true };
    } catch (err) {
      return { ok: false, note: `Email failed (Gmail): ${err.message}` };
    }
  }
  const m = mailer();
  if (!m) return { ok: false, note: "The builder has no email sender yet (BREVO_API_KEY, or GMAIL_USER + GMAIL_APP_PASSWORD, in its .env). You can also choose your own Brevo account under Email sending." };
  try {
    await m.transport.sendMail({ from: { name, address: m.from }, to, subject, text });
    return { ok: true };
  } catch (err) {
    return { ok: false, note: `Email failed: ${err.message}` };
  }
}

/** WhatsApp message through CallMeBot (free; the owner gets an API key from the bot first). */
async function sendWhatsApp(phone, apikey, text) {
  if (!phone || !apikey) return { ok: false, note: "Add your mobile number and CallMeBot key first." };
  const url = process.env.CALLMEBOT_URL || "https://api.callmebot.com/whatsapp.php";
  try {
    const { data } = await axios.get(url, { params: { phone: phone.replace(/[^\d+]/g, ""), text, apikey }, timeout: 20000, responseType: "text" });
    const body = String(data || "");
    if (/APIKey is invalid|not valid|error/i.test(body) && !/queued|sent/i.test(body)) return { ok: false, note: "CallMeBot rejected the key. Check the number and key it sent you." };
    return { ok: true };
  } catch (err) {
    return { ok: false, note: `WhatsApp failed: ${err.response?.status || ""} ${err.message}`.trim() };
  }
}

function adminLoginEmail({ name, live, email, password }) {
  return [
    `Your website "${name}" is live: ${live}`,
    "",
    "Your admin login (to see orders, bookings and payments):",
    `  Email:    ${email}`,
    `  Password: ${password}`,
    "",
    `Log in at ${live}/#/login and change the password from "My account".`,
    "Customers who sign up get their own customer accounts — they can never become admin.",
  ].join("\n");
}

module.exports = { ownerProblems, newAdminPassword, sendEmail, sendWhatsApp, adminLoginEmail };
