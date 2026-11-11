import { useEffect, useRef, useState } from "react";
import { http, API_URL, errorText } from "../api.js";
import Icon from "./Icon.jsx";

const cache = new Map(); // template id -> live config

/**
 * The site, live, beside the editor. One preview page (built once on the
 * server) receives the plan by postMessage, so every change shows in well
 * under a second — no rebuild.
 *   blueprint   the plan being edited (sent to /live-config, debounced)
 *   templateId  …or a template to show as-is
 */
export default function LivePreview({ blueprint, templateId, toolbar, label = "Live preview" }) {
  const frame = useRef(null);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState(null);
  const [route, setRoute] = useState("/");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // messages from the preview page
  useEffect(() => {
    const onMessage = (e) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      if (e.data?.type === "p2s:ready") setReady(true);
      if (e.data?.type === "p2s:route") setRoute(e.data.path || "/");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // template: fetch once and cache
  useEffect(() => {
    if (!templateId) return;
    let off = false;
    setError("");
    if (cache.has(templateId)) return setConfig(cache.get(templateId));
    setLoading(true);
    http
      .get(`/api/fullstack/templates/${templateId}/live`)
      .then(({ data }) => {
        cache.set(templateId, data);
        if (!off) setConfig(data);
      })
      .catch((err) => !off && setError(errorText(err)))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, [templateId]);

  // plan being edited: debounce, then ask the server for the site settings
  const planJson = templateId ? "" : JSON.stringify(blueprint || null);
  useEffect(() => {
    if (templateId || !blueprint) return;
    let off = false;
    const t = setTimeout(() => {
      setLoading(true);
      http
        .post("/api/fullstack/live-config", { blueprint })
        .then(({ data }) => !off && (setConfig(data), setError("")))
        .catch((err) => !off && setError(errorText(err)))
        .finally(() => !off && setLoading(false));
    }, 280);
    return () => {
      off = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planJson, templateId]);

  // send to the preview page
  useEffect(() => {
    if (!ready || !config || !frame.current) return;
    frame.current.contentWindow.postMessage({ type: "p2s:config", site: config.site, sample: config.sample, themeCss: config.themeCss, fontsHref: config.fontsHref }, "*");
  }, [ready, config]);

  const go = (path) => frame.current?.contentWindow.postMessage({ type: "p2s:go", path }, "*");
  const pages = config ? [{ key: "", label: "Home" }, ...config.site.models.map((m) => ({ key: m.key, label: m.label }))] : [];
  const current = route.split("?")[0].replace(/^\//, "").split("/")[0];

  return (
    <section className="live" aria-label={label}>
      <div className="live-bar">
        <span className="live-dots" aria-hidden="true"><i /><i /><i /></span>
        <label className="live-page">
          <span className="sr-only">Page</span>
          <select value={pages.some((p) => p.key === current) ? current : ""} onChange={(e) => go(`/${e.target.value}`)} disabled={!config}>
            {pages.map((p) => <option key={p.key || "home"} value={p.key}>{p.label}</option>)}
          </select>
        </label>
        <span className={loading || !ready ? "live-state busy" : "live-state"}>
          {!ready ? "Starting…" : loading ? "Updating…" : "Live"}
        </span>
        {toolbar}
      </div>
      <div className="live-screen">
        <iframe
          ref={frame}
          title={label}
          src={`${API_URL}/preview-shell/index.html`}
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
        />
        {!ready && <div className="live-cover"><span className="spinner" /> Starting the preview…</div>}
      </div>
      {error && <p className="alert warn small">Preview couldn't update: {error}</p>}
    </section>
  );
}
