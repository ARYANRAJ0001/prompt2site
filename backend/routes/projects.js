const express = require("express");
const mongoose = require("mongoose");
const Project = require("../models/Project");
const { requireAuth } = require("../middleware/auth");
const { normalizeBlueprint } = require("../services/blueprint");
const { setBlueprint } = require("../services/history");
const { deleteRepo } = require("../services/deploy/github");
const { deleteSite } = require("../services/deploy/netlify");
const { deleteService, syncSettings, triggerDeploy } = require("../services/deploy/render");
const { newAdminPassword, sendEmail, adminLoginEmail } = require("../services/ownerSetup");

const router = express.Router();
router.use(requireAuth);

const valid = (id) => mongoose.isValidObjectId(id);

router.get("/", async (req, res, next) => {
  try {
    const projects = await Project.find({ userId: req.user._id })
      .select("type name prompt links planSource updatedAt createdAt deploy.deployedAt")
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    res.json({ success: true, projects });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!valid(req.params.id)) return res.status(404).json({ success: false, message: "Project not found" });
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id }).select("-history +secrets").lean();
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    const { secrets = {}, ...rest } = project;
    // Secrets never go to the browser — only whether they're set.
    res.json({ success: true, project: { ...rest, secretsSet: secretsSet(secrets) } });
  } catch (err) {
    next(err);
  }
});

// Save edits: name, static code, or a full-stack plan.
router.put("/:id", async (req, res, next) => {
  try {
    if (!valid(req.params.id)) return res.status(404).json({ success: false, message: "Project not found" });
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const { name, html, css, js, blueprint } = req.body;
    if (typeof name === "string" && name.trim()) project.name = name.trim().slice(0, 80);
    if (project.type === "static") {
      if (typeof html === "string") project.html = html;
      if (typeof css === "string") project.css = css;
      if (typeof js === "string") project.js = js;
    }
    if (project.type === "fullstack" && blueprint) {
      try {
        setBlueprint(project, normalizeBlueprint(blueprint), "Before saving");
        project.planSource = "edited";
      } catch (e) {
        return res.status(400).json({ success: false, message: `The plan isn't valid: ${e.message}` });
      }
    }
    await project.save();
    const out = project.toObject();
    delete out.history;
    res.json({ success: true, project: out });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------- secrets

const secretsSet = (s = {}) => ({ whatsappKey: Boolean(s.whatsappKey), brevoKey: Boolean(s.brevoKey), gmailPassword: Boolean(s.gmailPassword), adminPassword: Boolean(s.adminPassword) });
const findWithSecrets = (req) => (valid(req.params.id) ? Project.findOne({ _id: req.params.id, userId: req.user._id, type: "fullstack" }).select("+secrets") : null);

// PUT /api/projects/:id/secrets { whatsappKey?, brevoKey?, gmailPassword? } -> stored here, sent only to the app's Render settings
router.put("/:id/secrets", async (req, res, next) => {
  try {
    const project = await findWithSecrets(req);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    const rules = {
      whatsappKey: [/^[A-Za-z0-9_-]{4,64}$/, "That doesn't look like a CallMeBot API key (it's a short number or code)."],
      brevoKey: [/^xkeysib-[A-Za-z0-9-]{20,120}$/, "That doesn't look like a Brevo API key (it starts with xkeysib-)."],
      gmailPassword: [/^[a-z]{16}$/i, "A Gmail App Password is 16 letters (spaces are fine)."],
    };
    const next = { ...(project.secrets?.toObject?.() || project.secrets || {}) };
    let changed = false;
    for (const [name, [re, msg]] of Object.entries(rules)) {
      if (typeof req.body[name] !== "string") continue;
      const value = name === "gmailPassword" ? req.body[name].replace(/\s+/g, "") : req.body[name].trim();
      if (value && !re.test(value)) return res.status(400).json({ success: false, message: msg });
      next[name] = value;
      changed = true;
    }
    if (changed) {
      project.secrets = next;
      project.markModified("secrets");
      await project.save();
    }
    res.json({ success: true, secretsSet: secretsSet(project.secrets), needsRedeploy: Boolean(project.deploy?.renderServiceId) });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id/admin-login -> the deployed app's admin login (for the project's owner only)
router.get("/:id/admin-login", async (req, res, next) => {
  try {
    const project = await findWithSecrets(req);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    if (!project.secrets?.adminPassword) return res.status(404).json({ success: false, message: "Deploy the app first — the admin login is created then." });
    res.json({ success: true, email: project.blueprint?.owner?.email || "", password: project.secrets.adminPassword, live: project.links?.live || "" });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/reset-admin -> new admin password, applied to the live backend
router.post("/:id/reset-admin", async (req, res, next) => {
  try {
    const project = await findWithSecrets(req);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    if (!project.deploy?.renderServiceId) return res.status(400).json({ success: false, message: "The app isn't deployed yet." });
    const password = newAdminPassword();
    const secrets = { ...(project.secrets?.toObject?.() || project.secrets || {}), adminPassword: password, adminPasswordSetAt: String(Date.now()) };
    const synced = await syncSettings(project.deploy.renderServiceId, project.blueprint, { secrets, appUrl: project.links?.live, includePassword: true });
    if (synced.note) return res.status(502).json({ success: false, message: `Couldn't update the backend on Render: ${synced.note}` });
    const deployed = await triggerDeploy(project.deploy.renderServiceId);
    project.secrets = secrets;
    project.markModified("secrets");
    await project.save();
    const email = project.blueprint?.owner?.email || "";
    const mail = email ? await sendEmail(email, `New admin password for ${project.blueprint.name}`, adminLoginEmail({ name: project.blueprint.name, live: project.links.live, email, password })) : { ok: false };
    res.json({
      success: true,
      email,
      password,
      emailed: mail.ok,
      note: deployed.ok ? "The backend is restarting with the new password (about 2–5 minutes on the free plan)." : `Saved, but Render didn't restart: ${deployed.note}. Use "Manual deploy" on Render.`,
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------- history

// GET /api/projects/:id/history -> earlier versions of the plan (newest first)
router.get("/:id/history", async (req, res, next) => {
  try {
    if (!valid(req.params.id)) return res.status(404).json({ success: false, message: "Project not found" });
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id }).select("history").lean();
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    const versions = (project.history || [])
      .map((v, index) => ({
        index,
        at: v.at,
        label: v.label,
        name: v.blueprint?.name,
        pages: (v.blueprint?.models || []).map((m) => m.label),
        fields: (v.blueprint?.models || []).reduce((n, m) => n + m.fields.length, 0),
      }))
      .reverse();
    res.json({ success: true, versions });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/history/:index/restore -> { blueprint }
router.post("/:id/history/:index/restore", async (req, res, next) => {
  try {
    if (!valid(req.params.id)) return res.status(404).json({ success: false, message: "Project not found" });
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id, type: "fullstack" });
    const version = project?.history?.[Number(req.params.index)];
    if (!version) return res.status(404).json({ success: false, message: "Version not found" });
    const blueprint = normalizeBlueprint(version.blueprint);
    setBlueprint(project, blueprint, "Before restoring an older version");
    project.planSource = "edited";
    await project.save();
    res.json({ success: true, blueprint });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------- delete deployments

async function removeDeployment(project) {
  const results = {};
  const d = project.deploy || {};
  if (d.renderServiceId && process.env.RENDER_API_KEY) results.backend = await deleteService(d.renderServiceId);
  if (d.netlifySiteId && process.env.NETLIFY_TOKEN) results.website = await deleteSite(d.netlifySiteId);
  if (d.repo?.name && process.env.GITHUB_TOKEN) results.github = await deleteRepo(d.repo);

  const ok = (k) => !results[k] || results[k].ok;
  if (ok("backend")) d.renderServiceId = "";
  if (ok("website")) {
    d.netlifySiteId = "";
    project.links.live = "";
  }
  if (ok("backend")) project.links.backend = "";
  if (ok("github")) {
    d.repo = null;
    project.links.github = "";
  }
  project.markModified("deploy");
  project.markModified("links");
  await project.save();
  return results;
}

// DELETE /api/projects/:id/deployment -> takes the live site, backend and repo down
router.delete("/:id/deployment", async (req, res, next) => {
  try {
    if (!valid(req.params.id)) return res.status(404).json({ success: false, message: "Project not found" });
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    const results = await removeDeployment(project);
    res.json({ success: Object.values(results).every((r) => r.ok), results, links: project.links });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id?withDeployment=true
router.delete("/:id", async (req, res, next) => {
  try {
    if (!valid(req.params.id)) return res.status(404).json({ success: false, message: "Project not found" });
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    const results = req.query.withDeployment === "true" ? await removeDeployment(project) : {};
    await Project.deleteOne({ _id: project._id });
    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
