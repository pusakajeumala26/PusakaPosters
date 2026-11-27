import sharp from 'sharp';
import { checkAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { getMemberSession } from '@/lib/member-auth';
import { HttpError, route } from '@/lib/http';
import { downloadObject } from '@/lib/supabase';
import { parseThumbWidth } from '@/lib/thumb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** A private thumbnail may only be read by its owner or an admin. Never cache personal media. */
export const GET = route<Ctx>(async (req, ctx) => {
  const { id } = await ctx.params;
  const admin = await checkAdmin();
  const memberSession = admin ? null : await getMemberSession();
  if (!admin && memberSession?.memberId !== id) throw new HttpError(404, 'Foto tidak ditemukan.');
  const url = new URL(req.url);
  const width = parseThumbWidth(url.searchParams.get('w'));
  const member = await db.member.findUnique({ where: { id }, select: { cutoutPath: true, originalPath: true } });
  const path = member?.cutoutPath ?? member?.originalPath;
  if (!member || !path) throw new HttpError(404, 'Foto tidak ditemukan.');
  const source = await downloadObject(path);
  const body = await sharp(source, { failOn: 'error', limitInputPixels: 25_000_000 })
    .rotate().resize({ width, height: Math.round(width * 1.6), fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, alphaQuality: 90 }).toBuffer();
  return new Response(new Uint8Array(body), { headers: {
    'Content-Type': 'image/webp',
    'Cache-Control': 'private, no-store, max-age=0',
    'Vary': 'Cookie',
    'X-Content-Type-Options': 'nosniff',
  } });
});
