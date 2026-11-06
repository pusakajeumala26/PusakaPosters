'use client';

import { useCallback, useSyncExternalStore } from 'react';

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: InstallEvent | null = null;
let installed = false;
let started = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

/** Dipanggil sekali dari root layout agar event beforeinstallprompt tidak terlewat. */
export function initPwa() {
  if (started || typeof window === 'undefined') return;
  started = true;
  installed =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
  emit();
}

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};

export type InstallOutcome = 'accepted' | 'dismissed' | 'ios' | 'manual';

export function usePwaInstall() {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const isInstalled = useSyncExternalStore(subscribe, () => installed, () => false);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    if (deferred) {
      const evt = deferred;
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      deferred = null;
      emit();
      return outcome;
    }
    const ua = navigator.userAgent;
    return /iphone|ipad|ipod/i.test(ua) ? 'ios' : 'manual';
  }, []);

  return { canPrompt, installed: isInstalled, install };
}
