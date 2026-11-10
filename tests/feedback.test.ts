import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFeedbackHandler } from '../src/lib/feedback-handler';
import { submitPortfolioFeedback, type FeedbackInput, type FeedbackResult } from '../src/lib/portfolio-feedback';

const feedback: FeedbackInput = { name: 'Ayu', message: 'Sangat membantu', rating: 5 };
const pending = { jsonrpc: '2.0', result: { structuredContent: { id: 'test-id', status: 'pending' } } };
const okSubmit = async () => ({ status: 'ok' } as const);

function request(body: unknown, options: { ip?: string; contentType?: string; origin?: string; raw?: string } = {}) {
  const headers = new Headers({ 'Content-Type': options.contentType ?? 'application/json', Origin: options.origin ?? 'https://app.example.test', Host: 'app.example.test', 'X-Forwarded-For': options.ip ?? '192.0.2.10' });
  return new Request('https://app.example.test/api/feedback', {
    method: 'POST',
    headers,
    body: options.raw ?? JSON.stringify(body),
  });
}

const validBody = { name: '  Ayu   Putri ', role: '', company: 'Komunitas', rating: 5, message: 'Masukannya bagus sekali', consent: true };

test('helper maps valid pending MCP response to ok and forwards only supplied feedback arguments', async () => {
  const originalUrl = process.env.PORTFOLIO_MCP_URL;
  const originalKey = process.env.PORTFOLIO_MCP_API_KEY;
  process.env.PORTFOLIO_MCP_URL = 'https://mcp.example.test/api/mcp';
  process.env.PORTFOLIO_MCP_API_KEY = 'test-secret-key';
  let sent: RequestInit | undefined;
  try {
    const result = await submitPortfolioFeedback(feedback, {
      fetchImpl: (async (_url, init) => { sent = init; return new Response(JSON.stringify(pending), { status: 200 }); }) as typeof fetch,
    });
    assert.deepEqual(result, { status: 'ok' });
    assert.equal((sent?.headers as Record<string, string>).Authorization, 'Bearer test-secret-key');
    const body = JSON.parse(String(sent?.body)) as { params: { arguments: Record<string, unknown> } };
    assert.deepEqual(body.params.arguments, feedback);

    const messages: string[] = [];
    const old = { ...console };
    console.log = (...values: unknown[]) => messages.push(values.join(' '));
    console.info = (...values: unknown[]) => messages.push(values.join(' '));
    console.warn = (...values: unknown[]) => messages.push(values.join(' '));
    console.error = (...values: unknown[]) => messages.push(values.join(' '));
    try {
      await submitPortfolioFeedback(feedback, { fetchImpl: (async () => new Response(JSON.stringify(pending), { status: 200 })) as typeof fetch });
      assert.equal(messages.some((line) => line.includes('test-secret-key')), false);
    } finally {
      console.log = old.log;
      console.info = old.info;
      console.warn = old.warn;
      console.error = old.error;
    }
  } finally {
    if (originalUrl === undefined) delete process.env.PORTFOLIO_MCP_URL;
    else process.env.PORTFOLIO_MCP_URL = originalUrl;
    if (originalKey === undefined) delete process.env.PORTFOLIO_MCP_API_KEY;
    else process.env.PORTFOLIO_MCP_API_KEY = originalKey;
  }
});

test('helper maps 401 and 429 distinctly', async () => {
  const before = [process.env.PORTFOLIO_MCP_URL, process.env.PORTFOLIO_MCP_API_KEY];
  process.env.PORTFOLIO_MCP_URL = 'https://mcp.example.test';
  process.env.PORTFOLIO_MCP_API_KEY = 'test-key';
  try {
    for (const [status, expected] of [[401, 'unauthorized'], [429, 'rate-limited']] as const) {
      assert.deepEqual(await submitPortfolioFeedback(feedback, { fetchImpl: (async () => new Response('', { status })) as typeof fetch }), { status: expected });
    }
  } finally {
    if (before[0] === undefined) delete process.env.PORTFOLIO_MCP_URL; else process.env.PORTFOLIO_MCP_URL = before[0];
    if (before[1] === undefined) delete process.env.PORTFOLIO_MCP_API_KEY; else process.env.PORTFOLIO_MCP_API_KEY = before[1];
  }
});

test('helper rejects tool errors, malformed responses, non-200 statuses, and times out', async () => {
  const before = [process.env.PORTFOLIO_MCP_URL, process.env.PORTFOLIO_MCP_API_KEY];
  process.env.PORTFOLIO_MCP_URL = 'https://mcp.example.test';
  process.env.PORTFOLIO_MCP_API_KEY = 'test-key';
  try {
    const cases: Array<[typeof fetch, FeedbackResult]> = [
      [(async () => new Response(JSON.stringify({ result: { isError: true } }), { status: 200 })) as typeof fetch, { status: 'invalid' }],
      [(async () => new Response('{', { status: 200 })) as typeof fetch, { status: 'unavailable' }],
      [(async () => new Response(JSON.stringify({ result: {} }), { status: 200 })) as typeof fetch, { status: 'unavailable' }],
      [(async () => new Response(JSON.stringify(pending), { status: 201 })) as typeof fetch, { status: 'unavailable' }],
    ];
    for (const [fetchImpl, expected] of cases) assert.deepEqual(await submitPortfolioFeedback(feedback, { fetchImpl }), expected);
    const timeoutFetch = ((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })) as typeof fetch;
    assert.deepEqual(await submitPortfolioFeedback(feedback, { fetchImpl: timeoutFetch, timeoutMs: 1 }), { status: 'unavailable' });
  } finally {
    if (before[0] === undefined) delete process.env.PORTFOLIO_MCP_URL; else process.env.PORTFOLIO_MCP_URL = before[0];
    if (before[1] === undefined) delete process.env.PORTFOLIO_MCP_API_KEY; else process.env.PORTFOLIO_MCP_API_KEY = before[1];
  }
});

test('helper reports not-configured without fetch', async () => {
  const before = [process.env.PORTFOLIO_MCP_URL, process.env.PORTFOLIO_MCP_API_KEY];
  delete process.env.PORTFOLIO_MCP_URL;
  delete process.env.PORTFOLIO_MCP_API_KEY;
  try {
    assert.deepEqual(await submitPortfolioFeedback(feedback), { status: 'not-configured' });
  } finally {
    if (before[0] !== undefined) process.env.PORTFOLIO_MCP_URL = before[0];
    if (before[1] !== undefined) process.env.PORTFOLIO_MCP_API_KEY = before[1];
  }
});

test('route validates consent and fields before calling MCP', async () => {
  let calls = 0;
  const post = createFeedbackHandler(async () => { calls += 1; return { status: 'ok' }; });
  const consentFalse = await post(request({ ...validBody, consent: false }));
  const badRating = await post(request({ ...validBody, rating: 6 }));
  assert.equal(consentFalse.status, 400);
  assert.equal(badRating.status, 400);
  assert.equal(calls, 0);
});

test('route acknowledges honeypot without calling MCP', async () => {
  let calls = 0;
  const post = createFeedbackHandler(async () => { calls += 1; return { status: 'ok' }; });
  const response = await post(request({ website: 'spam-bot' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(calls, 0);
});

test('route enforces JSON, origin, and the 8 KiB body limit', async () => {
  const post = createFeedbackHandler(okSubmit);
  assert.equal((await post(request(validBody, { contentType: 'text/plain' }))).status, 415);
  assert.equal((await post(request(validBody, { contentType: 'application/jsonp' }))).status, 415);
  assert.equal((await post(request(validBody, { origin: 'https://attacker.example.test' }))).status, 403);
  assert.equal((await post(request(validBody, { origin: 'http://app.example.test' }))).status, 403);
  assert.equal((await post(request(validBody, { origin: '' }))).status, 403);
  assert.equal((await post(request({}, { raw: JSON.stringify({ message: 'x'.repeat(9000) }) }))).status, 413);
});

test('route hashes IPs for a 3-per-10-minute limit and returns Retry-After', async () => {
  let calls = 0;
  const post = createFeedbackHandler(async () => { calls += 1; return { status: 'ok' }; });
  for (let index = 0; index < 3; index++) assert.equal((await post(request(validBody, { ip: '198.51.100.42' }))).status, 200);
  const limited = await post(request(validBody, { ip: '198.51.100.42' }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '600');
  assert.equal(calls, 3);
});

test('route maps all upstream statuses without leaking upstream details or returned id', async () => {
  for (const [status, expected] of [
    ['invalid', 400], ['rate-limited', 429], ['unauthorized', 503], ['unavailable', 503], ['not-configured', 503],
  ] as const) {
    const post = createFeedbackHandler(async () => ({ status }));
    const response = await post(request(validBody, { ip: `203.0.113.${expected}` }));
    assert.equal(response.status, expected);
    if (status === 'rate-limited') assert.equal(response.headers.get('Retry-After'), '60');
    const body = await response.json() as { ok?: boolean; error?: string; id?: string };
    assert.equal(body.id, undefined);
    if (expected === 503) assert.equal(body.error, 'Masukan belum dapat dikirim saat ini. Coba lagi beberapa saat lagi.');
  }

  let forwarded: FeedbackInput | undefined;
  const success = createFeedbackHandler(async (input) => { forwarded = input; return { status: 'ok' }; });
  const response = await success(request(validBody, { ip: '203.0.113.99' }));
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(forwarded, { name: 'Ayu Putri', message: validBody.message, rating: 5, company: 'Komunitas', project: 'PusakaPosters' });
});
