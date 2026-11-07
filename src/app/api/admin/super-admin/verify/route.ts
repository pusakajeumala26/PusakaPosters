import { requireAdmin, verifySuperAdminPassword } from '@/lib/auth';
import { assertSameOrigin, clientIp, HttpError, json, rateLimit, readJson, route } from '@/lib/http';

export const runtime = 'nodejs';

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await requireAdmin();
  rateLimit(`super-admin:${clientIp(req)}`, 5, 15 * 60_000);

  if (!process.env.SUPER_ADMIN_PASSWORD) {
    throw new HttpError(503, 'Akses super admin belum dikonfigurasi di server.');
  }

  const body = await readJson<{ password?: unknown }>(req);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!verifySuperAdminPassword(password)) throw new HttpError(401, 'Password super admin salah.');

  return json({ ok: true });
});
