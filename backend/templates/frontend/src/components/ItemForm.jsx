import { useState } from "react";
import { emptyForm, formToPayload, itemToForm } from "../format.js";
import { errorMessage } from "../api.js";
import { useLookup } from "../lookup.js";
import ImageInput from "./ImageInput.jsx";

function RelationSelect({ field, common, value, onChange }) {
  const { options, loading } = useLookup(field.model);
  return (
    <select {...common} value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={loading}>
      <option value="">{loading ? "Loading…" : field.required ? `Choose ${field.label.toLowerCase()}…` : "—"}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.title}</option>
      ))}
    </select>
  );
}

function Input({ field, value, onChange }) {
  const id = `f-${field.name}`;
  const common = { id, name: field.name, required: field.required };

  if (field.type === "boolean") {
    return (
      <label className="check" htmlFor={id}>
        <input {...common} required={false} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        <span>{field.label}</span>
      </label>
    );
  }

  let control;
  if (field.type === "image") {
    control = <ImageInput id={id} value={value} onChange={onChange} />;
  } else if (field.type === "relation") {
    control = <RelationSelect field={field} common={common} value={value} onChange={onChange} />;
  } else if (field.type === "textarea") {
    control = <textarea {...common} rows={4} value={value} onChange={(e) => onChange(e.target.value)} />;
  } else if (field.type === "select") {
    control = (
      <select {...common} value={value} onChange={(e) => onChange(e.target.value)}>
        {!field.required && <option value="">—</option>}
        {field.options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  } else {
    const type =
      { number: "number", price: "number", date: "date", time: "time", email: "email", phone: "tel", url: "url" }[field.type] || "text";
    control = (
      <input
        {...common}
        type={type}
        step={field.type === "price" ? "0.01" : undefined}
        min={field.type === "price" ? "0" : undefined}
        placeholder={field.type === "url" ? "https://…" : ""}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const caption = (
    <span>
      {field.label}
      {field.required && <b className="req"> *</b>}
    </span>
  );
  // The image picker has its own buttons, so it can't sit inside a <label>.
  if (field.type === "image") {
    return (
      <div className="field">
        {caption}
        {control}
      </div>
    );
  }
  return (
    <label className="field" htmlFor={id}>
      {caption}
      {control}
    </label>
  );
}

export default function ItemForm({ model, item, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => (item ? itemToForm(model.fields, item) : emptyForm(model.fields)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(formToPayload(model.fields, form));
      if (!item) setForm(emptyForm(model.fields));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="item-form" onSubmit={submit}>
      <div className="form-grid">
        {model.fields.map((f) => (
          <div key={f.name} className={f.type === "textarea" ? "span-2" : ""}>
            <Input field={f} value={form[f.name]} onChange={(v) => setForm((prev) => ({ ...prev, [f.name]: v }))} />
          </div>
        ))}
      </div>
      {error && <p className="alert error">{error}</p>}
      <div className="actions">
        <button className="btn primary" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
