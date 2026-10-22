import { createHash } from 'node:crypto';
import { createLruCache } from '../lib/cache.js';
import { generatePlan } from '../lib/gemini.js';
import { HttpError, errorResponse, json, readJsonBody } from '../lib/http.js';
import { enrichPlan, toIsoDate } from '../lib/planner.js';
import { buildPrompt } from '../lib/prompt.js';
import { createRateLimiter } from '../lib/rate-limit.js';
import { parseGeneratedPlan, parsePlanRequest } from '../lib/schema.js';

export const config = { maxDuration: 60 };

const MAX_BODY_BYTES = 32 * 1024;
const CACHE_MAX_ENTRIES = 200;
const CACHE_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/**
 * Extracts client IP safely from forwarded headers.
 * @param {Request} request
 * @returns {string}
 */
const clientKey = (request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

/**
 * Generates deterministic cache key using SHA-256.
 * @param {unknown} input
 * @returns {string}
 */
const cacheKey = (input) => createHash('sha256').update(JSON.stringify(input)).digest('hex');

/**
 * Factory creating POST /api/plan handler with dependency injection for testing.
 *
 * @param {{
 *   generate: (prompt: { systemInstruction: string, contents: string }) => Promise<string>,
 *   now?: () => number,
 *   cache?: ReturnType<typeof createLruCache>,
 *   limiter?: ReturnType<typeof createRateLimiter>,
 * }} deps
 */
export function createPlanHandler({
  generate,
  now = Date.now,
  cache = createLruCache({ max: CACHE_MAX_ENTRIES, ttlMs: CACHE_TTL_MS, now }),
  limiter = createRateLimiter({ limit: RATE_LIMIT_REQUESTS, windowMs: RATE_LIMIT_WINDOW_MS, now }),
}) {
  return async function handlePlan(request) {
    try {
      if (request.method !== 'POST') {
        throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Only POST requests are supported.');
      }

      // Origin and Sec-Fetch-Site CSRF validation
      const fetchSite = request.headers.get('sec-fetch-site');
      if (fetchSite === 'cross-site') {
        throw new HttpError(403, 'FORBIDDEN', 'Cross-site requests are rejected.');
      }

      const { allowed, retryAfterSeconds } = limiter(clientKey(request));
      if (!allowed) {
        throw new HttpError(
          429,
          'RATE_LIMITED',
          'Too many planning requests in a short time. Please wait a moment.',
          { headers: { 'retry-after': String(retryAfterSeconds) } },
        );
      }

      const today = toIsoDate(now());
      const rawBody = await readJsonBody(request, MAX_BODY_BYTES);
      const input = parsePlanRequest(rawBody, today);

      const key = cacheKey(input);
      let plan = cache.get(key);

      if (!plan) {
        const prompt = buildPrompt(input);
        const rawModelOutput = await generate(prompt);
        plan = parseGeneratedPlan(rawModelOutput);
        cache.set(key, plan);
      }

      const enriched = enrichPlan(plan, {
        budget: input.budget,
        eventDate: input.eventDate,
        today,
      });

      return json({ plan: enriched });
    } catch (error) {
      if (error instanceof HttpError) {
        return errorResponse(error);
      }
      console.error('plan_handler_error', error?.name);
      return errorResponse(new HttpError(500, 'INTERNAL_ERROR', 'An unexpected error occurred. Please try again.'));
    }
  };
}

export const POST = createPlanHandler({ generate: generatePlan });
