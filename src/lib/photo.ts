import { MAX_IMAGE_SIDE, MAX_INPUT_BYTES, MAX_UPLOAD_TOTAL_BYTES } from './constants';
import { NoPersonError, getSegmenter, segmentPerson } from './segment';

export type Stage = 'baca' | 'model' | 'latar' | 'webp';

export const STAGE_LABEL: Record<Stage, string> = {
  baca: 'Membaca foto…',
  model: 'Memuat model (hanya pertama kali)…',
  latar: 'Menghapus latar belakang…',
  webp: 'Mengubah ke WebP…',
};

export type PhotoResult = {
  original: Blob;
  /** null jika penghapusan latar gagal; foto asli tetap bisa dikirim. */
  cutout: Blob | null;
  cutoutError: string | null;
  /** Object URL untuk pratinjau (tanpa latar jika ada, kalau tidak foto asli). Wajib di-revoke pemanggil. */
  previewUrl: string;
};

const canvasOf = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

async function decode(file: File): Promise<HTMLCanvasElement> {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar (JPG, PNG, atau WebP).');
  if (file.size > MAX_INPUT_BYTES) throw new Error('Foto terlalu besar (maks. 25 MB).');

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error('Foto tidak bisa dibuka. Gunakan JPG, PNG, atau WebP.');
    }
    // <img> + drawImage menghormati orientasi EXIF di browser modern.
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = canvasOf(img.naturalWidth * scale, img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Browser tidak mendukung pemrosesan gambar.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Tempel peta keyakinan orang sebagai kanal alpha pada foto. */
function applyPersonMask(src: HTMLCanvasElement, mask: ImageData): HTMLCanvasElement {
  const { width: w, height: h } = src;

  // MediaPipe menyimpan keyakinan di kanal alpha; kalau alpha rata, pakai kanal merah.
  let minA = 255;
  let maxA = 0;
  for (let i = 3; i < mask.data.length; i += 4) {
    const a = mask.data[i];
    if (a < minA) minA = a;
    if (a > maxA) maxA = a;
  }
  const channel = maxA - minA > 16 ? 3 : 0;

  const small = canvasOf(mask.width, mask.height);
  small.getContext('2d')!.putImageData(mask, 0, 0);
  const scaled = canvasOf(w, h);
  const sctx = scaled.getContext('2d', { willReadFrequently: true })!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(small, 0, 0, w, h);
  const m = sctx.getImageData(0, 0, w, h).data;

  const out = canvasOf(w, h);
  const octx = out.getContext('2d', { willReadFrequently: true })!;
  const img = src.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h);
  let covered = 0;
  for (let i = 0; i < w * h; i++) {
    const a = smoothstep(0.35, 0.65, m[i * 4 + channel] / 255);
    if (a > 0.5) covered++;
    img.data[i * 4 + 3] = Math.round(a * 255);
  }
  if (covered / (w * h) < 0.02) throw new NoPersonError();
  octx.putImageData(img, 0, 0);
  return out;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Gagal mengubah foto ke WebP.'))),
      'image/webp',
      quality,
    );
  });
}

function downscale(canvas: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const out = canvasOf(canvas.width * factor, canvas.height * factor);
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

/** Encode WebP; perkecil bertahap jika total ukuran melebihi batas body request. */
async function encodePair(original: HTMLCanvasElement, cutout: HTMLCanvasElement | null) {
  let o = original;
  let c = cutout;
  let q = 0.88;
  for (let attempt = 0; ; attempt++) {
    const [ob, cb] = await Promise.all([toBlob(o, q), c ? toBlob(c, q) : Promise.resolve(null)]);
    if (ob.size + (cb?.size ?? 0) <= MAX_UPLOAD_TOTAL_BYTES || attempt >= 4) return { ob, cb };
    o = downscale(o, 0.8);
    if (c) c = downscale(c, 0.8);
    q = Math.max(0.7, q - 0.05);
  }
}

/**
 * Alur lengkap di browser: baca foto -> hapus background (TensorFlow.js) ->
 * ubah foto asli & hasilnya ke WebP. Tidak ada yang dikirim ke server di sini.
 */
export async function processPhoto(file: File, onStage: (s: Stage) => void = () => {}): Promise<PhotoResult> {
  onStage('baca');
  const source = await decode(file);

  let cutoutCanvas: HTMLCanvasElement | null = null;
  let cutoutError: string | null = null;
  try {
    onStage('model');
    await getSegmenter();
    onStage('latar');
    const mask = await segmentPerson(source);
    cutoutCanvas = applyPersonMask(source, mask);
  } catch (e) {
    console.error('[photo] hapus background gagal:', e);
    cutoutError =
      e instanceof NoPersonError
        ? e.message
        : 'Penghapusan latar belakang gagal di perangkat ini. Foto asli tetap bisa dikirim.';
  }

  onStage('webp');
  const { ob, cb } = await encodePair(source, cutoutCanvas);
  return {
    original: ob,
    cutout: cb,
    cutoutError,
    previewUrl: URL.createObjectURL(cb ?? ob),
  };
}
