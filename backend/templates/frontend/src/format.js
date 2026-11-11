import { SITE } from "./config.js";

export function formatValue(field, value) {
  if (value === undefined || value === null || value === "") return "";
  switch (field.type) {
    case "price":
      return `${SITE.currency}${Number(value).toLocaleString("en-IN")}`;
    case "number":
      return Number(value).toLocaleString("en-IN");
    case "boolean":
      return value ? "Yes" : "No";
    case "date": {
      const d = new Date(`${value}T00:00:00`);
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    }
    default:
      return String(value);
  }
}

export const emptyForm = (fields) =>
  Object.fromEntries(fields.map((f) => [f.name, f.type === "boolean" ? false : f.type === "select" && f.required ? f.options[0] : ""]));

export function itemToForm(fields, item) {
  const form = emptyForm(fields);
  for (const f of fields) if (item[f.name] !== undefined && item[f.name] !== null) form[f.name] = item[f.name];
  return form;
}

export function formToPayload(fields, form) {
  const out = {};
  for (const f of fields) {
    const v = form[f.name];
    if (f.type === "boolean") out[f.name] = Boolean(v);
    else if (v === "" || v === undefined) out[f.name] = "";
    else if (f.type === "number" || f.type === "price") out[f.name] = Number(v);
    else out[f.name] = v;
  }
  return out;
}

/** +919876543210 -> +91 98765 43210 (other numbers are shown as typed). */
export function prettyPhone(p) {
  const s = String(p || "").trim();
  const m = s.replace(/[\s-]/g, "").match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : s;
}
