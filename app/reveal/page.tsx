'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Starfield from '@/components/starfield';
import Aura from '@/components/aura';
import { Brandmark } from '@/components/nav';
import Countdown from '@/components/countdown';
import {
  getStatus,
  getRevealResult,
  recoverFromPassword,
  claimWall,
  getMyName,
  type RevealResult,
} from '@/lib/flow';
import { currentPhase } from '@/lib/site';
import { randomNoMatchCaption } from '@/lib/memes';
import CatMeme from '@/components/cat-meme';
import RevealSuspense from '@/components/reveal-suspense';
import LocalVideo from '@/components/local-video';
import ChromaVideo from '@/components/chroma-video';

const HIDE_KEY = 'sl.hideResult';
const SEEN_KEY = 'sl.revealSeen'; // the suspense + celebration play only the first time
const WALL_KEY = 'sl.wallConsentDone'; // the after-match consent can be filled only once

type View =
  | 'loading'
  | 'notyet'
  | 'needkey'
  | 'suspense'
  | 'result'
  | 'notpublished'
  | 'error'
  | 'closed'
  | 'hidden';

export default function RevealPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('loading');
  const [result, setResult] = useState<RevealResult | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [celebrate, setCelebrate] = useState(false); // run the particle burst? (first time only)
  const [consentDone, setConsentDone] = useState(false); // has the after-match consent been given?

  async function tryReveal() {
    try {
      const r = await getRevealResult();
      setResult(r);
      if (!r.matched) setCaption(randomNoMatchCaption());
      let seen = false;
      try {
        seen = localStorage.getItem(SEEN_KEY) === '1';
      } catch {}
      // First time → play the full build + celebration. Revisit → straight to the
      // result, no animation, so switching back and forth never replays it.
      setView(seen ? 'result' : 'suspense');
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('reveal kit')) setView('needkey');
      else if (msg.includes('not published')) setView('notpublished');
      else {
        setErr(msg || 'Something went wrong.');
        setView('error');
      }
    }
  }

  useEffect(() => {
    try {
      if (localStorage.getItem(WALL_KEY) === '1') setConsentDone(true);
    } catch {}
    (async () => {
      // Kill switch: once hidden on this device, the result is gone for good — the
      // page just shows a warm thank-you and nothing else.
      try {
        if (localStorage.getItem(HIDE_KEY) === '1') {
          setView('hidden');
          return;
        }
      } catch {}

      const s = await getStatus();
      if (!s.loggedIn) return router.replace('/login');
      const phase = currentPhase();
      if (phase === 'closed') {
        setView('closed');
        return;
      }
      if (phase !== 'revealed') {
        setView('notyet');
        return;
      }
      if (!s.submitted) {
        setResult({ matched: false });
        setCaption("You didn't lock in any picks during the 24-hour picking window, so you weren't entered into matching. Go check out who made it on the wall!");
        setView('result');
        return;
      }
      await tryReveal();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function recover(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await recoverFromPassword(pw);
      setBusy(false);
      setView('loading');
      await tryReveal();
    } catch (e: any) {
      setBusy(false);
      setErr('Wrong password. Please try again.');
    }
  }

  function activateHide() {
    try {
      localStorage.setItem(HIDE_KEY, '1');
    } catch {}
    setView('hidden');
  }

  // The suspense overlay is full-screen and self-contained. When it finishes we
  // remember it (so it never plays again) and let the result celebrate once.
  if (view === 'suspense') {
    return (
      <RevealSuspense
        onDone={() => {
          try {
            localStorage.setItem(SEEN_KEY, '1');
          } catch {}
          setCelebrate(true);
          setView('result');
        }}
      />
    );
  }

  if (view === 'hidden') {
    return (
      <>
        <Starfield />
        <Aura variant="reveal" />
        <div className="nav wrap">
          <Brandmark />
        </div>
        <main className="narrow center" style={{ paddingBlock: 90 }}>
          <div className="card">
            <div style={{ fontSize: 46, marginBottom: 14 }}>🤍</div>
            <h1 style={{ fontSize: 28, marginBottom: 12 }}>Your privacy is safe.</h1>
            <p className="muted" style={{ fontSize: 16, maxWidth: '34ch', margin: '0 auto' }}>
              Thank you for registering with us and trusting us with your data.
              Whatever happened stays yours. Good luck out there. 💛
            </p>
            <div style={{ marginTop: 26 }}>
              <Link href="/wall" className="btn wall-cta">
                👀 see the couples wall
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Starfield />
      <Aura variant={view === 'result' && result && !result.matched ? 'nomatch' : 'reveal'} />
      <div className="nav wrap">
        <Brandmark />
      </div>
      <main className="narrow" style={{ paddingBlock: '40px 56px' }}>
        {view === 'loading' && (
          <div className="center" style={{ paddingBlock: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
            <ChromaVideo src="/videos/spinning-cat.mp4" maxWidth={512} />
            <p className="mono" style={{ fontSize: 14, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--blush)' }}>
              opening the letters…
            </p>
          </div>
        )}

        {view === 'notyet' && (
          <div className="card center">
            <div style={{ fontSize: 52, marginBottom: 12 }}>🌙</div>
            <h1 style={{ fontSize: 30, marginBottom: 10 }}>Not yet.</h1>
            <p className="muted" style={{ marginBottom: 26 }}>
              Results unseal at 12:01 am on reveal night, all at once. Hold tight.
            </p>
            <Countdown />
          </div>
        )}

        {view === 'closed' && (
          <div className="card center">
            <div style={{ fontSize: 52, marginBottom: 12 }}>🌸</div>
            <h1 style={{ fontSize: 30, marginBottom: 10 }}>That&rsquo;s a wrap.</h1>
            <p className="muted" style={{ marginBottom: 20 }}>
              Reveal night has passed and all the pick data has been wiped, just
              as promised. Nothing lingers. Thanks for playing, and we hope you
              found your person.
            </p>
            <p className="gold mono" style={{ fontSize: 13, marginBottom: 24 }}>
              👀 keep an eye out — we&rsquo;re cooking up something new soon.
            </p>
            <Link href="/wall" className="btn">
              See the couples who made it
            </Link>
          </div>
        )}

        {view === 'notpublished' && (
          <div className="center" style={{ paddingBlock: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
            <ChromaVideo src="/videos/spinning-cat.mp4" maxWidth={512} />
            <div>
              <h1 style={{ fontSize: 32, marginBottom: 10 }}>Almost there.</h1>
              <p className="muted" style={{ maxWidth: '34ch', margin: '0 auto' }}>
                It&rsquo;s reveal night, but results are still being published.
                Refresh in a minute.
              </p>
            </div>
          </div>
        )}

        {view === 'needkey' && (
          <div className="card">
            <div className="center">
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔑</div>
              <h1 style={{ fontSize: 28, marginBottom: 10 }}>Let&rsquo;s recover you.</h1>
              <p className="muted" style={{ marginBottom: 22, fontSize: 15 }}>
                This device doesn&rsquo;t have your secret key anymore. Enter the
                recovery password you set at signup to unlock your results.
              </p>
            </div>
            <form onSubmit={recover}>
              <div className="field">
                <label htmlFor="pw">recovery password</label>
                <input
                  id="pw"
                  type="password"
                  autoComplete="current-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                />
              </div>
              {err && <p className="err">{err}</p>}
              <button className="btn wide" type="submit" disabled={busy}>
                {busy ? 'Unlocking…' : 'Unlock my results'}
              </button>
            </form>
          </div>
        )}

        {view === 'error' && (
          <div className="card center">
            <div style={{ fontSize: 48, marginBottom: 12 }}>😿</div>
            <h1 style={{ fontSize: 26, marginBottom: 10 }}>Hmm.</h1>
            <p className="muted">{err}</p>
          </div>
        )}

        {view === 'result' && result && (
          result.matched ? (
            <>
              <MatchReveal name={result.name} text={result.text} animate={celebrate} />
              <WallClaim
                token={result.token}
                partner={result.name}
                initialDone={consentDone}
                onSaved={() => {
                  setConsentDone(true);
                  try { localStorage.setItem(WALL_KEY, '1'); } catch {}
                }}
              />
            </>
          ) : (
            <NoMatch caption={caption} animate={celebrate} />
          )
        )}

        {/* glowing nudge to the couples wall — go see if your friends are up there */}
        {(view === 'result' || view === 'error') && (
          <div className="center" style={{ marginTop: 26 }}>
            <Link href="/wall" className="btn wall-cta">
              👀 see the couples wall — your friends might be up there
            </Link>
          </div>
        )}

        {/* matched users must answer the wall question before they can hide */}
        {view === 'result' && (
          <HideResult onHide={activateHide} blocked={!!(result?.matched && !consentDone)} />
        )}
      </main>
    </>
  );
}

function WallClaim({
  token,
  partner,
  initialDone = false,
  onSaved,
}: {
  token: string;
  partner: string;
  initialDone?: boolean;
  onSaved?: () => void;
}) {
  const [line, setLine] = useState('');
  const [showSite, setShowSite] = useState(true);
  const [showInsta, setShowInsta] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(initialDone);
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    setBusy(true);
    try {
      await claimWall(token, getMyName() || 'someone', line.trim(), showSite, showInsta);
      setDone(true);
      onSaved?.();
    } catch (e: any) {
      setErr(e.message ?? 'Could not save.');
    }
    setBusy(false);
  }

  // Once answered, it locks — the consent can be given only once.
  if (done) {
    return (
      <div className="panel center" style={{ marginTop: 20 }}>
        <div className="label" style={{ color: 'var(--gold)', marginBottom: 8 }}>
          ✓ your answer is saved
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>
          {showSite
            ? <>You&rsquo;ll appear on the wall once {partner.split(' ')[0]} opts in too.{showInsta && ' We may repost consented pairs on Instagram.'}</>
            : <>Got it — we&rsquo;ll keep you two off the wall. Your secret stays yours.</>}
        </p>
      </div>
    );
  }

  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <div style={{ marginBottom: 12 }}>
        <CatMeme context="pleading" size={130} />
      </div>
      <div className="label" style={{ color: 'var(--rose-soft)', marginBottom: 10 }}>
        one last thing — can we show you off? you can say no. nothing shows unless{' '}
        {partner.split(' ')[0]} opts in too.
      </div>
      <div className="field">
        <label htmlFor="line">a short line (optional)</label>
        <input
          id="line"
          type="text"
          maxLength={80}
          placeholder="knew it the whole time"
          value={line}
          onChange={(e) => setLine(e.target.value)}
        />
      </div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, fontSize: 15 }}>
        <input type="checkbox" checked={showSite} onChange={(e) => setShowSite(e.target.checked)} />
        show our names on the couples wall
      </label>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, fontSize: 15 }}>
        <input type="checkbox" checked={showInsta} onChange={(e) => setShowInsta(e.target.checked)} />
        you can also repost us on Instagram
      </label>
      {err && <p className="err">{err}</p>}
      <button className="btn wide" onClick={submit} disabled={busy}>
        {busy ? 'Saving…' : 'Save my answer (final)'}
      </button>
      <p className="hint center" style={{ marginTop: 10 }}>
        you can only answer this once
      </p>
    </div>
  );
}

// Privacy kill switch. Hides everything result-related on this device, for good.
// `blocked` = a matched user who hasn't answered the wall question yet; they must
// give a clear yes/no before they can hide.
function HideResult({ onHide, blocked }: { onHide: () => void; blocked: boolean }) {
  const [confirm, setConfirm] = useState(false);

  if (blocked) {
    return (
      <p className="center dim" style={{ marginTop: 18, fontSize: 13, maxWidth: '40ch', marginInline: 'auto' }}>
        answer the wall question above first — then you can hide your result.
      </p>
    );
  }

  if (!confirm) {
    return (
      <div className="center" style={{ marginTop: 18 }}>
        <button
          className="mono dim"
          style={{
            background: 'none',
            border: '1px solid var(--line)',
            borderRadius: 100,
            padding: '10px 20px',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--mauve)',
          }}
          onClick={() => setConfirm(true)}
        >
          🙈 hide my result
        </button>
      </div>
    );
  }

  return (
    <div className="panel" style={{ marginTop: 18, textAlign: 'center' }}>
      <p className="muted" style={{ margin: '0 0 14px', fontSize: 14.5 }}>
        This hides your result on this device — no one, including you, will be able
        to see it here anymore. Nothing on screen will hint at whether you matched.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn"
          style={{ background: 'linear-gradient(135deg,var(--rose),var(--rose-soft))' }}
          onClick={onHide}
        >
          Hide it now
        </button>
        <button
          className="mono dim"
          style={{ background: 'none', border: 0, cursor: 'pointer', fontSize: 13 }}
          onClick={() => setConfirm(false)}
        >
          never mind
        </button>
      </div>
    </div>
  );
}

// No-match: deliberately NOT celebratory. A gloomy grey drizzle, a comedic
// wobble, and a tumbleweed rolling by. Playful "forever alone (for now)" energy.
function NoMatch({ caption, animate }: { caption: string; animate: boolean }) {
  const brokenRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (animate) brokenHearts(brokenRef.current);
  }, [animate]);

  return (
    <div className="card center nomatch-card" style={{ position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={brokenRef}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      <div style={{ position: 'relative', zIndex: 1 }} className="nomatch-inner">
        <div style={{ fontSize: 60, marginBottom: 6 }}>🥲</div>
        <h1 style={{ fontSize: 'clamp(26px,6vw,36px)', marginBottom: 12 }}>no match this round</h1>
        <p className="muted" style={{ maxWidth: '32ch', margin: '0 auto', fontSize: 16 }}>
          {caption}
        </p>
        <div style={{ marginTop: 18 }}>
          <CatMeme context="nomatch" size={120} />
        </div>
        <div style={{ marginTop: 16 }}>
          <LocalVideo src="/videos/nomatch.mp4" maxWidth={460} />
        </div>
      </div>
      <div className="tumbleweed" aria-hidden="true">🌾</div>
    </div>
  );
}

function MatchReveal({ name, text, animate }: { name: string; text: string; animate: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const owlRef = useRef<SVGSVGElement>(null);
  const [showLetter, setShowLetter] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Revisit (animate=false) or reduced-motion → show the letter straight away,
    // no owl fly-in and no confetti.
    if (reduce || !animate) {
      setShowLetter(true);
      return;
    }
    const owl = owlRef.current;
    if (owl) {
      owl.style.opacity = '1';
      owl.animate(
        [
          { transform: 'translateX(-160px) translateY(0) rotate(-6deg)' },
          { transform: 'translateX(40vw) translateY(-18px) rotate(3deg)', offset: 0.5 },
          { transform: 'translateX(110vw) translateY(6px) rotate(-4deg)' },
        ],
        { duration: 1400, easing: 'cubic-bezier(.4,0,.5,1)' },
      );
    }
    const t = setTimeout(() => {
      if (owl) owl.style.opacity = '0';
      setShowLetter(true);
      celebrationHearts(canvasRef.current);
    }, 780);
    return () => clearTimeout(t);
  }, [animate]);

  return (
    <div className="card center" style={{ position: 'relative', overflow: 'hidden', minHeight: 460 }}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3 }}
      />
      <svg
        ref={owlRef}
        viewBox="0 0 120 90"
        aria-hidden="true"
        style={{ position: 'absolute', left: 0, top: '30%', width: 110, zIndex: 4, opacity: 0, pointerEvents: 'none' }}
      >
        <ellipse cx="60" cy="48" rx="30" ry="34" fill="#5A3E6B" />
        <ellipse cx="60" cy="52" rx="21" ry="24" fill="#7A5A8C" />
        <circle cx="49" cy="38" r="12" fill="#FBEBE6" />
        <circle cx="71" cy="38" r="12" fill="#FBEBE6" />
        <circle cx="49" cy="39" r="5.5" fill="#2A0E16" />
        <circle cx="71" cy="39" r="5.5" fill="#2A0E16" />
        <path d="M60 44l-5 6h10z" fill="#EAC57D" />
        <rect x="47" y="60" width="26" height="18" rx="2" fill="#FBEBE6" stroke="#EAC57D" strokeWidth="1" />
        <path d="M47 61l13 8 13-8" stroke="#FF5E7A" strokeWidth="1.4" fill="none" />
        <circle cx="60" cy="69" r="3" fill="#FF5E7A" />
      </svg>

      <div style={{ position: 'relative', zIndex: 2, width: '100%' }}>
        <div
          className="em mutual-em"
          style={{ fontFamily: 'var(--display)', fontSize: 'clamp(28px,6vw,44px)', color: 'var(--gold)', marginBottom: 18 }}
        >
          it&rsquo;s mutual.
        </div>
        {showLetter && (
          <div
            style={{
              maxWidth: 400,
              margin: '0 auto',
              background: 'linear-gradient(180deg,#FBEBE6,#F3D9D0)',
              color: '#3A1A24',
              borderRadius: 18,
              padding: '30px 28px',
              textAlign: 'left',
              boxShadow: '0 40px 80px -30px rgba(0,0,0,0.8)',
              animation: 'none',
            }}
          >
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#B0596B' }}>
              a letter, just unsealed
            </div>
            <h4 style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 30, margin: '6px 0 14px', color: '#2A0E16' }}>
              {name}
            </h4>
            {text ? (
              <p style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 19, lineHeight: 1.5, color: '#5A3540', margin: 0 }}>
                &ldquo;{text}&rdquo;
              </p>
            ) : (
              <p style={{ fontStyle: 'italic', color: '#8A5563', margin: 0 }}>
                (they didn&rsquo;t leave a note — go say hi anyway.)
              </p>
            )}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(58,26,36,0.15)', fontSize: 14, color: '#8A5563' }}>
              💌 you both picked each other. the rest is up to you.
            </div>
          </div>
        )}
        {showLetter && (
          <div style={{ marginTop: 20 }}>
            <CatMeme context="match" size={120} />
          </div>
        )}
        {showLetter && (
          <div style={{ marginTop: 16 }}>
            <LocalVideo src="/videos/match.mp4" maxWidth={460} />
          </div>
        )}
      </div>
    </div>
  );
}

// heart/gold confetti on the reveal canvas
// ---- shared heart drawing ----
function heartPath(ctx: CanvasRenderingContext2D, s: number) {
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(s * 0.75, -s * 0.45, s * 0.4, -s * 0.95, 0, -s * 0.35);
  ctx.bezierCurveTo(-s * 0.4, -s * 0.95, -s * 0.75, -s * 0.45, 0, s * 0.35);
}
function crackPath(ctx: CanvasRenderingContext2D, s: number) {
  // jagged split down the middle so a heart reads as "broken"
  ctx.moveTo(0, -s * 0.6);
  ctx.lineTo(s * 0.14, -s * 0.22);
  ctx.lineTo(-s * 0.12, s * 0.02);
  ctx.lineTo(s * 0.1, s * 0.28);
  ctx.lineTo(-s * 0.04, s * 0.45);
}

type Particle = {
  x: number; y: number; vx: number; vy: number; s: number;
  rot: number; vr: number; c: string; life: number; decay: number;
  wob: number; wspd: number; grav: number;
  star?: boolean; tw?: number;
};

// a 4-point sparkle (for the match star-burst)
function starPath(ctx: CanvasRenderingContext2D, s: number) {
  ctx.moveTo(0, -s * 1.7);
  ctx.quadraticCurveTo(0, 0, s * 1.7, 0);
  ctx.quadraticCurveTo(0, 0, 0, s * 1.7);
  ctx.quadraticCurveTo(0, 0, -s * 1.7, 0);
  ctx.quadraticCurveTo(0, 0, 0, -s * 1.7);
}

// burst a shower of twinkling star-dots outward from a point (the match moment)
function emitStars(
  parts: Particle[], n: number, cx: number, cy: number, dpr: number, colors: string[],
) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = (Math.random() * 12 + 2.5) * dpr;
    parts.push({
      x: cx, y: cy,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 2 * dpr,
      s: (Math.random() * 2.6 + 0.8) * dpr,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5,
      c: colors[(Math.random() * colors.length) | 0],
      life: 1, decay: 0.005 + Math.random() * 0.006,
      wob: Math.random() * 6, wspd: 0.05 + Math.random() * 0.12,
      grav: 0.008 + Math.random() * 0.02,
      star: true, tw: Math.random() * Math.PI * 2,
    });
  }
}

function setupCanvas(cvs: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = cvs.getBoundingClientRect();
  cvs.width = rect.width * dpr;
  cvs.height = rect.height * dpr;
  return dpr;
}

// spawn helper: emit n particles from a given edge with varied motion
function emit(
  parts: Particle[], n: number, src: 'bottom' | 'top' | 'left' | 'right',
  W: number, H: number, dpr: number, colors: string[], sizeMin: number, sizeMax: number,
) {
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0, vx = 0, vy = 0;
    if (src === 'bottom') { x = Math.random() * W; y = H + Math.random() * 30 * dpr; vx = (Math.random() - 0.5) * 6 * dpr; vy = -(Math.random() * 8 + 8) * dpr; }
    else if (src === 'top') { x = Math.random() * W; y = -Math.random() * H * 0.3; vx = (Math.random() - 0.5) * 3 * dpr; vy = (Math.random() * 2 + 1.5) * dpr; }
    else if (src === 'left') { x = -20 * dpr; y = Math.random() * H * 0.9; vx = (Math.random() * 5 + 3) * dpr; vy = -(Math.random() * 3 + 1) * dpr; }
    else { x = W + 20 * dpr; y = Math.random() * H * 0.9; vx = -(Math.random() * 5 + 3) * dpr; vy = -(Math.random() * 3 + 1) * dpr; }
    parts.push({
      x, y, vx, vy,
      s: (Math.random() * (sizeMax - sizeMin) + sizeMin) * dpr,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      c: colors[(Math.random() * colors.length) | 0],
      life: 1, decay: 0.004 + Math.random() * 0.005,
      wob: Math.random() * 6, wspd: 0.04 + Math.random() * 0.09,
      grav: 0.03 + Math.random() * 0.05,
    });
  }
}

// MATCH: colourful hearts of many sizes flying in from every direction — "LET'S GOOO"
function celebrationHearts(cvs: HTMLCanvasElement | null) {
  if (!cvs) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = cvs.getContext('2d');
  if (!ctx) return;
  const dpr = setupCanvas(cvs);
  const W = cvs.width, H = cvs.height;
  const heartColors = ['#FF5E7A', '#EAC57D', '#FF89A0', '#FBEBE6', '#FF3B6B', '#C79BFF', '#7BE0B0'];
  const starColors = ['#EAC57D', '#FBEBE6', '#FFF3C4', '#FF89A0', '#FFE08A'];
  const parts: Particle[] = [];
  // hearts flying in from every edge
  emit(parts, 110, 'bottom', W, H, dpr, heartColors, 7, 30);
  emit(parts, 80, 'top', W, H, dpr, heartColors, 6, 22);
  emit(parts, 40, 'left', W, H, dpr, heartColors, 8, 24);
  emit(parts, 40, 'right', W, H, dpr, heartColors, 8, 24);
  // a big shower of star-dots bursting from the centre — the euphoria
  emitStars(parts, 220, W / 2, H * 0.42, dpr, starColors);
  // a second star wave a beat later, so it keeps sparkling
  let wave2 = false;
  const start = performance.now();
  function run(now: number) {
    if (!wave2 && now - start > 650) { wave2 = true; emitStars(parts, 150, W / 2, H * 0.4, dpr, starColors); }
    ctx!.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of parts) {
      p.wob += p.wspd;
      p.x += p.vx + Math.sin(p.wob) * (p.star ? 0.5 : 0.9) * dpr;
      p.y += p.vy; p.vy += p.grav * dpr;
      p.rot += p.vr; p.life -= p.decay;
      if (p.life <= 0) continue;
      alive = true;
      ctx!.save();
      ctx!.translate(p.x, p.y); ctx!.rotate(p.rot);
      if (p.star) {
        // twinkle: alpha pulses; a glowing dot with a sparkle cross
        p.tw! += 0.3;
        const tw = 0.45 + 0.55 * Math.abs(Math.sin(p.tw!));
        ctx!.globalAlpha = Math.max(0, Math.min(1, p.life * 1.25)) * tw;
        ctx!.fillStyle = p.c;
        ctx!.shadowColor = p.c; ctx!.shadowBlur = 8 * dpr;
        ctx!.beginPath(); starPath(ctx!, p.s); ctx!.fill();
        ctx!.beginPath(); ctx!.arc(0, 0, p.s * 0.5, 0, 7); ctx!.fill();
      } else {
        ctx!.globalAlpha = Math.max(0, Math.min(1, p.life * 1.3));
        ctx!.fillStyle = p.c;
        ctx!.beginPath(); heartPath(ctx!, p.s); ctx!.fill();
      }
      ctx!.restore();
    }
    if (alive && now - start < 6000) requestAnimationFrame(run);
    else ctx!.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(run);
}

// NO MATCH: varied BROKEN hearts, wobbly and comedic, muted-but-playful — "damn bro"
function brokenHearts(cvs: HTMLCanvasElement | null) {
  if (!cvs) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = cvs.getContext('2d');
  if (!ctx) return;
  const dpr = setupCanvas(cvs);
  const W = cvs.width, H = cvs.height;
  const colors = ['#9B7A8E', '#6EA8FF', '#C7A2B8', '#8A9AA1', '#B06070', '#7A8CA8'];
  const parts: Particle[] = [];
  emit(parts, 80, 'top', W, H, dpr, colors, 8, 30);
  emit(parts, 30, 'left', W, H, dpr, colors, 8, 24);
  emit(parts, 30, 'right', W, H, dpr, colors, 8, 24);
  // exaggerate the wobble for comedic tumbling
  for (const p of parts) { p.wspd *= 1.8; p.vr *= 1.6; }
  const start = performance.now();
  function run(now: number) {
    ctx!.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of parts) {
      p.wob += p.wspd;
      p.x += p.vx + Math.sin(p.wob) * 1.6 * dpr;
      p.y += p.vy; p.vy += p.grav * dpr;
      p.rot += p.vr; p.life -= p.decay;
      if (p.life > 0) {
        alive = true;
        ctx!.save();
        ctx!.translate(p.x, p.y); ctx!.rotate(p.rot);
        ctx!.globalAlpha = Math.max(0, Math.min(1, p.life * 1.3));
        ctx!.fillStyle = p.c;
        ctx!.beginPath(); heartPath(ctx!, p.s); ctx!.fill();
        // the crack
        ctx!.strokeStyle = 'rgba(20,10,23,0.55)';
        ctx!.lineWidth = Math.max(1, p.s * 0.09);
        ctx!.lineJoin = 'round';
        ctx!.beginPath(); crackPath(ctx!, p.s); ctx!.stroke();
        ctx!.restore();
      }
    }
    if (alive && now - start < 5000) requestAnimationFrame(run);
    else ctx!.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(run);
}
