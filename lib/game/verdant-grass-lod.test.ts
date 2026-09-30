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
