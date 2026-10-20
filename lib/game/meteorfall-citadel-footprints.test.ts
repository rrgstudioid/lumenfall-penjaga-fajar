import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MagmaFootprints,
  MAGMA_FOOTPRINT_LIMIT,
  MAGMA_FOOTPRINT_LIFETIME,
} from './meteorfall-citadel-footprints.ts';
import { meteorWalkable } from './meteorfall-citadel-layout.ts';

await test('magma footsteps follow distance, alternate feet, and stay on walkable terrain at different frame rates', () => {
  const sample = (fps: number) => {
    const p = new MagmaFootprints();
    p.update({ x: 0, z: 380 }, 0, 0, false);
    for (let i = 1; i <= fps * 3; i++)
      p.update({ x: 0, z: 380 - (i / fps) * 6 }, i / fps, 1 / fps, true);
    return p.slots.filter(Boolean);
  };
  const a = sample(30),
    b = sample(144);
  assert.equal(a.length, 21);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert(Math.hypot(a[i]!.x - b[i]!.x, a[i]!.z - b[i]!.z) < 1e-6);
    assert(meteorWalkable(a[i]!, 0.4));
    if (i) assert(a[i]!.x * a[i - 1]!.x < 0);
  }
});
await test('footsteps expire, remain bounded, and skip stationary frames and map jumps', () => {
  const p = new MagmaFootprints();
  p.update({ x: 0, z: 380 }, 0, 0, false);
  for (let i = 1; i <= 30; i++)
    p.update({ x: i * 0.1, z: 380 }, i / 60, 1 / 60, true);
  assert(p.count(0.5) > 0);
  const count = p.count(0.5);
  p.update({ x: 3, z: 380 }, 1, 1 / 60, true);
  assert.equal(p.count(1), count);
  p.update({ x: 0, z: -350 }, 1.1, 1 / 60, true);
  assert.equal(p.count(1.1), count);
  assert.equal(p.count(2 + MAGMA_FOOTPRINT_LIFETIME), 0);
  for (let i = 1; i <= 600; i++)
    p.update({ x: Math.sin(i * 0.1) * 40, z: -350 }, 10 + i / 10, 0.1, true);
  assert(p.slots.filter(Boolean).length <= MAGMA_FOOTPRINT_LIMIT);
  p.update({ x: 490, z: -490 }, 80, 1 / 60, true);
  p.update({ x: 491, z: -490 }, 80.1, 0.1, true);
  assert.equal(p.count(80.1), 0);
});
