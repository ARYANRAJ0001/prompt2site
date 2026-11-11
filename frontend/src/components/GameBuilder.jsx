import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { http, API_URL, useJob, errorText } from "../api.js";
import { JobStatus, ErrorBox, LinkList, MissingKeys } from "./common.jsx";
import TemplateCarousel from "./TemplateCarousel.jsx";
import Icon from "./Icon.jsx";

const EXAMPLES = [
  "A neon car racing game at night",
  "Space shooter where I blast alien ships",
  "Quiz about Indian history",
  "Kids animal memory card game",
  "Endless runner through a snowy forest",
];
const RELATED = {
  car: ["racer", "racing", "drive"], race: ["racer", "car"], fly: ["flyer", "plane", "space"], plane: ["flyer", "sky"],
  shoot: ["shooter", "space", "invaders"], gun: ["shooter"], football: ["penalty", "soccer"], soccer: ["penalty"],
  puzzle: ["maze", "memory", "quiz"], kids: ["memory", "candy", "quiz"], learn: ["quiz", "science", "math"], school: ["quiz", "math", "science"],
  run: ["runner", "dash", "sprint"], jump: ["runner", "helix"], build: ["stack", "tower"], card: ["memory", "match"],
};
const COLOR_KEYS = [["sky", "Sky"], ["ground", "Ground"], ["player", "Player"], ["obstacle", "Obstacles"], ["collect", "Collectibles"], ["accent", "Accent"], ["scenery", "Scenery"]];
const SOURCE = { ai: "Designed by AI", generic: "Closest match to your idea", template: "From a template", edited: "Edited" };
const MEMORY_DEFAULT = ["🍎", "🍌", "🍇", "🍒", "🍉", "🍍", "🥝", "🍓"];

/** The real game, running live in a frame; settings arrive by postMessage. */
function GamePreview({ game }) {
  const frame = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onMessage = (e) => {
      if (frame.current && e.source === frame.current.contentWindow && e.data?.type === "p2g:ready") setReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const json = JSON.stringify(game);
  useEffect(() => {
    if (!ready || !frame.current) return;
    const t = setTimeout(() => frame.current?.contentWindow.postMessage({ type: "p2g:config", config: game, keepPlaying: false }, "*"), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, json]);

  const play = () => {
    frame.current?.focus();
    frame.current?.contentWindow.postMessage({ type: "p2g:play" }, "*");
  };

  return (
    <section className="live game-live" aria-label="Game preview">
      <div className="live-bar">
        <span className="live-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="live-page"><strong className="small">{game.title}</strong></span>
        <span className={ready ? "live-state" : "live-state busy"}>{ready ? "Live" : "Starting…"}</span>
        <button type="button" className="btn primary small" onClick={play} disabled={!ready}><Icon name="Play" size={15} /> Play</button>
      </div>
      <div className="live-screen game-screen">
        <iframe ref={frame} title="Game preview" src={`${API_URL}/game-preview/index.html?preview=1`} sandbox="allow-scripts allow-pointer-lock" allow="autoplay; fullscreen" />
        {!ready && <div className="live-cover"><span className="spinner" /> Starting the 3D preview…</div>}
      </div>
      <p className="muted small game-note">Preview uses sample players. Real accounts and the leaderboard work after you deploy.</p>
    </section>
  );
}

function Pills({ value, options, onChange, label }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="chips tight">
        {options.map((o) => {
          const id = o.id ?? o;
          return <button key={id} type="button" className={value === id ? "chip active" : "chip"} aria-pressed={value === id} onClick={() => onChange(id)}>{o.label ?? id}</button>;
        })}
      </div>
    </div>
  );
}

function QuizEditor({ quiz, onChange }) {
  const q = quiz || { mode: "math", questions: [], perGame: 10, seconds: 15 };
  const set = (patch) => onChange({ ...q, ...patch });
  const setQ = (i, patch) => set({ questions: q.questions.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  return (
    <div className="card gb-section">
      <h3>Quiz</h3>
      <Pills label="Questions" value={q.mode} onChange={(mode) => set({ mode })} options={[{ id: "math", label: "Maths (automatic)" }, { id: "custom", label: "My own questions" }]} />
      <div className="gb-grid">
        <label className="field"><span>Questions per game</span><input type="number" min="3" max="30" value={q.perGame} onChange={(e) => set({ perGame: Number(e.target.value) })} /></label>
        <label className="field"><span>Seconds per question</span><input type="number" min="5" max="60" value={q.seconds} onChange={(e) => set({ seconds: Number(e.target.value) })} /></label>
      </div>
      {q.mode === "custom" && (
        <>
          {q.questions.map((it, i) => (
            <div key={i} className="gb-q">
              <div className="row">
                <input className="grow" value={it.q} placeholder={`Question ${i + 1}`} onChange={(e) => setQ(i, { q: e.target.value })} aria-label={`Question ${i + 1}`} />
                <button type="button" className="btn ghost small" onClick={() => set({ questions: q.questions.filter((_, k) => k !== i) })} aria-label="Remove question"><Icon name="Trash2" size={15} /></button>
              </div>
              {[0, 1, 2, 3].map((k) => (
                <label key={k} className="gb-opt">
                  <input type="radio" name={`ans-${i}`} checked={it.answer === k} onChange={() => setQ(i, { answer: k })} aria-label={`Option ${k + 1} is correct`} />
                  <input value={it.options[k] ?? ""} placeholder={`Option ${k + 1}${k < 2 ? "" : " (optional)"}`} onChange={(e) => { const options = [...it.options]; options[k] = e.target.value; setQ(i, { options }); }} />
                </label>
              ))}
            </div>
          ))}
          <button type="button" className="btn ghost small" onClick={() => set({ questions: [...q.questions, { q: "", options: ["", "", "", ""], answer: 0 }] })}><Icon name="Plus" size={15} /> Add a question</button>
          {q.questions.length < 5 && <p className="muted small">Add at least 5 questions — or ask the AI above: “add 10 questions about …”.</p>}
        </>
      )}
    </div>
  );
}

function Editor({ game, onChange, options }) {
  const set = (patch) => onChange({ ...game, ...patch });
  const engines = options?.engines || [];
  const engine = engines.find((e) => e.id === game.engine);
  const switchEngine = (id) => {
    const next = { ...game, engine: id };
    if (id === "quiz" && !next.quiz) next.quiz = { mode: "math", perGame: 10, seconds: 15, questions: [] };
    if (id === "memory" && !next.memory) next.memory = { items: MEMORY_DEFAULT };
    if (id === "maze" && !next.timeLimit) next.timeLimit = 75;
    next.usesLives = engines.find((e) => e.id === id)?.usesLives ?? true;
    onChange(next);
  };
  const recolor = (world) => onChange({ ...game, world, colors: { ...(options?.palettes?.[world] || game.colors) } });

  return (
    <>
      <div className="card gb-section">
        <h3>Words</h3>
        <div className="gb-grid">
          <label className="field"><span>Game name</span><input value={game.title} maxLength={40} onChange={(e) => set({ title: e.target.value })} /></label>
          <label className="field"><span>Short label</span><input value={game.kicker} maxLength={30} onChange={(e) => set({ kicker: e.target.value })} /></label>
        </div>
        <label className="field"><span>Tagline</span><input value={game.tagline} maxLength={90} onChange={(e) => set({ tagline: e.target.value })} /></label>
        <label className="field"><span>Description</span><textarea rows={2} value={game.description} maxLength={240} onChange={(e) => set({ description: e.target.value })} /></label>
        <label className="field"><span>Controls shown to players</span><input value={game.controls} maxLength={120} onChange={(e) => set({ controls: e.target.value })} /></label>
      </div>

      <div className="card gb-section">
        <h3>Game & world</h3>
        <Pills label="Type of game" value={game.engine} options={engines} onChange={switchEngine} />
        <Pills label="World" value={game.world} options={options?.worlds || []} onChange={recolor} />
        <div className="gb-grid">
          <Pills label="Player" value={game.player} options={options?.players || []} onChange={(player) => set({ player })} />
          <Pills label="Collectible" value={game.collectible} options={options?.collectibles || []} onChange={(collectible) => set({ collectible })} />
        </div>
        <Pills label="Difficulty" value={game.difficulty} options={["easy", "normal", "hard"]} onChange={(difficulty) => set({ difficulty })} />
        <div className="gb-grid">
          <label className="field"><span>Speed ×{game.speed}</span><input type="range" min="0.6" max="1.8" step="0.05" value={game.speed} onChange={(e) => set({ speed: Number(e.target.value) })} /></label>
          {engine?.usesLives !== false && <label className="field"><span>Lives: {game.lives}</span><input type="range" min="1" max="9" value={game.lives} onChange={(e) => set({ lives: Number(e.target.value) })} /></label>}
          {game.engine === "maze" && <label className="field"><span>Time limit: {game.timeLimit || 75}s</span><input type="range" min="20" max="300" step="5" value={game.timeLimit || 75} onChange={(e) => set({ timeLimit: Number(e.target.value) })} /></label>}
        </div>
        <label className="field"><span>What the player collects (name)</span><input value={game.collectName} maxLength={16} onChange={(e) => set({ collectName: e.target.value })} /></label>
        <label className="check row"><input type="checkbox" checked={game.sound !== false} onChange={(e) => set({ sound: e.target.checked })} /> Sound effects</label>
      </div>

      <div className="card gb-section">
        <div className="row between wrap"><h3>Colours</h3><button type="button" className="btn ghost small" onClick={() => recolor(game.world)}>Reset to {game.world} colours</button></div>
        <div className="gb-swatches">
          {COLOR_KEYS.map(([k, label]) => (
            <label key={k} className="field color gb-swatch">
              <span>{label}</span>
              <input type="color" value={game.colors[k]} onChange={(e) => set({ colors: { ...game.colors, [k]: e.target.value, ...(k === "sky" ? { fog: e.target.value } : {}) } })} aria-label={`${label} colour`} />
            </label>
          ))}
        </div>
      </div>

      {game.engine === "quiz" && <QuizEditor quiz={game.quiz} onChange={(quiz) => set({ quiz })} />}
      {game.engine === "memory" && (
        <div className="card gb-section">
          <h3>Cards</h3>
          <label className="field">
            <span>Emoji or short words, separated by spaces (4–12 pairs)</span>
            <input value={(game.memory?.items || []).join(" ")} onChange={(e) => set({ memory: { items: e.target.value.split(/\s+/).filter(Boolean).slice(0, 12) } })} />
          </label>
        </div>
      )}
    </>
  );
}

export default function GameBuilder({ health, opened }) {
  const job = useJob();
  const [lib, setLib] = useState(null);
  const [picked, setPicked] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [game, setGame] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [source, setSource] = useState("");
  const [links, setLinks] = useState({});
  const [notes, setNotes] = useState([]);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState(null);
  const [instruction, setInstruction] = useState("");
  const [past, setPast] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState("");
  const loaded = useRef(null);

  useEffect(() => {
    http.get("/api/games/templates").then(({ data }) => setLib(data)).catch((e) => setError(new Error(errorText(e))));
  }, []);

  const templates = useMemo(
    () => (lib?.templates || []).map((t) => ({ ...t, name: t.title, category: lib.options.engines.find((e) => e.id === t.engine)?.label || "Game", pages: [t.tagline], keywords: [...(t.tags || []), t.world], primary: t.colors.accent, accent: t.colors.player, icon: "Gamepad2" })),
    [lib]
  );

  const fail = useCallback((err) => setError(Object.assign(new Error(errorText(err)), { details: err.details })), []);

  // a game opened from "My projects"
  useEffect(() => {
    if (!opened || loaded.current === opened._id) return;
    loaded.current = opened._id;
    http.get(`/api/projects/${opened._id}`).then(({ data }) => {
      const p = data.project;
      setProjectId(p._id);
      setGame(p.blueprint);
      setSource(p.planSource || "edited");
      setLinks(p.links || {});
      setPast([]);
      setDirty(false);
      setNotes([]);
    }).catch(fail);
  }, [opened, fail]);

  // change the game (keeps undo history, auto-saves shortly after)
  const change = (next, { remember = true } = {}) => {
    if (remember) setPast((p) => [...p.slice(-19), game]);
    setGame(next);
    setDirty(true);
  };
  const timer = useRef(null);
  useEffect(() => {
    if (!dirty || !projectId || !game) return;
    clearTimeout(timer.current);
    setSaving("Saving…");
    timer.current = setTimeout(() => {
      http.put(`/api/games/${projectId}`, { game }).then(() => setSaving("Saved")).catch(() => setSaving("Couldn't save"));
    }, 900);
    return () => clearTimeout(timer.current);
  }, [game, dirty, projectId]);

  const useTemplate = async (t) => {
    setError(null);
    try {
      const { data } = await http.post("/api/games/from-template", { templateId: t.id });
      setProjectId(data.projectId);
      setGame(data.game);
      setSource("template");
      setLinks({});
      setPast([]);
      setDirty(false);
      setWarning("");
    } catch (err) {
      fail(err);
    }
  };

  const plan = async () => {
    setError(null);
    try {
      const r = await job.run("/api/games/plan", { prompt });
      setProjectId(r.projectId);
      setGame(r.game);
      setSource(r.source === "ai" ? "ai" : "generic");
      setWarning(r.note || "");
      setLinks({});
      setPast([]);
      setDirty(false);
    } catch (err) {
      fail(err);
    }
  };

  const aiEdit = async (text) => {
    const ins = (text ?? instruction).trim();
    if (!ins) return;
    setError(null);
    try {
      const r = await job.run("/api/games/edit", { game, instruction: ins });
      change(r.game);
      setInstruction("");
    } catch (err) {
      fail(err);
    }
  };

  const deploy = async () => {
    setError(null);
    setNotes([]);
    try {
      const r = await job.run("/api/games/deploy", { projectId, game });
      setLinks({ live: r.live, backend: r.backend, github: r.github });
      setNotes([r.note, r.dbNote].filter(Boolean));
      setDirty(false);
    } catch (err) {
      fail(err);
    }
  };

  const reset = () => {
    setGame(null);
    setProjectId(null);
    setLinks({});
    setNotes([]);
    setWarning("");
    setError(null);
    setPast([]);
    loaded.current = null;
  };

  // ---------------------------------------------------------- start
  if (!game) {
    return (
      <div className="builder start">
        <div className="start-main">
          <TemplateCarousel templates={templates} selected={picked} onSelect={setPicked} onUse={useTemplate} busy={job.running} related={RELATED} placeholder="Search: racing, space, quiz, kids, puzzle…" useLabel="Edit" />
          <div className="card hero-card prompt-card">
            <div className="prompt-box">
              <textarea
                rows={4}
                placeholder="Or describe your game… e.g. a 3D car race through a neon city at night, 3 lives"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && plan()}
                aria-label="Describe your game"
              />
            </div>
            <div className="chips">{EXAMPLES.map((ex) => <button key={ex} className="chip" onClick={() => setPrompt(ex)}>{ex}</button>)}</div>
            <button className="btn primary big" onClick={plan} disabled={job.running || prompt.trim().length < 3}>
              {job.running ? "Designing…" : <><Icon name="Sparkles" size={18} /> Make my game</>}
            </button>
            <JobStatus job={job} hint="This takes 10–60 seconds." />
            <ErrorBox error={error} onClose={() => setError(null)} />
          </div>
        </div>
        <aside className="start-side">
          {picked ? (
            <GamePreview game={picked.config} />
          ) : (
            <div className="card empty-preview game-empty"><Icon name="Gamepad2" size={34} strokeWidth={1.4} /><p>Pick a template to try it here, in 3D.</p></div>
          )}
        </aside>
      </div>
    );
  }

  // ---------------------------------------------------------- edit
  return (
    <div className="builder">
      <div className="builder-head">
        <div>
          <h1>{game.title}</h1>
          <p className="muted">{SOURCE[source] || ""} · {lib?.options.engines.find((e) => e.id === game.engine)?.label} · {game.world} {saving && <span className="muted small">· {saving}</span>}</p>
        </div>
        <div className="row wrap">
          <button className="btn ghost" onClick={() => { const p = past[past.length - 1]; if (p) { setPast(past.slice(0, -1)); setGame(p); setDirty(true); } }} disabled={!past.length || job.running} aria-label="Undo"><Icon name="Undo2" size={17} /> Undo</button>
          <button className="btn ghost" onClick={reset} disabled={job.running}>New game</button>
          <button className="btn primary" onClick={deploy} disabled={job.running}><Icon name="Globe" size={17} /> {links.live ? "Redeploy" : "Deploy"}</button>
        </div>
      </div>
      <MissingKeys health={health} need={["github", "netlify", "render"]} />
      {warning && <p className="alert warn">{warning}</p>}
      <JobStatus job={job} hint={job.step?.includes("Render") ? "The free Render plan takes 2–6 minutes to start the leaderboard." : undefined} />
      <ErrorBox error={error} onClose={() => setError(null)} />
      {links.live && (
        <div className="card deployed">
          <div className="row between wrap"><strong><Icon name="Trophy" size={17} /> Your game is live</strong></div>
          <LinkList links={links} />
          {notes.map((n) => <p key={n} className="muted small">{n}</p>)}
          {dirty && <p className="muted small">You've changed the game since deploying. Click Redeploy to update the live link — players and scores are kept.</p>}
        </div>
      )}

      <div className="workspace">
        <div className="workspace-main">
          <form className="card chat" onSubmit={(e) => { e.preventDefault(); aiEdit(); }}>
            <label className="field">
              <span><Icon name="Wand2" size={15} /> Ask the AI to change it</span>
              <div className="row">
                <input className="grow" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder='e.g. "make it harder and change the world to space"' />
                <button className="btn primary" disabled={job.running || !instruction.trim()}>Apply</button>
              </div>
            </label>
            <div className="chips tight">
              {["Make it harder", "Make it easier", "Change the theme to space", "Use candy colours"].map((ex) => <button type="button" key={ex} className="chip" onClick={() => aiEdit(ex)} disabled={job.running}>{ex}</button>)}
            </div>
          </form>
          <Editor game={game} onChange={(g) => change(g)} options={lib?.options} />
        </div>
        <aside className="workspace-side"><GamePreview game={game} /></aside>
      </div>
    </div>
  );
}
