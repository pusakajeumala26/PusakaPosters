'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

/** Splash hanya tampil singkat: cukup untuk momen merek, tanpa menahan konten yang sudah siap. */
const SPLASH_MIN_MS = 450;
const SPLASH_FADE_MS = 200;

export function SplashScreen({ onDismiss }: { onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    const elapsed = Math.max(0, Date.now() - performance.timeOrigin);
    const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
    const start = window.setTimeout(() => setExiting(true), wait);
    const finish = window.setTimeout(onDismiss, wait + SPLASH_FADE_MS);
    return () => { clearTimeout(start); clearTimeout(finish); };
  }, [onDismiss]);
<<<<<<< Updated upstream
  return <div className={exiting ? 'splash-screen exiting' : 'splash-screen'} style={{ transitionDuration: `${exitMs}ms` }} role="status" aria-label="Memuat PusakaPosters">
    <Image src="/images/logo.svg" width={150} height={149} alt="" priority />
=======
  return <div className={exiting ? 'splash-screen exiting' : 'splash-screen'} style={{ transitionDuration: `${SPLASH_FADE_MS}ms` }} role="status" aria-label="Memuat PusakaPosters">
    <Image src="/images/logo-splash.webp" width={150} height={149} alt="" priority unoptimized />
>>>>>>> Stashed changes
  </div>;
}
