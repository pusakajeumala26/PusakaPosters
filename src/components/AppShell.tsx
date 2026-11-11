'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import { useDialog } from '@/lib/use-dialog';
import { usePresence } from '@/lib/use-presence';
import { usePwaInstall } from '@/lib/pwa';
import { ContactAdmin } from './ContactAdmin';
import { FeedbackDialog } from './FeedbackForm';
import {
  IconBoard,
  IconChat,
  IconClose,
  IconDownload,
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
  { href: '/feedback', label: 'Feedback', Icon: IconChat },
  { href: '/pengaturan', label: 'Pengaturan', Icon: IconSliders },
];

const PAGE_META: Record<string, { title: string; sub?: string }> = {
  '/': { title: 'PusakaPosters' },
  '/masukan': { title: 'Beri Feedback', sub: 'Bagikan pengalaman Anda' },
  '/feedback': { title: 'Feedback', sub: 'Masukan publik dan status pengirimannya' },
  '/galeri': { title: 'Galeri Foto', sub: 'Foto anggota untuk tim desain' },
  '/status': { title: 'Status Poster', sub: 'Pantau poster tiap anggota' },
  '/pengaturan': { title: 'Pengaturan', sub: 'Atur upload dan akses admin' },
};

const DESKTOP = '(min-width: 1024px)';
const FEEDBACK_AUTO_OPEN_MS = 3000;

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
  const { canInstall, canPrompt, installed, iosSafari, install } = usePwaInstall();
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const autoPrompted = useRef(false);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);
  const meta = PAGE_META[pathname] ?? PAGE_META['/'];
  const sub = pathname === '/' ? `Leting ${letingName}` : meta.sub;

  useEffect(() => setOpen(false), [pathname]);

  // Modal feedback terbuka sendiri ~3 detik setelah beranda dimuat (sekali per pemuatan halaman; admin tidak diganggu).
  useEffect(() => {
    if (pathname !== '/' || admin || autoPrompted.current) return;
    const timer = window.setTimeout(() => {
      if (autoPrompted.current || document.querySelector('.ov')) return;
      autoPrompted.current = true;
      setFeedbackOpen(true);
    }, FEEDBACK_AUTO_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [pathname, admin]);

  const drawerOpen = open && !desktop;
  const contactsPresence = usePresence(contactsOpen, 340);
  const iosHelpPresence = usePresence(iosHelpOpen, 340);
  const sideRef = useDialog<HTMLElement>(() => setOpen(false), drawerOpen);
  const contactsRef = useDialog<HTMLDivElement>(() => setContactsOpen(false), contactsOpen && contactsPresence.present);
  const iosHelpRef = useDialog<HTMLDivElement>(() => setIosHelpOpen(false), iosHelpOpen && iosHelpPresence.present);
  const wasInstalled = useRef(installed);

  useEffect(() => {
    if (installed && !wasInstalled.current) {
      setOpen(false);
      setIosHelpOpen(false);
      setContactsOpen(false);
      setFeedbackOpen(false);
      toast('Aplikasi berhasil dipasang');
    }
    wasInstalled.current = installed;
  }, [installed, toast]);

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    toast('Keluar dari mode admin');
    router.refresh();
  }

  async function onInstall() {
    if (iosSafari && !canPrompt) {
      setIosHelpOpen(true);
      return;
    }
    await install();
  }

  const navClass = (href: string) => (pathname === href ? 'nav is-active' : 'nav');
  const current = (href: string) => (pathname === href ? 'page' : undefined);

  return (
    <div className="shell">
      <a className="skip" href="#main">
        Lewati ke konten
      </a>

      <button type="button" className={`scrim d-scrim${drawerOpen ? ' is-open' : ''}`} aria-label="Tutup menu"
        aria-hidden={!drawerOpen} inert={!drawerOpen} tabIndex={-1} onClick={() => setOpen(false)} />

      <aside
        ref={sideRef}
        id="sidebar"
        tabIndex={-1}
        className={drawerOpen ? 'side open' : 'side'}
        aria-label="Navigasi utama"
        inert={!desktop && !open}
      >
        <div className="brand">
          <Image className="mono" src="/brand/logo-mark-light.webp" alt="" width={44} height={44} />
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
          <button type="button" className="nav nav-btn" onClick={() => { setOpen(false); setFeedbackOpen(true); }}>
            <IconChat />
            Beri Feedback
          </button>
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
          {canInstall && !installed && <button type="button" className="btn ghost block" onClick={onInstall}>
            <IconDownload size={18} />
            Instal aplikasi
          </button>}
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
          <button type="button" className="btn ghost block" onClick={() => setContactsOpen(true)}>Kontak pengurus</button>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <Image className="mono top-mono" src="/brand/logo-mark-light.webp" alt="" width={44} height={44} />
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
      {contactsPresence.present && <div className="ov contact-overlay" data-state={contactsPresence.phase} aria-hidden={!contactsOpen} inert={!contactsOpen}>
        <button type="button" className="scrim" aria-label="Tutup kontak pengurus" tabIndex={-1} onClick={() => setContactsOpen(false)} />
        <section ref={contactsRef} className="contact-dialog" role="dialog" aria-modal="true" aria-labelledby="contacts-title" tabIndex={-1}>
          <div className="contact-dialog-head"><div><h2 id="contacts-title">Kontak pengurus</h2><p>Hubungi pengurus leting melalui WhatsApp.</p></div>
            <button type="button" className="icon-btn" aria-label="Tutup" onClick={() => setContactsOpen(false)} data-autofocus><IconClose /></button></div>
          <ContactAdmin />
        </section>
      </div>}
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      {iosHelpPresence.present && typeof document !== 'undefined' && createPortal(<div className="ov install-overlay" data-state={iosHelpPresence.phase} aria-hidden={!iosHelpOpen} inert={!iosHelpOpen}>
        <button type="button" className="scrim" aria-label="Tutup petunjuk instal" tabIndex={-1} onClick={() => setIosHelpOpen(false)} />
        <section ref={iosHelpRef} className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title" tabIndex={-1}>
          <div className="contact-dialog-head"><div><h2 id="install-title">Instal PusakaPosters</h2>
            <p>Ketuk Bagikan, lalu Tambahkan ke Layar Utama.</p></div>
            <button type="button" className="icon-btn" aria-label="Tutup" onClick={() => setIosHelpOpen(false)} data-autofocus><IconClose /></button></div>
          <button type="button" className="btn primary block" onClick={() => setIosHelpOpen(false)}>Mengerti</button>
        </section>
      </div>, document.body)}
    </div>
  );
}
