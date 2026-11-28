import { checkAdmin } from './auth';
import { APP_TZ_OFFSET_MS } from './constants';
import { db } from './db';
import { HttpError } from './http';
import { signedUrls } from './supabase';
import { thumbPath } from './thumb';
import type { MemberView } from './types';

const DAY = 86_400_000;
export async function getAdminDashboardData() {
  if (!(await checkAdmin())) throw new HttpError(401, 'Sesi admin berakhir. Masuk lagi sebagai admin.');
  const today0 = Math.floor((Date.now() + APP_TZ_OFFSET_MS) / DAY) * DAY - APP_TZ_OFFSET_MS;
  const start = new Date(today0 - 13 * DAY);
  const [total, uploadRows, loginRows, latest] = await Promise.all([
    db.member.count(),
    db.member.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
    db.memberLoginEvent.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
    db.member.findMany({ orderBy: { createdAt: 'desc' }, take: 7 }),
  ]);
  const key = (date: Date) => new Date(date.getTime() + APP_TZ_OFFSET_MS).toISOString().slice(0, 10);
  const uploads = new Map<string, number>(), logins = new Map<string, number>();
  for (const row of uploadRows) { const k = key(row.createdAt); uploads.set(k, (uploads.get(k) ?? 0) + 1); }
  for (const row of loginRows) { const k = key(row.createdAt); logins.set(k, (logins.get(k) ?? 0) + 1); }
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(today0 - (13 - i) * DAY), day = key(date);
    return { day, label: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).format(date), uploads: uploads.get(day) ?? 0, logins: logins.get(day) ?? 0 };
  });
  const wanted = [...new Set(latest.flatMap(m => [m.cutoutPath, m.originalPath].filter((p): p is string => !!p)))];
  const urls = await signedUrls(wanted, 900);
  const recent: MemberView[] = latest.map(m => {
    const shown = m.cutoutPath ?? m.originalPath;
    return { id: m.id, name: m.name, quote: m.quote, gender: m.gender, countryCode: m.countryCode, phoneDisplay: '', status: m.status,
      createdAt: m.createdAt.toISOString(), photoUrl: shown ? urls[shown] ?? null : null, thumbUrl: thumbPath(m.id, m.updatedAt.getTime()), hasCutout: !!m.cutoutPath };
  });
  return { total, todayUploads: days[13].uploads, todayLogins: days[13].logins, days, recent };
}
