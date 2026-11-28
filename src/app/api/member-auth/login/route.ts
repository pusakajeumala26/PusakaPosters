import { authenticateMember, consumeAuthLimit, createMemberSession } from '@/lib/member-auth';
import { COUNTRY_CODES } from '@/lib/constants';
import { assertSameOrigin, clientIp, HttpError, json, readJson, route } from '@/lib/http';
import { normalizePhone } from '@/lib/validation';

export const runtime = 'nodejs';

export const POST = route(async (req: Request) => {
  if (!req.headers.get('origin')) throw new HttpError(403, 'Permintaan ditolak.');
  assertSameOrigin(req);
  const body = await readJson<{ countryCode?: unknown; phone?: unknown; password?: unknown }>(req);
  const countryCode = typeof body.countryCode === 'string' && (COUNTRY_CODES as readonly string[]).includes(body.countryCode) ? body.countryCode : '';
  const phone = typeof body.phone === 'string' ? normalizePhone(body.phone) : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!countryCode || phone.length < 8 || phone.length > 15 || !password || password.length > 72) {
    throw new HttpError(401, 'Nomor telepon atau password tidak cocok.');
  }
  await consumeAuthLimit(`member-login:${clientIp(req)}:${countryCode}:${phone}`, 8, 15 * 60_000);
  await consumeAuthLimit(`member-login-ip:${clientIp(req)}`, 30, 15 * 60_000);
  const member = await authenticateMember(countryCode, phone, password);
  if (!member) throw new HttpError(401, 'Nomor telepon atau password tidak cocok.');
  await createMemberSession(member.id);
  return json({ ok: true });
});

