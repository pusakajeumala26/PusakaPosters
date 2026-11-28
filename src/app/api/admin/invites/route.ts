import { randomBytes } from 'node:crypto';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { hashInviteCode } from '@/lib/member-auth';
import { assertSameOrigin, json, route } from '@/lib/http';

export const runtime = 'nodejs';

/** Issue a one-time onboarding code. Plaintext is returned only in this response. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await requireAdmin();
  const hex = randomBytes(16).toString('hex').toUpperCase();
  const code = `PP-${hex.match(/.{1,4}/g)!.join('-')}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000);
  await db.enrollmentInvite.create({ data: { codeHash: hashInviteCode(code), expiresAt } });
  await db.enrollmentInvite.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60_000) } } });
  return json({ code, expiresAt: expiresAt.toISOString() }, 201);
});

