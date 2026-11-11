import { useEffect, useRef } from "react";

/**
 * A slow-moving universe on a canvas: three layers of twinkling stars drifting
 * at different speeds, satellites with blinking lights crossing the sky and
 * the odd shooting star. The planet and the light source are CSS (see .space).
 */
export default function Universe() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext?.("2d");
    if (!ctx) return; // e.g. tests without canvas support
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const rand = (a, b) => a + Math.random() * (b - a);
    let w = 0, h = 0, dpr = 1, stars = [], sats = [], meteors = [], raf = 0, last = performance.now();

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w * h) / 4200); // same density on every screen
      stars = Array.from({ length: count }, () => {
        const layer = Math.random() < 0.6 ? 0 : Math.random() < 0.75 ? 1 : 2; // far, mid, near
        return {
          x: rand(0, w), y: rand(0, h), layer,
          r: [0.5, 0.9, 1.4][layer] * rand(0.7, 1.2),
          a: rand(0.35, 1), tw: rand(0.6, 2.2), ph: rand(0, Math.PI * 2),
          tint: Math.random() < 0.12 ? "200,215,255" : Math.random() < 0.08 ? "255,228,200" : "255,255,255",
        };
      });
    };

    const newSat = () => {
      // satellites cross on a gentle diagonal, from either side
      const ltr = Math.random() < 0.5;
      return { x: ltr ? -20 : w + 20, y: rand(h * 0.05, h * 0.7), vx: (ltr ? 1 : -1) * rand(14, 26), vy: rand(-4, 4), blink: rand(0, 2) };
    };
    const newMeteor = () => ({ x: rand(w * 0.2, w), y: rand(-20, h * 0.35), vx: -rand(520, 760), vy: rand(220, 340), life: 0, max: rand(0.7, 1.1) });

    const draw = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, w, h);

      // stars: drift slowly left, nearer layers faster (parallax), twinkle
      const speed = [1.2, 3, 6.5];
      for (const s of stars) {
        if (!still) {
          s.x -= speed[s.layer] * dt;
          s.y += speed[s.layer] * 0.25 * dt;
          if (s.x < -2) s.x = w + 2;
          if (s.y > h + 2) s.y = -2;
        }
        const a = s.a * (0.55 + 0.45 * Math.sin(t / 1000 * s.tw + s.ph));
        ctx.beginPath();
        ctx.fillStyle = `rgba(${s.tint},${a})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.layer === 2 && a > 0.75) {
          // little cross flare on the brightest stars
          ctx.strokeStyle = `rgba(${s.tint},${(a - 0.75) * 1.2})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(s.x - s.r * 4, s.y); ctx.lineTo(s.x + s.r * 4, s.y);
          ctx.moveTo(s.x, s.y - s.r * 4); ctx.lineTo(s.x, s.y + s.r * 4);
          ctx.stroke();
        }
      }

      if (!still) {
        // satellites: a small body, two solar panels and a blinking light
        while (sats.length < 3) sats.push(newSat());
        sats = sats.filter((s) => s.x > -40 && s.x < w + 40);
        for (const s of sats) {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          const ang = Math.atan2(s.vy, s.vx);
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(ang);
          ctx.scale(1.7, 1.7);
          ctx.fillStyle = "rgba(210,215,225,0.85)";
          ctx.fillRect(-2, -1.5, 4, 3);
          ctx.fillStyle = "rgba(150,170,210,0.7)";
          ctx.fillRect(-1, -7, 2, 4.5);
          ctx.fillRect(-1, 2.5, 2, 4.5);
          ctx.restore();
          const on = ((t / 1000 + s.blink) % 1.6) < 0.18;
          if (on) {
            const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 9);
            g.addColorStop(0, "rgba(255,90,90,0.95)");
            g.addColorStop(1, "rgba(255,90,90,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // shooting stars, now and then
        if (Math.random() < dt * 0.12) meteors.push(newMeteor());
        meteors = meteors.filter((m) => m.life < m.max);
        for (const m of meteors) {
          m.life += dt;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          const fade = Math.sin((m.life / m.max) * Math.PI);
          const tail = 0.16;
          const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * tail, m.y - m.vy * tail);
          g.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - m.vx * tail, m.y - m.vy * tail);
          ctx.stroke();
        }
      }

      if (!still && !document.hidden) raf = requestAnimationFrame(draw);
    };

    const onVisible = () => {
      if (!document.hidden && !still) {
        cancelAnimationFrame(raf);
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return <canvas ref={ref} className="universe" />;
}
