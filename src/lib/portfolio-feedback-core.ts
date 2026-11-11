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
};

export type McpConfig = { url: string; apiKey: string };

/** Penyebab gagal yang dibedakan (jangan disatukan menjadi satu "unavailable"). */
export type FailureKind =
  | 'dns'
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'rate_limited'
  | 'server'
  | 'invalid';

export const FAILURE_KINDS: readonly FailureKind[] = ['dns', 'network', 'timeout', 'unauthorized', 'rate_limited', 'server', 'invalid'];

export type DeliveryFailure = {
  ok: false;
  kind: FailureKind;
  httpStatus?: number;
  retryAfterMs?: number;
  /** true bila server mungkin sudah menyimpan feedback walau kita melihat kegagalan (timeout, 5xx, respons rusak). */
  uncertain: boolean;
};
export type DeliveryResult = { ok: true; remoteId: string } | DeliveryFailure;

export const TIMEOUT_MS = 10_000;
export const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_CAP_MS = 2 * 60 * 60_000;
const RETRY_AFTER_CAP_MS = 6 * 60 * 60_000;

const RETRYABLE: ReadonlySet<FailureKind> = new Set<FailureKind>(['dns', 'network', 'timeout', 'rate_limited', 'server']);
export const isRetryable = (kind: FailureKind) => RETRYABLE.has(kind);

export const isFailureKind = (value: unknown): value is FailureKind =>
  typeof value === 'string' && (FAILURE_KINDS as readonly string[]).includes(value);

/** Penjelasan penyebab untuk admin (bahasa Indonesia, tanpa detail sensitif). */
export function describeFailure(kind: string | null | undefined): string {
  switch (kind) {
    case 'dns': return 'Alamat server tidak ditemukan (DNS). Periksa URL MCP.';
    case 'network': return 'Koneksi ke server gagal (jaringan).';
    case 'timeout': return 'Server tidak menjawab dalam 10 detik (timeout).';
    case 'unauthorized': return 'API key ditolak (401/403). Periksa atau buat ulang key.';
    case 'rate_limited': return 'Batas 60 permintaan per menit tercapai (429).';
    case 'server': return 'Server portfolio bermasalah (5xx atau respons tidak dikenali).';
    case 'invalid': return 'Data ditolak server portfolio (isian tidak valid).';
    default: return 'Penyebab tidak diketahui.';
  }
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

/** Kegagalan jaringan setelah permintaan mungkin terkirim dianggap tidak pasti, kecuali DNS (belum tersambung). */
const uncertainFor = (kind: FailureKind) => kind === 'timeout' || kind === 'network' || kind === 'server';

export function parseRetryAfter(header: string | null | undefined, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const value = header.trim();
  if (/^\d+$/.test(value)) return Math.min(Number(value) * 1000, RETRY_AFTER_CAP_MS);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.min(Math.max(0, date - now), RETRY_AFTER_CAP_MS);
}

function failure(kind: FailureKind, extra: Partial<DeliveryFailure> = {}): DeliveryFailure {
  return { ok: false, kind, uncertain: uncertainFor(kind), ...extra };
}

function classifyStatus(status: number, headers: Headers, now: number): DeliveryFailure | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401 || status === 403) return failure('unauthorized', { httpStatus: status });
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
): Promise<{ ok: true; payload: unknown; httpStatus: number } | DeliveryFailure> {
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
      return failure('invalid', { httpStatus: status || undefined, uncertain: false });
    }
    const failed = classifyStatus(status, response.headers, now());
    if (failed) return failed;
    try {
      const text = await response.text();
      return { ok: true, payload: parseBody(text, response.headers.get('content-type') ?? ''), httpStatus: status };
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

function readSubmitResult(payload: unknown, httpStatus: number): DeliveryResult {
  if (!payload || typeof payload !== 'object') return failure('server', { httpStatus });
  const envelope = payload as { result?: unknown; error?: unknown };
  if (envelope.error !== undefined) {
    const code = (envelope.error as { code?: unknown } | null)?.code;
    const invalid = typeof code === 'number' && code >= -32602 && code <= -32600;
    return failure(invalid ? 'invalid' : 'server', { httpStatus, uncertain: false });
  }
  const result = envelope.result;
  if (!result || typeof result !== 'object') return failure('server', { httpStatus });
  const value = result as { isError?: unknown; structuredContent?: unknown };
  if (value.isError === true) return failure('invalid', { httpStatus, uncertain: false });
  const content = value.structuredContent;
  if (!content || typeof content !== 'object') return failure('server', { httpStatus });
  const structured = content as { id?: unknown; status?: unknown };
  return typeof structured.id === 'string' && structured.status === 'pending'
    ? { ok: true, remoteId: structured.id }
    : failure('server', { httpStatus });
}

export async function submitPortfolioFeedback(
  input: FeedbackInput,
  config: McpConfig,
  options: Options = {},
): Promise<DeliveryResult> {
  const reply = await rpc(config, 'tools/call', { name: 'submit_feedback', arguments: input }, options);
  if (!reply.ok) return reply;
  return readSubmitResult(reply.payload, reply.httpStatus);
}

/* ------------------------------ tes koneksi ------------------------------ */

/** Field yang dikirim aplikasi ke tool submit_feedback. */
export const SENT_FIELDS = ['name', 'message', 'rating', 'role', 'company', 'project'] as const;

export type ConnectionTest =
  | { ok: true; latencyMs: number; toolFound: boolean | null; fields: string[]; missingFields: string[]; avatarField: string | null }
  | (DeliveryFailure & { latencyMs: number });

/** Tes read-only lewat tools/list: tidak membuat testimoni. */
export async function testPortfolioConnection(config: McpConfig, options: Options = {}): Promise<ConnectionTest> {
  const now = options.now ?? Date.now;
  const started = now();
  const reply = await rpc(config, 'tools/list', {}, options);
  const latencyMs = Math.max(0, now() - started);
  if (!reply.ok) return { ...reply, latencyMs };

  const payload = reply.payload as { result?: { tools?: unknown }; error?: unknown } | null;
  const tools = payload?.result?.tools;
  if (!Array.isArray(tools)) {
    // Server menjawab dan menerima key, tetapi tidak menyebutkan daftar tool.
    return { ok: true, latencyMs, toolFound: null, fields: [], missingFields: [], avatarField: null };
  }
  const tool = tools.find((item) => (item as { name?: unknown } | null)?.name === 'submit_feedback') as
    | { inputSchema?: { properties?: Record<string, unknown> } }
    | undefined;
  if (!tool) return { ok: true, latencyMs, toolFound: false, fields: [], missingFields: [...SENT_FIELDS], avatarField: null };
  const fields = Object.keys(tool.inputSchema?.properties ?? {});
  return {
    ok: true,
    latencyMs,
    toolFound: true,
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
  failureInfo: Pick<DeliveryFailure, 'kind' | 'retryAfterMs'>,
  failedAttempts: number,
  now: Date,
  rand: () => number = Math.random,
): RetryPlan {
  if (!isRetryable(failureInfo.kind) || failedAttempts >= MAX_ATTEMPTS) return { status: 'failed', nextAttemptAt: null };
  const delay = Math.max(backoffDelayMs(failedAttempts, rand), failureInfo.retryAfterMs ?? 0);
  return { status: 'queued', nextAttemptAt: new Date(now.getTime() + delay) };
}
