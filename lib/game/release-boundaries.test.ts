import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SANDS_MAP_ANCHOR, SANDS_MAP_SCALE, sandsWorldPoint } from './sands-coordinates.ts';

test('server-safe coordinate extraction preserves original Sands coordinates', () => {
  assert.equal(SANDS_MAP_SCALE, 1.5);
  assert.deepEqual(SANDS_MAP_ANCHOR, { x: 0, z: 35 });
  assert.deepEqual(sandsWorldPoint(0, 35), { x: 0, z: 35 });
  assert.deepEqual(sandsWorldPoint(10, 15), { x: 15, z: 5 });
  for (const file of ['regions.ts', 'field-layout.ts']) {
    assert(!readFileSync(new URL(file, import.meta.url),'utf8').includes("from './imported-map.ts'"));
  }
});

test('region construction and tree decoration do not shadow each other', () => {
  const source=readFileSync(new URL('world.ts',import.meta.url),'utf8');
  assert.equal((source.match(/^  buildRegionDecor\(/gm)||[]).length,1);
  assert.equal((source.match(/^  buildTreeDecor\(/gm)||[]).length,1);
  assert(!source.includes('this.buildRegionDecor(buildToken)'));
});
