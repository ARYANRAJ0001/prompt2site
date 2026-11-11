import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SITE } from "../config.js";
import { api, errorMessage } from "../api.js";
import { useAuth, permissions } from "../auth.jsx";
import ItemForm from "../components/ItemForm.jsx";
import { VIEWS, availableLayouts } from "../components/Views.jsx";
import { refreshLookup } from "../lookup.js";
import Submitted from "../components/Submitted.jsx";
import { saved } from "../payment.js";

const savedLayout = (key) => {
  try {
    return localStorage.getItem(`layout:${key}`);
  } catch {
    return null;
  }
};
import NotFound from "./NotFound.jsx";
import Icon from "../components/Icon.jsx";

export default function ModelPage() {
  const { key } = useParams();
  const model = SITE.models.find((m) => m.key === key);
  const auth = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | item
  const [sent, setSent] = useState(null); // the submitted item (orders, bookings…)
  const [layout, setLayoutState] = useState(null);

  const can = model ? permissions(model, auth) : {};
  const filterField = model?.fields.find((f) => f.type === "select");

  const load = async () => {
    if (!model || !can.view) return;
    setLoading(true);
    setError("");
    try {
      const rows = await api.list(model.key);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEditing(null);
    setSent(null);
    setFilter("");
    if (model) {
      const ok = availableLayouts(model).map(([id]) => id);
      const saved = savedLayout(model.key);
      setLayoutState(ok.includes(saved) ? saved : ok.includes(model.layout) ? model.layout : "cards");
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, can.view, auth.user]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) => (!filter || i[filterField?.name] === filter) && (!q || JSON.stringify(i).toLowerCase().includes(q))
    );
  }, [items, query, filter, filterField]);

  if (!model) return <NotFound />;

  // Not allowed to see anything yet.
  if (!can.view && !can.submit) {
    return (
      <section className="section">
        <div className="container narrow center-text">
          <h1>{model.label}</h1>
          <p className="muted">{model.ownedByUser ? "Log in to see and manage yours." : "This page is only for the site admin."}</p>
          {SITE.auth && !auth.user && <Link to="/login" className="btn primary">Log in or sign up</Link>}
        </div>
      </section>
    );
  }

  // Visitors who can only submit (bookings, orders, contact forms).
  if (!can.view && can.submit) {
    const mustLogin = model.loginRequired && !auth.user;
    // Fill in what we already know about a logged-in customer.
    const prefill = {};
    if (auth.user) {
      for (const f of model.fields) {
        if (f.type === "email") prefill[f.name] = auth.user.email;
        else if (f.type === "phone" && auth.user.phone) prefill[f.name] = auth.user.phone;
        else if (f.type === "text" && /^(name|fullName|customerName|patientName|studentName|guestName|yourName)$/.test(f.name)) prefill[f.name] = auth.user.name;
      }
    }
    return (
      <section className="section">
        <div className="container narrow">
          <h1>{model.label}</h1>
          {model.description && <p className="muted">{model.description}</p>}
          {sent ? (
            <Submitted model={model} item={sent} onAgain={() => setSent(null)} />
          ) : mustLogin ? (
            <div className="card center-text">
              <p>Please log in or create an account to continue. You'll get a customer ID to track your {model.label.toLowerCase()}.</p>
              <div className="actions center">
                <Link to={`/login?next=/${model.key}`} className="btn primary">Log in</Link>
                <Link to={`/login?signup=1&next=/${model.key}`} className="btn ghost">Create an account</Link>
              </div>
            </div>
          ) : (
            <div className="card">
              {model.payment?.enabled && SITE.acceptPayments && SITE.owner?.upiId && (
                <p className="muted small pay-hint"><Icon name="IndianRupee" size={15} /> You can pay by UPI right after submitting.</p>
              )}
              <ItemForm
                key={auth.user?.id || "guest"}
                model={model}
                item={Object.keys(prefill).length ? prefill : null}
                submitLabel="Submit"
                onSubmit={async (data) => {
                  const created = await api.create(model.key, data);
                  if (model.submission && !auth.user) saved.add({ key: model.key, id: created._id, k: created.accessKey, ref: created.reference });
                  setSent(created);
                  window.scrollTo?.({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          )}
        </div>
      </section>
    );
  }

  const setLayout = (id) => {
    setLayoutState(id);
    try {
      localStorage.setItem(`layout:${model.key}`, id);
    } catch {}
  };

  const setPayment = async (item, status) => {
    try {
      const updated = await api.setPaymentStatus(model.key, item._id, status);
      setItems((rows) => rows.map((r) => (r._id === updated._id ? updated : r)));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const move = async (item, change) => {
    try {
      const updated = await api.update(model.key, item._id, change);
      setItems((rows) => rows.map((r) => (r._id === updated._id ? updated : r)));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item[model.titleField]}"?`)) return;
    try {
      await api.remove(model.key, item._id);
      refreshLookup(model.name);
      setItems((rows) => rows.filter((r) => r._id !== item._id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const canAdd = can.manage || can.submit;

  return (
    <section className="section">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>{model.label}</h1>
            {model.description && <p className="muted">{model.description}</p>}
          </div>
          {canAdd && editing === null && (
            <button className="btn primary" onClick={() => setEditing("new")}>+ Add {model.singular.toLowerCase()}</button>
          )}
        </div>

        {editing !== null && (
          <div className="card form-card">
            <h2>{editing === "new" ? `New ${model.singular.toLowerCase()}` : `Edit ${model.singular.toLowerCase()}`}</h2>
            <ItemForm
              model={model}
              item={editing === "new" ? null : editing}
              submitLabel={editing === "new" ? "Add" : "Save changes"}
              onCancel={() => setEditing(null)}
              onSubmit={async (data) => {
                if (editing === "new") {
                  const created = await api.create(model.key, data);
                  setItems((rows) => (model.newestFirst ? [created, ...rows] : [...rows, created]));
                } else {
                  const updated = await api.update(model.key, editing._id, data);
                  setItems((rows) => rows.map((r) => (r._id === updated._id ? updated : r)));
                }
                refreshLookup(model.name);
                setEditing(null);
              }}
            />
          </div>
        )}

        <div className="toolbar">
          {availableLayouts(model).length > 2 || layout !== "cards" ? (
            <div className="layout-switch" role="group" aria-label="Layout">
              {availableLayouts(model).map(([id, label, icon]) => (
                <button key={id} className={layout === id ? "seg active" : "seg"} aria-pressed={layout === id} onClick={() => setLayout(id)}><Icon name={icon} size={16} /> {label}</button>
              ))}
            </div>
          ) : null}
          <input className="search" type="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {filterField && (
            <div className="chips">
              <button className={!filter ? "chip active" : "chip"} onClick={() => setFilter("")}>All</button>
              {filterField.options.map((o) => (
                <button key={o} className={filter === o ? "chip active" : "chip"} onClick={() => setFilter(o)}>{o}</button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="alert error">
            {error} <button className="link" onClick={load}>Try again</button>
          </p>
        )}

        {loading ? (
          <p className="muted">Waking the server up. This can take up to a minute the first time.</p>
        ) : shown.length === 0 && !(items.length === 0 && ["board", "calendar"].includes(layout)) ? (
          <div className="empty">
            <p>{items.length ? "Nothing matches that search. Try a shorter word." : `No ${model.label.toLowerCase()} yet.`}</p>
          </div>
        ) : (
          (() => {
            const View = VIEWS[layout] || VIEWS.cards;
            return (
              <View
                model={model}
                items={shown}
                onEdit={can.manage ? (it) => { setEditing(it); window.scrollTo?.({ top: 0, behavior: "smooth" }); } : null}
                onDelete={can.manage ? remove : null}
                onMove={can.manage ? move : null}
                onPayment={can.manage && model.submission ? setPayment : null}
              />
            );
          })()
        )}
      </div>
    </section>
  );
}
