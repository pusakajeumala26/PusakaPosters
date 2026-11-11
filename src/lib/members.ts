import type { Member, Setting } from '@prisma/client';
import { APP_TZ, APP_TZ_OFFSET_MS } from './constants';
import { db } from './db';
import { fmtPhone, maskPhone } from './format';
import { signedUrls } from './supabase';
import { thumbPath } from './thumb';
import type { MemberView, SettingsView, Stats } from './types';

const DAY_MS = 86_400_000;
const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

async function safeSign(paths: string[]): Promise<Record<string, string>> {
  try {
    return await signedUrls(paths);
  } catch (e) {
    // Dashboard tetap tampil (dengan inisial) jika storage bermasalah.
    console.error('[storage] signed URL gagal:', e);
    return {};
  }
}

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

export async function listMembers(admin: boolean): Promise<MemberView[]> {
  const rows = await db.member.findMany({ orderBy: { createdAt: 'desc' } });
  const wanted = new Set<string>();
  for (const m of rows) {
    const shown = m.cutoutPath ?? m.originalPath;
    if (shown) wanted.add(shown);
    if (admin) {
      if (m.originalPath) wanted.add(m.originalPath);
      if (m.cutoutPath) wanted.add(m.cutoutPath);
    }
  }
  const urls = await safeSign([...wanted]);
  return rows.map((m) => toView(m, admin, urls));
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
