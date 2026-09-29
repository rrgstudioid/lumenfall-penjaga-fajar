import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAINS_GRASS_FIELD,
  PLAINS_QUALITY,
  plainsGrassTileCount,
} from './verdant-plains-quality.ts';

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
await test('fixed tiles cover the map seamlessly with one 250m range and no density tiers', () => {
  assert.equal(PLAINS_GRASS_FIELD.outer, 250);
  assert.equal(PLAINS_GRASS_FIELD.outerStart, 200);
  assert.equal(PLAINS_GRASS_FIELD.span / PLAINS_GRASS_FIELD.tileSize, 16);
  assert.ok(!('inner' in PLAINS_GRASS_FIELD));
  assert.ok(!('grassMid' in PLAINS_QUALITY.balanced));
  assert.ok(!('grassFar' in PLAINS_QUALITY.balanced));
});
