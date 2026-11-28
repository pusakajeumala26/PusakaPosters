'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { COUNTRY_OPTIONS } from '@/lib/constants';
import { processPhoto, STAGE_LABEL, type PhotoResult, type Stage } from '@/lib/photo';
import { memberFields, newMemberPassword } from '@/lib/validation';
import { IconAlert, IconChevronLeft, IconImage, IconLock } from './icons';
import { Select } from './Select';
import { useToast } from './ToastProvider';
import { ContactAdmin } from './ContactAdmin';

type Mode = 'login' | 'register' | 'help';

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? 'member-brand compact' : 'member-brand'}>
    <Image src="/brand/logo-mark-light.webp" alt="" width={42} height={42} priority />
    <span><b>PusakaPosters</b><small>Leting Pusaka Jeumala</small></span>
  </div>;
}

export function MemberAccessView() {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [countryCode, setCountryCode] = useState('+62');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [quote, setQuote] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [photo, setPhoto] = useState<PhotoResult | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
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
        const valid = memberFields.safeParse({ name, countryCode, phone, gender, quote });
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
        body.set('quote', valid.data.quote ?? '');
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

  const header = <header className="member-access-header">
    {mode !== 'login' && <button type="button" className="member-back" onClick={() => { setMode('login'); setError(''); }} aria-label="Kembali ke login"><IconChevronLeft size={20} /></button>}
    <Brand />
  </header>;

  return <section className="member-access" aria-labelledby="access-title">
    {header}
    {mode === 'help' ? (
      <div className="access-panel help-panel">
        <div className="help-symbol" aria-hidden="true">☏</div>
        <h1 id="access-title">Butuh bantuan login?</h1>
        <p className="access-lead">Lupa password atau mengalami kendala saat masuk?</p>
        <div className="help-note"><IconLock size={18} /><div><b>Reset password dilakukan melalui panitia/admin.</b><p>Demi keamanan data, kami tidak dapat mereset password secara otomatis di aplikasi. Silakan hubungi pengurus Pusaka Jeumala untuk dibantu.</p></div></div>
        <ContactAdmin compact />
        <p className="help-fallback">Jika WhatsApp tidak terbuka, pastikan aplikasinya terpasang atau hubungi pengurus melalui grup resmi.</p>
        <button type="button" className="btn ghost block" onClick={() => { setMode('login'); setError(''); }}><IconChevronLeft size={18} /> Kembali ke login</button>
      </div>
    ) : (
      <div className={mode === 'register' ? 'access-panel register-panel' : 'access-panel login-panel'}>
        {mode === 'login' ? <>
          <div className="access-heading">
            <span className="access-eyebrow">RUANG ANGGOTA</span>
            <h1 id="access-title">Masuk ke profil</h1>
            <p>Akses profil pribadi Pusaka Jeumala untuk mengelola data dan foto Anda.</p>
          </div>
          <form className="access-form" onSubmit={submit} noValidate>
            <div className="field">
              <label className="lbl" htmlFor="member-phone">Nomor telepon</label>
              <div className="row">
                <div className="rel cc"><Select id="member-country" value={countryCode} onChange={setCountryCode} searchable searchLabel="Cari kode negara" options={COUNTRY_OPTIONS.map((item) => ({ value: item.code, label: item.label, searchText: item.code }))} /></div>
                <input id="member-phone" className="inp grow num" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="81234567890" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label className="lbl" htmlFor="member-password">Password</label>
              <div className="password-wrap"><input id="member-password" className="inp" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>{showPassword ? 'Sembunyikan' : 'Lihat'}</button></div>
            </div>
            {error && <div className="access-error" role="alert"><IconAlert size={17} />{error}</div>}
            <button className="btn primary block access-submit" type="submit" disabled={busy}>{busy ? 'Memproses…' : 'Masuk ke profil'}</button>
          </form>
          <button type="button" className="invite-link" onClick={() => { setMode('register'); setError(''); }}>Buat akun dengan kode undangan <span>›</span></button>
          <div className="access-help-card"><div className="help-card-icon">◉</div><div><b>Butuh bantuan?</b><p>Lupa password atau mengalami kendala saat masuk?</p><button type="button" onClick={() => { setMode('help'); setError(''); }}>Hubungi pengurus</button></div></div>
          <p className="access-admin-link">Panitia? <Link href="/status">Masuk sebagai admin <span>›</span></Link></p>
        </> : <>
          <div className="access-heading">
            <span className="access-eyebrow">PENDAFTARAN ANGGOTA</span>
            <h1 id="access-title">Buat akun anggota</h1>
            <p>Daftar dengan kode undangan dari panitia Pusaka Jeumala.</p>
          </div>
          <form className="access-form register-form" onSubmit={submit} noValidate>
            <div className="field">
              <label className="lbl" htmlFor="member-invite">Kode undangan <i>*</i></label>
              <input id="member-invite" className="inp invite-input" autoComplete="one-time-code" placeholder="PP-2025-7F4K" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} />
            </div>
            <div className="field">
              <label className="lbl" htmlFor="member-name">Nama lengkap <i>*</i></label>
              <input id="member-name" className="inp" autoComplete="name" maxLength={80} placeholder="Nama sesuai untuk poster" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label className="lbl" htmlFor="member-phone-register">Nomor telepon <i>*</i></label>
              <div className="row">
                <div className="rel cc"><Select id="member-country" value={countryCode} onChange={setCountryCode} searchable searchLabel="Cari kode negara" options={COUNTRY_OPTIONS.map((item) => ({ value: item.code, label: item.label, searchText: item.code }))} /></div>
                <input id="member-phone-register" className="inp grow num" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="81234567890" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <fieldset className="gender-field"><legend className="lbl">Jenis kelamin <i>*</i></legend><div className="gender-options">
              <button type="button" className={gender === 'L' ? 'gender-option selected' : 'gender-option'} aria-pressed={gender === 'L'} onClick={() => setGender('L')}>{gender === 'L' ? '⦿' : '◯'} Laki-laki</button>
              <button type="button" className={gender === 'P' ? 'gender-option selected' : 'gender-option'} aria-pressed={gender === 'P'} onClick={() => setGender('P')}>{gender === 'P' ? '⦿' : '◯'} Perempuan</button>
            </div></fieldset>
            <div className="field">
              <label className="lbl" htmlFor="member-quote">Quote (opsional)</label>
              <textarea id="member-quote" className="inp quote-input" maxLength={120} placeholder="Satu langkah lagi, jadi bagian dari leting Pusaka Jeumala." value={quote} onChange={(e) => setQuote(e.target.value)} />
              <span className="field-counter">{quote.length}/120</span>
            </div>
            <div className="field">
              <label className="lbl" htmlFor="member-password">Password <i>*</i></label>
              <div className="password-wrap"><input id="member-password" className="inp" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>{showPassword ? 'Sembunyikan' : 'Lihat'}</button></div>
              <span className="access-hint">Minimal 8 karakter.</span>
            </div>
            <div className="field">
              <span className="lbl">Foto profil <i>*</i></span>
              <input ref={inputRef} className="sr" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void choosePhoto(file); }} />
              <button type="button" className={photo ? 'access-photo has-photo' : 'access-photo'} onClick={() => inputRef.current?.click()} disabled={stage !== null}>
                <span className="access-photo-preview">{photo ? <img src={photo.previewUrl} alt="Pratinjau foto profil" /> : stage ? <span className="spin" /> : <IconImage size={22} />}</span>
                <span><b>{stage ? STAGE_LABEL[stage] : photo ? 'Foto siap digunakan' : 'Pilih foto profil'}</b><small>{photo?.cutoutError ?? 'JPG, PNG, atau WebP · maksimal 5 MB'}</small></span>
                <span className="access-photo-arrow">{photo ? 'Ganti' : 'Pilih'}</span>
              </button>
              {stage && <div className="photo-progress" aria-live="polite"><span className="progress-track"><i /></span><small>{STAGE_LABEL[stage]}</small></div>}
            </div>
            {error && <div className="access-error" role="alert"><IconAlert size={17} />{error}</div>}
            <div className="help-note compact-note"><IconLock size={16} /><p>Foto diproses sebelum diunggah. Profil hanya dapat dilihat oleh Anda dan panitia/admin.</p></div>
            <button className="btn primary block access-submit" type="submit" disabled={busy || stage !== null}>{busy ? 'Memproses…' : 'Buat akun & upload foto'}</button>
          </form>
        </>}
      </div>
    )}
    <footer className="access-footer">PUSAKA JEUMALA <span>·</span> DATA ANGGOTA TERLINDUNGI</footer>
  </section>;
}
