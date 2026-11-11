import { requireAdmin } from '@/lib/auth';
import { resendFeedback } from '@/lib/feedback-service';
import { assertSameOrigin, HttpError, json, route } from '@/lib/http';

export const runtime = 'nodejs';
export const maxDuration = 30;

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  assertSameOrigin(req);
  await requireAdmin();
  const { id } = await ctx.params;
  const outcome = await resendFeedback(id);
  if (outcome === 'not_found') throw new HttpError(404, 'Masukan tidak ditemukan atau sudah terkirim.');
  return json({ ok: true, outcome });
});
