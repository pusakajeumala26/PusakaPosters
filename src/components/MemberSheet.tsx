'use client';

import { useState, type FormEvent } from 'react';
import { formatWhen, whatsappLink } from '@/lib/format';
import { STATUS_META, type EditableMember, type MemberView } from '@/lib/types';
import { useDialog } from '@/lib/use-dialog';
import { Avatar } from './Avatar';
import { IconAlert, IconChat, IconChevronLeft } from './icons';

type Props = {
  member: MemberView;
  admin: boolean;
  onClose: () => void;
  onEdit: (member: MemberView, data: EditableMember, password?: string) => void;
};

export function MemberSheet({ member, admin, onClose, onEdit }: Props) {
  const ref = useDialog<HTMLDivElement>(onClose);
  const [version, setVersion] = useState<'cutout' | 'original'>('cutout');
  const [verifying, setVerifying] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const status = STATUS_META.find((s) => s.id === member.status)!;
  const canToggle = admin && !!member.cutoutUrl && !!member.originalUrl;
  const shown = canToggle && version === 'original' ? member.originalUrl : member.photoUrl;

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/members/${member.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; member?: EditableMember };
      if (!res.ok || !data.member) {
        setError(data.error ?? 'Password tidak cocok dengan data ini.');
        return;
      }
      onEdit(member, data.member, password);
    } catch {
      setError('Tidak bisa terhubung ke server. Periksa koneksi internetmu.');
    } finally {
      setBusy(false);
    }
  }

  function editAsAdmin() {
    onEdit(member, {
      name: member.name,
      countryCode: member.countryCode,
      phone: member.phone ?? '',
      quote: member.quote,
      gender: member.gender,
    });
  }

  return (
    <div className="ov right">
      <button type="button" className="scrim" aria-label="Tutup detail" tabIndex={-1} onClick={onClose} />
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={`Detail ${member.name}`} tabIndex={-1}>
        <div className="sheet-h">
          <button type="button" className="icon-btn" aria-label="Kembali" onClick={onClose} data-autofocus>
            <IconChevronLeft />
          </button>
          <b>Detail anggota</b>
          <span className={status.chip}>{status.label}</span>
        </div>

        <div className="sheet-b">
          <div className="portrait">
            {shown && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed URL dinamis dari Supabase
              <img src={shown} alt={`Foto ${member.name}`} onError={() => setImgFailed(true)} />
            ) : (
              <Avatar name={member.name} src={null} />
            )}
          </div>

          {canToggle && (
            <div className="seg" role="group" aria-label="Versi foto">
              <button type="button" aria-pressed={version === 'cutout'} onClick={() => setVersion('cutout')}>
                Tanpa latar
              </button>
              <button type="button" aria-pressed={version === 'original'} onClick={() => setVersion('original')}>
                Foto asli
              </button>
            </div>
          )}

          <div className="who2">
            <h2>{member.name}</h2>
            <p suppressHydrationWarning>Diupload {formatWhen(member.createdAt)}</p>
          </div>

          <blockquote className="quote">“{member.quote}”</blockquote>

          <dl className="dl">
            <dt>Gender</dt>
            <dd>{member.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</dd>
            <dt>No. HP/WA</dt>
            <dd className="num">{member.phoneDisplay}</dd>
            <dt>Status poster</dt>
            <dd>
              <span className={status.chip}>{status.label}</span>
            </dd>
          </dl>

          {!admin && <p className="note">Nomor lengkap hanya terlihat oleh admin.</p>}

          {admin ? (
            <div className="acts">
              {member.phone && (
                <a className="btn" href={whatsappLink(member.countryCode, member.phone)} target="_blank" rel="noopener noreferrer">
                  <IconChat size={18} />
                  Chat WhatsApp
                </a>
              )}
              <button type="button" className="btn primary" onClick={editAsAdmin}>
                Edit data
              </button>
            </div>
          ) : verifying ? (
            <form className="verify" onSubmit={verify} noValidate>
              <div className={error ? 'field has-err' : 'field'}>
                <label className="lbl" htmlFor="v-pw">
                  Password yang kamu buat saat upload
                </label>
                <input
                  id="v-pw"
                  className="inp"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  data-autofocus
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'v-err' : undefined}
                />
                {error && (
                  <div className="err" id="v-err" role="alert">
                    <IconAlert size={16} />
                    {error}
                  </div>
                )}
              </div>
              <div className="acts">
                <button type="button" className="btn ghost" onClick={() => setVerifying(false)}>
                  Batal
                </button>
                <button type="submit" className="btn primary" disabled={busy || !password}>
                  {busy ? 'Memeriksa…' : 'Lanjut edit'}
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="btn block" onClick={() => setVerifying(true)}>
              Ini data saya, edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
