'use client';

import { useEffect, useRef } from 'react';

// The hero centrepiece: a 3D heart made of thousands of glowing particles that
// fly in and assemble on load, breathe, slowly rotate, and lean toward the
// cursor. Three.js loaded from CDN. Fails silently (WebGL missing) and stills
// under reduced-motion; particle count drops on mobile.

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

export default function HeroThree() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    const mount = mountRef.current;
    if (!mount) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.matchMedia('(max-width: 760px)').matches;

    loadThree().then((THREE) => {
      if (!THREE || disposed || !mount) return;

      const W = () => mount.clientWidth || window.innerWidth;
      const H = () => mount.clientHeight || 600;

      let renderer: any;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      } catch {
        return; // no WebGL — leave the hero as-is
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
      renderer.setSize(W(), H());
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, W() / H(), 0.1, 1000);
      camera.position.z = 42;

      // ---- soft round glow sprite for each particle ----
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
        const t = new THREE.CanvasTexture(c);
        return t;
      })();

      // ---- build the heart point cloud ----
      const COUNT = mobile ? 3000 : 8000;
      const target = new Float32Array(COUNT * 3);
      const scatter = new Float32Array(COUNT * 3);
      const colors = new Float32Array(COUNT * 3);

      const cA = new THREE.Color('#FF5E7A'); // rose (bottom)
      const cB = new THREE.Color('#A879FF'); // violet (mid)
      const cC = new THREE.Color('#EAC57D'); // gold (top)
      const tmp = new THREE.Color();

      const SCALE = 0.92;
      for (let i = 0; i < COUNT; i++) {
        const t = Math.random() * Math.PI * 2;
        // classic heart curve
        let x = 16 * Math.pow(Math.sin(t), 3);
        let y =
          13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        // fill the interior (sqrt for even density) + puff into 3D
        const r = Math.sqrt(Math.random());
        x *= r; y *= r;
        const thickness = 5.2 * Math.sqrt(Math.max(0, 1 - r * 0.65));
        const z = (Math.random() * 2 - 1) * thickness;
        // tiny sparkle jitter
        x += (Math.random() - 0.5) * 0.6;
        y += (Math.random() - 0.5) * 0.6;

        x *= SCALE; y = (y + 2.5) * SCALE; // centre vertically

        target[i * 3] = x;
        target[i * 3 + 1] = y;
        target[i * 3 + 2] = z * SCALE;

        // start scattered in a big sphere
        const a = Math.random() * Math.PI * 2;
        const b = Math.acos(Math.random() * 2 - 1);
        const rad = 55 + Math.random() * 35;
        scatter[i * 3] = rad * Math.sin(b) * Math.cos(a);
        scatter[i * 3 + 1] = rad * Math.sin(b) * Math.sin(a);
        scatter[i * 3 + 2] = rad * Math.cos(b);

        // colour by height (rose → violet → gold)
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
        size: mobile ? 0.85 : 0.7,
        map: tex,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(geo, mat);
      const group = new THREE.Group();
      group.add(points);
      scene.add(group);

      // ---- interaction + animation ----
      const mouse = { x: 0, y: 0 };
      const onMouse = (e: MouseEvent) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
      };
      if (!reduce) window.addEventListener('mousemove', onMouse);

      const onResize = () => {
        camera.aspect = W() / H();
        camera.updateProjectionMatrix();
        renderer.setSize(W(), H());
      };
      window.addEventListener('resize', onResize);

      const arr = posAttr.array as Float32Array;
      const start = performance.now();
      const FORM_MS = 1800;
      let rx = 0, ry = 0;

      function frame(now: number) {
        const t = (now - start) / 1000;
        const p = Math.min(1, (now - start) / FORM_MS);
        // easeOutCubic for the assembly
        const e = 1 - Math.pow(1 - p, 3);

        if (p < 1) {
          for (let i = 0; i < COUNT * 3; i++) {
            arr[i] = scatter[i] + (target[i] - scatter[i]) * e;
          }
          posAttr.needsUpdate = true;
        } else if (!reduce) {
          // gentle living breathing after it forms
          const s = 1 + Math.sin(t * 1.4) * 0.03;
          group.scale.set(s, s, s);
        }

        if (!reduce) {
          group.rotation.y += 0.0016;
          // lean toward the cursor
          ry += (mouse.x * 0.5 - ry) * 0.04;
          rx += (mouse.y * 0.3 - rx) * 0.04;
          group.rotation.z = ry * 0.15;
          camera.position.x += (ry * 6 - camera.position.x) * 0.05;
          camera.position.y += (-rx * 6 - camera.position.y) * 0.05;
          camera.lookAt(0, 0, 0);
        }

        renderer.render(scene, camera);
        if (!disposed) raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      // store cleanup on the mount for the outer return
      (mount as any).__cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('mousemove', onMouse);
        window.removeEventListener('resize', onResize);
        geo.dispose(); mat.dispose(); tex.dispose(); renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      };
    });

    return () => {
      disposed = true;
      const c = (mount as any).__cleanup;
      if (c) c();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
