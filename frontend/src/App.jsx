import { useEffect, useState } from "react";
import { startMotion } from "./motion.js";
import { http, session } from "./api.js";
import AuthPage from "./components/AuthPage.jsx";
import StaticBuilder from "./components/StaticBuilder.jsx";
import FullStackBuilder from "./components/FullStackBuilder.jsx";
import GameBuilder from "./components/GameBuilder.jsx";
import Projects from "./components/Projects.jsx";
import Home from "./components/Home.jsx";
import Settings from "./components/Settings.jsx";
import Icon from "./components/Icon.jsx";
import { Mark, Aurora } from "./components/common.jsx";

const TABS = [
  { id: "home", label: "Home", icon: "House" },
  { id: "fullstack", label: "Full-stack app", icon: "Layers" },
  { id: "static", label: "Static website", icon: "FileText" },
  { id: "game", label: "3D game", icon: "Gamepad2" },
  { id: "projects", label: "My projects", icon: "FolderOpen" },
];

export default function App() {
  useEffect(() => startMotion(), []);
  const [user, setUser] = useState(session.user());
  const [tab, setTab] = useState("home");
  const [opened, setOpened] = useState(null); // project opened from "My projects"
  const [health, setHealth] = useState(null);
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("p2s-logout", onLogout);
    return () => window.removeEventListener("p2s-logout", onLogout);
  }, []);

  useEffect(() => {
    http.get("/api/health").then((r) => setHealth(r.data)).catch(() => setHealth({ offline: true }));
  }, []);

  if (!user)
    return (
      <>
        <Aurora />
        <AuthPage onLogin={(u) => { setTab("home"); setUser(u); }} health={health} />
      </>
    );

  const open = (project) => {
    setOpened(project);
    setTab(project.type === "static" ? "static" : project.type === "game" ? "game" : "fullstack");
  };

  return (
    <div className="shell">
      <Aurora />
      <header className="topbar">
        <button type="button" className="brand" onClick={() => setTab("home")}><Mark /> Prompt2Site</button>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "tab active" : "tab"} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={17} /> {t.label}
            </button>
          ))}
        </nav>
        <div className="user">
          <span className="muted">{user.name}</span>
          <button className="btn ghost small" onClick={() => setSettings(true)}><Icon name="Settings" size={16} /> Settings</button>
          <button
            className="btn ghost small"
            onClick={() => {
              session.clear();
              setUser(null);
            }}
          >
            Log out
          </button>
        </div>
      </header>

      {health?.offline && <div className="banner error">Can't reach the backend. Start it with <code>npm run dev</code> in the backend folder.</div>}
      {health && !health.offline && health.database !== "connected" && (
        <div className="banner error">The backend can't reach MongoDB. Check MONGO_URI in backend/.env and Network Access in MongoDB Atlas.</div>
      )}

      {settings && <Settings onClose={() => setSettings(false)} />}
      <main className="content">
        {/* Builders stay mounted so switching tabs doesn't lose work. */}
        <div hidden={tab !== "fullstack"}>
          <FullStackBuilder health={health} opened={opened?.type === "fullstack" ? opened : null} />
        </div>
        <div hidden={tab !== "static"}>
          <StaticBuilder health={health} opened={opened?.type === "static" ? opened : null} />
        </div>
        <div hidden={tab !== "game"}>
          <GameBuilder health={health} opened={opened?.type === "game" ? opened : null} />
        </div>
        {tab === "projects" && <Projects onOpen={open} />}
        {tab === "home" && <Home user={user} onGo={setTab} />}
      </main>
    </div>
  );
}
