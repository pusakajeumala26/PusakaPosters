'use client';

import { useEffect, useState } from 'react';

export type PresencePhase = 'closed' | 'opening' | 'open' | 'closing';

/** Keep a closing panel mounted briefly so CSS can animate it out. */
export function usePresence(open: boolean, duration = 260) {
  const [present, setPresent] = useState(open);
  const [phase, setPhase] = useState<PresencePhase>(open ? 'open' : 'closed');

  useEffect(() => {
    if (open) {
      setPresent(true);
      setPhase('opening');
      const frame = window.requestAnimationFrame(() => setPhase('open'));
      return () => window.cancelAnimationFrame(frame);
    }

    if (!present) {
      setPhase('closed');
      return;
    }

    setPhase('closing');
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : duration;
    const timer = window.setTimeout(() => {
      setPresent(false);
      setPhase('closed');
    }, delay);
    return () => window.clearTimeout(timer);
  }, [open, present, duration]);

  return { present, phase };
}
