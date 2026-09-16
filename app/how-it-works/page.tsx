import Link from 'next/link';
import Starfield from '@/components/starfield';
import Aura from '@/components/aura';
import Nav from '@/components/nav';
import SiteFooter from '@/components/site-footer';
import { REPO_URL } from '@/lib/site';

export const metadata = {
  title: 'How it works · Soft Launch',
  description: 'How Soft Launch keeps your picks private, even from the people who run it.',
};

export default function HowItWorks() {
  return (
    <>
      <Starfield />
        <Aura variant="welcome" />
      <Nav />
      <main className="wrap" style={{ paddingBlock: '8px 20px', position: 'relative', zIndex: 1 }}>
        <div className="pagehead">
          <p className="eyebrow">the how &amp; the why</p>
          <h1>How this stays your secret.</h1>
          <p>
            The short version: your picks are scrambled on your own phone with a
            key that never leaves it. An unreturned crush is something no one can
            uncover, including us.
          </p>
        </div>

        <div className="measure" style={{ margin: '0 auto', fontSize: 16.5 }}>
          <Section n="01" title="You pick, in secret">
            Log in with your <span className="gold">@iith.ac.in</span> email — that
            is also how we know you&rsquo;re a real IITH student, and it doubles as
            your roll number. Pick up to three people, ranked, each with an
            optional note that&rsquo;s only ever revealed on a mutual match.
          </Section>

          <Section n="02" title="Your phone does the sealing">
            When you pick someone, your browser mixes your private key with their
            public key into a shared secret, and turns it into a scrambled code.
            If they pick you back, their phone lands on the exact same code. Only
            the code, a rank, and your encrypted note leave your device. Your
            picks themselves never do.
          </Section>

          <Section n="03" title="A match is two matching codes">
            Two identical codes mean two people chose each other. A one-sided pick
            is a code no one can trace back or reverse — not other students, not
            the database, not us. That&rsquo;s the whole point, and it&rsquo;s a
            property of the math, not a promise we&rsquo;re asking you to trust.
          </Section>

          <Section n="04" title="Even you can't reopen it">
            Once you seal your picks, they&rsquo;re gone from view — your own
            device keeps only meaningless codes, never names. So nobody can ever
            pressure you into showing your list, because there&rsquo;s nothing to
            show.
          </Section>

          <Section n="05" title="Everyone finds out at once">
            At 12:01 am on reveal night, results go live for everyone together. A
            match unseals the other person&rsquo;s note and name. No match? A soft
            landing, never a cold rejection. It never tells anyone what number you
            ranked them.
          </Section>

          <h2 id="privacy" style={{ fontSize: 30, marginTop: 56, marginBottom: 8 }}>
            The honest limits
          </h2>
          <p className="muted" style={{ marginBottom: 20 }}>
            Anyone can promise privacy. Here&rsquo;s what you can actually check,
            and what you can&rsquo;t.
          </p>
          <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            <li>
              <b>You can verify this yourself.</b> Our code is open source, the
              deployed version is pinned in the footer, and if you open your
              browser&rsquo;s network tab while submitting, the only thing you&rsquo;ll
              see leave is one scrambled code.
            </li>
            <li>
              <b>What we can technically see:</b> that an account submitted, and
              which anonymous codes matched — never whose they are. We deliberately
              never store the link between you and your picks.
            </li>
            <li>
              <b>What we can&rsquo;t see:</b> who you picked when it wasn&rsquo;t
              returned, or the contents of any note.
            </li>
            <li>
              <b>Cleanup:</b> all the pick data is deleted three days after reveal.
            </li>
          </ul>

          <h2 style={{ fontSize: 30, marginTop: 56, marginBottom: 8 }}>
            Don&rsquo;t take our word for it
          </h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Our entire code is open. You don&rsquo;t have to trust us — you can check.
          </p>
          <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            <li>
              <b>Read the whole thing.</b> Frontend and backend are public at{' '}
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                our repository
              </a>
              , and the version running right now is pinned in the footer.
            </li>
            <li>
              <b>Not a coder? That&rsquo;s fine.</b> Copy the code into any AI and
              ask, &ldquo;does this actually keep my picks private?&rdquo; It&rsquo;ll
              walk you through it. Honestly, we&rsquo;d rather you did.
            </li>
            <li>
              <b>Watch it live.</b> Open your browser&rsquo;s network tab while you
              submit. The only thing that leaves your phone is a scrambled code —
              no name, no roll number, nothing readable.
            </li>
            <li>
              <b>The one honest caveat.</b> On reveal night we can see that some
              anonymous codes matched, and roughly how many. We can never tell whose
              they are, who matched with whom, or that any particular person matched.
              And if you do go to prom together, everyone finds out anyway — so
              there&rsquo;s genuinely nothing left for us to know.
            </li>
          </ul>

          <div className="panel" style={{ marginTop: 30, borderColor: 'var(--gold-deep)' }}>
            <div className="label" style={{ color: 'var(--gold)', marginBottom: 8 }}>
              a few ground rules
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }} className="muted">
              <li>You submit once. No edits, no take-backs — pick carefully.</li>
              <li>You must log in and submit to take part. No lurking.</li>
              <li>Keep your recovery password. Without it, a lost phone means lost results.</li>
              <li>This edition is first-year BTech only.</li>
            </ul>
          </div>

          <div className="center" style={{ marginTop: 40 }}>
            <Link href="/login" className="btn">
              Start your soft launch
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div className="mono" style={{ color: 'var(--gold-deep)', fontSize: 13, letterSpacing: '0.1em' }}>
        {n}
      </div>
      <h3 style={{ fontSize: 23, margin: '4px 0 8px' }}>{title}</h3>
      <p className="muted" style={{ margin: 0 }}>
        {children}
      </p>
    </div>
  );
}
