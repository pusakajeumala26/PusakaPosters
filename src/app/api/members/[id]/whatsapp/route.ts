import { db } from '@/lib/db';
import { whatsappLink } from '@/lib/format';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Redirect to the member's WhatsApp chat without exposing their number in page data. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
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
