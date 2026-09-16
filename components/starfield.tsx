'use client';

import { useEffect, useRef } from 'react';

// Ambient, living background: three depth layers of particles that drift, twinkle,
// and parallax subtly with the pointer, plus the occasional heart. Capped for
// performance and stilled entirely under prefers-reduced-motion.
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const c = ref.current;
    if (!c) return;
    const x = c.getContext('2d');
    if (!x) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0,
      h = 0,
      raf = 0;
    let mx = 0,
      my = 0; // smoothed pointer offset (-1..1)
    let tmx = 0,
      tmy = 0;

    // three layers: [depth factor, count-scale, size, speed, alpha]
    const LAYERS = [
      { depth: 0.15, sizes: [0.3, 1.0], vy: 0.05, alpha: 0.5, heart: 0.03 },
      { depth: 0.4, sizes: [0.6, 1.6], vy: 0.12, alpha: 0.7, heart: 0.06 },
      { depth: 0.8, sizes: [1.0, 2.4], vy: 0.22, alpha: 0.9, heart: 0.1 },
    ];
    type P = { x: number; y: number; r: number; a: number; sp: number; vy: number; heart: boolean; layer: number };
    let pts: P[] = [];

    function size() {
      w = c!.width = window.innerWidth * dpr;
      h = c!.height = window.innerHeight * dpr;
    }
    function seed() {
      pts = [];
      const base = Math.min(150, Math.floor(window.innerWidth / 11));
      LAYERS.forEach((L, li) => {
        const n = Math.floor(base * (li === 0 ? 0.5 : li === 1 ? 0.35 : 0.25));
        for (let i = 0; i < n; i++) {
          pts.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: (L.sizes[0] + Math.random() * (L.sizes[1] - L.sizes[0])) * dpr,
            a: Math.random(),
            sp: Math.random() * 0.02 + 0.004,
            vy: L.vy * dpr,
            heart: Math.random() < L.heart,
            layer: li,
          });
        }
      });
    }
    size();
    seed();

    const onResize = () => {
      size();
      seed();
    };
    const onMove = (e: MouseEvent) => {
      tmx = (e.clientX / window.innerWidth - 0.5) * 2;
      tmy = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('resize', onResize);
    if (!reduce) window.addEventListener('mousemove', onMove);

    function heart(px: number, py: number, s: number, col: string, alpha: number) {
      x!.fillStyle = col;
      x!.globalAlpha = alpha;
      x!.beginPath();
      x!.moveTo(px, py + s * 0.4);
      x!.bezierCurveTo(px + s, py - s * 0.5, px + s * 0.5, py - s * 1.1, px, py - s * 0.4);
      x!.bezierCurveTo(px - s * 0.5, py - s * 1.1, px - s, py - s * 0.5, px, py + s * 0.4);
      x!.fill();
      x!.globalAlpha = 1;
    }

    function frame() {
      mx += (tmx - mx) * 0.05;
      my += (tmy - my) * 0.05;
      x!.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.a += p.sp;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(p.a));
        p.y -= p.vy;
        if (p.y < -12) {
          p.y = h + 12;
          p.x = Math.random() * w;
        }
        const dep = LAYERS[p.layer].depth;
        const px = p.x - mx * 26 * dep * dpr;
        const py = p.y - my * 26 * dep * dpr;
        const alpha = tw * LAYERS[p.layer].alpha;
        if (p.heart) {
          heart(px, py, p.r * 1.7, '#FF5E7A', alpha * 0.7);
        } else {
          x!.fillStyle = `rgba(251,235,230,${alpha})`;
          x!.beginPath();
          x!.arc(px, py, p.r, 0, 7);
          x!.fill();
        }
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
