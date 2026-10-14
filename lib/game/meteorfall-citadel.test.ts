import test from 'node:test';
import assert from 'node:assert/strict';
import {
  METEORFALL_ID,
  METEORFALL_LAYOUT_VERSION,
  METEORFALL_ENTRY,
  METEORFALL_PLATFORMS,
  METEORFALL_BRIDGES,
  METEORFALL_CAUSEWAY,
  METEORFALL_MAGMA,
  METEORFALL_OBSTACLES,
  meteorPlatform,
  meteorWalkable,
  meteorGroundHeight,
  meteorDesignHeight,
  meteorBridgePoint,
} from './meteorfall-citadel-layout.ts';
import { MeteorfallNavigation } from './meteorfall-citadel-navigation.ts';
import { migrateMeteorfallSave } from './meteorfall-citadel-save-migration.ts';
import { fieldSpawns, monsterRespawnKey } from './field-layout.ts';
import { FIELDS, FIELD_NPCS } from './regions.ts';
import { freshHero, parseSave } from './rules.ts';
import { travel, acceptRegionQuest, regionQuestProgress } from './regions.ts';

void test('11 approved octagons and 14 connections stay inside the 1000 unit footprint', () => {
  assert.equal(METEORFALL_PLATFORMS.length, 11);
  assert.equal(METEORFALL_BRIDGES.length, 14);
  for (const p of METEORFALL_PLATFORMS) {
    assert.equal(p.polygon.length, 8);
    for (const v of p.polygon)
      assert(Math.abs(v.x) <= 500 && Math.abs(v.z) <= 500);
  }
  for (const b of METEORFALL_BRIDGES)
    assert(Math.abs(b.yB - b.yA) / b.length <= 0.200001);
  assert.equal(meteorGroundHeight({ x: 490, z: -490 }), undefined);
});
void test('all bridge landings work in both directions with actor and largest legacy monster clearance', () => {
  const nav = new MeteorfallNavigation();
  for (const radius of [0.45, 0.55, 1.8, 4])
    for (const b of [...METEORFALL_BRIDGES, METEORFALL_CAUSEWAY]) {
      const end =
        b.id === 'entrance'
          ? meteorBridgePoint(b, 1 - (radius + 0.01) / b.length)
          : b.b;
      assert(nav.clear(b.a, end, radius), `${b.id}, radius ${radius}`);
      for (const [a, c] of [
        [b.a, end],
        [end, b.a],
      ]) {
        const p = nav.move(a, c.x - a.x, c.z - a.z, radius);
        assert(Math.hypot(p.x - c.x, p.z - c.z) < 1e-6, b.id);
      }
      for (const offset of [
        -b.clearWidth / 2 + radius + 0.01,
        b.clearWidth / 2 - radius - 0.01,
      ])
        assert(nav.valid(meteorBridgePoint(b, 0.5, offset), radius), b.id);
      assert(Math.abs(meteorDesignHeight(b.a)! - b.yA) < 1e-6);
      assert(Math.abs(meteorDesignHeight(b.b)! - b.yB) < 1e-6);
    }
});
void test('swept long and diagonal displacements cannot cross void, magma, or pillars', () => {
  const nav = new MeteorfallNavigation();
  for (const start of METEORFALL_PLATFORMS)
    for (const [dx, dz] of [
      [1000, 0],
      [-1000, 0],
      [700, 700],
      [0, -1000],
    ])
      assert(nav.valid(nav.move(start, dx, dz)));
  for (const pool of [...METEORFALL_MAGMA, ...METEORFALL_OBSTACLES]) {
    assert(!nav.valid(pool));
    const a = { x: pool.x - pool.radius - 5, z: pool.z };
    if (nav.valid(a))
      assert(nav.move(a, pool.radius * 2 + 10, 0).x < pool.x - pool.radius);
  }
  assert.deepEqual(nav.restore({ x: NaN, z: Infinity }), METEORFALL_ENTRY);
});
void test('portal routes connect arrival to every island without corner cutting', () => {
  const nav = new MeteorfallNavigation();
  for (const p of METEORFALL_PLATFORMS) {
    const route = nav.route(METEORFALL_ENTRY, p, 1.8);
    assert(route.length, p.id);
    let a = METEORFALL_ENTRY;
    for (const b of route) {
      assert(nav.clear(a, b, 1.8), p.id);
      a = b;
    }
    assert(Math.hypot(a.x - p.x, a.z - p.z) < 0.01);
  }
  const o = METEORFALL_MAGMA[0],
    a = { x: o.x, z: o.z - 18 },
    b = { x: o.x, z: o.z + 18 };
  assert(!nav.clear(a, b));
  assert(nav.route(a, b).length > 1);
});
void test('position-only migration is idempotent and preserves all progression/timer objects', () => {
  const saved = {
    inCity: false,
    currentField: METEORFALL_ID,
    x: 12,
    z: 30,
    lastSafePosition: { x: 12, z: 30 },
    inventory: [{ id: 'owner-item' }],
    activeQuests: ['field-meteorfall-citadel-easy'],
    completedQuests: ['field-meteorfall-citadel-veteran'],
    cityProgress: { 'baseline-field-meteorfall-citadel-easy': 4 },
    monsterRespawnState: { 'meteorfall-citadel-5:spawn:100': 987654321 },
    defeatedFieldBosses: [METEORFALL_ID],
  };
  const migrated = migrateMeteorfallSave(saved);
  assert.equal(migrated.x, 0);
  assert.equal(migrated.z, 380);
  for (const k of [
    'inventory',
    'activeQuests',
    'completedQuests',
    'cityProgress',
    'monsterRespawnState',
    'defeatedFieldBosses',
  ] as const)
    assert.equal(migrated[k], saved[k]);
  assert.deepEqual(migrateMeteorfallSave(migrated), migrated);
  assert.equal(saved.z, 30);
  const valid = { ...migrated, ...meteorPlatform('NW') };
  assert.equal(migrateMeteorfallSave(valid).x, valid.x);
  const recovered = migrateMeteorfallSave({
    ...migrated,
    x: NaN,
    z: 900,
    lastSafePosition: { x: -330, z: -280 },
  });
  assert.equal(recovered.x, -330);
  assert.equal(migrateMeteorfallSave({ ...saved, inCity: true }).z, 30);
});
void test('registry and spawn IDs retain the legacy species, quests and respawn key format', () => {
  const f = FIELDS[METEORFALL_ID],
    spawns = fieldSpawns(f);
  assert.equal(spawns.length, 294);
  assert.equal(new Set(spawns.map((s) => s.id)).size, 294);
  for (let i = 0; i < 36; i++) {
    assert.equal(spawns[i].id, i);
    assert.equal(spawns[i].definition, f.normalMonsters[i % 4]);
  }
  assert.deepEqual(
    spawns.slice(288).map((s) => s.id),
    [90, 91, 92, 93, 94, 100],
  );
  assert.deepEqual(
    spawns.slice(36, 216).map((s) => s.id),
    Array.from({ length: 180 }, (_, i) => 200 + i),
  );
  assert.deepEqual(
    spawns.slice(216, 288).map((s) => s.id),
    Array.from({ length: 72 }, (_, i) => 400 + i),
  );
  for (const id of ['L', 'C', 'A']) {
    const p = meteorPlatform(id);
    assert.equal(
      spawns.filter(
        (s) =>
          s.id >= 400 &&
          Math.abs(s.x - p.x) < p.width / 2 &&
          Math.abs(s.z - p.z) < p.depth / 2,
      ).length,
      24,
    );
  }
  for (const p of spawns) assert(meteorWalkable(p, p.id === 100 ? 1.8 : 0.55));
  assert.equal(
    monsterRespawnKey(f.fieldBoss!.id, 100, f.id),
    `${f.fieldBoss!.id}:spawn:100`,
  );
  assert.equal(FIELD_NPCS[f.id].id, 'field-npc-meteor');
  assert.equal(f.minLevel, 42);
  assert.equal(METEORFALL_LAYOUT_VERSION, 1);
});
void test('real save parser keeps new coordinates and quest/timer snapshots after migration and repeated reload', () => {
  const hero = freshHero();
  Object.assign(hero, {
    level: 45,
    inCity: false,
    currentCity: 'jayantara',
    currentField: METEORFALL_ID,
    x: 12,
    z: 30,
    gold: 984321,
  });
  delete hero.meteorfallLayoutVersion;
  hero.fieldProgress[METEORFALL_ID] = 36;
  hero.cityProgress['baseline-field-meteorfall-citadel-veteran'] = 8;
  hero.completedQuests = ['field-meteorfall-citadel-easy'];
  hero.activeQuests = ['field-meteorfall-citadel-veteran'];
  hero.acceptedQuests = [...hero.activeQuests];
  hero.defeatedFieldBosses = [METEORFALL_ID];
  hero.defeatedBossTimestamp[METEORFALL_ID] = Date.now();
  hero.monsterRespawnState = {
    'meteorfall-citadel-0:spawn:0': Date.now() + 60000,
    'meteorfall-citadel-5:spawn:100': Date.now() + 360000,
  };
  let result = parseSave(JSON.stringify(hero))!;
  assert(result);
  assert.deepEqual({ x: result.x, z: result.z }, METEORFALL_ENTRY);
  for (const key of [
    'gold',
    'level',
    'xp',
    'equipment',
    'activeQuests',
    'acceptedQuests',
    'completedQuests',
    'cityProgress',
    'fieldProgress',
    'defeatedFieldBosses',
    'defeatedBossTimestamp',
    'monsterRespawnState',
  ] as const)
    assert.deepEqual(result[key], hero[key], key);
  assert.deepEqual(
    result.inventory,
    hero.inventory.map((i) => ({ ...i, isEquipped: i.isEquipped ?? false })),
  );
  Object.assign(result, { x: -330.25, z: -280.5 });
  for (let i = 0; i < 4; i++) {
    result = parseSave(JSON.stringify(result))!;
    assert.equal(result.x, -330.25);
    assert.equal(result.z, -280.5);
  }
  result.x = 499;
  result.z = 499;
  result.lastSafePosition = { x: 300, z: -10 };
  result = parseSave(JSON.stringify(result))!;
  assert.deepEqual({ x: result.x, z: result.z }, { x: 300, z: -10 });
  for (const x of [null, '0', Number.NaN, Number.POSITIVE_INFINITY]) {
    const recovered = parseSave(JSON.stringify({ ...result, x, z: 380 }))!;
    assert.deepEqual({ x: recovered.x, z: recovered.z }, { x: 300, z: -10 });
  }
});
void test('existing level gate, return city and quest acceptance baseline survive the map replacement', () => {
  const hero = freshHero();
  hero.level = 41;
  assert.equal(travel(hero, METEORFALL_ID).ok, false);
  hero.level = 42;
  assert.equal(travel(hero, METEORFALL_ID).ok, true);
  assert.deepEqual({ x: hero.x, z: hero.z }, METEORFALL_ENTRY);
  const quest = FIELDS[METEORFALL_ID].questList[0];
  hero.fieldProgress[METEORFALL_ID] = 10;
  acceptRegionQuest(hero, quest);
  const before = regionQuestProgress(hero, quest);
  const saved = parseSave(JSON.stringify(hero))!;
  assert.deepEqual(regionQuestProgress(saved, quest), before);
  assert.equal(travel(saved, 'jayantara').ok, true);
  assert.equal(saved.inCity, true);
  assert.equal(travel(saved, METEORFALL_ID).ok, true);
  assert.deepEqual({ x: saved.x, z: saved.z }, METEORFALL_ENTRY);
});
