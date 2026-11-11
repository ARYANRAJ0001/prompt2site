import Icon from "./Icon.jsx";
import Guide from "./Guide.jsx";

const BLOCKS = [
  {
    id: "fullstack",
    icon: "Layers",
    title: "Full-stack app",
    text: "Orders, bookings, logins and UPI payments, with an admin panel.",
    tags: ["79 templates", "Admin login", "UPI"],
  },
  {
    id: "static",
    icon: "FileText",
    title: "Static website",
    text: "A simple, fast site to show who you are and how to reach you.",
    tags: ["One page or many", "Instant"],
  },
  {
    id: "game",
    icon: "Gamepad2",
    title: "3D game",
    text: "Describe a game or start from a template. Edit it, play it, publish it.",
    tags: ["27 templates", "Accounts", "Leaderboard"],
  },
  {
    id: "projects",
    icon: "FolderOpen",
    title: "My projects",
    text: "Open, edit and redeploy everything you've built.",
    tags: ["Versions", "Live links"],
  },
];

/** The first page after logging in: what you can build, and how. */
export default function Home({ user, onGo }) {
  return (
    <div className="home">
      <p className="home-hello">Hi {user?.name?.split(" ")[0] || "there"}, what are we building today?</p>

      <div className="hb-row" role="list">
        {BLOCKS.map((b, i) => (
          <div key={b.id} className="hb-slot" style={{ "--i": i }} role="listitem">
            <button type="button" className="hb" onClick={() => onGo(b.id)}>
              <span className="hb-glow" aria-hidden="true" />
              <span className="hb-shine" aria-hidden="true" />
              <span className="hb-icon"><Icon name={b.icon} size={28} strokeWidth={1.5} /></span>
              <strong className="hb-title">{b.title}</strong>
              <span className="hb-text">{b.text}</span>
              <span className="hb-tags">{b.tags.map((t) => <span key={t}>{t}</span>)}</span>
              <span className="hb-go">Open <Icon name="ArrowRight" size={16} /></span>
            </button>
          </div>
        ))}
      </div>

      <Guide onGo={onGo} />
    </div>
  );
}
