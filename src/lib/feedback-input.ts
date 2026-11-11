/** Validasi isian feedback publik dan pengecekan magic byte foto. Murni; aman dipakai di server dan browser. */

export const FEEDBACK_ROLES = ['Anggota', 'Pengurus', 'Alumni', 'Pengunjung'] as const;
export const NAME_MAX = 80;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 1500;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type FeedbackFields = { name: string; role: string | null; message: string; rating: number };
export type FieldsResult = { ok: true; value: FeedbackFields } | { ok: false; message: string };

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const clean = (value: unknown) => (typeof value === 'string' ? value.replace(CONTROL, '') : '');

export function parseFeedbackFields(raw: {
  name?: unknown;
  role?: unknown;
  message?: unknown;
  rating?: unknown;
  consent?: unknown;
}): FieldsResult {
  const name = clean(raw.name).replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, message: 'Nama lengkap wajib diisi.' };
  if (name.length > NAME_MAX) return { ok: false, message: `Nama maksimal ${NAME_MAX} karakter.` };

  const roleText = clean(raw.role).trim();
  if (roleText && !(FEEDBACK_ROLES as readonly string[]).includes(roleText)) return { ok: false, message: 'Peran tidak dikenal.' };

  const message = clean(raw.message).replace(/\r\n?/g, '\n').trim();
  if (message.length < MESSAGE_MIN) return { ok: false, message: `Penilaian minimal ${MESSAGE_MIN} karakter.` };
  if (message.length > MESSAGE_MAX) return { ok: false, message: `Penilaian maksimal ${MESSAGE_MAX} karakter.` };

  const rating = typeof raw.rating === 'number' ? raw.rating : typeof raw.rating === 'string' && /^\d$/.test(raw.rating.trim()) ? Number(raw.rating) : NaN;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, message: 'Pilih penilaian bintang 1 sampai 5.' };

  const consent = raw.consent === true || raw.consent === 'true' || raw.consent === 'on';
  if (!consent) return { ok: false, message: 'Centang persetujuan agar masukan dapat dikirim.' };

  return { ok: true, value: { name, role: roleText || null, message, rating } };
}

/** Kenali jenis gambar dari byte pertama (bukan dari nama file atau Content-Type kiriman klien). */
export function sniffImage(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'png';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'webp';
  return null;
}

/** Inisial untuk avatar pengganti (tidak disimpan sebagai berkas). */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : '';
  return (first + last).toUpperCase();
}
