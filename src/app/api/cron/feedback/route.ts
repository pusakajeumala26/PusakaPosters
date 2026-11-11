import { timingSafeEqual } from 'node:crypto';
import { checkAdmin } from '@/lib/auth';
import { processDueFeedback } from '@/lib/feedback-service';
import { json, route } from '@/lib/http';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function validCronSecret(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get('authorization') ?? '';
  if (!secret) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Dipanggil Vercel Cron (Authorization: Bearer CRON_SECRET) atau admin yang sedang masuk. */
export const GET = route(async (req: Request) => {
  if (!validCronSecret(req) && !(await checkAdmin())) return json({ error: 'Tidak diizinkan.' }, 401);
  return json(await processDueFeedback());
});
