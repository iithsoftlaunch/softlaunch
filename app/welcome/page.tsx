'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Starfield from '@/components/starfield';
import Aura from '@/components/aura';
import { Brandmark } from '@/components/nav';
import { getStatus, registerParticipant, isEligible, signOut } from '@/lib/flow';
import { currentPhase } from '@/lib/site';
import CatMeme from '@/components/cat-meme';

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ineligible, setIneligible] = useState(false);
  const [signupState, setSignupState] = useState<'notyet' | 'closed' | null>(null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const s = await getStatus();
      if (!s.loggedIn) {
        router.replace('/login');
        return;
      }
      if (s.submitted) {
        router.replace('/sealed');
        return;
      }
      if (s.registered && s.hasLocalKeys) {
        router.replace('/pick');
        return;
      }
      if (!(await isEligible())) {
        setIneligible(true);
        setLoading(false);
        return;
      }
      // New registrations only during the signup phase. Before it opens there's
      // nothing to do yet; after it closes the directory is sealed, so no new
      // keys may be created.
      const phase = currentPhase();
      if (phase !== 'signup' && process.env.NEXT_PUBLIC_PICK_ANYTIME !== 'true') {
        setSignupState(phase === 'before' ? 'notyet' : 'closed');
        setLoading(false);
        return;
      }
      setEmail(s.email ?? '');
      setLoading(false);
    })();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) return setErr('Use a recovery password of at least 8 characters.');
    if (pw !== pw2) return setErr('The two passwords don’t match.');
    setBusy(true);
    try {
      await registerParticipant(pw);
      router.replace('/pick');
    } catch (e: any) {
      setErr(e.message ?? 'Something went wrong.');
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <Starfield />
        <Aura variant="welcome" />
        <main className="narrow center" style={{ paddingBlock: 120 }}>
          <p className="muted">Getting things ready…</p>
        </main>
      </>
    );
  }

  if (signupState) {
    const notYet = signupState === 'notyet';
    return (
      <>
        <Starfield />
        <Aura variant="welcome" />
        <div className="nav wrap">
          <Brandmark />
        </div>
        <main className="narrow center" style={{ paddingBlock: 70 }}>
          <div className="card">
            <div style={{ fontSize: 46, marginBottom: 12 }}>{notYet ? '🌙' : '⏳'}</div>
            <h1 style={{ fontSize: 28, marginBottom: 10 }}>
              {notYet ? 'Not open just yet' : 'Signup has closed'}
            </h1>
            <p className="muted" style={{ fontSize: 15.5 }}>
              {notYet ? (
                <>
                  Sign-ups open on <span className="gold">17 September</span>. Your
                  roll is on the list — come back then to set up and make your picks.
                </>
              ) : (
                <>
                  Sign-ups are done for this round, so new accounts can&rsquo;t be
                  created. If you already signed up, your picks are safe and results
                  come on reveal night.
                </>
              )}
            </p>
            <button
              className="btn ghost"
              style={{ marginTop: 24 }}
              onClick={async () => {
                await signOut();
                router.replace('/');
              }}
            >
              Back to home
            </button>
          </div>
        </main>
      </>
    );
  }

  if (ineligible) {
    return (
      <>
        <Starfield />
        <Aura variant="welcome" />
        <div className="nav wrap">
          <Brandmark />
        </div>
        <main className="narrow center" style={{ paddingBlock: 70 }}>
          <div className="card">
            <div style={{ fontSize: 46, marginBottom: 12 }}>🌱</div>
            <h1 style={{ fontSize: 28, marginBottom: 10 }}>First-years only this time</h1>
            <p className="muted" style={{ fontSize: 15.5 }}>
              Your IITH sign-in worked, but this edition of Soft Launch is open to
              first-year BTech only. Nothing you did is wrong — you&rsquo;re just
              not on this year&rsquo;s list.
            </p>
            <button
              className="btn ghost"
              style={{ marginTop: 24 }}
              onClick={async () => {
                await signOut();
                router.replace('/');
              }}
            >
              Back to home
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Starfield />
        <Aura variant="welcome" />
      <div className="nav wrap">
        <Brandmark />
      </div>
      <main className="narrow" style={{ paddingBlock: '40px 40px' }}>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 14 }}>
            first, the basics
          </p>
          <h1 style={{ fontSize: 32, lineHeight: 1.05, marginBottom: 10 }}>
            Welcome. Let&rsquo;s set you up.
          </h1>
          <div style={{ marginBottom: 12 }}>
            <CatMeme context="password" size={140} />
          </div>
          <p className="muted" style={{ marginBottom: 8, fontSize: 15 }}>
            Signed in as <span className="gold">{email}</span>
          </p>

          <form onSubmit={submit} style={{ marginTop: 22 }}>
            <div
              className="panel"
              style={{ marginBottom: 18, borderColor: 'var(--gold-deep)' }}
            >
              <div className="label" style={{ color: 'var(--gold)', marginBottom: 8 }}>
                📱 iphone users, read this
              </div>
              <p style={{ margin: 0, fontSize: 14.5 }} className="muted">
                Don&rsquo;t clear this browser or its data before reveal night.
                Your secret key lives here, and Safari can wipe it after about a
                week of not visiting. The password below is your backup if that
                happens.
              </p>
            </div>

            <div className="field">
              <label htmlFor="pw">recovery password</label>
              <input
                id="pw"
                type="password"
                autoComplete="new-password"
                placeholder="something you'll remember"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
              />
              <p className="hint">
                ⚠️ Warning: We cannot reset this. If you lose this password, you might never know who picked you.
              </p>
            </div>
            <div className="field">
              <label htmlFor="pw2">confirm password</label>
              <input
                id="pw2"
                type="password"
                autoComplete="new-password"
                placeholder="type it again"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                required
              />
            </div>

            {err && <p className="err">{err}</p>}
            <button className="btn wide" type="submit" disabled={busy}>
              {busy ? 'Setting up…' : 'Continue to picking'}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
