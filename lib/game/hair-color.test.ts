import test from 'node:test';
import assert from 'node:assert/strict';
import { hsvToHex, hexToHSV } from './hair-color.ts';

await test('picker preserves RGB values across HSV conversion including grayscale', () => {
  for (const color of [
    '#000000',
    '#ffffff',
    '#33aacc',
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#888888',
    '#e8dfc7',
  ])
    assert.equal(hsvToHex(hexToHSV(color)), color);
  assert.equal(hexToHSV('#000000', 215).h, 215);
  assert.equal(hsvToHex({ h: 360, s: 100, v: 100 }), '#ff0000');
  assert.equal(hsvToHex({ h: 60, s: 100, v: 100 }), '#ffff00');
});
