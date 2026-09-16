'use client';

import { useEffect, useState } from 'react';
import Countdown from '@/components/countdown';
import { currentPhase } from '@/lib/site';

// Renders the countdown normally, or a neutral teaser once results have closed.
// Client-side so the phase is evaluated live in the browser, not at build time.
export default function HeroStatus() {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    setClosed(currentPhase() === 'closed');
  }, []);

  if (closed) {
    return (
      <p className="eyebrow" style={{ fontSize: 14, letterSpacing: '0.14em' }}>
        👀 something cool is coming soon
      </p>
    );
  }
  return <Countdown />;
}
