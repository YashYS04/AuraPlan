import assert from 'node:assert/strict';
import test from 'node:test';
import { createLruCache } from '../lib/cache.js';

test('LRU cache stores and retrieves entries within TTL', () => {
  let currentTime = 1000;
  const cache = createLruCache({ max: 3, ttlMs: 500, now: () => currentTime });

  cache.set('k1', 'val1');
  assert.equal(cache.has('k1'), true);
  assert.equal(cache.get('k1'), 'val1');

  // Fast forward past TTL
  currentTime += 600;
  assert.equal(cache.has('k1'), false);
  assert.equal(cache.get('k1'), undefined);
  assert.equal(cache.size(), 0);
});

test('LRU cache updates value when setting existing key', () => {
  const cache = createLruCache({ max: 2, ttlMs: 10000 });
  cache.set('a', 1);
  cache.set('a', 2);
  assert.equal(cache.get('a'), 2);
  assert.equal(cache.size(), 1);
});

test('LRU cache evicts oldest entry when reaching capacity', () => {
  const cache = createLruCache({ max: 2, ttlMs: 10000 });

  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3); // should evict 'a'

  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('b'), 2);
  assert.equal(cache.get('c'), 3);
});

test('reading an entry marks it as most recently used', () => {
  const cache = createLruCache({ max: 2, ttlMs: 10000 });

  cache.set('a', 1);
  cache.set('b', 2);
  cache.get('a'); // touches 'a' -> 'b' becomes oldest
  cache.set('c', 3); // evicts 'b'

  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('c'), 3);
});

test('clear empties the cache', () => {
  const cache = createLruCache({ max: 2, ttlMs: 10000 });
  cache.set('a', 1);
  cache.clear();
  assert.equal(cache.size(), 0);
  assert.equal(cache.has('a'), false);
});
