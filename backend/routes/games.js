const express = require("express");
const mongoose = require("mongoose");
const Project = require("../models/Project");
const { requireAuth } = require("../middleware/auth");
const { startJob } = require("../services/jobs");
const { TEMPLATES, ENGINES, WORLDS, PLAYERS, COLLECTIBLES, PALETTES, byId } = require("../services/games/library");
const { normalizeGame, slug } = require("../services/games/normalize");
const { planGame, editGame } = require("../services/games/plan");
const { generateGame, siteFiles } = require("../services/games/generator");
const { zipFiles } = require("../services/zip");
const { consume, refund } = require("../services/usage");
const { createRepo, updateRepo } = require("../services/deploy/github");
const { createService, waitUntilLive } = require("../services/deploy/render");
const { deployZip, ensureSite } = require("../services/deploy/netlify");

const router = express.Router();
router.use(requireAuth);

const userKey = (req) => (typeof req.headers["x-openrouter-key"] === "string" && req.headers["x-openrouter-key"].trim()) || undefined;

async function findProject(id, userId, select = "") {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return Project.findOne({ _id: id, userId, type: "game" }).select(select);
}

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

const saveGame = (project, game, planSource) => {
  project.blueprint = game;
  project.name = game.title;
  if (planSource) project.planSource = planSource;
  project.markModified("blueprint");
};

// GET /api/games/templates -> the library (light) + the choices the editor offers
router.get("/templates", (req, res) => {
  res.json({
    success: true,
    templates: TEMPLATES.map((t) => ({ id: t.id, title: t.title, tagline: t.tagline, engine: t.engine, kicker: t.kicker, world: t.world, colors: t.colors, tags: t.tags, config: normalizeGame({ ...t, template: t.id }, { base: t }) })),
    options: { engines: Object.entries(ENGINES).map(([id, e]) => ({ id, label: e.label, usesLives: e.usesLives })), worlds: WORLDS, players: PLAYERS, collectibles: COLLECTIBLES, palettes: PALETTES },
  });
});

// POST /api/games/from-template { templateId, projectId? } -> { projectId, game }
router.post("/from-template", async (req, res, next) => {
  try {
    const tpl = byId(String(req.body.templateId || ""));
    if (!tpl) return res.status(404).json({ success: false, message: "That template doesn't exist" });
    const game = normalizeGame({ ...tpl, template: tpl.id }, { base: tpl });
    game.template = tpl.id;
    const project = (await findProject(req.body.projectId, req.user._id)) || new Project({ userId: req.user._id, type: "game", name: game.title });
    project.prompt = "";
    saveGame(project, game, "template");
    await project.save();
    res.json({ success: true, projectId: String(project._id), game });
  } catch (err) {
    next(err);
  }
});

// POST /api/games/plan { prompt } -> job -> { projectId, game, source, note }
router.post("/plan", async (req, res, next) => {
  try {
    const prompt = String(req.body.prompt || "").trim();
    if (prompt.length < 3) return res.status(400).json({ success: false, message: "Describe the game you want" });
    const apiKey = userKey(req);
    await quotaJob(req, res, "ai", "Design game", async (progress) => {
      const { game, source, note } = await planGame(prompt, { apiKey, onProgress: progress });
      progress("Saving the game");
      const project = (await findProject(req.body.projectId, req.user._id)) || new Project({ userId: req.user._id, type: "game", name: game.title });
      project.prompt = prompt.slice(0, 4000);
      saveGame(project, game, source === "ai" ? "ai" : "generic");
      await project.save();
      return { projectId: String(project._id), game, source, note: note || null };
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/games/edit { game, instruction } -> job -> { game }
router.post("/edit", async (req, res, next) => {
  try {
    const instruction = String(req.body.instruction || "").trim();
    if (!instruction) return res.status(400).json({ success: false, message: "Tell me what to change" });
    const game = normalizeGame(req.body.game);
    const apiKey = userKey(req);
    await quotaJob(req, res, "ai", "Edit game", async (progress) => ({ game: await editGame(game, instruction, { apiKey, onProgress: progress }) }));
  } catch (err) {
    next(err);
  }
});

// PUT /api/games/:id { game } -> saved (validated) game
router.put("/:id", async (req, res, next) => {
  try {
    const project = await findProject(req.params.id, req.user._id);
    if (!project) return res.status(404).json({ success: false, message: "Game not found" });
    const game = normalizeGame(req.body.game, { base: byId(req.body.game?.template) || undefined });
    if (req.body.game?.template) game.template = String(req.body.game.template).slice(0, 40);
    saveGame(project, game, "edited");
    await project.save();
    res.json({ success: true, game });
  } catch (err) {
    next(err);
  }
});

// POST /api/games/deploy { projectId, game } -> job -> { live, backend, github, backendLive }
router.post("/deploy", async (req, res, next) => {
  try {
    const project = await findProject(req.body.projectId, req.user._id);
    if (!project) return res.status(404).json({ success: false, message: "Save the game first (project not found)" });
    const game = normalizeGame(req.body.game);
    saveGame(project, game, "edited");
    await project.save();

    await quotaJob(req, res, "deploy", "Deploy game", async (progress) => {
      const files = generateGame(game);
      const name = slug(game.title);
      const firstDeploy = !project.deploy?.renderServiceId;

      progress("Reserving the website address on Netlify");
      const site0 = await ensureSite({ name, siteId: project.deploy.netlifySiteId, fallbackEnv: "NETLIFY_FULLSTACK_SITE_ID" });
      project.deploy.netlifySiteId = site0.siteId;

      progress(firstDeploy ? "Creating the GitHub repository" : "Updating the GitHub repository");
      const repo = project.deploy?.repo ? await updateRepo(project.deploy.repo, files) : await createRepo(name, `${game.title} — a 3D game made with Prompt2Site`, files);
      project.deploy.repo = { owner: repo.owner, name: repo.name, branch: repo.branch };
      project.links.github = repo.url;

      let backendUrl = project.links.backend;
      let database = null;
      if (firstDeploy) {
        progress("Creating the accounts & leaderboard backend on Render");
        const svc = await createService({ repoUrl: repo.url, branch: repo.branch, name, plain: true });
        project.deploy.renderServiceId = svc.serviceId;
        backendUrl = svc.url;
        database = svc.database;
        project.links.backend = backendUrl;
      } else progress("Render is redeploying the backend from the new code");
      project.markModified("deploy");
      await project.save();

      progress("Publishing the game on Netlify");
      const zip = await zipFiles(siteFiles(game, backendUrl));
      const site = await deployZip(zip, { name, siteId: project.deploy.netlifySiteId, fallbackEnv: "NETLIFY_FULLSTACK_SITE_ID", onProgress: progress });
      project.links.live = site.url;
      project.deploy.netlifySiteId = site.siteId;
      project.deploy.deployedAt = new Date();
      project.markModified("deploy");
      await project.save();

      const health = await waitUntilLive(backendUrl, { onProgress: progress, timeoutMs: (firstDeploy ? 9 : 6) * 60 * 1000 });
      return {
        live: site.url,
        backend: backendUrl,
        github: repo.url,
        backendLive: Boolean(health),
        database: health?.database || database,
        note: health ? null : "The game is live. The leaderboard backend is still starting on Render — logins and scores will work within a few minutes.",
        dbNote: (health?.database || database) === "memory" ? "Scores are kept in memory until you add a database (the backend resets when Render restarts it)." : null,
      };
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
