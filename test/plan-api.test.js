import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPlanHandler } from '../api/plan.js';
import { createLruCache } from '../lib/cache.js';
import { createRateLimiter } from '../lib/rate-limit.js';
import { MOCK_GENERATED_PLAN, MOCK_REQUEST_DATA } from './fixtures.js';

const mockRequest = (body, { method = 'POST', headers = {} } = {}) =>
  new Request('https://auraplan.app/api/plan', {
    method,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('createPlanHandler', () => {
  it('returns 200 with mathematically enriched plan on valid input', async () => {
    let called = 0;
    const handler = createPlanHandler({
      generate: async () => {
        called++;
        return JSON.stringify(MOCK_GENERATED_PLAN);
      },
    });

    const res = await handler(mockRequest(MOCK_REQUEST_DATA));
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(body.plan);
    assert.equal(body.plan.summary, MOCK_GENERATED_PLAN.summary);
    assert.equal(called, 1);
  });

  it('serves cached plan on repeated identical requests without re-invoking generator', async () => {
    let called = 0;
    const cache = createLruCache();
    const handler = createPlanHandler({
      generate: async () => {
        called++;
        return JSON.stringify(MOCK_GENERATED_PLAN);
      },
      cache,
    });

    const res1 = await handler(mockRequest(MOCK_REQUEST_DATA));
    assert.equal(res1.status, 200);

    const res2 = await handler(mockRequest(MOCK_REQUEST_DATA));
    assert.equal(res2.status, 200);

    assert.equal(called, 1); // Generator called only once
  });

  it('rejects non-POST methods with 405', async () => {
    const handler = createPlanHandler({ generate: async () => '{}' });
    const res = await handler(
      new Request('https://auraplan.app/api/plan', { method: 'GET' }),
    );
    assert.equal(res.status, 405);
  });

  it('blocks cross-site fetch requests with 403', async () => {
    const handler = createPlanHandler({ generate: async () => '{}' });
    const res = await handler(
      mockRequest(MOCK_REQUEST_DATA, { headers: { 'sec-fetch-site': 'cross-site' } }),
    );
    assert.equal(res.status, 403);
  });

  it('rejects payloads missing application/json content-type with 415', async () => {
    const handler = createPlanHandler({ generate: async () => '{}' });
    const res = await handler(
      new Request('https://auraplan.app/api/plan', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'invalid',
      }),
    );
    assert.equal(res.status, 415);
  });

  it('rejects oversized bodies with 413', async () => {
    const handler = createPlanHandler({ generate: async () => '{}' });
    const hugeBody = { ...MOCK_REQUEST_DATA, vibe: 'x'.repeat(40000) };
    const res = await handler(mockRequest(hugeBody));
    assert.equal(res.status, 413);
  });

  it('enforces rate limits and returns 429 with retry-after header', async () => {
    const limiter = createRateLimiter({ limit: 1 });
    const handler = createPlanHandler({
      generate: async () => JSON.stringify(MOCK_GENERATED_PLAN),
      limiter,
    });

    const res1 = await handler(mockRequest(MOCK_REQUEST_DATA));
    assert.equal(res1.status, 200);

    const res2 = await handler(mockRequest(MOCK_REQUEST_DATA));
    assert.equal(res2.status, 429);
    assert.ok(res2.headers.get('retry-after'));
  });

  it('returns 400 when input validation fails', async () => {
    const handler = createPlanHandler({ generate: async () => '{}' });
    const invalidInput = { ...MOCK_REQUEST_DATA, guestCount: -1 };
    const res = await handler(mockRequest(invalidInput));
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.equal(body.error.code, 'INVALID_REQUEST');
  });

  it('returns 502 when model output cannot be parsed', async () => {
    const handler = createPlanHandler({
      generate: async () => 'broken json output',
    });
    const res = await handler(mockRequest(MOCK_REQUEST_DATA));
    assert.equal(res.status, 502);

    const body = await res.json();
    assert.equal(body.error.code, 'AI_BAD_RESPONSE');
  });
});
