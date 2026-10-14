import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAPHICS_QUALITY_KEY,
  loadGraphicsQuality,
  saveGraphicsQuality,
} from './graphics-quality.ts';
import {
  PLAINS_QUALITY_KEY,
  PLAINS_QUALITY_LABELS,
} from './verdant-plains-quality.ts';
import { WILDS_QUALITY_KEY } from './whispering-wilds-quality.ts';

await test('global graphics preference takes precedence and preserves legacy device choices', () => {
  const values = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  try {
    assert.equal(loadGraphicsQuality(), 'office');
    values.set(WILDS_QUALITY_KEY, 'balanced');
    assert.equal(loadGraphicsQuality(), 'balanced');
    values.set(PLAINS_QUALITY_KEY, 'light');
    assert.equal(loadGraphicsQuality(), 'light');
    values.set(GRAPHICS_QUALITY_KEY, 'high');
    assert.equal(loadGraphicsQuality(), 'high');
    saveGraphicsQuality('office');
    assert.equal(loadGraphicsQuality(), 'office');
    for (const key of [
      GRAPHICS_QUALITY_KEY,
      PLAINS_QUALITY_KEY,
      WILDS_QUALITY_KEY,
    ])
      assert.equal(values.get(key), 'office');
    values.set(GRAPHICS_QUALITY_KEY, 'invalid');
    assert.equal(loadGraphicsQuality(), 'office');
    assert.deepEqual(Object.values(PLAINS_QUALITY_LABELS), [
      'Low',
      'Medium',
      'High',
      'Ultra',
    ]);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
await test('blocked storage does not prevent changing graphics or loading a safe default', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('blocked');
    },
  });
  try {
    assert.equal(loadGraphicsQuality(), 'office');
    assert.doesNotThrow(() => saveGraphicsQuality('high'));
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
