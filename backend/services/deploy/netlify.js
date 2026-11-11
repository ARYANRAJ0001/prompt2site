const axios = require("axios");

function api() {
  const t = require("./token").token("NETLIFY_TOKEN");
  return axios.create({
    baseURL: "https://api.netlify.com/api/v1",
    timeout: 120000,
    headers: { Authorization: `Bearer ${t}` },
  });
}

const message = (err) => {
  const d = err.response?.data;
  return (typeof d === "string" ? d : d?.message || d?.errors && JSON.stringify(d.errors)) || err.message;
};

async function getOrCreateSite(nf, { siteId, name, fallbackEnv }) {
  if (siteId) {
    try {
      return (await nf.get(`/sites/${siteId}`)).data;
    } catch {
      /* site was deleted: create a new one */
    }
  }
  try {
    return (await nf.post("/sites", { name: `${name}-${Date.now().toString(36)}`.slice(0, 63) })).data;
  } catch (err) {
    const reuse = process.env[fallbackEnv];
    if (reuse) {
      console.log(`Netlify site creation failed (${message(err)}); reusing ${fallbackEnv}`);
      return (await nf.get(`/sites/${reuse}`)).data;
    }
    throw new Error(
      `Netlify couldn't create a site: ${message(err)}. If you've reached the free site limit, delete old sites in Netlify or set ${fallbackEnv}.`
    );
  }
}

/** Create the site (or find the existing one) without uploading — to learn its URL first. */
async function ensureSite({ name, siteId, fallbackEnv = "NETLIFY_SITE_ID" }) {
  const site = await getOrCreateSite(api(), { siteId, name, fallbackEnv });
  return { siteId: site.id, url: site.ssl_url || site.url };
}

/**
 * Upload a zip of a built site. Reuses `siteId` when given (redeploy).
 * @returns { url, siteId, siteName }
 */
async function deployZip(zipBuffer, { name, siteId, fallbackEnv = "NETLIFY_SITE_ID", onProgress } = {}) {
  const nf = api();
  const site = await getOrCreateSite(nf, { siteId, name, fallbackEnv });

  onProgress?.("Uploading to Netlify");
  let deploy;
  try {
    ({ data: deploy } = await nf.post(`/sites/${site.id}/deploys`, zipBuffer, {
      headers: { "Content-Type": "application/zip" },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }));
  } catch (err) {
    throw new Error(`Netlify upload failed: ${message(err)}`);
  }

  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const { data } = await nf.get(`/deploys/${deploy.id}`);
    if (data.state === "ready") break;
    if (data.state === "error") throw new Error(`Netlify deploy failed: ${data.error_message || "unknown error"}`);
    await new Promise((r) => setTimeout(r, 2500));
  }

  return { url: site.ssl_url || site.url, siteId: site.id, siteName: site.name };
}

async function deleteSite(siteId) {
  // Never delete the shared fallback sites.
  if ([process.env.NETLIFY_SITE_ID, process.env.NETLIFY_FULLSTACK_SITE_ID].includes(siteId)) {
    return { ok: true, note: "shared site kept (it's your NETLIFY_*_SITE_ID)" };
  }
  try {
    await api().delete(`/sites/${siteId}`);
    return { ok: true };
  } catch (err) {
    if (err.response?.status === 404) return { ok: true, note: "already gone" };
    return { ok: false, note: message(err) };
  }
}

module.exports = { ensureSite, deployZip, deleteSite };
