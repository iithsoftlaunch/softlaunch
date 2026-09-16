'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SITE } from '@/lib/site';

export function Brandmark() {
  return (
    <Link href="/" className="brandmark" style={{ display: 'inline-block' }}>
      {SITE.wordmark[0]}
      <b> {SITE.wordmark[1]}</b>
    </Link>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <nav className="nav wrap">
        <Brandmark />
        <div className="nav-links">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/wall">Couples wall</Link>
          <Link href="/login" className="btn ghost magnetic" style={{ padding: '9px 20px' }}>
            Log in
          </Link>
        </div>
      </nav>
    </div>
  );
}
