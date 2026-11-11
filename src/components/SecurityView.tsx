'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './ToastProvider';

/** Ganti password admin. Hanya dirender setelah sesi super admin terbuka. */
export function SecurityView() {
  const router = useRouter();
  const toast = useToast();
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !newPw) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPw }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Password gagal diganti.');
      setNewPw('');
      toast('Password admin diganti');
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Terjadi kesalahan.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sets">
      <section className="card security-card">
        <h3>Keamanan</h3>
        <p>Password ini membuka Galeri, Status Poster, dan Pengaturan. Mengganti password mengeluarkan admin di perangkat lain.</p>
        <form onSubmit={save}>
          <div className="field">
            <label className="lbl" htmlFor="s-npw">Password admin baru</label>
            <input id="s-npw" className="inp" type="password" autoComplete="new-password"
              placeholder="Minimal 8 karakter" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          </div>
          <button type="submit" className="btn primary" disabled={busy || newPw.length === 0}>
            {busy ? 'Menyimpan…' : 'Ganti password'}
          </button>
        </form>
      </section>
    </div>
  );
}
