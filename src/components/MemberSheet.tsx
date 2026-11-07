'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { formatWhen, whatsappLink } from '@/lib/format';
import { GENDER_LABELS, STATUS_META, type EditableMember, type MemberView } from '@/lib/types';
import { useDialog } from '@/lib/use-dialog';
import { usePresence } from '@/lib/use-presence';
import { Avatar } from './Avatar';
import { IconAlert, IconChat, IconChevronLeft } from './icons';

type Props = {
  member: MemberView | null;
  admin: boolean;
  onClose: () => void;
  onEdit: (member: MemberView, data: EditableMember, password?: string) => void;
};

export function MemberSheet({ member: incomingMember, admin, onClose, onEdit }: Props) {
  const [lastMember, setLastMember] = useState<MemberView | null>(incomingMember);
  const open = !!incomingMember;
  const presence = usePresence(open, 360);
  const member = incomingMember ?? lastMember;
  const ref = useDialog<HTMLDivElement>(onClose, open && presence.present);
  const [version, setVersion] = useState<'cutout' | 'original'>('cutout');
  const [verifying, setVerifying] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (incomingMember) setLastMember(incomingMember);
  }, [incomingMember]);

  if (!presence.present || !member) return null;
  const activeMember = member;

  const status = STATUS_META.find((s) => s.id === activeMember.status)!;
  const canToggle = admin && !!activeMember.cutoutUrl && !!activeMember.originalUrl;
  const shown = canToggle && version === 'original' ? activeMember.originalUrl : activeMember.photoUrl;

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/members/${activeMember.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; member?: EditableMember };
      if (!res.ok || !data.member) {
        setError(data.error ?? 'Password tidak cocok dengan data ini.');
        return;
      }
      onEdit(activeMember, data.member, password);
    } catch {
      setError('Tidak bisa terhubung ke server. Periksa koneksi internetmu.');
    } finally {
      setBusy(false);
    }
  }

  function editAsAdmin() {
    onEdit(activeMember, {
      name: activeMember.name,
      countryCode: activeMember.countryCode,
      phone: activeMember.phone ?? '',
      gender: activeMember.gender,
    });
  }

  return (
    <div className="ov right" data-state={presence.phase} aria-hidden={!open} inert={!open}>
      <button type="button" className="scrim" aria-label="Tutup detail" tabIndex={-1} onClick={onClose} />
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={`Detail ${activeMember.name}`} tabIndex={-1}>
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
              <img className="image-pending" src={shown} alt={`Foto ${activeMember.name}`} onLoad={(e) => e.currentTarget.classList.replace('image-pending', 'image-loaded')} onError={() => setImgFailed(true)} />
            ) : (
              <Avatar name={activeMember.name} src={null} />
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
            <h2>{activeMember.name}</h2>
            <p suppressHydrationWarning>Diupload {formatWhen(activeMember.createdAt)}</p>
          </div>

          {activeMember.quote && <blockquote className="quote">“{activeMember.quote}”</blockquote>}

          <dl className="dl">
            <dt>Gender</dt>
            <dd>{GENDER_LABELS[activeMember.gender]}</dd>
            <dt>No. HP/WA</dt>
            <dd className="num phone-display">{activeMember.phoneDisplay}</dd>
            <dd className="mobile-chat-cell">
              <a className="btn mobile-chat" href={`/api/members/${activeMember.id}/whatsapp`} target="_blank" rel="noopener noreferrer">
                <IconChat size={18} />
                Chat WhatsApp
              </a>
            </dd>
            <dt>Status poster</dt>
            <dd>
              <span className={status.chip}>{status.label}</span>
            </dd>
          </dl>

          {!admin && <p className="note">Nomor lengkap hanya terlihat oleh admin.</p>}

          {admin ? (
            <div className="acts">
              {activeMember.phone && (
                <a className="btn desktop-admin-chat" href={whatsappLink(activeMember.countryCode, activeMember.phone)} target="_blank" rel="noopener noreferrer">
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
