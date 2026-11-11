import { useState } from "react";
import { Link } from "react-router-dom";
import { SITE } from "../config.js";
import { useAuth } from "../auth.jsx";
import PaymentPanel from "./PaymentPanel.jsx";
import Icon from "./Icon.jsx";

/** Shown after a visitor submits a form: reference number, payment and next steps. */
export default function Submitted({ model, item: initial, onAgain }) {
  const auth = useAuth();
  const [item, setItem] = useState(initial);
  const trackLink = `#/track/${model.key}/${item._id}?k=${item.accessKey}`;

  return (
    <div className="card success-card">
      <div className="success-mark"><Icon name="CircleCheck" size={30} /></div>
      <h2>Thank you</h2>
      <p>
        We've received your {model.singular.toLowerCase()}. Your reference number is <b className="ref">{item.reference}</b>.
      </p>
      {auth.user?.customerId && <p className="muted small">Saved to your account ({auth.user.customerId}).</p>}

      {item.amount > 0 && <PaymentPanel model={model} item={item} accessKey={item.accessKey} onChange={setItem} />}

      <div className="actions center">
        {auth.user ? (
          <Link to="/account" className="btn ghost">View in My account</Link>
        ) : (
          <a href={trackLink} className="btn ghost">Track this {model.singular.toLowerCase()}</a>
        )}
        <Link to={`/receipt/${model.key}/${item._id}?k=${item.accessKey}`} className="btn ghost"><Icon name="Receipt" size={18} /> Receipt</Link>
        <button className="btn ghost" onClick={onAgain}>Place another</button>
      </div>
      {!auth.user && SITE.auth && (
        <p className="muted small">
          Bookmark the tracking page to check its status later, or <Link to="/login?signup=1">create an account</Link> to keep everything in one place.
        </p>
      )}
    </div>
  );
}
