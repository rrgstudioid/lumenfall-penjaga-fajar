import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FROSTFIRE_ID,
  FROSTFIRE_PREVIEW_ID,
  FROSTFIRE_ENTRY,
  FROSTFIRE_ZONES,
  FROSTFIRE_LAKES,
  FROSTFIRE_PATHS,
  FrostNavigation,
  frostHeight,
  frostSurface,
  frostWalkable,
  frostCoastDistance,
  frostProps,
  frostIce,
  frostPropFootprint,
  FROST_PROP_GAP,
} from './frostfire-highlands-layout.ts';
import { FrostFootprints, FOOTPRINT_LIMIT } from './frostfire-footprints.ts';
import { FIELDS, FIELD_NPCS, travel } from './regions.ts';
import {
  fieldSpawns,
  monsterRespawnKey,
  restoreRespawnDeadline,
} from './field-layout.ts';
import { frostPopulation, frostSafe } from './frostfire-population.ts';
import { freshHero, parseSave } from './rules.ts';

await test('permanent Frostfire replacement retains Lv24-32 species and Lv34 boss with one travel destination', () => {
  const field = FIELDS[FROSTFIRE_ID],
    hero = freshHero();
  assert.equal(FIELDS[FROSTFIRE_PREVIEW_ID], undefined);
  assert.equal(Object.values(FIELDS).filter(f=>f.displayName === 'Frostfire Highlands').length, 1);
  assert(!Object.values(FIELDS).some(f=>f.displayName === 'Dataran Bara-Beku'));
  assert.equal(field.displayName, 'Frostfire Highlands');
  assert.deepEqual(field.normalMonsters.map(m=>m.level), [24,25,28,30]);
  assert.equal(field.eliteMonsters[0].level, 32);
  assert.equal(field.fieldBoss?.name, 'Twin Elemental Lord');
  assert.equal(field.fieldBoss?.level, 34);
  assert.equal(field.minLevel, 24);
  assert.equal(field.maxLevel, 32);
  assert.deepEqual(field.questList, []);
  assert.equal(FIELD_NPCS[FROSTFIRE_ID], undefined);
  hero.level = 24;
  assert.equal(travel(hero, FROSTFIRE_ID).ok, true);
  assert.equal(hero.x, FROSTFIRE_ENTRY.x);
  assert.equal(hero.z, FROSTFIRE_ENTRY.z);
  const saved = parseSave(JSON.stringify(hero));
  assert(saved);
  assert.equal(saved.currentField, FROSTFIRE_ID);
  assert.equal(saved.x, hero.x);
  assert.equal(travel(hero, 'averion').ok, true);
  assert.equal(hero.inCity, true);
});
await test('all authored zones, inland ice and primary routes are reachable', () => {
  const nav = new FrostNavigation();
  assert(nav.valid(FROSTFIRE_ENTRY));
  // Flood on a 4 m grid, checking each edge with the real swept movement solver.
  const step = 4,
    start = {
      x: Math.round(FROSTFIRE_ENTRY.x / step) * step,
      z: Math.round(FROSTFIRE_ENTRY.z / step) * step,
    };
  const key = (x: number, z: number) => `${x},${z}`,
    seen = new Set([key(start.x, start.z)]),
    queue = [start];
  for (let i = 0; i < queue.length; i++)
    for (const [dx, dz] of [
      [step, 0],
      [-step, 0],
      [0, step],
      [0, -step],
    ]) {
      const p = queue[i],
        x = p.x + dx,
        z = p.z + dz,
        k = key(x, z);
      if (seen.has(k) || !nav.valid({ x, z })) continue;
      const end = nav.move(p, dx, dz);
      if (Math.hypot(end.x - x, end.z - z) > 0.01) continue;
      seen.add(k);
      queue.push({ x, z });
    }
  for (const p of [
    ...FROSTFIRE_ZONES,
    ...FROSTFIRE_LAKES,
    ...FROSTFIRE_PATHS[0].points,
    ...fieldSpawns(FIELDS[FROSTFIRE_ID]),
  ])
    assert(
      queue.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 7),
      `unreachable ${JSON.stringify(p)}`,
    );
  for (const lake of FROSTFIRE_LAKES) {
    assert.equal(frostSurface(lake.x, lake.z).kind, 'ice');
    assert(frostWalkable(lake));
    assert(Math.abs(frostHeight(lake.x, lake.z) - lake.level) < 0.2);
  }
  assert(!nav.valid({ x: 490, z: 490 }));
  assert(!nav.valid({ x: NaN, z: 0 }));
  assert.deepEqual(nav.restore({ x: Infinity, z: 0 }), FROSTFIRE_ENTRY);
});
await test('monster population follows usable snow area, safe spacing and independent respawn saves', () => {
  const field = FIELDS[FROSTFIRE_ID],
    pop = frostPopulation(),
    spawns = fieldSpawns(field);
  assert.equal(
    pop.normalCount,
    Math.min(320, Math.floor(pop.snowArea / 6400) * 4),
  );
  assert.equal(pop.eliteCount, Math.ceil(pop.normalCount / 16));
  const bosses = spawns.filter(s => s.definition.variant === 'boss');
  assert.equal(bosses.length, 1);
  assert.equal(spawns.length, pop.normalCount + pop.eliteCount + 1);
  assert.equal(bosses[0].id, 20000);
  assert(bosses[0].z < -160);
  assert(frostIce(bosses[0]).distance >= 25);
  assert(frostProps().every(prop => Math.hypot(prop.x - bosses[0].x, prop.z - bosses[0].z) >= frostPropFootprint(prop) + 12));
  assert.equal(new Set(spawns.map((s) => s.id)).size, spawns.length);
  assert.deepEqual(fieldSpawns(field), spawns);
  const nav = new FrostNavigation();
  for (let i = 0; i < spawns.length; i++) {
    const s = spawns[i];
    if (s.definition.variant === 'boss') assert.equal(s.definition.level, 34);
    else assert(s.definition.level >= 24 && s.definition.level <= 32);
    assert(nav.valid(s, 2));
    assert(!frostSafe(s, 25));
    assert(frostIce(s).distance >= 10);
    for (let j = i + 1; j < spawns.length; j++)
      assert(Math.hypot(s.x - spawns[j].x, s.z - spawns[j].z) >= 20);
    const legacyKey = `${s.definition.id}:spawn:${s.id}`;
    const key = monsterRespawnKey(s.definition.id, s.id, FROSTFIRE_ID);
    assert.notEqual(key, legacyKey);
    assert.equal(
      restoreRespawnDeadline(
        { [legacyKey]: 1234 },
        s.definition.id,
        s.id,
        FROSTFIRE_ID,
      ),
      0,
    );
    assert.equal(
      restoreRespawnDeadline(
        { [key]: 5678 },
        s.definition.id,
        s.id,
        FROSTFIRE_ID,
      ),
      5678,
    );
  }
});
await test('open snow dominates the walkable land; sparse deterministic props', () => {
  let land = 0,
    open = 0;
  for (let z = -480; z < 480; z += 8)
    for (let x = -480; x < 480; x += 8) {
      if (frostCoastDistance({ x, z }) < 16 || !frostWalkable({ x, z }))
        continue;
      land++;
      if (
        frostSurface(x, z).kind !== 'rock' &&
        !frostProps().some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + 3)
      )
        open++;
    }
  assert(open / land >= 0.65, `open ratio ${open / land}`);
  const placed = frostProps();
  assert.equal(placed.filter((p) => p.kind === 'fir').length, 70);
  assert.equal(placed.filter((p) => p.kind === 'rock').length, 50);
  const cells = new Set<string>();
  for (let i = 0; i < placed.length; i++) {
    const p = placed[i],
      radius = frostPropFootprint(p);
    cells.add(
      `${Math.floor((p.x + 500) / 250)},${Math.floor((p.z + 500) / 250)}`,
    );
    for (let j = i + 1; j < placed.length; j++) {
      const q = placed[j];
      assert(
        Math.hypot(p.x - q.x, p.z - q.z) - radius - frostPropFootprint(q) >=
          FROST_PROP_GAP,
        'imported props need clear space between their visible footprints',
      );
    }
    for (let side = 0; side < 24; side++) {
      const a = (side * Math.PI) / 12;
      const edge = {
        x: p.x + Math.cos(a) * radius,
        z: p.z + Math.sin(a) * radius,
      };
      assert(
        frostIce(edge).distance > 12,
        'prop footprint must stay away from frozen water',
      );
      assert.equal(frostSurface(edge.x, edge.z).kind, 'snow');
    }
  }
  assert(cells.size >= 9, 'props should cover the snowfields across the map');
});
await test('neighboring ice basins blend elevations without vertical steps', () => {
  // The old nearest-basin selection jumped from 31 m to 15 m here.
  for (let z = -65; z <= 35; z += 2)
    for (let x = -65; x <= 160; x += 2) {
      const ice = frostIce({ x, z });
      if (ice.distance > 20) continue;
      for (const [dx, dz] of [
        [0.1, 0],
        [0, 0.1],
      ]) {
        const neighbor = frostIce({ x: x + dx, z: z + dz });
        assert(
          Math.abs(ice.level - neighbor.level) < 0.3,
          `ice elevation discontinuity at ${x},${z}`,
        );
      }
    }
});
await test('footprints alternate, follow actual motion, reject ice/teleports, fade and stay capped', () => {
  const pool = new FrostFootprints(),
    p = { ...FROSTFIRE_ENTRY };
  pool.update(p, 0, 0.02, true);
  for (let i = 1; i <= 100; i++) {
    p.x += 0.1;
    pool.update(p, i * 0.02, 0.02, true);
  }
  const marks = pool.slots.filter(Boolean);
  assert(marks.length > 5);
  for (let i = 1; i < marks.length; i++)
    assert.equal(marks[i]!.side, -marks[i - 1]!.side);
  const count = pool.count;
  assert.equal(pool.activeSlots.size, count);
  pool.update(p, 2.1, 0.02, false);
  assert.equal(pool.count, count);
  const ice = FROSTFIRE_LAKES[0];
  pool.update(ice, 2.2, 0.02, true);
  for (let i = 0; i < 30; i++)
    pool.update({ x: ice.x + i * 0.1, z: ice.z }, 2.3 + i * 0.02, 0.02, true);
  assert.equal(pool.count, count);
  pool.update(ice, 50, 0.02, false);
  assert.equal(pool.count, 0);
  assert.equal(pool.activeSlots.size, 0);
  assert.equal(pool.expiredSlots.length, count);
  pool.reset();
  assert.equal(pool.expiredSlots.length, 0);
  for (let i = 0; i < 5000; i++) {
    const x = FROSTFIRE_ENTRY.x + Math.sin(i * 0.025) * 12;
    pool.update({ x, z: FROSTFIRE_ENTRY.z }, i * 0.001, 0.03, true);
  }
  assert(pool.count <= FOOTPRINT_LIMIT);
  assert(
    pool.opacity(
      { x: 0, z: 0, y: 0, nx: 0, ny: 1, nz: 0, yaw: 0, side: 1, born: 0 },
      40,
    ) < 0.27,
  );
});
