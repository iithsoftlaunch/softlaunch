'use client';

import { useEffect } from 'react';

// Scroll-reveal: any element with [data-reveal] rises + fades in as it enters view.
// Safe by default — without JS the elements are fully visible (CSS only hides them
// once this adds `.reveal-ready` to <html>). Catches elements added on navigation.
export default function RevealController() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    root.classList.add('reveal-ready');

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('reveal-in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );

    const scan = () => {
      document.querySelectorAll('[data-reveal]:not(.reveal-in)').forEach((el) => io.observe(el));
    };
    scan();
    // re-scan when the DOM changes (client navigation between pages)
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => { io.disconnect(); mo.disconnect(); };
  }, []);

  return null;
}
