/**
 * Klien MCP portfolio (murni, tanpa akses database) untuk tool `submit_feedback`.
 * Dipakai oleh antrean pengiriman (feedback-queue.ts) dan tes koneksi admin.
 * Jangan pernah mencatat API key atau isi respons server ke log.
 */

export type FeedbackInput = {
  name: string;
  message: string;
  rating: number;
  role?: string;
  company?: string;
  project?: string;
  /** URL https publik permanen (maks 500 karakter, tanpa user:password). Kosongkan bila foto tidak punya URL permanen. */
  avatar_url?: string;
  /** Id feedback lokal (maks 80 karakter); kirim ulang dengan key yang sama aman. */
  idempotency_key?: string;
};

export const AVATAR_URL_MAX = 500;
export const IDEMPOTENCY_KEY_MAX = 80;

/** Hanya URL https tanpa kredensial dan maksimal 500 karakter yang boleh dikirim sebagai avatar_url. */
export function validAvatarUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > AVATAR_URL_MAX) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  return text;
}

function cleanInput(input: FeedbackInput): FeedbackInput {
  const { avatar_url: avatar, idempotency_key: key, ...rest } = input;
  const avatarUrl = validAvatarUrl(avatar);
  const idem = typeof key === 'string' && key.length > 0 && key.length <= IDEMPOTENCY_KEY_MAX ? key : null;
  return { ...rest, ...(avatarUrl ? { avatar_url: avatarUrl } : {}), ...(idem ? { idempotency_key: idem } : {}) };
}

export type McpConfig = { url: string; apiKey: string };

/** Penyebab gagal yang dibedakan (jangan disatukan menjadi satu "unavailable"). */
export type FailureKind =
  | 'dns'
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden_scope'
  | 'rate_limited'
  | 'server'
  | 'invalid'
  | 'protocol';

export const FAILURE_KINDS: readonly FailureKind[] = ['dns', 'network', 'timeout', 'unauthorized', 'forbidden_scope', 'rate_limited', 'server', 'invalid', 'protocol'];

export type DeliveryFailure = {
  ok: false;
  kind: FailureKind;
  httpStatus?: number;
  retryAfterMs?: number;
  /** Nilai error.data.retryable dari server bila ada. Hanya dipakai untuk penyebab yang boleh diulang. */
  retryable?: boolean;
  /** Ringkasan singkat dari server (mis. field yang ditolak), tanpa data sensitif. */
  detail?: string;
};
export type DeliveryResult = { ok: true; remoteId: string; duplicate?: boolean } | DeliveryFailure;

export const TIMEOUT_MS = 10_000;
export const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_CAP_MS = 2 * 60 * 60_000;
const RETRY_AFTER_CAP_MS = 6 * 60 * 60_000;

/** Penyebab permanen: kunci, scope, isian, atau protokol salah tidak akan membaik dengan mengulang. */
const PERMANENT: ReadonlySet<FailureKind> = new Set<FailureKind>(['unauthorized', 'forbidden_scope', 'invalid', 'protocol']);
export const isRetryable = (kind: FailureKind) => !PERMANENT.has(kind);

/** Ulang hanya bila penyebabnya sementara DAN server tidak menyatakan retryable = false. */
export const canRetry = (info: Pick<DeliveryFailure, 'kind' | 'retryable'>) => isRetryable(info.kind) && info.retryable !== false;

export const isFailureKind = (value: unknown): value is FailureKind =>
  typeof value === 'string' && (FAILURE_KINDS as readonly string[]).includes(value);

/** Penjelasan penyebab untuk admin (bahasa Indonesia, tanpa detail sensitif). */
export function describeFailure(kind: string | null | undefined): string {
  switch (kind) {
    case 'dns': return 'Alamat server tidak ditemukan (DNS). Periksa URL MCP.';
    case 'network': return 'Koneksi ke server gagal (jaringan).';
    case 'timeout': return 'Server tidak menjawab dalam 10 detik (timeout).';
    case 'unauthorized': return 'API key ditolak (unauthorized). Periksa atau buat ulang key.';
    case 'forbidden_scope': return 'API key tidak punya izin feedback:write (forbidden_scope). Buat key dengan scope yang benar.';
    case 'rate_limited': return 'Batas permintaan tercapai (rate_limited). Akan dicoba lagi sesuai Retry-After.';
    case 'server': return 'Server portfolio bermasalah (internal atau 5xx). Akan dicoba lagi.';
    case 'invalid': return 'Isian ditolak server portfolio (invalid_params).';
    case 'protocol': return 'Permintaan tidak dikenali server (parse_error, invalid_request, atau method_not_found).';
    default: return 'Penyebab tidak diketahui.';
  }
}

const DETAIL_MAX = 200;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F|]/g;

/** Simpan penyebab + ringkasan di satu kolom teks: "kind" atau "kind|ringkasan". */
export function packFailure(kind: FailureKind, detail?: string): string {
  const text = (detail ?? '').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, DETAIL_MAX);
  return text ? `${kind}|${text}` : kind;
}

export function unpackFailure(stored: string | null | undefined): { kind: string; detail: string | null } | null {
  if (!stored) return null;
  const cut = stored.indexOf('|');
  if (cut < 0) return { kind: stored, detail: null };
  return { kind: stored.slice(0, cut), detail: stored.slice(cut + 1) || null };
}

/** Teks untuk admin dari nilai tersimpan, termasuk ringkasan field yang ditolak. */
export function describeStoredFailure(stored: string | null | undefined): string | null {
  const info = unpackFailure(stored);
  if (!info) return null;
  const base = describeFailure(info.kind);
  return info.detail ? `${base} ${info.detail}` : base;
}

/* ------------------------------ URL ------------------------------ */

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** URL harus https, tanpa kredensial, dan bukan alamat lokal/IP mentah (cegah SSRF dari form admin). */
export function parseMcpUrl(raw: string): { ok: true; url: string } | { ok: false; message: string } {
  const text = raw.trim();
  if (!text) return { ok: false, message: 'URL MCP wajib diisi.' };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, message: 'URL MCP tidak valid.' };
  }
  if (url.protocol !== 'https:') return { ok: false, message: 'URL MCP harus memakai https.' };
  if (url.username || url.password) return { ok: false, message: 'URL MCP tidak boleh memuat nama pengguna atau password.' };
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, message: 'URL MCP tidak boleh mengarah ke alamat lokal.' };
  }
  if (IPV4.test(host) || host.includes(':')) return { ok: false, message: 'Gunakan nama domain, bukan alamat IP.' };
  if (!host.includes('.')) return { ok: false, message: 'URL MCP harus memakai nama domain lengkap.' };
  url.hash = '';
  return { ok: true, url: url.toString() };
}

/* ------------------------------ klasifikasi ------------------------------ */

const DNS_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'EAI_NODATA', 'EAI_NONAME']);
const TIMEOUT_CODES = new Set(['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);

/** Telusuri error + cause (undici membungkus kode DNS di dalam `cause`). */
function errorTrail(error: unknown): { names: string[]; codes: string[]; text: string } {
  const names: string[] = [];
  const codes: string[] = [];
  let text = '';
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const e = current as { name?: unknown; code?: unknown; message?: unknown; cause?: unknown };
    if (typeof e.name === 'string') names.push(e.name);
    if (typeof e.code === 'string') codes.push(e.code);
    if (typeof e.message === 'string') text += ` ${e.message}`;
    current = e.cause;
  }
  return { names, codes, text };
}

export function classifyThrown(error: unknown): FailureKind {
  const { names, codes, text } = errorTrail(error);
  if (names.includes('AbortError') || names.includes('TimeoutError')) return 'timeout';
  if (codes.some((code) => DNS_CODES.has(code)) || /ENOTFOUND|EAI_AGAIN/.test(text)) return 'dns';
  if (codes.some((code) => TIMEOUT_CODES.has(code))) return 'timeout';
  return 'network';
}

export function parseRetryAfter(header: string | null | undefined, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const value = header.trim();
  if (/^\d+$/.test(value)) return Math.min(Number(value) * 1000, RETRY_AFTER_CAP_MS);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.min(Math.max(0, date - now), RETRY_AFTER_CAP_MS);
}

function failure(kind: FailureKind, extra: Partial<DeliveryFailure> = {}): DeliveryFailure {
  return { ok: false, kind, ...extra };
}

/** Pemetaan error.data.code dari server portfolio ke penyebab di aplikasi. */
export function kindFromCode(code: unknown): FailureKind | null {
  switch (code) {
    case 'unauthorized': return 'unauthorized';
    case 'forbidden_scope': return 'forbidden_scope';
    case 'rate_limited': return 'rate_limited';
    case 'invalid_params': return 'invalid';
    case 'parse_error':
    case 'invalid_request':
    case 'method_not_found': return 'protocol';
    case 'internal': return 'server';
    default: return null;
  }
}

/** Kode numerik JSON-RPC sebagai cadangan bila server tidak mengirim error.data.code. */
function kindFromRpcNumber(code: unknown): FailureKind {
  if (code === -32602) return 'invalid';
  if (code === -32700 || code === -32600 || code === -32601) return 'protocol';
  return 'server';
}

function formatIssues(issues: unknown): string | undefined {
  if (!Array.isArray(issues)) return undefined;
  const parts: string[] = [];
  for (const item of issues.slice(0, 5)) {
    const entry = item as { field?: unknown; message?: unknown } | null;
    const field = typeof entry?.field === 'string' ? entry.field.slice(0, 40) : '';
    const message = typeof entry?.message === 'string' ? entry.message.slice(0, 80) : '';
    if (field || message) parts.push(field && message ? `${field}: ${message}` : field || message);
  }
  return parts.length ? parts.join('; ') : undefined;
}

/** Ubah objek error JSON-RPC (dengan error.data.code dan retryable) menjadi kegagalan; null bila bukan error. */
function failureFromRpcError(error: unknown, httpStatus: number | undefined, headers: Headers | null, now: number): DeliveryFailure | null {
  if (error === undefined || error === null) return null;
  const e = error as { code?: unknown; data?: { code?: unknown; retryable?: unknown; issues?: unknown } | null } | null;
  const kind = kindFromCode(e?.data?.code) ?? kindFromRpcNumber(e?.code);
  return failure(kind, {
    httpStatus,
    ...(typeof e?.data?.retryable === 'boolean' ? { retryable: e.data.retryable } : {}),
    ...(kind === 'rate_limited' && headers ? { retryAfterMs: parseRetryAfter(headers.get('retry-after'), now) } : {}),
    ...(kind === 'invalid' ? { detail: formatIssues(e?.data?.issues) } : {}),
  });
}

function classifyStatus(status: number, headers: Headers, now: number): DeliveryFailure | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401) return failure('unauthorized', { httpStatus: status });
  if (status === 403) return failure('forbidden_scope', { httpStatus: status });
  if (status === 429) return failure('rate_limited', { httpStatus: status, retryAfterMs: parseRetryAfter(headers.get('retry-after'), now) });
  if (status === 408) return failure('timeout', { httpStatus: status });
  if (status >= 500) return failure('server', { httpStatus: status });
  return failure('invalid', { httpStatus: status });
}

/* ------------------------------ transport ------------------------------ */

type Options = { fetchImpl?: typeof fetch; timeoutMs?: number; now?: () => number };

function parseBody(text: string, contentType: string): unknown {
  if (/event-stream/i.test(contentType)) {
    const dataLines = text.split(/\r?\n/).filter((line) => line.startsWith('data:'));
    const last = dataLines[dataLines.length - 1];
    if (!last) throw new Error('empty');
    return JSON.parse(last.slice(5).trim());
  }
  return JSON.parse(text);
}

async function rpc(
  config: McpConfig,
  method: string,
  params: unknown,
  options: Options,
): Promise<{ ok: true; payload: unknown; httpStatus: number; headers: Headers } | DeliveryFailure> {
  const now = options.now ?? Date.now;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'manual',
    });
    const status = response.status;
    if ((status >= 300 && status < 400) || (response as { type?: string }).type === 'opaqueredirect') {
      return failure('invalid', { httpStatus: status || undefined });
    }
    if (status < 200 || status >= 300) {
      // Utamakan kode terstruktur di body (error.data.code); status HTTP hanya cadangan.
      try {
        const body = parseBody(await response.text(), response.headers.get('content-type') ?? '') as { error?: unknown } | null;
        const coded = failureFromRpcError(body?.error, status, response.headers, now());
        if (coded) return coded;
      } catch {
        // Body bukan JSON-RPC (mis. halaman error proxy): pakai status HTTP.
      }
      return classifyStatus(status, response.headers, now()) ?? failure('server', { httpStatus: status });
    }
    try {
      const text = await response.text();
      return { ok: true, payload: parseBody(text, response.headers.get('content-type') ?? ''), httpStatus: status, headers: response.headers };
    } catch {
      return failure('server', { httpStatus: status });
    }
  } catch (error) {
    return failure(classifyThrown(error));
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------ submit_feedback ------------------------------ */

function readSubmitResult(payload: unknown, httpStatus: number, headers: Headers): DeliveryResult {
  if (!payload || typeof payload !== 'object') return failure('server', { httpStatus });
  const envelope = payload as { result?: unknown; error?: unknown };
  if (envelope.error !== undefined) {
    return failureFromRpcError(envelope.error, httpStatus, headers, Date.now()) ?? failure('server', { httpStatus });
  }
  const result = envelope.result;
  if (!result || typeof result !== 'object') return failure('server', { httpStatus });
  const value = result as { isError?: unknown; structuredContent?: unknown };
  const content = value.structuredContent && typeof value.structuredContent === 'object'
    ? (value.structuredContent as { id?: unknown; status?: unknown; duplicate?: unknown; code?: unknown; retryable?: unknown; issues?: unknown })
    : null;
  if (value.isError === true) {
    // Validasi gagal dikembalikan sebagai result isError: { code: "invalid_params", issues: [{ field, message }] }.
    const kind = kindFromCode(content?.code) ?? 'invalid';
    return failure(kind, {
      httpStatus,
      ...(typeof content?.retryable === 'boolean' ? { retryable: content.retryable } : {}),
      ...(kind === 'invalid' ? { detail: formatIssues(content?.issues) } : {}),
    });
  }
  if (!content) return failure('server', { httpStatus });
  // duplicate: true berarti key yang sama sudah diterima sebelumnya: dianggap BERHASIL.
  const duplicate = content.duplicate === true;
  return typeof content.id === 'string' && (content.status === 'pending' || duplicate)
    ? { ok: true, remoteId: content.id, ...(duplicate ? { duplicate: true } : {}) }
    : failure('server', { httpStatus });
}

export async function submitPortfolioFeedback(
  input: FeedbackInput,
  config: McpConfig,
  options: Options = {},
): Promise<DeliveryResult> {
  const reply = await rpc(config, 'tools/call', { name: 'submit_feedback', arguments: cleanInput(input) }, options);
  if (!reply.ok) return reply;
  return readSubmitResult(reply.payload, reply.httpStatus, reply.headers);
}

/* ------------------------------ tes koneksi ------------------------------ */

/** Field yang selalu dikirim aplikasi ke tool submit_feedback (avatar_url hanya bila foto punya URL publik permanen). */
export const SENT_FIELDS = ['name', 'message', 'rating', 'role', 'company', 'project', 'idempotency_key'] as const;

export type HealthInfo = { ok: boolean; database: unknown; version: string | null; tools: number | null };

export type ConnectionTest =
  | {
      ok: true;
      latencyMs: number;
      toolFound: boolean | null;
      /** true bila tools/list kosong: key diterima tetapi tidak punya scope feedback:write. */
      scopeMissing: boolean;
      /** null bila server tidak punya endpoint /health (404). */
      health: HealthInfo | null;
      fields: string[];
      missingFields: string[];
      avatarField: string | null;
    }
  | (DeliveryFailure & { latencyMs: number; stage: 'health' | 'tools' });

/** URL health: URL MCP + /health (tanpa key). */
export function healthUrl(mcpUrl: string): string {
  const url = new URL(mcpUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/health`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function checkHealth(config: McpConfig, options: Options): Promise<{ ok: true; info: HealthInfo | null } | DeliveryFailure> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)(healthUrl(config.url), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'manual',
    });
    const status = response.status;
    if (status === 404 || status === 405) return { ok: true, info: null };
    if (status < 200 || status >= 300) return failure('server', { httpStatus: status });
    const body = JSON.parse(await response.text()) as { ok?: unknown; database?: unknown; version?: unknown; tools?: unknown } | null;
    const info: HealthInfo = {
      ok: body?.ok === true,
      database: body?.database ?? null,
      version: typeof body?.version === 'string' ? body.version : null,
      tools: typeof body?.tools === 'number' ? body.tools : null,
    };
    return info.ok ? { ok: true, info } : failure('server', { httpStatus: status, detail: 'Health check portfolio melaporkan tidak sehat.' });
  } catch (error) {
    if (error instanceof SyntaxError) return failure('server');
    return failure(classifyThrown(error));
  } finally {
    clearTimeout(timer);
  }
}

/** Tes read-only: /health (tanpa key) lebih dulu, lalu tools/list dengan key. Tidak membuat testimoni. */
export async function testPortfolioConnection(config: McpConfig, options: Options = {}): Promise<ConnectionTest> {
  const now = options.now ?? Date.now;
  const started = now();
  const health = await checkHealth(config, options);
  if (!health.ok) return { ...health, latencyMs: Math.max(0, now() - started), stage: 'health' };

  const reply = await rpc(config, 'tools/list', {}, options);
  const latencyMs = Math.max(0, now() - started);
  if (!reply.ok) return { ...reply, latencyMs, stage: 'tools' };

  const payload = reply.payload as { result?: { tools?: unknown }; error?: unknown } | null;
  if (payload?.error !== undefined) {
    const coded = failureFromRpcError(payload.error, reply.httpStatus, reply.headers, now());
    if (coded) return { ...coded, latencyMs, stage: 'tools' };
  }
  const tools = payload?.result?.tools;
  if (!Array.isArray(tools)) {
    // Server menjawab dan menerima key, tetapi tidak menyebutkan daftar tool.
    return { ok: true, latencyMs, toolFound: null, scopeMissing: false, health: health.info, fields: [], missingFields: [], avatarField: null };
  }
  if (tools.length === 0) {
    return { ok: true, latencyMs, toolFound: false, scopeMissing: true, health: health.info, fields: [], missingFields: [...SENT_FIELDS], avatarField: null };
  }
  const tool = tools.find((item) => (item as { name?: unknown } | null)?.name === 'submit_feedback') as
    | { inputSchema?: { properties?: Record<string, unknown> } }
    | undefined;
  if (!tool) return { ok: true, latencyMs, toolFound: false, scopeMissing: false, health: health.info, fields: [], missingFields: [...SENT_FIELDS], avatarField: null };
  const fields = Object.keys(tool.inputSchema?.properties ?? {});
  return {
    ok: true,
    latencyMs,
    toolFound: true,
    scopeMissing: false,
    health: health.info,
    fields,
    missingFields: SENT_FIELDS.filter((field) => !fields.includes(field)),
    avatarField: fields.find((field) => /avatar|photo|foto|image/i.test(field)) ?? null,
  };
}

/* ------------------------------ backoff ------------------------------ */

/** Jeda sebelum percobaan berikutnya: 30 dtk, 2 mnt, 8 mnt, 32 mnt, 2 jam (+-20% jitter). */
export function backoffDelayMs(failedAttempts: number, rand: () => number = Math.random): number {
  const base = Math.min(BACKOFF_BASE_MS * 4 ** Math.max(0, failedAttempts - 1), BACKOFF_CAP_MS);
  return Math.round(base * (0.8 + rand() * 0.4));
}

export type RetryPlan = { status: 'queued' | 'failed'; nextAttemptAt: Date | null };

/** Tentukan nasib feedback setelah satu percobaan gagal. `failedAttempts` termasuk percobaan ini. */
export function planAfterFailure(
  failureInfo: Pick<DeliveryFailure, 'kind' | 'retryAfterMs' | 'retryable'>,
  failedAttempts: number,
  now: Date,
  rand: () => number = Math.random,
): RetryPlan {
  if (!canRetry(failureInfo) || failedAttempts >= MAX_ATTEMPTS) return { status: 'failed', nextAttemptAt: null };
  const delay = Math.max(backoffDelayMs(failedAttempts, rand), failureInfo.retryAfterMs ?? 0);
  return { status: 'queued', nextAttemptAt: new Date(now.getTime() + delay) };
}
