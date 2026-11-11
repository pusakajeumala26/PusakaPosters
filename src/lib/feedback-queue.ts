import { clampRoleForMcp } from './feedback-input';
import {
  packFailure,
  planAfterFailure,
  type DeliveryResult,
  type FeedbackInput,
} from './portfolio-feedback-core';

/**
 * Logika antrean pengiriman (murni; penyimpanan disuntik) supaya bisa diuji tanpa database.
 * Aturan: feedback sudah tersimpan lebih dulu; satu baris hanya dikirim oleh satu pemroses
 * (klaim atomik dengan lease), dan baris SENT tidak pernah dikirim lagi.
 */

export const LEASE_MS = 60_000;

export type SyncStatus = 'QUEUED' | 'SENT' | 'FAILED';

export type QueueRow = {
  id: string;
  name: string;
  role: string | null;
  message: string;
  rating: number;
  /** Sudah termasuk percobaan yang sedang berjalan. */
  attempts: number;
  /**
   * URL https publik PERMANEN foto profil, bila ada. Saat ini tidak ada: foto disimpan di bucket privat
   * (tanpa URL permanen), sehingga avatar_url tidak dikirim dan portfolio menampilkan inisial.
   */
  avatarUrl?: string | null;
};

export type QueueUpdate = {
  syncStatus: SyncStatus;
  lastError: string | null;
  lastAttemptAt: Date;
  nextAttemptAt: Date | null;
  remoteId?: string;
  sentAt?: Date;
};

export type QueueStore = {
  /** Atomik: hanya berhasil bila baris QUEUED dan sudah jatuh tempo; menaikkan attempts dan memasang lease. */
  claim: (id: string, now: Date, leaseUntil: Date) => Promise<QueueRow | null>;
  finish: (id: string, update: QueueUpdate) => Promise<void>;
};

export type DeliverOutcome = 'sent' | 'queued' | 'failed' | 'skipped';

export const toMcpInput = (row: QueueRow, project: string): FeedbackInput => ({
  name: row.name,
  message: row.message,
  rating: row.rating,
  ...(row.role ? { role: clampRoleForMcp(row.role) } : {}),
  project,
  // Id feedback lokal sebagai kunci idempotensi: kirim ulang dengan key yang sama aman (duplicate: true = berhasil).
  idempotency_key: row.id,
  ...(row.avatarUrl ? { avatar_url: row.avatarUrl } : {}),
});

export async function deliverOne(
  store: QueueStore,
  id: string,
  send: (input: FeedbackInput) => Promise<DeliveryResult>,
  project: string,
  now: Date = new Date(),
  rand: () => number = Math.random,
): Promise<DeliverOutcome> {
  const row = await store.claim(id, now, new Date(now.getTime() + LEASE_MS));
  if (!row) return 'skipped';

  let result: DeliveryResult;
  try {
    result = await send(toMcpInput(row, project));
  } catch {
    result = { ok: false, kind: 'network' };
  }

  if (result.ok) {
    await store.finish(id, {
      syncStatus: 'SENT',
      lastError: null,
      lastAttemptAt: now,
      nextAttemptAt: null,
      remoteId: result.remoteId,
      sentAt: now,
    });
    return 'sent';
  }

  const plan = planAfterFailure(result, row.attempts, now, rand);
  await store.finish(id, {
    syncStatus: plan.status === 'queued' ? 'QUEUED' : 'FAILED',
    lastError: packFailure(result.kind, result.detail),
    lastAttemptAt: now,
    nextAttemptAt: plan.nextAttemptAt,
  });
  return plan.status === 'queued' ? 'queued' : 'failed';
}
