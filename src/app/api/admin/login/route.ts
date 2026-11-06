import { createAdminSession, verifyAdminPassword } from '@/lib/auth';
import { assertSameOrigin, clientIp, HttpError, json, rateLimit, readJson, route } from '@/lib/http';

export const runtime = 'nodejs';

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  rateLimit(`login:${clientIp(req)}`, 8, 10 * 60_000);

  const body = await readJson<{ password?: unknown }>(req);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password || !(await verifyAdminPassword(password))) throw new HttpError(401, 'Password admin salah. Coba lagi.');

  await createAdminSession();
  return json({ ok: true });
});
