import { STARTER_FIELD_CONTENT } from './regions.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAINS_ID,
  PLAINS_ENTRY,
  PLAINS_EXIT,
  PLAINS_BRIDGE,
  PLAINS_POCKETS,
  PLAINS_CLEARING,
  PLAINS_RESOLUTION,
  PLAINS_STEP,
  PLAINS_PATHS,
  PLAINS_RIVER,
  PlainsNavigation,
  plainsHeightfield,
  plainsTerrainHeight,
  plainsGroundHeight,
  plainsWalkable,
  plainsSafe,
  plainsProps,
  plainsCoast,
  plainsRoadDistance,
  onPlainsBridge,
  bridgeLocal,
} from './verdant-plains-layout.ts';
import {
  FIELDS,
  FIELD_NPCS,
  travel,
  getAllQuestJournalEntries,
} from './regions.ts';
import {
  fieldSpawns,
  monsterRespawnKey,
  restoreRespawnDeadline,
} from './field-layout.ts';
import {
  lootItemPool,
  rollMonsterItem,
  MONSTER_LOOT_PROFILES,
} from './monster-loot.ts';
import { ITEM_CATALOG } from './items.ts';
import { freshHero, parseSave } from './rules.ts';

await test('new map supports level 1–8 hunting; old population and quest identities are intact', () => {
  const field = FIELDS[PLAINS_ID],
    hero = freshHero();
  hero.level = 1;
  assert.equal(travel(hero, PLAINS_ID).ok, true);
  assert.deepEqual({ x: hero.x, z: hero.z }, PLAINS_ENTRY);
  assert.equal(field.fieldBoss?.level, 8);
  assert.equal(field.maxLevel, 8);
  assert.equal(fieldSpawns(field).length, 497);
  assert.equal(FIELD_NPCS[PLAINS_ID], undefined);
  assert.equal(
    getAllQuestJournalEntries(hero).filter((q) => q.targetMapId === PLAINS_ID && q.category === 'side')
      .length,
    0,
  );
  assert.equal(fieldSpawns(STARTER_FIELD_CONTENT).length, 42);
  assert.equal(fieldSpawns(FIELDS['east-gate-arunika']).length, 42);
  assert.equal(travel(hero, 'averion').ok, true);
  assert.equal(hero.inCity, true);
  assert.equal(travel(hero, PLAINS_ID).ok, true);
  assert.equal(hero.inCity, false);
  assert.equal(hero.x, PLAINS_ENTRY.x);
});
await test('population is deterministic, distributed, grouped and safely navigable', () => {
  const spawns = fieldSpawns(FIELDS[PLAINS_ID]),
    nav = new PlainsNavigation();
  assert.deepEqual(spawns, fieldSpawns(FIELDS[PLAINS_ID]));
  assert.equal(new Set(spawns.map((s) => s.id)).size, 497);
  assert.equal(
    spawns.filter((s) => s.definition.variant === 'normal').length,
    480,
  );
  assert.equal(
    spawns.filter((s) => s.definition.variant === 'elite').length,
    16,
  );
  for (const s of spawns) {
    assert.ok(s.definition.level >= 1 && s.definition.level <= 8);
    assert.ok(
      nav.valid(s, s.definition.variant === 'boss' ? 3 : 2.5),
      String(s.id),
    );
    assert.ok(!plainsSafe(s, 24));
    assert.ok(!onPlainsBridge(s));
    if (s.definition.variant !== 'boss') assert.ok(plainsRoadDistance(s) > 3);
  }
  for (const pocket of PLAINS_POCKETS)
    assert.ok(
      spawns.filter(
        (s) => Math.hypot(s.x - pocket.x, s.z - pocket.z) < pocket.radius,
      ).length >= 20,
      pocket.id,
    );
  const boss = spawns.find((s) => s.definition.variant === 'boss')!;
  assert.equal(boss.x, PLAINS_CLEARING.x);
  assert.equal(boss.z, PLAINS_CLEARING.z);
  assert.ok(
    Math.max(...spawns.map((s) => s.x)) - Math.min(...spawns.map((s) => s.x)) >
      800,
  );
  assert.ok(
    Math.max(...spawns.map((s) => s.z)) - Math.min(...spawns.map((s) => s.z)) >
      650,
  );
  const nearest = spawns
    .filter((s) => s.id < 480)
    .map((s) =>
      Math.min(
        ...spawns
          .filter((q) => q !== s)
          .map((q) => Math.hypot(s.x - q.x, s.z - q.z)),
      ),
    );
  assert.ok(nearest.filter((d) => d < 10).length >= 300);
  assert.ok(nearest.filter((d) => d >= 15).length >= 100);
});
await test('new population loot categories and respawn saves remain isolated', () => {
  const field = FIELDS[PLAINS_ID],
    hero = freshHero();
  travel(hero, PLAINS_ID);
  for (const s of fieldSpawns(field)) {
    const key = monsterRespawnKey(s.definition.id, s.id, PLAINS_ID),
      deadline = Date.now() + 25000;
    hero.monsterRespawnState[key] = deadline;
    assert.equal(
      restoreRespawnDeadline(
        hero.monsterRespawnState,
        s.definition.id,
        s.id,
        PLAINS_ID,
      ),
      deadline,
    );
  }
  const restored = parseSave(JSON.stringify(hero))!;
  assert.deepEqual(restored.monsterRespawnState, hero.monsterRespawnState);
  const legacy = STARTER_FIELD_CONTENT.normalMonsters[0];
  assert.equal(
    restoreRespawnDeadline(
      restored.monsterRespawnState,
      legacy.id,
      0,
      'verdant-plains',
    ),
    0,
  );
  for (const monster of [
    ...field.normalMonsters,
    ...field.eliteMonsters,
    field.fieldBoss!,
  ]) {
    const profile = MONSTER_LOOT_PROFILES[monster.variant],
      total = profile.reduce((n, p) => n + p.weight, 0);
    let offset = 0;
    for (const entry of profile) {
      const pool = lootItemPool(PLAINS_ID, monster.variant, entry.value);
      assert.ok(pool.length > 0, entry.value);
      for (const p of pool) assert.ok(ITEM_CATALOG[p.value], String(p.value));
      assert.ok(
        rollMonsterItem(
          PLAINS_ID,
          monster.variant,
          null,
          monster.id,
          () => 0.5,
          (offset + entry.weight / 2) / total,
        ),
      );
      offset += entry.weight;
    }
  }
});
await test('513-square heightfield uses render triangle interpolation without bilinear drift', () => {
  const h = plainsHeightfield();
  assert.equal(h.length, PLAINS_RESOLUTION ** 2);
  assert.equal(h, plainsHeightfield());
  for (const [x, z] of [
    [42, 53],
    [211, 196],
    [392, 133],
  ]) {
    const k = z * 513 + x,
      a = 0.2,
      b = 0.3;
    assert.ok(
      Math.abs(
        plainsTerrainHeight(
          (x + a) * PLAINS_STEP - 500,
          (z + b) * PLAINS_STEP - 500,
        ) -
          (h[k] + a * (h[k + 1] - h[k]) + b * (h[k + 513] - h[k])),
      ) < 1e-5,
    );
  }
});
await test('camp, exit and future pockets are safe navigable terrain with connected roads', () => {
  const nav = new PlainsNavigation();
  assert.ok(plainsSafe(PLAINS_ENTRY));
  assert.ok(!plainsSafe(PLAINS_EXIT));
  for (const p of [PLAINS_ENTRY, PLAINS_EXIT, ...PLAINS_POCKETS])
    assert.ok(nav.valid(p), JSON.stringify(p));
  for (const path of PLAINS_PATHS)
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1],
        b = path.points[i],
        n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z));
      for (let j = 0; j <= n; j++) {
        const p = {
          x: a.x + ((b.x - a.x) * j) / n,
          z: a.z + ((b.z - a.z) * j) / n,
        };
        assert.ok(nav.valid(p), `blocked road ${JSON.stringify(p)}`);
      }
    }
});
await test('bridge deck matches ground and crosses both directions; swept movement blocks all other water', () => {
  const nav = new PlainsNavigation(),
    b = PLAINS_BRIDGE;
  for (const sign of [-1, 1]) {
    const start = { x: b.x + b.dx * 40 * sign, z: b.z + b.dz * 40 * sign },
      end = nav.move(start, -b.dx * 80 * sign, -b.dz * 80 * sign);
    assert.ok(
      Math.hypot(
        end.x - (b.x - b.dx * 40 * sign),
        end.z - (b.z - b.dz * 40 * sign),
      ) < 0.01,
      JSON.stringify(end),
    );
  }
  assert.equal(plainsGroundHeight(b.x, b.z), b.height);
  for (const p of PLAINS_RIVER.filter((_, i) => i % 9 === 0)) {
    if (
      Math.abs(bridgeLocal(p).along) < 35 &&
      Math.abs(bridgeLocal(p).across) < 8
    )
      continue;
    assert.equal(plainsWalkable(p), false);
  }
  const from = { x: 0, z: plainsCoast(0) - 35 },
    end = nav.move(from, 0, 120);
  assert.ok(end.z < plainsCoast(0) - 4);
  assert.ok(nav.valid(end));
});
await test('far save coordinates survive; invalid and water saves return to camp without schema changes', () => {
  for (const point of [PLAINS_EXIT, ...PLAINS_POCKETS]) {
    const hero = freshHero();
    travel(hero, PLAINS_ID);
    Object.assign(hero, point);
    const loaded = parseSave(JSON.stringify(hero))!;
    assert.equal(loaded.currentField, PLAINS_ID);
    assert.equal(loaded.x, point.x);
    assert.equal(loaded.z, point.z);
  }
  for (const point of [{ x: 900, z: 0 }, { x: NaN, z: 0 }, PLAINS_RIVER[30]]) {
    const hero = freshHero();
    travel(hero, PLAINS_ID);
    Object.assign(hero, point);
    const loaded = parseSave(JSON.stringify(hero))!;
    assert.equal(loaded.x, PLAINS_ENTRY.x);
    assert.equal(loaded.z, PLAINS_ENTRY.z);
  }
});
await test('deterministic prop distribution avoids camps, roads and reserved pockets', () => {
  assert.equal(plainsProps(), plainsProps());
  assert.ok(plainsProps().length > 500);
  for (const p of plainsProps()) assert.ok(!plainsSafe(p, 15));
});

await test('road grades stay below eight degrees and hunting pockets are predominantly gentle', () => {
  for (const path of PLAINS_PATHS)
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1],
        b = path.points[i],
        length = Math.hypot(b.x - a.x, b.z - a.z),
        steps = Math.ceil(length);
      for (let j = 1; j <= steps; j++) {
        const h = (t: number) =>
          plainsGroundHeight(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
        assert.ok(
          Math.abs(h(j / steps) - h((j - 1) / steps)) / (length / steps) <
            Math.tan((8 * Math.PI) / 180),
          `road slope at ${a.x},${a.z}`,
        );
      }
    }
  for (const pocket of PLAINS_POCKETS) {
    let gentle = 0,
      total = 0;
    for (let x = -pocket.radius; x <= pocket.radius; x += 5)
      for (let z = -pocket.radius; z <= pocket.radius; z += 5) {
        if (Math.hypot(x, z) > pocket.radius) continue;
        total++;
        const px = pocket.x + x,
          pz = pocket.z + z,
          dx =
            (plainsGroundHeight(px + 1, pz) - plainsGroundHeight(px - 1, pz)) /
            2,
          dz =
            (plainsGroundHeight(px, pz + 1) - plainsGroundHeight(px, pz - 1)) /
            2;
        if (Math.hypot(dx, dz) < Math.tan((15 * Math.PI) / 180)) gentle++;
      }
    assert.ok(gentle / total > 0.85, `${pocket.id} gentle ${gentle}/${total}`);
  }
});

await test('all reserved pockets are reachable from camp through the single river crossing', () => {
  const nav = new PlainsNavigation(),
    step = 4,
    n = 249,
    valid = new Uint8Array(n * n),
    seen = new Uint8Array(n * n);
  const point = (i: number) => ({
    x: (i % n) * step - 496,
    z: Math.floor(i / n) * step - 496,
  });
  for (let i = 0; i < valid.length; i++) valid[i] = Number(nav.valid(point(i)));
  const index = (p: { x: number; z: number }) =>
    Math.round((p.z + 496) / step) * n + Math.round((p.x + 496) / step);
  const queue = [index(PLAINS_ENTRY)];
  seen[queue[0]] = 1;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head],
      p = point(current);
    for (const next of [current - 1, current + 1, current - n, current + n]) {
      if (next < 0 || next >= valid.length || !valid[next] || seen[next])
        continue;
      const q = point(next);
      if (Math.hypot(q.x - p.x, q.z - p.z) > step + 0.01) continue;
      const end = nav.move(p, q.x - p.x, q.z - p.z);
      if (Math.hypot(end.x - q.x, end.z - q.z) > 0.01) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }
  for (const p of [...PLAINS_POCKETS, PLAINS_EXIT])
    assert.equal(seen[index(p)], 1, JSON.stringify(p));
  for (const spawn of fieldSpawns(FIELDS[PLAINS_ID])) {
    const cell=index(spawn);
    let reachable=false;
    for(let dz=-2;dz<=2&&!reachable;dz++)for(let dx=-2;dx<=2;dx++){
      const candidate=cell+dz*n+dx;
      if(candidate<0||candidate>=seen.length||!seen[candidate])continue;
      const p=point(candidate),end=nav.move(spawn,p.x-spawn.x,p.z-spawn.z);
      if(Math.hypot(end.x-p.x,end.z-p.z)<.01){reachable=true;break;}
    }
    assert.ok(reachable,`spawn ${spawn.id} is connected to camp`);
  }
});
