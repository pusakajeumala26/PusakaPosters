import { createAdminSession, hashPassword, requireAdmin, verifySuperAdminPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { assertSameOrigin, clientIp, HttpError, json, rateLimit, readJson, route } from '@/lib/http';
import { adminPassword } from '@/lib/validation';

export const runtime = 'nodejs';

/** Ganti password admin. Semua sesi lama (termasuk di perangkat lain) langsung tidak berlaku. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await requireAdmin();
  rateLimit(`super-admin-change:${clientIp(req)}`, 5, 15 * 60_000);
  if (!process.env.SUPER_ADMIN_PASSWORD) {
    throw new HttpError(503, 'Akses super admin belum dikonfigurasi di server.');
  }
  const body = await readJson<{ newPassword?: unknown; superAdminPassword?: unknown }>(req);
  const superAdminPassword = typeof body.superAdminPassword === 'string' ? body.superAdminPassword : '';
  if (!verifySuperAdminPassword(superAdminPassword)) throw new HttpError(403, 'Password super admin salah.');
  const newPassword = adminPassword.parse(typeof body.newPassword === 'string' ? body.newPassword : '');

  await db.setting.upsert({
    where: { id: 1 },
    create: { id: 1, adminPasswordHash: await hashPassword(newPassword), adminPwVersion: 1 },
    update: { adminPasswordHash: await hashPassword(newPassword), adminPwVersion: { increment: 1 } },
  });
  await createAdminSession(); // sesi perangkat ini tetap masuk dengan versi baru
  return json({ ok: true });
});
