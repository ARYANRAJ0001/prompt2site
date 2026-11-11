const SITE = require("../config/site");
const { linkTitle } = require("./links");

/**
 * Receipts for orders and bookings: the same data is used for the email the
 * customer gets and for the printable receipt page on the site.
 */

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const NAME_RE = /^(name|fullName|customerName|patientName|studentName|guestName|parentName|ownerName|yourName)$/;
const fmtDate = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: process.env.TZ || "Asia/Kolkata" });

/** The form's fields as [label, value] rows. */
async function detailRows(def, item) {
  const rows = [];
  for (const f of def.fields) {
    let v = item[f.name];
    if (v === undefined || v === null || v === "") continue;
    if (f.type === "boolean") v = v ? "Yes" : "No";
    else if (f.type === "image") v = String(v).startsWith("data:") ? "(photo attached in the app)" : v;
    else if (f.type === "relation") v = await linkTitle(f, v);
    else if (f.type === "price") v = money(v);
    rows.push([f.label, String(v)]);
  }
  return rows;
}

const STATUS_TEXT = { paid: "Paid", verifying: "Payment being checked", unpaid: "Payment due", none: "" };

async function data(def, item) {
  const field = (test) => def.fields.find(test);
  const nameField = field((f) => NAME_RE.test(f.name)) || field((f) => f.name === def.titleField);
  const phoneField = field((f) => f.type === "phone");
  const lines = item.receiptLines?.length
    ? item.receiptLines
    : item.amount > 0
      ? [{ description: def.singular, quantity: 1, unitPrice: item.amount, total: item.amount }]
      : [];
  const o = SITE.owner || {};
  const c = SITE.contact || {};
  return {
    kind: def.singular,
    number: item.reference,
    date: item.createdAt,
    status: item.amount > 0 ? item.paymentStatus || "unpaid" : "none",
    statusText: STATUS_TEXT[item.amount > 0 ? item.paymentStatus || "unpaid" : "none"],
    business: { name: SITE.name, email: c.email || o.email || "", phone: c.phone || o.phone || "", address: c.address || "", upiId: o.upiId || "" },
    billedTo: {
      name: nameField ? String(item[nameField.name] || "") : "",
      email: item.customerEmail || "",
      phone: phoneField ? String(item[phoneField.name] || "") : "",
      customerId: item.customerId || "",
    },
    lines,
    total: item.amount || 0,
    paymentRef: item.paymentRef || "",
    paidAt: item.paidAt || "",
    details: await detailRows(def, item),
  };
}

/** HTML receipt for email (inline styles only — email apps ignore <style>). */
function html(r, { intro = "", button } = {}) {
  const paid = r.status === "paid";
  const td = 'style="padding:8px 10px;border-bottom:1px solid #eee"';
  const tdr = 'style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap"';
  const biz = [r.business.address, r.business.phone, r.business.email].filter(Boolean).map(esc).join(" · ");
  const bill = [r.billedTo.name, r.billedTo.phone, r.billedTo.email, r.billedTo.customerId && `Customer ID ${r.billedTo.customerId}`].filter(Boolean).map(esc).join("<br>");
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1b1d24">
  ${intro ? `<p>${esc(intro)}</p>` : ""}
  <div style="border:1px solid #e3e5ec;border-radius:12px;padding:20px">
    <table style="width:100%;border-collapse:collapse"><tr>
      <td><div style="font-size:20px;font-weight:700">${esc(r.business.name)}</div><div style="color:#666;font-size:13px">${biz}</div></td>
      <td style="text-align:right;vertical-align:top">
        <div style="font-size:12px;letter-spacing:1px;color:#666;text-transform:uppercase">${paid ? "Payment receipt" : `${esc(r.kind)} receipt`}</div>
        ${r.statusText ? `<div style="display:inline-block;margin-top:6px;padding:4px 10px;border-radius:999px;font-weight:700;font-size:13px;background:${paid ? "#dcfce7;color:#166534" : "#fef3c7;color:#92400e"}">${esc(r.statusText)}</div>` : ""}
      </td>
    </tr></table>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px"><tr>
      <td style="vertical-align:top"><div style="color:#666;font-size:12px">BILLED TO</div>${bill || "—"}</td>
      <td style="vertical-align:top;text-align:right"><div style="color:#666;font-size:12px">RECEIPT NO.</div><b>${esc(r.number)}</b><div style="color:#666;font-size:12px;margin-top:6px">DATE</div>${esc(fmtDate(r.date))}</td>
    </tr></table>
    ${r.lines.length ? `<table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr style="background:#f6f7fb"><th ${td} align="left">Item</th><th ${tdr}>Qty</th><th ${tdr}>Price</th><th ${tdr}>Amount</th></tr>
      ${r.lines.map((l) => `<tr><td ${td}>${esc(l.description)}</td><td ${tdr}>${esc(l.quantity)}</td><td ${tdr}>${money(l.unitPrice)}</td><td ${tdr}>${money(l.total)}</td></tr>`).join("")}
      <tr><td colspan="3" style="padding:10px;text-align:right;font-weight:700">Total</td><td style="padding:10px;text-align:right;font-weight:700;font-size:16px;white-space:nowrap">${money(r.total)}</td></tr>
    </table>` : ""}
    ${paid ? `<p style="font-size:13px;color:#166534">✅ Paid by UPI${r.paidAt ? ` · confirmed ${esc(fmtDate(r.paidAt))}` : ""}${r.paymentRef ? ` · UTR ${esc(r.paymentRef)}` : ""}</p>` : ""}
    ${!paid && r.total > 0 && r.business.upiId ? `<p style="font-size:13px;color:#92400e">Please pay ${money(r.total)} by UPI to <b>${esc(r.business.upiId)}</b> with the note <b>${esc(r.number)}</b>.${r.status === "verifying" ? " We're checking your payment." : ""}</p>` : ""}
    ${r.details.length ? `<details open><summary style="color:#666;font-size:12px;margin-top:10px">DETAILS</summary><table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px">${r.details
      .map(([k, v]) => `<tr><td style="padding:4px 10px 4px 0;color:#666;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`)
      .join("")}</table></details>` : ""}
  </div>
  ${button ? `<p style="margin:18px 0;text-align:center"><a href="${esc(button.url)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${esc(button.label)}</a></p>` : ""}
  <p style="color:#999;font-size:12px;text-align:center">Thank you for choosing ${esc(r.business.name)}. Keep this email as your receipt.</p>
</div>`;
}

function text(r, intro = "") {
  return [
    intro,
    `${r.business.name} — ${r.status === "paid" ? "Payment receipt" : `${r.kind} receipt`}`,
    `Receipt no: ${r.number}`,
    `Date: ${fmtDate(r.date)}`,
    r.billedTo.name && `Billed to: ${r.billedTo.name}`,
    ...r.lines.map((l) => `${l.description} × ${l.quantity} @ ${money(l.unitPrice)} = ${money(l.total)}`),
    r.total > 0 && `Total: ${money(r.total)}`,
    r.statusText && `Status: ${r.statusText}${r.paymentRef ? ` (UTR ${r.paymentRef})` : ""}`,
    "",
    ...r.details.map(([k, v]) => `${k}: ${v}`),
  ]
    .filter((x) => x !== false && x !== "")
    .join("\n");
}

module.exports = { data, html, text, detailRows, money };
