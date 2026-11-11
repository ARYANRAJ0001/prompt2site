import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { SITE } from "../config.js";
import { api, errorMessage } from "../api.js";
import { STATUS, upiLink } from "../payment.js";
import { formatValue } from "../format.js";
import Icon from "./Icon.jsx";

/**
 * Pay by UPI: scan the QR (with the amount filled in), or tap to open a UPI app
 * on a phone. Then enter the UPI transaction ID so the owner can confirm it.
 */
export default function PaymentPanel({ model, item, accessKey, onChange }) {
  const [qr, setQr] = useState("");
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const link = upiLink(item.amount, item.reference);
  const amount = formatValue({ type: "price" }, item.amount);
  const status = STATUS[item.paymentStatus] || STATUS.unpaid;

  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 240, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(""));
  }, [link]);

  if (item.paymentStatus === "paid") {
    return (
      <div className="pay-box paid">
        <h3><Icon name="CircleCheck" size={20} /> Paid · {amount}</h3>
        <p className="muted">Thank you! Your payment has been confirmed.</p>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onChange(await api.claimPayment(model.key, item._id, { utr, key: accessKey }));
      setUtr("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pay-box">
      <div className="pay-head">
        <h3>Pay {amount}</h3>
        <span className={status.className}>{status.label}</span>
      </div>

      {item.paymentStatus === "verifying" ? (
        <p className="muted">
          We've received your payment details (UTR {item.paymentRef}). {SITE.name} will confirm it shortly — you'll get an email once it's marked paid.
        </p>
      ) : (
        <>
          <div className="pay-grid">
            <div className="qr">
              {qr ? <img src={qr} alt={`UPI QR code to pay ${amount}`} width="200" height="200" /> : <div className="qr-placeholder" />}
              <span className="muted small">Scan with any UPI app</span>
            </div>
            <div className="pay-steps">
              <a className="btn primary full" href={link}>Pay with GPay / PhonePe / Paytm</a>
              <p className="muted small">
                Or pay to UPI ID{" "}
                <button
                  type="button"
                  className="upi-id"
                  onClick={() => {
                    navigator.clipboard?.writeText(SITE.owner.upiId);
                    setCopied(true);
                  }}
                >
                  {SITE.owner.upiId} {copied ? <><Icon name="Check" size={14} /> copied</> : <Icon name="Copy" size={14} />}
                </button>
                <br />
                with the note <b>{item.reference}</b>.
              </p>
              {SITE.owner.qrImage && (
                <details>
                  <summary className="small">Show {SITE.owner.payeeName || SITE.name}'s QR code</summary>
                  <img className="owner-qr" src={SITE.owner.qrImage} alt="Owner's UPI QR code" />
                  <p className="muted small">Enter {amount} yourself when using this QR.</p>
                </details>
              )}
            </div>
          </div>

          <form className="utr-form" onSubmit={submit}>
            <label className="field">
              <span>Paid? Enter the 12-digit UTR from your UPI app so we can match your payment</span>
              <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 412345678901" inputMode="numeric" required minLength={6} maxLength={30} />
            </label>
            <button className="btn primary" disabled={busy}>{busy ? "Sending…" : "I've paid"}</button>
          </form>
          {error && <p className="alert error">{error}</p>}
        </>
      )}
    </div>
  );
}
