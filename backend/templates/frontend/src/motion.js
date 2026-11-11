/**
 * Motion for the whole site, wired once in App.jsx:
 *  - [data-tilt]   cards lean towards the pointer in 3D, with a soft glare
 *  - .reveal       elements rise into place when they scroll into view
 *  - .hero-scene   the hero's floating glass panes follow the pointer (parallax)
 * Everything is skipped when the visitor asks for reduced motion or uses touch.
 */
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

export function startMotion() {
  if (typeof window === "undefined" || !document?.body) return () => {};
  const offs = [];

  // ---- scroll reveal (works on touch too, unless reduced motion)
  if (!reduced() && "IntersectionObserver" in window) {
    document.documentElement.classList.add("motion");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    const scan = () => {
      document.querySelectorAll(".reveal:not(.seen)").forEach((el) => {
        el.classList.add("seen");
        // stagger siblings in the same grid
        const i = [...(el.parentElement?.children || [])].indexOf(el);
        el.style.setProperty("--d", `${Math.min(i, 8) * 70}ms`);
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    offs.push(() => { io.disconnect(); mo.disconnect(); });
  }

  // ---- 3D tilt + hero parallax (mouse / trackpad only)
  if (!reduced() && finePointer()) {
    let frame = 0;
    let last = null;
    const onMove = (ev) => {
      last = ev;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const e = last;
        const card = e.target.closest?.("[data-tilt]");
        document.querySelectorAll("[data-tilt].tilting").forEach((c) => c !== card && reset(c));
        if (card) {
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          const max = Number(card.dataset.tilt) || 7;
          card.classList.add("tilting");
          card.style.setProperty("--rx", `${(-y * max).toFixed(2)}deg`);
          card.style.setProperty("--ry", `${(x * max).toFixed(2)}deg`);
          card.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
          card.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
        }
        const scene = document.querySelector(".hero-scene");
        if (scene) {
          scene.style.setProperty("--px", ((e.clientX / window.innerWidth - 0.5) * 2).toFixed(3));
          scene.style.setProperty("--py", ((e.clientY / window.innerHeight - 0.5) * 2).toFixed(3));
        }
      });
    };
    const reset = (c) => {
      c.classList.remove("tilting");
      c.style.setProperty("--rx", "0deg");
      c.style.setProperty("--ry", "0deg");
    };
    const onLeave = () => document.querySelectorAll("[data-tilt].tilting").forEach(reset);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    offs.push(() => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    });
  }
  return () => offs.forEach((f) => f());
}
