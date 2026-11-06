'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { usePwaInstall } from '@/lib/pwa';
import type { MemberView, SettingsView as SettingsData } from '@/lib/types';
import { downloadPhotosZip } from '@/lib/zip-client';
import { DatePicker } from './DatePicker';
import { useToast } from './ToastProvider';

async function patch(url: string, body: unknown, method = 'PATCH') {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Perubahan gagal disimpan.');
}

export function SettingsView({ settings, members }: { settings: SettingsData; members: MemberView[] }) {
  const router = useRouter();
  const toast = useToast();
  const { canPrompt, installed, install } = usePwaInstall();

  const [leting, setLeting] = useState(settings.letingName);
  const [target, setTarget] = useState(String(settings.target));
  const [deadline, setDeadline] = useState(settings.deadline);
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  useEffect(() => {
    setLeting(settings.letingName);
    setTarget(String(settings.target));
    setDeadline(settings.deadline);
  }, [settings]);

  useEffect(() => {
    setOfflineReady(!!navigator.serviceWorker?.controller);
  }, []);

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
      await patch('/api/admin/password', { newPassword: newPw }, 'POST');
      setNewPw('');
      return 'Password admin diganti';
    });
  };

  const exportZip = () =>
    run('zip', async () => {
      const n = await downloadPhotosZip(members);
      return `${n} file masuk ZIP`;
    });

  async function onInstall() {
    const outcome = await install();
    if (outcome === 'accepted') toast('Aplikasi dipasang');
    else if (outcome === 'ios') toast('Di iPhone: buka menu Bagikan, lalu pilih Tambah ke Layar Utama.');
    else if (outcome === 'manual') toast('Buka menu browser, lalu pilih Instal aplikasi.');
  }

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

      <form className="card" onSubmit={savePassword}>
        <h3>Keamanan</h3>
        <p>Password ini membuka Galeri, Status Poster, dan Pengaturan. Mengganti password mengeluarkan admin di perangkat lain.</p>
        <div className="field">
          <label className="lbl" htmlFor="s-npw">
            Password admin baru
          </label>
          <input
            id="s-npw"
            className="inp"
            type="password"
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
        </div>
        <button type="submit" className="btn" disabled={!!busy || newPw.length === 0}>
          {busy === 'pw' ? 'Menyimpan…' : 'Ganti password'}
        </button>
      </form>

      <section className="card">
        <h3>Aplikasi</h3>
        <p>Pasang PusakaPosters di layar utama agar terbuka seperti aplikasi biasa.</p>
        <div className="switch-row">
          <div>
            <b>Mode offline</b>
            <span>Tampilan aplikasi tetap terbuka tanpa sinyal. Upload dan data butuh internet.</span>
          </div>
          <span className={offlineReady ? 'chip chip-posting' : 'chip'}>{offlineReady ? 'Aktif' : 'Belum aktif'}</span>
        </div>
        {installed ? (
          <span className="chip chip-posting" style={{ alignSelf: 'flex-start' }}>
            Sudah terpasang
          </span>
        ) : (
          <button type="button" className="btn primary" onClick={onInstall}>
            {canPrompt ? 'Instal aplikasi' : 'Cara instal aplikasi'}
          </button>
        )}
      </section>
    </div>
  );
}
