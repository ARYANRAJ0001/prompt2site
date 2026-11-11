import axios from "axios";
import { SAMPLE, SITE } from "./config.js";

/**
 * All calls to the backend go through here.
 * In demo mode (VITE_DEMO=true, used for the builder's preview) the same
 * functions work on in-browser sample data instead of a real server.
 */
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const DEMO = import.meta.env.VITE_DEMO === "true";

const TOKEN_KEY = "app_token";
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return memoryToken;
    }
  },
  set(token) {
    memoryToken = token;
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable (private mode): keep it in memory */
    }
  },
};
let memoryToken = null;

const http = axios.create({ baseURL: `${API_URL}/api`, timeout: 60000 });
http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function errorMessage(err) {
  if (err?.code === "ECONNABORTED") return "The server took too long to answer. It may be waking up — try again in a moment.";
  if (err?.message === "Network Error") return "Can't reach the server. It may still be starting — try again in a minute.";
  return err?.response?.data?.message || err?.message || "Something went wrong";
}

// ------------------------------------------------------------ demo mode

const demoDb = {};
/** Live preview in the builder: start the sample data again after the plan changes. */
export function resetDemoData() {
  for (const k of Object.keys(demoDb)) delete demoDb[k];
}
const demoId = () => Math.random().toString(16).slice(2, 14).padEnd(12, "0");
function demoTable(key) {
  if (!demoDb[key]) {
    const model = SITE.models.find((m) => m.key === key);
    const rows = SAMPLE[model?.name] || [];
    demoDb[key] = rows.map((sample, i) => {
      const row = { ...sample };
      // Sample links name the linked item by title; use its id like the real backend.
      for (const f of model.fields.filter((x) => x.type === "relation")) {
        const target = SITE.models.find((t) => t.name === f.model);
        const found = demoTable(target.key).find((t) => String(t[target.titleField]) === String(row[f.name]));
        if (found) row[f.name] = found._id;
        else delete row[f.name];
      }
      // Spread sample dates over the last days so the dashboard has a history.
      const at = new Date(Date.now() - (rows.length - i) * 86400000 * 1.5).toISOString();
      const out = { _id: demoId(), ...row, createdAt: at, updatedAt: at };
      return model.submission ? { ...out, ...demoSubmission(model, out, i) } : out;
    });
  }
  return demoDb[key];
}
const wait = (value) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), 150));

const demo = {
  list: (key, q) => {
    const needle = (q || "").toLowerCase();
    const rows = demoTable(key).filter((item) => !needle || JSON.stringify(item).toLowerCase().includes(needle));
    const newestFirst = SITE.models.find((m) => m.key === key)?.newestFirst;
    return wait(newestFirst ? rows.slice().reverse() : rows.slice());
  },
  get: (key, id) => wait(demoTable(key).find((i) => i._id === id) || null),
  create: async (key, data) => {
    const now = new Date().toISOString();
    const model = SITE.models.find((m) => m.key === key);
    const item = { _id: demoId(), ...data, createdAt: now, updatedAt: now };
    if (model.submission) {
      Object.assign(item, demoSubmission(model, item));
      if (demoUser && demoUser.role === "customer") Object.assign(item, { userId: demoUser.id, customerId: demoUser.customerId, customerEmail: demoUser.email });
    }
    demoTable(key).push(item);
    return wait(withPay(item));
  },
  mine: (key) => wait(demoTable(key).filter((i) => demoUser && i.userId === demoUser.id).slice().reverse().map(withPay)),
  track: (key, id) => wait(withPay(demoTable(key).find((i) => i._id === id) || null)),
  receipt: (key, id) => {
    const model = SITE.models.find((m) => m.key === key);
    const item = demoTable(key).find((i) => i._id === id);
    return item ? wait(receiptFrom(model, item)) : Promise.reject(new Error("Receipt not found"));
  },
  claim: (key, id, body) => {
    const item = demoTable(key).find((i) => i._id === id);
    Object.assign(item, { paymentStatus: "verifying", paymentRef: body.utr });
    return wait(withPay(item));
  },
  setStatus: (key, id, status) => {
    const item = demoTable(key).find((i) => i._id === id);
    Object.assign(item, { paymentStatus: status, paidAt: status === "paid" ? new Date().toISOString() : "" });
    return wait(withPay(item));
  },
  update: (key, id, data) => {
    const item = demoTable(key).find((i) => i._id === id);
    Object.assign(item, data, { updatedAt: new Date().toISOString() });
    return wait(item);
  },
  remove: (key, id) => {
    demoDb[key] = demoTable(key).filter((i) => i._id !== id);
    return wait({ success: true });
  },
  stats: () => {
    const day = (d) => new Date(d).toISOString().slice(0, 10);
    const days = [...Array(14)].map((_, i) => day(Date.now() - (13 - i) * 86400000));
    return wait({
      models: SITE.models.map((m) => {
        const rows = demoTable(m.key);
        const per = Object.fromEntries(days.map((d) => [d, 0]));
        rows.forEach((r) => per[day(r.createdAt)] !== undefined && per[day(r.createdAt)]++);
        const pay = m.payment?.enabled && SITE.acceptPayments
          ? {
              received: rows.filter((r) => r.paymentStatus === "paid").reduce((n, r) => n + (r.amount || 0), 0),
              toVerify: rows.filter((r) => r.paymentStatus === "verifying").length,
              unpaid: rows.filter((r) => r.paymentStatus === "unpaid").length,
            }
          : null;
        return {
          pay,
          name: m.name, key: m.key, label: m.label, icon: m.icon, total: rows.length, today: per[days[13]],
          last14: days.map((d) => ({ day: d, count: per[d] })),
          recentItems: m.newestFirst && !m.ownedByUser ? rows.slice().reverse().slice(0, 5).map((r) => ({ _id: r._id, title: r[m.titleField], reference: r.reference, amount: r.amount, paymentStatus: r.paymentStatus, createdAt: r.createdAt })) : [],
        };
      }),
    });
  },
  auth: (body) => {
    // Preview: the owner's email (or any email with "admin") logs in as the owner; others as a customer.
    const email = String(body.email || "").toLowerCase();
    const admin = email === String(SITE.owner?.email || "").toLowerCase() || email.includes("admin");
    demoUser = admin
      ? { id: "demo-admin", name: "Owner", email, role: "admin", customerId: null }
      : { id: "demo-customer", name: body.name || "Demo customer", email, role: "customer", customerId: "CUS-DEMO42" };
    return wait({ token: "demo", user: demoUser });
  },
};

let demoUser = null;
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const demoRef = (model) => `${model.prefix}-${[...Array(6)].map(() => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("")}`;

/** Same bill as the server works out (lib/payments.js). */
function demoBill(model, item) {
  const p = model.payment;
  const line = (description, quantity, unitPrice) => ({ description, quantity, unitPrice, total: quantity * unitPrice });
  if (!p?.enabled || !SITE.acceptPayments || !SITE.owner?.upiId) return { total: 0, lines: [] };
  if (p.from === "fixed") return { total: p.fixed, lines: [line(model.singular, 1, p.fixed)] };
  if (p.from === "field") return { total: Number(item[p.field]) || 0, lines: [line(model.singular, 1, Number(item[p.field]) || 0)] };
  const linkField = model.fields.find((f) => f.name === p.link);
  const target = SITE.models.find((m) => m.name === linkField.model);
  const linked = demoTable(target.key).find((t) => t._id === item[p.link]);
  const price = Number(linked?.[target.priceField]) || 0;
  const qty = p.quantity ? Math.max(1, Number(item[p.quantity]) || 1) : 1;
  const days = p.start && p.end && item[p.start] && item[p.end] ? Math.max(1, Math.round((Date.parse(item[p.end]) - Date.parse(item[p.start])) / 86400000)) : 1;
  const name = String(linked?.[target.titleField] ?? linkField.label);
  return { total: price * qty * days, lines: [line(days > 1 ? `${name} (${days} days × ₹${price.toLocaleString("en-IN")})` : name, qty, price * days)] };
}

function demoSubmission(model, item, i) {
  const bill = demoBill(model, item);
  const amount = bill.total;
  const status = i === undefined ? "unpaid" : ["paid", "verifying", "unpaid"][i % 3];
  return {
    reference: demoRef(model),
    accessKey: "demo",
    ...(amount > 0 ? { amount, receiptLines: bill.lines, paymentStatus: status, ...(status !== "unpaid" ? { paymentRef: "412345678901" } : {}) } : {}),
    customerEmail: i === undefined ? "" : `customer${i + 1}@example.com`,
    customerId: i === undefined ? "" : `CUS-DEMO${i + 1}${i + 1}`,
  };
}

/** Preview mode: receipt data like the server's lib/receipt.js. */
function receiptFrom(model, item) {
  const nameField = model.fields.find((f) => /^(name|fullName|customerName|patientName|studentName|guestName|parentName|ownerName|yourName)$/.test(f.name)) || model.fields.find((f) => f.name === model.titleField);
  const phoneField = model.fields.find((f) => f.type === "phone");
  const o = SITE.owner || {};
  const c = SITE.contact || {};
  const status = item.amount > 0 ? item.paymentStatus || "unpaid" : "none";
  return {
    kind: model.singular, number: item.reference, date: item.createdAt, status,
    statusText: { paid: "Paid", verifying: "Payment being checked", unpaid: "Payment due", none: "" }[status],
    business: { name: SITE.name, email: c.email || o.email || "", phone: c.phone || o.phone || "", address: c.address || "", upiId: o.upiId || "" },
    billedTo: { name: nameField ? String(item[nameField.name] || "") : "", email: item.customerEmail || "", phone: phoneField ? String(item[phoneField.name] || "") : "", customerId: item.customerId || "" },
    lines: item.receiptLines?.length ? item.receiptLines : item.amount > 0 ? [{ description: model.singular, quantity: 1, unitPrice: item.amount, total: item.amount }] : [],
    total: item.amount || 0, paymentRef: item.paymentRef || "", paidAt: item.paidAt || "",
    details: model.fields.filter((f) => item[f.name] !== undefined && item[f.name] !== "" && f.type !== "image" && f.type !== "relation").map((f) => [f.label, String(item[f.name])]),
  };
}

const withPay = (item) => {
  if (!item) return item;
  if (!(item.amount > 0)) return { ...item, payment: null };
  const o = SITE.owner || {};
  const enc = (v) => encodeURIComponent(v).replace(/%40/g, "@");
  return {
    ...item,
    payment: { amount: item.amount, status: item.paymentStatus, upiId: o.upiId, payeeName: o.payeeName || SITE.name, upiLink: `upi://pay?pa=${enc(o.upiId)}&pn=${enc(o.payeeName || SITE.name)}&am=${Number(item.amount).toFixed(2)}&cu=INR&tn=${enc(item.reference)}` },
  };
};

// ------------------------------------------------------------- public API

export const api = {
  list: (key, q) => (DEMO ? demo.list(key, q) : http.get(`/${key}`, { params: q ? { q } : {} }).then((r) => r.data)),
  get: (key, id) => (DEMO ? demo.get(key, id) : http.get(`/${key}/${id}`).then((r) => r.data)),
  create: (key, data) => (DEMO ? demo.create(key, data) : http.post(`/${key}`, data).then((r) => r.data)),
  update: (key, id, data) => (DEMO ? demo.update(key, id, data) : http.put(`/${key}/${id}`, data).then((r) => r.data)),
  remove: (key, id) => (DEMO ? demo.remove(key, id) : http.delete(`/${key}/${id}`).then((r) => r.data)),
  login: (body) => (DEMO ? demo.auth(body) : http.post("/auth/login", body).then((r) => r.data)),
  register: (body) => (DEMO ? demo.auth(body) : http.post("/auth/register", body).then((r) => r.data)),
  verify: (body) => (DEMO ? demo.auth(body) : http.post("/auth/verify", body).then((r) => r.data)),
  resend: (body) => (DEMO ? wait({}) : http.post("/auth/resend", body).then((r) => r.data)),
  forgot: (body) => (DEMO ? wait({ message: "Preview: no email is sent." }) : http.post("/auth/forgot", body).then((r) => r.data)),
  reset: (body) => (DEMO ? demo.auth(body) : http.post("/auth/reset", body).then((r) => r.data)),
  changePassword: (body) => (DEMO ? wait({ success: true }) : http.post("/auth/password", body).then((r) => r.data)),
  // orders/bookings
  mine: (key) => (DEMO ? demo.mine(key) : http.get(`/${key}/mine`).then((r) => r.data)),
  receipt: (key, id, k) => (DEMO ? demo.receipt(key, id) : http.get(`/${key}/${id}/receipt`, { params: k ? { k } : {} }).then((r) => r.data)),
  track: (key, id, k) => (DEMO ? demo.track(key, id) : http.get(`/${key}/track/${id}`, { params: { k } }).then((r) => r.data)),
  claimPayment: (key, id, body) => (DEMO ? demo.claim(key, id, body) : http.post(`/${key}/${id}/payment`, body).then((r) => r.data)),
  setPaymentStatus: (key, id, status) => (DEMO ? demo.setStatus(key, id, status) : http.post(`/${key}/${id}/payment-status`, { status }).then((r) => r.data)),
  me: () => (DEMO ? Promise.resolve(null) : http.get("/auth/me").then((r) => r.data.user)),
  stats: () => (DEMO ? demo.stats() : http.get("/stats").then((r) => r.data)),
  /** Upload a (resized) image; returns a URL to store in the record. */
  upload: (dataUrl) => (DEMO ? Promise.resolve(dataUrl) : http.post("/upload", { image: dataUrl }).then((r) => r.data.url)),
};
