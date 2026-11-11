'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FeedbackRowView } from '@/lib/feedback-types';
import { Avatar } from './Avatar';
import { IconAlert, IconCheck } from './icons';
import { useToast } from './ToastProvider';

const time = (iso: string) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
const STATUS = {
  QUEUED: { cls: 'chip chip-desain', label: 'Antrean' },
  SENT: { cls: 'chip chip-posting', label: 'Terkirim' },
  FAILED: { cls: 'chip chip-siap', label: 'Gagal' },
} as const;

export function FeedbackAdmin({ rows }: { rows: FeedbackRowView[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState('');

  async function resend(row: FeedbackRowView) {
    if (row.uncertain && !window.confirm('Pengiriman sebelumnya tidak pasti: portfolio mungkin sudah menerimanya. Kirim ulang bisa membuat duplikat. Lanjutkan?')) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/feedback/${row.id}/resend`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Kirim ulang gagal.');
      toast('Percobaan kirim ulang dijalankan.');
      router.refresh();
    } catch (cause) {
      toast((cause as Error).message, 'error');
    } finally {
      setBusyId('');
    }
  }

  if (!rows.length) return <div className="card"><p>Belum ada feedback masuk.</p></div>;
  return (
    <ul className="fb-list">
      {rows.map((row) => {
        const st = STATUS[row.syncStatus];
        return (
          <li className="card fb-item" key={row.id}>
            <div className="fb-head">
              <Avatar name={row.name} src={row.avatarUrl} />
              <div className="fb-who"><b>{row.name}</b><span>{row.role ?? 'Tanpa peran'} · {time(row.createdAt)}</span></div>
              <span className={st.cls}>{row.syncStatus === 'SENT' ? <IconCheck size={14} /> : row.syncStatus === 'FAILED' ? <IconAlert size={14} /> : null}&nbsp;{st.label}</span>
            </div>
            <p className="fb-stars" aria-label={`${row.rating} dari 5 bintang`}>{'★'.repeat(row.rating)}<span aria-hidden="true">{'☆'.repeat(5 - row.rating)}</span></p>
            <p className="fb-msg">{row.message}</p>
            <div className="fb-meta">
              <span>Percobaan: <b>{row.attempts}</b></span>
              {row.syncStatus === 'SENT' && row.sentAt && <span>Terkirim {time(row.sentAt)}</span>}
              {row.syncStatus === 'QUEUED' && row.nextAttemptAt && <span>Coba lagi {time(row.nextAttemptAt)}</span>}
              {row.lastErrorText && <span>Penyebab: {row.lastErrorText}</span>}
              {row.uncertain && <span>Pengiriman tidak pasti: portfolio mungkin sudah menerimanya.</span>}
            </div>
            {row.syncStatus !== 'SENT' && (
              <button type="button" className="btn ghost" onClick={() => resend(row)} disabled={busyId === row.id}>{busyId === row.id ? 'Mengirim...' : 'Kirim ulang'}</button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
