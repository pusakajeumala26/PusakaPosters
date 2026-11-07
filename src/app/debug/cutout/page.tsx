'use client';

import { useEffect, useState } from 'react';
import { processPhoto, type PhotoResult } from '@/lib/photo';

const backgrounds = [
  { name: 'Putih', color: '#fff' },
  { name: 'Hitam', color: '#111' },
  { name: 'Abu-abu', color: '#888' },
  { name: 'Hijau', color: '#197a42' },
];

export default function CutoutDebugPage() {
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Pilih foto. Pemrosesan berlangsung di browser; foto tidak dikirim ke server.');

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.previewUrl); }, [result]);

  async function selectFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage('Memproses foto di perangkat…');
    try {
      const next = await processPhoto(file);
      setResult(next);
      setMessage(next.cutoutError ?? 'Cutout siap. Periksa halo pada keempat latar.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Foto gagal diproses.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 1050, margin: '0 auto', padding: '32px 20px', color: '#161616' }}>
      <h1 style={{ fontSize: 28, margin: '0 0 8px' }}>Debug cutout anggota</h1>
      <p style={{ color: '#666', margin: '0 0 20px' }}>{message}</p>
      <label style={{ display: 'inline-flex', minHeight: 48, alignItems: 'center', padding: '0 18px', borderRadius: 999, background: '#111', color: '#fff', cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? 'Memproses…' : 'Pilih foto lokal'}
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void selectFile(event.currentTarget.files?.[0])} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
      </label>
      {result && (
        <section aria-label="Pratinjau di empat latar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, marginTop: 24 }}>
          {backgrounds.map((background) => (
            <figure key={background.name} style={{ margin: 0, border: '1px solid #ddd', borderRadius: 16, overflow: 'hidden' }}>
              <figcaption style={{ padding: '10px 14px', fontWeight: 600 }}>{background.name}</figcaption>
              <div style={{ minHeight: 320, background: background.color, display: 'grid', placeItems: 'center', padding: 12 }}>
                {/* Local blob preview must stay local and bypass Next image optimization. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.previewUrl} alt={`Cutout di atas latar ${background.name.toLowerCase()}`} style={{ display: 'block', maxWidth: '100%', maxHeight: 480, objectFit: 'contain' }} />
              </div>
            </figure>
          ))}
        </section>
      )}
    </main>
  );
}
