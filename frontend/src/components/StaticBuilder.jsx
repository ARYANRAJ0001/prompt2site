import { useEffect, useMemo, useState } from "react";
import { http, useJob, errorText, downloadPost } from "../api.js";
import { JobStatus, ErrorBox, LinkList, MissingKeys } from "./common.jsx";
import Icon from "./Icon.jsx";

const THEMES = ["Modern blue", "Warm & elegant", "Dark & bold", "Minimal white", "Colourful & playful", "Nature green"];

/** Combine the three files into one page for the preview iframe. */
function previewDoc({ html, css, js }) {
  let doc = html || "";
  doc = doc.replace(/<link[^>]+href=["']\.?\/?style\.css["'][^>]*>/i, "").replace(/<script[^>]+src=["']\.?\/?script\.js["'][^>]*><\/script>/i, "");
  const style = `<style>${css || ""}</style>`;
  const script = `<script>${(js || "").replace(/<\/script/gi, "<\\/script")}<\/script>`;
  doc = /<\/head>/i.test(doc) ? doc.replace(/<\/head>/i, `${style}</head>`) : style + doc;
  doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${script}</body>`) : doc + script;
  return doc;
}

export default function StaticBuilder({ health, opened }) {
  const job = useJob();
  const [prompt, setPrompt] = useState("");
  const [theme, setTheme] = useState(THEMES[0]);
  const [image, setImage] = useState("");
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(null);
  const [site, setSite] = useState(null);
  const [tab, setTab] = useState("html");
  const [warning, setWarning] = useState("");
  const [links, setLinks] = useState({});
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    if (!opened) return;
    http
      .get(`/api/projects/${opened._id}`)
      .then(({ data }) => {
        const p = data.project;
        setProjectId(p._id);
        setPrompt(p.prompt);
        setName(p.name);
        setSite({ html: p.html, css: p.css, js: p.js });
        setLinks(p.links || {});
        setWarning("");
        setSaved(true);
      })
      .catch((err) => setError({ message: errorText(err) }));
  }, [opened]);

  const doc = useMemo(() => (site ? previewDoc(site) : ""), [site]);
  const fail = (err) => setError({ message: errorText(err), details: err.details });

  const onImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setError({ message: "Image too large — max 2 MB." });
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    setError(null);
    try {
      const result = await job.run("/api/static/generate", { prompt, theme, imageDataUrl: image || undefined, name: name || undefined });
      setProjectId(result.projectId);
      setSite(result.site);
      setWarning(result.warning || "");
      setLinks({});
      setSaved(true);
      if (!name) setName(prompt.slice(0, 60));
    } catch (err) {
      fail(err);
    }
  };

  const save = async () => {
    try {
      await http.put(`/api/projects/${projectId}`, { name, ...site });
      setSaved(true);
    } catch (err) {
      fail(err);
    }
  };

  const deploy = async () => {
    setError(null);
    try {
      const result = await job.run("/api/static/deploy", { projectId, name, ...site });
      setLinks({ live: result.live, github: result.github });
      setSaved(true);
    } catch (err) {
      fail(err);
    }
  };

  const edit = (key) => (e) => {
    setSite({ ...site, [key]: e.target.value });
    setSaved(false);
  };

  return (
    <div className="builder">
      <div className="split">
        <section className="card controls">
          <h2>Static website</h2>
          <label className="field">
            <span>Describe the website</span>
            <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. A portfolio for a wedding photographer in Jaipur" />
          </label>
          <div className="grid-2">
            <label className="field">
              <span>Style</span>
              <select value={theme} onChange={(e) => setTheme(e.target.value)}>{THEMES.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <label className="field">
              <span>Project name</span>
              <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} placeholder="My website" />
            </label>
          </div>
          <label className="field">
            <span>Reference image (optional, max 2 MB)</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onImage} />
          </label>
          {image && (
            <div className="row">
              <img src={image} alt="" className="thumb" />
              <button className="link" onClick={() => setImage("")}>Remove image</button>
            </div>
          )}
          <button className="btn primary full" onClick={generate} disabled={job.running || !prompt.trim()}>
            {job.running && job.step !== "Starting" && !site ? "Generating…" : <><Icon name="Sparkles" size={18} /> Generate website</>}
          </button>

          {site && (
            <div className="row wrap">
              <button className="btn ghost" onClick={save} disabled={saved || job.running}>{saved ? "Saved" : <><Icon name="Save" size={17} /> Save</>}</button>
              <button className="btn ghost" onClick={() => downloadPost("/api/static/download", { ...site, name }, `${(name || "website").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip`).catch(fail)}>⬇️ Download</button>
              <button className="btn primary" onClick={deploy} disabled={job.running}><Icon name="Globe" size={17} /> {links.live ? "Redeploy" : "Deploy"}</button>
            </div>
          )}

          <JobStatus job={job} hint="Free AI models usually take 30–90 seconds." />
          {warning && <p className="alert warn">{warning}</p>}
          <MissingKeys health={health} need={["netlify"]} />
          <ErrorBox error={error} onClose={() => setError(null)} />
          {links.live && (
            <div className="card success">
              <h3><Icon name="CircleCheck" size={20} /> Live</h3>
              <LinkList links={links} />
            </div>
          )}
        </section>

        <section className="card preview-card">
          {site ? (
            <iframe title="Website preview" className="preview-frame" sandbox="allow-scripts allow-forms allow-modals" srcDoc={doc} />
          ) : (
            <div className="empty-preview">
              <p>Your website preview appears here.</p>
            </div>
          )}
        </section>
      </div>

      {site && (
        <section className="card">
          <div className="view-tabs">
            {["html", "css", "js"].map((k) => (
              <button key={k} className={tab === k ? "tab active" : "tab"} onClick={() => setTab(k)}>
                {{ html: "index.html", css: "style.css", js: "script.js" }[k]}
              </button>
            ))}
          </div>
          <textarea className="mono code-edit" rows={22} value={site[tab]} onChange={edit(tab)} spellCheck={false} />
        </section>
      )}
    </div>
  );
}
