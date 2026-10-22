/**
 * Sliding window rate limiter with auto-pruning to prevent memory leaks.
 *
 * @param {{
 *   limit?: number,
 *   windowMs?: number,
 *   now?: () => number
 * }} [options]
 */
export function createRateLimiter({
  limit = 10,
  windowMs = 60 * 1000,
  maxKeys = 5000,
  now = Date.now,
} = {}) {
  /** @type {Map<string, number[]>} */
  const requests = new Map();

  return function checkRateLimit(key) {
    const currentTime = now();
    const windowStart = currentTime - windowMs;

    let timestamps = requests.get(key);
    if (!timestamps) {
      if (requests.size >= maxKeys) {
        // Prune expired buckets when approaching key ceiling
        for (const [k, times] of requests.entries()) {
          const valid = times.filter((t) => t > windowStart);
          if (valid.length === 0) {
            requests.delete(k);
          } else {
            requests.set(k, valid);
          }
        }
      }
      timestamps = [];
      requests.set(key, timestamps);
    }

    // Keep timestamps within the active sliding window
    const validTimestamps = timestamps.filter((t) => t > windowStart);
    requests.set(key, validTimestamps);

    if (validTimestamps.length >= limit) {
      const oldestInWindow = validTimestamps[0];
      const retryAfterMs = oldestInWindow + windowMs - currentTime;
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return { allowed: false, retryAfterSeconds };
    }

    validTimestamps.push(currentTime);
    return { allowed: true, retryAfterSeconds: 0 };
  };
}
