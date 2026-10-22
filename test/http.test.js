import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { HttpError, errorResponse, json, readJsonBody, safeJsonParse } from '../lib/http.js';

describe('HTTP Module', () => {
  test('json helper sets proper defaults and custom headers', async () => {
    const res = json({ ok: true }, 201, { 'x-custom': 'val' });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(res.headers.get('x-custom'), 'val');
    const data = await res.json();
    assert.deepEqual(data, { ok: true });
  });

  test('errorResponse formats HttpError with custom code and details', async () => {
    const err = new HttpError(404, 'NOT_FOUND', 'Item missing', { id: 123 });
    const res = errorResponse(err);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(body.error.message, 'Item missing');
    assert.equal(body.error.id, 123);
  });

  test('errorResponse masks unexpected internal errors without leaking details', async () => {
    const err = new Error('Database password leak or disk crash');
    const res = errorResponse(err);
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR');
    assert.equal(body.error.message, 'An unexpected error occurred. Please try again later.');
    assert.equal(body.error.stack, undefined);
  });

  test('safeJsonParse strips malicious prototype pollution keys', () => {
    const maliciousJson = '{"__proto__":{"polluted":true},"normal":"safe","constructor":{"hack":true}}';
    const parsed = safeJsonParse(maliciousJson);
    assert.equal(parsed.normal, 'safe');
    assert.equal(Object.prototype.polluted, undefined);
    assert.equal(parsed.polluted, undefined);
  });

  test('readJsonBody validates content type and limits', async () => {
    // Non-json
    const nonJsonReq = new Request('https://auraplan.app', {
      method: 'POST',
      headers: { 'content-type': 'text/html' },
      body: '<html/>',
    });
    await assert.rejects(readJsonBody(nonJsonReq), { status: 415 });

    // Content-length header too large
    const headerOversizedReq = new Request('https://auraplan.app', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '999999' },
      body: '{}',
    });
    await assert.rejects(readJsonBody(headerOversizedReq, 100), { status: 413 });

    // Stream read error
    const readFailReq = {
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => {
        throw new Error('Stream read failed');
      },
    };
    await assert.rejects(readJsonBody(readFailReq), { status: 400, code: 'READ_ERROR' });

    // Body actual bytes too large (chunked / stream without content-length header)
    const chunkedOversizedReq = {
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({ data: 'x'.repeat(200) }),
    };
    await assert.rejects(readJsonBody(chunkedOversizedReq, 50), { status: 413 });

    // Invalid json syntax
    const badJsonReq = new Request('https://auraplan.app', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not valid json',
    });
    await assert.rejects(readJsonBody(badJsonReq), { status: 400 });

    // Valid json
    const validReq = new Request('https://auraplan.app', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    });
    const parsed = await readJsonBody(validReq);
    assert.deepEqual(parsed, { hello: 'world' });
  });
});
