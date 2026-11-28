import { createHash, randomBytes } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import type { Member } from '@/generated/prisma/client';
import { comparePassword } from './auth';
import { db } from './db';
import { HttpError } from './http';
import { normalizePhone } from './validation';

export const MEMBER_COOKIE = 'pp_member';
export const MEMBER_SESSION_DAYS = 30;
const MAX_AGE_S = MEMBER_SESSION_DAYS * 24 * 60 * 60;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export type MemberPrincipal = Pick<Member, 'id' | 'name' | 'countryCode' | 'phone' | 'gender' | 'quote' | 'status' | 'originalPath' | 'cutoutPath' | 'folder' | 'createdAt' | 'updatedAt'>;
export type MemberSessionView = { sessionId: string; memberId: string; member: MemberPrincipal };

/** Create a random bearer cookie while keeping only its digest in Postgres. */
export async function createMemberSession(memberId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + MAX_AGE_S * 1000);
  const session = await db.memberSession.create({ data: { tokenHash: digest(token), memberId, expiresAt } });
  (await cookies()).set(MEMBER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_S,
  });
  return session.id;
}

async function readMemberSession(): Promise<MemberSessionView | null> {
  const cookieJar = await cookies();
  const token = cookieJar.get(MEMBER_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await db.memberSession.findUnique({
    where: { tokenHash: digest(token) },
    include: { member: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.memberSession.delete({ where: { id: session.id } }).catch(() => undefined);
    cookieJar.delete(MEMBER_COOKIE);
    return null;
  }
  const { member, id, memberId } = session;
  return {
    sessionId: id,
    memberId,
    member: {
      id: member.id,
      name: member.name,
      countryCode: member.countryCode,
      phone: member.phone,
      gender: member.gender,
      quote: member.quote,
      status: member.status,
      originalPath: member.originalPath,
      cutoutPath: member.cutoutPath,
      folder: member.folder,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    },
  };
}

export const getMemberSession = cache(readMemberSession);

export async function requireMemberSession(): Promise<MemberSessionView> {
  const session = await readMemberSession();
  if (!session) throw new HttpError(401, 'Sesi anggota berakhir. Masuk kembali ke akunmu.');
  return session;
}

export async function clearMemberSession() {
  const cookieJar = await cookies();
  const token = cookieJar.get(MEMBER_COOKIE)?.value;
  if (token && token.length <= 100) {
    await db.memberSession.deleteMany({ where: { tokenHash: digest(token) } });
  }
  cookieJar.delete(MEMBER_COOKIE);
}

export async function revokeMemberSessions(memberId: string) {
  await db.memberSession.deleteMany({ where: { memberId } });
}

export async function authenticateMember(countryCode: string, phone: string, password: string) {
  const normalizedPhone = normalizePhone(phone);
  const member = await db.member.findUnique({ where: { countryCode_phone: { countryCode, phone: normalizedPhone } } });
  if (!member || !(await comparePassword(password, member.passwordHash))) return null;
  return member;
}

export const hashInviteCode = (code: string) => digest(code.replace(/[^a-z0-9]/gi, '').toUpperCase());

/** Database-backed fixed-window limiter, shared across serverless instances. */
export async function consumeAuthLimit(key: string, limit: number, windowMs: number) {
  const now = new Date();
  const nextReset = new Date(now.getTime() + windowMs);
  const keyHash = digest(key);
  const [bucket] = await db.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "AuthThrottle" ("keyHash", "count", "resetAt", "updatedAt")
    VALUES (${keyHash}, 1, ${nextReset}, ${now})
    ON CONFLICT ("keyHash") DO UPDATE SET
      "count" = CASE WHEN "AuthThrottle"."resetAt" <= ${now} THEN 1 ELSE LEAST("AuthThrottle"."count" + 1, ${limit + 1}) END,
      "resetAt" = CASE WHEN "AuthThrottle"."resetAt" <= ${now} THEN ${nextReset} ELSE "AuthThrottle"."resetAt" END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `;
  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000));
    throw new HttpError(429, `Terlalu banyak percobaan. Coba lagi sekitar ${Math.ceil(retryAfter / 60)} menit lagi.`, retryAfter);
  }
  if (Math.random() < 0.02) {
    await db.authThrottle.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } } }).catch(() => undefined);
  }
}

