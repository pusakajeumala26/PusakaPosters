import { clearMemberSession } from '@/lib/member-auth';
import { assertSameOrigin, HttpError, json, route } from '@/lib/http';

export const runtime = 'nodejs';

export const POST = route(async (req: Request) => {
  if (!req.headers.get('origin')) throw new HttpError(403, 'Permintaan ditolak.');
  assertSameOrigin(req);
  await clearMemberSession();
  return json({ ok: true });
});

