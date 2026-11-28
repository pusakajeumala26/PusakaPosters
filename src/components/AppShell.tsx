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
import { ThemeSwitcher } from './ThemeSwitcher';
import {
  IconBoard,
  IconChat,
  IconClose,
  IconDownload,
  IconGallery,
  IconHome,
  IconImage,
  IconLock,
  IconLogout,
  IconMcp,
  IconMenu,
  IconShieldLock,
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

const SUPER_NAV: NavItem[] = [
  { href: '/super-admin/mcp', label: 'MCP Server', Icon: IconMcp },
  { href: '/super-admin/security', label: 'Security', Icon: IconShieldLock },
];

const PAGE_META: Record<string, { title: string; sub?: string }> = {
  '/': { title: 'Beranda', sub: 'Ruang pribadi Pusaka Jeumala' },
  '/aktivitas': { title: 'Aktivitas', sub: 'Perkembangan poster Anda' },
  '/profil': { title: 'Profil Saya', sub: 'Data pribadi dan foto profil' },
  '/masukan': { title: 'Beri Feedback', sub: 'Bagikan pengalaman Anda' },
  '/feedback': { title: 'Feedback', sub: 'Masukan publik dan status pengirimannya' },
  '/galeri': { title: 'Galeri Foto', sub: 'Foto anggota untuk tim desain' },
  '/status': { title: 'Status Poster', sub: 'Pantau poster tiap anggota' },
  '/pengaturan': { title: 'Pengaturan', sub: 'Atur upload dan data leting' },
  '/super-admin/mcp': { title: 'MCP Server', sub: 'Koneksi portfolio untuk feedback' },
  '/super-admin/security': { title: 'Security', sub: 'Password admin' },
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

export function AppShell({ letingName, admin, superAdmin, member, children }: { letingName: string; admin: boolean; superAdmin: boolean; member: { name: string } | null; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { canInstall, canPrompt, installed, iosSafari, install } = usePwaInstall();
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);
  const meta = PAGE_META[pathname] ?? PAGE_META['/'];
  const sub = pathname === '/' && !member && !admin ? 'Masuk atau buat akun anggota' : pathname === '/' && !member ? `Leting ${letingName}` : meta.sub;

  useEffect(() => setOpen(false), [pathname]);

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

  async function lockSuper() {
    await fetch('/api/admin/super-admin/logout', { method: 'POST' });
    toast('Super admin dikunci');
    router.refresh();
  }

  async function memberLogout() {
    try {
      const response = await fetch('/api/member-auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Sesi belum bisa ditutup. Coba lagi saat koneksi stabil.');
      router.replace('/');
      router.refresh();
      toast('Kamu sudah keluar dari akun');
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Tidak dapat keluar dari akun.', 'error');
    }
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
    <div className={member && !admin ? 'shell member-shell' : !admin ? 'shell guest-shell' : 'shell'}>
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
            <span>{member && !admin ? `Halo, ${member.name.split(' ')[0]}` : `Leting ${letingName}`}</span>
          </div>
          <button type="button" className="icon-btn side-close" aria-label="Tutup menu" onClick={() => setOpen(false)}>
            <IconClose />
          </button>
        </div>

        <nav className="nav-group" aria-label="Umum">
          <div className="nav-cap">Umum</div>
          <Link href="/" className={navClass('/')} aria-current={current('/')}><IconHome/>Beranda</Link>
          {member && !admin && <><Link href="/aktivitas" className={navClass('/aktivitas')} aria-current={current('/aktivitas')}><IconBoard/>Aktivitas</Link><Link href="/profil" className={navClass('/profil')} aria-current={current('/profil')}><IconImage/>Profil Saya</Link></>}
          <button type="button" className="nav nav-btn" onClick={() => { setOpen(false); setFeedbackOpen(true); }}>
            <IconChat />
            Beri Feedback
          </button>
        </nav>

        {(admin || !member) && <nav className="nav-group" aria-label="Admin">
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
        </nav>}

        {(superAdmin || !member) && <nav className="nav-group" aria-label="Super Admin">
          <div className="nav-cap">Super Admin</div>
          {SUPER_NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={navClass(href)} aria-current={current(href)}>
              <Icon />
              {label}
              {!superAdmin && (
                <span className="lk" role="img" aria-label="Terkunci">
                  <IconLock size={16} />
                </span>
              )}
            </Link>
          ))}
        </nav>}

        <div className="side-foot">
          <ThemeSwitcher />
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
          ) : member ? (
            <>
              <div className="adm"><span className="dot" aria-hidden="true" />Akun anggota aktif</div>
              <button type="button" className="btn ghost block" onClick={memberLogout}><IconLogout size={18} />Keluar dari akun</button>
            </>
          ) : (
            <Link href="/status" className="btn ghost block">
              <IconLock size={18} />
              Masuk sebagai admin
            </Link>
          )}
          {superAdmin && (
            <>
              <div className="adm">
                <span className="dot" aria-hidden="true" />
                Super admin terbuka
              </div>
              <button type="button" className="btn ghost block" onClick={lockSuper}>
                <IconLock size={18} />
                Kunci super admin
              </button>
            </>
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
      {member && !admin && <nav className="member-bottom-nav" aria-label="Navigasi anggota">
        <Link href="/" aria-current={current('/')}><IconHome/><span>Beranda</span></Link>
        <Link href="/aktivitas" aria-current={current('/aktivitas')}><IconBoard/><span>Aktivitas</span></Link>
        <Link href="/profil?edit=1" className="member-fab" aria-label="Edit foto dan profil"><IconImage/></Link>
        <Link href="/profil" aria-current={current('/profil')}><IconImage/><span>Profil</span></Link>
        <button type="button" onClick={() => setFeedbackOpen(true)}><IconChat/><span>Feedback</span></button>
      </nav>}
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
