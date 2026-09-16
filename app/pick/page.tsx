'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Starfield from '@/components/starfield';
import Aura from '@/components/aura';
import { Brandmark } from '@/components/nav';
import { getStatus, lookupRoll, submitPicks, setPreConsent, getMyGender, type PickInput } from '@/lib/flow';
import { rollFromEmail, currentPhase } from '@/lib/site';
import CatMeme from '@/components/cat-meme';

interface Slot {
  roll: string;
  name: string; // resolved display name, '' if none
  publicKey: string; // resolved key, '' if none
  state: 'empty' | 'checking' | 'found' | 'missing';
  note: string;
}

const emptySlot = (): Slot => ({
  roll: '',
  name: '',
  publicKey: '',
  state: 'empty',
  note: '',
});

const RANK_LABEL = ['top choice', 'second choice', 'third choice'];

export default function PickPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<React.ReactNode | null>(null);
  const [myRoll, setMyRoll] = useState('');
  const [active, setActive] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([emptySlot(), emptySlot(), emptySlot()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sealing, setSealing] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null); // # of picks awaiting confirm
  const [gender, setGender] = useState<'F' | 'M' | null>(null);
  // before-seal consent (only meaningful if they end up matching)
  const [preSite, setPreSite] = useState(true);
  const [preInsta, setPreInsta] = useState(false);
  const [preLine, setPreLine] = useState('');
  const timers = useRef<Array<ReturnType<typeof setTimeout> | null>>([null, null, null]);
  // NOTE: the 1/2/3-pick cat is intentionally shown AFTER sealing (on /sealed),
  // never while picking — see app/sealed/page.tsx.

  useEffect(() => {
    (async () => {
      const s = await getStatus();
      if (!s.loggedIn) return router.replace('/login');
      if (s.submitted) return router.replace('/sealed');
      if (!s.registered || !s.hasLocalKeys) return router.replace('/welcome');
      setMyRoll(s.email ? rollFromEmail(s.email) : '');
      getMyGender().then(setGender).catch(() => {});

      const phase = currentPhase();
      if (phase !== 'picking' || !s.sealed) {
        if (phase === 'before' || phase === 'signup' || phase === 'gap') {
          setBlocked(
            <>
              <p style={{ marginBottom: 16 }}>
                You are successfully registered! A secure cryptographic key has been generated and permanently attached to your device.
              </p>
              <p style={{ marginBottom: 16 }}>
                Soft Launch uses the exact same encryption standards (AES-256-GCM and X25519) authorized by the US NSA to protect Top Secret government information. Your crushes are mathematically safe.
              </p>
              <p className="gold">
                Picking officially opens on 23 September. Come back then!
              </p>
            </>
          );
        } else if (!s.sealed && phase === 'picking') {
          setBlocked(
            <>
              <p style={{ marginBottom: 16 }}>
                Picking is temporarily paused while the admins finalize the roster.
              </p>
              <p className="gold">
                Hold tight, the doors will open shortly!
              </p>
            </>
          );
        } else if (phase === 'waiting') {
          setBlocked('Picking has closed. Results drop on reveal night.');
        } else {
          setBlocked('Results are live — head to the reveal page.');
        }
      }
      setLoading(false);
    })();
  }, [router]);

  function setSlot(i: number, patch: Partial<Slot>) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function onRoll(i: number, value: string) {
    setSlot(i, { roll: value, name: '', publicKey: '', state: value.trim() ? 'checking' : 'empty' });
    if (timers.current[i]) clearTimeout(timers.current[i]!);
    const clean = value.trim().toLowerCase().replace(/\s/g, '');
    if (!clean) return;
    timers.current[i] = setTimeout(async () => {
      if (clean === myRoll) {
        setSlots((prev) =>
          prev.map((s, idx) => {
            if (idx !== i) return s;
            if (s.roll.trim().toLowerCase().replace(/\s/g, '') !== clean) return s;
            return { ...s, name: "You can't pick yourself!", publicKey: '', state: 'missing' as const };
          })
        );
        return;
      }
      const hit = await lookupRoll(clean);
      setSlots((prev) =>
        prev.map((s, idx) => {
          if (idx !== i) return s;
          if (s.roll.trim().toLowerCase().replace(/\s/g, '') !== clean) return s; // stale
          if (hit) return { ...s, name: hit.displayName, publicKey: hit.publicKey, state: 'found' as const };
          return { ...s, name: '', publicKey: '', state: 'missing' as const };
        })
      );
      // The cat reaction is fired by the foundCount effect above (only when the
      // number of picks increases), so nothing to do here.
    }, 300);
  }

  // Validate, then ask for a final confirmation (empty lists allowed).
  function requestConfirm() {
    setErr('');
    const filled = slots.filter((s) => s.roll.trim());
    for (const s of filled) {
      if (s.state !== 'found' || !s.publicKey) {
        return setErr(
          `${s.roll || 'a slot'} isn't a pickable first-year roll. Fix or clear it.`,
        );
      }
      if (s.roll.trim().toLowerCase().replace(/\s/g, '') === myRoll) {
        return setErr("You can't pick yourself, hopeless romantic.");
      }
    }
    const rolls = filled.map((s) => s.roll.trim().toLowerCase().replace(/\s/g, ''));
    if (new Set(rolls).size !== rolls.length) {
      return setErr('You picked the same person twice. Give each slot a different roll.');
    }
    setConfirming(filled.length);
  }

  async function doSubmit() {
    const picks: PickInput[] = slots
      .map((s, idx) => ({ s, rank: idx + 1 }))
      .filter(({ s }) => s.roll.trim() && s.state === 'found')
      .map(({ s, rank }) => ({
        roll: s.roll.trim().toLowerCase().replace(/\s/g, ''),
        publicKey: s.publicKey,
        rank,
        note: s.note.trim(),
      }));

    setConfirming(null);
    setBusy(true);
    setSealing(true);
    try {
      // record before-seal consent (only relevant if they picked someone). Best-effort:
      // if the RPC isn't installed yet, sealing still proceeds.
      if (picks.length > 0) {
        try {
          await setPreConsent(preSite, preInsta, preLine);
        } catch {}
      }
      await submitPicks(picks);
      // pass the count so /sealed can show the right cat (3 picks = judging cat)
      setTimeout(() => router.replace(`/sealed?n=${picks.length}`), 900);
    } catch (e: any) {
      setSealing(false);
      setBusy(false);
      setErr(e.message ?? 'Submission failed. Try again.');
    }
  }

  if (loading) {
    return (
      <>
        <Starfield />
        <Aura variant="pick" />
        <main className="narrow center" style={{ paddingBlock: 120 }}>
          <p className="muted">Loading…</p>
        </main>
      </>
    );
  }

  if (blocked) {
    return (
      <>
        <Starfield />
        <Aura variant="pick" />
        <div className="nav wrap">
          <Brandmark />
        </div>
        <main className="narrow center" style={{ paddingBlock: 90 }}>
          <div className="card">
            <div style={{ fontSize: 44, marginBottom: 12 }}>🕰️</div>
            <h1 style={{ fontSize: 28, marginBottom: 10 }}>Not just yet</h1>
            <div className="muted" style={{ lineHeight: 1.5 }}>{blocked}</div>
          </div>
        </main>
      </>
    );
  }

  const slot = slots[active];

  return (
    <>
      <Starfield />
        <Aura variant="pick" />
      <div className="nav wrap">
        <Brandmark />
      </div>
      <main className="narrow" style={{ paddingBlock: '32px 48px' }}>
        <div className="center" style={{ marginBottom: 24 }}>
          <p className="eyebrow">your picks</p>
          <h1 style={{ fontSize: 'clamp(28px,6vw,40px)', lineHeight: 1.05, marginTop: 12 }}>
            Who are you soft launching?
          </h1>
          <p className="muted" style={{ marginTop: 12, fontSize: 15 }}>
            Up to three, ranked. Fill just one if you&rsquo;re sure. This submits{' '}
            <span className="rose">once</span> — no edits, no take-backs.
          </p>
        </div>

        <div className="panel" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 auto' }}>
              <CatMeme context="shy" size={64} rounded={12} />
            </div>
            <div>
              <div className="label" style={{ color: 'var(--rose-soft)', marginBottom: 8 }}>
                don&rsquo;t be shy — pick who you like
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>
                In the talking stage, catching feelings, or never had the guts to say it
                out loud? This is made for you. If they feel the same you&rsquo;ll both
                find out, and if they don&rsquo;t, no one ever knows. People in that
                in-between stage match the most.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginTop: 16 }}>
            <div style={{ flex: '0 0 auto' }}>
              <CatMeme context="realistic" size={64} rounded={12} />
            </div>
            <div>
              <div className="label" style={{ color: 'var(--gold)', marginBottom: 8 }}>
                choose realistic choices
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>
                The whole point is more actual prom couples, so choose people you&rsquo;d
                genuinely go with. Don&rsquo;t joke-pick, don&rsquo;t add someone at
                random, and don&rsquo;t list someone who&rsquo;s clearly already taken.
                Realistic picks are the ones that turn into real dates.
              </p>
            </div>
          </div>
        </div>

        <div className="card" style={{ position: 'relative' }}>
          <div className="slot-tabs" role="tablist">
            {slots.map((s, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={active === i}
                className={`slot-tab${active === i ? ' active' : ''}${
                  s.state === 'found' ? ' filled' : ''
                }`}
                onClick={() => setActive(i)}
              >
                <span className="rk">rank {i + 1}</span>
                {s.state === 'found' ? s.name.split(' ')[0] : RANK_LABEL[i].split(' ')[0]}
              </button>
            ))}
          </div>

          <div className="field">
            <label htmlFor="roll">roll number · {RANK_LABEL[active]}</label>
            <input
              id="roll"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              placeholder="e.g. cs26btech11001"
              value={slot.roll}
              onChange={(e) => onRoll(active, e.target.value)}
            />
            <div className="namehit">
              {slot.state === 'checking' && <span className="dim">checking…</span>}
              {slot.state === 'found' && (
                <>
                  <span className="chk ok">✓</span>
                  <span className="ok">{slot.name}</span>
                </>
              )}
              {slot.state === 'missing' && (
                <>
                  <span className="chk" style={{ color: 'var(--rose-soft)' }}>
                    △
                  </span>
                  <span style={{ color: 'var(--rose-soft)' }}>
                    not a pickable first-year roll
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="note">a note (revealed only if it&rsquo;s mutual)</label>
            <textarea
              id="note"
              rows={2}
              placeholder="hey, i've wanted to ask you for ages… — my number: ___ / insta: @___"
              value={slot.note}
              onChange={(e) => setSlot(active, { note: e.target.value })}
              maxLength={280}
            />
            <div className="note-callout">
              <div className="note-callout-cat">
                <CatMeme context="note" size={64} rounded={12} />
              </div>
              <div>
                <div className="note-callout-title">
                  {gender === 'F'
                    ? 'gurl, give him ur number 📱'
                    : gender === 'M'
                      ? 'boii, give her ur number 📱'
                      : '📱 drop your number or Instagram in the note!'}
                </div>
                <div className="note-callout-sub">
                  This note is the <b>only</b> way a match can reach you. Leave it out and
                  they&rsquo;ll match with you but have no way to text you. Don&rsquo;t skip it.
                </div>
              </div>
            </div>
          </div>

          {err && <p className="err">{err}</p>}
          <button className="btn wide" onClick={requestConfirm} disabled={busy}>
            {busy ? 'Sealing…' : 'Seal my picks 🕯️'}
          </button>
          <p className="hint center" style={{ marginTop: 14 }}>
            🔒 sealed on your device before it leaves · unreadable to us
          </p>

          {confirming !== null && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 26,
                background: 'linear-gradient(180deg,#2A1631,#1A0E20)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'safe center',
                textAlign: 'center',
                padding: '26px 22px',
                gap: 6,
                overflowY: 'auto',
              }}
            >
              {confirming === 0 ? (
                <div style={{ marginBottom: 10 }}>
                  <CatMeme context="empty" size={110} />
                </div>
              ) : (
                <div style={{ fontSize: 40, marginBottom: 8 }}>💌</div>
              )}
              <h3 style={{ fontSize: 24 }}>
                {confirming === 0 ? 'Sealing an empty list' : `Sealing ${confirming} pick${confirming > 1 ? 's' : ''}`}
              </h3>
              <p className="muted" style={{ fontSize: 15, maxWidth: '32ch', margin: '4px 0 0' }}>
                {confirming === 0 ? (
                  <>
                    Your list is empty, so you&rsquo;re here just for the vibes and
                    won&rsquo;t match with anyone. This is <span className="rose">final</span> —
                    it can&rsquo;t be undone.
                  </>
                ) : (
                  <>
                    Warning: This submits <span className="rose">once</span>. No edits, no
                    take-backs. Sure you&rsquo;re ready?
                  </>
                )}
              </p>

              {/* before-seal consent — only asked when there's a real chance of matching */}
              {confirming !== 0 && (
                <div
                  className="panel"
                  style={{ marginTop: 20, textAlign: 'left', maxWidth: 380, width: '100%', borderColor: 'var(--gold-deep)' }}
                >
                  <div style={{ marginBottom: 10 }}>
                    <CatMeme context="consent" size={100} />
                  </div>
                  <div className="label" style={{ color: 'var(--gold)', marginBottom: 6 }}>
                    one tiny thing 🥺
                  </div>
                  <p className="muted" style={{ margin: '0 0 12px', fontSize: 14 }}>
                    we poured our hearts into Soft Launch. if you two match, letting us
                    show you off would mean the world. totally optional — no match, no
                    reveal, nothing shows unless they opt in too.
                  </p>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label htmlFor="preline">a line for the wall, if you match (optional)</label>
                    <input
                      id="preline"
                      type="text"
                      maxLength={80}
                      placeholder="knew it the whole time"
                      value={preLine}
                      onChange={(e) => setPreLine(e.target.value)}
                    />
                  </div>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8, fontSize: 14 }}>
                    <input type="checkbox" checked={preSite} onChange={(e) => setPreSite(e.target.checked)} />
                    if we match, you can show us on the couples wall
                  </label>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14 }}>
                    <input type="checkbox" checked={preInsta} onChange={(e) => setPreInsta(e.target.checked)} />
                    you can also repost us on Instagram
                  </label>
                </div>
              )}

              <button className="btn wide" style={{ marginTop: 22 }} onClick={doSubmit}>
                {confirming === 0 ? 'Yes, just the vibes' : 'Yes, seal it'}
              </button>
              <button
                className="mono dim"
                style={{ background: 'none', border: 0, cursor: 'pointer', fontSize: 13, marginTop: 12 }}
                onClick={() => setConfirming(null)}
              >
                go back
              </button>
            </div>
          )}

          {sealing && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 26,
                background: 'linear-gradient(180deg,#2A1631,#1A0E20)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle at 38% 32%, var(--rose-soft), var(--rose) 45%, #B33350 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 18px 40px -12px rgba(255,94,122,0.6)',
                  marginBottom: 16,
                }}
              >
                <span style={{ fontSize: 40 }}>💌</span>
              </div>
              <h3 style={{ fontSize: 26 }}>Sealing…</h3>
              <p className="muted" style={{ fontSize: 14 }}>
                encrypting on your device
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
