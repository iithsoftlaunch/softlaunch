'use client';

import { useEffect, useState } from 'react';
import Starfield from '@/components/starfield';
import Aura from '@/components/aura';
import Nav from '@/components/nav';
import SiteFooter from '@/components/site-footer';
import { getWall, type WallPair } from '@/lib/flow';
import { currentPhase } from '@/lib/site';
import CatMeme from '@/components/cat-meme';
import WallMusic from '@/components/wall-music';

const EXAMPLES: WallPair[] = [
  { name_a: 'Aanya', line_a: 'knew it the whole time.', preline_a: null, name_b: 'Vihaan', line_b: 'took me way too long.', preline_b: null },
  { name_a: 'Meera', line_a: 'lab partners → prom dates.', preline_a: null, name_b: 'Kabir', line_b: 'best experiment yet.', preline_b: null },
  { name_a: 'Riya', line_a: 'finally. only took 3 semesters.', preline_a: null, name_b: 'Arjun', line_b: null, preline_b: 'she said yes 🥹' },
];

export default function WallPage() {
  const [pairs, setPairs] = useState<WallPair[] | null>(null);
  const revealed = currentPhase() === 'revealed';

  useEffect(() => {
    if (!revealed) return;
    getWall()
      .then(setPairs)
      .catch(() => setPairs([]));
  }, [revealed]);

  const showExamples = !revealed || (pairs !== null && pairs.length === 0);
  const list = showExamples ? EXAMPLES : pairs ?? [];

  return (
    <>
      <Starfield />
        <Aura variant="wall" />
      <Nav />
      <main className="wrap" style={{ paddingBlock: '8px 20px' }}>
        <div className="pagehead">
          {showExamples && <span className="demo-flag">example couples · for the vibe</span>}
          <p className="eyebrow">it worked</p>
          <h1>The couples wall.</h1>
          <div style={{ margin: '16px 0' }}>
            <CatMeme context="wall" size={150} />
          </div>
          <p>
            {revealed
              ? 'Matched pairs who both opted in. The rest kept it private, as promised.'
              : 'After reveal night, matched pairs who both opt in show up here. This is just a taste.'}
          </p>
          {revealed && (
            <div style={{ marginTop: 18 }}>
              <a href="/reveal" className="btn ghost" style={{ padding: '9px 20px' }}>
                &larr; back to your result
              </a>
            </div>
          )}
        </div>

        <div className="wall-grid" style={{ marginTop: 20 }}>
          {list.map((p, i) => {
            // both sides' messages; a person may have written one at seal and one
            // after the result — show both if they differ.
            const uniq = (arr: (string | null)[]) =>
              arr.map((s) => (s || '').trim()).filter((s, idx, a) => s && a.indexOf(s) === idx);
            const msgsA = uniq([p.line_a, p.preline_a]);
            const msgsB = uniq([p.line_b, p.preline_b]);
            return (
              <div className="pair" key={i}>
                <span className="tag">matched</span>
                <div className="hearts">&hearts; &hearts; &hearts;</div>
                <div className="names">
                  {p.name_a} <span className="amp">&amp;</span> {p.name_b}
                </div>
                {msgsA.length > 0 && (
                  <div className="line">
                    <b style={{ color: 'var(--gold)' }}>{p.name_a.split(' ')[0]}:</b>{' '}
                    {msgsA.map((m) => `“${m}”`).join('  ')}
                  </div>
                )}
                {msgsB.length > 0 && (
                  <div className="line">
                    <b style={{ color: 'var(--gold)' }}>{p.name_b.split(' ')[0]}:</b>{' '}
                    {msgsB.map((m) => `“${m}”`).join('  ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {revealed && pairs && pairs.length === 0 && (
          <p className="center dim" style={{ marginTop: 30, fontSize: 14 }}>
            No pairs have opted in yet. Matched? Add yourselves from your{' '}
            <a href="/reveal">results page</a>.
          </p>
        )}
      </main>
      <SiteFooter />
      <WallMusic />
    </>
  );
}
