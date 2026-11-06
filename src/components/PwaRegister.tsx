'use client';

import { useEffect } from 'react';
import { initPwa } from '@/lib/pwa';

/** Daftarkan service worker (hanya production) dan tangkap event instal PWA. */
export function PwaRegister() {
  useEffect(() => {
    initPwa();
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => console.warn('[sw] gagal daftar:', e));
    }
  }, []);
  return null;
}
