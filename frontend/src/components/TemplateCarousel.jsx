import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";

/** Words people type, mapped to the words templates use. */
const RELATED = {
  food: ["restaurant", "cafe", "bakery", "tiffin", "catering", "kitchen", "sweets", "dish", "menu"],
  eat: ["restaurant", "cafe", "food"], hungry: ["restaurant", "food", "kitchen"],
  doctor: ["clinic", "dentist", "diagnostic", "physio", "vet"], hospital: ["clinic", "diagnostic"], medical: ["pharmacy", "clinic", "diagnostic"],
  hair: ["salon", "makeup", "spa"], beauty: ["salon", "spa", "makeup"], parlour: ["salon"], parlor: ["salon"],
  shop: ["store", "shop", "grocery", "products"], sell: ["store", "shop", "products"], ecommerce: ["store", "shop"],
  rent: ["rental", "pg", "car", "bike"], hire: ["rental"], stay: ["hotel", "pg", "camp", "resort", "homestay"], room: ["hotel", "pg"],
  class: ["coaching", "tuition", "yoga", "dance", "music", "workshop"], teach: ["coaching", "tuition", "course", "classes"], school: ["coaching", "course", "camp"],
  event: ["events", "wedding", "banquet", "fest", "workshop", "tickets"], party: ["banquet", "catering", "events"], marriage: ["wedding", "banquet"],
  fix: ["repair", "home services", "plumber", "electrician"], clean: ["cleaning", "laundry", "car wash"],
  money: ["expense", "donation", "tax"], charity: ["ngo", "donation"], god: ["temple"],
  photo: ["photography", "portfolio", "gallery"], work: ["job", "crm", "coworking", "freelancer", "tasks"], sport: ["turf", "gym", "club"],
};

function search(templates, q, cat, related = RELATED) {
  const words = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const scored = [];
  for (const t of templates) {
    if (cat && (t.category || "Other") !== cat) continue;
    if (!words.length) {
      scored.push([0, t]);
      continue;
    }
    const title = t.title.toLowerCase();
    const hay = `${title} ${t.name} ${t.category} ${t.pages.join(" ")} ${(t.keywords || []).join(" ")}`.toLowerCase();
    let score = 0;
    let all = true;
    for (const w of words) {
      const alts = [w, ...(related[w] || []), ...(w.endsWith("s") ? [w.slice(0, -1)] : [])];
      const hit = alts.some((a) => hay.includes(a));
      if (!hit) all = false;
      if (title.includes(w)) score += 5;
      else if (hay.includes(w)) score += 3;
      else if (hit) score += 1;
    }
    if (all) scored.push([score, t]);
  }
  return scored.sort((a, b) => b[0] - a[0]).map(([, t]) => t);
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Templates on a 3D carousel: drag, swipe, scroll or use the arrows to spin
 * it; the card in front shows live in the preview.
 */
export default function TemplateCarousel({ templates, selected, onSelect, onUse, busy, related, placeholder, useLabel = "Use" }) {
  const RELATED_ALL = useMemo(() => ({ ...RELATED, ...(related || {}) }), [related]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [pos, setPos] = useState(0); // fractional index while dragging
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const stage = useRef(null);
  const settle = useRef(null);
  const posRef = useRef(0);
  posRef.current = pos;

  const cats = useMemo(() => [...new Set(templates.map((t) => t.category || "Other"))], [templates]);
  const shown = useMemo(() => search(templates, q, cat, RELATED_ALL), [templates, q, cat, RELATED_ALL]);
  const suggestions = useMemo(() => {
    const w = q.toLowerCase().trim().split(/\s+/).pop();
    return w && RELATED_ALL[w] ? RELATED_ALL[w].slice(0, 5) : [];
  }, [q, RELATED_ALL]);

  // new results: jump to the start (or keep the selected one in front)
  useEffect(() => {
    const i = shown.findIndex((t) => t.id === selected?.id);
    setPos(i >= 0 ? i : 0);
    if (i < 0 && shown[0] && (q || cat)) onSelect(shown[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  // after the carousel stops on a card, show it in the preview
  const goTo = (i, select = true) => {
    const n = clamp(Math.round(i), 0, Math.max(0, shown.length - 1));
    setPos(n);
    if (select && shown[n] && shown[n].id !== selected?.id) {
      clearTimeout(settle.current);
      settle.current = setTimeout(() => onSelect(shown[n]), 180);
    }
  };

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    drag.current = { x: e.clientX, start: posRef.current, moved: false };
    setDragging(true);
  };
  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      if (Math.abs(dx) > 4) d.moved = true;
      setPos(clamp(d.start - dx / 150, -0.4, shown.length - 0.6));
    };
    const up = () => {
      setDragging(false);
      const d = drag.current;
      drag.current = d && d.moved ? { ...d, justDragged: true } : null;
      goTo(posRef.current);
      setTimeout(() => (drag.current = null), 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, shown]);

  // mouse wheel / trackpad spins it
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let acc = 0;
    let t;
    const onWheel = (e) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 2) return;
      e.preventDefault();
      acc += d;
      clearTimeout(t);
      t = setTimeout(() => {
        const steps = clamp(Math.round(acc / 90), -4, 4) || Math.sign(acc);
        acc = 0;
        goTo(posRef.current + steps);
      }, 40);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, selected]);

  const onKey = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(pos + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(pos - 1); }
    if (e.key === "Enter" && shown[Math.round(pos)]) onUse(shown[Math.round(pos)]);
  };

  const front = shown[clamp(Math.round(pos), 0, shown.length - 1)];

  return (
    <section className="card templates crystal-panel" aria-label="Ready-made sites">
      <div className="search-wrap">
        <label className="search-box big">
          <Icon name="Search" size={18} />
          <input
            className="template-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder || "Search: bakery, doctor, rent a car, hair…"}
            aria-label="Search templates"
          />
          {q && <button type="button" className="icon-btn" onClick={() => setQ("")} aria-label="Clear search"><Icon name="X" size={15} /></button>}
          <span className="count-pill">{shown.length} / {templates.length}</span>
        </label>
        {suggestions.length > 0 && (
          <div className="related">
            <span className="muted small">Related:</span>
            {suggestions.map((s) => <button key={s} type="button" className="chip" onClick={() => setQ(s)}>{s}</button>)}
          </div>
        )}
      </div>

      <div className="chips tight cat-chips">
        <button className={cat ? "chip" : "chip active"} aria-pressed={!cat} onClick={() => setCat("")}>All</button>
        {cats.map((c) => (
          <button key={c} className={cat === c ? "chip active" : "chip"} aria-pressed={cat === c} onClick={() => setCat(cat === c ? "" : c)}>{c}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="muted empty-search">Nothing matches “{q}”. Describe your business in the box above and we'll plan it for you.</p>
      ) : (
        <>
          <div
            ref={stage}
            className={dragging ? "carousel dragging" : "carousel"}
            onPointerDown={onPointerDown}
            onKeyDown={onKey}
            tabIndex={0}
            role="listbox"
            aria-label="Templates. Use the arrow keys to browse, Enter to use one."
          >
            <div className="carousel-floor" aria-hidden="true" />
            <div className="carousel-track">
              {shown.map((t, i) => {
                const off = i - pos;
                const a = Math.abs(off);
                const far = a > 5.5;
                const style = {
                  "--t1": t.primary,
                  "--t2": t.accent,
                  // front card flat; neighbours fan out to the sides, turned towards the middle
                  transform: `translateX(${Math.sign(off) * (Math.min(a, 1) * 62 + Math.max(0, a - 1) * 30)}%) translateZ(${-Math.min(a, 1) * 160 - Math.max(0, a - 1) * 90}px) rotateY(${-Math.sign(off) * Math.min(a, 1) * 48}deg)`,
                  opacity: far ? 0 : 1 - Math.max(0, a - 1) * 0.16,
                  zIndex: 100 - Math.round(a * 10),
                  visibility: far ? "hidden" : "visible",
                  filter: a > 0.6 ? `brightness(${1 - Math.min(a, 4) * 0.12})` : "none",
                };
                const isFront = Math.round(pos) === i;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={selected?.id === t.id}
                    className={`template slab${selected?.id === t.id ? " selected" : ""}${isFront ? " front" : ""}`}
                    style={style}
                    tabIndex={-1}
                    disabled={busy}
                    onClick={() => {
                      if (drag.current?.justDragged) return;
                      onSelect(t); // show it right away
                      goTo(i, false);
                    }}
                    onDoubleClick={() => onUse(t)}
                  >
                    <span className="slab-art" aria-hidden="true">
                      <span className="slab-orb" />
                      <span className="slab-icon"><Icon icon={t.icon} words={t.title} size={30} strokeWidth={1.5} /></span>
                      <span className="slab-lines"><i /><i /><i /></span>
                    </span>
                    <span className="template-text">
                      <span className="slab-cat">{t.category}</span>
                      <strong>{t.title}</strong>
                      <span className="muted small">{t.pages.join(" · ")}</span>
                    </span>
                    {t.payments && <span className="pay-dot" title="Takes UPI payments"><Icon name="IndianRupee" size={13} /></span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="carousel-controls">
            <button type="button" className="round-btn" onClick={() => goTo(pos - 1)} disabled={pos <= 0} aria-label="Previous template"><Icon name="ChevronLeft" size={20} /></button>
            <div className="carousel-meter" aria-hidden="true">
              <span style={{ width: `${shown.length > 1 ? (clamp(pos, 0, shown.length - 1) / (shown.length - 1)) * 100 : 100}%` }} />
            </div>
            <button type="button" className="round-btn" onClick={() => goTo(pos + 1)} disabled={pos >= shown.length - 1} aria-label="Next template"><Icon name="ChevronRight" size={20} /></button>
          </div>
          {front && (
            <div className="carousel-caption">
              <span className="muted small">Drag or scroll to browse</span>
              <button type="button" className="btn primary" onClick={() => onUse(front)} disabled={busy}>
                {useLabel} {front.title} <Icon name="ArrowRight" size={17} />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
