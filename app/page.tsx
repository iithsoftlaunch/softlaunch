import Link from 'next/link';
import Starfield from '@/components/starfield';
import Aura from '@/components/aura';
import Nav from '@/components/nav';
import SiteFooter from '@/components/site-footer';
import { SITE } from '@/lib/site';
import HeroStatus from '@/components/hero-status';
import HeroThree from '@/components/hero-three';
import Marquee from '@/components/marquee';
import HeartStory from '@/components/heart-story';

export default function Home() {
  return (
    <>
      <Starfield />
      <Aura variant="landing" />
      <Nav />

      <header className="hero wrap">
        <HeroThree />
        <div className="hero-inner">
          <div className="brandrow">
            <span className="seal-badge">
              {SITE.campus} · first-year BTech/BDes · {SITE.edition}
            </span>
          </div>
          <h1>
            Pick your crush. <span className="em">Find out</span> only if it&rsquo;s{' '}
            <span className="gold">mutual.</span>
          </h1>
          <p className="sub">
            Soft launch your crush. Secretly pick up to three people, and nobody
            ever learns who you liked unless they liked you back. Not even us.
          </p>
          <div className="cta-row">
            <Link href="/login" className="btn magnetic">
              Make your pick
            </Link>
            <Link href="/how-it-works" className="btn ghost magnetic">
              How it works
            </Link>
          </div>
          <p className="trust">
            <span className="dot" /> sealed in your browser <span className="dot" />{' '}
            we can&rsquo;t read them <span className="dot" /> check it yourself
          </p>
          <div className="count-wrap">
            <HeroStatus />
          </div>
        </div>
      </header>

      <Marquee />

      {/* bento feature grid */}
      <section className="sec wrap">
        <div className="sec-head" data-reveal>
          <p className="eyebrow">why it hits different</p>
          <h2>Built so nobody can out you.</h2>
        </div>
        <div className="bento">
          <div className="bento-tile wide accent" data-reveal>
            <div className="bk">the whole point</div>
            <h3>Private even from us.</h3>
            <p>
              An unreturned crush is unrecoverable by anyone — other students, the
              admin, the database. It&rsquo;s not a promise, it&rsquo;s math.
            </p>
          </div>
          <div className="bento-tile" data-reveal>
            <div className="bk">your move</div>
            <h3>1–3 picks</h3>
            <p>Ranked, secret, with a private note each.</p>
          </div>
          <div className="bento-tile tall" data-reveal>
            <div className="bk">reveal night</div>
            <div className="big">24 Sep</div>
            <p style={{ marginTop: 6 }}>12:01 am. Everyone finds out at once — matches only.</p>
          </div>
          <div className="bento-tile wide" data-reveal>
            <div className="bk">no receipts</div>
            <h3>Sealed on your phone.</h3>
            <p>Once you submit, even you can&rsquo;t reopen it. Nobody can pressure you to show your list.</p>
          </div>
          <div className="bento-tile" data-reveal>
            <div className="bk">trust nothing</div>
            <h3>Open source</h3>
            <p>Watch only a scrambled code leave your phone.</p>
          </div>
        </div>
      </section>

      <HeartStory />

      <section className="sec wrap" id="how">
        <div className="sec-head" data-reveal>
          <p className="eyebrow">how it works</p>
          <h2>Three steps. One secret.</h2>
          <p>
            No awkward asking. No public rejection. Just a quiet way to find out
            if it&rsquo;s real.
          </p>
        </div>
        <div className="steps">
          <div className="step" data-reveal>
            <span className="num">01</span>
            <svg className="ic" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="21" stroke="#EAC57D" strokeWidth="1.5" />
              <path
                d="M16 22c0-4 3.6-7 8-7s8 3 8 7c0 5-8 11-8 11s-8-6-8-11z"
                fill="#FF5E7A"
              />
            </svg>
            <h3>Pick secretly</h3>
            <p>
              Choose one to three people by roll number, ranked by who you&rsquo;d
              want most. Add a private note for each.
            </p>
          </div>
          <div className="step" data-reveal>
            <span className="num">02</span>
            <svg className="ic" viewBox="0 0 48 48" fill="none">
              <rect x="10" y="21" width="28" height="19" rx="4" stroke="#EAC57D" strokeWidth="1.5" />
              <path d="M16 21v-4a8 8 0 0 1 16 0v4" stroke="#FF5E7A" strokeWidth="1.5" />
              <circle cx="24" cy="30" r="3" fill="#EAC57D" />
            </svg>
            <h3>It gets sealed</h3>
            <p>
              Your pick is scrambled on your own phone before it leaves. Once you
              submit, even you can&rsquo;t see it again.
            </p>
          </div>
          <div className="step" data-reveal>
            <span className="num">03</span>
            <svg className="ic" viewBox="0 0 48 48" fill="none">
              <path
                d="M24 6l4.5 9.5L39 17l-7.5 7.3L33 35l-9-4.8L15 35l1.5-10.7L9 17l10.5-1.5z"
                fill="#EAC57D"
                stroke="#EAC57D"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <circle cx="24" cy="21" r="4" fill="#FF5E7A" />
            </svg>
            <h3>Reveal night</h3>
            <p>
              At 12:01 am, everyone finds out at once. A match if you both chose
              each other. Otherwise, nobody&rsquo;s the wiser.
            </p>
          </div>
        </div>
      </section>

      <section className="sec wrap" id="privacy">
        <div className="sec-head" data-reveal>
          <p className="eyebrow">the promise</p>
          <h2>
            Some secrets are meant to <span className="em">stay yours.</span>
          </h2>
          <p>
            Most sites ask you to trust them. We built this so you don&rsquo;t
            have to. An unreturned crush is something literally no one can
            uncover. It&rsquo;s not a promise, it&rsquo;s math.
          </p>
        </div>
        <div className="promises">
          <div className="promise" data-reveal>
            <div className="k">even from the admin</div>
            <p>
              If they didn&rsquo;t pick you back, <b>no one ever knows you picked
              them.</b> Not other students, not us, not the database.
            </p>
          </div>
          <div className="promise" data-reveal>
            <div className="k">no receipts</div>
            <p>
              Once you seal a pick, <b>even you can&rsquo;t reopen it.</b> So no
              one can ever pressure you to show your list.
            </p>
          </div>
          <div className="promise" data-reveal>
            <div className="k">check it yourself</div>
            <p>
              Our code is open. <b>Open your network tab</b> while you submit and
              watch only a scrambled code leave your phone.
            </p>
          </div>
        </div>
        <p className="center mono dim" style={{ marginTop: 34, fontSize: 13 }}>
          open source · encrypted end to end · deleted 3 days after reveal ·{' '}
          <Link href="/how-it-works">read the full how &amp; why →</Link>
        </p>
      </section>

      <section className="sec wrap">
        <div className="sec-head" data-reveal>
          <span className="demo-flag">example couples · for the vibe</span>
          <p className="eyebrow">it worked</p>
          <h2>The couples wall.</h2>
          <p>
            Matched and want the world to know? Both of you opt in, and you land
            here. Totally optional.
          </p>
        </div>
        <div className="wall-grid">
          <div className="pair" data-reveal>
            <span className="tag">matched</span>
            <div className="hearts">&hearts; &hearts; &hearts;</div>
            <div className="names">
              Aanya <span className="amp">&amp;</span> Vihaan
            </div>
            <div className="line">&ldquo;knew it the whole time.&rdquo;</div>
          </div>
          <div className="pair" data-reveal>
            <span className="tag">matched</span>
            <div className="hearts">&hearts; &hearts;</div>
            <div className="names">
              Meera <span className="amp">&amp;</span> Kabir
            </div>
            <div className="line">&ldquo;lab partners &rarr; prom dates.&rdquo;</div>
          </div>
          <div className="pair" data-reveal>
            <span className="tag">matched</span>
            <div className="hearts">&hearts; &hearts; &hearts; &hearts;</div>
            <div className="names">
              Riya <span className="amp">&amp;</span> Arjun
            </div>
            <div className="line">&ldquo;finally. it only took 3 semesters.&rdquo;</div>
          </div>
        </div>
        <div
          className="panel"
          style={{ marginTop: 40, maxWidth: 640, marginInline: 'auto', textAlign: 'center' }}
          data-reveal
        >
          <div className="label" style={{ color: 'var(--gold)', marginBottom: 10 }}>
            already together?
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 15.5 }}>
            Come anyway. Both of you pick each other, watch it match, and see for
            yourselves that it really works. If you&rsquo;re comfortable, opt in and
            your names land on the wall. You&rsquo;re already a couple, so why not
            make it official here too?
          </p>
        </div>

        <div className="center" style={{ marginTop: 40 }}>
          <Link href="/login" className="btn magnetic">
            Start your soft launch
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
