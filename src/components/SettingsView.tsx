'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type FormEvent } from 'react';
import type { MemberView, SettingsView as SettingsData } from '@/lib/types';
import { downloadPhotosZip } from '@/lib/zip-client';
import { DatePicker } from './DatePicker';
import { useToast } from './ToastProvider';
import { IconLock } from './icons';
import { PortfolioConnectionCard } from './PortfolioConnectionCard';
import type { PortfolioStatus } from '@/lib/feedback-types';

async function patch(url: string, body: unknown, method = 'PATCH') {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Perubahan gagal disimpan.');
}

export function SettingsView({ settings, members, portfolio }: { settings: SettingsData; members: MemberView[]; portfolio: PortfolioStatus }) {
  const router = useRouter();
  const toast = useToast();

  const [leting, setLeting] = useState(settings.letingName);
  const [target, setTarget] = useState(String(settings.target));
  const [deadline, setDeadline] = useState(settings.deadline);
  const [newPw, setNewPw] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [superAdminPassword, setSuperAdminPassword] = useState('');
  const [securityUnlocked, setSecurityUnlocked] = useState(false);
  const [unlockPrompt, setUnlockPrompt] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();

  useEffect(() => {
    setLeting(settings.letingName);
    setTarget(String(settings.target));
    setDeadline(settings.deadline);
  }, [settings]);

  async function run(key: string, fn: () => Promise<string | void>) {
    if (busy) return;
    setBusy(key);
    try {
      const message = await fn();
      if (message) toast(message);
      startRefresh(() => router.refresh());
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Terjadi kesalahan.', 'error');
    } finally {
      setBusy(null);
    }
  }

  const saveGeneral = (e: FormEvent) => {
    e.preventDefault();
    void run('general', async () => {
      await patch('/api/admin/settings', {
        letingName: leting,
        target: Number(target),
        deadline: deadline || null,
      });
      return 'Pengaturan leting disimpan';
    });
  };

  const toggleOpen = () =>
    run('open', async () => {
      await patch('/api/admin/settings', { uploadOpen: !settings.uploadOpen });
      return settings.uploadOpen ? 'Upload ditutup' : 'Upload dibuka';
    });

  const savePassword = (e: FormEvent) => {
    e.preventDefault();
    void run('pw', async () => {
      await patch('/api/admin/password', { newPassword: newPw, superAdminPassword }, 'POST');
      setNewPw('');
      setSuperAdminPassword('');
      setSecurityUnlocked(false);
      return 'Password admin diganti';
    });
  };

  async function unlockSecurity(e: FormEvent) {
    e.preventDefault();
    if (busy || !unlockPassword) return;
    setBusy('unlock');
    setUnlockError('');
    try {
      await patch('/api/admin/super-admin/verify', { password: unlockPassword }, 'POST');
      setSuperAdminPassword(unlockPassword);
      setUnlockPassword('');
      setSecurityUnlocked(true);
      setUnlockPrompt(false);
      toast('Akses super admin dibuka');
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : 'Verifikasi super admin gagal.');
    } finally {
      setBusy(null);
    }
  }

  function lockSecurity() {
    setSecurityUnlocked(false);
    setSuperAdminPassword('');
    setNewPw('');
    setUnlockPrompt(false);
    setUnlockError('');
  }

  const exportZip = () =>
    run('zip', async () => {
      const n = await downloadPhotosZip(members);
      return `${n} file masuk ZIP`;
    });

  return (
    <div className={refreshing ? 'sets is-pending' : 'sets'} aria-busy={refreshing}>
      <form className="card" onSubmit={saveGeneral}>
        <h3>Leting</h3>
        <p>Dipakai di topbar dan tracking card.</p>
        <div className="field">
          <label className="lbl" htmlFor="s-let">
            Nama leting
          </label>
          <input id="s-let" className="inp" value={leting} onChange={(e) => setLeting(e.target.value)} maxLength={60} />
        </div>
        <div className="two">
          <div className="field">
            <label className="lbl" htmlFor="s-tg">
              Target anggota
            </label>
            <div className="number-control">
            <button type="button" className="stepper" aria-label="Kurangi target anggota" onClick={() => setTarget((n) => String(Math.max(1, Number(n || 1) - 1)))}>−</button>
            <input
              id="s-tg"
              className="inp num"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            <button type="button" className="stepper" aria-label="Tambah target anggota" onClick={() => setTarget((n) => String(Math.min(5000, Number(n || 0) + 1)))}>+</button>
            </div>
          </div>
          <div className="field">
            <label className="lbl" htmlFor="s-dl">
              Tenggat upload
            </label>
            <DatePicker id="s-dl" value={deadline} onChange={setDeadline} />
          </div>
        </div>
        <button type="submit" className="btn primary" disabled={!!busy}>
          {busy === 'general' ? 'Menyimpan…' : 'Simpan'}
        </button>
      </form>

      <section className="card">
        <h3>Upload</h3>
        <p>Atur kapan anggota boleh mengirim data.</p>
        <div className="switch-row">
          <div>
            <b id="open-l">Terima upload baru</b>
            <span>{settings.uploadOpen ? 'Anggota bisa upload sekarang.' : 'Ditutup. Tombol Upload menampilkan pemberitahuan.'}</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.uploadOpen}
            aria-labelledby="open-l"
            className={settings.uploadOpen ? 'switch on' : 'switch'}
            onClick={toggleOpen}
            disabled={!!busy}
          >
            <i />
          </button>
        </div>
        <div className="field">
          <span className="lbl">Ekspor data</span>
          <div className="two">
            <a className="btn ghost" href="/api/admin/export" download>
              Ekspor CSV
            </a>
            <button type="button" className="btn ghost" onClick={exportZip} disabled={!!busy}>
              {busy === 'zip' ? 'Menyiapkan…' : 'Semua foto (ZIP)'}
            </button>
          </div>
        </div>
      </section>

      <PortfolioConnectionCard initial={portfolio} />

      <section className="card security-card">
        <h3>Keamanan</h3>
        <p>Password ini membuka Galeri, Status Poster, dan Pengaturan. Mengganti password mengeluarkan admin di perangkat lain.</p>
        {!securityUnlocked ? (
          <div className="security-lock-card">
            <div className="security-lock-message">
              <IconLock size={24} />
              <strong>Hanya super admin yang dapat mengganti password</strong>
            </div>
            {!unlockPrompt ? (
              <button type="button" className="btn security-unlock-trigger" onClick={() => { setUnlockPrompt(true); setUnlockError(''); }}>
                Verifikasi super admin
              </button>
            ) : (
              <form className="security-unlock-form" onSubmit={unlockSecurity}>
                <label className="lbl" htmlFor="s-super-admin-pw">Password super admin</label>
                <input id="s-super-admin-pw" className="inp" type="password" autoComplete="current-password"
                  value={unlockPassword} onChange={(e) => { setUnlockPassword(e.target.value); setUnlockError(''); }} />
                {unlockError && <p className="security-error" role="alert">{unlockError}</p>}
                <div className="security-unlock-actions">
                  <button type="button" className="btn ghost" onClick={() => { setUnlockPrompt(false); setUnlockPassword(''); setUnlockError(''); }}>Batal</button>
                  <button type="submit" className="btn security-unlock-trigger" disabled={busy === 'unlock' || !unlockPassword}>
                    {busy === 'unlock' ? 'Memeriksa…' : 'Buka kunci'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="security-unlocked">
            <form onSubmit={savePassword}>
              <div className="field">
                <label className="lbl" htmlFor="s-npw">Password admin baru</label>
                <input id="s-npw" className="inp" type="password" autoComplete="new-password"
                  placeholder="Minimal 8 karakter" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              </div>
              <button type="submit" className="btn primary" disabled={!!busy || newPw.length === 0}>
                {busy === 'pw' ? 'Menyimpan…' : 'Ganti password'}
              </button>
            </form>
            <button type="button" className="btn ghost" onClick={lockSecurity} disabled={!!busy}>Kunci kembali</button>
          </div>
        )}
      </section>

    </div>
  );
}
