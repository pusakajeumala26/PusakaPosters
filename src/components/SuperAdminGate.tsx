'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { IconAlert, IconLock } from './icons';
import { useToast } from './ToastProvider';

/** Gerbang password super admin (terpisah dari password admin biasa). */
export function SuperAdminGate({ pageName }: { pageName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/super-admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Gagal membuka. Coba lagi.');
        return;
      }
      toast('Super admin terbuka');
      router.refresh();
    } catch {
      setError('Tidak bisa terhubung ke server. Periksa koneksi internetmu.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <div className="ic">
        <IconLock size={24} />
      </div>
      <h2>Halaman super admin</h2>
      <p>{pageName} hanya bisa dibuka super admin. Masukkan password super admin, yang berbeda dari password admin.</p>
      <form onSubmit={submit} noValidate>
        <div className={error ? 'field has-err' : 'field'}>
          <label className="lbl" htmlFor="sgate-pw">
            Password super admin
          </label>
          <input
            id="sgate-pw"
            className="inp"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            aria-invalid={!!error}
            aria-describedby={error ? 'sgate-err' : undefined}
          />
          {error && (
            <div className="err" id="sgate-err" role="alert">
              <IconAlert size={16} />
              {error}
            </div>
          )}
        </div>
        <button type="submit" className="btn primary block" disabled={busy || !password}>
          {busy ? 'Memeriksa…' : 'Buka halaman'}
        </button>
      </form>
    </div>
  );
}
