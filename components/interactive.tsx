'use client';

import { useEffect } from 'react';

// Global interactivity:
//  • cards (.step/.promise/.pair/.bento-tile) tilt in 3D toward the cursor + spotlight
//  • buttons marked .magnetic lean toward the cursor when it's near
// Event delegation → works on every page and survives client navigation.
// Desktop only; disabled under reduced-motion.
const SEL = '.step, .promise, .pair, .bento-tile';
const MAG_RADIUS = 120;

export default function Interactive() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let current: HTMLElement | null = null;
    const reset = (el: HTMLElement) => { el.style.transform = ''; };

    const onMove = (e: PointerEvent) => {
      // 1) 3D tilt + spotlight on the hovered card
      const el = (e.target as HTMLElement)?.closest?.(SEL) as HTMLElement | null;
      if (!el) {
        if (current) { reset(current); current = null; }
      } else {
        if (current && current !== el) reset(current);
        current = el;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const rx = (0.5 - py) * 9;
        const ry = (px - 0.5) * 11;
        el.style.transform = `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(8px)`;
        el.style.setProperty('--sx', `${(px * 100).toFixed(1)}%`);
        el.style.setProperty('--sy', `${(py * 100).toFixed(1)}%`);
      }

      // 2) magnetic buttons near the cursor
      document.querySelectorAll<HTMLElement>('.magnetic').forEach((b) => {
        const r = b.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < MAG_RADIUS + Math.max(r.width, r.height) / 2) {
          const pull = 0.3;
          b.style.transform = `translate(${(dx * pull).toFixed(1)}px, ${(dy * pull).toFixed(1)}px)`;
        } else {
          b.style.transform = '';
        }
      });
    };

    const onLeaveWindow = () => {
      if (current) { reset(current); current = null; }
      document.querySelectorAll<HTMLElement>('.magnetic').forEach((b) => (b.style.transform = ''));
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeaveWindow);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeaveWindow);
      if (current) reset(current);
    };
  }, []);

  return null;
}
