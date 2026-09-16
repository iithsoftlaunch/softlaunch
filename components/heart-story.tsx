'use client';

import { useEffect, useRef } from 'react';

// Apple-style scroll-pinned storytelling. A particle heart stays pinned in the
// centre of the screen while short "chapters" cross-fade around it as you scroll.
// The heart assembles when the section enters, rotates with scroll progress, and
// blooms outward on the final beat. Falls back to a calm static layout when
// WebGL is missing or the user prefers reduced motion.

const THREE_SRC = '/vendor/three.min.js';

let threePromise: Promise<any> | null = null;
function loadThree(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if ((window as any).THREE) return Promise.resolve((window as any).THREE);
  if (threePromise) return threePromise;
  threePromise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = THREE_SRC;
    s.async = true;
    s.onload = () => resolve((window as any).THREE);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return threePromise;
}

const CHAPTERS = [
  {
    k: '01 · the fear',
    h: 'Telling someone is terrifying.',
    p: 'So most people just… don’t. The crush stays a secret, and the moment quietly passes.',
  },
  {
    k: '02 · the idea',
    h: 'What if only a match could ever see it?',
    p: 'You pick, quietly. It’s sealed on your phone before it leaves. Nobody gets to peek — not even us.',
  },
  {
    k: '03 · the math',
    h: 'An unreturned crush is unrecoverable.',
    p: 'Not by other students, not the admin, not the database. It isn’t a promise — it’s cryptography.',
  },
  {
    k: '04 · the night',
    h: 'Then, all at once, it blooms.',
    p: '24 Sep, 12:01 am. Everyone finds out together — and only the mutual ones light up.',
  },
];

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export default function HeartStory() {
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const chaptersRef = useRef<Array<HTMLDivElement | null>>([]);
  const dotsRef = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    const track = trackRef.current;
    const wrap = canvasWrapRef.current;
    if (!track || !wrap) return;

    const N = CHAPTERS.length;

    // Progress → per-chapter opacity + a small rise, plus the active dot.
    // Chapter centres are spread evenly across [0,1]; neighbours cross-fade.
    const paintCaptions = (p: number) => {
      const step = 1 / (N - 1);
      let active = 0;
      let best = Infinity;
      for (let i = 0; i < N; i++) {
        const c = i * step;
        const d = Math.abs(p - c);
        const o = clamp01(1 - d / step);
        const el = chaptersRef.current[i];
        if (el) {
          el.style.opacity = String(o);
          el.style.transform = `translateY(${((1 - o) * 22).toFixed(1)}px)`;
        }
        if (d < best) { best = d; active = i; }
      }
      dotsRef.current.forEach((dot, i) => {
        if (dot) dot.className = 'story-dot' + (i === active ? ' on' : '');
      });
    };

    paintCaptions(0);

    if (reduce) {
      // static, readable fallback — show every chapter, no motion
      chaptersRef.current.forEach((el) => {
        if (el) { el.style.opacity = '1'; el.style.transform = 'none'; el.style.position = 'static'; }
      });
      return;
    }

    let disposed = false;
    let raf = 0;

    loadThree().then((THREE) => {
      if (!THREE || disposed || !wrap) return;

      const W = () => wrap.clientWidth || window.innerWidth;
      const H = () => wrap.clientHeight || window.innerHeight;

      let renderer: any;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      } catch {
        return; // no WebGL — captions still cross-fade below
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
      renderer.setSize(W(), H());
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      wrap.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, W() / H(), 0.1, 1000);
      camera.position.z = 46;

      const tex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d')!;
        const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.25, 'rgba(255,255,255,0.85)');
        grd.addColorStop(0.6, 'rgba(255,255,255,0.25)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
      })();

      const COUNT = mobile ? 2600 : 6000;
      const target = new Float32Array(COUNT * 3);
      const scatter = new Float32Array(COUNT * 3);
      const bloom = new Float32Array(COUNT * 3);
      const colors = new Float32Array(COUNT * 3);

      const cA = new THREE.Color('#FF5E7A');
      const cB = new THREE.Color('#A879FF');
      const cC = new THREE.Color('#EAC57D');
      const tmp = new THREE.Color();

      const SCALE = 0.9;
      for (let i = 0; i < COUNT; i++) {
        const t = Math.random() * Math.PI * 2;
        let x = 16 * Math.pow(Math.sin(t), 3);
        let y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        const r = Math.sqrt(Math.random());
        x *= r; y *= r;
        const thickness = 5.2 * Math.sqrt(Math.max(0, 1 - r * 0.65));
        const z = (Math.random() * 2 - 1) * thickness;
        x += (Math.random() - 0.5) * 0.6;
        y += (Math.random() - 0.5) * 0.6;
        x *= SCALE; y = (y + 2.5) * SCALE;
        const zz = z * SCALE;

        target[i * 3] = x; target[i * 3 + 1] = y; target[i * 3 + 2] = zz;

        // scattered start in a big sphere
        const a = Math.random() * Math.PI * 2;
        const b = Math.acos(Math.random() * 2 - 1);
        const rad = 55 + Math.random() * 40;
        scatter[i * 3] = rad * Math.sin(b) * Math.cos(a);
        scatter[i * 3 + 1] = rad * Math.sin(b) * Math.sin(a);
        scatter[i * 3 + 2] = rad * Math.cos(b);

        // bloom: fly outward from centre + drift up, on the final beat
        bloom[i * 3] = x * 2.7;
        bloom[i * 3 + 1] = y * 2.7 + 8;
        bloom[i * 3 + 2] = zz * 2.7;

        const ny = Math.min(1, Math.max(0, (y + 16) / 32));
        if (ny < 0.5) tmp.copy(cA).lerp(cB, ny / 0.5);
        else tmp.copy(cB).lerp(cC, (ny - 0.5) / 0.5);
        colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
      }

      const geo = new THREE.BufferGeometry();
      const posAttr = new THREE.BufferAttribute(new Float32Array(scatter), 3);
      geo.setAttribute('position', posAttr);
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        size: mobile ? 0.9 : 0.72,
        map: tex, vertexColors: true, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      });

      const points = new THREE.Points(geo, mat);
      const group = new THREE.Group();
      group.add(points);
      scene.add(group);

      const onResize = () => {
        camera.aspect = W() / H();
        camera.updateProjectionMatrix();
        renderer.setSize(W(), H());
      };
      window.addEventListener('resize', onResize);

      // assemble the heart once it enters, and only render while it's on-screen
      // (the hero has its own heart — no reason to draw two at the same time)
      let formStart: number | null = null;
      let inView = false;
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            inView = e.isIntersecting;
            if (e.isIntersecting && formStart === null) formStart = performance.now();
          }
        },
        { rootMargin: '150px 0px 150px 0px' }
      );
      io.observe(track);

      const arr = posAttr.array as Float32Array;
      let lastForm = -1, lastBloom = -1;

      function progress(): number {
        const rect = track!.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        if (total <= 0) return 0;
        return clamp01(-rect.top / total);
      }

      function frame(now: number) {
        if (!inView) { if (!disposed) raf = requestAnimationFrame(frame); return; }
        const secs = now / 1000;
        const formP = formStart === null ? 0 : clamp01((now - formStart) / 1600);
        const formE = 1 - Math.pow(1 - formP, 3);

        const p = progress();
        paintCaptions(p);

        const bloomE = smoothstep(0.78, 1, p);

        // recompute point positions only when something actually moved
        if (formP !== lastForm || bloomE !== lastBloom) {
          for (let i = 0; i < COUNT * 3; i++) {
            let v = scatter[i] + (target[i] - scatter[i]) * formE;
            if (bloomE > 0) v = v + (bloom[i] - v) * bloomE;
            arr[i] = v;
          }
          posAttr.needsUpdate = true;
          lastForm = formP; lastBloom = bloomE;
        }

        group.rotation.y = p * Math.PI * 1.4 + secs * 0.06;
        group.rotation.z = Math.sin(p * Math.PI) * 0.06;
        const breathe = 1 + Math.sin(secs * 1.2) * 0.02;
        group.scale.setScalar(breathe);
        mat.opacity = 0.95 * (1 - bloomE * 0.62);

        renderer.render(scene, camera);
        if (!disposed) raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      (wrap as any).__cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        window.removeEventListener('resize', onResize);
        geo.dispose(); mat.dispose(); tex.dispose(); renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      };
    });

    return () => {
      disposed = true;
      const c = (wrap as any).__cleanup;
      if (c) c();
    };
  }, []);

  return (
    <section className="story" aria-label="How Soft Launch works">
      <div className="story-track" ref={trackRef}>
        <div className="story-stage">
          <div className="story-canvas" ref={canvasWrapRef} aria-hidden="true" />
          <div className="story-scrim" aria-hidden="true" />

          <div className="story-caption">
            {CHAPTERS.map((c, i) => (
              <div
                key={i}
                className="story-chapter"
                ref={(el) => { chaptersRef.current[i] = el; }}
              >
                <span className="eyebrow">{c.k}</span>
                <h2>{c.h}</h2>
                <p>{c.p}</p>
              </div>
            ))}
          </div>

          <div className="story-dots" aria-hidden="true">
            {CHAPTERS.map((_, i) => (
              <span
                key={i}
                className={'story-dot' + (i === 0 ? ' on' : '')}
                ref={(el) => { dotsRef.current[i] = el; }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
