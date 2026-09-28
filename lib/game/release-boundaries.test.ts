import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

await test('region data stays independent of Three.js imports', () => {
  for (const file of ['regions.ts', 'field-layout.ts']) {
    assert(!readFileSync(new URL(file, import.meta.url),'utf8').includes("from './imported-map.ts'"));
  }
});

await test('region construction and tree decoration do not shadow each other', () => {
  const source=readFileSync(new URL('world.ts',import.meta.url),'utf8');
  assert.equal((source.match(/^  buildRegionDecor\(/gm)||[]).length,1);
  assert.equal((source.match(/^  buildTreeDecor\(/gm)||[]).length,1);
  assert(!source.includes('this.buildRegionDecor(buildToken)'));
});
