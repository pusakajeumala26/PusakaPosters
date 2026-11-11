import { requireSuperAdmin } from '@/lib/auth';
import { getPortfolioStatus, runConnectionTest } from '@/lib/feedback-service';
import { assertSameOrigin, json, rateLimit, route } from '@/lib/http';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Tes read-only (tools/list): tidak membuat testimoni di portfolio. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await requireSuperAdmin();
  rateLimit('portfolio-test', 10, 60_000);
  const result = await runConnectionTest();
  return json({ result, status: await getPortfolioStatus() });
});
