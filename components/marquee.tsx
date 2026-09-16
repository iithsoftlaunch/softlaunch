// A kinetic ticker band — the phrases that make the whole thing feel safe,
// scrolling by like a marquee. Duplicated once so the loop is seamless.
const PHRASES = [
  'mutual only',
  'sealed on your phone',
  'private even from us',
  'no public rejection',
  'it’s not a promise, it’s math',
  '1–3 secret picks',
  'reveal night · 24 Sep',
];

export default function Marquee() {
  // render the list twice so translateX(-50%) loops without a seam
  const loop = [...PHRASES, ...PHRASES];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {loop.map((p, i) => (
          <span key={i} className={`marquee-item${i % 2 ? ' dimmed' : ''}`}>
            {p}
            <span className="marquee-star"> ✦ </span>
          </span>
        ))}
      </div>
    </div>
  );
}
