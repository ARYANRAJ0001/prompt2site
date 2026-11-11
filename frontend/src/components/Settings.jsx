import { useEffect, useState } from "react";
import { http, ownKey, errorText } from "../api.js";
import Icon from "./Icon.jsx";

export default function Settings({ onClose }) {
  const [key, setKey] = useState(ownKey.get());
  const [check, setCheck] = useState(null);
  const [usage, setUsage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    http.get("/api/account/usage").then((r) => setUsage(r.data.usage)).catch(() => {});
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const test = async () => {
    setBusy(true);
    setCheck(null);
    ownKey.set(key);
    try {
      setCheck((await http.get("/api/account/key-check")).data);
    } catch (err) {
      setCheck({ success: false, message: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const money = (v) => (v === null || v === undefined ? "—" : `$${Number(v).toFixed(2)}`);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2>Settings</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close"><Icon name="X" size={16} /></button>
        </div>

        <h3>Your OpenRouter key (optional)</h3>
        <p className="muted small">
          Use your own key for better AI and no daily AI limit. It's stored only in this browser and sent with your requests — never saved on the server.
          Get one at openrouter.ai under Keys.
        </p>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-or-v1-…" autoComplete="off" />
        <div className="row wrap">
          <button className="btn primary small" onClick={() => { ownKey.set(key); test(); }} disabled={busy}>{busy ? "Checking…" : "Save & check"}</button>
          {ownKey.get() && <button className="btn ghost small" onClick={() => { ownKey.set(""); setKey(""); setCheck(null); }}>Remove my key</button>}
          {!key && <button className="btn ghost small" onClick={test} disabled={busy}>Check the server's key</button>}
        </div>
        {check && (
          <p className={check.success ? "alert ok" : "alert error"}>
            {check.success
              ? `${check.whose === "yours" ? "Your" : "The server's"} key works${check.freeTier ? " (free tier: free models only)" : ""}. Used ${money(check.usage)}${check.limit !== null ? ` of ${money(check.limit)}` : ""}.`
              : `${check.message}`}
          </p>
        )}

        {usage && (
          <>
            <h3>Today's usage</h3>
            <div className="usage">
              {[["ai", "AI requests"], ["preview", "Previews"], ["deploy", "Deploys"]].map(([k, label]) => (
                <div key={k}>
                  <div className="row between small"><span>{label}</span><span>{usage[k].used} / {usage[k].limit}</span></div>
                  <div className="meter"><div style={{ width: `${Math.min(100, (usage[k].used / Math.max(1, usage[k].limit)) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
            <p className="muted small">Limits reset at midnight UTC (5:30 AM IST). AI requests with your own key don't count.</p>
          </>
        )}
      </div>
    </div>
  );
}
