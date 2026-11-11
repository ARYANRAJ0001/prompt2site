import { useState } from "react";
import { http, errorText, session } from "../api.js";
import Icon from "./Icon.jsx";

const clone = (v) => JSON.parse(JSON.stringify(v));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,64}$/;
const phoneOk = (p) => String(p || "").replace(/[^\d]/g, "").length >= 10;

/** Which details are still missing (same rules as the server's deploy check). */
export function missingOwnerDetails(bp) {
  if (!bp?.auth) return [];
  const o = bp.owner || {};
  const out = [];
  if (!EMAIL_RE.test(o.email || "")) out.push("email");
  if (!phoneOk(o.phone)) out.push("mobile number");
  if (bp.acceptPayments && bp.models.some((m) => m.payment?.enabled) && !UPI_RE.test(o.upiId || "")) out.push("UPI ID");
  return out;
}

/** Shrink an uploaded QR photo to a small PNG data URL (kept in the plan). */
function readQr(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error("Please choose an image file."));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 480;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = url;
  });
}

/**
 * "Your business details": the owner's email + mobile (alerts and admin
 * login), WhatsApp alerts, UPI payments, and whether customers must log in.
 *   setup  — shown as the required step before the editor (with a Continue button)
 */
export default function BusinessDetails({ blueprint, onChange, projectId, secretsSet = {}, onSecretsSet, setup = false, onDone, emailReady = true, builtInEmail = true }) {
  const bp = blueprint;
  const o = bp.owner || {};
  const [waKey, setWaKey] = useState("");
  const [waSaved, setWaSaved] = useState(Boolean(secretsSet.whatsappKey));
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const payModels = bp.models.filter((m) => m.submission);

  const update = (fn) => {
    const next = clone(bp);
    next.owner = { ...(next.owner || {}) };
    fn(next);
    onChange(next);
  };
  const setOwner = (k, v) =>
    update((b) => {
      const before = b.owner[k];
      b.owner[k] = v;
      // keep the alert email in step with the owner email unless set separately
      if (k === "email" && (!b.notifyEmail || b.notifyEmail === before)) b.notifyEmail = v;
    });

  // Prefill the email from the builder account.
  const myEmail = session.user()?.email || "";

  const saveKey = async () => {
    if (!projectId) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data } = await http.put(`/api/projects/${projectId}/secrets`, { whatsappKey: waKey });
      setWaSaved(data.secretsSet.whatsappKey);
      onSecretsSet?.(data.secretsSet);
      setWaKey("");
      setMsg({ ok: true, text: data.secretsSet.whatsappKey ? "WhatsApp key saved (kept private — never put in your code)." + (data.needsRedeploy ? " Redeploy to use it on the live site." : "") : "WhatsApp key removed." });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  // the owner's own email account (key kept on the server)
  const [mailKey, setMailKey] = useState("");
  const [mailSet, setMailSet] = useState({ brevoKey: Boolean(secretsSet.brevoKey), gmailPassword: Boolean(secretsSet.gmailPassword) });
  const mode = o.emailMode || "platform";
  const secretName = mode === "gmail" ? "gmailPassword" : "brevoKey";
  const saveMailKey = async (clear = false) => {
    if (!projectId) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data } = await http.put(`/api/projects/${projectId}/secrets`, { [secretName]: clear ? "" : mailKey });
      setMailSet({ brevoKey: data.secretsSet.brevoKey, gmailPassword: data.secretsSet.gmailPassword });
      onSecretsSet?.(data.secretsSet);
      setMailKey("");
      setMsg({ ok: true, text: data.secretsSet[secretName] ? "Saved privately (never put in your code)." + (data.needsRedeploy ? " Redeploy to use it on the live site." : "") : "Removed." });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (waKey.trim()) await saveKey();
      if (mailKey.trim()) await saveMailKey();
      const { data } = await http.post("/api/fullstack/test-notify", { projectId, email: o.email, phone: o.phone, owner: { emailMode: o.emailMode, senderEmail: o.senderEmail, senderName: o.senderName, emailsOff: o.emailsOff } });
      const parts = [
        data.email.ok ? `Test email sent to ${o.email}` : `Email: ${data.email.note}`,
        data.whatsapp.ok ? `WhatsApp sent to ${o.phone}` : `WhatsApp: ${data.whatsapp.note}`,
      ];
      setMsg({ ok: data.email.ok || data.whatsapp.ok, text: parts.join(" · ") });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  // Will the live site be able to email? Tell the owner plainly if not, and how to fix it.
  const emailWarning = o.emailsOff
    ? ""
    : mode === "platform" && !builtInEmail
      ? "The built-in sender isn't available on this builder. Choose \"My own Brevo account\" under Email sending (free, about 5 minutes), or turn emails off."
      : mode === "brevo" && (!mailSet.brevoKey || !o.senderEmail)
        ? "Finish \"My own Brevo account\": add your Brevo key and sender email under Email sending."
        : mode === "gmail" && (!mailSet.gmailPassword || !o.senderEmail)
          ? "Finish \"My own Gmail\": add your Gmail address and App Password under Email sending."
          : "";
  const missing = missingOwnerDetails(bp);
  const err = (what) => touched && missing.includes(what);

  return (
    <section className={setup ? "card setup" : "card"}>
      <h3><Icon name="Store" size={19} /> Your business details</h3>
      <p className="muted small">
        {setup ? "One quick step before editing. " : ""}
        Every order, booking or enquiry reaches you by <b>email and WhatsApp</b>. Your email is also your <b>admin login</b>; customers who sign up get their own accounts and can never see yours.
      </p>

      <div className="grid-2">
        <label className="field"><span>Business / owner name</span>
          <input value={o.name || ""} placeholder="e.g. Priya Sharma" onChange={(e) => setOwner("name", e.target.value)} />
        </label>
        <label className={err("email") ? "field invalid" : "field"}><span>Your email *</span>
          <input type="email" value={o.email || ""} placeholder="you@gmail.com" onChange={(e) => setOwner("email", e.target.value.trim())} />
          {!o.email && myEmail && <button type="button" className="link small" onClick={() => setOwner("email", myEmail)}>Use {myEmail}</button>}
        </label>
        <label className={err("mobile number") ? "field invalid" : "field"}><span>Your mobile (WhatsApp) *</span>
          <input type="tel" value={o.phone || ""} placeholder="+91 98765 43210" onChange={(e) => setOwner("phone", e.target.value)} />
        </label>
        <label className="field"><span>Send alerts to (email)</span>
          <input type="email" value={bp.notifyEmail || ""} placeholder={o.email || "same as your email"} onChange={(e) => update((b) => (b.notifyEmail = e.target.value.trim()))} />
        </label>
      </div>
      {emailWarning && (
        <div className="alert warn small email-warning">
          <b>Your site can't send emails yet.</b> {emailWarning}{" "}
          <button type="button" className="link small" onClick={() => { const d = document.getElementById("email-sending"); if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth", block: "center" }); } }}>Set up email</button>
        </div>
      )}

      <details className="sub" open={setup && !waSaved}>
        <summary><Icon name="MessageCircle" size={17} /> WhatsApp alerts {waSaved ? <span className="badge ok">On</span> : <span className="badge">Optional</span>}</summary>
        <ol className="steps small">
          <li>Save <b>+34 621 331 709</b> in your phone's contacts (name it "CallMeBot").</li>
          <li>From your WhatsApp, send it: <code>I allow callmebot to send me messages</code></li>
          <li>It replies with a short number (your key). Paste it here.</li>
        </ol>
        <div className="row wrap">
          <input className="grow" value={waKey} onChange={(e) => setWaKey(e.target.value)} placeholder={waSaved ? "Key saved. Paste a new one to replace it" : "CallMeBot API key, e.g. 123456"} aria-label="CallMeBot API key" />
          <button type="button" className="btn ghost small" onClick={saveKey} disabled={busy || !projectId || (!waKey.trim() && !waSaved)}>{waKey.trim() || !waSaved ? "Save key" : "Remove key"}</button>
        </div>
        <p className="muted small">CallMeBot is a free outside service. Your key stays private: it's stored on the server and never appears in your site's code.</p>
      </details>

      <details className="sub" id="email-sending" open={emailWarning ? true : undefined}>
        <summary><Icon name="Mail" size={17} /> Email sending <span className="badge">{o.emailsOff ? "Off" : mode === "brevo" ? "My Brevo" : mode === "gmail" ? "My Gmail" : "Built-in"}</span></summary>
        <p className="muted small">Choose how your site emails you and your customers (alerts, sign-up codes, receipts). Replies always go to your email above.</p>
        <div className="mode-list" role="radiogroup" aria-label="How your site sends email">
          {[
            ["platform", "Built-in sender", builtInEmail ? "Nothing to set up. Emails show your site's name; replies come to you." : "Not available on this builder right now, so no emails would be sent."],
            ["brevo", "My own Brevo account", "Emails are sent from your own address. Free: 300 a day. Works on Render's free plan."],
            ["gmail", "My own Gmail", "Uses your Gmail App Password. Not on Render's free plan (it blocks Gmail)."],
          ].map(([id, title, note]) => (
            <label key={id} className={mode === id && !o.emailsOff ? "mode active" : "mode"}>
              <input type="radio" name="emailMode" checked={mode === id && !o.emailsOff} onChange={() => update((b) => { b.owner.emailMode = id; b.owner.emailsOff = false; setMailKey(""); })} />
              <span><b>{title}</b><span className="muted small block">{note}</span></span>
            </label>
          ))}
          <label className={o.emailsOff ? "mode active" : "mode"}>
            <input type="radio" name="emailMode" checked={Boolean(o.emailsOff)} onChange={() => update((b) => (b.owner.emailsOff = true))} />
            <span><b>Don't send emails</b><span className="muted small block">Orders still show on your dashboard and on WhatsApp.</span></span>
          </label>
        </div>
        {!o.emailsOff && (
          <div className="grid-2">
            <label className="field"><span>Name readers see</span>
              <input value={o.senderName || ""} placeholder={bp.name} onChange={(e) => setOwner("senderName", e.target.value)} />
            </label>
            {mode !== "platform" && (
              <label className="field"><span>{mode === "gmail" ? "Your Gmail address" : "Sender email (verified in Brevo)"}</span>
                <input type="email" value={o.senderEmail || ""} placeholder={o.email || "you@gmail.com"} onChange={(e) => setOwner("senderEmail", e.target.value.trim())} />
              </label>
            )}
          </div>
        )}
        {!o.emailsOff && mode !== "platform" && (
          <>
            {mode === "brevo" ? (
              <ol className="steps small">
                <li>Sign up free at brevo.com.</li>
                <li>SMTP &amp; API → API keys → Generate a new API key, and copy it (starts with <code>xkeysib-</code>).</li>
                <li>Senders → Add a sender with the email above, and click the link Brevo emails you.</li>
                <li>Security → Authorised IPs → turn off IP blocking (your site's server has changing IPs).</li>
              </ol>
            ) : (
              <ol className="steps small">
                <li>Turn on 2-Step Verification in your Google Account.</li>
                <li>Open myaccount.google.com/apppasswords, create one, and copy the 16 letters.</li>
              </ol>
            )}
            <div className="row wrap">
              <input
                className="grow"
                type="password"
                autoComplete="off"
                value={mailKey}
                onChange={(e) => setMailKey(e.target.value)}
                placeholder={mailSet[secretName] ? "Saved. Paste a new one to replace it" : mode === "gmail" ? "Gmail App Password (16 letters)" : "Brevo API key (xkeysib-…)"}
                aria-label={mode === "gmail" ? "Gmail App Password" : "Brevo API key"}
              />
              <button type="button" className="btn ghost small" onClick={() => saveMailKey(!mailKey.trim() && mailSet[secretName])} disabled={busy || !projectId || (!mailKey.trim() && !mailSet[secretName])}>
                {mailKey.trim() || !mailSet[secretName] ? "Save" : "Remove"}
              </button>
            </div>
            {!o.senderEmail && <p className="alert warn small">Add the sender email above.</p>}
          </>
        )}
      </details>

      {payModels.length > 0 && (
        <details className="sub" open={setup || bp.acceptPayments}>
          <summary><Icon name="CreditCard" size={17} /> UPI payments {bp.acceptPayments ? <span className="badge ok">On</span> : <span className="badge">Off</span>}</summary>
          <label className="check"><input type="checkbox" checked={Boolean(bp.acceptPayments)} onChange={(e) => update((b) => {
            b.acceptPayments = e.target.checked;
            if (e.target.checked) for (const m of b.models) if (m.submission && m.payment && !m.payment.enabled && /order|book|regist|subscri|admission|enrol|donat|appoint/i.test(`${m.name} ${m.label}`)) m.payment.enabled = true;
          })} /> <span>Customers can pay me by UPI (GPay, PhonePe, Paytm…)</span></label>
          {bp.acceptPayments && (
            <>
              <div className="grid-2">
                <label className={err("UPI ID") ? "field invalid" : "field"}><span>Your UPI ID *</span>
                  <input value={o.upiId || ""} placeholder="yourname@okicici" onChange={(e) => setOwner("upiId", e.target.value.trim())} />
                </label>
                <label className="field"><span>Name shown in the UPI app</span>
                  <input value={o.payeeName || ""} placeholder={o.name || bp.name} onChange={(e) => setOwner("payeeName", e.target.value)} />
                </label>
              </div>
              <div className="row wrap qr-row">
                {o.qrImage ? <img src={o.qrImage} alt="Your QR code" className="qr-thumb" /> : <span className="muted small">A QR code is made automatically from your UPI ID. You can also upload your shop's QR:</span>}
                <label className="btn ghost small">
                  {o.qrImage ? "Change QR" : "Upload QR image"}
                  <input type="file" accept="image/*" hidden onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try { const data = await readQr(file); setOwner("qrImage", data); } catch (er) { setMsg({ ok: false, text: er.message }); }
                  }} />
                </label>
                {o.qrImage && <button type="button" className="link small" onClick={() => setOwner("qrImage", "")}>Remove</button>}
              </div>
              <p className="muted small">
                Customers pay you directly (no fees). After paying they enter the UTR / transaction ID, you get an alert, and you mark the order <b>Paid</b> or <b>Unpaid</b> from your dashboard. UPI doesn't tell websites about payments, so please check your bank app before marking paid.
              </p>
              <table className="fields pay-table">
                <thead><tr><th>Form</th><th>Take payment</th><th>Amount</th></tr></thead>
                <tbody>
                  {bp.models.map((m, i) => m.submission && m.payment && (
                    <tr key={m.name}>
                      <td><span className="row"><Icon icon={m.icon} words={m.name} size={16} /> {m.label}</span></td>
                      <td className="center"><input type="checkbox" aria-label={`Take payment for ${m.label}`} checked={Boolean(m.payment.enabled)} onChange={(e) => update((b) => (b.models[i].payment.enabled = e.target.checked))} /></td>
                      <td>
                        {m.payment.from === "fixed" ? (
                          <label className="row"><span className="muted small">Fixed</span><input type="number" min="0" className="short" value={m.payment.fixed || 0} onChange={(e) => update((b) => (b.models[i].payment.fixed = Number(e.target.value)))} /></label>
                        ) : (
                          <span className="small">{m.payment.label}</span>
                        )}
                        <select className="small" aria-label="How the amount is worked out" value={m.payment.from} onChange={(e) => update((b) => (b.models[i].payment = { ...b.models[i].payment, from: e.target.value }))}>
                          {m.fields.some((f) => f.type === "relation") && <option value="link">From the chosen item's price</option>}
                          {m.fields.some((f) => f.type === "price") && <option value="field">Amount the customer types</option>}
                          <option value="fixed">A fixed amount</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </details>
      )}

      <label className="check"><input type="checkbox" checked={Boolean(bp.requireLogin)} onChange={(e) => update((b) => (b.requireLogin = e.target.checked))} /> <span>Customers must log in before ordering or booking <span className="badge ok">Recommended</span><span className="muted small block">They register with email and mobile, confirm their email with a code, and get a customer ID like CUS-7K2Q9X. The contact form stays open to everyone.</span></span></label>

      {msg && <p className={msg.ok ? "alert ok small" : "alert warn small"}>{msg.text}</p>}

      <div className="row wrap">
        <button type="button" className="btn ghost small" onClick={test} disabled={busy || !projectId || !o.email}><Icon name="Send" size={15} /> Send me a test alert</button>
        {setup && (
          <button type="button" className="btn primary" onClick={() => { setTouched(true); if (!missing.length) onDone?.(); }}>
            Continue <Icon name="ArrowRight" size={17} />
          </button>
        )}
      </div>
      {setup && touched && missing.length > 0 && <p className="alert error small">Please add your {missing.join(", ")}.</p>}
    </section>
  );
}
