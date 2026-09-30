import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMaleAppearance,
  MALE_HAIR_STYLES,
} from './character-appearance.ts';

await test('male migration preserves legacy colors and maps styles without mutating input', () => {
  const old = {
    hairStyleId: 'hair_swept',
    skinToneId: 'tone_04',
    hairColorId: 'dark_red',
    faceStyleId: 'face_soft',
  };
  const before = JSON.stringify(old),
    a = normalizeMaleAppearance(old);
  assert.equal(a.hairStyleId, 'hair_07');
  assert.equal(a.skinToneId, 'skin_05');
  assert.equal(a.hairColor, '#6e252d');
  assert.equal(a.faceStyleId, 'face_soft');
  assert.ok(!('facialHairId' in a));
  assert.equal(JSON.stringify(old), before);
  assert.deepEqual(normalizeMaleAppearance(a), a);
});
await test('custom hex survives normalization; invalid data has deterministic defaults', () => {
  assert.equal(
    normalizeMaleAppearance({ hairColor: '#AB12CD' }).hairColor,
    '#ab12cd',
  );
  for (const bad of [
    null,
    [],
    0,
    { hairColorId: '__proto__' },
    { hairColorId: 'constructor' },
    {
      hairColor: 'url(secret)',
      hairStyleId: '__proto__',
      skinToneId: 'missing',
    },
  ]) {
    const a = normalizeMaleAppearance(bad);
    assert.equal(a.hairStyleId, 'hair_01');
    assert.equal(a.skinToneId, 'skin_03');
    assert.equal(a.hairColor, '#704434');
  }
});
await test('hairstyles round-trip and obsolete facial hair is removed from old saves', () => {
  for (const hair of MALE_HAIR_STYLES) {
    const a = normalizeMaleAppearance({
      hairStyleId: hair.id,
      facialHairId: 'facial_04',
      facialHairColorMode: 'inherit',
    });
    assert.equal(a.hairStyleId, hair.id);
    assert.ok(!('facialHairId' in a));
    assert.ok(!('facialHairColorMode' in a));
  }
});
