'use client';

import { useEffect, useRef, useState } from 'react';

// Background music for the couples wall: "Señorita".
// RELIABILITY: it prefers a self-hosted file we own (/music/senorita.mp3) so it can
// never be taken down or swapped to the wrong track. If that file isn't present yet
// it falls back to a YouTube stream so there's always music. Volume ~50%.
// Browsers block autoplay WITH sound, so it starts on the first tap/click anywhere.
const LOCAL_SRC = '/music/senorita.mp3';
const SONG_ID = 'Pkh8UtuejGw'; // fallback only
const VOLUME = 0.5;

let apiPromise: Promise<void> | null = null;
function loadYT(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      try { prev?.(); } catch {}
      resolve();
    };
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export default function WallMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytHostRef = useRef<HTMLDivElement>(null);
  const ytRef = useRef<any>(null);
  const modeRef = useRef<'audio' | 'yt' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [hinted, setHinted] = useState(true); // "click for magic" nudge, until first tap

  useEffect(() => {
    let cancelled = false;
    let kicked = false;

    const attachKick = () => {
      if (kicked) return;
      kicked = true;
      const kick = () => {
        setHinted(false);
        if (modeRef.current === 'audio') audioRef.current?.play().catch(() => {});
        else if (modeRef.current === 'yt') {
          try { ytRef.current?.unMute?.(); ytRef.current?.playVideo?.(); } catch {}
        }
      };
      window.addEventListener('pointerdown', kick, { once: true });
      window.addEventListener('keydown', kick, { once: true });
    };

    function startYouTube() {
      modeRef.current = 'yt';
      loadYT().then(() => {
        if (cancelled || !ytHostRef.current) return;
        const YT = (window as any).YT;
        ytRef.current = new YT.Player(ytHostRef.current, {
          width: '2',
          height: '2',
          videoId: SONG_ID,
          playerVars: { autoplay: 1, controls: 0, loop: 1, playlist: SONG_ID, playsinline: 1, modestbranding: 1, rel: 0 },
          events: {
            onReady: (e: any) => { try { e.target.setVolume(VOLUME * 100); e.target.playVideo(); } catch {} },
            onStateChange: (e: any) => {
              if (e.data === YT.PlayerState.PLAYING) setPlaying(true);
              else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) setPlaying(false);
            },
          },
        });
      });
      attachKick();
    }

    // Prefer the self-hosted file; fall back to YouTube if it isn't there.
    fetch(LOCAL_SRC, { method: 'HEAD' })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          modeRef.current = 'audio';
          const a = new Audio(LOCAL_SRC);
          a.loop = true;
          a.volume = VOLUME;
          a.preload = 'auto';
          a.addEventListener('play', () => setPlaying(true));
          a.addEventListener('pause', () => setPlaying(false));
          audioRef.current = a;
          a.play().catch(() => {}); // blocked → the kick starts it
          attachKick();
        } else {
          startYouTube();
        }
      })
      .catch(() => { if (!cancelled) startYouTube(); });

    return () => {
      cancelled = true;
      try { audioRef.current?.pause(); } catch {}
      try { ytRef.current?.destroy?.(); } catch {}
    };
  }, []);

  function toggle() {
    if (modeRef.current === 'audio') {
      const a = audioRef.current;
      if (!a) return;
      if (playing) a.pause();
      else a.play().catch(() => {});
    } else if (modeRef.current === 'yt') {
      const p = ytRef.current;
      if (!p) return;
      try {
        if (playing) p.pauseVideo();
        else { p.unMute?.(); p.playVideo(); }
      } catch {}
    }
  }

  return (
    <>
      <div
        aria-hidden="true"
        style={{ position: 'fixed', bottom: 0, left: 0, width: 2, height: 2, opacity: 0.01, pointerEvents: 'none', overflow: 'hidden' }}
      >
        <div ref={ytHostRef} />
      </div>

      {/* secret nudge — doesn't say it's music, just tempts a click (which starts it) */}
      {hinted && !playing && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 26,
            transform: 'translateX(-50%)',
            zIndex: 60,
            padding: '11px 20px',
            borderRadius: 999,
            border: '1px solid var(--gold-deep)',
            background: 'rgba(42,22,49,0.9)',
            color: 'var(--blush)',
            fontFamily: 'var(--mono)',
            fontSize: 12.5,
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
            boxShadow: '0 0 34px -6px rgba(234,197,125,0.55), 0 10px 28px -10px rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            animation: 'halo-pulse 2.6s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        >
          ✨ click once, anywhere — for a little magic ✨
        </div>
      )}

      <button
        onClick={toggle}
        aria-label={playing ? 'pause music' : 'play music'}
        style={{
          position: 'fixed',
          left: 16,
          bottom: 16,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          borderRadius: 999,
          border: '1px solid var(--line-strong)',
          background: 'rgba(42,22,49,0.86)',
          color: 'var(--blush)',
          fontFamily: 'var(--mono)',
          fontSize: 12,
          letterSpacing: '0.06em',
          cursor: 'pointer',
          boxShadow: '0 10px 28px -10px rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {playing ? '⏸' : '♫'} {playing ? 'pause' : 'Señorita'}
      </button>
    </>
  );
}
