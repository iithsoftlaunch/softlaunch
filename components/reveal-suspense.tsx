'use client';

import { useEffect, useRef, useState } from 'react';

// ~4.5s cinematic build before the result. Particles rush inward and accelerate,
// a core pulses and swells, a ring spins faster, captions escalate, then a white
// flash hands off to the result. Respects reduced-motion (quick, calm handoff).
const LINES = [
  'gathering the sealed letters…',
  'checking who chose who…',
  'looking for a match…',
  'almost there…',
  'here it comes…',
];

export default function RevealSuspense({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [line, setLine] = useState(0);
  const [flash, setFlash] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
    };
    if (reduce) {
      setLine(LINES.length - 1);
      const t = setTimeout(finish, 900);
      return () => clearTimeout(t);
    }

    const DURATION = 6000;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    let raf = 0;
    const start = performance.now();

    function size() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    }
    size();
    const onResize = () => size();
    window.addEventListener('resize', onResize);

    const N = Math.min(180, Math.floor(window.innerWidth / 6));
    const parts = Array.from({ length: N }, () => {
      const ang = Math.random() * Math.PI * 2;
      const dist = (0.4 + Math.random() * 0.9) * Math.max(canvas.width, canvas.height) * 0.6;
      return {
        ang,
        dist,
        speed: 0.6 + Math.random() * 1.4,
        size: (Math.random() * 2 + 0.6) * dpr,
        hue: Math.random() < 0.5 ? '#FF5E7A' : '#EAC57D',
      };
    });

    const lineTimers = LINES.map((_, i) =>
      setTimeout(() => setLine(i), (DURATION / LINES.length) * i),
    );
    const flashT = setTimeout(() => setFlash(true), DURATION - 450);
    const doneT = setTimeout(finish, DURATION);

    function draw(now: number) {
      const t = Math.min(1, (now - start) / DURATION);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // pull particles toward center, accelerating with t
      const pull = 1 + t * t * 6;
      for (const p of parts) {
        p.dist -= p.speed * pull * dpr;
        if (p.dist < 0) p.dist = Math.max(canvas.width, canvas.height) * 0.6;
        const x = cx + Math.cos(p.ang) * p.dist;
        const y = cy + Math.sin(p.ang) * p.dist;
        ctx.globalAlpha = 0.35 + 0.6 * t;
        ctx.fillStyle = p.hue;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (1 + t), 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // swelling, pulsing core
      const pulse = 1 + 0.18 * Math.sin(now / 90);
      const coreR = (30 + t * 150) * pulse * dpr;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      grad.addColorStop(0, `rgba(255,137,160,${0.5 + 0.5 * t})`);
      grad.addColorStop(0.5, `rgba(255,94,122,${0.25 + 0.3 * t})`);
      grad.addColorStop(1, 'rgba(255,94,122,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, 7);
      ctx.fill();

      // spinning ring, faster over time
      const ringR = (70 + t * 60) * dpr;
      ctx.lineWidth = 3 * dpr;
      ctx.strokeStyle = `rgba(234,197,125,${0.4 + 0.5 * t})`;
      const rot = now / (400 - t * 300);
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, rot, rot + Math.PI * 1.4);
      ctx.stroke();

      if (t < 1) raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      lineTimers.forEach(clearTimeout);
      clearTimeout(flashT);
      clearTimeout(doneT);
    };
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'radial-gradient(circle at 50% 50%, #2A1631, #140A17)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div style={{ position: 'relative', textAlign: 'center', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <div
          className="mono"
          style={{
            fontSize: 15,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--blush)',
            textShadow: '0 0 20px rgba(255,137,160,0.7)',
          }}
        >
          {LINES[line]}
        </div>
      </div>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#FBEBE6',
          opacity: flash ? 1 : 0,
          transition: 'opacity .45s ease',
          pointerEvents: 'none',
          zIndex: 101,
        }}
      />
    </div>
  );
}
