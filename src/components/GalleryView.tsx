'use client';

import { useState } from 'react';
import { formatWhen, initials } from '@/lib/format';
import type { MemberView } from '@/lib/types';
import { downloadPhotosZip } from '@/lib/zip-client';
import { IconCheck, IconDownload } from './icons';
import { useToast } from './ToastProvider';

export function GalleryView({ members }: { members: MemberView[] }) {
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const allSelected = members.length > 0 && selected.size === members.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function download() {
    const chosen = members.filter((m) => selected.has(m.id));
    if (!chosen.length || busy) return;
    setBusy('Menyiapkan…');
    try {
      const n = await downloadPhotosZip(chosen, (done, total) => setBusy(`${done}/${total}`));
      toast(`${n} file masuk ZIP`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'ZIP gagal dibuat.', 'error');
    } finally {
      setBusy(null);
    }
  }

  if (members.length === 0) {
    return (
      <div className="empty">
        <b>Belum ada foto</b>
        <p>Foto akan muncul di sini setelah anggota upload.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bar-h">
        <div>
          <h2>Semua foto</h2>
          <p className="num" aria-live="polite">
            {selected.size ? `${selected.size} foto dipilih` : `${members.length} foto, ketuk untuk memilih`}
          </p>
        </div>
        <div className="acts">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setSelected(allSelected ? new Set() : new Set(members.map((m) => m.id)))}
          >
            {allSelected ? 'Batal pilih' : 'Pilih semua'}
          </button>
          <button type="button" className="btn primary" onClick={download} disabled={selected.size === 0 || !!busy}>
            <IconDownload size={18} />
            {busy ? `ZIP ${busy}` : 'Unduh ZIP'}
          </button>
        </div>
      </div>

      <div className="gal">
        {members.map((m) => {
          const on = selected.has(m.id);
          return (
            <button key={m.id} type="button" className={on ? 'tile on' : 'tile'} aria-pressed={on} onClick={() => toggle(m.id)}>
              <span className={m.hasCutout ? 'ph checker' : 'ph'} aria-hidden="true">
                {m.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URL dinamis dari Supabase
                  <img className="image-pending" src={m.photoUrl} alt="" loading="lazy" decoding="async" onLoad={(e) => e.currentTarget.classList.replace('image-pending', 'image-loaded')} />
                ) : (
                  initials(m.name)
                )}
              </span>
              <span className="tick" aria-hidden="true">
                <IconCheck size={14} />
              </span>
              <b>{m.name}</b>
              <span className="sub" suppressHydrationWarning>
                {m.hasCutout ? 'Tanpa latar' : 'Foto asli saja'} · {formatWhen(m.createdAt)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
