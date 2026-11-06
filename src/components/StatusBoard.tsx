'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatWhen } from '@/lib/format';
import { STATUS_META, type MemberView, type PosterStatus } from '@/lib/types';
import { Avatar } from './Avatar';
import { IconChevronLeft, IconChevronRight } from './icons';
import { useToast } from './ToastProvider';

export function StatusBoard({ members }: { members: MemberView[] }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(members);

  useEffect(() => setItems(members), [members]);

  async function move(member: MemberView, dir: -1 | 1) {
    const index = STATUS_META.findIndex((s) => s.id === member.status);
    const next = STATUS_META[index + dir];
    if (!next) return;
    const previous = items;
    setItems((list) => list.map((m) => (m.id === member.id ? { ...m, status: next.id as PosterStatus } : m)));
    try {
      const res = await fetch(`/api/members/${member.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next.id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Status gagal diubah.');
      }
      router.refresh();
    } catch (e) {
      setItems(previous);
      toast(e instanceof Error ? e.message : 'Status gagal diubah.', 'error');
    }
  }

  return (
    <>
      <div className="bar-h">
        <div>
          <h2>Alur produksi poster</h2>
          <p>Geser kartu ke tahap berikutnya setelah posternya selesai.</p>
        </div>
      </div>
      <div className="kan">
        {STATUS_META.map((col, ci) => {
          const list = items.filter((m) => m.status === col.id);
          return (
            <section className="kcol" key={col.id} aria-label={col.label}>
              <div className="kcol-h">
                <span className={col.chip}>{col.label}</span>
                <span className="num" style={{ fontSize: 13, color: '#5c5c5c' }}>
                  {list.length}
                </span>
              </div>
              {list.length === 0 && <div className="kempty">Belum ada</div>}
              {list.map((m) => (
                <div className="kcard" key={m.id}>
                  <div className="kwho">
                    <Avatar name={m.name} src={m.photoUrl} />
                    <div>
                      <b>{m.name}</b>
                      <span suppressHydrationWarning>{formatWhen(m.createdAt)}</span>
                    </div>
                  </div>
                  <div className="kacts">
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={ci === 0}
                      aria-label={ci > 0 ? `Kembalikan ${m.name} ke ${STATUS_META[ci - 1].label}` : 'Sudah di tahap pertama'}
                      onClick={() => move(m, -1)}
                    >
                      <IconChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={ci === STATUS_META.length - 1}
                      aria-label={ci < STATUS_META.length - 1 ? `Pindahkan ${m.name} ke ${STATUS_META[ci + 1].label}` : 'Sudah di tahap terakhir'}
                      onClick={() => move(m, 1)}
                    >
                      Lanjut
                      <IconChevronRight size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
