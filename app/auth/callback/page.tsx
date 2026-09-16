'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Starfield from '@/components/starfield';
import { createClient } from '@/lib/supabase/client';
import { isAllowedEmail } from '@/lib/site';

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  // Only allow same-site relative paths — never an absolute/protocol-relative URL
  // like "//evil.com" — so a crafted login link can't bounce you off-site.
  const rawNext = params.get('next') || '/welcome';
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : '/welcome';

  useEffect(() => {
    // Surface any error Supabase/Google sent back, instead of a generic timeout.
    const here = new URL(window.location.href);
    const errDesc =
      here.searchParams.get('error_description') ||
      here.searchParams.get('error') ||
      new URLSearchParams(here.hash.replace(/^#/, '')).get('error_description');
    if (errDesc) {
      router.replace('/login?error=' + encodeURIComponent(errDesc));
      return;
    }

    const supabase = createClient();
    let done = false;

    async function finish() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || done) return;
      done = true;
      const email = session.user.email ?? '';
      if (!isAllowedEmail(email)) {
        await supabase.auth.signOut();
        router.replace('/login?error=domain');
        return;
      }
      router.replace(next);
    }

    // detectSessionInUrl processes the OAuth redirect on client init; also
    // listen in case the session lands a beat later.
    finish();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) finish();
    });
    // Safety: if nothing resolves, send back to login after a few seconds.
    const t = setTimeout(() => {
      if (!done) router.replace('/login?error=auth');
    }, 8000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Starfield />
      <main className="narrow center" style={{ paddingBlock: 120 }}>
        <p className="muted">Signing you in…</p>
      </main>
    </>
  );
}
