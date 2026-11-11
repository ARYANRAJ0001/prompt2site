import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { SITE } from "../config.js";
import { api, errorMessage } from "../api.js";
import { formatValue } from "../format.js";
import NotFound from "./NotFound.jsx";
import Icon from "../components/Icon.jsx";

const money = (v) => formatValue({ type: "price" }, v);
const when = (d) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

/** /receipt/<page>/<id>?k=<key> — a printable receipt (Print → Save as PDF). */
export default function Receipt() {
  const { key, id } = useParams();
  const [params] = useSearchParams();
  const k = params.get("k") || "";
  const model = SITE.models.find((m) => m.key === key && m.submission);
  const [r, setR] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!model) return;
    api.receipt(key, id, k).then(setR).catch((err) => setError(errorMessage(err)));
  }, [key, id, k, model]);

  if (!model) return <NotFound />;
  const paid = r?.status === "paid";
  return (
    <section className="section receipt-page">
      <div className="container narrow">
        <div className="actions no-print">
          <button className="btn primary" onClick={() => window.print()} disabled={!r}><Icon name="Printer" size={18} /> Print / Save as PDF</button>
          {k ? <Link to={`/track/${key}/${id}?k=${k}`} className="btn ghost"><Icon name="ChevronLeft" size={18} /> Back</Link> : <Link to="/account" className="btn ghost"><Icon name="ChevronLeft" size={18} /> My account</Link>}
        </div>
        {error && <p className="alert error">{error === "Not found" || /not found/i.test(error) ? "We couldn't find this receipt. Please check the link or log in." : error}</p>}
        {!r && !error && <p className="muted">Loading…</p>}
        {r && (
          <article className="receipt card">
            <header className="receipt-head">
              <div>
                <h1>{r.business.name}</h1>
                <p className="muted small">{[r.business.address, r.business.phone, r.business.email].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="receipt-title">
                <span>{paid ? "Payment receipt" : `${r.kind} receipt`}</span>
                {r.statusText && <b className={paid ? "stamp paid" : "stamp due"}>{r.statusText}</b>}
              </div>
            </header>

            <div className="receipt-meta">
              <div>
                <span className="label">Billed to</span>
                {r.billedTo.name && <b>{r.billedTo.name}</b>}
                {r.billedTo.phone && <span>{r.billedTo.phone}</span>}
                {r.billedTo.email && <span>{r.billedTo.email}</span>}
                {r.billedTo.customerId && <span className="muted small">Customer ID {r.billedTo.customerId}</span>}
              </div>
              <div className="right">
                <span className="label">Receipt no.</span>
                <b className="ref">{r.number}</b>
                <span className="label">Date</span>
                <span>{when(r.date)}</span>
              </div>
            </div>

            {r.lines.length > 0 && (
              <table className="receipt-lines">
                <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {r.lines.map((l, i) => (
                    <tr key={i}><td>{l.description}</td><td className="num">{l.quantity}</td><td className="num">{money(l.unitPrice)}</td><td className="num">{money(l.total)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan="3">Total</td><td className="num">{money(r.total)}</td></tr></tfoot>
              </table>
            )}

            {paid && <p className="paid-note"><Icon name="CircleCheck" size={18} /> Paid by UPI{r.paidAt ? ` · confirmed ${when(r.paidAt)}` : ""}{r.paymentRef ? ` · UTR ${r.paymentRef}` : ""}</p>}
            {!paid && r.total > 0 && r.business.upiId && (
              <p className="due-note">
                {r.status === "verifying" ? `We're checking your payment${r.paymentRef ? ` (UTR ${r.paymentRef})` : ""}.` : `Please pay ${money(r.total)} by UPI to ${r.business.upiId} with the note ${r.number}.`}
              </p>
            )}

            {r.details.length > 0 && (
              <dl className="details receipt-details">
                {r.details.map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
            )}
            <p className="muted small center-text">Thank you for choosing {r.business.name}.</p>
          </article>
        )}
      </div>
    </section>
  );
}
