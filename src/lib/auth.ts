import { timingSafeEqual } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { jwtVerify, SignJWT } from 'jose';
import { requireEnv } from './env';
import { HttpError } from './http';
import { loadSettings } from './settings';

export const ADMIN_COOKIE = 'pp_admin';
const MAX_AGE_S = 60 * 60 * 12;

const secretKey = () => new TextEncoder().encode(requireEnv('SESSION_SECRET'));

/**
 * Password admin: hash di database (setelah diganti lewat Pengaturan),
 * atau ADMIN_PASSWORD dari env selama belum pernah diganti.
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const s = await loadSettings();
  if (s.adminPasswordHash) return bcrypt.compare(password, s.adminPasswordHash);
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createAdminSession() {
  const { adminPwVersion } = await loadSettings();
  const token = await new SignJWT({ role: 'admin', pv: adminPwVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secretKey());
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_S,
  });
}

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

async function checkAdminCookie(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (payload.role !== 'admin') return false;
    const { adminPwVersion } = await loadSettings();
    return payload.pv === adminPwVersion;
  } catch {
    return false;
  }
}

/** Untuk Server Components (satu pengecekan per request). */
export const isAdmin = cache(checkAdminCookie);

/** Untuk route handler (tanpa cache). */
export const checkAdmin = checkAdminCookie;

/** Untuk route handler: lempar 401 jika bukan admin. */
export async function requireAdmin() {
  if (!(await checkAdminCookie())) throw new HttpError(401, 'Sesi admin berakhir. Masuk lagi sebagai admin.');
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);
