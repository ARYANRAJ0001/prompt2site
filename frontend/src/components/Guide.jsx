import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { GUIDE } from "../guideData.js";

const BASE = import.meta.env?.BASE_URL || "/";
const STEP_MS = 6500;

function Arrow({ up }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? "M12 21V3M5 10l7-7 7 7" : "M12 3v18M5 14l7 7 7-7"} />
    </svg>
  );
}

/** A pulsing ring around the real button/box, with a label and a bobbing arrow pointing at it. */
function Pointer({ spot, label }) {
  if (!spot) return null;
  const big = spot.w > 45 || spot.h > 40;
  const cx = spot.x + spot.w / 2;
  const below = spot.y + spot.h < 62; // room under the target: arrow points up at it
  let pos, up = false;
  if (big) pos = { top: `${spot.y + 6}%` };
  else if (below) { pos = { top: `${spot.y + spot.h + 1}%` }; up = true; }
  else pos = { bottom: `${100 - spot.y + 1}%` };
  return (
    <>
      <span className={big ? "g-ring big" : "g-ring"} style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%` }} />
      <span className={up ? "g-tip up" : "g-tip"} style={{ ...pos, "--cx": `${cx}%` }}>
        {up && <Arrow up />}
        <span className="g-label">{label}</span>
        {!up && <Arrow />}
      </span>
    </>
  );
}

/** "How it works": closed until you open it; one tour per section, arrows on the real screens. */
export default function Guide({ onGo }) {
  const [open, setOpen] = useState(false);
  const [sec, setSec] = useState(0);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const section = GUIDE[sec];
  const steps = section.steps;

  useEffect(() => {
    if (!open || paused) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % steps.length), STEP_MS);
    return () => clearTimeout(t);
  }, [open, paused, step, sec, steps.length]);

  const pick = (i) => { setSec(i); setStep(0); };
  const cur = steps[step];

  return (
    <section className={`guide card${open ? " open" : ""}`} aria-label="How it works">
      <button type="button" className="guide-toggle" aria-expanded={open} aria-controls="guide-panel" onClick={() => setOpen(!open)}>
        <span className="gt-icon"><Icon name="Lightbulb" size={22} strokeWidth={1.6} /></span>
        <span className="gt-text">
          <h2 className="title-shine">How it works</h2>
          <span className="muted small">{open ? "Step-by-step help for each section, with arrows on the real screen" : "Tap to open a guide for each section"}</span>
        </span>
        <Icon name="ChevronDown" size={22} className="gt-chev" />
      </button>

      {open && (
        <div className="guide-panel" id="guide-panel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div className="guide-tabs" role="tablist" aria-label="Choose a section">
            {GUIDE.map((g, i) => (
              <button key={g.id} type="button" role="tab" aria-selected={i === sec} className={i === sec ? "on" : ""} onClick={() => pick(i)}>
                <Icon name={g.icon} size={16} /> {g.label}
              </button>
            ))}
          </div>
          <p className="muted small" style={{ margin: "0 0 12px" }}>{section.intro}</p>

          <div className="guide-body">
            <ol className="guide-steps">
              {steps.map((g, i) => (
                <li key={g.img} className={i === step ? "now" : i < step ? "done" : ""}>
                  <button type="button" onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined}>
                    <span className="guide-num">{i < step ? <Icon name="Check" size={14} /> : i + 1}</span>
                    <span className="guide-text">
                      <strong>{g.title}</strong>
                      <span className="muted small">{g.text}</span>
                    </span>
                    {i === step && !paused && <span className="guide-bar" key={`${sec}-${step}`} style={{ animationDuration: `${STEP_MS}ms` }} />}
                  </button>
                </li>
              ))}
            </ol>

            <div className="guide-stage">
              <div className="guide-frame">
                <div className="guide-chrome"><i /><i /><i /><span>{section.label} · step {step + 1} of {steps.length}</span></div>
                <div className="guide-shots">
                  {steps.map((g, i) => (
                    <img key={g.img} src={`${BASE}guide/${g.img}.webp`} alt={`${section.label}, step ${i + 1}: ${g.title}`} className={i === step ? "on" : ""} loading={i === step ? "eager" : "lazy"} draggable="false" />
                  ))}
                  <Pointer key={`${sec}-${step}`} spot={cur.spot} label={cur.label} />
                </div>
              </div>
              <div className="guide-foot">
                <div className="guide-dots">
                  {steps.map((g, i) => <button key={g.img} type="button" className={i === step ? "on" : ""} onClick={() => setStep(i)} aria-label={`Step ${i + 1}`} />)}
                </div>
                <div className="row wrap">
                  <button type="button" className="btn ghost small" onClick={() => setPaused(!paused)}>{paused ? "Resume" : "Pause"}</button>
                  <button type="button" className="btn primary small" onClick={() => onGo(section.go)}>Open {section.label} <Icon name="ArrowRight" size={15} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
