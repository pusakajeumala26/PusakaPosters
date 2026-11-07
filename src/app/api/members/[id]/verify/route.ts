import { comparePassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { assertSameOrigin, clientIp, HttpError, json, rateLimit, readJson, route } from '@/lib/http';
import type { EditableMember } from '@/lib/types';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Cek password pemilik data. Jika cocok, kembalikan data yang boleh diedit (termasuk nomor lengkap). */
export const POST = route(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { id } = await ctx.params;
  rateLimit(`verify:${id}:${clientIp(req)}`, 8, 15 * 60_000);

  const body = await readJson<{ password?: unknown }>(req);
  const password = typeof body.password === 'string' ? body.password : '';
  const member = await db.member.findUnique({ where: { id } });
  // Pesan sama untuk "tidak ada" dan "salah" agar tidak membocorkan id yang valid.
  if (!member || !password || !(await comparePassword(password, member.passwordHash))) {
    throw new HttpError(403, 'Password tidak cocok dengan data ini.');
  }

  const editable: EditableMember = {
    name: member.name,
    countryCode: member.countryCode,
    phone: member.phone,
    gender: member.gender,
  };
  return json({ ok: true, member: editable });
});
