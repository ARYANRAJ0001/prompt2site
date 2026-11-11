import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SITE } from "../config.js";
import { api, errorMessage } from "../api.js";
import { useAuth } from "../auth.jsx";
import { STATUS, saved } from "../payment.js";
import { formatValue } from "../format.js";
import { useLinkTitles } from "../lookup.js";
import PaymentPanel from "../components/PaymentPanel.jsx";
import Icon from "../components/Icon.jsx";

export function SubmissionDetails({ model, item }) {
  const linkTitle = useLinkTitles(model);
  const rows = model.fields
    .filter((f) => item[f.name] !== undefined && item[f.name] !== "" && f.type !== "image")
    .map((f) => [f.label, f.type === "relation" ? linkTitle[f.name](item[f.name]) : formatValue(f, item[f.name])]);
  return (
    <dl className="details">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
      <div><dt>Date</dt><dd>{new Date(item.createdAt).toLocaleString()}</dd></div>
      {item.amount > 0 && <div><dt>Amount</dt><dd><b>{formatValue({ type: "price" }, item.amount)}</b></dd></div>}
    </dl>
  );
}

function SubmissionCard({ model, item: initial, accessKey }) {
  const [item, setItem] = useState(initial);
  const [open, setOpen] = useState(false);
  const status = item.amount > 0 ? STATUS[item.paymentStatus] || STATUS.unpaid : null;
  return (
    <article className="card mine">
      <button className="mine-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          <Icon icon={model.icon} words={model.name} size={18} /> <b>{model.singular}</b> <span className="ref">{item.reference}</span>
          <span className="muted small"> · {new Date(item.createdAt).toLocaleDateString()}</span>
        </span>
        <span className="row">
          {item.amount > 0 && <b>{formatValue({ type: "price" }, item.amount)}</b>}
          {status && <span className={status.className}>{status.label}</span>}
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </span>
      </button>
      {open && (
        <>
          <SubmissionDetails model={model} item={item} />
          {item.amount > 0 && <PaymentPanel model={model} item={item} accessKey={accessKey} onChange={setItem} />}
          <p><Link to={`/receipt/${model.key}/${item._id}${accessKey ? `?k=${accessKey}` : ""}`} className="btn ghost small-btn"><Icon name="Receipt" size={16} /> View / download receipt</Link></p>
        </>
      )}
    </article>
  );
}

export default function Account() {
  const auth = useAuth();
  const forms = SITE.models.filter((m) => m.submission);
  const [mine, setMine] = useState(null);
  const [error, setError] = useState("");
  const [pw, setPw] = useState({ current: "", password: "" });
  const [pwMsg, setPwMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = [];
        if (auth.user) {
          for (const m of forms) for (const item of await api.mine(m.key)) rows.push({ model: m, item });
        }
        // Things sent from this device without logging in
        for (const e of saved.list()) {
          if (rows.some((r) => r.item._id === e.id)) continue;
          const m = forms.find((x) => x.key === e.key);
          if (!m) continue;
          const item = await api.track(e.key, e.id, e.k).catch(() => null);
          if (item) rows.push({ model: m, item, accessKey: e.k });
        }
        rows.sort((a, b) => String(b.item.createdAt).localeCompare(String(a.item.createdAt)));
        if (alive) setMine(rows);
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user]);

  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg("");
    try {
      await api.changePassword(pw);
      setPw({ current: "", password: "" });
      setPwMsg("Password changed");
    } catch (err) {
      setPwMsg(errorMessage(err));
    }
  };

  return (
    <section className="section">
      <div className="container narrow">
        <h1>My account</h1>
        {auth.user ? (
          <div className="card profile">
            <div>
              <div className="muted small">Customer ID</div>
              <div className="customer-id">{auth.user.customerId || (auth.isAdmin ? "Site owner" : "—")}</div>
            </div>
            <div>
              <div className="muted small">Name</div>
              <b>{auth.user.name}</b>
            </div>
            <div>
              <div className="muted small">Email</div>
              <b>{auth.user.email}</b>
            </div>
            {auth.isAdmin && <Link to="/dashboard" className="btn primary">Open dashboard</Link>}
          </div>
        ) : (
          <div className="card">
            <p>Log in to see all your {forms.map((m) => m.label.toLowerCase()).join(" and ")} and pay for them in one place.</p>
            <Link to="/login" className="btn primary">Log in or create an account</Link>
          </div>
        )}

        {forms.length > 0 && (
          <>
            <h2>My {forms.length === 1 ? forms[0].label.toLowerCase() : "orders & bookings"}</h2>
            {error && <p className="alert error">{error}</p>}
            {!mine ? (
              <p className="muted">Loading…</p>
            ) : mine.length === 0 ? (
              <div className="empty">
                <p>Nothing yet.</p>
                <div className="actions center">
                  {forms.map((m) => <Link key={m.key} to={`/${m.key}`} className="btn ghost">{m.label}</Link>)}
                </div>
              </div>
            ) : (
              <div className="mine-list">
                {mine.map(({ model, item, accessKey }) => <SubmissionCard key={item._id} model={model} item={item} accessKey={accessKey} />)}
              </div>
            )}
          </>
        )}

        {auth.user && (
          <form className="card" onSubmit={changePassword}>
            <h3>Change password</h3>
            <div className="form-grid">
              <label className="field"><span>Current password</span><input type="password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" /></label>
              <label className="field"><span>New password (8+ characters)</span><input type="password" required minLength={8} value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} autoComplete="new-password" /></label>
            </div>
            <div className="actions"><button className="btn ghost">Change password</button>{pwMsg && <span className="small">{pwMsg}</span>}</div>
          </form>
        )}
      </div>
    </section>
  );
}
