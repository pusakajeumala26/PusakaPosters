import { createAdminSession, hashPassword, requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { assertSameOrigin, json, readJson, route } from '@/lib/http';
import { adminPassword } from '@/lib/validation';

export const runtime = 'nodejs';

/** Ganti password admin. Semua sesi lama (termasuk di perangkat lain) langsung tidak berlaku. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await requireAdmin();
  const body = await readJson<{ newPassword?: unknown }>(req);
  const newPassword = adminPassword.parse(typeof body.newPassword === 'string' ? body.newPassword : '');

  await db.setting.upsert({
    where: { id: 1 },
    create: { id: 1, adminPasswordHash: await hashPassword(newPassword), adminPwVersion: 1 },
    update: { adminPasswordHash: await hashPassword(newPassword), adminPwVersion: { increment: 1 } },
  });
  await createAdminSession(); // sesi perangkat ini tetap masuk dengan versi baru
  return json({ ok: true });
});
