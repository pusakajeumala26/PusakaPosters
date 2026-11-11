'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import type { PortfolioStatus } from '@/lib/feedback-types';
import { IconAlert, IconCheck } from './icons';
import { useToast } from './ToastProvider';

const time = (iso: string) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });

async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Permintaan gagal. Coba lagi.');
  return data;
}

/** Pengaturan koneksi MCP portfolio. API key hanya dikirim ke server dan tidak pernah ditampilkan kembali. */
export function PortfolioConnectionCard({ initial }: { initial: PortfolioStatus }) {
  const toast = useToast();
  const [status, setStatus] = useState(initial);
  const [url, setUrl] = useState(initial.url);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<'save' | 'switch' | 'test' | 'clear' | null>(null);
  const [error, setError] = useState('');

  async function patch(body: Record<string, unknown>, kind: 'save' | 'switch' | 'clear') {
    setBusy(kind);
    setError('');
    try {
      const next = await call<PortfolioStatus>('/api/admin/portfolio', 'PATCH', body);
      setStatus(next);
      setUrl(next.url);
      setKey('');
      return next;
    } catch (cause) {
      setError((cause as Error).message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const body: Record<string, unknown> = {};
    if (url.trim() !== status.url) body.url = url;
    if (key.trim()) body.apiKey = key;
    if (!Object.keys(body).length) { toast('Tidak ada perubahan.'); return; }
    if (await patch(body, 'save')) toast('Koneksi disimpan.');
  }

  async function toggle() {
    const next = await patch({ connected: !status.connected }, 'switch');
    if (next) toast(next.connected ? 'Portfolio disambungkan.' : 'Portfolio diputuskan. Feedback baru ditahan di antrean.');
  }

  async function test() {
    setBusy('test');
    setError('');
    try {
      const out = await call<{ result: { ok: boolean; note: string }; status: PortfolioStatus }>('/api/admin/portfolio/test', 'POST');
      setStatus(out.status);
      toast(out.result.ok ? 'Koneksi berhasil.' : 'Koneksi gagal. Lihat keterangan di bawah.', out.result.ok ? 'ok' : 'error');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const last = status.lastTest;
  const ready = Boolean(status.url && status.hasKey);
  return (
    <section className="card" aria-labelledby="pf-title">
      <h3 id="pf-title">Koneksi portfolio (MCP)</h3>
      <p>Feedback publik diteruskan ke portfolio lewat MCP. Pengaturan ini disimpan di database, bukan di environment.</p>

      <form className="pf-form" onSubmit={save} noValidate>
        <div className="field">
          <label className="lbl" htmlFor="pf-url">URL MCP</label>
          <input className="inp" id="pf-url" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://contoh.vercel.app/api/mcp" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="pf-key">API key</label>
          <input className="inp" id="pf-key" type="password" autoComplete="new-password" spellCheck={false} aria-describedby="pf-key-h" value={key} onChange={(e) => setKey(e.target.value)}
            placeholder={status.hasKey ? `Tersimpan (berakhir ${status.keyHint ?? '****'}). Isi untuk mengganti.` : 'Tempel API key'} />
          <span className="feedback-count" id="pf-key-h" style={{ textAlign: 'left' }}>
            {status.hasKey ? `Tersimpan terenkripsi: ${'•'.repeat(8)}${status.keyHint ?? ''}. Key tidak pernah ditampilkan lagi.` : 'Disimpan terenkripsi di server.'}
          </span>
        </div>
        {status.keyUnreadable && <div className="feedback-error" role="alert">API key tersimpan tidak bisa dibaca (SESSION_SECRET berubah). Masukkan key lagi.</div>}
        {error && <div className="feedback-error" role="alert">{error}</div>}
        <div className="two">
          <button type="submit" className="btn" disabled={busy !== null}>{busy === 'save' ? 'Menyimpan...' : 'Simpan'}</button>
          <button type="button" className="btn ghost" onClick={test} disabled={busy !== null || !ready}>{busy === 'test' ? 'Menguji...' : 'Tes koneksi'}</button>
        </div>
        {status.hasKey && <button type="button" className="btn ghost" onClick={() => patch({ clearKey: true }, 'clear').then((n) => n && toast('API key dihapus.'))} disabled={busy !== null}>Hapus key</button>}
      </form>

      <div className="switch-row">
        <div>
          <b id="pf-sw-l">{status.connected ? 'Tersambung' : 'Terputus'}</b>
          <span>{status.connected ? 'Feedback baru dikirim ke portfolio.' : 'Feedback baru disimpan dan menunggu di antrean, tidak dikirim.'}</span>
        </div>
        <button type="button" role="switch" aria-checked={status.connected} aria-labelledby="pf-sw-l" className={status.connected ? 'switch on' : 'switch'}
          onClick={toggle} disabled={busy !== null || (!status.connected && !ready)}><i /></button>
      </div>

      <div className="pf-status" role="status" aria-live="polite">
        <b>Status terakhir</b>
        {last ? (
          <>
            <span className={last.ok ? 'chip chip-posting' : 'chip chip-desain'}>{last.ok ? <IconCheck size={14} /> : <IconAlert size={14} />}&nbsp;{last.ok ? 'Berhasil' : 'Gagal'}</span>
            <span>{time(last.at)}{last.ms != null ? ` · ${last.ms} ms` : ''}</span>
            {last.note && <span>{last.note}</span>}
          </>
        ) : <span>Belum pernah diuji.</span>}
      </div>

      <div className="switch-row">
        <div>
          <b>Antrean feedback</b>
          <span>{status.queue.queued} menunggu · {status.queue.failed} gagal · {status.queue.sent} terkirim</span>
        </div>
        <Link className="btn ghost" href="/feedback">Lihat daftar</Link>
      </div>
    </section>
  );
}
