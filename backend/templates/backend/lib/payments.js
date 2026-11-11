const crypto = require("crypto");
const SITE = require("../config/site");
const { createStore } = require("./store");

/**
 * UPI payments, paid directly to the owner's UPI ID (no gateway, no fees).
 *
 * Status of a payment:
 *   unpaid     → the customer hasn't paid yet
 *   verifying  → the customer paid and entered their UPI transaction ID (UTR);
 *                the owner checks their UPI app and marks it…
 *   paid       → confirmed by the owner
 * UPI doesn't tell a website that money arrived, so the owner confirms it.
 */

const round = (n) => Math.round(Number(n || 0) * 100) / 100;
const enabledFor = (def) => Boolean(def.payment?.enabled && SITE.acceptPayments && SITE.owner?.upiId);

/**
 * The bill, worked out here on the server — the browser can't change the price.
 * Returns { total, lines: [{ description, quantity, unitPrice, total }] }; the
 * lines are saved with the order so the receipt keeps the price paid even if
 * the product's price changes later.
 */
async function priceFor(def, value) {
  const p = def.payment;
  const line = (description, quantity, unitPrice) => ({ description, quantity, unitPrice: round(unitPrice), total: round(quantity * unitPrice) });
  if (p.from === "fixed") return { total: round(p.fixed), lines: [line(def.singular, 1, p.fixed)] };
  if (p.from === "field") {
    const amount = Math.max(0, round(value[p.field]));
    return { total: amount, lines: [line(def.singular, 1, amount)] };
  }

  const linkField = def.fields.find((f) => f.name === p.link);
  const target = require(`../models/${linkField.model}`);
  const item = value[p.link] ? await createStore(target).get(value[p.link]) : null;
  const price = Number(item?.[target.priceField]) || 0;
  const qty = p.quantity ? Math.min(1000, Math.max(1, Math.floor(Number(value[p.quantity]) || 1))) : 1;
  let days = 1;
  if (p.start && p.end && value[p.start] && value[p.end]) {
    days = Math.min(365, Math.max(1, Math.round((Date.parse(value[p.end]) - Date.parse(value[p.start])) / 86400000)));
  }
  const name = String(item?.[target.titleField] ?? linkField.label);
  const description = days > 1 ? `${name} (${days} days × ₹${price.toLocaleString("en-IN")})` : name;
  return { total: round(price * qty * days), lines: [line(description, qty, price * days)] };
}
const amountFor = async (def, value) => (await priceFor(def, value)).total;

/** Problems with the dates used for pricing (e.g. check-out before check-in). */
function dateErrors(def, value) {
  const p = def.payment;
  if (!p?.start || !p?.end || !value[p.start] || !value[p.end]) return [];
  if (Date.parse(value[p.end]) <= Date.parse(value[p.start])) {
    const end = def.fields.find((f) => f.name === p.end);
    const start = def.fields.find((f) => f.name === p.start);
    return [`${end.label} must be after ${start.label.toLowerCase()}`];
  }
  return [];
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
const code = (n) => [...crypto.randomBytes(n)].map((b) => ALPHABET[b % ALPHABET.length]).join("");

/** Short, unique reference like ORD-7K2Q9X. */
async function newReference(def) {
  const store = createStore(def);
  for (let i = 0; i < 10; i++) {
    const ref = `${def.prefix}-${code(6)}`;
    if (!(await store.findOne({ reference: ref }))) return ref;
  }
  return `${def.prefix}-${code(10)}`;
}

/** upi:// link that opens GPay / PhonePe / Paytm with the amount filled in. */
function upiLink(amount, reference) {
  const o = SITE.owner || {};
  // UPI apps expect the "@" in the UPI ID as-is.
  const enc = (v) => encodeURIComponent(v).replace(/%40/g, "@");
  return `upi://pay?pa=${enc(o.upiId)}&pn=${enc(o.payeeName || SITE.name)}&am=${round(amount).toFixed(2)}&cu=INR&tn=${enc(reference)}`;
}

function paymentInfo(item) {
  if (!(item.amount > 0)) return null;
  const o = SITE.owner || {};
  return {
    amount: item.amount,
    status: item.paymentStatus,
    upiId: o.upiId,
    payeeName: o.payeeName || SITE.name,
    upiLink: upiLink(item.amount, item.reference),
  };
}

module.exports = { enabledFor, amountFor, dateErrors, newReference, upiLink, paymentInfo, code, priceFor, round };
