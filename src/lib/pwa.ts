'use client';

import { useCallback, useSyncExternalStore } from 'react';

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: InstallEvent | null = null;
const isStandalone = () => typeof window !== 'undefined' && (
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
);
const isIosSafari = () => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /safari/i.test(ua) && !/(crios|fxios|edgios|opios|duckduckgo|gsa)/i.test(ua);
};
let installed = isStandalone();
let iosSafari = isIosSafari();
let started = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

/** Dipanggil sekali dari root layout agar event beforeinstallprompt tidak terlewat. */
export function initPwa() {
  if (started || typeof window === 'undefined') return;
  started = true;
  installed = isStandalone();
  iosSafari = isIosSafari();
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
  const showIosHelp = useSyncExternalStore(subscribe, () => iosSafari, () => false);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    if (deferred) {
      const evt = deferred;
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      deferred = null;
      if (outcome === 'accepted') installed = true;
      emit();
      return outcome;
    }
    return showIosHelp ? 'ios' : 'manual';
  }, [showIosHelp]);

  return { canPrompt, installed: isInstalled, iosSafari: showIosHelp, canInstall: canPrompt || (showIosHelp && !isInstalled), install };
}
