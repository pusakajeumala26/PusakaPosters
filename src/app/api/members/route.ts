import { randomUUID } from 'node:crypto';
import { hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { assertSameOrigin, clientIp, formString, HttpError, json, rateLimit, route } from '@/lib/http';
import { normalizeToWebp } from '@/lib/image-server';
import { isUniqueViolation, optionalFile, parseMemberFields } from '@/lib/member-input';
import { loadSettings } from '@/lib/settings';
import { slugify } from '@/lib/slug';
import { removePaths, uploadWebp } from '@/lib/supabase';
import { newMemberPassword } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Anggota upload data baru.
 * multipart/form-data: name, countryCode, phone, quote, gender, password,
 *   original (WebP), cutout (WebP tanpa latar, opsional jika model gagal).
 * File disimpan di bucket: <folder-anggota>/original.webp dan <folder-anggota>/cutout.webp
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  rateLimit(`upload:${clientIp(req)}`, 10, 10 * 60_000);

  const settings = await loadSettings();
  if (!settings.uploadOpen) throw new HttpError(403, 'Upload sedang ditutup oleh panitia.');

  const form = await req.formData();
  const fields = parseMemberFields(form);
  const password = newMemberPassword.safeParse(formString(form.get('password')));
  if (!password.success) throw new HttpError(422, password.error.issues[0]?.message ?? 'Password tidak valid.');

  const original = await normalizeToWebp(form.get('original'), 'Foto');
  const cutoutFile = optionalFile(form.get('cutout'));
  const cutout = cutoutFile ? await normalizeToWebp(cutoutFile, 'Foto tanpa latar') : null;

  const exists = await db.member.findUnique({
    where: { countryCode_phone: { countryCode: fields.countryCode, phone: fields.phone } },
    select: { id: true },
  });
  if (exists) throw new HttpError(409, 'Nomor ini sudah terdaftar. Buka kartumu lalu pilih edit jika ingin mengubah data.');

  const id = randomUUID();
  const folder = `${slugify(fields.name)}-${id.slice(0, 8)}`;
  const originalPath = `${folder}/original.webp`;
  const cutoutPath = cutout ? `${folder}/cutout.webp` : null;
  const passwordHash = await hashPassword(password.data);

  try {
    await uploadWebp(originalPath, original);
    if (cutout && cutoutPath) await uploadWebp(cutoutPath, cutout);
    await db.member.create({
      data: {
        id,
        folder,
        name: fields.name,
        countryCode: fields.countryCode,
        phone: fields.phone,
        quote: fields.quote,
        gender: fields.gender,
        passwordHash,
        originalPath,
        cutoutPath,
      },
    });
  } catch (e) {
    // Jangan tinggalkan file yatim di storage jika penyimpanan ke database gagal.
    await removePaths([originalPath, ...(cutoutPath ? [cutoutPath] : [])]).catch(() => {});
    if (isUniqueViolation(e)) throw new HttpError(409, 'Nomor ini sudah terdaftar.');
    throw e;
  }

  return json({ ok: true, id }, 201);
});
