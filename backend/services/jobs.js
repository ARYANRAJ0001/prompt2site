/**
 * Background jobs. AI planning, builds and deploys take from seconds to
 * several minutes, so each endpoint starts a job and returns its id; the
 * browser polls GET /api/jobs/:id. Jobs are kept in memory for an hour.
 */
const crypto = require("crypto");

const jobs = new Map();
const TTL = 60 * 60 * 1000;

class JobError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

function runningJobFor(userId) {
  for (const job of jobs.values()) if (job.userId === String(userId) && job.status === "running") return job;
  return null;
}

function startJob({ userId, type, run }) {
  const running = runningJobFor(userId);
  if (running) {
    const e = new Error(`Please wait: "${running.type}" is still running (${running.step}).`);
    e.status = 409;
    throw e;
  }

  const job = {
    id: crypto.randomUUID(),
    userId: String(userId),
    type,
    status: "running",
    step: "Starting",
    log: [],
    result: null,
    error: null,
    details: null,
    startedAt: Date.now(),
    finishedAt: null,
  };
  jobs.set(job.id, job);

  const progress = (step) => {
    job.step = step;
    job.log.push(step);
    console.log(`[job ${job.id.slice(0, 8)} ${type}] ${step}`);
  };

  Promise.resolve()
    .then(() => run(progress))
    .then((result) => Object.assign(job, { status: "done", step: "Done", result }))
    .catch((err) => {
      console.error(`[job ${job.id.slice(0, 8)} ${type}] failed:`, err.message);
      Object.assign(job, { status: "failed", error: err.message || "Failed", details: err.details || null });
    })
    .finally(() => (job.finishedAt = Date.now()));

  return job;
}

function getJob(id, userId) {
  const job = jobs.get(id);
  return job && job.userId === String(userId) ? job : null;
}

const publicJob = (job) => ({
  id: job.id,
  type: job.type,
  status: job.status,
  step: job.step,
  log: job.log,
  result: job.result,
  error: job.error,
  details: job.details,
  seconds: Math.round(((job.finishedAt || Date.now()) - job.startedAt) / 1000),
});

setInterval(() => {
  for (const [id, job] of jobs) if (job.finishedAt && Date.now() - job.finishedAt > TTL) jobs.delete(id);
}, 10 * 60 * 1000).unref();

module.exports = { startJob, getJob, publicJob, JobError };
