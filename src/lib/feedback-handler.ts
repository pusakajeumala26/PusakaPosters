import { createHash } from 'node:crypto';
import { AVATAR_MAX_BYTES, parseFeedbackFields, type FeedbackFields } from './feedback-input';
import { assertSameOrigin, clientIp, HttpError, rateLimit } from './http';

const MAX_BODY_BYTES = AVATAR_MAX_BYTES + 64 * 1024;
const LIMIT = 3;
const WINDOW_MS = 10 * 60_000;
const UNAVAILABLE_MESSAGE = 'Masukan belum dapat disimpan saat ini. Coba lagi beberapa saat lagi.';

type Deps = {
  /** Simpan ke database (dan foto bila ada); mengembalikan id. */
  save: (fields: FeedbackFields, avatar: FormDataEntryValue | null) => Promise<string>;
  /** Jadwalkan pengiriman setelah respons dikirim. */
  schedule: (id: string) => void;
  limit?: typeof rateLimit;
  ipForRequest?: typeof clientIp;
  logCategory?: (category: string) => void;
};

const reply = (body: unknown, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers });

/**
 * POST multipart/form-data: name, role, message, rating, consent, avatar (opsional), website (honeypot).
 * Feedback disimpan lebih dulu; pengiriman ke portfolio terjadi di latar belakang lewat antrean.
 */
export function createFeedbackHandler({
  save,
  schedule,
  limit = rateLimit,
  ipForRequest = clientIp,
  logCategory = (category) => console.info('[feedback] result', category),
}: Deps) {
  return async (request: Request): Promise<Response> => {
    try {
      // Posters mewajibkan Origin yang sama untuk kiriman publik.
      if (!request.headers.get('origin')) throw new HttpError(403, 'Permintaan ditolak.');
      assertSameOrigin(request);
      const contentType = request.headers.get('content-type') ?? '';
      if (!/^multipart\/form-data\s*;/i.test(contentType)) throw new HttpError(415, 'Permintaan harus berupa form.');
      const declared = request.headers.get('content-length');
      if (declared && /^\d+$/.test(declared) && Number(declared) > MAX_BODY_BYTES) {
        throw new HttpError(413, 'Ukuran kiriman terlalu besar (foto maksimal 2 MB).');
      }

      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        throw new HttpError(400, 'Isian tidak dapat dibaca.');
      }

      const honeypot = form.get('website');
      if (typeof honeypot === 'string' && honeypot.trim() !== '') return reply({ ok: true });

      const text = (key: string) => {
        const value = form.get(key);
        return typeof value === 'string' ? value : undefined;
      };
      const parsed = parseFeedbackFields({
        name: text('name'),
        role: text('role'),
        message: text('message'),
        rating: text('rating'),
        consent: text('consent'),
      });
      if (!parsed.ok) return reply({ error: parsed.message }, 422);

      const ipDigest = createHash('sha256').update(ipForRequest(request)).digest('hex');
      try {
        limit(`feedback:${ipDigest}`, LIMIT, WINDOW_MS);
      } catch (error) {
        if (error instanceof HttpError && error.status === 429) {
          logCategory('rate-limited');
          return reply({ error: 'Terlalu banyak kiriman. Coba lagi beberapa saat lagi.' }, 429, { 'Retry-After': String(error.retryAfter ?? 600) });
        }
        throw error;
      }

      const id = await save(parsed.value, form.get('avatar'));
      logCategory('saved');
      schedule(id);
      return reply({ ok: true });
    } catch (error) {
      if (error instanceof HttpError) return reply({ error: error.message }, error.status);
      logCategory('unavailable');
      return reply({ error: UNAVAILABLE_MESSAGE }, 503);
    }
  };
}
