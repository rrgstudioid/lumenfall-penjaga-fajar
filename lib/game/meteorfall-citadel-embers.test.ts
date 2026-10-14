import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MeteorfallEmberPool,
  METEORFALL_EMBER_LIMIT,
  METEORFALL_EMBER_RADIUS,
} from './meteorfall-citadel-embers.ts';

const origin = { x: 0, y: 8, z: 380 };
const pool = () => {
  const p = new MeteorfallEmberPool();
  p.setCount(METEORFALL_EMBER_LIMIT);
  p.update(origin, 0);
  return p;
};
await test('moving or raising the camera never drags live interior embers along with it', () => {
  const still = pool(),
    moved = pool(),
    camera = { x: 12, y: 22, z: 370 };
  const before = still.positions.slice(),
    opacityBefore = still.opacity.slice();
  still.update(origin, 1 / 60);
  moved.update(camera, 1 / 60);
  let compared = 0;
  for (let i = 0; i < METEORFALL_EMBER_LIMIT; i++) {
    const k = i * 3;
    // Faded births/deaths may be recycled into the camera's new sampling window.
    if (opacityBefore[i] < 0.15) continue;
    if (
      Math.abs(before[k] - origin.x) > 65 ||
      Math.abs(before[k + 2] - origin.z) > 65
    )
      continue;
    assert.deepEqual(
      moved.positions.slice(k, k + 3),
      still.positions.slice(k, k + 3),
    );
    assert(
      Math.abs(moved.positions[k] - before[k]) < 0.01,
      'gentle wind, not camera displacement',
    );
    assert(
      Math.abs(moved.positions[k + 1] - before[k + 1]) < 0.026,
      'natural rise, not camera altitude',
    );
    compared++;
  }
  assert(compared > 350);
});
await test('camera travel recycles boundary particles, large map jumps reset locally, and quality caps remain bounded', () => {
  const p = pool();
  for (let frame = 0; frame < 300; frame++) {
    const c = { x: frame * 0.8, y: 8, z: 380 };
    p.update(c, 1 / 60);
    for (let i = 0; i < p.count; i++) {
      assert(
        Math.abs(p.positions[i * 3] - c.x) <= METEORFALL_EMBER_RADIUS + 0.0001,
      );
      assert(
        Math.abs(p.positions[i * 3 + 2] - c.z) <=
          METEORFALL_EMBER_RADIUS + 0.0001,
      );
      assert(Number.isFinite(p.positions[i * 3 + 1]));
      assert(p.opacity[i] >= 0 && p.opacity[i] <= 1);
    }
  }
  const jump = { x: 0, y: 50, z: -350 };
  p.update(jump, 1 / 60);
  const frozen = p.positions.slice();
  p.update({ x: 400, y: 120, z: 400 }, 0);
  assert.deepEqual(
    p.positions,
    frozen,
    'paused motion stays frozen even if camera changes',
  );
  p.setCount(256);
  p.update(jump, 1 / 60);
  assert.equal(p.count, 256);
  p.setCount(1024);
  p.update(jump, 1 / 60);
  assert.equal(p.count, 1024);
  for (let i = 0; i < p.count; i++) {
    assert(
      Math.abs(p.positions[i * 3] - jump.x) <= METEORFALL_EMBER_RADIUS + 0.0001,
    );
    assert(
      Math.abs(p.positions[i * 3 + 2] - jump.z) <=
        METEORFALL_EMBER_RADIUS + 0.0001,
    );
    assert(p.positions[i * 3 + 1] >= 36);
  }
});
