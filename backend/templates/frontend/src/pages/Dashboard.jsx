import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SITE } from "../config.js";
import { api, errorMessage } from "../api.js";
import { useAuth } from "../auth.jsx";
import { STATUS } from "../payment.js";
import { formatValue } from "../format.js";
import Icon from "../components/Icon.jsx";

function Bars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="bars" role="img" aria-label="New items per day for the last 14 days">
      {data.map((d) => (
        <div key={d.day} className="bar-col" title={`${d.day}: ${d.count}`}>
          <div className="bar" style={{ height: `${(d.count / max) * 100}%` }} />
          <span className="bar-label">{new Date(`${d.day}T00:00:00`).getDate()}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const auth = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [chartKey, setChartKey] = useState("");

  useEffect(() => {
    if (!auth.isAdmin) return;
    api
      .stats()
      .then((s) => {
        setStats(s.models);
        const busiest = s.models.find((m) => m.recentItems.length) || s.models[0];
        setChartKey(busiest?.key || "");
      })
      .catch((err) => setError(errorMessage(err)));
  }, [auth.isAdmin]);

  if (!auth.isAdmin) {
    return (
      <section className="section">
        <div className="container narrow center-text">
          <h1>Dashboard</h1>
          <p className="muted">Only the site admin can see this page.</p>
          {SITE.auth && !auth.user && <Link to="/login" className="btn primary">Log in</Link>}
        </div>
      </section>
    );
  }

  const chart = stats?.find((m) => m.key === chartKey);

  return (
    <section className="section">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>Dashboard</h1>
            <p className="muted">An overview of {SITE.name}.</p>
          </div>
        </div>
        {error && <p className="alert error">{error}</p>}
        {!stats ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <div className="stat-grid">
            {stats.some((m) => m.pay) && (
              <>
                <div className="card stat money reveal" data-tilt="5">
                  <span className="stat-icon"><Icon name="Wallet" /></span>
                  <span className="stat-num">{formatValue({ type: "price" }, stats.reduce((n, m) => n + (m.pay?.received || 0), 0))}</span>
                  <span className="muted">Money received</span>
                </div>
                {stats.filter((m) => m.pay).map((m) => (
                  <Link key={`pay-${m.key}`} to={`/${m.key}`} className={m.pay.toVerify ? "card stat attention reveal" : "card stat reveal"} data-tilt="5">
                    <span className="stat-icon"><Icon name="Hourglass" /></span>
                    <span className="stat-num">{m.pay.toVerify}</span>
                    <span className="muted">{m.label}: payments to check</span>
                    {m.pay.unpaid > 0 && <span className="chip">{m.pay.unpaid} unpaid</span>}
                  </Link>
                ))}
              </>
            )}
              {stats.map((m) => (
                <Link key={m.key} to={`/${m.key}`} className="card stat reveal" data-tilt="5">
                  <span className="stat-icon"><Icon icon={m.icon} words={m.name} /></span>
                  <span className="stat-num">{m.total}</span>
                  <span className="muted">{m.label}</span>
                  {m.today > 0 && <span className="chip strong">+{m.today} today</span>}
                </Link>
              ))}
            </div>

            <div className="dash-grid">
              <div className="card">
                <div className="section-head">
                  <h2>Last 14 days</h2>
                  <select value={chartKey} onChange={(e) => setChartKey(e.target.value)} className="short-select" aria-label="Choose what to chart">
                    {stats.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
                {chart && <Bars data={chart.last14} />}
              </div>

              <div className="card">
                <h2>Latest activity</h2>
                {stats.every((m) => !m.recentItems.length) ? (
                  <p className="muted">Quiet so far. New orders, bookings and messages will appear here as they come in.</p>
                ) : (
                  <ul className="recent">
                    {stats.flatMap((m) =>
                      m.recentItems.map((r) => (
                        <li key={r._id}>
                          <Link to={`/${m.key}`}>
                            <span className="recent-icon"><Icon icon={m.icon} words={m.name} size={16} /></span>
                            <span className="recent-main">
                              <strong>{String(r.title ?? "")}</strong>
                              <span className="muted small">{r.reference && <span className="ref">{r.reference} · </span>}{m.label} · {new Date(r.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                            </span>
                            {r.amount > 0 && <span className={(STATUS[r.paymentStatus] || STATUS.unpaid).className}>{formatValue({ type: "price" }, r.amount)} · {(STATUS[r.paymentStatus] || STATUS.unpaid).label}</span>}
                          </Link>
                        </li>
                      ))
                    ).slice(0, 10)}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
