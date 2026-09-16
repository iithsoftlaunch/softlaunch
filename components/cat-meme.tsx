'use client';

import { useEffect, useState } from 'react';
import { pickMeme, type MemeContext, type MemeSpec } from '@/lib/memes';

// PRIVACY RULE: every cat sticker shows briefly (<=5s) and then disappears, and
// once it has been shown it NEVER reappears on this device (reload, restart, or
// reopen) — a persistent "shown" flag guarantees nobody can reopen the browser
// later and infer a past choice from a lingering sticker. The only exception is
// the spinning-cat loading video, which is a separate <iframe>, not a CatMeme.
const HIDE_MS = 4500;

export default function CatMeme({
  context,
  size = 220,
  rounded = 18,
  className,
}: {
  context: MemeContext;
  size?: number;
  rounded?: number;
  className?: string;
}) {
  const [meme, setMeme] = useState<MemeSpec | null>(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const flag = `sl.seen.${context}`;
    try {
      if (localStorage.getItem(flag)) return; // already shown once — never again
    } catch {}
    const m = pickMeme(context);
    if (!m) return;
    setMeme(m);
    setVisible(true);
    try {
      localStorage.setItem(flag, '1'); // set immediately so a mid-show reload won't re-show
    } catch {}
    const t = setTimeout(() => setVisible(false), HIDE_MS);
    return () => clearTimeout(t);
  }, [context]);

  if (!visible || !meme || failed) return null;

  const boxStyle: React.CSSProperties = {
    width: size,
    maxWidth: '100%',
    aspectRatio: '1 / 1',
    borderRadius: rounded,
    overflow: 'hidden',
    margin: '0 auto',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--line)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const mediaStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  };

  return (
    <div className={className} style={boxStyle}>
      {meme.kind === 'video' ? (
        <video
          src={meme.src}
          style={mediaStyle}
          autoPlay
          loop
          muted
          playsInline
          onError={() => setFailed(true)}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meme.src}
          alt={meme.alt}
          style={mediaStyle}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
