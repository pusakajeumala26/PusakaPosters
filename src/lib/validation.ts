import { z } from 'zod';
import { COUNTRY_CODES, QUOTE_MAX } from './constants';
import { toTitleCase } from './format';

/** Hanya digit, tanpa nol di depan. "0812-3456" -> "8123456" */
export const normalizePhone = (v: string) => v.replace(/\D/g, '').replace(/^0+/, '');

export const memberFields = z.object({
  name: z.string().transform(toTitleCase).pipe(
    z.string().min(3, 'Tulis nama lengkap, minimal 3 huruf.').max(80, 'Nama terlalu panjang (maks. 80 huruf).'),
  ),
  countryCode: z.enum(COUNTRY_CODES, { errorMap: () => ({ message: 'Pilih kode negara.' }) }),
  phone: z
    .string()
    .transform(normalizePhone)
    .pipe(
      z
        .string()
        .min(8, 'Nomor terlalu pendek. Contoh: 812 3456 7890.')
        .max(15, 'Nomor terlalu panjang.'),
    ),
  quote: z
    .string()
    .trim()
    .min(1, 'Tulis satu kalimat untuk posternya.')
    .max(QUOTE_MAX, `Maksimal ${QUOTE_MAX} karakter.`),
  gender: z.enum(['L', 'P'], { errorMap: () => ({ message: 'Pilih gender.' }) }),
});

export const newMemberPassword = z
  .string()
  .min(4, 'Buat password minimal 4 karakter.')
  .max(72, 'Password maksimal 72 karakter.');

export const editMemberPassword = z
  .string()
  .min(4, 'Password baru minimal 4 karakter.')
  .max(72, 'Password maksimal 72 karakter.');

export const adminPassword = z
  .string()
  .min(8, 'Password admin minimal 8 karakter.')
  .max(72, 'Password maksimal 72 karakter.');

export const settingsPatch = z
  .object({
    letingName: z.string().trim().min(2, 'Nama leting minimal 2 huruf.').max(60, 'Nama leting terlalu panjang.'),
    target: z.number().int('Target harus bilangan bulat.').min(1, 'Target minimal 1.').max(5000, 'Target maksimal 5000.'),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid.').nullable(),
    uploadOpen: z.boolean(),
  })
  .partial();

export const statusPatch = z.object({ status: z.enum(['MASUK', 'DESAIN', 'SIAP', 'POSTING']) });
