import test from 'node:test';
import assert from 'node:assert/strict';
import { moveWithTreeCollisions, type TreeCollider } from './tree-collision.ts';
import { FIELD_TERRAINS, moveOnTerrain, terrainHeight, terrainWalkable, terrainBridge } from './field-terrain.ts';

const trunk: TreeCollider = { x: 0, z: 0, radius: .3, minY: 0, maxY: 2.4 };
const flat = (p: { x: number; z: number }, dx: number, dz: number) => ({ x: p.x + dx, z: p.z + dz });
const height = () => 0;

await test('walking, large dashes and enemy knockback cannot tunnel through a trunk', () => {
  for (const radius of [.45, .55, 1.8]) for (const sign of [-1, 1]) {
    const p = moveWithTreeCollisions({ x: sign * 5, z: 0 }, -sign * 10, 0, [trunk], flat, height, radius);
    assert.ok(p.x * sign >= trunk.radius + radius - .003, JSON.stringify(p));
  }
  let p = { x: -2, z: 0 };
  for (let i = 0; i < 200; i++) p = moveWithTreeCollisions(p, .1, 0, [trunk], flat, height);
  assert.ok(p.x <= -.747, 'repeated movement cannot creep through the collider');
  const slide = moveWithTreeCollisions({ x: -1.2, z: -.15 }, 1.5, 1.4, [trunk], flat, height);
  assert.ok(slide.z > .8 && Math.hypot(slide.x, slide.z) >= .747, JSON.stringify(slide));
});

await test('old saves and asynchronous tree loads are resolved without trapping the actor or crossing a wall', () => {
  const recovered = moveWithTreeCollisions({ x: 0, z: 0 }, 0, 0, [trunk], flat, height);
  assert.ok(Math.hypot(recovered.x, recovered.z) >= .75);
  const wall = (p: { x: number; z: number }, dx: number, dz: number) => ({ x: Math.min(.1, p.x + dx), z: p.z + dz });
  const safeExit = moveWithTreeCollisions({ x: 0, z: 0 }, 0, 0, [trunk], wall, height);
  assert.ok(safeExit.x <= .1 && Math.hypot(safeExit.x, safeExit.z) >= .75);
  const escaped = moveWithTreeCollisions(safeExit, -3, 0, [trunk], wall, height);
  assert.ok(escaped.x < -2, JSON.stringify(escaped));
});

await test('canopies/trees below bridges and unloaded regions do not leave invisible walls', () => {
  const over = moveWithTreeCollisions({ x: -3, z: 0 }, 6, 0, [trunk], flat, () => 5);
  assert.ok(Math.abs(over.x - 3) < 1e-6);
  const under = moveWithTreeCollisions({ x: -3, z: 0 }, 6, 0, [{ ...trunk, minY: 5, maxY: 7.4 }], flat, height);
  assert.ok(Math.abs(under.x - 3) < 1e-6);
  let calls = 0;
  const unloaded = moveWithTreeCollisions({ x: -3, z: 0 }, 6, 0, [], (p, dx, dz) => { calls++; return flat(p, dx, dz); }, height);
  assert.deepEqual(unloaded, { x: 3, z: 0 });
  assert.equal(calls, 1, 'empty regions preserve their existing movement path');
});

await test('tree movement composes with the existing elevated terrain and bridge collision', () => {
  for (const terrain of Object.values(FIELD_TERRAINS)) {
    const ground = (x: number, z: number) => terrainHeight(terrain, x, z);
    const walk = (p: { x: number; z: number }, dx: number, dz: number) => moveOnTerrain(terrain, p, dx, dz);
    // A nearby blocker must not let the resolver push a player outside the map.
    const c = { ...trunk, ...terrain.entry, minY: ground(terrain.entry.x, terrain.entry.z), maxY: ground(terrain.entry.x, terrain.entry.z) + 2.4 };
    const p = moveWithTreeCollisions(terrain.entry, 1000, 1000, [c], walk, ground);
    assert.ok(terrainWalkable(terrain, p), terrain.id);
    for (const bridge of terrain.bridges.filter(b => b.kind !== 'dock')) {
      const start = { x: bridge.x, z: bridge.z - bridge.length / 2 + .3 };
      if (!terrainWalkable(terrain, start) || !terrainBridge(terrain, start)) continue;
      const normal = walk(start, 0, bridge.length - .6);
      const withTrees = moveWithTreeCollisions(start, 0, bridge.length - .6, [c], walk, ground);
      assert.ok(Math.hypot(normal.x - withTrees.x, normal.z - withTrees.z) < .4, terrain.id);
    }
  }
});
