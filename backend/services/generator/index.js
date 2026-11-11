/**
 * Blueprint -> complete project: { "path/file": "contents", ... }
 */
const fs = require("fs");
const path = require("path");
const { generateBackend, slug, refPrefix } = require("./backend");

const TEMPLATE_DIR = path.join(__dirname, "..", "..", "templates", "frontend");
const J = (v) => JSON.stringify(v, null, 2);

function readTemplates(dir, base = dir, out = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) readTemplates(full, base, out);
    else out[path.relative(base, full).split(path.sep).join("/")] = fs.readFileSync(full, "utf8");
  }
  return out;
}
let templateCache = null;
const templates = () => (templateCache ||= readTemplates(TEMPLATE_DIR));

// ------------------------------------------------------------- theme

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const onColor = (hex) => (luminance(hex) > 0.45 ? "#111111" : "#ffffff");

// Each plan font style maps to a Google Font pairing (loaded in index.html).
const FONTS = {
  sans: { heading: "Manrope", body: "Manrope", weight: 800, tracking: "-0.025em", display: "-0.045em", css: "Manrope:wght@400;500;600;700;800" },
  serif: { heading: "Fraunces", body: "Manrope", weight: 600, tracking: "-0.015em", display: "-0.03em", css: "Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800" },
  rounded: { heading: "Nunito", body: "Nunito", weight: 800, tracking: "-0.015em", display: "-0.03em", css: "Nunito:wght@400;500;600;700;800;900" },
  mono: { heading: "Space Grotesk", body: "Manrope", weight: 700, tracking: "-0.03em", display: "-0.05em", css: "Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700;800" },
};
const fontFor = (theme) => FONTS[theme.font] || FONTS.sans;
const STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** A darker (or, on dark pages, lighter) version of the brand colour that's readable as text. */
function readable(hex, dark) {
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mix = (t, to) => [r, g, b].map((c) => Math.round(c + (to - c) * t));
  for (let i = 0; i < 12; i++) {
    const h = "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
    const L = luminance(h);
    const contrast = dark ? (L + 0.05) / (0.012 + 0.05) : (0.93 + 0.05) / (L + 0.05);
    if (contrast >= 4.6) return h;
    [r, g, b] = mix(0.18, dark ? 255 : 0);
  }
  return dark ? "#ffffff" : "#000000";
}

function themeCss(theme) {
  if (theme.mode === "crystal") return crystalCss(theme);
  const dark = theme.mode === "dark";
  // In dark mode a very dark brand colour won't show up on the dark page.
  const primary = dark && luminance(theme.primary) < 0.06 ? theme.accent : theme.primary;
  const f = fontFor(theme);
  return `/* Generated from the app's plan — change colours and fonts here. */
:root {
  --primary: ${primary};
  --accent: ${theme.accent};
  --primary-text: ${readable(primary, dark)};
  --on-primary: ${onColor(primary)};
  --on-accent: ${onColor(theme.accent)};
  --bg: ${dark ? "#0c0d12" : "#f6f6f9"};
  --surface: ${dark ? "#16181f" : "#ffffff"};
  --text: ${dark ? "#f2f3f7" : "#15161c"};
  --muted: ${dark ? "#a3a8b6" : "#5d6170"};
  --soft: ${dark ? "rgba(255, 255, 255, 0.06)" : "rgba(21, 22, 28, 0.045)"};
  --line: ${dark ? "rgba(255, 255, 255, 0.08)" : "rgba(21, 22, 28, 0.08)"};
  --border: var(--line);
  --danger: ${dark ? "#f87171" : "#dc2626"};
  --ok-text: ${dark ? "#4ade80" : "#15803d"};
  --warn-text: ${dark ? "#fbbf24" : "#b45309"};
  --info-text: ${dark ? "#93c5fd" : "#1d4ed8"};

  /* frosted glass */
  --glass: ${dark ? "rgba(22, 24, 31, 0.58)" : "rgba(255, 255, 255, 0.62)"};
  --glass-strong: ${dark ? "rgba(30, 33, 42, 0.78)" : "rgba(255, 255, 255, 0.82)"};
  --glass-hover: ${dark ? "rgba(40, 44, 56, 0.85)" : "rgba(255, 255, 255, 0.95)"};
  --glass-border: ${dark ? "rgba(255, 255, 255, 0.09)" : "rgba(255, 255, 255, 0.75)"};
  --glass-highlight: ${dark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.9)"};
  --glass-shadow: ${dark ? "inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 50px -30px rgba(0,0,0,0.8)" : "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(21,22,28,0.04), 0 18px 44px -28px rgba(21,22,28,0.28)"};
  --glass-shadow-lift: ${dark ? "inset 0 1px 0 rgba(255,255,255,0.07), 0 28px 60px -28px rgba(0,0,0,0.9)" : "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 4px rgba(21,22,28,0.05), 0 28px 60px -28px rgba(21,22,28,0.38)"};
  --input-bg: ${dark ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.7)"};
  --input-border: ${dark ? "rgba(255, 255, 255, 0.12)" : "rgba(21, 22, 28, 0.12)"};
  --blob-opacity: ${dark ? 0.32 : 0.36};

  --radius: ${theme.font === "rounded" ? "16px" : "12px"};
  --shadow: var(--glass-shadow);
  --font: "${f.body}", ${STACK};
  --heading-font: "${f.heading}", ${f.heading === "Fraunces" ? 'Georgia, "Times New Roman", serif' : STACK};
  --heading-weight: ${f.weight};
  --heading-tracking: ${f.tracking};
  --display-tracking: ${f.display};
  color-scheme: ${dark ? "dark" : "light"};
}
`;
}

/**
 * "Crystal black": a near-black page, the brand colours as slow light behind
 * clear glass with bright cut edges. For jewellery, tech, salons, studios.
 */
function crystalCss(theme) {
  const f = fontFor(theme);
  const primary = luminance(theme.primary) < 0.06 ? theme.accent : theme.primary;
  return `/* Generated from the app's plan — "Crystal black" theme. */
:root {
  --primary: ${primary};
  --accent: ${theme.accent};
  --primary-text: ${readable(primary, true)};
  --on-primary: ${onColor(primary)};
  --on-accent: ${onColor(theme.accent)};
  --bg: #030303;
  --surface: #0e0e10;
  --text: #f4f5f8;
  --muted: #a6a8b0;
  --soft: rgba(255, 255, 255, 0.055);
  --line: rgba(255, 255, 255, 0.08);
  --border: var(--line);
  --danger: #ff6b7d;
  --ok-text: #4ade80;
  --warn-text: #fbbf24;
  --info-text: #93c5fd;
  --glass: linear-gradient(160deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.02) 55%, rgba(255, 255, 255, 0.045));
  --glass-strong: rgba(20, 20, 23, 0.84);
  --glass-hover: rgba(34, 34, 38, 0.9);
  --glass-border: rgba(255, 255, 255, 0.11);
  --glass-highlight: rgba(255, 255, 255, 0.14);
  --glass-shadow: inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(255,255,255,0.03), 0 30px 60px -34px rgba(0,0,0,0.95);
  --glass-shadow-lift: inset 0 1px 0 rgba(255,255,255,0.16), 0 0 0 1px color-mix(in srgb, ${primary} 35%, transparent), 0 40px 80px -30px color-mix(in srgb, ${primary} 45%, #000);
  --input-bg: rgba(255, 255, 255, 0.04);
  --input-border: rgba(255, 255, 255, 0.13);
  --blob-opacity: 0.07;
  --radius: 14px;
  --shadow: var(--glass-shadow);
  --font: "${f.body}", ${STACK};
  --heading-font: "${f.heading}", ${f.heading === "Fraunces" ? 'Georgia, "Times New Roman", serif' : STACK};
  --heading-weight: ${f.weight};
  --heading-tracking: ${f.tracking};
  --display-tracking: ${f.display};
  color-scheme: dark;
}
/* night sky: black with slowly drifting stars */
.backdrop::before { content: ""; position: absolute; inset: -50%; opacity: 0.6;
  background-image: radial-gradient(1.2px 1.2px at 20px 30px, #fff, transparent), radial-gradient(1px 1px at 140px 90px, #e6e8ee, transparent), radial-gradient(1.5px 1.5px at 240px 170px, #fff, transparent), radial-gradient(1px 1px at 330px 40px, #f2f2f2, transparent), radial-gradient(1px 1px at 400px 230px, #fff, transparent), radial-gradient(0.8px 0.8px at 90px 210px, #fff, transparent);
  background-size: 440px 270px; animation: crystal-stars 140s linear infinite; }
@keyframes crystal-stars { to { transform: translate3d(-440px, -270px, 0); } }
@media (prefers-reduced-motion: reduce) { .backdrop::before { animation: none; } }
/* crystal edges and a silver headline */
.card, .tile, .navbar-bar, .board-col, .footer-inner, .pay-box { background: var(--glass); }
.hero h1 .word, .hero h1:not(:has(.word)) { background: linear-gradient(180deg, #ffffff 0%, #dfe3ee 45%, color-mix(in srgb, ${primary} 55%, #b9bfd0) 100%); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }
.pane { background: linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 60%, color-mix(in srgb, ${primary} 18%, transparent)); border-color: rgba(255,255,255,0.18); }
.backdrop { background: radial-gradient(1200px 600px at 50% -10%, color-mix(in srgb, ${primary} 7%, transparent), transparent 70%), #030303; }
.btn.glass, .btn.light, .btn.ghost { --btn-bg: rgba(255, 255, 255, 0.06); }
`;
}

// ------------------------------------------------------------- frontend

/** The settings the frontend reads (src/config.js). */
function siteConfig(bp) {
  return {
    name: bp.name,
    tagline: bp.tagline,
    description: bp.description,
    hero: bp.hero,
    features: bp.features,
    about: bp.about,
    contact: bp.contact,
    currency: bp.currency,
    auth: bp.auth,
    // public owner details (shown to customers): contact, WhatsApp chat, UPI
    owner: { name: bp.owner?.name || "", email: bp.owner?.email || "", phone: bp.owner?.phone || "", upiId: bp.owner?.upiId || "", payeeName: bp.owner?.payeeName || "", qrImage: bp.owner?.qrImage || "" },
    acceptPayments: Boolean(bp.acceptPayments && bp.owner?.upiId),
    requireLogin: Boolean(bp.requireLogin),
    models: bp.models.map((m) => ({ ...m, prefix: refPrefix(m) })),
  };
}

function configJs(bp) {
  const site = siteConfig(bp);
  return `/**
 * Site settings, generated from the app's plan.
 * Edit text, labels and fields here; the backend's models/ folder has the
 * matching database fields.
 */
export const SITE = ${J(site)};

/** Sample data used by preview mode (the real backend has its own copy in backend/data/seed.js). */
export const SAMPLE = ${J(bp.sampleData)};
`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function generateFrontend(bp) {
  const files = {};
  for (const [p, content] of Object.entries(templates())) files[`frontend/${p}`] = content;

  files["frontend/package.json"] = J({
    name: `${slug(bp.name)}-frontend`,
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    dependencies: {
      axios: "^1.7.7",
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      "react-router-dom": "^6.26.2",
      qrcode: "^1.5.4",
      "lucide-react": "0.460.0",
    },
    devDependencies: {
      "@vitejs/plugin-react": "^4.3.2",
      vite: "^5.4.8",
    },
  }) + "\n";

  const emoji = bp.models[0]?.icon || "✨";
  files["frontend/index.html"] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(bp.tagline || bp.description || bp.name)}" />
    <meta name="theme-color" content="${bp.theme.primary}" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${encodeURIComponent(emoji)}</text></svg>" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fontFor(bp.theme).css}&display=swap" />
    <title>${escapeHtml(bp.name)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
  files["frontend/src/config.js"] = configJs(bp);
  files["frontend/src/theme.css"] = themeCss(bp.theme);
  files["frontend/.env.example"] = "# Your backend's URL\nVITE_API_URL=http://localhost:5000\n";
  return files;
}

// ------------------------------------------------------------- project

function readme(bp) {
  const api = bp.models
    .map((m) => {
      const who = !bp.auth ? "anyone" : m.ownedByUser ? "logged-in user (own records)" : null;
      const view = who || (m.public.list ? "anyone" : "admin");
      const create = who || (m.public.create ? "anyone" : "admin");
      const manage = who || "admin";
      return `| \`/api/${m.key}\` | ${m.label} | ${view} | ${create} | ${manage} |`;
    })
    .join("\n");

  return `# ${bp.name}

${bp.tagline || bp.description || ""}

Full-stack app generated by **Prompt2Site**: React + Vite frontend, Node.js + Express + MongoDB backend.

## Run it locally

\`\`\`bash
# 1. Backend
cd backend
npm install
cp .env.example .env     # optional: add MONGO_URI (without it, an in-memory database is used)
npm start                # http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173
\`\`\`
${bp.auth ? `
## Accounts & the admin

- **Admin = the site owner.** On start-up the backend creates one admin account from \`ADMIN_EMAIL\` (default: ${bp.owner?.email || "the owner email in src/config.js"}) and \`ADMIN_PASSWORD\`. If \`ADMIN_PASSWORD\` is empty, a password is printed in the server log.
- **Everyone who signs up is a customer** and gets a customer ID like \`CUS-7K2Q9X\`. Nobody can sign up as admin.
- With email set up (\`SMTP_USER\` / \`SMTP_PASS\`), new customers confirm their email with a 6-digit code, and "Forgot password" works.
- To reset the admin password: set a new \`ADMIN_PASSWORD\` and change \`ADMIN_PASSWORD_SET_AT\` (any new value), then restart.
` : ""}${bp.models.some((m) => m.submission) ? `
## Orders, bookings & alerts

- Every ${bp.models.filter((m) => m.submission).map((m) => m.singular.toLowerCase()).join(" / ")} gets a reference number (e.g. \`${refPrefix(bp.models.find((m) => m.submission))}-7K2Q9X\`). Guests get a private tracking link; logged-in customers see theirs in **My account**.
- The owner gets an **email** (\`SMTP_*\`, \`NOTIFY_EMAIL\`) and a **WhatsApp message** (\`WHATSAPP_PHONE\` + \`WHATSAPP_APIKEY\` from CallMeBot: send "I allow callmebot to send me messages" to +34 621 331 709 on WhatsApp).
${bp.acceptPayments ? `- **UPI payments** go straight to ${bp.owner?.upiId || "the owner's UPI ID"}. The amount is worked out on the server. After paying, the customer enters the UTR; the owner checks the bank app and marks it **Paid** or **Unpaid** in the admin table (UPI can't confirm payments to a website automatically).
` : ""}` : ""}
## API

| Endpoint | What | View | Create | Edit / delete |
| --- | --- | --- | --- | --- |
${api}
${bp.auth ? "| `/api/auth/register`, `/api/auth/login`, `/api/auth/me` | Accounts | | | |\n" : ""}| \`/api/health\` | Health check | anyone | | |

## Project structure

\`\`\`
backend/
  server.js            app setup and routes
  models/              database models (one per data type)
  routes/              API endpoints (one file per data type)
  lib/validate.js      request validation
  lib/store.js         MongoDB, or in-memory if MONGO_URI is empty
  data/seed.js         sample data added on first start
frontend/
  src/config.js        site text, pages and fields
  src/theme.css        colours and fonts
  src/pages/           Home, list/detail pages, login
  src/components/      cards, forms, navbar
\`\`\`

## Deploy

- **Backend → Render**: new Web Service, root directory \`backend\`, build \`npm install\`, start \`npm start\`. Add \`MONGO_URI\` and \`JWT_SECRET\`.
- **Frontend → Netlify**: base directory \`frontend\`, build \`npm run build\`, publish \`frontend/dist\`. Add \`VITE_API_URL\` = your Render URL.
`;
}

function generateProject(bp) {
  return {
    "README.md": readme(bp),
    ".gitignore": "node_modules\n.env\ndist\n.DS_Store\n",
    "netlify.toml": '[build]\n  base = "frontend"\n  command = "npm run build"\n  publish = "dist"\n',
    "render.yaml": `services:\n  - type: web\n    name: ${slug(bp.name)}-api\n    runtime: node\n    rootDir: backend\n    buildCommand: npm install\n    startCommand: npm start\n    plan: free\n    envVars:\n      - key: MONGO_URI\n        sync: false\n      - key: JWT_SECRET\n        generateValue: true\n`,
    "blueprint.json": J(bp) + "\n",
    ...generateBackend(bp),
    ...generateFrontend(bp),
  };
}

module.exports = { generateProject, slug, themeCss, configJs, siteConfig, fontFor };
