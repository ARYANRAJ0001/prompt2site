import { useState } from "react";
import { http, session, errorText, API_URL } from "../api.js";
import { Mark } from "./common.jsx";

export default function AuthPage({ onLogin, health }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await http.post(`/api/auth/${mode === "login" ? "login" : "signup"}`, form);
      session.save(data.token, data.user);
      onLogin(data.user);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-intro">
        <div className="brand big"><Mark size={34} /> Prompt2Site</div>
        <h1 className="display">
          {"Your business, online by tonight.".split(" ").map((w, i) => (
            <span key={i} className="word" style={{ "--i": i }}>{w} </span>
          ))}
        </h1>
        <p className="lead">Describe what you sell or offer. Prompt2Site builds a real website with customer logins, orders, UPI payments and receipts, then puts it online.</p>
        <ul className="ticks">
          <li>79 ready-made sites for shops, salons, clinics, tutors and more</li>
          <li>Order alerts on email and WhatsApp</li>
          <li>Live on the internet in one click, with your own admin login</li>
        </ul>
      </div>
      <form className="card auth-card" onSubmit={submit}>
        <h2>{mode === "login" ? "Log in" : "Create your account"}</h2>
        {health?.offline && <p className="alert error">Can't reach the backend at {API_URL}. Start it first.</p>}
        {mode === "signup" && (
          <label className="field">
            <span>Name</span>
            <input required value={form.name} onChange={set("name")} autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" required minLength={6} value={form.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </label>
        {error && <p className="alert error">{error}</p>}
        <button className="btn primary full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
