/**
 * Lightweight, high-performance in-memory LRU cache with TTL eviction.
 *
 * @template V
 * @param {{
 *   max?: number,
 *   ttlMs?: number,
 *   now?: () => number
 * }} [options]
 */
export function createLruCache({ max = 200, ttlMs = 10 * 60 * 1000, now = Date.now } = {}) {
  /** @type {Map<string, { value: V, expiresAt: number }>} */
  const cache = new Map();

  return {
    /**
     * @param {string} key
     * @returns {V | undefined}
     */
    get(key) {
      const entry = cache.get(key);
      if (!entry) return undefined;

      if (entry.expiresAt <= now()) {
        cache.delete(key);
        return undefined;
      }

      // Re-insert to mark as most recently accessed
      cache.delete(key);
      cache.set(key, entry);
      return entry.value;
    },

    /**
     * @param {string} key
     * @param {V} value
     */
    set(key, value) {
      if (cache.has(key)) {
        cache.delete(key);
      } else if (cache.size >= max) {
        // Map keys iterate in insertion order; first key is the oldest / least recently used
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) {
          cache.delete(oldestKey);
        }
      }

      cache.set(key, { value, expiresAt: now() + ttlMs });
    },

    /**
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
      return this.get(key) !== undefined;
    },

    /**
     * @returns {number}
     */
    size() {
      return cache.size;
    },

    /**
     * Clears all entries.
     */
    clear() {
      cache.clear();
    },
  };
}
