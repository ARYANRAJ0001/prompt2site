// Load backend/.env from this folder (wherever npm start is run from). Values in
// .env win over old ones exported in the terminal (e.g. a stale GITHUB_TOKEN).
require("dotenv").config({ path: require("path").join(__dirname, ".env"), override: true });
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { requireAuth } = require("./middleware/auth");
const { getJob, publicJob } = require("./services/jobs");
const { PREVIEW_DIR } = require("./services/preview");

const app = express();
const PORT = process.env.PORT || 1256;

// Preview builds of generated apps (shown in a sandboxed iframe in the
// builder). A sandboxed frame has a "null" origin, so its scripts load
// cross-origin: allow any origin here. Previews only contain sample data.
app.use(
  "/preview",
  express.static(PREVIEW_DIR, {
    maxAge: "10m",
    setHeaders: (res) => res.set("Access-Control-Allow-Origin", "*"),
  })
);

// Live game preview for the builder (the real game, settings arrive by postMessage).
{
  const path = require("path");
  const gameDir = path.join(__dirname, "templates", "game", "frontend");
  const cors0 = (res) => res.set("Access-Control-Allow-Origin", "*");
  app.get("/game-preview/config.js", (req, res) => (cors0(res), res.type("js").send("window.GAME_CONFIG = null;")));
  app.get("/game-preview/lib/three.module.min.js", (req, res) =>
    (cors0(res), res.sendFile(path.join(__dirname, "node_modules", "three", "build", "three.module.min.js"), { maxAge: "1d" }))
  );
  app.use("/game-preview", express.static(gameDir, { maxAge: "5m", setHeaders: cors0 }));
}

// Live preview shell (one demo build; settings arrive by postMessage).
app.use("/preview-shell", require("./services/previewShell").shellHandler);

// Who may call this API: your builder frontend(s) + localhost for development.
const allowed = [
  "http://localhost:5173",
  "http://localhost:3000",
  ...(process.env.FRONTEND_URL || "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean),
];
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(Object.assign(new Error(`Origin ${origin} is not allowed. Add it to FRONTEND_URL.`), { status: 403 }));
    },
    allowedHeaders: ["Content-Type", "Authorization", "X-OpenRouter-Key"],
  })
);
app.use(express.json({ limit: "6mb" }));

app.get("/", (req, res) => res.json({ name: "Prompt2Site API", health: "/api/health" }));
app.get("/api/health", (req, res) =>
  res.json({
    success: true,
    database: mongoose.connection.readyState === 1 ? "connected" : "not connected",
    keys: {
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      github: Boolean(process.env.GITHUB_TOKEN),
      netlify: Boolean(process.env.NETLIFY_TOKEN),
      render: Boolean(process.env.RENDER_API_KEY && process.env.RENDER_OWNER_ID),
      email: Boolean((process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) || (process.env.SMTP_USER && process.env.SMTP_PASS)),
      // can deployed sites use the built-in sender? (Render's free plan blocks Gmail, so this needs Brevo)
      builtInEmail: Boolean(process.env.BREVO_API_KEY && (process.env.EMAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER)),
      cloudinary: Boolean(process.env.CLOUDINARY_URL),
    },
  })
);

app.use("/api/auth", require("./routes/auth"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/static", require("./routes/static"));
app.use("/api/fullstack", require("./routes/fullstack"));
app.use("/api/games", require("./routes/games"));
app.use("/api/account", require("./routes/account"));

app.get("/api/jobs/:id", requireAuth, (req, res) => {
  const job = getJob(req.params.id, req.user._id);
  if (!job) return res.status(404).json({ success: false, message: "This task has expired or the server restarted. Please try again." });
  res.json({ success: true, job: publicJob(job) });
});

app.use((req, res) => res.status(404).json({ success: false, message: `Not found: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => {
  const status = err.status || (err.type === "entity.too.large" ? 413 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({
    success: false,
    message: status === 413 ? "That's too large to upload (images must be under 2 MB)." : status >= 500 ? "Something went wrong on the server." : err.message,
  });
});

async function connectDB() {
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI is not set. Add it to backend/.env — login and projects need a database.");
    return;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    console.error("   Check MONGO_URI, and in MongoDB Atlas allow your IP under Network Access. Retrying in 15s…");
    setTimeout(connectDB, 15000);
  }
}

app.listen(PORT, () => {
  console.log(`✅ Prompt2Site API running on http://localhost:${PORT}`);
  const missing = ["JWT_SECRET", "OPENROUTER_API_KEY"].filter((k) => !process.env[k]);
  if (missing.length) console.error(`❌ Missing in .env: ${missing.join(", ")}`);
  const deployMissing = ["GITHUB_TOKEN", "NETLIFY_TOKEN", "RENDER_API_KEY", "RENDER_OWNER_ID"].filter((k) => !process.env[k]);
  if (deployMissing.length) console.log(`ℹ️  Deploying needs: ${deployMissing.join(", ")} (generating and previewing work without them)`);
  connectDB();
  // Build the live-preview shell in the background (about 20 s, once per template version).
  require("./services/previewShell")
    .ensureShell()
    .then(() => console.log("✅ Live preview ready"))
    .catch((err) => console.log("⚠️  Live preview couldn't be built:", err.message));
}).on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Stop the other server, or run: lsof -ti:${PORT} | xargs kill -9`);
    process.exit(1);
  }
  throw err;
});
