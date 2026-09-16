'use client';

import { useEffect, useRef } from 'react';

// A soft light that trails the pointer, adding a living, futuristic feel.
// Desktop only (skipped on touch) and stilled under reduced-motion.
export default function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return; // no touch screens
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;

    const move = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      el.style.opacity = '1';
    };
    const loop = () => {
      x += (tx - x) * 0.15;
      y += (ty - y) * 0.15;
      el.style.setProperty('--cx', `${x}px`);
      el.style.setProperty('--cy', `${y}px`);
      raf = requestAnimationFrame(loop);
    };

    el.style.opacity = '0';
    window.addEventListener('pointermove', move);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
    };
  }, []);

  return <div ref={ref} className="cursor-glow" aria-hidden="true" />;
}
