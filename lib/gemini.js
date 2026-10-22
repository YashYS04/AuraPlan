import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { HttpError } from './http.js';
import { GENERATED_PLAN_JSON_SCHEMA } from './schema.js';

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const TIMEOUT_MS = 45_000;
const MAX_OUTPUT_TOKENS = 8192;
const RETRY_DELAY_MS = 800;
const RETRYABLE_STATUSES = new Set([429, 500, 503]);

/** @type {GoogleGenAI | undefined} Created lazily and reused across warm invocations. */
let client;

/**
 * Checks if the upstream error qualifies for an automatic retry attempt.
 * @param {unknown} error
 * @returns {boolean}
 */
const isRetryable = (error) => error instanceof ApiError && RETRYABLE_STATUSES.has(error.status);

/**
 * Maps upstream exceptions to client-safe HTTP errors without exposing internals.
 * @param {unknown} error
 * @returns {HttpError}
 */
function toHttpError(error) {
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) {
    return new HttpError(504, 'AI_TIMEOUT', 'The AI planner took too long to respond. Please try again.');
  }
  return new HttpError(502, 'AI_UNAVAILABLE', 'The planning service is temporarily unavailable. Please retry in a few moments.');
}

/**
 * Invokes Gemini with strict structured output schema and automated retry for transient failures.
 * @param {{ systemInstruction: string, contents: string }} prompt
 * @returns {Promise<string>}
 */
export async function generatePlan({ systemInstruction, contents }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, 'AI_NOT_CONFIGURED', 'GEMINI_API_KEY environment variable is not configured.');
  }

  client ??= new GoogleGenAI({ apiKey });

  // Single shared abort signal spanning both attempts so timeout boundary is strictly respected
  const abortSignal = AbortSignal.timeout(TIMEOUT_MS);
  const call = () =>
    client.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseJsonSchema: GENERATED_PLAN_JSON_SCHEMA,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        abortSignal,
      },
    });

  try {
    let response;
    try {
      response = await call();
    } catch (error) {
      if (!isRetryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      response = await call();
    }
    return response.text ?? '';
  } catch (error) {
    console.error('gemini_request_failed', error instanceof ApiError ? error.status : error?.name);
    throw toHttpError(error);
  }
}
