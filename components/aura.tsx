// Aurora background: 3 big, soft, slowly drifting colour blobs that blend into a
// living gradient behind everything. Each page gets its own palette so the site
// feels varied and alive. Pure CSS, GPU-friendly, stilled by reduced-motion.

type Variant = 'landing' | 'welcome' | 'pick' | 'sealed' | 'reveal' | 'wall' | 'nomatch';

type Blob = { c: string; top: string; left: string; size: string; anim: string };

const ROSE = '#FF5E7A';
const ROSE_H = '#FF3B6B';
const GOLD = '#EAC57D';
const VIOLET = '#A879FF';
const BLUE = '#6EA8FF';

const V: Record<Variant, Blob[]> = {
  landing: [
    { c: ROSE, top: '2%', left: '18%', size: '62vmax', anim: 'blobA 22s' },
    { c: GOLD, top: '30%', left: '78%', size: '54vmax', anim: 'blobB 26s' },
    { c: VIOLET, top: '68%', left: '35%', size: '58vmax', anim: 'blobC 30s' },
  ],
  welcome: [
    { c: GOLD, top: '10%', left: '30%', size: '58vmax', anim: 'blobB 24s' },
    { c: ROSE, top: '55%', left: '72%', size: '52vmax', anim: 'blobA 28s' },
    { c: VIOLET, top: '75%', left: '20%', size: '50vmax', anim: 'blobC 32s' },
  ],
  pick: [
    { c: ROSE, top: '8%', left: '12%', size: '58vmax', anim: 'blobA 24s' },
    { c: VIOLET, top: '40%', left: '82%', size: '54vmax', anim: 'blobC 30s' },
    { c: GOLD, top: '80%', left: '40%', size: '48vmax', anim: 'blobB 27s' },
  ],
  sealed: [
    { c: ROSE, top: '4%', left: '48%', size: '60vmax', anim: 'blobA 23s' },
    { c: VIOLET, top: '52%', left: '18%', size: '54vmax', anim: 'blobC 29s' },
    { c: GOLD, top: '62%', left: '80%', size: '50vmax', anim: 'blobB 26s' },
  ],
  reveal: [
    { c: ROSE_H, top: '6%', left: '30%', size: '62vmax', anim: 'blobA 20s' },
    { c: VIOLET, top: '48%', left: '76%', size: '58vmax', anim: 'blobC 26s' },
    { c: GOLD, top: '78%', left: '22%', size: '50vmax', anim: 'blobB 24s' },
  ],
  wall: [
    { c: GOLD, top: '4%', left: '24%', size: '60vmax', anim: 'blobB 22s' },
    { c: ROSE, top: '46%', left: '80%', size: '56vmax', anim: 'blobA 27s' },
    { c: VIOLET, top: '74%', left: '38%', size: '52vmax', anim: 'blobC 31s' },
  ],
  nomatch: [
    { c: BLUE, top: '8%', left: '28%', size: '60vmax', anim: 'blobC 26s' },
    { c: VIOLET, top: '50%', left: '74%', size: '54vmax', anim: 'blobA 30s' },
    { c: '#9B7A8E', top: '76%', left: '30%', size: '48vmax', anim: 'blobB 28s' },
  ],
};

export default function Aura({ variant }: { variant: Variant }) {
  return (
    <div className="aura-wrap" aria-hidden="true">
      {V[variant].map((b, i) => (
        <div
          key={i}
          className="aura-blob"
          style={{
            top: b.top,
            left: b.left,
            width: b.size,
            height: b.size,
            background: `radial-gradient(circle at 50% 50%, ${b.c}, transparent 68%)`,
            animation: `${b.anim} ease-in-out infinite`,
            animationDelay: `${i * -6}s`,
          }}
        />
      ))}
    </div>
  );
}
