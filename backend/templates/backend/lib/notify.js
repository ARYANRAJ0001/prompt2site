const nodemailer = require("nodemailer");
const SITE = require("../config/site");
const receipt = require("./receipt");

/**
 * Email + WhatsApp alerts.
 *
 * EMAIL — either of:
 *   BREVO_API_KEY + EMAIL_FROM   Brevo's email API over HTTPS (free, 300/day). Use this on
 *                                Render's free plan, which blocks SMTP ports.
 *                                EMAIL_FROM must be a sender you verified in Brevo.
 *   SMTP_USER + SMTP_PASS        Gmail address + App Password (works locally and on paid hosting).
 *                                Other providers: also set SMTP_HOST and SMTP_PORT.
 *   NOTIFY_EMAIL  where the owner's alerts go (defaults to the owner email set in the builder)
 *
 * WHATSAPP (free, via CallMeBot — https://www.callmebot.com/blog/free-api-whatsapp-messages/)
 *   1. Save +34 621 331 709 in your phone, send it: "I allow callmebot to send me messages"
 *   2. You get an API key back. Set:
 *   WHATSAPP_PHONE   your WhatsApp number with country code, e.g. +919876543210
 *   WHATSAPP_APIKEY  the key CallMeBot sent you
 *
 * APP_URL (optional) — your website's address, used for links in messages.
 */

const appUrl = () => String(process.env.APP_URL || "").replace(/\/$/, "");
const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ------------------------------------------------------------------ email

let transport;
function getTransport() {
  if (transport !== undefined) return transport;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.log("ℹ️  Email is off: set SMTP_USER and SMTP_PASS (Gmail address + App Password).");
    return (transport = null);
  }
  const port = Number(process.env.SMTP_PORT || 465);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: { user, pass },
    // fail fast instead of hanging a sign-up for minutes when SMTP is blocked
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  return transport;
}

const brevoKey = () => String(process.env.BREVO_API_KEY || "").trim();
const fromAddress = () => process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "";
// EMAILS_OFF=true — the owner turned emails off. EMAIL_FROM_NAME — the name readers see (default: the site's name).
const emailsOff = () => String(process.env.EMAILS_OFF || "") === "true";
const fromName = () => String(process.env.EMAIL_FROM_NAME || "").trim() || SITE.name;
const canEmail = () => !emailsOff() && Boolean((brevoKey() && fromAddress()) || (process.env.SMTP_USER && process.env.SMTP_PASS));

/** Brevo transactional email over HTTPS (port 443 — not blocked anywhere). */
async function sendViaBrevo(message) {
  const res = await fetch(process.env.BREVO_URL || "https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": brevoKey(), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { name: message.from.name, email: message.from.address },
      to: [{ email: message.to }],
      ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** rows: [[label, value], ...] shown as a table. */
async function sendEmail({ to, subject, intro = "", rows = [], button, footer = "", replyTo, html: htmlBody, text: textBody }) {
  if (emailsOff()) return false;
  const useBrevo = Boolean(brevoKey() && fromAddress());
  const mailer = useBrevo ? null : getTransport();
  if (!to || (!useBrevo && !mailer)) return false;
  try {
    const message = {
      from: { name: fromName(), address: fromAddress() },
      to,
      replyTo,
      subject,
      text: textBody || [intro, ...rows.map(([k, v]) => `${k}: ${v}`), button ? `${button.label}: ${button.url}` : "", footer].filter(Boolean).join("\n") + "\n",
      html: htmlBody || `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;color:#1b1d24">
  <h2 style="margin:0 0 10px">${esc(subject)}</h2>
  ${intro ? `<p>${esc(intro)}</p>` : ""}
  ${rows.length ? `<table style="border-collapse:collapse;width:100%">${rows
    .map(([k, v]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;white-space:nowrap">${esc(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee"><b>${esc(v)}</b></td></tr>`)
    .join("")}</table>` : ""}
  ${button ? `<p style="margin:18px 0"><a href="${esc(button.url)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${esc(button.label)}</a></p>` : ""}
  ${footer ? `<p style="color:#666">${esc(footer)}</p>` : ""}
  <p style="color:#999;font-size:12px">${esc(SITE.name)}</p>
</div>`,
    };
    if (useBrevo) await sendViaBrevo(message);
    else await mailer.sendMail(message);
    console.log(`📧 Sent "${subject}" to ${to}`);
    return true;
  } catch (err) {
    console.error("❌ Couldn't send email:", err.message);
    return false;
  }
}

// --------------------------------------------------------------- whatsapp

const ownerPhone = () => process.env.WHATSAPP_PHONE || SITE.owner?.phone || "";
const canWhatsApp = () => Boolean(ownerPhone() && process.env.WHATSAPP_APIKEY);

async function sendWhatsApp(text) {
  if (!canWhatsApp()) return false;
  try {
    const base = process.env.CALLMEBOT_URL || "https://api.callmebot.com/whatsapp.php";
    const url = `${base}?phone=${encodeURIComponent(ownerPhone())}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(process.env.WHATSAPP_APIKEY)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const body = await res.text();
    if (!res.ok || /error|invalid|not.*activ/i.test(body.slice(0, 300))) throw new Error(body.replace(/<[^>]+>/g, " ").trim().slice(0, 200));
    console.log("💬 WhatsApp alert sent");
    return true;
  } catch (err) {
    console.error("❌ Couldn't send WhatsApp message:", err.message);
    return false;
  }
}

// ------------------------------------------------------------ the details

const detailRows = receipt.detailRows;

const customerLine = (item) =>
  item.customerId ? `${item.customerId}${item.customerEmail ? ` (${item.customerEmail})` : ""}` : item.customerEmail ? `Guest (${item.customerEmail})` : "Guest";

const receiptUrl = (def, item) => (appUrl() ? `${appUrl()}/#/receipt/${def.key}/${item._id}?k=${item.accessKey}` : "");
const trackUrl = (def, item) => (appUrl() ? `${appUrl()}/#/track/${def.key}/${item._id}?k=${item.accessKey}` : "");
const ownerEmail = () => process.env.NOTIFY_EMAIL || SITE.notifyEmail || SITE.owner?.email || "";

/** A visitor submitted a form (order, booking, enquiry…). */
async function newSubmission(def, item) {
  const rows = await detailRows(def, item);
  const hasPay = item.amount > 0;
  const head = [["Reference", item.reference], ["Customer", customerLine(item)]];
  if (hasPay) head.push(["Amount", money(item.amount)], ["Payment", "Not paid yet"]);
  const subject = `New ${def.singular.toLowerCase()} ${item.reference} on ${SITE.name}`;

  await Promise.all([
    sendEmail({
      to: ownerEmail(),
      subject,
      rows: [...head, ...rows],
      replyTo: item.customerEmail || undefined,
      button: appUrl() ? { label: `Open ${def.label}`, url: `${appUrl()}/#/${def.key}` } : undefined,
      footer: item.customerEmail ? "Reply to this email to answer the customer directly." : "",
    }),
    sendWhatsApp(
      [`🔔 New ${def.singular.toLowerCase()} on ${SITE.name}`, `Ref: ${item.reference}`, `Customer: ${customerLine(item)}`, hasPay ? `Amount: ${money(item.amount)} (not paid yet)` : "", ...rows.slice(0, 6).map(([k, v]) => `${k}: ${v}`)]
        .filter(Boolean)
        .join("\n")
    ),
    item.customerEmail && sendReceipt(def, item, `Thank you! ${SITE.name} has received your ${def.singular.toLowerCase()}.`),
  ]);
}

/** The customer's receipt (order details, bill, payment status) by email. */
async function sendReceipt(def, item, intro) {
  if (!item.customerEmail) return false;
  const r = await receipt.data(def, item);
  const paid = r.status === "paid";
  const link = receiptUrl(def, item);
  const button = link ? { label: paid ? "View / download receipt" : r.total > 0 ? "View receipt & pay" : "View details", url: link } : undefined;
  return sendEmail({
    to: item.customerEmail,
    subject: paid ? `Payment receipt ${item.reference} — ${money(item.amount)} paid` : `Your ${def.singular.toLowerCase()} receipt — ${item.reference}`,
    html: receipt.html(r, { intro, button }),
    text: receipt.text(r, intro) + (link ? `\n\nView your receipt: ${link}` : ""),
    replyTo: ownerEmail() || undefined,
  });
}

/** A customer says they've paid (with a UPI reference). */
async function paymentClaimed(def, item) {
  const subject = `Payment to check: ${money(item.amount)} for ${item.reference}`;
  await Promise.all([
    sendEmail({
      to: ownerEmail(),
      subject,
      intro: "A customer says they've paid. Check your UPI / bank app for this payment, then mark it as Paid in your dashboard.",
      rows: [["Reference", item.reference], ["Customer", customerLine(item)], ["Amount", money(item.amount)], ["UPI transaction ID (UTR)", item.paymentRef]],
      button: appUrl() ? { label: "Open dashboard", url: `${appUrl()}/#/${def.key}` } : undefined,
    }),
    sendWhatsApp(`💰 Payment to check on ${SITE.name}\nRef: ${item.reference}\nAmount: ${money(item.amount)}\nUTR: ${item.paymentRef}\nCustomer: ${customerLine(item)}\nCheck your UPI app, then mark it Paid in the dashboard.`),
  ]);
}

/** The owner marked a payment as received (or not received). */
async function paymentUpdated(def, item) {
  if (!item.customerEmail) return;
  const paid = item.paymentStatus === "paid";
  if (paid) return sendReceipt(def, item, `${SITE.name} has confirmed your payment of ${money(item.amount)}. Thank you!`);
  await sendEmail({
    to: item.customerEmail,
    subject: paid ? `Payment received — ${item.reference}` : `Payment not received yet — ${item.reference}`,
    intro: paid
      ? `${SITE.name} has confirmed your payment of ${money(item.amount)}. Thank you!`
      : `${SITE.name} couldn't find your payment of ${money(item.amount)} yet. Please check the UPI transaction ID or pay again.`,
    rows: [["Reference", item.reference], ["Amount", money(item.amount)], ["Status", paid ? "Paid" : "Unpaid"]],
    button: trackUrl(def, item) ? { label: "View details", url: trackUrl(def, item) } : undefined,
  });
}

async function sendCode(to, code, purpose) {
  return sendEmail({
    to,
    subject: purpose === "reset" ? `Reset your ${SITE.name} password` : `Your ${SITE.name} verification code`,
    intro: purpose === "reset" ? "Use this code to choose a new password:" : "Use this code to confirm your email address:",
    rows: [["Code", code]],
    footer: "The code is valid for 15 minutes. If you didn't ask for it, you can ignore this email.",
  });
}

module.exports = { sendReceipt, canEmail, canWhatsApp, sendEmail, sendWhatsApp, newSubmission, paymentClaimed, paymentUpdated, sendCode, money };
