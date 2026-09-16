'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Starfield from '@/components/starfield';
import Aura from '@/components/aura';
import { Brandmark } from '@/components/nav';
import { createClient } from '@/lib/supabase/client';
import { ALLOWED_EMAIL_DOMAIN } from '@/lib/site';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const params = useSearchParams();
  const rawNext = params.get('next') || '/welcome';
  const next = (rawNext.startsWith('/') && rawNext[1] !== '/' && rawNext[1] !== '\\') ? rawNext : '/welcome';
  const error = params.get('error');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(
    error === 'domain'
      ? `Please use your @${ALLOWED_EMAIL_DOMAIN} Google account.`
      : error === 'auth'
        ? 'Sign-in didn’t complete. Try again.'
        : error
          ? decodeURIComponent(error)
          : '',
  );

  async function google() {
    setErr('');
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        // hd hints Google to prefer the IITH domain; real enforcement is
        // server-side in the callback + the register RPC.
        queryParams: { hd: ALLOWED_EMAIL_DOMAIN, prompt: 'select_account' },
      },
    });
    if (error) {
      setBusy(false);
      setErr(error.message);
    }
    // otherwise the browser is redirecting to Google
  }

  return (
    <>
      <Starfield />
        <Aura variant="landing" />
      <div className="nav wrap">
        <Brandmark />
      </div>
      <main className="narrow" style={{ paddingBlock: '48px 40px' }}>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 14 }}>
            log in
          </p>
          <h1 style={{ fontSize: 34, lineHeight: 1.05, marginBottom: 12 }}>
            Let&rsquo;s get you in.
          </h1>
          <p className="muted" style={{ marginBottom: 16, fontSize: 15.5 }}>
            Sign in with your{' '}
            <span className="gold">@{ALLOWED_EMAIL_DOMAIN}</span> Google account.
            One tap, no password.
          </p>
          <div className="panel" style={{ marginBottom: 22 }}>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              Login only does two things: confirms you&rsquo;re a{' '}
              <span className="gold">first-year BTech at IITH</span>, and makes sure
              you&rsquo;re one person (no duplicates). That&rsquo;s it, nothing about
              you is tracked or stored beyond that.
            </p>
          </div>

          <button
            className="btn wide"
            onClick={google}
            disabled={busy}
            style={{
              background: '#fff',
              color: '#1f1f1f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            {busy ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {err && <p className="err" style={{ marginTop: 16 }}>{err}</p>}

          <p className="hint" style={{ marginTop: 20 }}>
            We only ever see your IITH email and name — nothing else from your
            Google account.
          </p>
        </div>
        <p className="center dim" style={{ fontSize: 13, marginTop: 22 }}>
          Lost your device after picking?{' '}
          <Link href="/reveal">Recover on reveal night →</Link>
        </p>
      </main>
    </>
  );
}
