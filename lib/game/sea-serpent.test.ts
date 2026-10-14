import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS } from './regions.ts';
import { fieldSpawns, isFieldSafe } from './field-layout.ts';
import { ABYSAL_TRENCH_ID } from './underwater-regions.ts';
import {
  ABYSAL_TRENCH_ARENA,
  ABYSAL_TRENCH_ENTRY,
} from './abysal-trench-layout.ts';
import {
  trenchGuardianHomes,
  trenchMonsterWalkable,
} from './abysal-trench-population.ts';
import {
  GUARDIAN_ATTACKS,
  BOSS_ATTACKS,
  serpentStrikeContains,
} from './sea-serpent-combat.ts';
import { SunkenNavigation } from './sunken-ruins-navigation.ts';
import { lootItemPool } from './monster-loot.ts';
await test('200 Lv58 elites cover the maze with stable IDs and exclude the Lv60 boss basin', () => {
  const field = FIELDS[ABYSAL_TRENCH_ID],
    spawns = fieldSpawns(field),
    homes = trenchGuardianHomes();
  assert.equal(field.normalMonsters.length, 0);
  assert.equal(field.eliteMonsters.length, 1);
  assert.equal(field.eliteMonsters[0].name, 'Sea Serpent "Guardian"');
  assert.equal(field.eliteMonsters[0].level, 58);
  assert.equal(field.fieldBoss!.name, 'Sea Serpent');
  assert.equal(field.fieldBoss!.level, 60);
  assert.equal(spawns.length, 201);
  assert.equal(homes.length, 200);
  assert.equal(new Set(spawns.map((p) => p.id)).size, spawns.length);
  assert.deepEqual(homes, trenchGuardianHomes());
  for (const p of homes) {
    assert.ok(trenchMonsterWalkable(p, 8));
    assert.ok(!isFieldSafe(field.id, p.x, p.z, 24));
    assert.ok(Math.hypot(p.x - 60, p.z + 355) > 115);
  }
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      assert.ok(homes.filter((p) => p.x * x > 0 && p.z * z > 0).length > 30);
  assert.ok(
    isFieldSafe(field.id, ABYSAL_TRENCH_ENTRY.x, ABYSAL_TRENCH_ENTRY.z),
  );
  assert.equal(spawns.filter((p) => p.definition.variant === 'boss').length, 1);
  assert.deepEqual(
    spawns.find((p) => p.definition.variant === 'boss')!.x,
    ABYSAL_TRENCH_ARENA.x,
  );
  for (const rank of ['elite', 'boss'] as const)
    for (const family of [
      'material',
      'potion',
      'equipment',
      'uniqueRune',
    ] as const)
      assert.ok(lootItemPool(field.id, rank, family).length > 0);
});
await test('guardian and boss swept navigation cannot cross their respective arena boundary', () => {
  const guardian = new SunkenNavigation(trenchMonsterWalkable),
    boss = new SunkenNavigation((p, r) => trenchMonsterWalkable(p, r, true));
  const p = trenchGuardianHomes().sort(
    (a, b) => Math.hypot(a.x - 60, a.z + 355) - Math.hypot(b.x - 60, b.z + 355),
  )[0];
  const moved = guardian.move(p, 60 - p.x, -355 - p.z, 8);
  assert.ok(trenchMonsterWalkable(moved, 8));
  assert.ok(Math.hypot(moved.x - 60, moved.z + 355) >= 115);
  const b = boss.move(ABYSAL_TRENCH_ARENA, -60, 675, 22);
  assert.ok(trenchMonsterWalkable(b, 22, true));
  assert.ok(Math.hypot(b.x - 60, b.z + 355) <= 69);
});
await test('eight unique strikes have dodgeable locked horizontal shapes and two boss skills', () => {
  const attacks = [...GUARDIAN_ATTACKS, ...BOSS_ATTACKS];
  assert.equal(new Set(attacks.map((a) => a.id)).size, 8);
  assert.equal(BOSS_ATTACKS.filter((a) => a.skill).length, 2);
  for (const attack of attacks) {
    const strike = {
      attack,
      elapsed: 0,
      hit: false,
      x: 0,
      z: 0,
      yaw: 0,
      targetX: 0,
      targetZ: -10,
    };
    assert.ok(attack.windup >= 1.4 && attack.recovery >= 1.6);
    assert.ok(serpentStrikeContains(strike, { x: 0, z: -5 }, 20), attack.id);
    assert.ok(
      !serpentStrikeContains(strike, { x: 100, z: 100 }, 20),
      attack.id,
    );
    if (attack.shape === 'line' || attack.shape === 'bite')
      assert.ok(!serpentStrikeContains(strike, { x: 0, z: 5 }, 20));
  }
});
