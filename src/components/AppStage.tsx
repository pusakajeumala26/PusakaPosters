'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { SplashScreen } from './SplashScreen';

export function AppStage({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const dismiss = useCallback(() => setLoading(false), []);
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (!loading) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [loading]);
  return <>
    <noscript><style>{'#app-stage-content { visibility: visible !important; } .splash-screen { display: none !important; }'}</style></noscript>
    <div id="app-stage-content" aria-hidden={hydrated && loading ? true : undefined} inert={hydrated && loading ? true : undefined}>{children}</div>
    {loading && <SplashScreen onDismiss={dismiss} />}
  </>;
}
