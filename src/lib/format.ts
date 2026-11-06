import { APP_TZ_OFFSET_MS } from './constants';

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

export const initials = (name: string) => {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
};

export const fmtPhone = (digits: string) => digits.replace(/(\d{3,4})(?=\d)/g, '$1 ').trim();

export const maskPhone = (countryCode: string, digits: string) => `${countryCode} •••• ${digits.slice(-4)}`;

export const whatsappLink = (countryCode: string, digits: string) =>
  `https://wa.me/${countryCode.replace('+', '')}${digits}`;

/** "Hari ini, 14.20" / "Kemarin, 09.05" / "3 hari lalu" — selalu dalam WIB agar server & browser sama. */
export function formatWhen(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  const dayOf = (ms: number) => Math.floor((ms + APP_TZ_OFFSET_MS) / DAY_MS);
  const diff = dayOf(now) - dayOf(t);
  const w = new Date(t + APP_TZ_OFFSET_MS);
  const hm = `${pad(w.getUTCHours())}.${pad(w.getUTCMinutes())}`;
  if (diff <= 0) return `Hari ini, ${hm}`;
  if (diff === 1) return `Kemarin, ${hm}`;
  return `${diff} hari lalu`;
}
