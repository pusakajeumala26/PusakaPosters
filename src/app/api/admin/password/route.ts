import { checkAdmin, createAdminSession, hashPassword, requireSuperAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { assertSameOrigin, json, readJson, route } from '@/lib/http';
import { adminPassword } from '@/lib/validation';

export const runtime = 'nodejs';

/** Ganti password admin (butuh sesi super admin). Semua sesi admin lama langsung tidak berlaku. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await requireSuperAdmin();
  const body = await readJson<{ newPassword?: unknown }>(req);
  const newPassword = adminPassword.parse(typeof body.newPassword === 'string' ? body.newPassword : '');

  await db.setting.upsert({
    where: { id: 1 },
    create: { id: 1, adminPasswordHash: await hashPassword(newPassword), adminPwVersion: 1 },
    update: { adminPasswordHash: await hashPassword(newPassword), adminPwVersion: { increment: 1 } },
  });
  if (await checkAdmin()) await createAdminSession(); // sesi admin perangkat ini tetap masuk dengan versi baru
  return json({ ok: true });
});
