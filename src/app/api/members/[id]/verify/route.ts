import { assertSameOrigin, HttpError, route } from '@/lib/http';

export const runtime = 'nodejs';

/** Retired legacy identity check; account access now requires an opaque member session. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  throw new HttpError(410, 'Gunakan halaman masuk untuk membuka akun anggota.');
});
