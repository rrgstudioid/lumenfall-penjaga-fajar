import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAINS_GRASS_FIELD,
  PLAINS_QUALITY,
  plainsGrassTileCount,
  plainsGrassRange,
  plainsPixelRatio,
  loadPlainsQuality,
  PLAINS_QUALITY_KEY,
} from './verdant-plains-quality.ts';
import { plainsGrassGeometry } from './verdant-plains-visuals.ts';
import { grassBatchInRange, partitionPlainsGrass } from './verdant-grass-tiles.ts';

await test('spatial grass batches preserve every original instance and quality prefix', () => {
  const original = new Float32Array(plainsGrassTileCount('high') * 4);
  let seed = 721;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < original.length; i += 4) {
    original.set([(random() - .5) * 62.5, (random() - .5) * 62.5, random() * Math.PI * 2, random()], i);
  }
  const batches = partitionPlainsGrass(original, 62.5);
  assert.equal(batches.reduce((n, b) => n + b.patches.byteLength, 0), original.byteLength);
  for (const quality of ['office', 'light', 'balanced', 'high'] as const) {
    const expected = new Set<string>();
    for (let i = 0; i < plainsGrassTileCount(quality); i++)
      expected.add(Array.from(original.subarray(i * 4, i * 4 + 4)).join(','));
    let count = 0;
    for (const batch of batches) {
      for (let i = 0; i < batch.counts[quality]; i++) {
        const values = batch.patches.subarray(i * 4, i * 4 + 4);
        assert.ok(values[0] >= batch.minX && values[0] <= batch.maxX);
        assert.ok(values[1] >= batch.minZ && values[1] <= batch.maxZ);
        assert.ok(expected.delete(Array.from(values).join(',')), 'no added, moved or duplicated rumpun');
        count++;
      }
    }
    assert.equal(expected.size, 0);
    assert.equal(count, plainsGrassTileCount(quality));
  }
});

await test('range culling keeps touching edges and corners but rejects empty circle corners', () => {
  assert.equal(grassBatchInRange(0, 0, 10, 10, -1, 20, 1), true);
  assert.equal(grassBatchInRange(0, 0, 10, 6, 8, 20, 20), true);
  assert.equal(grassBatchInRange(0, 0, 10, 8, 8, 20, 20), false);
  assert.equal(grassBatchInRange(0, 0, 0, -10, -10, 10, 10), true);
  assert.equal(grassBatchInRange(-380, -20, 100, -500, -10, -481, 20), false);
});

await test('full field preserves the former close-up density in every preset', () => {
  for (const [quality, oldNearCount] of [
    ['light', 45000],
    ['balanced', 90000],
    ['high', 180000],
  ] as const) {
    const density = oldNearCount / (80 * 80);
    assert.equal(PLAINS_QUALITY[quality].grassDensity, density);
    const actual =
      plainsGrassTileCount(quality) / PLAINS_GRASS_FIELD.tileSize ** 2;
    assert.ok(
      actual >= density &&
        actual - density < 1 / PLAINS_GRASS_FIELD.tileSize ** 2,
    );
  }
});

await test('Office bounds 3D pixels across resolutions without changing legacy profiles', () => {
  for (const [w, h, dpr] of [[1920, 1080, 1], [2560, 1440, 1.5], [3840, 2160, 2], [3440, 1440, 1], [800, 600, 1]]) {
    const ratio = plainsPixelRatio('office', w, h, dpr);
    assert.ok(w * h * ratio ** 2 <= 1280 * 720 + .01);
    assert.ok(ratio <= 1);
    assert.equal(plainsPixelRatio('balanced', w, h, dpr), Math.min(1.25, dpr));
  }
  assert.equal(plainsGrassRange('office').outer, 100);
  assert.equal(plainsGrassRange('balanced').outer, 250);
  const geometry = plainsGrassGeometry(true), original = plainsGrassGeometry();
  assert.equal(geometry.getAttribute('position').count / 3, 4);
  assert.equal(original.getAttribute('position').count / 3, 6);
  geometry.computeBoundingBox(); original.computeBoundingBox();
  assert.equal(geometry.boundingBox!.max.y, original.boundingBox!.max.y);
  geometry.dispose(); original.dispose();
});

await test('first-run Office preserves explicit quality and tolerates unavailable storage', () => {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    for (const [saved, expected] of [[null, 'office'], ['broken', 'office'], ['balanced', 'balanced'], ['high', 'high'], ['light', 'light'], ['office', 'office']]) {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem(key: string) { assert.equal(key, PLAINS_QUALITY_KEY); return saved; } } });
      assert.equal(loadPlainsQuality(), expected);
    }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('Storage blocked'); } });
    assert.equal(loadPlainsQuality(), 'office');
  } finally {
    if (old) Object.defineProperty(globalThis, 'localStorage', old);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
await test('fixed tiles cover the map seamlessly with one 250m range and no density tiers', () => {
  assert.equal(PLAINS_GRASS_FIELD.outer, 250);
  assert.equal(PLAINS_GRASS_FIELD.outerStart, 200);
  assert.equal(PLAINS_GRASS_FIELD.span / PLAINS_GRASS_FIELD.tileSize, 16);
  assert.ok(!('inner' in PLAINS_GRASS_FIELD));
  assert.ok(!('grassMid' in PLAINS_QUALITY.balanced));
  assert.ok(!('grassFar' in PLAINS_QUALITY.balanced));
});
