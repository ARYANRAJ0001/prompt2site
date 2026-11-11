import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SITE } from "../config.js";
import { useAuth } from "../auth.jsx";
import { api, errorMessage, DEMO } from "../api.js";

/**
 * Log in / sign up.
 * Customers sign up and (when the site sends email) confirm their email with a
 * 6-digit code; they get a customer ID. The owner logs in with the admin
 * account set up when the site was built — nobody can sign up as the owner.
 */
export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("signup") ? "register" : "login"); // login | register | verify | forgot | reset
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", code: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v })); // functional update: autofill sets several fields at once
  };
  const go = (m) => {
    setMode(m);
    setError("");
    setInfo("");
  };

  const done = (result) => {
    if (result?.needsVerification) {
      setForm((f) => ({ ...f, email: result.email || f.email, code: "" }));
      setMode("verify");
      setInfo(result.message || `We've emailed a 6-digit code to ${result.email}.`);
      return;
    }
    const next = params.get("next");
    if (next) return navigate(next);
    if (result?.role === "admin") return navigate("/dashboard");
    const own = SITE.models.find((m) => m.ownedByUser);
    navigate(own ? `/${own.key}` : SITE.models.some((m) => m.submission) ? "/account" : "/");
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") done(await auth.login(form.email, form.password));
      else if (mode === "register") done(await auth.register(form.name, form.email, form.password, form.phone));
      else if (mode === "verify") done(await auth.verify(form.email, form.code));
      else if (mode === "forgot") {
        const r = await api.forgot({ email: form.email });
        setMode("reset");
        setInfo(r.message || "If that email has an account, we've sent a code.");
      } else if (mode === "reset") done(await auth.reset(form.email, form.code, form.password));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const titles = {
    login: ["Welcome back", `Log in to ${SITE.name}`],
    register: ["Create your account", "You'll get a customer ID to track your orders and bookings."],
    verify: ["Check your email", "Enter the 6-digit code we sent you."],
    forgot: ["Forgot your password?", "We'll email you a code to choose a new one."],
    reset: ["Choose a new password", "Enter the code from the email and your new password."],
  };
  const [title, subtitle] = titles[mode];

  return (
    <section className="section">
      <div className="container auth-wrap">
        <form className="card auth-card" onSubmit={submit}>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
          {DEMO && mode === "login" && (
            <p className="alert info small">Preview: log in with the owner's email{SITE.owner?.email ? ` (${SITE.owner.email})` : ""} or any email containing "admin" to see the owner's view. Any other email logs in as a customer.</p>
          )}
          {info && <p className="alert info">{info}</p>}

          {mode === "register" && (
            <>
              <label className="field"><span>Name</span><input required value={form.name} onChange={set("name")} autoComplete="name" /></label>
              <label className="field"><span>Mobile{SITE.requireLogin ? "" : " (optional)"}</span><input type="tel" required={SITE.requireLogin} pattern={SITE.requireLogin ? "[\\d\\s+()-]{10,}" : undefined} value={form.phone} onChange={set("phone")} autoComplete="tel" placeholder="+91 98765 43210" /></label>
            </>
          )}
          {mode !== "verify" && mode !== "reset" && (
            <label className="field"><span>Email</span><input type="email" required value={form.email} onChange={set("email")} autoComplete="email" /></label>
          )}
          {(mode === "verify" || mode === "reset") && (
            <label className="field"><span>6-digit code</span><input required inputMode="numeric" pattern="\d{6}" maxLength={6} value={form.code} onChange={set("code")} autoComplete="one-time-code" className="code-input" /></label>
          )}
          {(mode === "login" || mode === "register" || mode === "reset") && (
            <label className="field">
              <span>{mode === "reset" ? "New password" : "Password"}{mode !== "login" ? " (8+ characters)" : ""}</span>
              <input type="password" required minLength={mode === "login" ? 1 : 8} value={form.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </label>
          )}

          {error && <p className="alert error">{error}</p>}
          <button className="btn primary full" disabled={busy}>
            {busy ? "Please wait…" : { login: "Log in", register: "Create account", verify: "Confirm email", forgot: "Send code", reset: "Save new password" }[mode]}
          </button>

          <div className="auth-links">
            {mode === "login" && (
              <>
                <button type="button" className="link" onClick={() => go("register")}>New here? Create an account</button>
                <button type="button" className="link" onClick={() => go("forgot")}>Forgot password?</button>
              </>
            )}
            {mode === "register" && <button type="button" className="link" onClick={() => go("login")}>Already have an account? Log in</button>}
            {mode === "verify" && (
              <button type="button" className="link" onClick={() => api.resend({ email: form.email }).then(() => setInfo("A new code is on its way."))}>Send the code again</button>
            )}
            {(mode === "verify" || mode === "forgot" || mode === "reset") && <button type="button" className="link" onClick={() => go("login")}>Back to log in</button>}
          </div>
        </form>
      </div>
    </section>
  );
}
