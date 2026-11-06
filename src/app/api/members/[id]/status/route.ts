import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { assertSameOrigin, HttpError, json, readJson, route } from '@/lib/http';
import { statusPatch } from '@/lib/validation';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { id } = await ctx.params;
  const { status } = statusPatch.parse(await readJson(req));
  try {
    await db.member.update({ where: { id }, data: { status } });
  } catch {
    throw new HttpError(404, 'Data tidak ditemukan.');
  }
  return json({ ok: true });
});
