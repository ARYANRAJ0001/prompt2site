/**
 * Static website generator: prompt -> { html, css, js }.
 * Static pages are small enough for free models to write directly.
 * If the AI fails, a landing page is built from the matching built-in plan.
 */
const { ask, parseJson } = require("./ai");
const { findPreset } = require("./presets");
const { normalizeBlueprint } = require("./blueprint");

const SYSTEM = "You are a web designer. You return only a JSON object with html, css and js keys. No markdown, no explanation.";

function userPrompt(prompt, theme, hasImage) {
  return `Create a modern, responsive one-page website.

Topic: ${prompt}
Visual theme: ${theme || "modern"}
${hasImage ? "An image is attached: use it as a visual reference. Where you show it on the page use src=\"UPLOADED_IMAGE_HERE\"." : ""}

Rules:
- Return ONLY: {"html": "...", "css": "...", "js": "..."}
- html is the full index.html; it must link style.css and script.js.
- Sections: navbar, hero, 3 features or offerings, an about or showcase section, contact, footer.
- Real, specific text for this topic (no lorem ipsum). Mobile friendly.
- Keep it compact (under 250 lines in total).`;
}

function accept(text) {
  const out = parseJson(text);
  const html = String(out.html || out.HTML || out["index.html"] || "").trim();
  const css = String(out.css || out.CSS || out["style.css"] || "").trim();
  const js = String(out.js || out.javascript || out["script.js"] || "").trim();
  if (html.length < 200) throw new Error("html is missing or too short");
  if (!/<body|<section|<main|<header/i.test(html)) throw new Error("html has no page content");
  if (css.length < 100 && !/<style/i.test(html)) throw new Error("css is missing");
  return { html: ensureLinks(html), css, js };
}

/** Make sure the page links its css and js files (needed once deployed). */
function ensureLinks(html) {
  let h = html;
  if (!/href=["']\.?\/?style\.css["']/i.test(h)) {
    h = /<\/head>/i.test(h) ? h.replace(/<\/head>/i, '  <link rel="stylesheet" href="style.css">\n</head>') : `<link rel="stylesheet" href="style.css">\n${h}`;
  }
  if (!/src=["']\.?\/?script\.js["']/i.test(h)) {
    h = /<\/body>/i.test(h) ? h.replace(/<\/body>(?![\s\S]*<\/body>)/i, '  <script src="script.js"></script>\n</body>') : `${h}\n<script src="script.js"></script>`;
  }
  return h;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** A good-looking landing page built from a blueprint (no AI). */
function landingFromBlueprint(bp) {
  const showcase = bp.models.find((m) => m.public.list && (bp.sampleData[m.name] || []).length);
  const form = bp.models.find((m) => m.public.create && !m.public.list) || null;
  const money = (v) => `${esc(bp.currency)}${Number(v).toLocaleString("en-IN")}`;

  const cards = showcase
    ? bp.sampleData[showcase.name]
        .slice(0, 6)
        .map((item) => {
          const sub = showcase.subtitleField && item[showcase.subtitleField];
          const price = showcase.priceField && item[showcase.priceField];
          const text = showcase.fields.find((f) => f.type === "textarea" && item[f.name]);
          return `        <article class="card">
          <div class="card-head"><h3>${esc(item[showcase.titleField])}</h3>${price !== undefined && price !== "" ? `<span class="price">${money(price)}</span>` : ""}</div>
          ${sub ? `<span class="chip">${esc(sub)}</span>` : ""}
          ${text ? `<p>${esc(item[text.name])}</p>` : ""}
        </article>`;
        })
        .join("\n")
    : "";

  const formFields = (form ? form.fields : [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "message", label: "Message", type: "textarea", required: true },
  ])
    .map((f) => {
      const req = f.required ? " required" : "";
      if (f.type === "textarea") return `        <label>${esc(f.label)}<textarea name="${esc(f.name)}" rows="4"${req}></textarea></label>`;
      if (f.type === "select") return `        <label>${esc(f.label)}<select name="${esc(f.name)}">${f.options.map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>`;
      if (f.type === "boolean") return `        <label class="check"><input type="checkbox" name="${esc(f.name)}"> ${esc(f.label)}</label>`;
      const type = { email: "email", phone: "tel", date: "date", time: "time", number: "number", price: "number", url: "url", image: "url" }[f.type] || "text";
      return `        <label>${esc(f.label)}<input type="${type}" name="${esc(f.name)}"${req}></label>`;
    })
    .join("\n");

  const c = bp.contact || {};
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(bp.name)}</title>
  <meta name="description" content="${esc(bp.tagline)}">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="nav">
    <div class="wrap nav-inner">
      <a class="brand" href="#top">${esc(bp.name)}</a>
      <button class="menu" id="menuBtn" aria-label="Menu">☰</button>
      <nav id="navLinks">
        <a href="#features">About</a>
        ${showcase ? `<a href="#showcase">${esc(showcase.label)}</a>` : ""}
        <a href="#contact">${esc(form ? form.label : "Contact")}</a>
      </nav>
    </div>
  </header>

  <section class="hero" id="top">
    <div class="wrap">
      <h1>${esc(bp.hero.title)}</h1>
      <p>${esc(bp.hero.subtitle || bp.tagline)}</p>
      <a class="btn" href="${showcase ? "#showcase" : "#contact"}">${esc(bp.hero.cta)}</a>
    </div>
  </section>

  <section class="section" id="features">
    <div class="wrap grid">
${bp.features.map((f) => `      <div class="card feature"><div class="icon">${esc(f.icon)}</div><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></div>`).join("\n")}
    </div>
  </section>
${showcase ? `
  <section class="section alt" id="showcase">
    <div class="wrap">
      <h2>${esc(showcase.icon)} ${esc(showcase.label)}</h2>
      <div class="grid">
${cards}
      </div>
    </div>
  </section>
` : ""}
  <section class="section" id="contact">
    <div class="wrap narrow">
      <h2>${esc(form ? form.label : "Get in touch")}</h2>
      <form id="contactForm" class="card form">
${formFields}
        <button class="btn" type="submit">Send</button>
        <p id="formMsg" class="msg" role="status"></p>
      </form>
    </div>
  </section>

  <footer class="footer">
    <div class="wrap">
      <strong>${esc(bp.name)}</strong>
      ${c.address ? `<p>📍 ${esc(c.address)}</p>` : ""}${c.phone ? `<p>📞 ${esc(c.phone)}</p>` : ""}${c.email ? `<p>✉️ ${esc(c.email)}</p>` : ""}
      <p class="small">© ${new Date().getFullYear()} ${esc(bp.name)}</p>
    </div>
  </footer>
  <script src="script.js"></script>
</body>
</html>`;

  const dark = bp.theme.mode === "dark";
  const css = `:root { --primary: ${bp.theme.primary}; --accent: ${bp.theme.accent}; --bg: ${dark ? "#0f1115" : "#f8f8fb"}; --card: ${dark ? "#181b22" : "#fff"}; --text: ${dark ? "#eef0f4" : "#1b1d24"}; --muted: ${dark ? "#a2a8b5" : "#60667a"}; --line: ${dark ? "#2b303a" : "#e4e6ee"}; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; font-family: ${bp.theme.font === "serif" ? "Georgia, 'Times New Roman', serif" : "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"}; background: var(--bg); color: var(--text); line-height: 1.6; }
.wrap { max-width: 1100px; margin: 0 auto; padding: 0 16px; }
.narrow { max-width: 680px; }
.nav { position: sticky; top: 0; background: var(--card); border-bottom: 1px solid var(--line); z-index: 5; }
.nav-inner { display: flex; align-items: center; justify-content: space-between; min-height: 60px; }
.brand { font-weight: 800; font-size: 1.2rem; color: var(--text); text-decoration: none; }
nav a { color: var(--muted); text-decoration: none; margin-left: 20px; font-weight: 500; }
nav a:hover { color: var(--primary); }
.menu { display: none; background: none; border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; color: var(--text); font-size: 1.1rem; }
.hero { background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 55%, #000)); color: #fff; text-align: center; padding: clamp(64px, 12vw, 130px) 0; }
.hero h1 { font-size: clamp(2rem, 6vw, 3.4rem); margin: 0 0 12px; }
.hero p { font-size: clamp(1rem, 2.4vw, 1.25rem); opacity: .92; max-width: 640px; margin: 0 auto 28px; }
.btn { display: inline-block; background: var(--accent); color: #111; padding: 12px 26px; border-radius: 10px; font-weight: 700; text-decoration: none; border: 0; cursor: pointer; font: inherit; font-weight: 700; }
.section { padding: 64px 0; }
.section.alt { background: color-mix(in srgb, var(--primary) 6%, var(--bg)); }
.section h2 { text-align: center; font-size: clamp(1.5rem, 4vw, 2rem); margin: 0 0 28px; }
.grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 22px; }
.feature { text-align: center; }
.icon { font-size: 2.2rem; }
.card h3 { margin: 6px 0; }
.card p { color: var(--muted); margin: 8px 0 0; }
.card-head { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
.price { color: var(--primary); font-weight: 800; white-space: nowrap; }
.chip { display: inline-block; font-size: .8rem; padding: 2px 10px; border-radius: 999px; background: color-mix(in srgb, var(--primary) 12%, var(--card)); color: var(--primary); font-weight: 600; }
.form { display: grid; gap: 12px; }
.form label { display: grid; gap: 4px; color: var(--muted); font-size: .92rem; }
.form .check { display: flex; align-items: center; gap: 8px; }
input, textarea, select { font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--text); }
.msg { color: var(--primary); font-weight: 600; margin: 0; }
.footer { background: var(--card); border-top: 1px solid var(--line); padding: 32px 0; text-align: center; }
.footer p { margin: 4px 0; color: var(--muted); }
.small { font-size: .85rem; }
@media (max-width: 700px) {
  .menu { display: block; }
  nav { display: none; position: absolute; top: 60px; left: 0; right: 0; background: var(--card); border-bottom: 1px solid var(--line); padding: 8px 16px; }
  nav.show { display: grid; }
  nav a { margin: 8px 0; }
}`;

  const js = `const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
menuBtn.addEventListener("click", () => navLinks.classList.toggle("show"));
navLinks.addEventListener("click", () => navLinks.classList.remove("show"));

const form = document.getElementById("contactForm");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  document.getElementById("formMsg").textContent = "Thank you! We'll get back to you soon.";
  form.reset();
});`;

  return { html, css, js };
}

async function generateStaticSite(prompt, { theme, imageDataUrl, apiKey, onProgress } = {}) {
  try {
    const { value, model } = await ask({
      label: "Writing the website",
      system: SYSTEM,
      user: userPrompt(prompt, theme, Boolean(imageDataUrl)),
      apiKey,
      json: true,
      maxTokens: 3000,
      onProgress,
      accept,
      ...(imageDataUrl ? { imageDataUrl } : {}),
    });
    const site = { ...value };
    if (imageDataUrl) site.html = site.html.split("UPLOADED_IMAGE_HERE").join(imageDataUrl);
    return { site, source: "ai", model };
  } catch (error) {
    console.log("[static] AI failed, building from a built-in plan:", error.message);
    const preset = findPreset(prompt);
    const bp = normalizeBlueprint(preset.blueprint, prompt);
    return {
      site: landingFromBlueprint(bp),
      source: "template",
      warning: `The AI couldn't write this page, so it was built from the "${preset.title}" template. You can edit the code below.`,
      reason: error.message,
    };
  }
}

module.exports = { generateStaticSite, landingFromBlueprint };
