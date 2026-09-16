'use client';

import { useEffect, useRef, useState } from 'react';

// Plays a green-screen video with the green keyed out in real time (canvas), so
// the subject floats on the page's aurora instead of a flat green box. Muted loop
// with a Pause control. Processing runs at a capped resolution for performance.
export default function ChromaVideo({
  src,
  maxWidth = 460,
}: {
  src: string;
  maxWidth?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true); // start muted so it autoplays

  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let raf = 0;
    let sized = false;
    v.muted = true; // guarantee autoplay
    v.play?.().catch(() => {});
    // unmute on the first interaction anywhere (browsers block auto-sound)
    const kick = () => { v.muted = false; setMuted(false); v.play?.().catch(() => {}); };
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });

    const draw = () => {
      if (v.readyState >= 2 && v.videoWidth) {
        if (!sized) {
          // cap internal resolution for cheap per-frame keying
          const cap = 512;
          const scale = Math.min(1, cap / v.videoWidth);
          c.width = Math.round(v.videoWidth * scale);
          c.height = Math.round(v.videoHeight * scale);
          sized = true;
        }
        ctx.drawImage(v, 0, 0, c.width, c.height);
        try {
          const img = ctx.getImageData(0, 0, c.width, c.height);
          const d = img.data;
          // This clip is a compilation: it starts on a flat green screen, then
          // switches to a starfield and a kaleidoscope with NO green backdrop.
          // Only key out green when the frame really is a green screen — otherwise
          // we'd shred the space/kaleidoscope scenes and the clip looks "not full".
          let greenCount = 0;
          const total = d.length / 4;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 1] - Math.max(d[i], d[i + 2]) > 42) greenCount++;
          }
          const isGreenScreen = greenCount / total > 0.25; // ≥25% strong green
          if (isGreenScreen) {
            for (let i = 0; i < d.length; i += 4) {
              const r = d[i], g = d[i + 1], b = d[i + 2];
              const excess = g - Math.max(r, b); // how "green" the pixel is
              if (excess > 42) d[i + 3] = 0;
              else if (excess > 18) d[i + 3] = Math.round((d[i + 3] * (42 - excess)) / 24);
            }
            ctx.putImageData(img, 0, 0);
          }
          // else: leave the frame untouched so the full clip plays as filmed
        } catch {}
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
  }, []);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPaused(false); }
    else { v.pause(); setPaused(true); }
  };

  return (
    <div style={{ width: '100%', maxWidth, margin: '0 auto' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9' }}>
        {/* soft glow behind the floating subject */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: '-8%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,94,122,0.28), rgba(168,121,255,0.14) 55%, transparent 72%)',
            filter: 'blur(26px)', animation: 'halo-pulse 3.6s ease-in-out infinite',
          }}
        />
        {/* hidden source video */}
        <video
          ref={videoRef}
          src={src}
          autoPlay loop playsInline muted preload="auto"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
        {/* keyed output */}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
        <button className="btn ghost" style={{ padding: '9px 20px', fontSize: 13, minWidth: 108 }} onClick={toggle}>
          {paused ? '▶  Play' : '⏸  Pause'}
        </button>
        <button
          className="btn ghost"
          style={{ padding: '9px 20px', fontSize: 13, minWidth: 108 }}
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            v.muted = !v.muted;
            setMuted(v.muted);
            v.play?.().catch(() => {});
          }}
        >
          {muted ? '🔇  Unmute' : '🔊  Mute'}
        </button>
      </div>
    </div>
  );
}
