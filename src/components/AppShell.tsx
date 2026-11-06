'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import { useDialog } from '@/lib/use-dialog';
import {
  IconBoard,
  IconClose,
  IconGallery,
  IconHome,
  IconLock,
  IconLogout,
  IconMenu,
  IconSliders,
} from './icons';
import { useToast } from './ToastProvider';

type NavItem = { href: string; label: string; Icon: ComponentType<{ size?: number }> };

const ADMIN_NAV: NavItem[] = [
  { href: '/galeri', label: 'Galeri Foto', Icon: IconGallery },
  { href: '/status', label: 'Status Poster', Icon: IconBoard },
  { href: '/pengaturan', label: 'Pengaturan', Icon: IconSliders },
];

const PAGE_META: Record<string, { title: string; sub?: string }> = {
  '/': { title: 'PusakaPosters' },
  '/galeri': { title: 'Galeri Foto', sub: 'Foto anggota untuk tim desain' },
  '/status': { title: 'Status Poster', sub: 'Pantau poster tiap anggota' },
  '/pengaturan': { title: 'Pengaturan', sub: 'Atur upload dan akses admin' },
};

const DESKTOP = '(min-width: 1024px)';

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
}

export function AppShell({ letingName, admin, children }: { letingName: string; admin: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const meta = PAGE_META[pathname] ?? PAGE_META['/'];
  const sub = pathname === '/' ? `Leting ${letingName}` : meta.sub;

  useEffect(() => setOpen(false), [pathname]);

  const drawerOpen = open && !desktop;
  const sideRef = useDialog<HTMLElement>(() => setOpen(false), drawerOpen);

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    toast('Keluar dari mode admin');
    router.refresh();
  }

  const navClass = (href: string) => (pathname === href ? 'nav is-active' : 'nav');
  const current = (href: string) => (pathname === href ? 'page' : undefined);

  return (
    <div className="shell">
      <a className="skip" href="#main">
        Lewati ke konten
      </a>

      {drawerOpen && (
        <button type="button" className="scrim d-scrim" aria-label="Tutup menu" tabIndex={-1} onClick={() => setOpen(false)} />
      )}

      <aside
        ref={sideRef}
        id="sidebar"
        tabIndex={-1}
        className={drawerOpen ? 'side open' : 'side'}
        aria-label="Navigasi utama"
        inert={!desktop && !open}
      >
        <div className="brand">
          <img className="mono" src="/brand/logo-mark-light.webp" alt="" width={44} height={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>PusakaPosters</b>
            <span>Leting {letingName}</span>
          </div>
          <button type="button" className="icon-btn side-close" aria-label="Tutup menu" onClick={() => setOpen(false)}>
            <IconClose />
          </button>
        </div>

        <nav className="nav-group" aria-label="Umum">
          <div className="nav-cap">Umum</div>
          <Link href="/" className={navClass('/')} aria-current={current('/')}>
            <IconHome />
            Beranda
          </Link>
        </nav>

        <nav className="nav-group" aria-label="Admin">
          <div className="nav-cap">Admin</div>
          {ADMIN_NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={navClass(href)} aria-current={current(href)}>
              <Icon />
              {label}
              {!admin && (
                <span className="lk" role="img" aria-label="Terkunci">
                  <IconLock size={16} />
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="side-foot">
          {admin ? (
            <>
              <div className="adm">
                <span className="dot" aria-hidden="true" />
                Mode admin aktif
              </div>
              <button type="button" className="btn ghost block" onClick={logout}>
                <IconLogout size={18} />
                Keluar admin
              </button>
            </>
          ) : (
            <Link href="/status" className="btn ghost block">
              <IconLock size={18} />
              Masuk sebagai admin
            </Link>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <img className="mono top-mono" src="/brand/logo-mark-light.webp" alt="" width={44} height={44} />
          <div className="top-t">
            <h1>{meta.title}</h1>
            {sub && <p>{sub}</p>}
          </div>
          {admin && (
            <span className="badge">
              <span className="dot" aria-hidden="true" />
              Admin
            </span>
          )}
          <button
            type="button"
            className="icon-btn burger"
            aria-label="Buka menu"
            aria-expanded={drawerOpen}
            aria-controls="sidebar"
            onClick={() => setOpen(true)}
          >
            <IconMenu />
          </button>
        </header>
        <main id="main" className="content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
