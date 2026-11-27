'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { COUNTRY_OPTIONS } from '@/lib/constants';
import { processPhoto, STAGE_LABEL, type PhotoResult, type Stage } from '@/lib/photo';
import { memberFields, newMemberPassword } from '@/lib/validation';
import { IconAlert, IconImage, IconLock } from './icons';
import { Select } from './Select';
import { useToast } from './ToastProvider';
import { ContactAdmin } from './ContactAdmin';

type Mode = 'login' | 'register';

export function MemberAccessView() {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [countryCode, setCountryCode] = useState('+62');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [photo, setPhoto] = useState<PhotoResult | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.previewUrl); }, [photo]);

  async function choosePhoto(file?: File) {
    if (!file) return;
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    setPhoto(null);
    setError('');
    try {
      const result = await processPhoto(file, setStage);
      setPhoto(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Foto tidak dapat diproses.');
    } finally {
      setStage(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      let response: Response;
      if (mode === 'login') {
        response = await fetch('/api/member-auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ countryCode, phone, password }),
        });
      } else {
        const valid = memberFields.safeParse({ name, countryCode, phone, gender });
        if (!valid.success) throw new Error(valid.error.issues[0]?.message ?? 'Periksa kembali data anggota.');
        const validPassword = newMemberPassword.safeParse(password);
        if (!validPassword.success) throw new Error(validPassword.error.issues[0]?.message ?? 'Password tidak valid.');
        if (!inviteCode.trim()) throw new Error('Masukkan kode undangan dari admin.');
        if (!photo) throw new Error('Pilih foto profil untuk membuat akun.');
        const body = new FormData();
        body.set('name', valid.data.name);
        body.set('countryCode', valid.data.countryCode);
        body.set('phone', valid.data.phone);
        body.set('gender', valid.data.gender);
        body.set('password', validPassword.data);
        body.set('inviteCode', inviteCode);
        body.set('original', photo.original, 'original.webp');
        if (photo.cutout) body.set('cutout', photo.cutout, 'cutout.png');
        response = await fetch('/api/member-auth/register', { method: 'POST', body });
      }
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Tidak dapat memproses akun. Coba lagi.');
      toast(mode === 'register' ? 'Akun berhasil dibuat' : 'Selamat datang kembali');
      router.replace('/');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Tidak dapat terhubung ke server.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="member-access" aria-labelledby="access-title">
    <div className="access-brand"><span className="access-mark">P</span><span>Pusaka Jeumala <i>·</i> Ruang Anggota</span></div>
    <div className="access-grid">
      <aside className="access-story">
        <div className="access-orbit" aria-hidden="true"><span /><span /><span /></div>
        <span className="access-kicker">SATU RUANG, SATU CERITA</span>
        <h2>Wajahmu.<br />Ceritamu.<br /><em>Ruangmu.</em></h2>
        <p>Kelola data dan foto poster milikmu dengan aman. Hanya kamu dan panitia yang dapat melihat profilmu.</p>
        <div className="access-private"><IconLock size={17} /><span>Profil anggota bersifat pribadi</span></div>
      </aside>

      <div className="access-card">
        <div className="access-card-heading">
          <span className="access-eyebrow">PUSAKAPOSTERS</span>
          <h1 id="access-title">{mode === 'login' ? 'Masuk ke akunmu' : 'Buat akun anggota'}</h1>
          <p>{mode === 'login' ? 'Lanjutkan mengelola foto dan data poster milikmu.' : 'Siapkan profil dan foto untuk mulai bergabung.'}</p>
        </div>
        <div className="access-tabs" role="tablist" aria-label="Akun anggota">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError(''); }}>Masuk</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setError(''); }}>Daftar anggota</button>
        </div>

        <form className="access-form" onSubmit={submit} noValidate>
          {mode === 'register' && <>
            <div className="field">
              <label className="lbl" htmlFor="member-invite">Kode undangan</label>
              <input id="member-invite" className="inp invite-input" autoComplete="one-time-code" placeholder="PP-0000-0000-0000-0000-0000-0000-0000-0000" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
              <span className="access-hint">Minta kode sekali pakai kepada panitia.</span>
            </div>
            <div className="field">
              <label className="lbl" htmlFor="member-name">Nama lengkap</label>
              <input id="member-name" className="inp" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </>}
          <div className="field">
            <label className="lbl" htmlFor="member-phone">Nomor HP / WhatsApp</label>
            <div className="row">
              <div className="rel cc"><Select id="member-country" value={countryCode} onChange={setCountryCode} searchable searchLabel="Cari kode negara" options={COUNTRY_OPTIONS.map((item) => ({ value: item.code, label: item.label, searchText: item.code }))} /></div>
              <input id="member-phone" className="inp grow num" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="812 3456 7890" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          {mode === 'register' && <div className="field">
            <label className="lbl" htmlFor="member-gender">Gender</label>
            <Select id="member-gender" value={gender} onChange={setGender} options={[{ value: '', label: 'Pilih gender' }, { value: 'L', label: 'Pria' }, { value: 'P', label: 'Wanita' }]} />
          </div>}
          <div className="field">
            <label className="lbl" htmlFor="member-password">{mode === 'login' ? 'Password' : 'Buat password'}</label>
            <input id="member-password" className="inp" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} />
            {mode === 'register' && <span className="access-hint">Minimal 8 karakter. Simpan untuk login berikutnya.</span>}
          </div>
          {mode === 'register' && <div className="field">
            <span className="lbl">Foto profil</span>
            <input ref={inputRef} className="sr" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void choosePhoto(file); }} />
            <button type="button" className={photo ? 'access-photo has-photo' : 'access-photo'} onClick={() => inputRef.current?.click()} disabled={stage !== null}>
              <span className="access-photo-preview">{photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img src={photo.previewUrl} alt="Pratinjau foto profil" />
              ) : stage ? <span className="spin" /> : <IconImage size={22} />}</span>
              <span><b>{stage ? STAGE_LABEL[stage] : photo ? 'Foto siap digunakan' : 'Pilih foto untuk akunmu'}</b><small>{photo?.cutoutError ?? 'JPG, PNG, atau WebP · foto diproses di perangkat'}</small></span>
              <span className="access-photo-arrow">{photo ? 'Ganti' : 'Pilih'}</span>
            </button>
          </div>}
          {error && <div className="access-error" role="alert"><IconAlert size={17} />{error}</div>}
          <button className="btn primary block access-submit" type="submit" disabled={busy || stage !== null}>
            {busy ? 'Memproses…' : mode === 'login' ? 'Masuk ke profil' : 'Buat akun & upload foto'}
          </button>
        </form>
        {mode === 'login' && <div className="access-help"><span>Lupa password atau perlu bantuan?</span><button type="button" onClick={() => setShowHelp((value) => !value)} aria-expanded={showHelp}>Hubungi pengurus</button>{showHelp && <ContactAdmin compact />}</div>}
        <p className="access-admin-link">Panitia? <Link href="/status">Masuk sebagai admin</Link></p>
      </div>
    </div>
    <footer className="access-footer">PUSAKA JEUMALA <span>·</span> DATA ANGGOTA TERLINDUNGI</footer>
  </section>;
}

