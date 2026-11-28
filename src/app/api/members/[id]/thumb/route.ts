import { HttpError, route } from '@/lib/http';

/** Retire the formerly public, long-lived cached thumbnail route. */
export const GET = route(async () => {
  throw new HttpError(410, 'Alamat thumbnail lama sudah dinonaktifkan.');
});
