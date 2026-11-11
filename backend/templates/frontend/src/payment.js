import { SITE } from "./config.js";

/** UPI payments go straight to the owner's UPI ID. */
export const paymentsOn = (model) => Boolean(SITE.acceptPayments && SITE.owner?.upiId && model?.payment?.enabled);

export function upiLink(amount, reference) {
  const o = SITE.owner || {};
  const enc = (v) => encodeURIComponent(v).replace(/%40/g, "@");
  return `upi://pay?pa=${enc(o.upiId)}&pn=${enc(o.payeeName || SITE.name)}&am=${Number(amount).toFixed(2)}&cu=INR&tn=${enc(reference)}`;
}

export const STATUS = {
  unpaid: { label: "Unpaid", className: "badge warn" },
  verifying: { label: "Checking payment", className: "badge info" },
  paid: { label: "Paid", className: "badge ok" },
  none: { label: "No payment", className: "badge" },
};

/** Guests' orders/bookings are remembered on this device so they can find them again. */
const KEY = "my_submissions";
export const saved = {
  list() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  },
  add(entry) {
    try {
      const rest = saved.list().filter((e) => e.id !== entry.id);
      localStorage.setItem(KEY, JSON.stringify([entry, ...rest].slice(0, 50)));
    } catch {}
  },
};
