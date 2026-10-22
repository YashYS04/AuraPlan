import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { HttpError } from '../lib/http.js';
import { parseGeneratedPlan, parsePlanRequest } from '../lib/schema.js';
import { MOCK_GENERATED_PLAN, MOCK_REQUEST_DATA } from './fixtures.js';

const TODAY = '2026-05-01';

describe('parsePlanRequest', () => {
  test('validates compliant request input', () => {
    const parsed = parsePlanRequest(MOCK_REQUEST_DATA, TODAY);
    assert.equal(parsed.eventType, 'wedding');
    assert.equal(parsed.budget, 30000);
    assert.equal(parsed.guestCount, 120);
  });

  test('strips invisible control characters from user text', () => {
    const payload = {
      ...MOCK_REQUEST_DATA,
      vibe: 'Modern\u0000\u0007\u001f Garden',
    };
    const parsed = parsePlanRequest(payload, TODAY);
    assert.equal(parsed.vibe, 'Modern  Garden');
  });

  test('rejects past dates or dates beyond maximum window', () => {
    assert.throws(
      () => parsePlanRequest({ ...MOCK_REQUEST_DATA, eventDate: '2025-01-01' }, TODAY),
      (err) => err instanceof HttpError && err.status === 400 && 'eventDate' in err.details.fieldErrors,
    );

    assert.throws(
      () => parsePlanRequest({ ...MOCK_REQUEST_DATA, eventDate: '2035-01-01' }, TODAY),
      (err) => err instanceof HttpError && err.status === 400 && 'eventDate' in err.details.fieldErrors,
    );
  });

  test('rejects out-of-bound guest counts and budgets', () => {
    assert.throws(
      () => parsePlanRequest({ ...MOCK_REQUEST_DATA, guestCount: 0 }, TODAY),
      (err) => err instanceof HttpError && err.status === 400,
    );

    assert.throws(
      () => parsePlanRequest({ ...MOCK_REQUEST_DATA, budget: -500 }, TODAY),
      (err) => err instanceof HttpError && err.status === 400,
    );
  });

  test('enforces feedback and previousPlan pair requirement', () => {
    assert.throws(
      () => parsePlanRequest({ ...MOCK_REQUEST_DATA, feedback: 'Make it cheaper' }, TODAY),
      (err) => err instanceof HttpError && err.status === 400,
    );

    assert.throws(
      () => parsePlanRequest({ ...MOCK_REQUEST_DATA, previousPlan: MOCK_GENERATED_PLAN }, TODAY),
      (err) => err instanceof HttpError && err.status === 400,
    );
  });

  test('rejects unknown fields to prevent mass-assignment attacks', () => {
    assert.throws(
      () => parsePlanRequest({ ...MOCK_REQUEST_DATA, maliciousField: true }, TODAY),
      (err) => err instanceof HttpError && err.status === 400,
    );
  });
});

describe('parseGeneratedPlan', () => {
  test('successfully parses valid schema JSON', () => {
    const text = JSON.stringify(MOCK_GENERATED_PLAN);
    const parsed = parseGeneratedPlan(text);
    assert.equal(parsed.summary, MOCK_GENERATED_PLAN.summary);
    assert.equal(parsed.budget.length, 5);
  });

  test('throws 502 AI_BAD_RESPONSE on malformed JSON', () => {
    assert.throws(
      () => parseGeneratedPlan('{ incomplete json...'),
      (err) => err instanceof HttpError && err.status === 502 && err.code === 'AI_BAD_RESPONSE',
    );
  });

  test('throws 502 AI_BAD_RESPONSE on schema violations', () => {
    const invalidPlan = { summary: 'Too brief', budget: [] }; // missing required arrays
    assert.throws(
      () => parseGeneratedPlan(JSON.stringify(invalidPlan)),
      (err) => err instanceof HttpError && err.status === 502,
    );
  });
});
