import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS } from './regions.ts';
import {
  fieldSpawns,
  monsterRespawnKey,
  restoreRespawnDeadline,
} from './field-layout.ts';
import {
  IRONVEIL_ID,
  IRONVEIL_ENTRY,
  IRONVEIL_POCKETS,
  ironveilPoint,
  ironveilWalkable,
  ironveilPathDistance,
} from './ironveil-mines-layout.ts';
import {
  ironveilSafe,
  moveIronveilMonster,
} from './ironveil-mines-population.ts';

await test('129 stable, spaced homes cover the outdoor field, all pockets and levels 8–16', () => {
  const spawns = fieldSpawns(FIELDS[IRONVEIL_ID]);
  assert.deepEqual(spawns, fieldSpawns(FIELDS[IRONVEIL_ID]));
  assert.equal(new Set(spawns.map((s) => s.id)).size, 129);
  assert.equal(
    spawns.filter((s) => s.definition.variant === 'normal').length,
    120,
  );
  assert.equal(
    spawns.filter((s) => s.definition.variant === 'elite').length,
    8,
  );
  assert.equal(spawns.filter((s) => s.definition.variant === 'boss').length, 1);
  assert.deepEqual(
    [...new Set(spawns.map((s) => s.definition.level))].sort((a, b) => a - b),
    [8, 10, 12, 14, 15, 16],
  );
  const sectors = new Set<string>();
  for (const s of spawns) {
    assert(ironveilWalkable(s, 4));
    assert(!ironveilSafe(s, 28));
    assert(ironveilPathDistance(s) > 18);
    sectors.add(`${s.x < 0 ? 'W' : 'E'}:${Math.floor(s.z / 120)}`);
  }
  assert.equal(sectors.size, 8);
  for (const p of IRONVEIL_POCKETS)
    assert(
      spawns.some(
        (s) =>
          s.x >= p.minU - 500 &&
          s.x <= p.maxU - 500 &&
          s.z >= p.minV - 500 &&
          s.z <= p.maxV - 500,
      ),
      p.name,
    );
  for (let i = 0; i < spawns.length; i++)
    for (let j = i + 1; j < spawns.length; j++)
      assert(
        Math.hypot(spawns[i].x - spawns[j].x, spawns[i].z - spawns[j].z) >= 28,
      );
});
await test('normal and boss forced movement cannot cross cliffs or enter arrival and entrance safety', () => {
  for (const radius of [0.55, 1.8])
    for (const from of [
      { x: 0, z: 25 },
      { x: 220, z: 65 },
      { x: 0, z: 385 },
      { x: 455, z: 240 },
    ]) {
      for (const [dx, dz] of [
        [0, -1000],
        [0, 1000],
        [1000, 0],
        [-1000, 0],
      ]) {
        const p = moveIronveilMonster(from, dx, dz, radius);
        assert(ironveilWalkable(p, radius));
        assert(!ironveilSafe(p, radius));
      }
    }
  assert(ironveilSafe(IRONVEIL_ENTRY));
  assert(ironveilSafe(ironveilPoint(720, 465)));
});
await test('replacement respawns are independent of retired homes and sibling monsters', () => {
  const s = fieldSpawns(FIELDS[IRONVEIL_ID])[0],
    until = Date.now() + 25000;
  const state = { [`${s.definition.id}:spawn:0`]: until };
  assert.equal(
    restoreRespawnDeadline(state, s.definition.id, s.id, IRONVEIL_ID),
    0,
  );
  const key = monsterRespawnKey(s.definition.id, s.id, IRONVEIL_ID);
  state[key] = until;
  assert.equal(
    restoreRespawnDeadline(state, s.definition.id, s.id, IRONVEIL_ID),
    until,
  );
  assert.equal(
    restoreRespawnDeadline(state, s.definition.id, s.id + 1, IRONVEIL_ID),
    0,
  );
});
