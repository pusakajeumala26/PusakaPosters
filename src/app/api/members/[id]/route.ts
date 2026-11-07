import { checkAdmin, comparePassword, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { assertSameOrigin, clientIp, formString, HttpError, json, rateLimit, route } from '@/lib/http';
import { normalizeToPng, normalizeToWebp } from '@/lib/image-server';
import { isUniqueViolation, optionalFile, parseMemberFields } from '@/lib/member-input';
import { removePaths, uploadPng, uploadWebp } from '@/lib/supabase';
import { editMemberPassword } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * Edit data anggota. Boleh dilakukan admin (cookie sesi) atau pemilik data
 * (field currentPassword harus cocok). Foto opsional; jika foto baru dikirim
 * tanpa cutout, cutout lama dihapus supaya tidak tertinggal foto orang lain/lama.
 */
export const PATCH = route(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { id } = await ctx.params;
  const form = await req.formData();

  const member = await db.member.findUnique({ where: { id } });
  if (!member) throw new HttpError(404, 'Data tidak ditemukan.');

  if (!(await checkAdmin())) {
    rateLimit(`edit:${id}:${clientIp(req)}`, 8, 15 * 60_000);
    const current = formString(form.get('currentPassword'));
    if (!current || !(await comparePassword(current, member.passwordHash))) {
      throw new HttpError(403, 'Password tidak cocok dengan data ini.');
    }
  }

  const fields = parseMemberFields(form);
  const newPw = formString(form.get('password'));
  const passwordHash = newPw ? await hashPassword(editMemberPassword.parse(newPw)) : undefined;

  const clash = await db.member.findFirst({
    where: { countryCode: fields.countryCode, phone: fields.phone, NOT: { id } },
    select: { id: true },
  });
  if (clash) throw new HttpError(409, 'Nomor ini sudah dipakai anggota lain.');

  const originalFile = optionalFile(form.get('original'));
  const cutoutFile = optionalFile(form.get('cutout'));
  const original = originalFile ? await normalizeToWebp(originalFile, 'Foto') : null;
  const cutout = cutoutFile ? await normalizeToPng(cutoutFile, 'Foto tanpa latar') : null;

  const originalPath = `${member.folder}/original.webp`;
  const cutoutPath = `${member.folder}/cutout.png`;
  let nextOriginalPath = member.originalPath;
  let nextCutoutPath = member.cutoutPath;
  let oldCutoutPath: string | null = null;

  if (original) {
    await uploadWebp(originalPath, original);
    nextOriginalPath = originalPath;
  }
  if (cutout) {
    await uploadPng(cutoutPath, cutout);
    nextCutoutPath = cutoutPath;
    if (member.cutoutPath && member.cutoutPath !== cutoutPath) oldCutoutPath = member.cutoutPath;
  } else if (original && member.cutoutPath) {
    await removePaths([member.cutoutPath]).catch(() => {});
    nextCutoutPath = null;
  }

  try {
    await db.member.update({
      where: { id },
      data: {
        name: fields.name,
        countryCode: fields.countryCode,
        phone: fields.phone,
        gender: fields.gender,
        originalPath: nextOriginalPath,
        cutoutPath: nextCutoutPath,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, 'Nomor ini sudah dipakai anggota lain.');
    throw e;
  }

  if (oldCutoutPath) await removePaths([oldCutoutPath]).catch(() => {});

  return json({ ok: true });
});
