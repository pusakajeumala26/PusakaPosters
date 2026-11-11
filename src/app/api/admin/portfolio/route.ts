import { requireSuperAdmin } from '@/lib/auth';
import { getPortfolioStatus, savePortfolioConnection } from '@/lib/feedback-service';
import { assertSameOrigin, HttpError, json, readJson, route } from '@/lib/http';

export const runtime = 'nodejs';

/** Status koneksi untuk admin. API key tidak pernah dikembalikan, hanya empat karakter terakhir. */
export const GET = route(async () => {
  await requireSuperAdmin();
  return json(await getPortfolioStatus());
});

export const PATCH = route(async (req: Request) => {
  assertSameOrigin(req);
  await requireSuperAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const result = await savePortfolioConnection({
    url: str(body.url),
    apiKey: str(body.apiKey),
    connected: typeof body.connected === 'boolean' ? body.connected : undefined,
    clearKey: body.clearKey === true,
  });
  if (!result.ok) throw new HttpError(422, result.message);
  return json(await getPortfolioStatus());
});
