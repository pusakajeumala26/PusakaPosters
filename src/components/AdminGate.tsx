'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { IconAlert, IconLock } from './icons';
import { useToast } from './ToastProvider';
import { ContactAdmin } from './ContactAdmin';

export function AdminGate({ pageName }: { pageName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showContacts, setShowContacts] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Gagal masuk. Coba lagi.');
        return;
      }
      toast('Mode admin aktif');
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
      <h2>Halaman khusus admin</h2>
      <p>{pageName} hanya bisa dibuka panitia. Masukkan password admin.</p>
      <form onSubmit={submit} noValidate>
        <div className={error ? 'field has-err' : 'field'}>
          <label className="lbl" htmlFor="gate-pw">
            Password admin
          </label>
          <input
            id="gate-pw"
            className="inp"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            aria-invalid={!!error}
            aria-describedby={error ? 'gate-err' : undefined}
          />
          {error && (
            <div className="err" id="gate-err" role="alert">
              <IconAlert size={16} />
              {error}
            </div>
          )}
        </div>
        <button type="submit" className="btn primary block" disabled={busy || !password}>
          {busy ? 'Memeriksa…' : 'Buka halaman'}
        </button>
      </form>
      <p className="contact-hint">Lupa password admin? <button type="button" className="text-btn" aria-expanded={showContacts}
        onClick={() => setShowContacts((v) => !v)}>Hubungi pengurus</button></p>
      {showContacts && <ContactAdmin compact />}
    </div>
  );
}
