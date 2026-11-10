'use client';

import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';

const MAX_MESSAGE = 1500;
const FIELDS_MESSAGE = 'Periksa kembali isian masukan.';
const UNAVAILABLE_MESSAGE = 'Masukan belum dapat dikirim saat ini. Coba lagi beberapa saat lagi.';

export function FeedbackForm() {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [online, setOnline] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [nearLimit, setNearLimit] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  function chooseRating(value: number, focus = false) {
    setRating(value);
    if (focus) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-rating="${value}"]`)?.focus());
  }

  function onRatingKeyDown(event: KeyboardEvent<HTMLButtonElement>, value: number) {
    let next = value;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(5, value + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(1, value - 1);
    else if (event.key === 'Home') next = 1;
    else if (event.key === 'End') next = 5;
    else return;
    event.preventDefault();
    chooseRating(next, true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !online || !consent) return;
    setSubmitting(true);
    setError('');
    setSuccess(false);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role, company, rating, message, consent, website }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setError(result.error ?? (response.status === 503 ? UNAVAILABLE_MESSAGE : FIELDS_MESSAGE));
        return;
      }
      setName('');
      setRole('');
      setCompany('');
      setRating(0);
      setMessage('');
      setConsent(false);
      setWebsite('');
      setNearLimit(false);
      setSuccess(true);
    } catch {
      setError(UNAVAILABLE_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="feedback-page" aria-labelledby="feedback-title">
      <header className="feedback-intro">
        <span className="feedback-eyebrow">PusakaPosters</span>
        <h2 id="feedback-title">Bagikan masukan</h2>
        <p>Ceritakan pengalaman atau saran Anda. Masukan akan ditinjau sebelum ditampilkan di portfolio.</p>
      </header>

      <form className="feedback-card" onSubmit={submit} aria-busy={submitting}>
        {success && <div className="feedback-success" role="status">Terima kasih atas masukannya. Masukan Anda akan ditinjau terlebih dahulu sebelum tampil di portfolio Alfiz Ilham.</div>}
        {error && <div className="feedback-error" role="alert">{error}</div>}
        {!online && <div className="feedback-offline" role="status">Anda sedang offline. Sambungkan kembali ke internet untuk mengirim masukan.</div>}

        <div className="field">
          <label className="lbl" htmlFor="feedback-name">Nama</label>
          <input className="inp" id="feedback-name" name="name" autoComplete="name" maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} />
        </div>

        <div className="feedback-fields-row">
          <div className="field">
            <label className="lbl" htmlFor="feedback-role">Peran <em>(opsional)</em></label>
            <input className="inp" id="feedback-role" name="role" maxLength={80} value={role} onChange={(event) => setRole(event.target.value)} />
          </div>
          <div className="field">
            <label className="lbl" htmlFor="feedback-company">Instansi <em>(opsional)</em></label>
            <input className="inp" id="feedback-company" name="company" maxLength={80} value={company} onChange={(event) => setCompany(event.target.value)} />
          </div>
        </div>

        <fieldset className="feedback-rating">
          <legend className="lbl">Penilaian</legend>
          <div className="feedback-stars" role="radiogroup" aria-label="Penilaian dari 1 sampai 5">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} dari 5`}
                tabIndex={rating === value || (rating === 0 && value === 1) ? 0 : -1}
                data-rating={value}
                className={rating >= value ? 'feedback-star is-selected' : 'feedback-star'}
                onClick={() => chooseRating(value)}
                onKeyDown={(event) => onRatingKeyDown(event, value)}
              >
                <span aria-hidden="true">★</span>
              </button>
            ))}
            <span className="feedback-rating-value">{rating ? `${rating} dari 5` : 'Pilih 1–5'}</span>
          </div>
        </fieldset>

        <div className="field">
          <label className="lbl" htmlFor="feedback-message">Isi masukan</label>
          <textarea
            className="inp"
            id="feedback-message"
            name="message"
            minLength={5}
            maxLength={MAX_MESSAGE}
            required
            value={message}
            aria-describedby="feedback-count feedback-count-live"
            onChange={(event) => {
              setMessage(event.target.value);
              setNearLimit(event.target.value.length >= 1400);
            }}
          />
          <div id="feedback-count" className="feedback-count">{message.length}/{MAX_MESSAGE}</div>
          <span id="feedback-count-live" className="sr" aria-live="polite">{nearLimit ? 'Masukan mendekati batas 1500 karakter.' : ''}</span>
        </div>

        <label className="feedback-consent">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>Saya setuju masukan ini beserta nama dan peran saya ditampilkan di portfolio Alfiz Ilham.</span>
        </label>

        <div className="feedback-honeypot" aria-hidden="true">
          <label htmlFor="feedback-website">Website</label>
          <input id="feedback-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </div>

        <button className="btn primary block feedback-submit" type="submit" disabled={!consent || !online || submitting || !rating}>
          {submitting ? 'Mengirim...' : 'Kirim masukan'}
        </button>
      </form>
    </section>
  );
}
