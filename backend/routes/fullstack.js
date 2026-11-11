const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const Project = require("../models/Project");
const { requireAuth } = require("../middleware/auth");
const { startJob } = require("../services/jobs");
const { planApp, normalizeBlueprint } = require("../services/blueprint");
const { PRESETS } = require("../services/presets");
const { editPlan } = require("../services/editor");
const { generateProject, slug } = require("../services/generator");
const { buildFrontend } = require("../services/build");
const { savePreview } = require("../services/preview");
const { liveConfig, ensureShell } = require("../services/previewShell");
const { zipFiles } = require("../services/zip");
const { setBlueprint } = require("../services/history");
const { consume, refund } = require("../services/usage");
const { createRepo, updateRepo } = require("../services/deploy/github");
const { createService, waitUntilLive, syncSettings } = require("../services/deploy/render");
const { deployZip, ensureSite } = require("../services/deploy/netlify");
const { ownerProblems, newAdminPassword, sendEmail, sendWhatsApp, adminLoginEmail } = require("../services/ownerSetup");

const router = express.Router();
router.use(requireAuth);

const userKey = (req) => (typeof req.headers["x-openrouter-key"] === "string" && req.headers["x-openrouter-key"].trim()) || undefined;

function readBlueprint(raw) {
  try {
    return normalizeBlueprint(raw);
  } catch (e) {
    const err = new Error(`The plan isn't valid: ${e.message}`);
    err.status = 400;
    throw err;
  }
}

async function findProject(id, userId) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return Project.findOne({ _id: id, userId, type: "fullstack" });
}

/** Run a job that uses up one of today's `kind` (refunded if it fails). */
function quotaJob(req, res, kind, type, run) {
  const charge = kind && !(kind === "ai" && userKey(req));
  return (charge ? consume(req.user._id, kind) : Promise.resolve())
    .then(() => {
      const job = startJob({
        userId: req.user._id,
        type,
        run: (progress) =>
          run(progress).catch(async (err) => {
            if (charge) await refund(req.user._id, kind);
            throw err;
          }),
      });
      res.status(202).json({ success: true, jobId: job.id });
    })
    .catch(async (err) => {
      if (charge && err.status === 409) await refund(req.user._id, kind);
      throw err;
    });
}

// ------------------------------------------------------------ templates

const templateId = (title) => slug(title);

// GET /api/fullstack/templates -> the built-in app plans, for the gallery
router.get("/templates", (req, res) => {
  res.json({
    success: true,
    templates: PRESETS.map((p) => {
      const bp = normalizeBlueprint(p.blueprint);
      return {
        id: templateId(p.title),
        title: p.title,
        name: bp.name,
        tagline: bp.tagline,
        icon: bp.models[0].icon,
        primary: bp.theme.primary,
        accent: bp.theme.accent,
        mode: bp.theme.mode,
        pages: bp.models.map((m) => m.label),
        category: p.category || "Other",
        keywords: (p.keywords || []).slice(0, 8),
        payments: bp.models.some((m) => m.payment?.enabled),
      };
    }),
  });
});

// POST /api/fullstack/live-config { blueprint } -> settings for the live preview (instant, no build)
router.post("/live-config", (req, res, next) => {
  try {
    const { blueprint, ...live } = liveConfig(req.body.blueprint || {});
    res.json({ success: true, ...live });
  } catch (err) {
    next(err);
  }
});

// GET /api/fullstack/templates/:id/live -> live-preview settings for a template
router.get("/templates/:id/live", (req, res) => {
  const preset = PRESETS.find((p) => templateId(p.title) === req.params.id);
  if (!preset) return res.status(404).json({ success: false, message: "Template not found" });
  const { blueprint, ...live } = liveConfig(preset.blueprint);
  res.json({ success: true, ...live });
});

// POST /api/fullstack/from-template { id } -> { projectId, blueprint }
router.post("/from-template", async (req, res, next) => {
  try {
    const preset = PRESETS.find((p) => templateId(p.title) === req.body.id);
    if (!preset) return res.status(404).json({ success: false, message: "Template not found" });
    const blueprint = normalizeBlueprint(preset.blueprint, preset.title);
    const project = await Project.create({
      userId: req.user._id,
      type: "fullstack",
      name: blueprint.name,
      prompt: `${preset.title} template`,
      blueprint,
      planSource: "template",
    });
    res.status(201).json({ success: true, projectId: String(project._id), blueprint, source: "template" });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------------------------------- plan

// POST /api/fullstack/plan { prompt } -> job -> { projectId, blueprint, source, warning }
router.post("/plan", async (req, res, next) => {
  try {
    const prompt = String(req.body.prompt || "").trim();
    if (!prompt) return res.status(400).json({ success: false, message: "Please describe the app you want" });
    const apiKey = userKey(req);

    await quotaJob(req, res, "ai", "Plan app", async (progress) => {
      const plan = await planApp(prompt, { apiKey, onProgress: progress });
      progress("Saving project");
      const project = await Project.create({
        userId: req.user._id,
        type: "fullstack",
        name: plan.blueprint.name,
        prompt,
        blueprint: plan.blueprint,
        planSource: plan.source,
      });
      return { projectId: String(project._id), blueprint: plan.blueprint, source: plan.source, warning: plan.warning || null };
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/fullstack/edit { blueprint, instruction, projectId? } -> job -> { blueprint, changes, source }
router.post("/edit", async (req, res, next) => {
  try {
    const instruction = String(req.body.instruction || "").trim().slice(0, 500);
    if (!instruction) return res.status(400).json({ success: false, message: "Describe the change you want" });
    const blueprint = readBlueprint(req.body.blueprint);
    const project = await findProject(req.body.projectId, req.user._id);
    const apiKey = userKey(req);

    await quotaJob(req, res, "ai", "Edit plan", async (progress) => {
      const result = await editPlan(blueprint, instruction, { apiKey, onProgress: progress });
      if (project) {
        project.blueprint = project.blueprint || blueprint;
        setBlueprint(project, result.blueprint, `Before: "${instruction.slice(0, 60)}"`);
        project.planSource = "edited";
        await project.save();
      }
      return result;
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/fullstack/files { blueprint } -> the generated code (instant, no AI)
router.post("/files", (req, res, next) => {
  try {
    const blueprint = readBlueprint(req.body.blueprint);
    res.json({ success: true, blueprint, files: generateProject(blueprint) });
  } catch (err) {
    next(err);
  }
});

// POST /api/fullstack/download { blueprint } -> zip of the project
router.post("/download", async (req, res, next) => {
  try {
    const blueprint = readBlueprint(req.body.blueprint);
    const files = generateProject(blueprint);
    const name = slug(blueprint.name);
    const zip = await zipFiles(Object.fromEntries(Object.entries(files).map(([p, c]) => [`${name}/${p}`, c])));
    res.set({ "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}.zip"` });
    res.send(zip);
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------- preview

// POST /api/fullstack/preview { blueprint, projectId? } -> job -> { previewPath }
router.post("/preview", async (req, res, next) => {
  try {
    const blueprint = readBlueprint(req.body.blueprint);
    const project = await findProject(req.body.projectId, req.user._id);
    if (project) {
      setBlueprint(project, blueprint, "Before preview");
      await project.save();
    }

    await quotaJob(req, res, "preview", "Build preview", async (progress) => {
      const files = generateProject(blueprint);
      const { dir, distDir } = await buildFrontend(files, { demo: true, onProgress: progress });
      try {
        const id = savePreview(distDir, req.user._id);
        return { previewPath: `/preview/${id}/index.html` };
      } finally {
        fs.rm(dir, { recursive: true, force: true }, () => {});
      }
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------- deploy

// POST /api/fullstack/deploy { blueprint, projectId } -> job -> { live, backend, github, backendLive }
router.post("/deploy", async (req, res, next) => {
  try {
    const blueprint = readBlueprint(req.body.blueprint);
    const project = await Project.findOne({ _id: mongoose.isValidObjectId(req.body.projectId) ? req.body.projectId : null, userId: req.user._id, type: "fullstack" }).select("+secrets");
    if (!project) return res.status(404).json({ success: false, message: "Plan the app first (project not found)" });
    const problems = blueprint.auth ? ownerProblems(blueprint) : [];
    if (problems.length) {
      return res.status(400).json({ success: false, code: "OWNER_DETAILS", message: `Add your business details before deploying: ${problems.join("; ")}.` });
    }
    setBlueprint(project, blueprint, "Before deploy");
    await project.save();

    await quotaJob(req, res, "deploy", "Deploy app", async (progress) => {
      const files = generateProject(blueprint);
      const name = slug(blueprint.name);
      const firstDeploy = !project.deploy?.renderServiceId;
      const secrets = project.secrets || {};

      // The owner's admin password: made once, kept in the builder (never in GitHub).
      let newPassword = null;
      if (blueprint.auth && (firstDeploy || !secrets.adminPassword)) {
        newPassword = newAdminPassword();
        secrets.adminPassword = newPassword;
        secrets.adminPasswordSetAt = String(Date.now());
        project.secrets = secrets;
        project.markModified("secrets");
      }

      // 0. Reserve the website address first, so emails can link to it.
      progress("Reserving the website address on Netlify");
      const site0 = await ensureSite({ name, siteId: project.deploy.netlifySiteId, fallbackEnv: "NETLIFY_FULLSTACK_SITE_ID" });
      project.deploy.netlifySiteId = site0.siteId;
      const settings = { secrets, appUrl: site0.url };

      // 1. Backend settings first (so the new code starts with them), then code -> GitHub
      if (!firstDeploy) {
        progress("Updating the backend's settings");
        const synced = await syncSettings(project.deploy.renderServiceId, blueprint, { ...settings, includePassword: Boolean(newPassword) });
        if (synced.note) progress(`Couldn't update settings: ${synced.note}`);
      }
      progress(firstDeploy ? "Creating the GitHub repository" : "Updating the GitHub repository");
      const repo = project.deploy?.repo
        ? await updateRepo(project.deploy.repo, files)
        : await createRepo(name, `${blueprint.name} — generated by Prompt2Site`, files);
      project.deploy.repo = { owner: repo.owner, name: repo.name, branch: repo.branch };
      project.links.github = repo.url;

      // 2. Backend -> Render (a repo update triggers an automatic redeploy)
      let backendUrl = project.links.backend;
      let database = null;
      if (firstDeploy) {
        progress("Creating the backend on Render");
        const svc = await createService({ repoUrl: repo.url, branch: repo.branch, name, blueprint, ...settings });
        project.deploy.renderServiceId = svc.serviceId;
        backendUrl = svc.url;
        database = svc.database;
        project.links.backend = backendUrl;
      } else {
        progress("Render is redeploying the backend from the new code");
      }
      project.markModified("deploy");
      await project.save();

      // 3. Frontend -> build with the backend URL -> Netlify
      const { dir, distDir } = await buildFrontend(files, { apiUrl: backendUrl, onProgress: progress });
      let zip;
      try {
        zip = await zipFiles(null, { folder: distDir });
      } finally {
        fs.rm(dir, { recursive: true, force: true }, () => {});
      }
      const site = await deployZip(zip, {
        name,
        siteId: project.deploy.netlifySiteId,
        fallbackEnv: "NETLIFY_FULLSTACK_SITE_ID",
        onProgress: progress,
      });
      project.links.live = site.url;
      project.deploy.netlifySiteId = site.siteId;
      project.deploy.deployedAt = new Date();
      project.markModified("deploy");
      await project.save();

      // 4. Wait for the backend so the site works when we say "done"
      const health = await waitUntilLive(backendUrl, { onProgress: progress, timeoutMs: (firstDeploy ? 9 : 6) * 60 * 1000 });

      // 5. Send the owner their admin login (only when it's new)
      let loginEmailed = false;
      if (newPassword) {
        const sent = await sendEmail(blueprint.owner.email, `Your admin login for ${blueprint.name}`, adminLoginEmail({ name: blueprint.name, live: site.url, email: blueprint.owner.email, password: newPassword }));
        loginEmailed = sent.ok;
      }

      const o = blueprint.owner || {};
      const ownBrevo = o.emailMode === "brevo" && secrets.brevoKey && o.senderEmail;
      const ownGmail = o.emailMode === "gmail" && secrets.gmailPassword && o.senderEmail;
      const brevo = Boolean(ownBrevo || (!ownGmail && process.env.BREVO_API_KEY));
      const emailOn = !o.emailsOff && Boolean(blueprint.notifyEmail && (brevo || ownGmail || process.env.GMAIL_USER || process.env.SMTP_USER));
      return {
        live: site.url,
        backend: backendUrl,
        github: repo.url,
        backendLive: Boolean(health),
        database: health?.database || database,
        emailAlerts: emailOn ? blueprint.notifyEmail : null,
        whatsappAlerts: Boolean(secrets.whatsappKey && blueprint.owner?.phone) ? blueprint.owner.phone : null,
        admin: blueprint.auth ? { email: blueprint.owner.email, password: secrets.adminPassword || null, isNew: Boolean(newPassword), emailed: loginEmailed } : null,
        note: health ? null : "The website is live. The backend is still starting on Render — data will appear within a few minutes.",
        emailNote: o.emailsOff
          ? null
          : !emailOn
            ? "Your site isn't sending emails yet. In \"Your business details\" → Email sending, choose \"My own Brevo account\" (free), add your key, and redeploy."
            : !brevo
              ? "Heads-up: Render's free plan blocks Gmail, so your live site can't send emails. In \"Your business details\" → Email sending, choose \"My own Brevo account\" (free) and redeploy."
              : null,
      };
    });
  } catch (err) {
    next(err);
  }
});

/** The builder's own sender, for a site that uses it (null = builder's Gmail fallback). */
function platformVia() {
  const key = String(process.env.BREVO_API_KEY || "").trim();
  const from = process.env.EMAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER;
  return key && from ? { brevoKey: key, from } : {};
}

// POST /api/fullstack/test-notify { projectId, email, phone } -> sends a test email + WhatsApp to the owner
router.post("/test-notify", async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: mongoose.isValidObjectId(req.body.projectId) ? req.body.projectId : null, userId: req.user._id }).select("+secrets");
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });
    const email = String(req.body.email || "").trim();
    const phone = String(req.body.phone || "").trim();
    const name = project.blueprint?.name || project.name;
    const text = `Test from ${name}: alerts are working. You'll get a message like this for every new order, booking or enquiry.`;
    // test the way the site will send: the owner's own Brevo/Gmail, or the builder's sender
    const o = { ...(project.blueprint?.owner || {}), ...(req.body.owner || {}) };
    const s = project.secrets || {};
    const senderName = o.senderName || name;
    const via =
      o.emailMode === "brevo" ? { brevoKey: s.brevoKey, from: o.senderEmail, name: senderName }
      : o.emailMode === "gmail" ? { gmail: s.gmailPassword && o.senderEmail ? { user: o.senderEmail, pass: s.gmailPassword } : null, name: senderName }
      : { ...platformVia(), name: senderName, platform: true };
    const [mail, wa] = await Promise.all([
      o.emailsOff ? { ok: false, note: "Emails are turned off for this site." }
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { ok: false, note: "Enter a valid email." }
      : sendEmail(email, `Test alert from ${name}`, text, via),
      sendWhatsApp(phone, project.secrets?.whatsappKey, text),
    ]);
    res.json({ success: true, email: mail, whatsapp: wa });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
