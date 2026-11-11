import { createHash } from 'node:crypto';
import { z } from 'zod';
import { clientIp, HttpError, json, rateLimit } from './http';
import type { FeedbackInput, FeedbackResult } from './portfolio-feedback';

const MAX_BODY_BYTES = 8 * 1024;
const LIMIT = 3;
const WINDOW_MS = 10 * 60_000;
const FRIENDLY_ERROR = 'Masukan belum dapat dikirim saat ini. Coba lagi beberapa saat lagi.';

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value.replace(/\s+/g, ' ')).transform((value) => value || undefined).optional();
const schema = z.object({
  name: z.string().transform((value) => value.trim().replace(/\s+/g, ' ')).pipe(z.string().min(1).max(80)),
  message: z.string().trim().min(5).max(1500),
  rating: z.number().int().min(1).max(5),
  role: optionalText(80),
  company: optionalText(80),
  consent: z.literal(true),
  website: z.string().optional(),
});

type FeedbackBody = z.infer<typeof schema>;
type Submit = (input: FeedbackInput) => Promise<FeedbackResult>;

async function readBody(request: Request): Promise<unknown> {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    throw new HttpError(415, 'Permintaan harus menggunakan JSON.');
  }
  const declaredSize = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) throw new HttpError(413, 'Isian terlalu besar.');
  if (!request.body) throw new HttpError(400, 'Body permintaan tidak valid.');

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new HttpError(413, 'Isian terlalu besar.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new HttpError(400, 'Body permintaan harus berupa JSON yang valid.');
  }
}

function responseFor(result: FeedbackResult): Response {
  switch (result.status) {
    case 'ok':
      return json({ ok: true });
    case 'invalid':
      return json({ error: 'Periksa kembali isian masukan.' }, 400);
    case 'rate-limited':
      return new Response(JSON.stringify({ error: 'Terlalu banyak kiriman. Coba lagi dalam 10 menit.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': '60', 'Cache-Control': 'no-store' },
      });
    case 'unauthorized':
    case 'unavailable':
    case 'not-configured':
      return json({ error: FRIENDLY_ERROR }, 503);
  }
}

function noStore(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

/** Factory keeps the public route testable without contacting the portfolio MCP. */
export function createFeedbackHandler(submit: Submit) {
  return async function POST(request: Request): Promise<Response> {
    try {
      const origin = request.headers.get('origin');
      const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
      if (!origin || !host) throw new HttpError(403, 'Permintaan ditolak.');
      let originUrl: URL;
      let expectedOrigin: URL;
      try {
        originUrl = new URL(origin);
        const protocol = (request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || new URL(request.url).protocol).replace(/:?$/, ':');
        expectedOrigin = new URL(`${protocol}//${host}`);
      } catch { throw new HttpError(403, 'Permintaan ditolak.'); }
      if (!['http:', 'https:'].includes(originUrl.protocol) || originUrl.origin !== expectedOrigin.origin) throw new HttpError(403, 'Permintaan ditolak.');
      const raw = await readBody(request);
      if (raw && typeof raw === 'object' && typeof (raw as { website?: unknown }).website === 'string' && (raw as { website: string }).website.trim()) {
        // Honeypot submissions are intentionally acknowledged without forwarding to MCP.
        return noStore(json({ ok: true }));
      }
      const parsed = schema.safeParse(raw);
      if (!parsed.success) return noStore(json({ error: 'Periksa kembali isian masukan.' }, 400));
      const { consent: _consent, website: _website, ...fields } = parsed.data as FeedbackBody;

      const ipHash = createHash('sha256').update(clientIp(request)).digest('hex');
      try {
        rateLimit(`feedback:${ipHash}`, LIMIT, WINDOW_MS);
      } catch (error) {
        if (error instanceof HttpError && error.status === 429) {
          return new Response(JSON.stringify({ error: 'Terlalu banyak kiriman. Coba lagi beberapa saat lagi.' }), {
            status: 429,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Retry-After': String(error.retryAfter ?? 600),
              'Cache-Control': 'no-store',
            },
          });
        }
        throw error;
      }

      const input: FeedbackInput = { name: fields.name, message: fields.message, rating: fields.rating, project: 'PusakaPosters' };
      if (fields.role) input.role = fields.role;
      if (fields.company) input.company = fields.company;
      return noStore(responseFor(await submit(input)));
    } catch (error) {
      if (error instanceof HttpError) {
        const response = json({ error: error.status === 429 ? 'Terlalu banyak kiriman. Coba lagi beberapa saat lagi.' : error.message }, error.status);
        if (error.retryAfter) response.headers.set('Retry-After', String(error.retryAfter));
        return noStore(response);
      }
      return noStore(json({ error: FRIENDLY_ERROR }, 503));
    }
  };
}
