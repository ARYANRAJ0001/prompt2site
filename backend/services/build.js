/**
 * Builds a generated frontend with Vite.
 *
 * Generated frontends always use the same packages (they come from our
 * templates, not the AI), so those are installed once into a shared folder
 * and linked into every build. The first build takes a minute or two; after
 * that each build takes a few seconds.
 *
 * Builds run with a minimal environment: none of this server's secrets.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = process.env.BUILD_DIR || path.join(os.tmpdir(), "prompt2site-builds");
const BASE = path.join(ROOT, "base");

// Non-secret settings npm needs (proxies, certificates, registry).
const PASSTHROUGH = /^(https?_proxy|no_proxy|node_extra_ca_certs|ssl_cert_file|ssl_cert_dir|npm_config_registry|npm_config_proxy|npm_config_https_proxy|npm_config_cafile|npm_config_strict_ssl|lang|tz)$/i;
function cleanEnv(extra = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => PASSTHROUGH.test(k)));
  return {
    ...env,
    PATH: process.env.PATH,
    HOME: process.env.HOME || os.tmpdir(),
    npm_config_cache: path.join(ROOT, "npm-cache"),
    npm_config_update_notifier: "false",
    ...extra,
  };
}

function run(cmd, args, { cwd, env, timeoutMs = 300000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
    let output = "";
    const keep = (c) => (output = (output + c.toString()).slice(-8000));
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(Object.assign(new Error(`${cmd} ${args[0]} timed out`), { output }));
    }, timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(Object.assign(e, { output }));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(output) : reject(Object.assign(new Error(`${cmd} ${args[0]} exited with code ${code}`), { output }));
    });
  });
}

function summarize(output) {
  const lines = String(output || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const important = lines.filter((l) => /error|failed|cannot|not found|unexpected|ENOTFOUND|ETIMEDOUT|EACCES/i.test(l));
  return (important.length ? important : lines).slice(-10).join("\n");
}

// One task at a time: builds are memory-heavy on small servers.
let queue = Promise.resolve();
const serial = (task) => {
  const p = queue.then(task, task);
  queue = p.catch(() => {});
  return p;
};

let basePromise = null;
/** Install the shared frontend packages (once per server start, reused after). */
function ensureBase(packageJson, onProgress) {
  const wanted = JSON.stringify({ d: packageJson.dependencies, dd: packageJson.devDependencies });
  const stamp = path.join(BASE, ".deps");
  if (fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8") === wanted && fs.existsSync(path.join(BASE, "node_modules", "vite"))) {
    return Promise.resolve();
  }
  if (basePromise) return basePromise;

  basePromise = (async () => {
    onProgress?.("Installing website packages (first build only, ~1–2 minutes)");
    fs.mkdirSync(BASE, { recursive: true });
    fs.writeFileSync(
      path.join(BASE, "package.json"),
      JSON.stringify({ name: "build-base", private: true, dependencies: packageJson.dependencies, devDependencies: packageJson.devDependencies }, null, 2)
    );
    try {
      await run("npm", ["install", "--include=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"], {
        cwd: BASE,
        env: cleanEnv(),
        timeoutMs: 600000,
      });
    } catch (err) {
      const e = new Error("Couldn't install the website packages on the server.");
      e.details = summarize(err.output || err.message);
      throw e;
    }
    fs.writeFileSync(stamp, wanted);
  })().finally(() => {
    basePromise = null;
  });
  return basePromise;
}

/**
 * Build the frontend part of a generated project.
 * @param files     project files map (paths starting with "frontend/")
 * @param options   { apiUrl, demo, onProgress }
 * @returns         { dir, distDir } — caller deletes `dir` when done
 */
function buildFrontend(files, { apiUrl = "", demo = false, onProgress } = {}) {
  return serial(async () => {
    const pkg = JSON.parse(files["frontend/package.json"]);
    await ensureBase(pkg, onProgress);

    onProgress?.(demo ? "Building the preview" : "Building the website");
    const dir = fs.mkdtempSync(path.join(ROOT, "job-"));
    for (const [p, content] of Object.entries(files)) {
      if (!p.startsWith("frontend/")) continue;
      const target = path.join(dir, p.slice("frontend/".length));
      if (!target.startsWith(dir + path.sep)) continue; // never write outside the build folder
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
    fs.symlinkSync(path.join(BASE, "node_modules"), path.join(dir, "node_modules"), "junction");

    try {
      await run(process.execPath, [path.join(BASE, "node_modules", "vite", "bin", "vite.js"), "build", "--logLevel", "error"], {
        cwd: dir,
        env: cleanEnv({ NODE_ENV: "production", VITE_API_URL: apiUrl, VITE_DEMO: demo ? "true" : "false" }),
        timeoutMs: 240000,
      });
    } catch (err) {
      fs.rm(dir, { recursive: true, force: true }, () => {});
      const e = new Error("The website didn't build.");
      e.details = summarize(err.output || err.message);
      throw e;
    }
    const distDir = path.join(dir, "dist");
    if (!fs.existsSync(path.join(distDir, "index.html"))) throw new Error("Build finished but no index.html was produced");
    return { dir, distDir };
  });
}

module.exports = { buildFrontend, ROOT, run, cleanEnv, summarize };
