import { useState } from "react";
import Icon from "./Icon.jsx";

const MAX_TOTAL = 4_500_000; // keep the whole plan comfortably under the server's limit
const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

/** Shrink a photo to max 900 px and JPEG, so it fits in the plan. */
export function readPhoto(file, max = 900, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error("Please choose an image file."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let data = c.toDataURL("image/jpeg", quality);
      if (data.length > 380000) data = c.toDataURL("image/jpeg", 0.6);
      resolve(data);
    };
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = url;
  });
}

function FieldInput({ field, value, onChange, models, sampleData }) {
  const id = `c-${field.name}`;
  const common = { id, value: value ?? "", onChange: (e) => onChange(e.target.value) };
  switch (field.type) {
    case "textarea":
      return <textarea rows={3} {...common} />;
    case "number":
    case "price":
      return <input type="number" min="0" step="any" inputMode="decimal" {...common} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
    case "boolean":
      return <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
    case "date":
      return <input type="date" {...common} />;
    case "time":
      return <input type="time" {...common} />;
    case "email":
      return <input type="email" {...common} />;
    case "phone":
      return <input type="tel" {...common} />;
    case "url":
      return <input type="url" placeholder="https://…" {...common} />;
    case "select":
      return (
        <select {...common}>
          <option value="">Choose…</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "relation": {
      const target = models.find((m) => m.name === field.model);
      const titles = (sampleData[field.model] || []).map((r) => String(r[target?.titleField] ?? "")).filter(Boolean);
      return (
        <select {...common}>
          <option value="">Choose…</option>
          {titles.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      );
    }
    case "image":
      return <PhotoInput value={value} onChange={onChange} />;
    default:
      return <input {...common} />;
  }
}

function PhotoInput({ value, onChange }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pick = async (file) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      onChange(await readPhoto(file));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className={value ? "photo-drop has" : "photo-drop"}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        pick(e.dataTransfer.files?.[0]);
      }}
    >
      {value ? <img src={value} alt="" /> : <Icon name="Image" size={22} />}
      <div className="photo-actions">
        <label className="btn ghost small">
          {busy ? "Adding…" : value ? "Change photo" : "Upload photo"}
          <input type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {value && <button type="button" className="link small" onClick={() => onChange("")}>Remove</button>}
        {!value && <span className="muted small">or drop a photo here</span>}
      </div>
      {error && <span className="alert warn small">{error}</span>}
    </div>
  );
}

/**
 * "Your content": the items a page starts with (products, menu, services…),
 * with photos and prices. They go into the site when it's first deployed.
 */
export default function ContentEditor({ blueprint, model, onChange }) {
  const bp = blueprint;
  const items = bp.sampleData?.[model.name] || [];
  const [editing, setEditing] = useState(null); // index, or "new"
  const [draft, setDraft] = useState({});
  const [error, setError] = useState("");
  const titleField = model.fields.find((f) => f.name === model.titleField) || model.fields[0];
  const priceField = model.fields.find((f) => f.type === "price");
  const imageField = model.fields.find((f) => f.type === "image");
  const own = (bp.contentEdited || []).includes(model.name);

  const save = (list) => {
    const next = JSON.parse(JSON.stringify(bp));
    next.sampleData = { ...(next.sampleData || {}), [model.name]: list };
    next.contentEdited = [...new Set([...(next.contentEdited || []), model.name])];
    const size = JSON.stringify(next.sampleData).length;
    if (size > MAX_TOTAL) {
      setError("That's too many photos for one plan. Use smaller photos, or add the rest on your live site after deploying.");
      return false;
    }
    setError("");
    onChange(next);
    return true;
  };

  const open = (i) => {
    setEditing(i);
    setDraft(i === "new" ? {} : { ...items[i] });
  };
  const commit = () => {
    const missing = model.fields.filter((f) => f.required && (draft[f.name] === undefined || draft[f.name] === ""));
    if (missing.length) return setError(`Please fill in: ${missing.map((f) => f.label).join(", ")}.`);
    const clean = Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== "" && v !== undefined));
    const list = editing === "new" ? [...items, clean] : items.map((x, j) => (j === editing ? clean : x));
    if (save(list)) setEditing(null);
  };
  const remove = (i) => save(items.filter((_, j) => j !== i));
  const move = (i, d) => {
    const list = [...items];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    save(list);
  };
  const clearSamples = () => save([]);

  return (
    <div className="content-editor">
      <div className="row between wrap">
        <h4>Your {model.label.toLowerCase()} <span className="count-pill">{items.length}</span></h4>
        <div className="row wrap">
          {!own && items.length > 0 && <button type="button" className="link small" onClick={clearSamples}>Remove the sample items</button>}
          <button type="button" className="btn primary small" onClick={() => open("new")} disabled={editing !== null || items.length >= 60}>
            <Icon name="Plus" size={15} /> Add {model.singular.toLowerCase()}
          </button>
        </div>
      </div>
      {!own && items.length > 0 && <p className="muted small">These are sample items. Edit them or remove them and add your own.</p>}

      {editing !== null && (
        <div className="content-form">
          <div className="grid-2">
            {model.fields.map((f) => (
              <label key={f.name} className={f.type === "textarea" || f.type === "image" ? "field span-2" : f.type === "boolean" ? "field check-field" : "field"} htmlFor={`c-${f.name}`}>
                <span>{f.label}{f.required && " *"}</span>
                <FieldInput field={f} value={draft[f.name]} onChange={(v) => setDraft({ ...draft, [f.name]: v })} models={bp.models} sampleData={bp.sampleData || {}} />
              </label>
            ))}
          </div>
          {error && <p className="alert error small">{error}</p>}
          <div className="row">
            <button type="button" className="btn primary small" onClick={commit}><Icon name="Check" size={15} /> {editing === "new" ? "Add" : "Save"}</button>
            <button type="button" className="btn ghost small" onClick={() => { setEditing(null); setError(""); }}>Cancel</button>
          </div>
        </div>
      )}
      {editing === null && error && <p className="alert error small">{error}</p>}

      {items.length === 0 ? (
        editing === null && <p className="muted small empty-content">No {model.label.toLowerCase()} yet. Add your first one, with a photo and price.</p>
      ) : (
        <ul className="content-list">
          {items.map((item, i) => (
            <li key={i} className="content-item">
              <div className="content-thumb">
                {imageField && item[imageField.name] ? <img src={item[imageField.name]} alt="" /> : <Icon icon={model.icon} words={model.name} size={18} />}
              </div>
              <div className="content-text">
                <strong>{String(item[titleField?.name] ?? `Item ${i + 1}`)}</strong>
                {priceField && item[priceField.name] !== undefined && <span className="muted small">{money(item[priceField.name])}</span>}
              </div>
              <div className="content-actions">
                <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><Icon name="ChevronUp" size={16} /></button>
                <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down"><Icon name="ChevronDown" size={16} /></button>
                <button type="button" className="icon-btn" onClick={() => open(i)} disabled={editing !== null} aria-label={`Edit ${item[titleField?.name] ?? ""}`}><Icon name="Pencil" size={15} /></button>
                <button type="button" className="icon-btn danger" onClick={() => remove(i)} aria-label={`Delete ${item[titleField?.name] ?? ""}`}><Icon name="Trash2" size={15} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        These items go into your site when it's first deployed, and show in the preview right away. After that, add and edit items on your live site: log in as admin and use <b>+ Add</b> or <b>Edit</b>.
      </p>
    </div>
  );
}
