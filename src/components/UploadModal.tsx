'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { COUNTRY_OPTIONS, QUOTE_MAX } from '@/lib/constants';
import { toTitleCase } from '@/lib/format';
import { processPhoto, STAGE_LABEL, type PhotoResult, type Stage } from '@/lib/photo';
import { preloadSegmenter } from '@/lib/segment';
import { useDialog } from '@/lib/use-dialog';
import type { EditableMember, Gender, MemberView } from '@/lib/types';
import { editMemberPassword, memberFields, newMemberPassword } from '@/lib/validation';
import { IconAlert, IconChevronDown, IconClose, IconImage, IconLock } from './icons';
import { Select } from './Select';
import { ContactAdmin } from './ContactAdmin';

export type EditingState = { member: MemberView; data: EditableMember; password?: string };

type Field = 'name' | 'phone' | 'quote' | 'gender' | 'pw' | 'photo';
type Errors = Partial<Record<Field, string>>;

type Props = {
  editing: EditingState | null;
  admin: boolean;
  uploadOpen: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <div className="err" id={id}>
      <IconAlert size={16} />
      {message}
    </div>
  );
}

export function UploadModal({ editing, admin, uploadOpen, onClose, onDone }: Props) {
  const ref = useDialog<HTMLFormElement>(onClose);
  const isEdit = !!editing;
  const closed = !uploadOpen && !isEdit;

  const [f, setF] = useState({
    name: editing?.data.name ?? '',
    cc: editing?.data.countryCode ?? '+62',
    phone: editing?.data.phone ?? '',
    quote: editing?.data.quote ?? '',
    gender: (editing?.data.gender ?? '') as Gender | '',
    pw: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [sending, setSending] = useState(false);

  const [photo, setPhoto] = useState<PhotoResult | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [photoError, setPhotoError] = useState('');
  const lastFile = useRef<File | null>(null);
  const token = useRef(0);
  const photoRef = useRef<PhotoResult | null>(null);

  useEffect(() => {
    photoRef.current = photo;
  }, [photo]);
  useEffect(
    () => () => {
      token.current++;
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.previewUrl);
    },
    [],
  );

  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => {
    setF((prev) => ({ ...prev, [key]: value }));
    const errKey: Field | null = key === 'cc' ? 'phone' : (key as Field);
    setErrors((prev) => ({ ...prev, [errKey]: undefined }));
    setFormError('');
  };

  async function runPhoto(file: File) {
    const mine = ++token.current;
    lastFile.current = file;
    setPhotoError('');
    setErrors((p) => ({ ...p, photo: undefined }));
    setPhoto((old) => {
      if (old) URL.revokeObjectURL(old.previewUrl);
      return null;
    });
    setStage('baca');
    try {
      const result = await processPhoto(file, (s) => {
        if (token.current === mine) setStage(s);
      });
      if (token.current !== mine) {
        URL.revokeObjectURL(result.previewUrl);
        return;
      }
      setPhoto(result);
    } catch (e) {
      if (token.current === mine) setPhotoError(e instanceof Error ? e.message : 'Foto gagal diproses.');
    } finally {
      if (token.current === mine) setStage(null);
    }
  }

  function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // izinkan memilih file yang sama lagi
    if (file) void runPhoto(file);
  }

  function validate(): Errors {
    const errs: Errors = {};
    const parsed = memberFields.safeParse({
      name: f.name,
      countryCode: f.cc,
      phone: f.phone,
      quote: f.quote,
      gender: f.gender,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as Field | undefined;
        if (key && !errs[key]) errs[key] = issue.message;
      }
    }
    if (!isEdit) {
      const p = newMemberPassword.safeParse(f.pw);
      if (!p.success) errs.pw = p.error.issues[0]?.message;
    } else if (f.pw) {
      const p = editMemberPassword.safeParse(f.pw);
      if (!p.success) errs.pw = p.error.issues[0]?.message;
    }
    if (stage) errs.photo = 'Tunggu sampai foto selesai diproses.';
    else if (!isEdit && !photo) errs.photo = 'Pilih foto dulu.';
    return errs;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    const errs = validate();
    if (Object.values(errs).some(Boolean)) {
      setErrors(errs);
      const first = (['name', 'phone', 'quote', 'gender', 'pw', 'photo'] as Field[]).find((k) => errs[k]);
      if (first) ref.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
      return;
    }

    const fd = new FormData();
    fd.set('name', f.name.trim());
    fd.set('countryCode', f.cc);
    fd.set('phone', f.phone);
    fd.set('quote', f.quote.trim());
    fd.set('gender', f.gender);
    if (f.pw) fd.set('password', f.pw);
    if (editing && !admin && editing.password) fd.set('currentPassword', editing.password);
    if (photo) {
      fd.set('original', photo.original, 'original.webp');
      if (photo.cutout) fd.set('cutout', photo.cutout, 'cutout.webp');
    }

    setSending(true);
    setFormError('');
    try {
      const res = await fetch(editing ? `/api/members/${editing.member.id}` : '/api/members', {
        method: editing ? 'PATCH' : 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}) as { error?: string });
      if (!res.ok) {
        const message = (data as { error?: string }).error ?? 'Data gagal dikirim. Coba lagi.';
        setFormError(message);
        if (res.status === 409) setErrors({ phone: message });
        return;
      }
      onDone(isEdit ? 'Data berhasil diperbarui' : 'Data berhasil diupload');
    } catch {
      setFormError('Tidak bisa terhubung ke server. Periksa koneksi internetmu lalu coba lagi.');
    } finally {
      setSending(false);
    }
  }

  const processing = stage !== null;
  const existingPhoto = !photo && editing?.member.photoUrl ? editing.member.photoUrl : null;
  const thumbSrc = photo?.previewUrl ?? existingPhoto;
  const thumbChecker = photo ? !!photo.cutout : !!editing?.member.hasCutout;

  const fc = (k: Field) => (errors[k] ? 'field has-err' : 'field');
  const inv = (k: Field) => (errors[k] ? true : undefined);
  const desc = (k: Field) => (errors[k] ? `err-${k}` : undefined);

  return (
    <div className="ov">
      <button type="button" className="scrim" aria-label="Tutup form" tabIndex={-1} onClick={onClose} />
      <form ref={ref} className="dlg" role="dialog" aria-modal="true" aria-labelledby="up-title" tabIndex={-1} onSubmit={submit} noValidate>
        <div className="grab" aria-hidden="true" />
        <div className="dlg-h">
          <div>
            <h2 id="up-title">{isEdit ? 'Edit data diri' : 'Upload data diri'}</h2>
            <p>
              {isEdit
                ? 'Ubah yang perlu saja. Kosongkan password jika tidak diganti.'
                : 'Data ini dipakai untuk poster leting di media sosial.'}
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="Tutup" onClick={onClose}>
            <IconClose />
          </button>
        </div>

        {closed ? (
          <>
            <div className="notice">
              <IconLock size={22} />
              <div>
                <b>Upload sedang ditutup</b>
                <p>Panitia sudah menutup pengiriman data. Hubungi pengurus kalau kamu belum sempat upload.</p>
              </div>
            </div>
            <ContactAdmin compact />
            <div className="dlg-f">
              <button type="button" className="btn primary" onClick={onClose} data-autofocus>
                Mengerti
              </button>
            </div>
          </>
        ) : (
          <>
            {formError && (
              <div className="alert" role="alert">
                <IconAlert size={18} />
                <span>{formError}</span>
              </div>
            )}

            <div className="form">
              <div className={fc('name')}>
                <label className="lbl" htmlFor="f-name">
                  Nama lengkap
                </label>
                <input
                  id="f-name"
                  data-field="name"
                  data-autofocus
                  className="inp"
                  autoComplete="name"
                  placeholder="Sesuai yang ingin ditulis di poster"
                  value={f.name}
                  onChange={(e) => set('name', e.target.value)}
                  onBlur={() => set('name', toTitleCase(f.name))}
                  aria-invalid={inv('name')}
                  aria-describedby={desc('name')}
                />
                <FieldError id="err-name" message={errors.name} />
              </div>

              <div className={fc('phone')}>
                <label className="lbl" htmlFor="f-phone">
                  No. HP/WA
                </label>
                <div className="row">
                  <div className="rel cc">
                    <label className="sr" htmlFor="f-cc">
                      Kode negara
                    </label>
                    <Select id="f-cc" value={f.cc} onChange={(v) => set('cc', v)} searchable searchLabel="Cari kode negara"
                      options={COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.label, searchText: c.code }))} />
                    <IconChevronDown className="chev" size={16} />
                  </div>
                  <input
                    id="f-phone"
                    data-field="phone"
                    className="inp grow num"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="812 3456 7890"
                    value={f.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    aria-invalid={inv('phone')}
                    aria-describedby={desc('phone')}
                  />
                </div>
                <FieldError id="err-phone" message={errors.phone} />
              </div>

              <div className={fc('quote')}>
                <label className="lbl" htmlFor="f-quote">
                  Subjek <em>· quote untuk poster</em>
                </label>
                <textarea
                  id="f-quote"
                  data-field="quote"
                  className="inp"
                  maxLength={QUOTE_MAX}
                  placeholder="Satu kalimat tentang kamu atau tentang Pusaka"
                  value={f.quote}
                  onChange={(e) => set('quote', e.target.value)}
                  aria-invalid={inv('quote')}
                  aria-describedby={desc('quote')}
                />
                <div className="hint">
                  <span>Akan ditulis apa adanya di poster.</span>
                  <span className="num">
                    {f.quote.length}/{QUOTE_MAX}
                  </span>
                </div>
                <FieldError id="err-quote" message={errors.quote} />
              </div>

              <div className={fc('gender')}>
                <label className="lbl" htmlFor="f-gender">
                  Gender
                </label>
                <div className="rel">
                  <Select
                    id="f-gender"
                    value={f.gender}
                    onChange={(v) => set('gender', v as Gender | '')}
                    dataField="gender" invalid={!!errors.gender} describedBy={desc('gender')}
                    options={[{ value: '', label: 'Pilih gender' }, { value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }]} />
                  <IconChevronDown className="chev" size={16} />
                </div>
                <FieldError id="err-gender" message={errors.gender} />
              </div>

              <div className={fc('pw')}>
                <label className="lbl" htmlFor="f-pw">
                  {isEdit ? 'Password baru (opsional)' : 'Password'}
                </label>
                <div className="pw">
                  <input
                    id="f-pw"
                    data-field="pw"
                    className="inp"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Minimal 4 karakter"
                    value={f.pw}
                    onChange={(e) => set('pw', e.target.value)}
                    aria-invalid={inv('pw')}
                    aria-describedby={desc('pw') ?? 'pw-hint'}
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw}>
                    {showPw ? 'Sembunyikan' : 'Tampilkan'}
                  </button>
                </div>
                <div className="hint" id="pw-hint">
                  <span>Dipakai kalau kamu ingin mengubah datamu nanti.</span>
                </div>
                <FieldError id="err-pw" message={errors.pw} />
              </div>

              <div className={fc('photo')}>
                <span className="lbl" id="f-photo-l">
                  Foto
                </span>
                <label className="drop" onClick={preloadSegmenter}>
                  <input
                    data-field="photo"
                    className="sr"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-labelledby="f-photo-l"
                    aria-describedby={errors.photo ? 'err-photo' : 'photo-sub'}
                    onChange={onPickPhoto}
                  />
                  <span className={thumbChecker && thumbSrc ? 'thumb checker' : 'thumb'} aria-hidden="true">
                    {processing ? (
                      <span className="spin" />
                    ) : thumbSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element -- blob URL lokal
                      <img src={thumbSrc} alt="" />
                    ) : (
                      <IconImage size={26} />
                    )}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <b>
                      {processing
                        ? 'Memproses foto…'
                        : photo
                          ? 'Foto siap dikirim'
                          : existingPhoto
                            ? 'Foto saat ini'
                            : 'Pilih foto'}
                    </b>
                    <span className="drop-sub" id="photo-sub">
                      {processing && stage
                        ? STAGE_LABEL[stage]
                        : photo
                          ? photo.cutout
                            ? 'Latar belakang sudah dihapus. Ketuk untuk mengganti.'
                            : 'Ketuk untuk mengganti foto.'
                          : existingPhoto
                            ? 'Ketuk untuk mengganti foto.'
                            : 'JPG, PNG, atau WebP. Wajah jelas, satu orang saja.'}
                    </span>
                  </span>
                </label>
                <FieldError id="err-photo" message={errors.photo} />
                {photoError && (
                  <div className="alert" role="alert">
                    <IconAlert size={18} />
                    <span>{photoError}</span>
                  </div>
                )}
                {photo?.cutoutError && (
                  <div className="alert" role="status">
                    <IconAlert size={18} />
                    <div>
                      <span>{photo.cutoutError}</span>
                      {lastFile.current && (
                        <div style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="btn ghost"
                            style={{ height: 44 }}
                            onClick={() => lastFile.current && void runPhoto(lastFile.current)}
                          >
                            Coba hapus latar lagi
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="dlg-f">
              <button type="button" className="btn ghost" onClick={onClose}>
                Batal
              </button>
              <button type="submit" className="btn primary" disabled={sending || processing}>
                {sending ? 'Mengirim…' : isEdit ? 'Simpan perubahan' : 'Upload data'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
