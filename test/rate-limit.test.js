import assert from 'node:assert/strict';
import test from 'node:test';
import { createRateLimiter } from '../lib/rate-limit.js';

test('rate limiter permits requests under threshold and blocks excess', () => {
  let currentTime = 10000;
  const limiter = createRateLimiter({ limit: 3, windowMs: 5000, now: () => currentTime });

  assert.equal(limiter('ip1').allowed, true);
  assert.equal(limiter('ip1').allowed, true);
  assert.equal(limiter('ip1').allowed, true);

  // 4th request blocked
  const blocked = limiter('ip1');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);

  // Fast forward beyond window
  currentTime += 5100;
  assert.equal(limiter('ip1').allowed, true);
});

test('rate limiter tracks different keys independently', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 10000 });

  assert.equal(limiter('user-A').allowed, true);
  assert.equal(limiter('user-A').allowed, false);
  assert.equal(limiter('user-B').allowed, true);
});

test('rate limiter prunes expired keys when reaching maxKeys', () => {
  let currentTime = 1000;
  const limiter = createRateLimiter({ limit: 5, windowMs: 2000, maxKeys: 2, now: () => currentTime });

  limiter('key1');
  limiter('key2');

  // Advance time past window so key1 and key2 expire
  currentTime += 2500;

  // Next key triggers pruning of expired key1 & key2
  assert.equal(limiter('key3').allowed, true);
});
