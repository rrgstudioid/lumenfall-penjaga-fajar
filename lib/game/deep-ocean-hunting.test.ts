import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS } from './regions.ts';
import { fieldSpawns, isFieldSafe } from './field-layout.ts';
import { DEEP_OCEAN_ID, ABYSAL_TRENCH_ID } from './underwater-regions.ts';
import { deepOceanWalkable, deepOceanSafe } from './deep-ocean-layout.ts';
import {
  ABYSAL_TRENCH_PATHS,
  ABYSAL_TRENCH_HUNT_POCKETS,
  ABYSAL_TRENCH_ARENA,
  abysalTrenchWalkable,
} from './abysal-trench-layout.ts';
import { SunkenNavigation } from './sunken-ruins-navigation.ts';
import { createMonsterBody } from './monster-models.ts';
import { oceanContactPoint } from './deep-ocean-monster-models.ts';
await test('ocean homes cover every quadrant, retain safe portals, and contain the requested species and one huge Lv48 boss', () => {
  const field = FIELDS[DEEP_OCEAN_ID],
    spawns = fieldSpawns(field);
  assert.deepEqual(spawns, fieldSpawns(field));
  assert.equal(spawns.length, 335);
  assert.deepEqual(
    field.normalMonsters.map((p) => [p.name, p.level]),
    [
      ['Goblin Shark', 38],
      ['Deep Baracuda', 40],
      ['Deep Marlyn', 43],
      ['Giant Squid', 46],
    ],
  );
  assert.equal(spawns.filter((p) => p.definition.variant === 'boss').length, 1);
  assert.equal(field.fieldBoss!.level, 48);
  for (const p of spawns) {
    assert.ok(deepOceanWalkable(p, 20));
    assert.ok(!deepOceanSafe(p, 24));
    assert.ok(!isFieldSafe(field.id, p.x, p.z));
    assert.ok(p.definition.level >= 38 && p.definition.level <= 48);
  }
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      assert.ok(
        spawns.filter((p) => Math.sign(p.x) === x && Math.sign(p.z) === z)
          .length > 50,
      );
  const boss = createMonsterBody(field.fieldBoss!);
  assert.ok(
    boss.geometry.boundingBox!.max.z - boss.geometry.boundingBox!.min.z > 24,
  );
  boss.geometry.dispose();
  boss.material.dispose();
  assert.equal(FIELDS[ABYSAL_TRENCH_ID].fieldBoss?.level, 60);
  assert.equal(fieldSpawns(FIELDS[ABYSAL_TRENCH_ID]).length, 201);
});
await test('maze has branches and loops spanning the map, and every pocket connects to its boss basin', () => {
  const nav = new SunkenNavigation(abysalTrenchWalkable),
    edges = ABYSAL_TRENCH_PATHS;
  const reached = new Set<number>([103]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, b] of edges)
      if (reached.has(a.id) || reached.has(b.id)) {
        if (!reached.has(a.id) || !reached.has(b.id)) changed = true;
        reached.add(a.id);
        reached.add(b.id);
      }
  }
  assert.ok(ABYSAL_TRENCH_HUNT_POCKETS.length >= 40);
  assert.ok(edges.length > reached.size - 1, 'maze includes loops');
  for (const p of ABYSAL_TRENCH_HUNT_POCKETS) {
    assert.ok(reached.has(p.id));
    assert.ok(nav.valid(p, 20));
  }
  for (const [a, b] of edges) assert.ok(nav.clear(a, b, 5));
  assert.ok(nav.valid(ABYSAL_TRENCH_ARENA, 80));
  assert.ok(!nav.valid({ x: 65, z: 325 }));
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      assert.ok(
        ABYSAL_TRENCH_HUNT_POCKETS.some((p) => p.x * x > 300 && p.z * z > 300),
      );
});
await test('large aquatic body range follows its rotated horizontal capsule, never hover height', () => {
  const center = { x: 0, z: 0 },
    shape = { radius: 3, halfLength: 8 };
  assert.deepEqual(oceanContactPoint({ x: 5, z: 0 }, center, 0, shape), {
    x: 3,
    z: 0,
  });
  assert.deepEqual(oceanContactPoint({ x: 0, z: 13 }, center, 0, shape), {
    x: 0,
    z: 11,
  });
  const rotated = oceanContactPoint(
    { x: 13, z: 0 },
    center,
    Math.PI / 2,
    shape,
  );
  assert.ok(Math.abs(rotated.x - 11) < 1e-8);
  assert.deepEqual(oceanContactPoint({ x: 2, z: 0 }, center, 0, shape), {
    x: 2,
    z: 0,
  });
  assert.deepEqual(oceanContactPoint({ x: 5, z: 0 }, center, 0), center);
});
