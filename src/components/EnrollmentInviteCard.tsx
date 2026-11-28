'use client';

import { useState } from 'react';
import { useToast } from './ToastProvider';

export function EnrollmentInviteCard() {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);

  async function createInvite() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/admin/invites', { method: 'POST' });
      const result = await response.json() as { error?: string; code?: string; expiresAt?: string };
      if (!response.ok || !result.code || !result.expiresAt) throw new Error(result.error ?? 'Kode undangan gagal dibuat.');
      setCode(result.code);
      setExpiresAt(result.expiresAt);
      toast('Kode undangan dibuat. Kode hanya ditampilkan di perangkat ini.');
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Kode undangan gagal dibuat.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      toast('Kode undangan disalin');
    } catch {
      toast('Salin kode secara manual.', 'error');
    }
  }

  return <section className="card invite-card">
    <div className="invite-heading"><span className="invite-icon">+</span><div><h3>Undangan anggota</h3><p>Setiap kode hanya bisa dipakai sekali dan berlaku 7 hari.</p></div></div>
    {code ? <div className="invite-result" role="status">
      <span className="profile-eyebrow">KODE SEKALI PAKAI</span>
      <code>{code}</code>
      <span className="access-hint">Berlaku sampai {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(expiresAt))} WIB. Bagikan secara pribadi kepada anggota.</span>
      <div className="invite-actions"><button type="button" className="btn" onClick={copyCode}>Salin kode</button><button type="button" className="btn ghost" onClick={() => { setCode(''); setExpiresAt(''); }}>Sembunyikan</button></div>
    </div> : <button type="button" className="btn primary" onClick={createInvite} disabled={busy}>{busy ? 'Membuat kode…' : 'Buat kode undangan'}</button>}
  </section>;
}

