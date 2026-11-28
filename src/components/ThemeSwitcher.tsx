'use client';

import { useEffect, useState } from 'react';

type ThemePreference = 'system' | 'light' | 'dark';

const THEME_LABEL: Record<ThemePreference, string> = {
  system: 'Sistem',
  light: 'Terang',
  dark: 'Gelap',
};

const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  root.dataset.themeMode = preference;
  root.dataset.theme = preference === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference;
  try {
    localStorage.setItem('pusaka-theme', preference);
  } catch {
    // Theme still works for this tab when storage is unavailable.
  }
}

export function ThemeSwitcher() {
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    const current = document.documentElement.dataset.themeMode;
    if (current === 'light' || current === 'dark' || current === 'system') setPreference(current);

    const syncThemeColor = () => {
      const mode = document.documentElement.dataset.themeMode;
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const dark = mode === 'dark' || (mode === 'system' && systemDark);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#f5f7fc');
    };
    syncThemeColor();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', syncThemeColor);
    const syncStoredPreference = (event: StorageEvent) => {
      if (event.key !== 'pusaka-theme') return;
      const stored = event.newValue;
      const next: ThemePreference = stored === 'light' || stored === 'dark' ? stored : 'system';
      setPreference(next);
      document.documentElement.dataset.themeMode = next;
      syncThemeColor();
    };
    window.addEventListener('storage', syncStoredPreference);
    return () => {
      media.removeEventListener('change', syncThemeColor);
      window.removeEventListener('storage', syncStoredPreference);
    };
  }, []);

  function cycleTheme() {
    const next = NEXT_THEME[preference];
    setPreference(next);
    applyTheme(next);
    const dark = document.documentElement.dataset.theme === 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#f5f7fc');
  }

  return (
    <button
      type="button"
      className="btn ghost block theme-switcher"
      onClick={cycleTheme}
      aria-label={`Tema saat ini ${THEME_LABEL[preference]}. Ganti tema.`}
      title="Ganti tema"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {preference === 'light' ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></> : preference === 'dark' ? <path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z"/> : <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></>}
      </svg>
      Tema: {THEME_LABEL[preference]}
      <span aria-hidden="true">Ganti</span>
    </button>
  );
}
