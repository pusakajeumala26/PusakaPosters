'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { formatWhen } from '@/lib/format';
import { thumbSrc } from '@/lib/thumb';
import { GENDER_LABELS, type EditableMember, type Gender, type MemberView, type Stats } from '@/lib/types';
import { Avatar } from './Avatar';
import { IconChevronRight, IconSearch, IconSort, IconUpload } from './icons';
import { MemberSheet } from './MemberSheet';
import { useToast } from './ToastProvider';
import { UploadModal, type EditingState } from './UploadModal';
import { Select } from './Select';
import { usePresence } from '@/lib/use-presence';

type Props = {
  members: MemberView[];
  stats: Stats;
  admin: boolean;
  uploadOpen: boolean;
  autoUpload: boolean;
};

type ModalState = { open: false } | { open: true; editing: EditingState | null };

export function HomeView({ members, stats, admin, uploadOpen, autoUpload }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [gender, setGender] = useState<'all' | Gender>('all');
  const [sort, setSort] = useState<'new' | 'az'>('new');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(autoUpload ? { open: true, editing: null } : { open: false });
  const [lastEditing, setLastEditing] = useState<EditingState | null>(null);
  const modalPresence = usePresence(modal.open, 340);
  const [refreshing, startRefresh] = useTransition();

  useEffect(() => {
    if (modal.open && modal.editing) setLastEditing(modal.editing);
    else if (!modal.open && !modalPresence.present) setLastEditing(null);
  }, [modal, modalPresence.present]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = members.filter(
      (m) =>
        (gender === 'all' || m.gender === gender) &&
        (!needle || m.name.toLowerCase().includes(needle) || m.quote.toLowerCase().includes(needle)),
    );
    return sort === 'az'
      ? [...list].sort((a, b) => a.name.localeCompare(b.name, 'id'))
      : [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [members, q, gender, sort]);

  const detail = members.find((m) => m.id === detailId) ?? null;
  const maxDay = Math.max(1, ...stats.days.map((d) => d.n));
  const today = stats.days[stats.days.length - 1]?.n ?? 0;
  const chartLabel = `Upload 7 hari terakhir: ${stats.days.map((d) => `${d.label} ${d.n}`).join(', ')}`;

  function startEdit(member: MemberView, data: EditableMember, password?: string) {
    setDetailId(null);
    setModal({ open: true, editing: { member, data, password } });
  }

  function done(message: string) {
    setModal({ open: false });
    toast(message);
    startRefresh(() => router.refresh());
  }

  return (
    <>
      <section className="stats" aria-label="Ringkasan upload">
        <div className="stat dark">
          <div className="stat-cap">
            <span>Sudah upload</span>
            <span className="num">{stats.pct}%</span>
          </div>
          <div className="big num">
            {stats.count}
            <small>/ {stats.target} anggota</small>
          </div>
          <div className="prog" role="progressbar" aria-label="Progres upload" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.pct}>
            <i style={{ width: `${stats.pct}%` }} />
          </div>
          <div className="stat-foot">
            <span>Sisa {stats.left} orang</span>
            <span>Tenggat {stats.deadlineLabel}</span>
          </div>
        </div>

        <div className="stat">
          <div className="stat-cap">
            <span>Upload harian</span>
            <span className="num">7 hari</span>
          </div>
          <div className="big num">
            {today}
            <small>hari ini</small>
          </div>
          <div className="chart" role="img" aria-label={chartLabel}>
            {stats.days.map((d, i) => (
              <div className="col" key={i}>
                <div className="bw">
                  <i className={d.today ? 'bar is-today' : 'bar'} style={{ height: `${Math.max(4, Math.round((d.n / maxDay) * 100))}%` }} />
                </div>
                <span>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="tools">
        <div className="search">
          <IconSearch />
          <label className="sr" htmlFor="q">
            Cari anggota
          </label>
          <input id="q" type="search" placeholder="Cari nama atau quote" value={q} onChange={(e) => setQ(e.target.value)} />
          <button
            type="button"
            className={sort === 'az' ? 'round on' : 'round'}
            aria-label={sort === 'az' ? 'Urutan: A sampai Z. Ubah ke terbaru' : 'Urutan: terbaru. Ubah ke A sampai Z'}
            title={sort === 'az' ? 'A sampai Z' : 'Terbaru'}
            onClick={() => setSort((s) => (s === 'az' ? 'new' : 'az'))}
          >
            <IconSort size={18} />
          </button>
        </div>
        <div className="selwrap">
          <label className="sr" htmlFor="gf">
            Filter gender
          </label>
          <Select id="gf" value={gender} onChange={(v) => setGender(v as 'all' | Gender)}
            options={[{ value: 'all', label: 'Semua' }, { value: 'L', label: GENDER_LABELS.L }, { value: 'P', label: GENDER_LABELS.P }]} />
        </div>
        <button type="button" className="btn primary upload" onClick={() => setModal({ open: true, editing: null })}>
          <IconUpload />
          Upload
        </button>
      </div>

      <div className="sec-h">
        <h2>Anggota terdaftar</h2>
        <span className="num" aria-live="polite">
          {items.length === members.length ? `${members.length} orang` : `${items.length} dari ${members.length}`}
        </span>
      </div>

      {items.length > 0 ? (
        <div className={refreshing ? 'list is-pending' : 'list'} aria-busy={refreshing}>
          {items.map((m) => (
            <button key={m.id} type="button" className="mcard" aria-label={`${m.name}, lihat detail`} onClick={() => setDetailId(m.id)}>
              <Avatar name={m.name} src={thumbSrc(m.thumbUrl, 160)} />
              <span className="mtxt">
                <b>{m.name}</b>
                {m.quote && <span>{m.quote}</span>}
                <span suppressHydrationWarning>{formatWhen(m.createdAt)}</span>
              </span>
              <IconChevronRight size={22} />
            </button>
          ))}
        </div>
      ) : (
        <div className="empty">
          {members.length === 0 ? (
            <>
              <b>Belum ada yang upload</b>
              <p>Jadi yang pertama: tekan tombol Upload di atas.</p>
            </>
          ) : (
            <>
              <b>Tidak ada yang cocok</b>
              <p>Coba kata kunci lain atau ubah filter gender.</p>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setQ('');
                  setGender('all');
                }}
              >
                Reset pencarian
              </button>
            </>
          )}
        </div>
      )}

      <MemberSheet member={detail} admin={admin} onClose={() => setDetailId(null)} onEdit={startEdit} />

      {modalPresence.present && (
        <UploadModal
          open={modal.open}
          presence={modalPresence.phase}
          editing={modal.open ? modal.editing : lastEditing}
          admin={admin}
          uploadOpen={uploadOpen}
          onClose={() => setModal({ open: false })}
          onDone={done}
        />
      )}
    </>
  );
}
