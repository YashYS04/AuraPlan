import assert from 'node:assert/strict';
import { afterEach, before, describe, it, mock } from 'node:test';
import { generatePlan } from '../lib/gemini.js';

const PROMPT = { systemInstruction: 'system prompt', contents: 'plan request' };

const geminiReply = (text) =>
  Response.json({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] });

const geminiError = (status) =>
  Response.json({ error: { code: status, message: 'upstream error', status: 'UNAVAILABLE' } }, { status });

function mockFetch(...responses) {
  const queue = [...responses];
  return mock.method(globalThis, 'fetch', async () => {
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
  });
}

describe('generatePlan', () => {
  afterEach(() => mock.restoreAll());

  it('rejects with 503 if GEMINI_API_KEY is not configured', async () => {
    const key = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const fetch = mockFetch();

    await assert.rejects(generatePlan(PROMPT), { status: 503, code: 'AI_NOT_CONFIGURED' });
    assert.equal(fetch.mock.callCount(), 0);

    if (key !== undefined) process.env.GEMINI_API_KEY = key;
  });

  describe('with configured API key', () => {
    before(() => {
      process.env.GEMINI_API_KEY ??= 'mock-test-key';
    });

    it('returns raw JSON output and configures structured output schema', async () => {
      const fetch = mockFetch(geminiReply('{"ok":true}'));
      const result = await generatePlan(PROMPT);

      assert.equal(result, '{"ok":true}');
      assert.equal(fetch.mock.callCount(), 1);

      const requestBody = JSON.parse(fetch.mock.calls[0].arguments[1].body);
      assert.equal(requestBody.generationConfig.responseMimeType, 'application/json');
      assert.ok(requestBody.generationConfig.responseJsonSchema.properties.budget);
      assert.ok(requestBody.generationConfig.responseJsonSchema.properties.timeline);
    });

    it('retries transient network/service errors (503) once', async () => {
      const fetch = mockFetch(geminiError(503), geminiReply('{"ok":true}'));
      const result = await generatePlan(PROMPT);

      assert.equal(result, '{"ok":true}');
      assert.equal(fetch.mock.callCount(), 2);
    });

    it('does not retry 400 client errors and maps to 502 AI_UNAVAILABLE', async () => {
      const fetch = mockFetch(geminiError(400));
      await assert.rejects(generatePlan(PROMPT), { status: 502, code: 'AI_UNAVAILABLE' });
      assert.equal(fetch.mock.callCount(), 1);
    });

    it('maps abort or timeout signals to 504 AI_TIMEOUT', async () => {
      for (const name of ['AbortError', 'TimeoutError']) {
        mockFetch(new DOMException('Request timed out', name));
        await assert.rejects(generatePlan(PROMPT), { status: 504, code: 'AI_TIMEOUT' });
      }
    });

    it('shares a single abort deadline across attempts', async () => {
      const timeout = mock.method(AbortSignal, 'timeout');
      mockFetch(geminiError(503), geminiReply('{"ok":true}'));
      await generatePlan(PROMPT);
      assert.equal(timeout.mock.callCount(), 1);
    });
  });
});
