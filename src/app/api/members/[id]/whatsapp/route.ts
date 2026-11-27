import { db } from '@/lib/db';
import { whatsappLink } from '@/lib/format';
import { checkAdmin } from '@/lib/auth';
import { getMemberSession } from '@/lib/member-auth';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Redirect to the member's WhatsApp chat without exposing their number in page data. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const admin = await checkAdmin();
  const memberSession = admin ? null : await getMemberSession();
  if (!admin && memberSession?.memberId !== id) return Response.json({ error: 'Tidak diizinkan.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const member = await db.member.findUnique({
    where: { id },
    select: { countryCode: true, phone: true },
  });
  if (!member) return Response.json({ error: 'Data tidak ditemukan.' }, { status: 404 });

  return new Response(null, {
    status: 302,
    headers: {
      Location: whatsappLink(member.countryCode, member.phone),
      'Cache-Control': 'no-store',
    },
  });
}
