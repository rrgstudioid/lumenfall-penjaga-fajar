import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterAssetCache } from './character-asset-cache.ts';
await test('simultaneous leases share loading; only zero-reference resources can be evicted', async () => {
  let loads = 0,
    disposals = 0;
  const cache = new CharacterAssetCache(
    async () => {
      loads++;
      return {};
    },
    () => {
      disposals++;
    },
    () => 8,
    0,
  );
  const [a, b] = await Promise.all([
    cache.acquire('body'),
    cache.acquire('body'),
  ]);
  assert.equal(loads, 1);
  assert.equal(a.value, b.value);
  a.release();
  a.release();
  cache.trim(true);
  assert.equal(disposals, 0);
  b.release();
  assert.equal(disposals, 1);
  assert.equal(cache.stats().users, 0);
});
await test('failed loads are retryable and do not poison cache', async () => {
  let calls = 0;
  const cache = new CharacterAssetCache(
    async () => {
      if (++calls === 1) throw Error('network');
      return {};
    },
    () => {},
    () => 1,
  );
  await assert.rejects(cache.acquire('hair'));
  const lease = await cache.acquire('hair');
  assert.equal(calls, 2);
  lease.release();
  cache.trim(true);
  assert.equal(cache.stats().entries, 0);
});
