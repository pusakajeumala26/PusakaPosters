import { requireAdmin } from '@/lib/auth';
import { APP_TZ_OFFSET_MS } from '@/lib/constants';
import { db } from '@/lib/db';
import { route } from '@/lib/http';

export const runtime = 'nodejs';

const HEADER = [
  'Nama',
  'Gender',
  'Kode negara',
  'No HP (internasional)',
  'Subjek',
  'Status poster',
  'Diupload (WIB)',
  'Folder storage',
  'Foto asli',
  'Foto tanpa latar',
];

const STATUS_LABEL = { MASUK: 'Foto masuk', DESAIN: 'Didesain', SIAP: 'Siap posting', POSTING: 'Terposting' } as const;

/** Cegah formula injection di Excel/Sheets untuk teks bebas dari pengguna. */
const text = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
};

const wib = (d: Date) => new Date(d.getTime() + APP_TZ_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');

export const GET = route(async () => {
  await requireAdmin();
  const rows = await db.member.findMany({ orderBy: { createdAt: 'asc' } });
  const lines = rows.map((m) =>
    [
      text(m.name),
      m.gender === 'L' ? 'Laki-laki' : 'Perempuan',
      m.countryCode.replace('+', ''),
      `${m.countryCode.replace('+', '')}${m.phone}`,
      text(m.quote),
      STATUS_LABEL[m.status],
      wib(m.createdAt),
      text(m.folder),
      text(m.originalPath ?? ''),
      text(m.cutoutPath ?? ''),
    ].join(','),
  );
  const csv = '﻿' + [HEADER.map(text).join(','), ...lines].join('\r\n') + '\r\n';
  const stamp = new Date(Date.now() + APP_TZ_OFFSET_MS).toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pusakaposters-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
