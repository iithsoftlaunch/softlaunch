'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Starfield from '@/components/starfield';
import Aura from '@/components/aura';
import { Brandmark } from '@/components/nav';
import Countdown from '@/components/countdown';
import { getStatus } from '@/lib/flow';
import { pickMeme } from '@/lib/memes';
import ChromaVideo from '@/components/chroma-video';

// which cat matches how many people you sealed (0 picks shows no cat)
const CAT_BY_COUNT: Record<number, 'one' | 'two' | 'judging'> = {
  1: 'one',
  2: 'two',
  3: 'judging',
};

export default function SealedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  // 'celebrate' = brief count-cat moment (only right after sealing, max 5s);
  // 'waiting'   = the permanent waiting page. Once we leave 'celebrate' the
  // count cat is gone for good and can never be recovered (back button included).
  const [phase, setPhase] = useState<'celebrate' | 'waiting'>('waiting');
  const [catSrc, setCatSrc] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let justSealed = false;
      try {
        // Read the count ONCE, then strip it from the URL so a refresh or a
        // back-navigation can never re-reveal how many you picked.
        const raw = new URLSearchParams(window.location.search).get('n');
        window.history.replaceState({}, '', window.location.pathname);
        // NOTE: raw can be null on a re-run after we strip the URL; Number(null)
        // is 0, so guard explicitly instead of coercing. Only 1–3 show a cat.
        const n = raw === null ? NaN : Number(raw);
        if (Number.isInteger(n) && n >= 1 && n <= 3) {
          const m = pickMeme(CAT_BY_COUNT[n]);
          if (m) {
            setCatSrc(m.src);
            justSealed = true;
          }
        }
      } catch {}
      const s = await getStatus();
      if (!s.loggedIn) return router.replace('/login');
      if (!s.submitted) return router.replace('/pick');
      if (justSealed) setPhase('celebrate');
      setLoading(false);
    })();
  }, [router]);

  // Celebrate for exactly 5s, then switch permanently to the waiting page. If the
  // user leaves the tab OR the page is restored from the back/forward cache, jump
  // straight to 'waiting' so the count cat is never shown again (privacy).
  useEffect(() => {
    const toWaiting = () => {
      setPhase('waiting');
      setCatSrc(null);
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) toWaiting();
    };
    window.addEventListener('pagehide', toWaiting);
    window.addEventListener('pageshow', onPageShow);
    let t: ReturnType<typeof setTimeout> | null = null;
    if (phase === 'celebrate') t = setTimeout(toWaiting, 5000);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener('pagehide', toWaiting);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [phase]);

  if (loading) {
    return (
      <>
        <Starfield />
        <Aura variant="sealed" />
        <main className="narrow center" style={{ paddingBlock: 120 }}>
          <p className="muted">Loading…</p>
        </main>
      </>
    );
  }

  // ---- Phase 1: brief celebration with the count cat (max 5s) ----
  if (phase === 'celebrate') {
    return (
      <>
        <Starfield />
        <Aura variant="sealed" />
        <div className="nav wrap">
          <Brandmark />
        </div>
        <main className="narrow center" style={{ paddingBlock: '64px 64px' }}>
          <div className="card">
            {catSrc && (
              <div style={{ marginBottom: 18 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={catSrc}
                  alt=""
                  aria-hidden="true"
                  style={{
                    width: 200,
                    maxWidth: '100%',
                    aspectRatio: '1 / 1',
                    objectFit: 'cover',
                    borderRadius: 18,
                    margin: '0 auto',
                    display: 'block',
                    border: '1px solid var(--line)',
                    animation: 'catpop .3s ease',
                  }}
                />
              </div>
            )}
            <h1 style={{ fontSize: 36, marginBottom: 12 }}>You&rsquo;re in.</h1>
            <p className="muted" style={{ fontSize: 16 }}>
              Sealed 💌 hang tight…
            </p>
          </div>
        </main>
      </>
    );
  }

  // ---- Phase 2: the permanent waiting page ----
  return (
    <>
      <Starfield />
        <Aura variant="sealed" />
      <div className="nav wrap">
        <Brandmark />
      </div>
      <main className="narrow center" style={{ paddingBlock: '28px 52px' }}>
        {/* Hero: the spinning cat — this waiting / "coming soon" page is where it lives */}
        <div style={{ position: 'relative', margin: '0 auto 26px', maxWidth: 460 }}>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: '-14% -6%',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(255,94,122,0.35), rgba(234,197,125,0.12) 55%, transparent 72%)',
              filter: 'blur(26px)',
              animation: 'halo-pulse 3.6s ease-in-out infinite',
              zIndex: 0,
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <ChromaVideo src="/videos/spinning-cat.mp4" maxWidth={460} />
          </div>
        </div>

        <h1 style={{ fontSize: 40, marginBottom: 8, lineHeight: 1.05 }}>
          You&rsquo;re in.
        </h1>
        <p
          className="mono"
          style={{
            fontSize: 13,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            marginBottom: 16,
          }}
        >
          🔒 sealed &amp; unreadable — even to us
        </p>
        <p className="muted" style={{ fontSize: 16, maxWidth: '32ch', margin: '0 auto 30px' }}>
          Nothing left to do but wait. You find out at 12:01 am on reveal night,
          not a second before.
        </p>

        {/* Countdown as the centrepiece */}
        <div
          className="card"
          style={{
            padding: '26px 20px 20px',
            background:
              'linear-gradient(180deg, rgba(255,94,122,0.10), rgba(42,22,49,0.4))',
            borderColor: 'var(--line-strong)',
            maxWidth: 440,
            margin: '0 auto',
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 12,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--rose-soft)',
              marginBottom: 14,
            }}
          >
            ✨ reveal night drops in
          </div>
          <Countdown caption="24 sep · 12:01 am" />
        </div>

        {/* Compact keep-in-mind note */}
        <p
          className="dim"
          style={{ fontSize: 13, maxWidth: '38ch', margin: '24px auto 0', lineHeight: 1.6 }}
        >
          📱 <b style={{ color: 'var(--mauve)' }}>Keep this browser.</b> If you clear
          it or switch phones, your recovery password gets you back in.
        </p>
        <p className="dim" style={{ fontSize: 13, marginTop: 18 }}>
          Come back on reveal night: <Link href="/reveal">your results →</Link>
        </p>
      </main>
    </>
  );
}
