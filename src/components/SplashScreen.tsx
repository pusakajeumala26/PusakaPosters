'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export function SplashScreen({ onDismiss }: { onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);
  const [exitMs, setExitMs] = useState(240);
  useEffect(() => {
    const elapsed = Math.max(0, Date.now() - performance.timeOrigin);
    const remaining = Math.max(0, Math.min(900 - elapsed, 1600 - elapsed - 240));
    setExitMs(Math.max(0, Math.min(240, 1600 - elapsed - remaining)));
    const start = window.setTimeout(() => setExiting(true), remaining);
    const finish = window.setTimeout(onDismiss, remaining + Math.max(0, Math.min(240, 1600 - elapsed - remaining)));
    return () => { clearTimeout(start); clearTimeout(finish); };
  }, [onDismiss]);
  return <div className={exiting ? 'splash-screen exiting' : 'splash-screen'} style={{ transitionDuration: `${exitMs}ms` }} role="status" aria-label="Memuat PusakaPosters">
    <Image src="/images/logo.svg" width={150} height={149} alt="" priority />
  </div>;
}
