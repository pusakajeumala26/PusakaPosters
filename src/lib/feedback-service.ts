import { randomUUID } from 'node:crypto';
import { db } from './db';
import { removePaths, signedUrls, uploadWebp } from './supabase';
import { decryptSecret, encryptSecret, keyHint } from './portfolio-secret';
import {
  describeFailure,
  describeStoredFailure,
  parseMcpUrl,
  submitPortfolioFeedback,
  testPortfolioConnection,
  type McpConfig,
} from './portfolio-feedback-core';
import { deliverOne, type QueueStore } from './feedback-queue';
import type { FeedbackFields } from './feedback-input';
import type { FeedbackRowView, PortfolioStatus } from './feedback-types';

export const PROJECT_NAME = 'PusakaPosters';
export const AVATAR_PREFIX = 'feedback/';

if (typeof window !== 'undefined') throw new Error('Feedback service may only be used on the server.');
const PROCESS_BATCH = 5;
const PROCESS_BUDGET_MS = 40_000;

/* ------------------------------ koneksi ------------------------------ */

export type ConnectionState =
  | { state: 'ready'; config: McpConfig }
  | { state: 'disconnected' }
  | { state: 'unreadable' };

const sessionSecret = () => process.env.SESSION_SECRET ?? '';

const ensureConnectionRow = () => db.portfolioConnection.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

/** Konfigurasi siap pakai hanya bila sakelar Sambung menyala dan key terbaca. Tes koneksi boleh meski belum tersambung. */
export async function loadConnection(options: { ignoreSwitch?: boolean } = {}): Promise<ConnectionState> {
  const row = await db.portfolioConnection.findUnique({ where: { id: 1 } });
  if (!row?.url || !row.keyEnc) return { state: 'disconnected' };
  if (!row.connected && !options.ignoreSwitch) return { state: 'disconnected' };
  try {
    return { state: 'ready', config: { url: row.url, apiKey: decryptSecret(row.keyEnc, sessionSecret()) } };
  } catch {
    return { state: 'unreadable' };
  }
}

export async function getPortfolioStatus(): Promise<PortfolioStatus> {
  const row = await ensureConnectionRow();
  const counts = await db.feedback.groupBy({ by: ['syncStatus'], _count: { _all: true } });
  const count = (status: 'QUEUED' | 'FAILED' | 'SENT') => counts.find((c) => c.syncStatus === status)?._count._all ?? 0;
  let keyUnreadable = false;
  if (row.keyEnc) {
    try { decryptSecret(row.keyEnc, sessionSecret()); } catch { keyUnreadable = true; }
  }
  return {
    url: row.url ?? '',
    hasKey: Boolean(row.keyEnc),
    keyHint: row.keyHint,
    connected: row.connected,
    keyUnreadable,
    lastTest: row.lastTestAt
      ? { at: row.lastTestAt.toISOString(), ok: row.lastTestOk === true, kind: row.lastTestKind, ms: row.lastTestMs, note: row.lastTestNote }
      : null,
    queue: { queued: count('QUEUED'), failed: count('FAILED'), sent: count('SENT') },
  };
}

export type ConnectionPatch = { url?: string; apiKey?: string; connected?: boolean; clearKey?: boolean };

/** Simpan URL/key/sakelar. Mengembalikan pesan galat (bahasa Indonesia) bila ditolak. */
export async function savePortfolioConnection(patch: ConnectionPatch): Promise<{ ok: true } | { ok: false; message: string }> {
  const row = await ensureConnectionRow();
  const data: Record<string, unknown> = {};

  if (patch.url !== undefined) {
    const parsed = parseMcpUrl(patch.url);
    if (!parsed.ok) return { ok: false, message: parsed.message };
    if (parsed.url !== row.url) Object.assign(data, { url: parsed.url, lastTestAt: null, lastTestOk: null, lastTestKind: null, lastTestMs: null, lastTestNote: null });
  }
  if (patch.clearKey) {
    Object.assign(data, { keyEnc: null, keyHint: null, connected: false });
  } else if (patch.apiKey !== undefined) {
    const key = patch.apiKey.trim();
    if (key.length < 8 || key.length > 300 || /\s/.test(key)) return { ok: false, message: 'API key tidak valid.' };
    if (!sessionSecret()) return { ok: false, message: 'SESSION_SECRET belum diisi di server.' };
    Object.assign(data, { keyEnc: encryptSecret(key, sessionSecret()), keyHint: keyHint(key), lastTestAt: null, lastTestOk: null, lastTestKind: null, lastTestMs: null, lastTestNote: null });
  }
  if (patch.connected !== undefined) {
    const url = (data.url as string | undefined) ?? row.url;
    const hasKey = data.keyEnc !== undefined ? Boolean(data.keyEnc) : Boolean(row.keyEnc);
    if (patch.connected && (!url || !hasKey)) return { ok: false, message: 'Isi URL MCP dan API key sebelum menyambungkan.' };
    if (!patch.clearKey) data.connected = patch.connected;
  }
  if (Object.keys(data).length) await db.portfolioConnection.update({ where: { id: 1 }, data });
  return { ok: true };
}

export async function runConnectionTest() {
  await ensureConnectionRow();
  const connection = await loadConnection({ ignoreSwitch: true });
  if (connection.state !== 'ready') {
    const note = connection.state === 'unreadable'
      ? 'API key tersimpan tidak bisa dibaca (SESSION_SECRET berubah). Masukkan ulang key.'
      : 'URL MCP atau API key belum diisi.';
    await db.portfolioConnection.update({ where: { id: 1 }, data: { lastTestAt: new Date(), lastTestOk: false, lastTestKind: 'config', lastTestMs: null, lastTestNote: note } });
    return { ok: false as const, kind: 'config', note };
  }
  const result = await testPortfolioConnection(connection.config);
  let note: string;
  if (!result.ok) {
    const reason = describeFailure(result.kind);
    note = result.stage === 'health'
      ? `Server portfolio tidak terjangkau (health check tanpa key). ${reason}`
      : `Server terjangkau, tetapi permintaan dengan key gagal. ${reason}`;
  } else if (result.scopeMissing) note = 'Server terjangkau dan key diterima, tetapi daftar tool kosong: key tidak punya scope feedback:write.';
  else if (result.toolFound === false) note = 'Terhubung, tetapi tool submit_feedback tidak ditemukan di server portfolio.';
  else if (result.toolFound === null) note = 'Terhubung dan key diterima (server tidak menyebut daftar tool).';
  else if (result.missingFields.length) note = `Terhubung. Field belum didukung tool: ${result.missingFields.join(', ')}.`;
  else note = result.avatarField
    ? `Terhubung. Tool menerima ${result.avatarField}, tetapi foto tidak dikirim karena belum punya URL publik permanen (portfolio memakai inisial).`
    : 'Terhubung. Tool submit_feedback siap.';
  if (result.ok && result.health?.version) note += ` Versi portfolio ${result.health.version}.`;
  const ok = result.ok && result.toolFound !== false;
  const lastKind = result.ok ? (result.scopeMissing ? 'scope_missing' : ok ? 'ok' : 'tool_missing') : result.kind;
  await db.portfolioConnection.update({
    where: { id: 1 },
    data: { lastTestAt: new Date(), lastTestOk: ok, lastTestKind: lastKind, lastTestMs: result.latencyMs, lastTestNote: note },
  });
  return { ok, kind: lastKind, note, ms: result.latencyMs };
}

/* ------------------------------ pengiriman ------------------------------ */

const store: QueueStore = {
  async claim(id, now, leaseUntil) {
    const claimed = await db.feedback.updateMany({
      where: { id, syncStatus: 'QUEUED', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      data: { attempts: { increment: 1 }, nextAttemptAt: leaseUntil },
    });
    if (claimed.count !== 1) return null;
    const row = await db.feedback.findUnique({ where: { id } });
    return row ? { id: row.id, name: row.name, role: row.role, message: row.message, rating: row.rating, attempts: row.attempts } : null;
  },
  async finish(id, update) {
    await db.feedback.update({ where: { id }, data: update });
  },
};

/** Kirim satu feedback bila koneksi tersambung. Bila tidak, feedback tetap QUEUED (tanpa menambah percobaan). */
export async function deliverFeedback(id: string) {
  const connection = await loadConnection();
  if (connection.state !== 'ready') return 'skipped' as const;
  return deliverOne(store, id, (input) => submitPortfolioFeedback(input, connection.config), PROJECT_NAME);
}

/** Proses antrean yang jatuh tempo. Dipanggil dari cron, halaman admin, dan setelah kiriman baru. */
export async function processDueFeedback() {
  const connection = await loadConnection();
  if (connection.state !== 'ready') return { processed: 0, reason: connection.state };
  const deadline = Date.now() + PROCESS_BUDGET_MS;
  const due = await db.feedback.findMany({
    where: { syncStatus: 'QUEUED', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] },
    orderBy: { createdAt: 'asc' },
    take: PROCESS_BATCH,
    select: { id: true },
  });
  let processed = 0;
  for (const { id } of due) {
    if (Date.now() > deadline) break;
    const outcome = await deliverOne(store, id, (input) => submitPortfolioFeedback(input, connection.config), PROJECT_NAME);
    if (outcome !== 'skipped') processed += 1;
  }
  return { processed, reason: 'ok' as const };
}

/** Admin: jadwalkan ulang feedback FAILED/QUEUED dan coba kirim sekarang. */
export async function resendFeedback(id: string) {
  const reset = await db.feedback.updateMany({
    where: { id, syncStatus: { in: ['FAILED', 'QUEUED'] } },
    data: { syncStatus: 'QUEUED', attempts: 0, nextAttemptAt: null },
  });
  if (reset.count !== 1) return 'not_found' as const;
  return deliverFeedback(id);
}

/* ------------------------------ simpan ------------------------------ */

export async function saveFeedback(fields: FeedbackFields, avatar: Buffer | null) {
  const id = randomUUID();
  const avatarKey = avatar ? `${AVATAR_PREFIX}${id}.webp` : null;
  if (avatar && avatarKey) {
    try {
      await uploadWebp(avatarKey, avatar);
    } catch {
      // Foto hanya pelengkap: masukan tetap disimpan tanpa foto.
      return saveRow(id, fields, null);
    }
  }
  return saveRow(id, fields, avatarKey);
}

async function saveRow(id: string, fields: FeedbackFields, avatarKey: string | null) {
  try {
    await db.feedback.create({ data: { id, name: fields.name, role: fields.role, message: fields.message, rating: fields.rating, avatarKey } });
  } catch (error) {
    if (avatarKey) await removePaths([avatarKey]).catch(() => undefined);
    throw error;
  }
  return id;
}

export async function listFeedback(take = 100): Promise<FeedbackRowView[]> {
  const rows = await db.feedback.findMany({ orderBy: { createdAt: 'desc' }, take });
  let urls: Record<string, string> = {};
  try {
    urls = await signedUrls(rows.flatMap((row) => (row.avatarKey ? [row.avatarKey] : [])));
  } catch {
    // Daftar tetap tampil dengan inisial bila storage bermasalah.
  }
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    message: row.message,
    rating: row.rating,
    avatarUrl: row.avatarKey ? (urls[row.avatarKey] ?? null) : null,
    syncStatus: row.syncStatus,
    attempts: row.attempts,
    lastError: row.lastError,
    lastErrorText: describeStoredFailure(row.lastError),
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
