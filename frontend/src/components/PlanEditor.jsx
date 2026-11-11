import { useState } from "react";
import Icon, { IconPicker } from "./Icon.jsx";
import ContentEditor from "./ContentEditor.jsx";

const FIELD_TYPES = [
  ["text", "Short text"],
  ["textarea", "Long text"],
  ["number", "Number"],
  ["price", "Price"],
  ["boolean", "Yes / No"],
  ["date", "Date"],
  ["time", "Time"],
  ["select", "Choice list"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["url", "Link"],
  ["image", "Image (upload)"],
  ["relation", "Link to another page"],
];

const LAYOUTS = [
  ["cards", "Cards"],
  ["table", "Table"],
  ["gallery", "Photo gallery", (m) => m.fields.some((f) => f.type === "image")],
  ["calendar", "Calendar", (m) => m.fields.some((f) => f.type === "date")],
  ["board", "Board (columns)", (m) => m.fields.some((f) => f.type === "select")],
];

const seeOptions = [
  ["public", "Everyone"],
  ["admin", "Only the admin"],
  ["own", "Each user sees only their own"],
];

const clone = (v) => JSON.parse(JSON.stringify(v));

/** Visual editor for the app plan. Calls onChange(newBlueprint) on every edit. */
export default function PlanEditor({ blueprint, onChange, emailReady = true }) {
  const [json, setJson] = useState(null); // advanced JSON editor text
  const [jsonError, setJsonError] = useState("");
  const bp = blueprint;

  const update = (fn) => {
    const next = clone(bp);
    fn(next);
    onChange(next);
  };

  const access = (m) => (m.ownedByUser ? "own" : m.public?.list ? "public" : "admin");
  const setAccess = (i, v) =>
    update((b) => {
      const m = b.models[i];
      m.ownedByUser = v === "own";
      m.public = { ...m.public, list: v === "public", create: v === "own" ? false : m.public?.create };
      if (v === "own") b.auth = true;
    });

  return (
    <div className="plan">
      <section className="card">
        <h3>Website</h3>
        <div className="grid-2">
          <label className="field"><span>Name</span><input value={bp.name} onChange={(e) => update((b) => (b.name = e.target.value))} /></label>
          <label className="field"><span>Tagline</span><input value={bp.tagline} onChange={(e) => update((b) => (b.tagline = e.target.value))} /></label>
          <label className="field"><span>Big heading</span><input value={bp.hero.title} onChange={(e) => update((b) => (b.hero.title = e.target.value))} /></label>
          <label className="field"><span>Button text</span><input value={bp.hero.cta} onChange={(e) => update((b) => (b.hero.cta = e.target.value))} /></label>
          <label className="field span-2"><span>Intro text</span><textarea rows={2} value={bp.hero.subtitle} onChange={(e) => update((b) => (b.hero.subtitle = e.target.value))} /></label>
        </div>
        <div className="row wrap">
          <label className="field color"><span>Main colour</span><input type="color" value={bp.theme.primary} onChange={(e) => update((b) => (b.theme.primary = e.target.value))} /></label>
          <label className="field color"><span>Accent</span><input type="color" value={bp.theme.accent} onChange={(e) => update((b) => (b.theme.accent = e.target.value))} /></label>
          <label className="field"><span>Mode</span>
            <select value={bp.theme.mode} onChange={(e) => update((b) => (b.theme.mode = e.target.value))}><option value="crystal">Crystal black</option><option value="dark">Dark</option><option value="light">Light</option></select>
          </label>
          <label className="field"><span>Font</span>
            <select value={bp.theme.font} onChange={(e) => update((b) => (b.theme.font = e.target.value))}>
              <option value="sans">Modern</option><option value="serif">Elegant (serif)</option><option value="rounded">Friendly (rounded)</option><option value="mono">Techy (mono)</option>
            </select>
          </label>
          <label className="field"><span>Currency</span><input className="short" value={bp.currency} onChange={(e) => update((b) => (b.currency = e.target.value))} /></label>
          <label className="check"><input type="checkbox" checked={bp.auth} onChange={(e) => update((b) => (b.auth = e.target.checked))} /> Login & admin</label>
        </div>
      </section>

      <section className="card">
        <h3>Contact details on the site</h3>
        <p className="muted small">Shown in the site's footer. Leave empty to show your business email and mobile.</p>
        <div className="grid-2">
          <label className="field"><span>Contact email (shown on the site)</span>
            <input type="email" value={bp.contact?.email || ""} placeholder="hello@yourbusiness.com" onChange={(e) => update((b) => (b.contact = { ...b.contact, email: e.target.value }))} />
          </label>
          <label className="field"><span>Phone</span>
            <input value={bp.contact?.phone || ""} placeholder="+91 98765 43210" onChange={(e) => update((b) => (b.contact = { ...b.contact, phone: e.target.value }))} />
          </label>
          <label className="field span-2"><span>Address</span>
            <input value={bp.contact?.address || ""} placeholder="Shop no., street, city" onChange={(e) => update((b) => (b.contact = { ...b.contact, address: e.target.value }))} />
          </label>
          {!bp.auth && (
            <label className="field span-2"><span>Send form submissions to this email</span>
              <input type="email" value={bp.notifyEmail || ""} placeholder="you@gmail.com" onChange={(e) => update((b) => (b.notifyEmail = e.target.value))} />
            </label>
          )}
        </div>
        <label className="check"><input type="checkbox" checked={Boolean(bp.contactForm)} onChange={(e) => update((b) => (b.contactForm = e.target.checked))} /> Add a "Contact us" form page</label>
        {bp.notifyEmail && !emailReady && (
          <p className="alert warn small">To actually send these emails, add GMAIL_USER and GMAIL_APP_PASSWORD to backend/.env and restart the backend.</p>
        )}
      </section>

      <section className="card">
        <h3>Highlights on the home page</h3>
        {bp.features.map((f, i) => (
          <div key={i} className="row feature-row">
            <IconPicker value={f.icon} onChange={(v) => update((b) => (b.features[i].icon = v))} />
            <input value={f.title} placeholder="Title" onChange={(e) => update((b) => (b.features[i].title = e.target.value))} />
            <input className="grow" value={f.text} placeholder="Short text" onChange={(e) => update((b) => (b.features[i].text = e.target.value))} />
            <button className="btn ghost small" onClick={() => update((b) => b.features.splice(i, 1))} aria-label="Remove"><Icon name="X" size={15} /></button>
          </div>
        ))}
        {bp.features.length < 6 && <button className="link" onClick={() => update((b) => b.features.push({ icon: "✨", title: "", text: "" }))}>+ Add highlight</button>}
      </section>

      <h3 className="section-title">Pages & data</h3>
      {bp.models.map((m, i) => (
        <section key={i} className="card model">
          <div className="model-head">
            <IconPicker value={m.icon} onChange={(v) => update((b) => (b.models[i].icon = v))} />
            <label className="field grow"><span>Page name</span><input value={m.label} onChange={(e) => update((b) => (b.models[i].label = e.target.value))} /></label>
            <label className="field"><span>Data type (singular)</span><input value={m.name} onChange={(e) => update((b) => (b.models[i].name = e.target.value))} /></label>
            {m.autoContact && <span className="badge">Contact form</span>}
            {bp.models.length > 1 && (
              <button className="btn danger small" onClick={() => window.confirm(`Remove "${m.label}"?`) && update((b) => { if (m.autoContact) b.contactForm = false; b.models.splice(i, 1); })}>Remove</button>
            )}
          </div>

          {bp.auth && (
            <div className="row wrap">
              <label className="field"><span>Who can see the list</span>
                <select value={access(m)} onChange={(e) => setAccess(i, e.target.value)}>
                  {seeOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              {!m.ownedByUser && (
                <label className="field"><span>Who can add new ones</span>
                  <select value={m.public?.create ? "public" : "admin"} onChange={(e) => update((b) => (b.models[i].public = { ...b.models[i].public, create: e.target.value === "public" }))}>
                    <option value="public">Everyone (bookings, orders, forms)</option>
                    <option value="admin">Only the admin</option>
                  </select>
                </label>
              )}
            </div>
          )}

          <div className="row wrap">
            <label className="field"><span>Page layout</span>
              <select value={m.layout || "cards"} onChange={(e) => update((b) => (b.models[i].layout = e.target.value))}>
                {LAYOUTS.filter(([, , ok]) => !ok || ok(m)).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            {(!bp.auth || m.public?.create) && !m.ownedByUser && (
              <label className="check"><input type="checkbox" checked={m.notify !== false} onChange={(e) => update((b) => (b.models[i].notify = e.target.checked))} /> Email me new {m.label.toLowerCase()}</label>
            )}
          </div>

          <table className="fields">
            <thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Choices / linked page</th><th /></tr></thead>
            <tbody>
              {m.fields.map((f, j) => (
                <tr key={j}>
                  <td><input value={f.label} onChange={(e) => update((b) => { const fld = b.models[i].fields[j]; fld.label = e.target.value; fld.name = e.target.value; })} /></td>
                  <td>
                    <select value={f.type} onChange={(e) => update((b) => {
                      const fld = b.models[i].fields[j];
                      fld.type = e.target.value;
                      if (e.target.value === "select" && !fld.options?.length) fld.options = ["Option 1", "Option 2"];
                      if (e.target.value === "relation") fld.model = fld.model || b.models.find((x, k) => k !== i)?.name;
                    })}>
                      {FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td className="center"><input type="checkbox" checked={Boolean(f.required)} onChange={(e) => update((b) => (b.models[i].fields[j].required = e.target.checked))} /></td>
                  <td>
                    {f.type === "select" ? (
                      <input value={(f.options || []).join(", ")} onChange={(e) => update((b) => (b.models[i].fields[j].options = e.target.value.split(",").map((s) => s.trim())))} />
                    ) : f.type === "relation" ? (
                      <select value={f.model || ""} onChange={(e) => update((b) => (b.models[i].fields[j].model = e.target.value))} aria-label="Linked page">
                        {bp.models.filter((x, k) => k !== i).map((x) => <option key={x.name} value={x.name}>Link to {x.label}</option>)}
                      </select>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td>{m.fields.length > 1 && <button className="btn ghost small" onClick={() => update((b) => b.models[i].fields.splice(j, 1))} aria-label="Remove field"><Icon name="X" size={15} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {m.fields.length < 12 && (
            <button className="link" onClick={() => update((b) => b.models[i].fields.push({ name: `field${m.fields.length + 1}`, label: "New field", type: "text", required: false }))}>+ Add field</button>
          )}
          {!m.submission && !m.ownedByUser && !m.autoContact && (
            <ContentEditor blueprint={bp} model={m} onChange={onChange} />
          )}
        </section>
      ))}

      {bp.models.length < 6 && (
        <button
          className="btn ghost"
          onClick={() =>
            update((b) =>
              b.models.push({
                name: `Item${b.models.length + 1}`,
                label: "New page",
                icon: "📄",
                public: { list: true, create: false },
                fields: [{ name: "name", label: "Name", type: "text", required: true }, { name: "description", label: "Description", type: "textarea" }],
              })
            )
          }
        >
          + Add a data type / page
        </button>
      )}

      <details className="card advanced" onToggle={(e) => setJson(e.currentTarget.open ? JSON.stringify(bp, null, 2) : null)}>
        <summary>Advanced: edit the plan as JSON (including sample data and contact details)</summary>
        {json !== null && (
          <>
            <textarea className="mono" rows={18} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
            {jsonError && <p className="alert error">{jsonError}</p>}
            <button
              className="btn primary small"
              onClick={() => {
                try {
                  onChange(JSON.parse(json));
                  setJsonError("");
                } catch (e) {
                  setJsonError(`Not valid JSON: ${e.message}`);
                }
              }}
            >
              Apply JSON
            </button>
          </>
        )}
      </details>
    </div>
  );
}
