import sharp from 'sharp';
import { MAX_FILE_BYTES, MAX_IMAGE_SIDE } from './constants';
import { HttpError } from './http';

/**
 * Pastikan file dari browser benar-benar gambar dan berformat WebP.
 * Browser normalnya sudah mengirim WebP (lihat src/lib/photo.ts); jika tidak
 * (mis. Safari lama yang mengembalikan PNG dari canvas), server mengubahnya di sini.
 */
export async function normalizeToWebp(value: FormDataEntryValue | null, label: string): Promise<Buffer> {
  if (!(value instanceof File) || value.size === 0) throw new HttpError(422, `${label} wajib diisi.`);
  if (value.size > MAX_FILE_BYTES) throw new HttpError(413, `${label} terlalu besar (maks. 4 MB).`);

  const input = Buffer.from(await value.arrayBuffer());
  const opts = { failOn: 'error' as const, limitInputPixels: 40_000_000 };

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, opts).metadata();
  } catch {
    throw new HttpError(422, `${label} bukan gambar yang valid.`);
  }
  if (!meta.width || !meta.height) throw new HttpError(422, `${label} bukan gambar yang valid.`);
  if ((meta.pages ?? 1) > 1) throw new HttpError(422, `${label} tidak boleh animasi.`);

  if (meta.format === 'webp' && Math.max(meta.width, meta.height) <= MAX_IMAGE_SIDE + 400) return input;

  try {
    return await sharp(input, opts)
      .rotate()
      .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 100 })
      .toBuffer();
  } catch {
    throw new HttpError(422, `${label} tidak bisa diproses.`);
  }
}
