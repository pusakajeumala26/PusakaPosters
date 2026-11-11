import sharp from 'sharp';
import { AVATAR_MAX_BYTES, sniffImage } from './feedback-input';
import { HttpError } from './http';

export const AVATAR_SIDE = 256;

/** Foto profil: cek ukuran dan magic byte, lalu normalkan ke WebP persegi 256 px tanpa metadata. */
export async function normalizeAvatar(value: FormDataEntryValue | null): Promise<Buffer | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > AVATAR_MAX_BYTES) throw new HttpError(413, 'Foto terlalu besar (maksimal 2 MB).');
  const input = Buffer.from(await value.arrayBuffer());
  if (!sniffImage(input)) throw new HttpError(422, 'Foto harus berformat JPG, PNG, atau WebP.');
  try {
    return await sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize(AVATAR_SIDE, AVATAR_SIDE, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new HttpError(422, 'Foto tidak bisa diproses. Coba gambar lain.');
  }
}
