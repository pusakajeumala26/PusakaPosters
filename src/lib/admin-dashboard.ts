import { checkAdmin } from './auth';
import { APP_TZ_OFFSET_MS } from './constants';
import { db } from './db';
import { HttpError } from './http';
import { signedUrls } from './supabase';
import { thumbPath } from './thumb';
import type { MemberView } from './types';

const DAY = 86_400_000;
type DailyCount = { day: string; count: bigint };
export async function getAdminDashboardData() {
  if (!(await checkAdmin())) throw new HttpError(401, 'Sesi admin berakhir. Masuk lagi sebagai admin.');
  const today0 = Math.floor((Date.now() + APP_TZ_OFFSET_MS) / DAY) * DAY - APP_TZ_OFFSET_MS;
  const start = new Date(today0 - 13 * DAY);
  const [total, uploadRows, loginRows, latest] = await Promise.all([
    db.member.count(),
    db.$queryRawUnsafe<DailyCount[]>(`SELECT to_char(("createdAt" + interval '7 hours')::date, 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count FROM "Member" WHERE "createdAt" >= $1 GROUP BY 1`, start),
    db.$queryRawUnsafe<DailyCount[]>(`SELECT to_char(("createdAt" + interval '7 hours')::date, 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count FROM "MemberLoginEvent" WHERE "createdAt" >= $1 GROUP BY 1`, start),
    db.member.findMany({ orderBy: { createdAt: 'desc' }, take: 7 }),
  ]);
  const key = (date: Date) => new Date(date.getTime() + APP_TZ_OFFSET_MS).toISOString().slice(0, 10);
  const uploads = new Map(uploadRows.map(row => [row.day, Number(row.count)]));
  const logins = new Map(loginRows.map(row => [row.day, Number(row.count)]));
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(today0 - (13 - i) * DAY), day = key(date);
    return { day, label: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).format(date), uploads: uploads.get(day) ?? 0, logins: logins.get(day) ?? 0 };
  });
  const wanted = [...new Set(latest.flatMap(m => [m.cutoutPath, m.originalPath].filter((p): p is string => !!p)))];
  const urls = await signedUrls(wanted, 900);
  const recent: MemberView[] = latest.map(m => {
    const shown = m.cutoutPath ?? m.originalPath;
    return { id: m.id, name: m.name, quote: m.quote, gender: m.gender, countryCode: m.countryCode, phoneDisplay: '', status: m.status, createdAt: m.createdAt.toISOString(), photoUrl: shown ? urls[shown] ?? null : null, thumbUrl: thumbPath(m.id, m.updatedAt.getTime()), hasCutout: !!m.cutoutPath };
  });
  return { total, todayUploads: days[13].uploads, todayLogins: days[13].logins, days, recent };
}