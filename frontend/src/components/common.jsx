import { useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import Universe from "./Universe.jsx";

export function JobStatus({ job, hint }) {
  if (!job.running) return null;
  return (
    <div className="job">
      <span className="spinner" aria-hidden="true" />
      <div>
        <strong>{job.step}</strong> <span className="muted">· {job.seconds}s</span>
        {hint && <div className="muted small">{hint}</div>}
      </div>
    </div>
  );
}

export function ErrorBox({ error, onClose }) {
  if (!error) return null;
  return (
    <div className="alert error">
      <div>
        <strong>{error.message || String(error)}</strong>
        {error.details && <pre className="details">{error.details}</pre>}
      </div>
      {onClose && <button className="link" onClick={onClose} aria-label="Dismiss"><Icon name="X" size={16} /></button>}
    </div>
  );
}

export function LinkList({ links }) {
  const rows = [
    ["Live website", links.live, "Globe"],
    ["Backend API", links.backend && `${links.backend}/api/health`, "Server"],
    ["GitHub code", links.github, "Github"],
  ].filter(([, url]) => url);
  if (!rows.length) return null;
  return (
    <div className="links">
      {rows.map(([label, url, icon]) => (
        <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="link-row">
          <span className="row"><Icon name={icon} size={17} /> {label}</span>
          <span className="url">{url.replace(/^https?:\/\//, "")}</span>
        </a>
      ))}
    </div>
  );
}

export function MissingKeys({ health, need }) {
  if (!health || health.offline || !health.keys) return null;
  const names = { openrouter: "OPENROUTER_API_KEY", github: "GITHUB_TOKEN", netlify: "NETLIFY_TOKEN", render: "RENDER_API_KEY + RENDER_OWNER_ID" };
  const missing = need.filter((k) => !health.keys[k]).map((k) => names[k]);
  if (!missing.length) return null;
  return <p className="alert warn">To deploy, add these to <code>backend/.env</code> and restart the backend: {missing.join(", ")}</p>;
}

/** Simple file browser for a { path: content } map. */
export function CodeViewer({ files }) {
  const paths = useMemo(() => Object.keys(files || {}).sort(sortPaths), [files]);
  const [current, setCurrent] = useState(null);
  const shown = current && files[current] !== undefined ? current : paths.find((p) => p.endsWith("server.js")) || paths[0];

  if (!paths.length) return <p className="muted">No files yet.</p>;
  return (
    <div className="code-viewer">
      <ul className="file-list">
        {paths.map((p) => (
          <li key={p}>
            <button className={p === shown ? "file active" : "file"} onClick={() => setCurrent(p)} style={{ paddingLeft: 8 + (p.split("/").length - 1) * 12 }}>
              {p.split("/").pop()}
              <span className="dir">{p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ""}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="file-view">
        <div className="file-head">
          <code>{shown}</code>
          <button className="btn ghost small" onClick={() => navigator.clipboard?.writeText(files[shown])}>Copy</button>
        </div>
        <pre><code>{files[shown]}</code></pre>
      </div>
    </div>
  );
}

function sortPaths(a, b) {
  const depth = (p) => (p.includes("/") ? 1 : 0);
  return depth(a) - depth(b) || a.localeCompare(b);
}

/** The Prompt2Site mark: a prompt line turning into a page. */
export function Mark({ size = 26 }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="p2s-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#8e94a6" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="9" fill="url(#p2s-g)" />
      <path d="M9 11.5l4 3.5-4 3.5" fill="none" stroke="#0b0b0d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="15.5" y="17" width="8" height="2.6" rx="1.3" fill="#0b0b0d" />
    </svg>
  );
}

/** The slowly moving colour field behind the builder. */
/* A few glass slabs drifting among the stars: [left %, top %, width, height, tilt, drift time] */
const CRYSTALS = [
  [6, 14, 120, 160, -12, 26], [46, 6, 100, 130, 9, 31], [84, 30, 130, 170, -9, 34],
  [24, 48, 110, 150, 10, 33], [64, 62, 140, 110, -6, 29], [8, 78, 120, 160, 7, 36],
];

export function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="a1" />
      <span className="a2" />
      <Universe />
      <div className="space">
        <span className="sun" />
        <span className="planet"><span className="planet-surface" /></span>
        <span className="ring" />
        <span className="moon-orbit"><span className="moon" /></span>
      </div>
      <div className="crystals">
        {CRYSTALS.map(([x, y, w, h, r, d], i) => (
          <i key={i} style={{ "--x": `${x}%`, "--y": `${y}%`, "--w": `${w}px`, "--h": `${h}px`, "--r": `${r}deg`, "--d": `${d}s`, "--n": i }} />
        ))}
      </div>
    </div>
  );
}
