'use client';

import { useEffect, useState } from 'react';
import { PHASES } from '@/lib/site';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function Countdown({ caption }: { caption?: string }) {
  const [t, setT] = useState<{ d: number; h: number; m: number; s: number } | null>(
    null,
  );
  const [live, setLive] = useState(false);

  useEffect(() => {
    const target = PHASES.reveal.getTime();
    const tick = () => {
      let diff = target - Date.now();
      if (diff <= 0) {
        setLive(true);
        diff = 0;
      }
      setT({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ textAlign: 'center' }}>
      <div className="count" role="timer" aria-label="Countdown to reveal night">
        <div className="unit">
          <div className="n">{t ? pad(t.d) : '--'}</div>
          <div className="l">days</div>
        </div>
        <div className="colon">:</div>
        <div className="unit">
          <div className="n">{t ? pad(t.h) : '--'}</div>
          <div className="l">hrs</div>
        </div>
        <div className="colon">:</div>
        <div className="unit">
          <div className="n">{t ? pad(t.m) : '--'}</div>
          <div className="l">min</div>
        </div>
        <div className="colon">:</div>
        <div className="unit">
          {/* key changes every second so the pop animation replays each tick */}
          <div className="n tick" key={t ? t.s : 'x'}>{t ? pad(t.s) : '--'}</div>
          <div className="l">sec</div>
        </div>
      </div>
      <div className="label" style={{ marginTop: 16 }}>
        {live
          ? "it's reveal night. open your results."
          : caption ?? 'until reveal night · 24 sep, 12:01 am'}
      </div>
    </div>
  );
}
