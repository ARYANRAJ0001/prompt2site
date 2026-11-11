import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { SITE } from "../config.js";
import { api, errorMessage } from "../api.js";
import { STATUS } from "../payment.js";
import PaymentPanel from "../components/PaymentPanel.jsx";
import { SubmissionDetails } from "./Account.jsx";
import NotFound from "./NotFound.jsx";
import Icon from "../components/Icon.jsx";

/** /track/<page>/<id>?k=<key> — status page for an order/booking (the link from the email). */
export default function Track() {
  const { key, id } = useParams();
  const [params] = useSearchParams();
  const k = params.get("k") || "";
  const model = SITE.models.find((m) => m.key === key && m.submission);
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!model) return;
    api.track(key, id, k).then(setItem).catch((err) => setError(errorMessage(err)));
  }, [key, id, k, model]);

  if (!model) return <NotFound />;
  return (
    <section className="section">
      <div className="container narrow">
        <h1>{model.singular} status</h1>
        {error && <p className="alert error">{error === "Not found" ? "We couldn't find this. Please check the link." : error}</p>}
        {!item && !error && <p className="muted">Loading…</p>}
        {item && (
          <div className="card">
            <div className="row-between">
              <h2 className="ref">{item.reference}</h2>
              {item.amount > 0 && <span className={(STATUS[item.paymentStatus] || STATUS.none).className}>{(STATUS[item.paymentStatus] || STATUS.none).label}</span>}
            </div>
            <SubmissionDetails model={model} item={item} />
            {item.amount > 0 && <PaymentPanel model={model} item={item} accessKey={k} onChange={setItem} />}
            <p><Link to={`/receipt/${key}/${id}?k=${k}`} className="btn ghost small-btn"><Icon name="Receipt" size={16} /> View / download receipt</Link></p>
          </div>
        )}
      </div>
    </section>
  );
}
