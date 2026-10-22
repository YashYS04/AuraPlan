/**
 * Lightweight HTTP helpers for edge/serverless runtimes.
 */

export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Standard JSON response constructor.
 * @param {unknown} data
 * @param {number} [status=200]
 * @param {Record<string, string>} [headers={}]
 * @returns {Response}
 */
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

/**
 * Serializes an error safely for client consumption without exposing stack traces.
 * @param {Error | HttpError} error
 * @returns {Response}
 */
export function errorResponse(error) {
  if (error instanceof HttpError) {
    const { headers, ...rest } = error.details || {};
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...rest,
        },
      },
      error.status,
      headers || {},
    );
  }

  return json(
    {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
      },
    },
    500,
  );
}

/**
 * Safely parses JSON with prototype pollution protection.
 * @param {string} text
 * @returns {unknown}
 */
export function safeJsonParse(text) {
  return JSON.parse(text, (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    return value;
  });
}

/**
 * Reads and parses JSON payload up to a strict byte limit.
 * @param {Request} request
 * @param {number} [maxBytes=32768]
 * @returns {Promise<unknown>}
 */
export async function readJsonBody(request, maxBytes = 32 * 1024) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBytes) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds the ${maxBytes} byte limit.`);
  }

  let text;
  try {
    text = await request.text();
  } catch {
    throw new HttpError(400, 'READ_ERROR', 'Failed to read request body.');
  }

  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds the ${maxBytes} byte limit.`);
  }

  try {
    return safeJsonParse(text);
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}
