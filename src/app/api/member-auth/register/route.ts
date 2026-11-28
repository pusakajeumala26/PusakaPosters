import { randomUUID } from 'node:crypto';
import { consumeAuthLimit, createMemberSession } from '@/lib/member-auth';
import { hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { assertSameOrigin, clientIp, formString, HttpError, json, route } from '@/lib/http';
import { normalizeToPng, normalizeToWebp } from '@/lib/image-server';
import { isUniqueViolation, optionalFile, parseMemberFields } from '@/lib/member-input';
import { slugify } from '@/lib/slug';
import { removePaths, uploadPng, uploadWebp } from '@/lib/supabase';
import { loadSettings } from '@/lib/settings';
import { newMemberPassword } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 30;

export const POST = route(async (req: Request) => {
  if (!req.headers.get('origin')) throw new HttpError(403, 'Permintaan ditolak.');
  assertSameOrigin(req);
  await consumeAuthLimit(`member-register:${clientIp(req)}`, 5, 60 * 60_000);
  if (!(await loadSettings()).uploadOpen) throw new HttpError(403, 'Pendaftaran dan upload sedang ditutup oleh panitia.');
  const form = await req.formData();
  const fields = parseMemberFields(form);
  const password = newMemberPassword.safeParse(formString(form.get('password')));
  if (!password.success) throw new HttpError(422, password.error.issues[0]?.message ?? 'Password tidak valid.');
  const original = await normalizeToWebp(form.get('original'), 'Foto');
  const cutoutFile = optionalFile(form.get('cutout'));
  const cutout = cutoutFile ? await normalizeToPng(cutoutFile, 'Foto tanpa latar') : null;
  const id = randomUUID();
  const folder = `${slugify(fields.name)}-${id.slice(0, 8)}`;
  const originalPath = `${folder}/original.webp`;
  const cutoutPath = cutout ? `${folder}/cutout.png` : null;
  const passwordHash = await hashPassword(password.data);
  try {
    await uploadWebp(originalPath, original);
    if (cutout && cutoutPath) await uploadPng(cutoutPath, cutout);
    await db.member.create({ data: {
      id, folder, name: fields.name, countryCode: fields.countryCode, phone: fields.phone,
      quote: fields.quote, gender: fields.gender, passwordHash, originalPath, cutoutPath,
    } });
  } catch (error) {
    await removePaths([originalPath, ...(cutoutPath ? [cutoutPath] : [])]).catch(() => undefined);
    if (isUniqueViolation(error)) throw new HttpError(409, 'Nomor ini sudah terdaftar. Masuk ke akunmu atau hubungi admin.');
    throw error;
  }
  await createMemberSession(id);
  return json({ ok: true }, 201);
});
