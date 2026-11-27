import type { Member, Setting } from '@prisma/client';
import { checkAdmin } from './auth';
import { APP_TZ, APP_TZ_OFFSET_MS } from './constants';
import { db } from './db';
import { fmtPhone, maskPhone } from './format';
import { signedUrls } from './supabase';
import { thumbPath } from './thumb';
import type { MemberView, SettingsView, Stats } from './types';
import { requireMemberSession } from './member-auth';
import { HttpError } from './http';

const DAY_MS = 86_400_000;
const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function toView(m: Member, admin: boolean, urls: Record<string, string>): MemberView {
  const shownPath = m.cutoutPath ?? m.originalPath;
  const view: MemberView = {
    id: m.id,
    name: m.name,
    quote: m.quote,
    gender: m.gender,
    countryCode: m.countryCode,
    phoneDisplay: admin ? `${m.countryCode} ${fmtPhone(m.phone)}` : maskPhone(m.countryCode, m.phone),
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    photoUrl: shownPath ? (urls[shownPath] ?? null) : null,
    thumbUrl: shownPath ? thumbPath(m.id, m.updatedAt.getTime()) : null,
    hasCutout: !!m.cutoutPath,
  };
  if (admin) {
    view.phone = m.phone;
    view.folder = m.folder;
    view.cutoutUrl = m.cutoutPath ? (urls[m.cutoutPath] ?? null) : null;
    view.cutoutPath = m.cutoutPath;
    view.originalUrl = m.originalPath ? (urls[m.originalPath] ?? null) : null;
  }
  return view;
}

export async function listMembers(): Promise<MemberView[]> {
  if (!(await checkAdmin())) throw new HttpError(401, 'Sesi admin berakhir. Masuk lagi sebagai admin.');
  const rows = await db.member.findMany({ orderBy: { createdAt: 'desc' } });
  const wanted = new Set<string>();
  for (const m of rows) {
    const shown = m.cutoutPath ?? m.originalPath;
    if (shown) wanted.add(shown);
    if (m.originalPath) wanted.add(m.originalPath);
    if (m.cutoutPath) wanted.add(m.cutoutPath);
  }
  // Fail closed if Storage cannot confirm the bucket is private or issue URLs.
  const urls = await signedUrls([...wanted], 3600);
  return rows.map((m) => toView(m, true, urls));
}

/** A single member profile, scoped by the caller before this function is used. */
export async function getMemberProfile(id: string): Promise<MemberView | null> {
  if (!(await checkAdmin())) {
    const session = await requireMemberSession();
    if (session.memberId !== id) throw new HttpError(404, 'Data tidak ditemukan.');
  }
  const member = await db.member.findUnique({ where: { id } });
  if (!member) return null;
  // Member profile uses the authenticated no-store thumbnail endpoint, not a
  // bearer signed storage URL that could linger in a shared browser cache.
  const view = toView(member, false, {});
  view.phoneDisplay = `${member.countryCode} ${fmtPhone(member.phone)}`;
  view.phone = member.phone;
  return view;
}

export async function getStats(settings: Setting): Promise<Stats> {
  const now = Date.now();
  const today0 = Math.floor((now + APP_TZ_OFFSET_MS) / DAY_MS) * DAY_MS - APP_TZ_OFFSET_MS; // 00:00 WIB dalam ms UTC
  const [count, recent] = await Promise.all([
    db.member.count(),
    db.member.findMany({ where: { createdAt: { gte: new Date(today0 - 6 * DAY_MS) } }, select: { createdAt: true } }),
  ]);
  const times = recent.map((r) => r.createdAt.getTime());
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = today0 - (6 - i) * DAY_MS;
    return {
      label: DAY_LABELS[new Date(start + APP_TZ_OFFSET_MS).getUTCDay()],
      n: times.filter((t) => t >= start && t < start + DAY_MS).length,
      today: i === 6,
    };
  });
  const target = Math.max(1, settings.target);
  return {
    count,
    target,
    pct: Math.min(100, Math.round((count / target) * 100)),
    left: Math.max(0, target - count),
    deadlineLabel: settings.deadline
      ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: APP_TZ }).format(settings.deadline)
      : 'Belum diatur',
    days,
  };
}

export function toSettingsView(s: Setting): SettingsView {
  return {
    letingName: s.letingName,
    target: s.target,
    deadline: s.deadline ? new Date(s.deadline.getTime() + APP_TZ_OFFSET_MS).toISOString().slice(0, 10) : '',
    uploadOpen: s.uploadOpen,
  };
}

export const deadlineFromInput = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T00:00:00+07:00`);
