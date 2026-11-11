import sharp from 'sharp';
import { db } from '@/lib/db';
import { HttpError, route } from '@/lib/http';
import { downloadObject } from '@/lib/supabase';
import { parseThumbWidth } from '@/lib/thumb';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable';
const SHORT = 'public, max-age=60, s-maxage=60';

/** Thumbnail WebP kecil dari foto anggota; hasilnya di-cache lama karena alamatnya memuat versi foto. */
export const GET = route<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const width = parseThumbWidth(url.searchParams.get('w'));
  const member = await db.member.findUnique({
    where: { id },
    select: { cutoutPath: true, originalPath: true, updatedAt: true },
  });
  const path = member?.cutoutPath ?? member?.originalPath;
  if (!member || !path) throw new HttpError(404, 'Foto tidak ditemukan.');

  const source = await downloadObject(path);
  const body = await sharp(source, { failOn: 'error', limitInputPixels: 25_000_000 })
    .rotate()
    .resize({ width, height: Math.round(width * 1.6), fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, alphaQuality: 90 })
    .toBuffer();

  const current = url.searchParams.get('v') === String(member.updatedAt.getTime());
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': current ? IMMUTABLE : SHORT,
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
