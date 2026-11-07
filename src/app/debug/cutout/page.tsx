'use client';

import { useEffect, useState } from 'react';
import { processPhoto, type PhotoResult } from '@/lib/photo';

const backgrounds = [
  { name: 'Putih', color: '#fff' },
  { name: 'Hitam', color: '#111' },
  { name: 'Abu-abu', color: '#888' },
  { name: 'Hijau', color: '#197a42' },
];

async function measureEdgeSpill(sourceFile: File, cutout: Blob) {
  const [source, result] = await Promise.all([createImageBitmap(sourceFile), createImageBitmap(cutout)]);
  try {
    const sample = document.createElement('canvas');
    sample.width = source.width;
    sample.height = source.height;
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true })!;
    sampleCtx.drawImage(source, 0, 0);
    const sourcePixels = sampleCtx.getImageData(0, 0, source.width, source.height).data;
    const corners: number[][] = [];
    const tile = Math.min(24, Math.floor(Math.min(source.width, source.height) / 4));
    for (const [left, top] of [[0, 0], [source.width - tile, 0], [0, source.height - tile], [source.width - tile, source.height - tile]]) {
      const channels: [number[], number[], number[]] = [[], [], []];
      for (let y = top; y < top + tile; y++) for (let x = left; x < left + tile; x++) {
        const i = (y * source.width + x) * 4;
        channels[0].push(sourcePixels[i]); channels[1].push(sourcePixels[i + 1]); channels[2].push(sourcePixels[i + 2]);
      }
      corners.push(channels.map((values) => {
        values.sort((a, b) => a - b);
        return values[Math.floor(values.length / 2)];
      }));
    }
    const background = [0, 1, 2].map((channel) => corners.map((corner) => corner[channel]).sort((a, b) => a - b)[2]);
    const dominant = background.indexOf(Math.max(...background));
    const canvas = document.createElement('canvas');
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(result, 0, 0);
    const pixels = ctx.getImageData(0, 0, result.width, result.height).data;
    const stride = result.width;
    let edge = 0;
    let fringe = 0;
    let maxDominance = 0;
    for (let y = 1; y < result.height - 1; y++) for (let x = 1; x < result.width - 1; x++) {
      const i = (y * stride + x) * 4;
      const alpha = pixels[i + 3];
      let edgePixel = alpha > 0 && alpha < 255;
      for (let dy = -2; dy <= 2 && !edgePixel; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (pixels[((y + dy) * stride + x + dx) * 4 + 3] < 32) { edgePixel = alpha > 0; break; }
      }
      if (!edgePixel) continue;
      edge++;
      const dominance = pixels[i + dominant] - (pixels[i + ((dominant + 1) % 3)] + pixels[i + ((dominant + 2) % 3)]) / 2;
      const visibleDominance = dominance * alpha / 255;
      maxDominance = Math.max(maxDominance, visibleDominance);
      if (visibleDominance > 14) fringe++;
    }
    return { backgroundColor: ['merah', 'hijau', 'biru'][dominant], edgePixels: edge, fringePixels: fringe, maxDominance: Math.round(maxDominance * 10) / 10 };
  } finally {
    source.close();
    result.close();
  }
}

export default function CutoutDebugPage() {
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [metrics, setMetrics] = useState<{ backgroundColor: string; edgePixels: number; fringePixels: number; maxDominance: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Pilih foto. Pemrosesan berlangsung di browser; foto tidak dikirim ke server.');

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.previewUrl); }, [result]);

  async function selectFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage('Memproses foto di perangkat…');
    try {
      const next = await processPhoto(file);
      const nextMetrics = next.cutout ? await measureEdgeSpill(file, next.cutout) : null;
      setResult(next);
      setMetrics(nextMetrics);
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
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          void selectFile(file);
        }} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
      </label>
      {result && (
        <>
        {metrics && <p>Fringe latar {metrics.backgroundColor}: {metrics.fringePixels} dari {metrics.edgePixels} piksel tepi dengan dominasi tampak di atas 14; maksimum {metrics.maxDominance}.</p>}
        {result.cutout && <a href={result.previewUrl} download="pusakaposters-cutout.png" style={{ display: 'inline-flex', marginTop: 12, minHeight: 44, alignItems: 'center', padding: '0 16px', border: '1px solid #aaa', borderRadius: 999, color: '#161616', textDecoration: 'none' }}>Unduh cutout PNG</a>}
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
        </>
      )}
    </main>
  );
}
