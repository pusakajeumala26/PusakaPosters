// @ts-nocheck -- tes runtime murni; tipe diperiksa lewat modul sumber
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_ATTEMPTS,
  backoffDelayMs,
  classifyThrown,
  parseMcpUrl,
  parseRetryAfter,
  planAfterFailure,
  submitPortfolioFeedback,
  testPortfolioConnection,
  describeStoredFailure,
  healthUrl,
  kindFromCode,
  packFailure,
  unpackFailure,
  validAvatarUrl,
} from '../src/lib/portfolio-feedback-core';
import { ROLE_DEFS, parseFeedbackFields as _pff } from '../src/lib/feedback-input';
import { toMcpInput as _toMcp } from '../src/lib/feedback-queue';
import { decryptSecret, encryptSecret, keyHint } from '../src/lib/portfolio-secret';

const config = { url: 'https://portfolio.example.com/api/mcp', apiKey: 'mcp_live_secret_value_1234' };
const input = { name: 'Budi', message: 'Aplikasinya sangat membantu.', rating: 5, role: 'Mahasiswa', project: 'PusakaPosters' };

const reply = (body, init = {}) =>
  async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });
const ok = { jsonrpc: '2.0', id: '1', result: { structuredContent: { id: 'fb_1', status: 'pending' } } };

test('mengirim sesuai kontrak tool submit_feedback dengan Bearer key', async () => {
  let seen;
  const result = await submitPortfolioFeedback(input, config, {
    fetchImpl: async (url, init) => {
      seen = { url, init, body: JSON.parse(init.body) };
      return new Response(JSON.stringify(ok), { status: 200 });
    },
  });
  assert.deepEqual(result, { ok: true, remoteId: 'fb_1' });
  assert.equal(seen.url, config.url);
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers.Authorization, `Bearer ${config.apiKey}`);
  assert.equal(seen.init.redirect, 'manual');
  assert.equal(seen.body.method, 'tools/call');
  assert.equal(seen.body.params.name, 'submit_feedback');
  assert.deepEqual(seen.body.params.arguments, input);
});

test('klasifikasi status HTTP (cadangan bila body bukan JSON-RPC)', async () => {
  const cases = [
    [401, 'unauthorized'],
    [403, 'forbidden_scope'],
    [429, 'rate_limited'],
    [500, 'server'],
    [503, 'server'],
    [400, 'invalid'],
    [404, 'invalid'],
  ];
  for (const [status, kind] of cases) {
    const result = await submitPortfolioFeedback(input, config, { fetchImpl: async () => new Response('x', { status }) });
    assert.equal(result.ok, false);
    assert.equal(result.kind, kind, `status ${status}`);
    assert.equal(result.httpStatus, status);
  }
});

test('429 membaca Retry-After (detik dan tanggal)', async () => {
  const result = await submitPortfolioFeedback(input, config, {
    fetchImpl: async () => new Response('', { status: 429, headers: { 'retry-after': '45' } }),
  });
  assert.equal(result.retryAfterMs, 45_000);
  assert.equal(parseRetryAfter('120'), 120_000);
  assert.equal(parseRetryAfter('abc'), undefined);
  assert.equal(parseRetryAfter(null), undefined);
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.equal(parseRetryAfter('Thu, 01 Jan 2026 00:01:00 GMT', now), 60_000);
  assert.equal(parseRetryAfter('999999999'), 6 * 60 * 60_000);
});

test('isError true pada HTTP 200 dianggap invalid dan tidak diulang', async () => {
  const result = await submitPortfolioFeedback(input, config, {
    fetchImpl: reply({ jsonrpc: '2.0', id: '1', result: { isError: true, content: [{ type: 'text', text: 'bad' }] } }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.kind, 'invalid');
  assert.equal(planAfterFailure(result, 1, new Date()).status, 'failed');
});

test('error DNS, jaringan, dan timeout dibedakan', async () => {
  const dns = Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('getaddrinfo ENOTFOUND x'), { code: 'ENOTFOUND' }) });
  assert.equal(classifyThrown(dns), 'dns');
  assert.equal(classifyThrown(new TypeError('fetch failed')), 'network');
  assert.equal(classifyThrown(Object.assign(new Error('x'), { name: 'AbortError' })), 'timeout');
  assert.equal(classifyThrown(Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } })), 'timeout');

  const viaFetch = await submitPortfolioFeedback(input, config, { fetchImpl: async () => { throw dns; } });
  assert.equal(viaFetch.kind, 'dns');
});

test('timeout 10 dtk memutus permintaan yang menggantung', async () => {
  const result = await submitPortfolioFeedback(input, config, {
    timeoutMs: 20,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }),
  });
  assert.equal(result.kind, 'timeout');
});

test('redirect ditolak dan respons rusak dianggap server', async () => {
  const redirect = await submitPortfolioFeedback(input, config, { fetchImpl: async () => new Response('', { status: 302, headers: { location: 'http://10.0.0.1' } }) });
  assert.equal(redirect.kind, 'invalid');
  const broken = await submitPortfolioFeedback(input, config, { fetchImpl: reply('bukan json') });
  assert.equal(broken.kind, 'server');
  const wrongStatus = await submitPortfolioFeedback(input, config, {
    fetchImpl: reply({ jsonrpc: '2.0', id: '1', result: { structuredContent: { id: 'x', status: 'published' } } }),
  });
  assert.equal(wrongStatus.kind, 'server');
});

test('respons SSE didukung', async () => {
  const body = `event: message\ndata: ${JSON.stringify(ok)}\n\n`;
  const result = await submitPortfolioFeedback(input, config, {
    fetchImpl: async () => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  });
  assert.deepEqual(result, { ok: true, remoteId: 'fb_1' });
});

test('backoff eksponensial dengan jitter dan batas atas', () => {
  const mid = () => 0.5;
  assert.equal(backoffDelayMs(1, mid), 30_000);
  assert.equal(backoffDelayMs(2, mid), 120_000);
  assert.equal(backoffDelayMs(3, mid), 480_000);
  assert.equal(backoffDelayMs(4, mid), 1_920_000);
  assert.equal(backoffDelayMs(5, mid), 7_200_000);
  assert.equal(backoffDelayMs(9, mid), 7_200_000);
  assert.equal(backoffDelayMs(1, () => 0), 24_000);
  assert.equal(backoffDelayMs(1, () => 1), 36_000);
});

test('rencana ulang: hanya penyebab sementara, maksimal 5 percobaan', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const mid = () => 0.5;
  for (const kind of ['dns', 'network', 'timeout', 'rate_limited', 'server']) {
    const plan = planAfterFailure({ kind }, 1, now, mid);
    assert.equal(plan.status, 'queued', kind);
    assert.equal(plan.nextAttemptAt.getTime(), now.getTime() + 30_000);
  }
  for (const kind of ['unauthorized', 'forbidden_scope', 'invalid', 'protocol']) {
    assert.deepEqual(planAfterFailure({ kind }, 1, now, mid), { status: 'failed', nextAttemptAt: null }, kind);
  }
  assert.equal(planAfterFailure({ kind: 'network' }, MAX_ATTEMPTS - 1, now, mid).status, 'queued');
  assert.deepEqual(planAfterFailure({ kind: 'network' }, MAX_ATTEMPTS, now, mid), { status: 'failed', nextAttemptAt: null });
});

test('Retry-After lebih lama dari backoff dihormati', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const plan = planAfterFailure({ kind: 'rate_limited', retryAfterMs: 600_000 }, 1, now, () => 0.5);
  assert.equal(plan.nextAttemptAt.getTime(), now.getTime() + 600_000);
});

test('validasi URL MCP', () => {
  assert.equal(parseMcpUrl('https://alfizilham.vercel.app/api/mcp').ok, true);
  for (const bad of ['', 'abc', 'http://alfizilham.vercel.app/api/mcp', 'https://user:pw@a.example.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://[::1]/x', 'https://intranet/x', 'https://svc.internal/x']) {
    assert.equal(parseMcpUrl(bad).ok, false, bad);
  }
});

test('enkripsi key: bolak-balik, acak per enkripsi, tidak memuat teks asli', () => {
  const secret = 'session-secret-yang-panjang-1234567890';
  const plain = 'mcp_live_abcdef123456';
  const a = encryptSecret(plain, secret);
  const b = encryptSecret(plain, secret);
  assert.notEqual(a, b);
  assert.equal(a.includes(plain), false);
  assert.equal(decryptSecret(a, secret), plain);
  assert.equal(keyHint(plain), '3456');
});

test('dekripsi gagal dengan secret salah atau token dirusak', () => {
  const token = encryptSecret('mcp_live_abcdef123456', 'secret-satu-secret-satu-secret-satu');
  assert.throws(() => decryptSecret(token, 'secret-dua-secret-dua-secret-dua'), /SECRET_UNREADABLE/);
  assert.throws(() => decryptSecret(token.slice(0, -3) + 'AAA', 'secret-satu-secret-satu-secret-satu'), /SECRET_UNREADABLE/);
  assert.throws(() => decryptSecret('sampah', 'x'), /SECRET_UNREADABLE/);
});

/* ------------------------------ input ------------------------------ */
import { initialsOf, parseFeedbackFields, sniffImage } from '../src/lib/feedback-input';
import { deliverOne, toMcpInput } from '../src/lib/feedback-queue';

const base = { name: '  Budi   Santoso ', role: 'Mahasiswa', roleDetail: ' Teknik Komputer  di Universitas Syiah Kuala ', message: 'Aplikasinya sangat membantu kami.', rating: '5', consent: 'true' };

test('isian feedback: normalisasi dan validasi', () => {
  const good = parseFeedbackFields(base);
  assert.equal(good.ok, true);
  assert.deepEqual(good.value, { name: 'Budi Santoso', role: 'Mahasiswa - Teknik Komputer di Universitas Syiah Kuala', message: 'Aplikasinya sangat membantu kami.', rating: 5 });
  assert.equal(parseFeedbackFields({ ...base, role: '' }).value.role, null);
  for (const bad of [
    { name: '' },
    { name: 'x'.repeat(81) },
    { role: 'Admin' },
    { roleDetail: '' },
    { roleDetail: 'x'.repeat(121) },
    { message: 'pendek' },
    { message: 'x'.repeat(1501) },
    { rating: '0' },
    { rating: '6' },
    { rating: '4.5' },
    { rating: undefined },
    { consent: undefined },
  ]) {
    assert.equal(parseFeedbackFields({ ...base, ...bad }).ok, false, JSON.stringify(bad));
  }
  assert.equal(parseFeedbackFields({ ...base, name: 'Ani\u0000' }).value.name, 'Ani');
});

test('magic byte gambar', () => {
  assert.equal(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'jpeg');
  assert.equal(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'png');
  assert.equal(sniffImage(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50])), 'webp');
  assert.equal(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(sniffImage(new TextEncoder().encode('GIF89a......')), null);
  assert.equal(sniffImage(new Uint8Array()), null);
});

test('inisial avatar', () => {
  assert.equal(initialsOf('Budi Santoso'), 'BS');
  assert.equal(initialsOf('  alfiz  '), 'A');
  assert.equal(initialsOf('Ata Sidqi Nur'), 'AN');
  assert.equal(initialsOf(''), '?');
});

/* ------------------------------ antrean ------------------------------ */

function memoryStore(rows) {
  const data = new Map(rows.map((row) => [row.id, { syncStatus: 'QUEUED', attempts: 0, nextAttemptAt: null, ...row }]));
  return {
    data,
    async claim(id, now, leaseUntil) {
      const row = data.get(id);
      if (!row || row.syncStatus !== 'QUEUED' || (row.nextAttemptAt && row.nextAttemptAt > now)) return null;
      row.attempts += 1;
      row.nextAttemptAt = leaseUntil;
      return { ...row };
    },
    async finish(id, update) {
      Object.assign(data.get(id), update);
    },
  };
}
const queued = { id: 'a', name: 'Budi', role: 'Mahasiswa - Teknik Komputer', message: 'Aplikasinya sangat membantu.', rating: 5 };

test('antrean: sukses menandai SENT dan tidak pernah dikirim lagi (idempoten)', async () => {
  const store = memoryStore([queued]);
  let calls = 0;
  const send = async (payload) => {
    calls += 1;
    assert.deepEqual(payload, { name: 'Budi', message: queued.message, rating: 5, role: 'Mahasiswa - Teknik Komputer', project: 'PusakaPosters', idempotency_key: 'a' });
    return { ok: true, remoteId: 'r1' };
  };
  assert.equal(await deliverOne(store, 'a', send, 'PusakaPosters'), 'sent');
  assert.equal(await deliverOne(store, 'a', send, 'PusakaPosters'), 'skipped');
  assert.equal(calls, 1);
  assert.equal(store.data.get('a').syncStatus, 'SENT');
  assert.equal(store.data.get('a').remoteId, 'r1');
});

test('antrean: dua pemroses bersamaan hanya satu yang mengirim (lease)', async () => {
  const store = memoryStore([queued]);
  let calls = 0;
  const send = async () => { calls += 1; await new Promise((r) => setTimeout(r, 10)); return { ok: true, remoteId: 'r1' }; };
  const results = await Promise.all([deliverOne(store, 'a', send, 'P'), deliverOne(store, 'a', send, 'P')]);
  assert.deepEqual(results.sort(), ['sent', 'skipped']);
  assert.equal(calls, 1);
});

test('antrean: gagal sementara dijadwalkan ulang, lalu FAILED setelah 5 percobaan', async () => {
  const store = memoryStore([queued]);
  const send = async () => ({ ok: false, kind: 'timeout' });
  let now = new Date('2026-01-01T00:00:00Z');
  const outcomes = [];
  for (let i = 0; i < 5; i++) {
    outcomes.push(await deliverOne(store, 'a', send, 'P', now, () => 0.5));
    const next = store.data.get('a').nextAttemptAt;
    if (next) now = new Date(next.getTime() + 1);
  }
  assert.deepEqual(outcomes, ['queued', 'queued', 'queued', 'queued', 'failed']);
  const row = store.data.get('a');
  assert.equal(row.syncStatus, 'FAILED');
  assert.equal(row.attempts, 5);
  assert.equal(row.lastError, 'timeout');
  assert.equal(row.nextAttemptAt, null);
});

test('antrean: belum jatuh tempo dilewati; 401 langsung FAILED tanpa ulang', async () => {
  const store = memoryStore([{ ...queued, nextAttemptAt: new Date('2099-01-01') }]);
  assert.equal(await deliverOne(store, 'a', async () => assert.fail('tidak boleh kirim'), 'P'), 'skipped');
  const store2 = memoryStore([queued]);
  const outcome = await deliverOne(store2, 'a', async () => ({ ok: false, kind: 'unauthorized', httpStatus: 401 }), 'P');
  assert.equal(outcome, 'failed');
  assert.equal(store2.data.get('a').lastError, 'unauthorized');
});

test('antrean: exception tak terduga diperlakukan sebagai kegagalan jaringan', async () => {
  const store = memoryStore([queued]);
  const outcome = await deliverOne(store, 'a', async () => { throw new Error('boom'); }, 'P');
  assert.equal(outcome, 'queued');
  assert.equal(store.data.get('a').lastError, 'network');
});

/* ------------------------------ endpoint publik ------------------------------ */
import { createFeedbackHandler } from '../src/lib/feedback-handler';
import { HttpError } from '../src/lib/http';

function formRequest(fields, { origin } = {}) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new Request('https://app.example.com/api/feedback', { method: 'POST', body, headers: { origin: origin ?? 'https://app.example.com', host: 'app.example.com' } });
}
const goodForm = { name: 'Budi', role: 'Mahasiswa', roleDetail: 'Teknik Komputer', message: 'Aplikasinya sangat membantu kami.', rating: '5', consent: 'true', website: '' };
function makeHandler(overrides = {}) {
  const calls = { saved: [], scheduled: [] };
  const handler = createFeedbackHandler({
    save: async (fields, avatar) => { calls.saved.push({ fields, avatar }); return 'id-1'; },
    schedule: (id) => calls.scheduled.push(id),
    ipForRequest: () => '1.2.3.4',
    logCategory: () => {},
    ...overrides,
  });
  return { handler, calls };
}

test('endpoint: menyimpan dulu lalu menjadwalkan pengiriman', async () => {
  const { handler, calls } = makeHandler();
  const res = await handler(formRequest(goodForm));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.saved.length, 1);
  assert.equal(calls.saved[0].fields.name, 'Budi');
  assert.deepEqual(calls.scheduled, ['id-1']);
});

test('endpoint: honeypot terisi tidak menyimpan apa pun', async () => {
  const { handler, calls } = makeHandler();
  const res = await handler(formRequest({ ...goodForm, website: 'http://spam' }));
  assert.equal(res.status, 200);
  assert.equal(calls.saved.length, 0);
  assert.equal(calls.scheduled.length, 0);
});

test('endpoint: validasi, tipe konten, dan origin (wajib ada)', async () => {
  const noOrigin = await makeHandler().handler(new Request('https://app.example.com/api/feedback', { method: 'POST', body: new FormData() }));
  assert.equal(noOrigin.status, 403);
  const { handler, calls } = makeHandler();
  assert.equal((await handler(formRequest({ ...goodForm, message: 'pendek' }))).status, 422);
  assert.equal((await handler(formRequest({ ...goodForm, consent: '' }))).status, 422);
  const json = await handler(new Request('https://app.example.com/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://app.example.com', host: 'app.example.com' }, body: '{}' }));
  assert.equal(json.status, 415);
  const cross = await handler(new Request('https://app.example.com/api/feedback', { method: 'POST', headers: { origin: 'https://evil.example', host: 'app.example.com' }, body: new FormData() }));
  assert.equal(cross.status, 403);
  assert.equal(calls.saved.length, 0);
});

test('endpoint: batas laju per IP menghasilkan 429 dengan Retry-After', async () => {
  const { handler } = makeHandler({ limit: (() => { let n = 0; return () => { if (++n > 1) throw new HttpError(429, 'x', 30); }; })() });
  assert.equal((await handler(formRequest(goodForm))).status, 200);
  const res = await handler(formRequest(goodForm));
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), '30');
});

test('endpoint: kegagalan penyimpanan menjadi 503 tanpa membocorkan detail', async () => {
  const { handler, calls } = makeHandler({ save: async () => { throw new Error('postgres://user:pw@host/db'); } });
  const res = await handler(formRequest(goodForm));
  assert.equal(res.status, 503);
  assert.equal((await res.text()).includes('postgres'), false);
  assert.equal(calls.scheduled.length, 0);
});

test('peran: tanpa peran detail diabaikan; detail panjang dipotong 80 untuk MCP', () => {
  const none = _pff({ ...base, role: '', roleDetail: 'abaikan' });
  assert.equal(none.ok, true);
  assert.equal(none.value.role, null);
  const long = _pff({ ...base, role: 'Lainnya', roleDetail: 'y'.repeat(120) });
  assert.equal(long.value.role.length, 'Lainnya - '.length + 120);
  const row = { id: 'a', name: 'B', role: long.value.role, message: 'Aplikasinya sangat membantu.', rating: 5, attempts: 1 };
  assert.equal(_toMcp(row, 'P').role.length, 80);
  assert.equal(ROLE_DEFS.length, 8);
  assert.equal(ROLE_DEFS[0].value, 'Mahasiswa');
});

/* ------------------------------ kontrak portfolio terbaru ------------------------------ */

const rpcError = (code, data, extra = {}) => ({ jsonrpc: '2.0', id: '1', error: { code, message: 'x', data, ...extra } });

test('duplicate:true dianggap BERHASIL (sent), termasuk lewat antrean', async () => {
  const dup = { jsonrpc: '2.0', id: '1', result: { structuredContent: { id: 'fb_1', status: 'approved', duplicate: true } } };
  const result = await submitPortfolioFeedback(input, config, { fetchImpl: reply(dup) });
  assert.deepEqual(result, { ok: true, remoteId: 'fb_1', duplicate: true });

  const store = memoryStore([queued]);
  const outcome = await deliverOne(store, 'a', (payload) => submitPortfolioFeedback(payload, config, { fetchImpl: reply(dup) }), 'P');
  assert.equal(outcome, 'sent');
  assert.equal(store.data.get('a').syncStatus, 'SENT');
  assert.equal(store.data.get('a').remoteId, 'fb_1');
  assert.equal(store.data.get('a').lastError, null);
});

test('idempotency_key = id feedback di setiap pengiriman dan retry', async () => {
  const store = memoryStore([queued]);
  const keys = [];
  const answers = [{ ok: false, kind: 'timeout' }, { ok: true, remoteId: 'r1', duplicate: true }];
  const send = async (payload) => { keys.push(payload.idempotency_key); return answers.shift(); };
  let now = new Date('2026-01-01T00:00:00Z');
  assert.equal(await deliverOne(store, 'a', send, 'P', now, () => 0.5), 'queued');
  now = new Date(store.data.get('a').nextAttemptAt.getTime() + 1);
  assert.equal(await deliverOne(store, 'a', send, 'P', now, () => 0.5), 'sent');
  assert.deepEqual(keys, ['a', 'a']);

  let seen;
  await submitPortfolioFeedback({ ...input, idempotency_key: 'k'.repeat(80) }, config, {
    fetchImpl: async (_u, init) => { seen = JSON.parse(init.body).params.arguments; return new Response(JSON.stringify(ok), { status: 200 }); },
  });
  assert.equal(seen.idempotency_key.length, 80);
  await submitPortfolioFeedback({ ...input, idempotency_key: 'k'.repeat(81) }, config, {
    fetchImpl: async (_u, init) => { seen = JSON.parse(init.body).params.arguments; return new Response(JSON.stringify(ok), { status: 200 }); },
  });
  assert.equal('idempotency_key' in seen, false);
});

test('klasifikasi dari error.data.code, bukan hanya status HTTP', async () => {
  const cases = [
    ['unauthorized', 'unauthorized'],
    ['forbidden_scope', 'forbidden_scope'],
    ['rate_limited', 'rate_limited'],
    ['parse_error', 'protocol'],
    ['invalid_request', 'protocol'],
    ['method_not_found', 'protocol'],
    ['invalid_params', 'invalid'],
    ['internal', 'server'],
  ];
  for (const [code, kind] of cases) {
    const viaOk = await submitPortfolioFeedback(input, config, { fetchImpl: reply(rpcError(-32000, { code, retryable: code === 'internal' })) });
    assert.equal(viaOk.kind, kind, `HTTP 200 ${code}`);
    assert.equal(kindFromCode(code), kind);
  }
  // Kode terstruktur menang atas status HTTP.
  const coded = await submitPortfolioFeedback(input, config, {
    fetchImpl: async () => new Response(JSON.stringify(rpcError(-32000, { code: 'forbidden_scope', retryable: false })), { status: 401 }),
  });
  assert.equal(coded.kind, 'forbidden_scope');
  assert.equal(coded.httpStatus, 401);
  assert.equal(kindFromCode('tidak_dikenal'), null);
});

test('unauthorized dan forbidden_scope tidak pernah di-retry, bahkan bila retryable true', async () => {
  const now = new Date('2026-01-01T00:00:00Z');
  for (const kind of ['unauthorized', 'forbidden_scope']) {
    assert.deepEqual(planAfterFailure({ kind, retryable: true }, 1, now, () => 0.5), { status: 'failed', nextAttemptAt: null }, kind);
    const store = memoryStore([queued]);
    const outcome = await deliverOne(store, 'a', async () => ({ ok: false, kind, retryable: true }), 'P');
    assert.equal(outcome, 'failed');
    assert.equal(store.data.get('a').attempts, 1);
    assert.equal(store.data.get('a').nextAttemptAt, null);
  }
});

test('retry hanya bila retryable = true (internal) atau jaringan/timeout', async () => {
  const now = new Date('2026-01-01T00:00:00Z');
  assert.equal(planAfterFailure({ kind: 'server', retryable: true }, 1, now, () => 0.5).status, 'queued');
  assert.equal(planAfterFailure({ kind: 'server', retryable: false }, 1, now, () => 0.5).status, 'failed');
  assert.equal(planAfterFailure({ kind: 'rate_limited', retryable: true }, 1, now, () => 0.5).status, 'queued');
  assert.equal(planAfterFailure({ kind: 'network' }, 1, now, () => 0.5).status, 'queued');
  assert.equal(planAfterFailure({ kind: 'timeout' }, 1, now, () => 0.5).status, 'queued');
  assert.equal(planAfterFailure({ kind: 'protocol', retryable: true }, 1, now, () => 0.5).status, 'failed');
  const internalNo = await submitPortfolioFeedback(input, config, { fetchImpl: reply(rpcError(-32603, { code: 'internal', retryable: false })) });
  assert.equal(planAfterFailure(internalNo, 1, now).status, 'failed');
  const internalYes = await submitPortfolioFeedback(input, config, { fetchImpl: reply(rpcError(-32603, { code: 'internal', retryable: true })) });
  assert.equal(planAfterFailure(internalYes, 1, now).status, 'queued');
});

test('invalid_params (result isError) gagal permanen, tanpa retry, dengan alasan field', async () => {
  const body = { jsonrpc: '2.0', id: '1', result: { isError: true, structuredContent: { code: 'invalid_params', issues: [{ field: 'name', message: 'terlalu pendek' }, { field: 'role', message: 'maksimal 80 karakter' }] } } };
  const result = await submitPortfolioFeedback(input, config, { fetchImpl: reply(body) });
  assert.equal(result.ok, false);
  assert.equal(result.kind, 'invalid');
  assert.equal(result.detail, 'name: terlalu pendek; role: maksimal 80 karakter');
  assert.equal(planAfterFailure(result, 1, new Date()).status, 'failed');

  const store = memoryStore([queued]);
  const outcome = await deliverOne(store, 'a', async () => result, 'P');
  assert.equal(outcome, 'failed');
  const row = store.data.get('a');
  assert.equal(row.attempts, 1);
  assert.equal(row.nextAttemptAt, null);
  assert.equal(row.lastError, 'invalid|name: terlalu pendek; role: maksimal 80 karakter');
  assert.match(describeStoredFailure(row.lastError), /invalid_params.*name: terlalu pendek/);
});

test('Retry-After dari 429 terstruktur dihormati dan menunda percobaan berikutnya', async () => {
  const result = await submitPortfolioFeedback(input, config, {
    fetchImpl: async () => new Response(JSON.stringify(rpcError(-32029, { code: 'rate_limited', retryable: true })), { status: 429, headers: { 'retry-after': '900' } }),
  });
  assert.equal(result.kind, 'rate_limited');
  assert.equal(result.retryAfterMs, 900_000);
  const store = memoryStore([queued]);
  const now = new Date('2026-01-01T00:00:00Z');
  assert.equal(await deliverOne(store, 'a', async () => result, 'P', now, () => 0.5), 'queued');
  assert.equal(store.data.get('a').nextAttemptAt.getTime(), now.getTime() + 900_000);
});

test('avatar_url hanya terkirim bila URL https publik yang valid', async () => {
  const good = 'https://cdn.example.com/avatars/budi.webp';
  assert.equal(validAvatarUrl(good), good);
  assert.equal(validAvatarUrl(`  ${good}  `), good);
  for (const bad of ['', '   ', null, undefined, 42, 'http://cdn.example.com/a.webp', 'https://user:pw@cdn.example.com/a.webp', 'https://user@cdn.example.com/a.webp', 'ftp://x.example.com/a', 'bukan url', `https://cdn.example.com/${'a'.repeat(500)}`]) {
    assert.equal(validAvatarUrl(bad), null, String(bad));
  }
  assert.equal(validAvatarUrl(`https://cdn.example.com/${'a'.repeat(500 - 'https://cdn.example.com/'.length)}`)?.length, 500);

  const sent = async (avatar_url) => {
    let args;
    await submitPortfolioFeedback({ ...input, avatar_url }, config, {
      fetchImpl: async (_u, init) => { args = JSON.parse(init.body).params.arguments; return new Response(JSON.stringify(ok), { status: 200 }); },
    });
    return args;
  };
  assert.equal((await sent(good)).avatar_url, good);
  for (const bad of ['', null, 'http://x.example.com/a.webp', 'https://u:p@x.example.com/a.webp']) {
    assert.equal('avatar_url' in (await sent(bad)), false, String(bad));
  }
});

test('toMcpInput: tanpa URL foto permanen, avatar_url tidak ikut terkirim', () => {
  const row = { id: 'abc', name: 'Budi', role: null, message: 'Aplikasinya sangat membantu.', rating: 5, attempts: 1 };
  const plain = toMcpInput(row, 'P');
  assert.equal('avatar_url' in plain, false);
  assert.equal(plain.idempotency_key, 'abc');
  assert.equal(toMcpInput({ ...row, avatarUrl: null }, 'P').avatar_url, undefined);
  assert.equal(toMcpInput({ ...row, avatarUrl: 'https://cdn.example.com/a.webp' }, 'P').avatar_url, 'https://cdn.example.com/a.webp');
});

test('simpan dan baca penyebab gagal: ringkasan dibersihkan dan dipotong', () => {
  assert.equal(packFailure('timeout'), 'timeout');
  assert.equal(packFailure('invalid', 'a|b\nc'), 'invalid|a b c');
  assert.equal(packFailure('invalid', 'x'.repeat(500)).length, 'invalid|'.length + 200);
  assert.deepEqual(unpackFailure('invalid|name: x'), { kind: 'invalid', detail: 'name: x' });
  assert.deepEqual(unpackFailure('network'), { kind: 'network', detail: null });
  assert.equal(unpackFailure(null), null);
  assert.equal(describeStoredFailure(null), null);
  assert.match(describeStoredFailure('forbidden_scope'), /feedback:write/);
});

test('tes koneksi: /health tanpa key lebih dulu, lalu tools/list dengan key', async () => {
  assert.equal(healthUrl('https://alfizilham.vercel.app/api/mcp'), 'https://alfizilham.vercel.app/api/mcp/health');
  assert.equal(healthUrl('https://alfizilham.vercel.app/api/mcp/?x=1'), 'https://alfizilham.vercel.app/api/mcp/health');

  const calls = [];
  const toolsOk = { jsonrpc: '2.0', id: '1', result: { tools: [{ name: 'submit_feedback', inputSchema: { properties: { name: {}, message: {}, rating: {}, role: {}, company: {}, project: {}, idempotency_key: {}, avatar_url: {} } } }] } };
  const healthy = { ok: true, database: 'up', version: '1.4.0', tools: 1 };
  const router = (health, tools) => async (url, init) => {
    calls.push({ url, method: init.method, auth: init.headers.Authorization });
    return init.method === 'GET' ? health(url) : tools();
  };
  const result = await testPortfolioConnection(config, {
    fetchImpl: router(() => new Response(JSON.stringify(healthy), { status: 200 }), () => new Response(JSON.stringify(toolsOk), { status: 200 })),
  });
  assert.equal(result.ok, true);
  assert.equal(result.health.version, '1.4.0');
  assert.equal(result.toolFound, true);
  assert.deepEqual(result.missingFields, []);
  assert.equal(result.avatarField, 'avatar_url');
  assert.equal(result.scopeMissing, false);
  assert.deepEqual(calls.map((c) => c.method), ['GET', 'POST']);
  assert.equal(calls[0].url, 'https://portfolio.example.com/api/mcp/health');
  assert.equal(calls[0].auth, undefined);
  assert.equal(calls[1].auth, `Bearer ${config.apiKey}`);
});

test('tes koneksi: masalah jaringan/DNS terdeteksi di /health dan key tidak dipakai', async () => {
  const dns = Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('x'), { code: 'ENOTFOUND' }) });
  let posted = 0;
  const result = await testPortfolioConnection(config, {
    fetchImpl: async (_u, init) => { if (init.method === 'POST') posted += 1; throw dns; },
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'health');
  assert.equal(result.kind, 'dns');
  assert.equal(posted, 0);

  const down = await testPortfolioConnection(config, { fetchImpl: async () => new Response('', { status: 503 }) });
  assert.equal(down.stage, 'health');
  assert.equal(down.kind, 'server');
  const sick = await testPortfolioConnection(config, { fetchImpl: reply({ ok: false, database: 'down' }) });
  assert.equal(sick.stage, 'health');
  assert.equal(sick.kind, 'server');
});

test('tes koneksi: key ditolak dibedakan dari jaringan; tools/list kosong = scope hilang', async () => {
  const healthy = new Response(JSON.stringify({ ok: true, database: 'up', version: '1', tools: 1 }), { status: 200 });
  const denied = await testPortfolioConnection(config, {
    fetchImpl: async (_u, init) => (init.method === 'GET' ? healthy.clone() : new Response(JSON.stringify(rpcError(-32001, { code: 'unauthorized', retryable: false })), { status: 401 })),
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.stage, 'tools');
  assert.equal(denied.kind, 'unauthorized');

  const empty = await testPortfolioConnection(config, {
    fetchImpl: async (_u, init) => (init.method === 'GET' ? healthy.clone() : new Response(JSON.stringify({ jsonrpc: '2.0', id: '1', result: { tools: [] } }), { status: 200 })),
  });
  assert.equal(empty.ok, true);
  assert.equal(empty.scopeMissing, true);
  assert.equal(empty.toolFound, false);

  const noHealthEndpoint = await testPortfolioConnection(config, {
    fetchImpl: async (_u, init) => (init.method === 'GET' ? new Response('', { status: 404 }) : new Response(JSON.stringify({ jsonrpc: '2.0', id: '1', result: { tools: [{ name: 'submit_feedback', inputSchema: { properties: {} } }] } }), { status: 200 })),
  });
  assert.equal(noHealthEndpoint.ok, true);
  assert.equal(noHealthEndpoint.health, null);
});
