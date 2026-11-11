/**
 * Live preview for the builder: one demo build of the site template whose
 * settings arrive by postMessage, so changes show instantly (no rebuild).
 *
 *   GET  /preview-shell/index.html     the shell (built once, cached on disk)
 *   POST /api/fullstack/live-config    plan -> { site, sample, themeCss, fontsHref }
 *
 * The builder iframe loads the shell, the shell says "p2s:ready", the builder
 * replies { type: "p2s:config", ... } and again after every edit.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ROOT, buildFrontend } = require("./build");
const { generateProject, themeCss, siteConfig, fontFor } = require("./generator");
const { normalizeBlueprint } = require("./blueprint");
const { PRESETS } = require("./presets");

const TEMPLATE_DIR = path.join(__dirname, "..", "templates", "frontend");

function templateHash() {
  const h = crypto.createHash("sha1");
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else h.update(e.name).update(fs.readFileSync(full));
    }
  };
  walk(TEMPLATE_DIR);
  h.update(fs.readFileSync(__filename));
  return h.digest("hex").slice(0, 12);
}

const SHELL_CONFIG = (site, sample) => `/* Live preview: settings come from the builder by postMessage. */
export let SITE = ${JSON.stringify(site)};
export let SAMPLE = ${JSON.stringify(sample)};
export function setConfig(site, sample) {
  SITE = site;
  SAMPLE = sample;
}
`;

const SHELL_MAIN = `import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./auth.jsx";
import { setConfig } from "./config.js";
import { resetDemoData } from "./api.js";
import { resetLookups } from "./lookup.js";
import "./theme.css";
import "./styles.css";

function applyLook(css, fontsHref) {
  let style = document.getElementById("p2s-theme");
  if (!style) {
    style = document.createElement("style");
    style.id = "p2s-theme";
    document.head.appendChild(style);
  }
  style.textContent = css;
  let link = document.getElementById("p2s-fonts");
  if (!link) {
    link = document.createElement("link");
    link.id = "p2s-fonts";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (fontsHref && link.href !== fontsHref) link.href = fontsHref;
}

function Shell() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const onMessage = (e) => {
      const d = e.data;
      if (!d || e.source !== window.parent) return;
      if (d.type === "p2s:config") {
        setConfig(d.site, d.sample);
        resetDemoData();
        resetLookups();
        applyLook(d.themeCss, d.fontsHref);
        document.title = d.site.name;
        setVersion((v) => v + 1);
      } else if (d.type === "p2s:go" && typeof d.path === "string") {
        window.location.hash = "#" + d.path;
      }
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "p2s:ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);
  // Tell the builder which page is open (so its page picker can follow).
  useEffect(() => {
    const send = () => window.parent.postMessage({ type: "p2s:route", path: window.location.hash.slice(1) || "/" }, "*");
    send();
    window.addEventListener("hashchange", send);
    return () => window.removeEventListener("hashchange", send);
  }, []);
  if (version === 0) return null; // wait for the first settings
  return (
    <HashRouter>
      <AuthProvider>
        <App key={version} />
      </AuthProvider>
    </HashRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Shell />);
`;

/** What the shell needs for a plan. */
function liveConfig(rawBlueprint) {
  const bp = normalizeBlueprint(rawBlueprint);
  const site = siteConfig(bp);
  const f = fontFor(bp.theme);
  return {
    site,
    sample: bp.sampleData || {},
    themeCss: themeCss(bp.theme),
    fontsHref: `https://fonts.googleapis.com/css2?family=${f.css}&display=swap`,
    blueprint: bp,
  };
}

let building = null;
const dirFor = (hash) => path.join(ROOT, "preview-shell", hash);

/** Builds the shell once per template version; returns its folder. */
function ensureShell() {
  const hash = templateHash();
  const dir = dirFor(hash);
  if (fs.existsSync(path.join(dir, "index.html"))) return Promise.resolve(dir);
  if (building?.hash === hash) return building.promise;
  const promise = (async () => {
    const bp = normalizeBlueprint(PRESETS[0].blueprint);
    const files = generateProject(bp);
    const live = liveConfig(bp);
    files["frontend/src/config.js"] = SHELL_CONFIG(live.site, live.sample);
    files["frontend/src/main.jsx"] = SHELL_MAIN;
    files["frontend/src/theme.css"] = live.themeCss;
    const { dir: tmp, distDir } = await buildFrontend(files, { demo: true });
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    fs.cpSync(distDir, dir, { recursive: true });
    fs.rm(tmp, { recursive: true, force: true }, () => {});
    // drop older shells
    for (const old of fs.readdirSync(path.dirname(dir))) if (old !== hash) fs.rm(path.join(path.dirname(dir), old), { recursive: true, force: true }, () => {});
    return dir;
  })();
  building = { hash, promise };
  promise.catch(() => (building = null));
  return promise;
}

/** Express handler for /preview-shell/* */
function shellHandler(req, res, next) {
  ensureShell()
    .then((dir) => {
      const rel = decodeURIComponent(req.path).replace(/^\/+/, "") || "index.html";
      const file = path.join(dir, rel);
      if (!file.startsWith(dir) || !fs.existsSync(file)) return res.status(404).end();
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Cache-Control", rel === "index.html" ? "no-cache" : "public, max-age=86400");
      res.sendFile(file);
    })
    .catch(next);
}

module.exports = { liveConfig, ensureShell, shellHandler };
