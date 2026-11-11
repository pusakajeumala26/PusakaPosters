import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from './env';

export const BUCKET = process.env.SUPABASE_BUCKET || 'member-photos';

let client: SupabaseClient | null = null;
let bucketReady: Promise<void> | null = null;

function storage() {
  client ??= createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client.storage;
}

/** Buat bucket private sekali per proses jika belum ada. */
function ensureBucket(): Promise<void> {
  bucketReady ??= (async () => {
    const s = storage();
    const { data } = await s.getBucket(BUCKET);
    if (data) {
      const allowed = data.allowed_mime_types ?? ['image/webp'];
      if (!allowed.includes('image/png')) {
        const { error } = await s.updateBucket(BUCKET, { public: data.public, allowedMimeTypes: [...allowed, 'image/png'] });
        if (error) throw new Error(`Bucket gagal diperbarui: ${error.message}`);
      }
      return;
    }
    const { error } = await s.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/webp', 'image/png'],
    });
    if (error && !/already exists/i.test(error.message)) throw new Error(`Bucket gagal dibuat: ${error.message}`);
  })().catch((e) => {
    bucketReady = null;
    throw e;
  });
  return bucketReady;
}

export async function uploadWebp(path: string, data: Buffer) {
  await ensureBucket();
  const { error } = await storage().from(BUCKET).upload(path, data, {
    contentType: 'image/webp',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw new Error(`Upload ke storage gagal: ${error.message}`);
}

export async function uploadPng(path: string, data: Buffer) {
  await ensureBucket();
  const { error } = await storage().from(BUCKET).upload(path, data, {
    contentType: 'image/png',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw new Error(`Upload ke storage gagal: ${error.message}`);
}

/** Unduh satu objek dari bucket (dipakai untuk membuat thumbnail di server). */
export async function downloadObject(path: string): Promise<Buffer> {
  const { data, error } = await storage().from(BUCKET).download(path);
  if (error || !data) throw new Error(`Gagal mengunduh dari storage: ${error?.message ?? 'tanpa data'}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function removePaths(paths: string[]) {
  if (!paths.length) return;
  await storage().from(BUCKET).remove(paths);
}

/** path -> URL bertanda tangan. Path yang gagal ditandatangani dilewati. */
export async function signedUrls(paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await storage().from(BUCKET).createSignedUrls(paths, expiresIn);
  if (error || !data) throw new Error(`Gagal membuat signed URL: ${error?.message ?? 'tanpa data'}`);
  const out: Record<string, string> = {};
  for (const item of data) if (item.path && item.signedUrl && !item.error) out[item.path] = item.signedUrl;
  return out;
}
