import { useEffect, useState } from "react";
import { http, errorText } from "../api.js";
import { LinkList } from "./common.jsx";

export default function Projects({ onOpen }) {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    http
      .get("/api/projects")
      .then(({ data }) => setProjects(data.projects))
      .catch((err) => setError(errorText(err)));

  useEffect(() => {
    load();
  }, []);

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}" from your projects?`)) return;
    const live = p.links?.live || p.links?.backend || p.links?.github;
    const withDeployment =
      live && window.confirm("Also take it offline? OK = delete the live website, backend and GitHub repo too. Cancel = keep them online.");
    try {
      const { data } = await http.delete(`/api/projects/${p._id}${withDeployment ? "?withDeployment=true" : ""}`);
      const problems = Object.entries(data.results || {}).filter(([, r]) => !r.ok).map(([k, r]) => `${k}: ${r.note}`);
      if (problems.length) setError(`Project deleted, but some parts are still online — ${problems.join("; ")}`);
      setProjects((list) => list.filter((x) => x._id !== p._id));
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (!projects) return error ? <p className="alert error">{error}</p> : <p className="muted">Loading…</p>;
  if (!projects.length) return <div className="empty-preview card"><p>No projects yet. Generate your first app!</p></div>;

  return (
    <>
    {error && <p className="alert error">{error}</p>}
    <div className="project-grid">
      {projects.map((p) => (
        <article key={p._id} className="card project">
          <div className="row between">
            <span className={p.type === "fullstack" ? "badge purple" : "badge"}>{p.type === "fullstack" ? "Full-stack" : p.type === "game" ? "3D game" : "Static"}</span>
            <span className="muted small">{new Date(p.updatedAt).toLocaleString()}</span>
          </div>
          <h3>{p.name}</h3>
          {p.prompt && <p className="muted small clamp">{p.prompt}</p>}
          <LinkList links={p.links || {}} />
          <div className="row">
            <button className="btn primary small" onClick={() => onOpen(p)}>Open</button>
            <button className="btn danger small" onClick={() => remove(p)}>Delete</button>
          </div>
        </article>
      ))}
    </div>
    </>
  );
}
