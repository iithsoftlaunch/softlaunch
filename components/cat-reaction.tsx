'use client';

import { useEffect, useState } from 'react';
import { pickMeme, type MemeContext, type MemeSpec } from '@/lib/memes';

// A fleeting cat reaction to the user's OWN action. Appears for ~3 seconds then
// removes itself. It is purely local: triggered by the user's own click, shown
// only in their browser, never sent anywhere, never stored, and it never encodes
// WHAT they chose (just a generic mood). So it can't leak a choice or let anyone
// infer anyone else's. Bump `trigger` (a counter) to fire a new reaction.
export default function CatReaction({
  context,
  trigger,
}: {
  context: MemeContext;
  trigger: number;
}) {
  const [meme, setMeme] = useState<MemeSpec | null>(null);

  useEffect(() => {
    if (!trigger) return;
    const m = pickMeme(context);
    if (!m) return;
    setMeme(m);
    const ms = 2600 + Math.random() * 1400; // 2.6–4s, then vanish
    const t = setTimeout(() => setMeme(null), ms);
    return () => clearTimeout(t);
  }, [trigger, context]);

  if (!meme) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 74,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        width: 128,
        height: 128,
        borderRadius: 18,
        overflow: 'hidden',
        border: '1px solid var(--line-strong)',
        boxShadow: '0 20px 50px -18px rgba(0,0,0,0.75)',
        background: 'var(--plum-2)',
        pointerEvents: 'none',
        animation: 'catpop .3s ease',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={meme.src}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}
