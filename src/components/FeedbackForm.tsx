'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AVATAR_MAX_BYTES, AVATAR_TYPES, FEEDBACK_ROLES, MESSAGE_MAX, MESSAGE_MIN, NAME_MAX } from '@/lib/feedback-input';
import { useDialog } from '@/lib/use-dialog';
import { usePresence } from '@/lib/use-presence';
import { Avatar } from './Avatar';
import { IconAlert, IconChat, IconClose, IconImage } from './icons';
import { Select } from './Select';

const ROLE_OPTIONS = [{ value: '', label: 'Pilih peran' }, ...FEEDBACK_ROLES.map((role) => ({ value: role, label: role }))];
const UNAVAILABLE = 'Masukan belum dapat dikirim saat ini. Coba lagi beberapa saat lagi.';
type Errors = Partial<Record<'name' | 'message' | 'rating' | 'consent' | 'avatar', string>>;

function useFeedbackForm() {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!avatar) { setPreview(null); return; }
    const url = URL.createObjectURL(avatar);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  function pickAvatar(file: File | null) {
    if (!file) return;
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return setErrors((e) => ({ ...e, avatar: 'Foto harus berformat JPG, PNG, atau WebP.' }));
    if (file.size > AVATAR_MAX_BYTES) return setErrors((e) => ({ ...e, avatar: 'Foto terlalu besar (maksimal 2 MB).' }));
    setErrors((e) => ({ ...e, avatar: undefined }));
    setAvatar(file);
  }

  async function submit() {
    if (busy) return;
    const found: Errors = {};
    if (!name.trim()) found.name = 'Nama lengkap wajib diisi.';
    if (message.trim().length < MESSAGE_MIN) found.message = `Penilaian minimal ${MESSAGE_MIN} karakter.`;
    if (!rating) found.rating = 'Pilih penilaian bintang 1 sampai 5.';
    if (!consent) found.consent = 'Centang persetujuan agar masukan dapat dikirim.';
    setErrors((prev) => ({ ...found, avatar: prev.avatar }));
    if (Object.keys(found).length) return;
    if (!navigator.onLine) { setError('Anda sedang offline. Sambungkan kembali ke internet untuk mengirim masukan.'); return; }
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.set('name', name);
      body.set('role', role);
      body.set('message', message);
      body.set('rating', String(rating));
      body.set('consent', 'true');
      body.set('website', website);
      if (avatar) body.set('avatar', avatar);
      const response = await fetch('/api/feedback', { method: 'POST', body });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) { setError(result.error ?? UNAVAILABLE); return; }
      setSent(true);
    } catch {
      setError(UNAVAILABLE);
    } finally {
      setBusy(false);
    }
  }

  return { name, setName, role, setRole, rating, setRating, message, setMessage, consent, setConsent, website, setWebsite, avatar, setAvatar, preview, pickAvatar, errors, busy, error, sent, submit };
}
type Form = ReturnType<typeof useFeedbackForm>;

const Err = ({ id, msg }: { id: string; msg?: string }) =>
  msg ? <span className="err" id={id} role="alert"><IconAlert size={14} />{msg}</span> : null;

function FeedbackFields({ form, first }: { form: Form; first?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const file = useRef<HTMLInputElement>(null);
  const { errors } = form;

  function chooseRating(value: number, focus = false) {
    form.setRating(value);
    if (focus) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-rating="${value}"]`)?.focus());
  }
  function onRatingKey(event: KeyboardEvent<HTMLButtonElement>, value: number) {
    let next = value;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(5, value + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(1, value - 1);
    else if (event.key === 'Home') next = 1;
    else if (event.key === 'End') next = 5;
    else return;
    event.preventDefault();
    chooseRating(next, true);
  }

  return (
    <>
      <div className={`field${errors.name ? ' has-err' : ''}`}>
        <label className="lbl" htmlFor={`${uid}-name`}>Nama lengkap</label>
        <input className="inp" id={`${uid}-name`} name="name" autoComplete="name" maxLength={NAME_MAX} aria-required="true" aria-invalid={!!errors.name}
          aria-describedby={errors.name ? `${uid}-name-e` : undefined} value={form.name} onChange={(e) => form.setName(e.target.value)} data-autofocus={first ? '' : undefined} />
        <Err id={`${uid}-name-e`} msg={errors.name} />
      </div>

      <div className="field">
        <label className="lbl" htmlFor={`${uid}-role`}>Peran <em>(opsional)</em></label>
        <Select id={`${uid}-role`} value={form.role} options={ROLE_OPTIONS} onChange={form.setRole} />
      </div>

      <div className="field">
        <span className="lbl" id={`${uid}-photo-l`}>Foto profil <em>(opsional)</em></span>
        <div className="fb-photo">
          <Avatar name={form.name || '?'} src={form.preview} />
          <div className="fb-photo-act">
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr" tabIndex={-1} aria-labelledby={`${uid}-photo-l`}
              onChange={(e) => { form.pickAvatar(e.target.files?.[0] ?? null); e.target.value = ''; }} />
            <button type="button" className="btn ghost" onClick={() => file.current?.click()} aria-describedby={`${uid}-photo-h`}>
              <IconImage size={18} />{form.avatar ? 'Ganti foto' : 'Pilih foto'}
            </button>
            {form.avatar && <button type="button" className="btn ghost" onClick={() => form.setAvatar(null)}>Hapus</button>}
          </div>
        </div>
        <span className="feedback-count" id={`${uid}-photo-h`} style={{ textAlign: 'left' }}>JPG, PNG, atau WebP, maksimal 2 MB. Tanpa foto, tampil inisial.</span>
        <Err id={`${uid}-photo-e`} msg={errors.avatar} />
      </div>

      <fieldset className="feedback-rating">
        <legend className="lbl">Penilaian bintang</legend>
        <div className="feedback-stars" role="radiogroup" aria-label="Penilaian dari 1 sampai 5 bintang">
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" role="radio" aria-checked={form.rating === value} aria-label={`${value} dari 5 bintang`}
              tabIndex={form.rating === value || (form.rating === 0 && value === 1) ? 0 : -1} data-rating={value}
              className={form.rating >= value ? 'feedback-star is-selected' : 'feedback-star'} onClick={() => chooseRating(value)} onKeyDown={(e) => onRatingKey(e, value)}>
              <span aria-hidden="true">★</span>
            </button>
          ))}
          <span className="feedback-rating-value">{form.rating ? `${form.rating} dari 5` : 'Pilih 1–5'}</span>
        </div>
        <Err id={`${uid}-rating-e`} msg={errors.rating} />
      </fieldset>

      <div className={`field${errors.message ? ' has-err' : ''}`}>
        <label className="lbl" htmlFor={`${uid}-msg`}>Penilaian</label>
        <textarea className="inp" id={`${uid}-msg`} name="message" maxLength={MESSAGE_MAX} aria-required="true" aria-invalid={!!errors.message}
          aria-describedby={`${uid}-count${errors.message ? ` ${uid}-msg-e` : ''}`} value={form.message} onChange={(e) => form.setMessage(e.target.value)} />
        <div id={`${uid}-count`} className="feedback-count">Minimal {MESSAGE_MIN} karakter · {form.message.length}/{MESSAGE_MAX}</div>
        <span className="sr" aria-live="polite">{form.message.length >= 1400 ? 'Masukan mendekati batas 1500 karakter.' : ''}</span>
        <Err id={`${uid}-msg-e`} msg={errors.message} />
      </div>

      <div>
        <label className="feedback-consent">
          <input type="checkbox" checked={form.consent} onChange={(e) => form.setConsent(e.target.checked)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? `${uid}-consent-e` : undefined} />
          <span>Saya setuju masukan ini beserta nama dan peran saya ditampilkan di portfolio Alfiz Ilham.</span>
        </label>
        <Err id={`${uid}-consent-e`} msg={errors.consent} />
      </div>

      <div className="feedback-honeypot" aria-hidden="true">
        <label htmlFor={`${uid}-web`}>Website</label>
        <input id={`${uid}-web`} name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => form.setWebsite(e.target.value)} />
      </div>
    </>
  );
}

const THANKS = 'Terima kasih. Masukan Anda sudah kami simpan dan akan diteruskan ke portfolio Alfiz Ilham untuk ditinjau.';

/** Halaman penuh /masukan. */
export function FeedbackForm() {
  const form = useFeedbackForm();
  const onSubmit = (e: FormEvent) => { e.preventDefault(); void form.submit(); };
  return (
    <section className="feedback-page" aria-labelledby="feedback-title">
      <header className="feedback-intro">
        <span className="feedback-eyebrow">PusakaPosters</span>
        <h2 id="feedback-title">Beri feedback</h2>
        <p>Ceritakan pengalaman atau saran Anda. Masukan akan ditinjau sebelum ditampilkan di portfolio.</p>
      </header>
      <form className="feedback-card" onSubmit={onSubmit} aria-busy={form.busy} noValidate>
        {form.sent ? <div className="feedback-success" role="status">{THANKS}</div> : (
          <>
            {form.error && <div className="feedback-error" role="alert">{form.error}</div>}
            <FeedbackFields form={form} />
            <button className="btn primary block feedback-submit" type="submit" disabled={form.busy}>{form.busy ? 'Mengirim...' : 'Kirim feedback'}</button>
          </>
        )}
      </form>
    </section>
  );
}

function FeedbackDialogBody({ onClose }: { onClose: () => void }) {
  const form = useFeedbackForm();
  const onSubmit = (e: FormEvent) => { e.preventDefault(); void form.submit(); };
  return (
    <>
      <div className="contact-dialog-head">
        <div>
          <h2 id="feedback-dialog-title">Beri feedback</h2>
          <p>Punya waktu sebentar? Ceritakan pengalaman Anda. Boleh dilewati.</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Lewati" onClick={onClose}><IconClose /></button>
      </div>
      <form className="feedback-dialog-form" onSubmit={onSubmit} aria-busy={form.busy} noValidate>
        {form.sent ? (
          <>
            <div className="feedback-success" role="status">{THANKS}</div>
            <button type="button" className="btn primary block" onClick={onClose} data-autofocus>Tutup</button>
          </>
        ) : (
          <>
            {form.error && <div className="feedback-error" role="alert">{form.error}</div>}
            <FeedbackFields form={form} first />
            <div className="feedback-dialog-actions">
              <button type="button" className="btn ghost" onClick={onClose}>Lewati</button>
              <button type="submit" className="btn primary" disabled={form.busy}><IconChat size={18} />{form.busy ? 'Mengirim...' : 'Kirim feedback'}</button>
            </div>
          </>
        )}
      </form>
    </>
  );
}

/** Modal feedback: dibuka otomatis di beranda atau dari menu samping. Escape = lewati. */
export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const presence = usePresence(open, 340);
  const ref = useDialog<HTMLDivElement>(onClose, open && presence.present);
  if (!presence.present) return null;
  return (
    <div className="ov contact-overlay feedback-overlay" data-state={presence.phase} aria-hidden={!open} inert={!open}>
      <button type="button" className="scrim" aria-label="Lewati feedback" tabIndex={-1} onClick={onClose} />
      <section ref={ref} className="contact-dialog feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title" tabIndex={-1}>
        <FeedbackDialogBody onClose={onClose} />
      </section>
    </div>
  );
}
