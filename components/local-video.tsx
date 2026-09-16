'use client';

import { useEffect, useRef, useState } from 'react';

// Plays a self-hosted video file (no YouTube). Starts muted so it always autoplays;
// for non-ambient videos it unmutes on the first tap/click and shows Pause + Mute.
// `ambient` = silent looping background (the spinning cat) with no controls.
export default function LocalVideo({
  src,
  maxWidth = 560,
  ambient = false,
  className,
}: {
  src: string;
  maxWidth?: number;
  ambient?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.play?.().catch(() => {});
    if (ambient) return;
    // unmute on the first interaction anywhere (browsers block auto-sound)
    const kick = () => {
      setMuted(false);
      v.play?.().catch(() => {});
    };
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
    return () => {
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
  }, [ambient]);

  const togglePlay = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const toggleMute = () => setMuted((m) => !m);

  const btn: React.CSSProperties = { padding: '9px 20px', fontSize: 13, minWidth: 108 };

  return (
    <div className={className} style={{ width: '100%', maxWidth, margin: '0 auto' }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: 18,
          overflow: 'hidden',
          border: '1px solid var(--line-strong)',
          boxShadow: '0 24px 70px -22px rgba(0,0,0,0.85), 0 0 46px -12px rgba(255,137,160,0.45)',
          background: '#000',
        }}
      >
        <video
          ref={ref}
          src={src}
          autoPlay
          loop
          playsInline
          muted={muted}
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
      {!ambient && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 14 }}>
          <button className="btn ghost" style={btn} onClick={togglePlay}>
            {playing ? '⏸  Pause' : '▶  Play'}
          </button>
          <button className="btn ghost" style={btn} onClick={toggleMute}>
            {muted ? '🔇  Unmute' : '🔊  Mute'}
          </button>
        </div>
      )}
    </div>
  );
}
