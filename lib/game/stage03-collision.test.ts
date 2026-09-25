import test from 'node:test';
import assert from 'node:assert/strict';
import { Stage03Collision } from './stage03-collision.ts';
const make = () =>
  new Stage03Collision(
    [
      {
        id: 'building',
        kind: 'polygon',
        points: [
          [2, -2],
          [4, -2],
          [4, 2],
          [2, 2],
        ],
        minY: 0,
        maxY: 6,
      },
      {
        id: 'tree',
        kind: 'circle',
        center: [-3, 0],
        radius: 0.3,
        minY: 0,
        maxY: 4,
      },
    ],
    { center: [0, 0], radius: 12 },
    (x, z) => (Math.hypot(x, z) < 12 ? 0 : undefined),
    { x: 0, z: 5 },
  );
void test('swept steps cannot tunnel through building or trunk', () => {
  const c = make();
  assert.ok(c.move({ x: 0, z: 0 }, 10, 0).x < 1.56);
  assert.ok(c.move({ x: 0, z: 0 }, -10, 0).x > -2.26);
});
void test('diagonal contact slides without entering blocker', () => {
  const c = make();
  const p = c.move({ x: 0, z: 0 }, 5, 1);
  assert.ok(c.valid(p));
  assert.ok(p.x < 1.56);
  assert.ok(p.z > 0.9);
});
void test('invalid and nonfinite positions recover to validated spawn', () => {
  const c = make();
  assert.deepEqual(c.move({ x: 3, z: 0 }, 0, 0), c.spawn);
  assert.deepEqual(c.move({ x: NaN, z: 0 }, 0, 0), c.spawn);
});
void test('world boundary has player-radius clearance', () => {
  const c = make();
  const p = c.move({ x: 0, z: 5 }, 0, 40);
  assert.ok(p.z <= 11.55);
  assert.ok(c.valid(p));
});
void test('height ranges allow movement below overhead structures', () => {
  const c = new Stage03Collision(
    [
      {
        id: 'canopy',
        kind: 'polygon',
        points: [
          [1, -1],
          [3, -1],
          [3, 1],
          [1, 1],
        ],
        minY: 4,
        maxY: 8,
      },
    ],
    { center: [0, 0], radius: 10 },
    () => 0,
    { x: 0, z: 0 },
  );
  assert.ok(c.move({ x: 0, z: 0 }, 4, 0).x > 3.99);
});
void test('full clearance returns distance to obstacles outside current grid cell', () => {
  const c = make();
  assert.ok(c.clearance({ x: 0, z: 5 }, true) < 6);
});
