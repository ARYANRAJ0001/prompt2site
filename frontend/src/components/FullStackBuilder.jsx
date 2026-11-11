import { useEffect, useRef, useState } from "react";
import { http, useJob, errorText, downloadPost, API_URL, session } from "../api.js";
import PlanEditor from "./PlanEditor.jsx";
import BusinessDetails, { missingOwnerDetails } from "./BusinessDetails.jsx";
import LivePreview from "./LivePreview.jsx";
import TemplateCarousel from "./TemplateCarousel.jsx";
import { JobStatus, ErrorBox, LinkList, MissingKeys, CodeViewer } from "./common.jsx";
import Icon from "./Icon.jsx";

const EXAMPLES = [
  "Restaurant website with a menu and table booking",
  "Gym with classes, membership plans and a join form",
  "Personal expense tracker with categories",
  "Clinic with doctors list and appointment booking",
  "Online clothing store with products and orders",
  "Blog with articles and a contact form",
];

const CHAT_EXAMPLES = ["add a delivery address field to orders", "make the colour green", "dark mode", "add a contact form", "show bookings as a calendar"];

const SOURCE_LABEL = {
  ai: "Planned by AI",
  preset: "Built-in plan",
  generic: "Starter plan",
  template: "From a template",
  edited: "Edited plan",
};

/** Where you are: a real four-step sequence, so it's numbered. */
const STEP_NAMES = ["Describe", "Your details", "Edit & preview", "Go live"];
function Steps({ current }) {
  return (
    <ol className="steps-bar" aria-label="Progress">
      {STEP_NAMES.map((n, i) => (
        <li key={n} className={i < current ? "done" : i === current ? "now" : ""} aria-current={i === current ? "step" : undefined}>
          <span className="dot">{i < current ? <Icon name="Check" size={13} /> : i + 1}</span>
          <span className="label">{n}</span>
        </li>
      ))}
    </ol>
  );
}

function Templates({ selected, onSelect, onUse, busy }) {
  const [templates, setTemplates] = useState(null);
  useEffect(() => {
    http.get("/api/fullstack/templates").then((r) => setTemplates(r.data.templates)).catch(() => setTemplates([]));
  }, []);
  // Show the first template in the preview straight away.
  useEffect(() => {
    if (templates?.length && !selected) onSelect(templates[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);
  if (!templates?.length) return null;
  return <TemplateCarousel templates={templates} selected={selected} onSelect={onSelect} onUse={onUse} busy={busy} />;
}

function Versions({ projectId, onRestore, onClose }) {
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    http
      .get(`/api/projects/${projectId}/history`)
      .then((r) => setVersions(r.data.versions))
      .catch((err) => setError(errorText(err)));
  }, [projectId]);
  return (
    <div className="card versions">
      <div className="row between">
        <h3>Earlier versions</h3>
        <button className="btn ghost small" onClick={onClose}>Close</button>
      </div>
      {error && <p className="alert error">{error}</p>}
      {!versions ? (
        <p className="muted">Loading…</p>
      ) : versions.length === 0 ? (
        <p className="muted">No earlier versions yet. A version is saved each time you preview, deploy, save or use chat editing.</p>
      ) : (
        <ul className="version-list">
          {versions.map((v) => (
            <li key={v.index}>
              <div>
                <strong>{v.label}</strong>
                <div className="muted small">{new Date(v.at).toLocaleString()} · {v.pages.join(", ")} · {v.fields} fields</div>
              </div>
              <button className="btn ghost small" onClick={() => onRestore(v.index)}>Restore</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminLogin({ admin, onReset, busy }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Email: ${admin.email}\nPassword: ${admin.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="admin-login">
      <strong><Icon name="KeyRound" size={16} /> Your admin login</strong>
      <div className="mono">Email: {admin.email}<br />Password: {admin.password}</div>
      <p className="muted small">
        Log in at {admin.live ? <a href={`${admin.live}/#/login`} target="_blank" rel="noopener noreferrer">{admin.live.replace(/^https?:\/\//, "")}/#/login</a> : "your site"} to see orders and mark payments.
        {admin.isNew && (admin.emailed ? " We've also emailed it to you." : " Save it somewhere safe.")} If you changed it inside the app, use your new one.
      </p>
      <div className="row wrap">
        <button className="btn ghost small" onClick={copy}>{copied ? <><Icon name="Check" size={15} /> Copied</> : <><Icon name="Copy" size={15} /> Copy</>}</button>
        <button className="btn ghost small" onClick={onReset} disabled={busy}>Reset password</button>
      </div>
    </div>
  );
}

export default function FullStackBuilder({ health, opened }) {
  const job = useJob();
  const [prompt, setPrompt] = useState("");
  const [projectId, setProjectId] = useState(null);
  const [blueprint, setBlueprintState] = useState(null);
  const [past, setPast] = useState([]); // undo stack
  const [future, setFuture] = useState([]); // redo stack
  const [source, setSource] = useState("");
  const [warning, setWarning] = useState("");
  const [view, setView] = useState("plan"); // plan | preview | code
  const [files, setFiles] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [links, setLinks] = useState({});
  const [deployNotes, setDeployNotes] = useState([]);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [changes, setChanges] = useState(null);
  const [showVersions, setShowVersions] = useState(false);
  const [secretsSet, setSecretsSet] = useState({});
  const [setupOpen, setSetupOpen] = useState(false); // the required "business details" step
  const [admin, setAdmin] = useState(null); // { email, password } of the deployed app
  const [picked, setPicked] = useState(null); // template shown in the start screen's preview

  /**
   * Replace the plan, remembering the old one for Undo. Quick successive
   * edits (typing in a field) are grouped into one undo step.
   */
  const lastEdit = useRef({ at: 0, grouped: false });
  const commit = (next, { group = false } = {}) => {
    const now = Date.now();
    const sameBurst = group && lastEdit.current.grouped && now - lastEdit.current.at < 1000;
    if (blueprint && !sameBurst) {
      setPast((p) => [...p.slice(-49), blueprint]);
      setFuture([]);
    }
    lastEdit.current = { at: now, grouped: group };
    setBlueprintState(next);
    setDirty(true);
  };

  const load = (bp, { reset = true } = {}) => {
    setBlueprintState(bp);
    if (reset) {
      setPast([]);
      setFuture([]);
    }
  };

  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [blueprint, ...f]);
    setBlueprintState(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setDirty(true);
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, blueprint]);
    setBlueprintState(future[0]);
    setFuture((f) => f.slice(1));
    setDirty(true);
  };

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (not while typing in a field)
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Open a saved project from "My projects".
  useEffect(() => {
    if (!opened) return;
    http
      .get(`/api/projects/${opened._id}`)
      .then(({ data }) => {
        const p = data.project;
        setProjectId(p._id);
        setPrompt(p.prompt);
        load(p.blueprint);
        setSecretsSet(p.secretsSet || {});
        setAdmin(null);
        setSetupOpen(missingOwnerDetails(p.blueprint).length > 0);
        setSource(p.planSource);
        setWarning("");
        setLinks(p.links || {});
        setFiles(null);
        setPreviewUrl("");
        setChanges(null);
        setDirty(false);
        setView("plan");
      })
      .catch((err) => setError({ message: errorText(err) }));
  }, [opened]);

  const fail = (err) => setError({ message: errorText(err), details: err.details });

  const started = (result) => {
    setProjectId(result.projectId);
    // Start the owner's details from the builder account's email.
    const bp = result.blueprint;
    const me = session.user()?.email;
    if (bp.auth && me && !bp.owner?.email) {
      bp.owner = { ...(bp.owner || {}), email: me };
      if (!bp.notifyEmail) bp.notifyEmail = me;
    }
    load(bp);
    setSecretsSet({});
    setAdmin(null);
    setSetupOpen(missingOwnerDetails(bp).length > 0);
    setSource(result.source);
    setWarning(result.warning || "");
    setLinks({});
    setFiles(null);
    setPreviewUrl("");
    setDeployNotes([]);
    setChanges(null);
    setDirty(false);
    setView("plan");
  };

  const plan = async () => {
    if (!prompt.trim()) return;
    setError(null);
    try {
      started(await job.run("/api/fullstack/plan", { prompt }));
    } catch (err) {
      fail(err);
    }
  };

  const fromTemplate = async (t) => {
    setError(null);
    try {
      const { data } = await http.post("/api/fullstack/from-template", { id: t.id });
      setPrompt(`${t.title} template`);
      started(data);
    } catch (err) {
      fail(err);
    }
  };

  /** Send the plan to the server to clean it up; returns the normalised plan. */
  const syncPlan = async () => {
    const { data } = await http.post("/api/fullstack/files", { blueprint });
    setBlueprintState(data.blueprint);
    setFiles(data.files);
    return data.blueprint;
  };

  const chatEdit = async (text = instruction) => {
    if (!text.trim()) return;
    setError(null);
    setChanges(null);
    try {
      const result = await job.run("/api/fullstack/edit", { blueprint, instruction: text, projectId });
      commit(result.blueprint);
      setSource("edited");
      setChanges(result.changes);
      setInstruction("");
      setFiles(null);
    } catch (err) {
      fail(err);
    }
  };

  const showCode = async () => {
    setError(null);
    setView("code");
    try {
      await syncPlan();
    } catch (err) {
      fail(err);
    }
  };

  const preview = async () => {
    setError(null);
    try {
      const bp = await syncPlan();
      const result = await job.run("/api/fullstack/preview", { blueprint: bp, projectId });
      setPreviewUrl(`${API_URL}${result.previewPath}?t=${Date.now()}`);
      setDirty(false);
      setView("preview");
    } catch (err) {
      fail(err);
    }
  };

  const deploy = async () => {
    setError(null);
    setDeployNotes([]);
    const missing = missingOwnerDetails(blueprint);
    if (missing.length) {
      setView("plan");
      setSetupOpen(true);
      setError({ message: `Add your ${missing.join(", ")} in "Your business details" before deploying.` });
      return;
    }
    try {
      const bp = await syncPlan();
      const result = await job.run("/api/fullstack/deploy", { blueprint: bp, projectId });
      setLinks({ live: result.live, backend: result.backend, github: result.github });
      if (result.admin?.password) setAdmin({ ...result.admin, live: result.live });
      setDeployNotes(
        [
          result.note,
          result.emailAlerts && `New orders, bookings and enquiries will be emailed to ${result.emailAlerts}.`,
          result.whatsappAlerts && `They are also sent on WhatsApp to ${result.whatsappAlerts}.`,
          result.emailNote,
          result.database === "memory" &&
            "No MongoDB is configured for generated apps, so this app's data resets when its server restarts. Set GENERATED_APPS_MONGO_URI or MONGO_URI to keep data.",
        ].filter(Boolean)
      );
      setDirty(false);
    } catch (err) {
      fail(err);
    }
  };

  const takeOffline = async () => {
    if (!window.confirm("Take this app offline? This deletes the live website, the Render backend and the GitHub repository. Your plan stays here.")) return;
    setError(null);
    try {
      const { data } = await http.delete(`/api/projects/${projectId}/deployment`);
      setLinks(data.links || {});
      const notes = Object.entries(data.results || {})
        .filter(([, r]) => !r.ok || r.note)
        .map(([k, r]) => `${k}: ${r.note || "failed"}`);
      setDeployNotes(notes.length ? notes : ["The app is offline. You can deploy it again any time."]);
    } catch (err) {
      fail(err);
    }
  };

  const showAdmin = async () => {
    setError(null);
    try {
      const { data } = await http.get(`/api/projects/${projectId}/admin-login`);
      setAdmin({ email: data.email, password: data.password, live: data.live });
    } catch (err) {
      fail(err);
    }
  };

  const resetAdmin = async () => {
    if (!window.confirm("Make a new admin password for the live app? The old one stops working after the backend restarts.")) return;
    setError(null);
    try {
      const { data } = await http.post(`/api/projects/${projectId}/reset-admin`);
      setAdmin({ email: data.email, password: data.password, live: links.live, isNew: true, emailed: data.emailed });
      setDeployNotes([data.note]);
    } catch (err) {
      fail(err);
    }
  };

  const restore = async (index) => {
    setError(null);
    try {
      const { data } = await http.post(`/api/projects/${projectId}/history/${index}/restore`);
      commit(data.blueprint);
      setShowVersions(false);
      setChanges(["Restored an earlier version"]);
    } catch (err) {
      fail(err);
    }
  };

  const download = async () => {
    setError(null);
    try {
      await downloadPost("/api/fullstack/download", { blueprint }, `${(blueprint.name || "app").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip`);
    } catch (err) {
      fail(err);
    }
  };

  const reset = () => {
    load(null);
    setProjectId(null);
    setFiles(null);
    setPreviewUrl("");
    setLinks({});
    setWarning("");
    setChanges(null);
    setError(null);
  };

  // ---------------------------------------------------------- step 1: describe
  if (!blueprint) {
    return (
      <div className="builder start">
        <div className="start-main">
        <Steps current={0} />
        <Templates selected={picked} onSelect={setPicked} onUse={fromTemplate} busy={job.running} />
        <div className="card hero-card prompt-card">
          <div className="prompt-box">
          <textarea
            rows={4}
            placeholder="Or describe your business… e.g. a home bakery in Pune that takes cake orders with photos and prices"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && plan()}
            aria-label="Describe your business"
          />
          </div>
          <div className="chips">
            {EXAMPLES.map((ex) => (
              <button key={ex} className="chip" onClick={() => setPrompt(ex)}>{ex}</button>
            ))}
          </div>
          <button className="btn primary big" onClick={plan} disabled={job.running || !prompt.trim()}>
            {job.running ? "Planning…" : <><Icon name="Sparkles" size={18} /> Plan my app</>}
          </button>
          <JobStatus job={job} hint="This takes 20–90 seconds." />
          <ErrorBox error={error} onClose={() => setError(null)} />
        </div>
        </div>
        <aside className="start-side">
          <LivePreview
            templateId={picked?.id}
            label={picked ? `${picked.title} template` : "Template preview"}
            toolbar={picked && (
              <button className="btn primary small" onClick={() => fromTemplate(picked)} disabled={job.running}>
                Use this template
              </button>
            )}
          />
        </aside>
      </div>
    );
  }

  // --------------------------------------------- step 2: edit, preview, deploy
  return (
    <div className="builder">
      <Steps current={setupOpen ? 1 : links.live ? 3 : 2} />
      <div className="builder-head">
        <div>
          <h1>{blueprint.name}</h1>
          <p className="muted">
            {SOURCE_LABEL[source] || ""} · {blueprint.models.map((m) => m.label).join(" · ")}
          </p>
        </div>
        <div className="row wrap">
          <button className="btn ghost" onClick={undo} disabled={!past.length || job.running} title="Undo (Ctrl+Z)" aria-label="Undo"><Icon name="Undo2" size={17} /></button>
          <button className="btn ghost" onClick={redo} disabled={!future.length || job.running} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Icon name="Redo2" size={17} /></button>
          {projectId && <button className="btn ghost" onClick={() => setShowVersions(!showVersions)}><Icon name="History" size={17} /> Versions</button>}
          <button className="btn ghost" onClick={reset} disabled={job.running}>New app</button>
          <button className="btn ghost" onClick={download} disabled={job.running}><Icon name="Download" size={17} /> Download</button>
          <button className="btn ghost" onClick={preview} disabled={job.running} title="Build the real site with sample data and open it in a new tab"><Icon name="ExternalLink" size={17} /> Full preview</button>
          <button className="btn primary" onClick={deploy} disabled={job.running}><Icon name="Globe" size={17} /> {links.live ? "Redeploy" : "Deploy"}</button>
        </div>
      </div>

      {warning && <p className="alert warn">{warning}</p>}
      <MissingKeys health={health} need={["github", "netlify", "render"]} />
      <JobStatus job={job} hint={job.step.includes("Render") ? "First deploy on Render's free plan takes 3–8 minutes. You can keep editing meanwhile." : ""} />
      <ErrorBox error={error} onClose={() => setError(null)} />
      {showVersions && projectId && <Versions projectId={projectId} onRestore={restore} onClose={() => setShowVersions(false)} />}

      {(links.live || links.backend || deployNotes.length > 0) && (
        <div className={links.live ? "card success" : "card"}>
          {links.live && (
            <div className="row between wrap">
              <h3><Icon name="CircleCheck" size={20} /> Your app is live</h3>
              <button className="btn danger small" onClick={takeOffline} disabled={job.running}>Take offline</button>
            </div>
          )}
          <LinkList links={links} />
          {admin ? (
            <AdminLogin admin={admin} onReset={resetAdmin} busy={job.running} />
          ) : (
            links.live && blueprint.auth && <button className="link small" onClick={showAdmin}><Icon name="KeyRound" size={15} /> Show my admin login</button>
          )}
          {deployNotes.map((n) => <p key={n} className="muted small">{n}</p>)}
          {dirty && links.live && <p className="muted small">You've changed the plan since deploying. Click Redeploy to update the live app.</p>}
        </div>
      )}

      <div className="view-tabs">
        <button className={view === "plan" ? "tab active" : "tab"} onClick={() => setView("plan")}><Icon name="PenLine" size={16} /> Edit</button>
        <button className={view === "preview" ? "tab active" : "tab"} onClick={() => (previewUrl ? setView("preview") : preview())}><Icon name="Monitor" size={16} /> Full preview</button>
        <button className={view === "code" ? "tab active" : "tab"} onClick={showCode}><Icon name="Code2" size={16} /> Code</button>
      </div>

      <div className={view === "plan" ? "workspace" : ""}>
      <div className="workspace-main">
      {view === "plan" && setupOpen && (
        <BusinessDetails
          setup
          blueprint={blueprint}
          projectId={projectId}
          secretsSet={secretsSet}
          onSecretsSet={setSecretsSet}
          emailReady={Boolean(health?.keys?.email)}
          builtInEmail={Boolean(health?.keys?.builtInEmail)}
          onChange={(bp) => commit(bp, { group: true })}
          onDone={() => setSetupOpen(false)}
        />
      )}

      {view === "plan" && !setupOpen && (
        <>
          <form
            className="card chat"
            onSubmit={(e) => {
              e.preventDefault();
              chatEdit();
            }}
          >
            <label className="field">
              <span>Tell me what to change</span>
              <div className="row">
                <input className="grow" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder='e.g. "add a delivery address field to orders"' />
                <button className="btn primary" disabled={job.running || !instruction.trim()}>Apply</button>
              </div>
            </label>
            <div className="chips tight">
              {CHAT_EXAMPLES.map((ex) => (
                <button type="button" key={ex} className="chip" onClick={() => chatEdit(ex)} disabled={job.running}>{ex}</button>
              ))}
            </div>
            {changes && (
              <div className="alert ok">
                <div>
                  <strong>Done:</strong>
                  <ul className="changes">{changes.map((c) => <li key={c}>{c}</li>)}</ul>
                </div>
                <button type="button" className="link" onClick={undo}>Undo</button>
              </div>
            )}
          </form>
          {blueprint.auth && (
            <BusinessDetails
              key={projectId}
              blueprint={blueprint}
              projectId={projectId}
              secretsSet={secretsSet}
              onSecretsSet={setSecretsSet}
              emailReady={Boolean(health?.keys?.email)}
              builtInEmail={Boolean(health?.keys?.builtInEmail)}
              onChange={(bp) => commit(bp, { group: true })}
            />
          )}
          <PlanEditor
            blueprint={blueprint}
            emailReady={Boolean(health?.keys?.email)}
            onChange={(bp) => {
              commit(bp, { group: true });
              setSource((s) => (s === "edited" ? s : "edited"));
            }}
          />
        </>
      )}

      {view === "preview" && (
        <div className="preview-wrap">
          {previewUrl ? (
            <>
              <div className="preview-bar">
                <span className="muted small">This is a test copy with sample data. Log in with your own email to see the owner dashboard, or with any other email to try it as a customer.</span>
                <div className="row">
                  {dirty && <button className="btn secondary small" onClick={preview} disabled={job.running}>Refresh preview</button>}
                  <a className="btn ghost small" href={previewUrl} target="_blank" rel="noopener noreferrer">Open in new tab <Icon name="ExternalLink" size={15} /></a>
                </div>
              </div>
              <iframe title="App preview" src={previewUrl} className="preview-frame" sandbox="allow-scripts allow-forms allow-modals allow-popups" />
            </>
          ) : (
            <p className="muted">Click Preview to build it.</p>
          )}
        </div>
      )}

      {view === "code" && (files ? <CodeViewer files={files} /> : <p className="muted">Loading code…</p>)}
      </div>
      {view === "plan" && (
        <aside className="workspace-side">
          <LivePreview blueprint={blueprint} />
        </aside>
      )}
      </div>
    </div>
  );
}
