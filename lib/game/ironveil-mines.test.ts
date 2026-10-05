import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IRONVEIL_ID,
  IRONVEIL_BOUNDS,
  IRONVEIL_BOUNDARY,
  IRONVEIL_ENTRY,
  IRONVEIL_ENTRANCE,
  IRONVEIL_TRANSITION,
  IRONVEIL_PATHS,
  IRONVEIL_POCKETS,
  IRONVEIL_STEP,
  ironveilPoint,
  ironveilHeightfield,
  ironveilGroundHeight,
  ironveilCypressBaseHeight,
  ironveilPathDistance,
  ironveilDomain,
  ironveilWalkable,
  ironveilProps,
  IronveilNavigation,
} from './ironveil-mines-layout.ts';
import {
  FIELDS,
  CITIES,
  fieldContent,
  FIELD_NPCS,
  travel,
  refreshUnlocks,
  unlockReason,
} from './regions.ts';
import { freshHero, parseSave } from './rules.ts';

await test('new Ironveil permanently replaces the old destination and unlocks at level eight', () => {
  const field = FIELDS[IRONVEIL_ID],
    hero = freshHero();
  assert.equal(FIELDS['ironveil-mines'], undefined);
  assert.equal(FIELD_NPCS['ironveil-mines'], undefined);
  assert(!travel(hero, 'ironveil-mines').ok);
  assert(!travel(hero, IRONVEIL_ID).ok);
  hero.level = 8;
  refreshUnlocks(hero);
  assert.equal(unlockReason(hero, IRONVEIL_ID), '');
  assert(travel(hero, IRONVEIL_ID).ok);
  assert.deepEqual({ x: hero.x, z: hero.z }, IRONVEIL_ENTRY);
  assert.equal(Object.keys(FIELDS)[1], IRONVEIL_ID);
  for (const city of Object.values(CITIES))
    assert(!city.connectedFields.includes('ironveil-mines'));
  for (const f of Object.values(FIELDS))
    assert(
      f.previousField !== 'ironveil-mines' && f.nextMap !== 'ironveil-mines',
    );
  assert.equal(field.minLevel, 8);
  assert.equal(field.maxLevel, 16);
  assert.equal(fieldContent(IRONVEIL_ID).id, 'ironveil-mines');
  assert.equal(FIELD_NPCS[IRONVEIL_ID], undefined);
  assert.deepEqual(field.questList, []);
  assert.equal(IRONVEIL_TRANSITION.available, true);
  assert.equal(FIELDS[IRONVEIL_TRANSITION.destination], undefined);
});
await test('1000-square composition has a 50/50 allocation and only 464992 square units of accessible domain', () => {
  assert.deepEqual(IRONVEIL_BOUNDS, {
    minX: -500,
    maxX: 500,
    minZ: -500,
    maxZ: 500,
  });
  let twiceArea = 0;
  for (let i = 0; i < IRONVEIL_BOUNDARY.length; i++) {
    const a = IRONVEIL_BOUNDARY[i],
      b = IRONVEIL_BOUNDARY[(i + 1) % IRONVEIL_BOUNDARY.length];
    twiceArea += a.x * b.z - b.x * a.z;
  }
  assert.equal(Math.abs(twiceArea) / 2, 464992);
  for (let x = -499; x < 500; x += 7)
    for (let z = -499; z < 0; z += 7) {
      const exception =
        (x >= 180 && x <= 260 && z >= -50) ||
        (x >= 212 && x <= 228 && z >= -62);
      if (!exception) assert(!ironveilDomain({ x, z }, 0));
    }
  assert(ironveilDomain(IRONVEIL_ENTRY));
  assert(ironveilDomain(IRONVEIL_ENTRANCE));
});
await test('seamless entrance union, swept collision, props, and invalid-save recovery', () => {
  const nav = new IronveilNavigation();
  let p = nav.move({ x: 220, z: 20 }, 0, -80);
  assert(Math.abs(p.z + 60) < 1e-6);
  assert(nav.valid(p));
  p = nav.move(p, 0, -500);
  assert(p.z >= -61.55);
  assert(nav.valid(p));
  for (const x of [-450, -80, 100, 300, 450]) {
    const p = nav.move({ x, z: 20 }, 0, -200);
    assert(p.z >= 0.45);
    assert(nav.valid(p));
  }
  assert(nav.move({ x: 220, z: -40 }, 100, 0).x <= 259.55);
  for (const r of ironveilProps().filter((p) => p.radius > 0))
    assert(!nav.valid(r));
  assert.deepEqual(nav.restore({ x: NaN, z: Infinity }), IRONVEIL_ENTRY);
  assert.deepEqual(nav.restore({ x: 0, z: -400 }), IRONVEIL_ENTRY);
  assert.deepEqual(nav.move(IRONVEIL_ENTRY, NaN, 0), IRONVEIL_ENTRY);
});
await test('all paths and clearings are connected for players and future large enemies', () => {
  const nav = new IronveilNavigation();
  for (const radius of [0.45, 1.8]) {
    for (const path of IRONVEIL_PATHS)
      for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1],
          b = path.points[i],
          p = nav.move(a, b.x - a.x, b.z - a.z, radius);
        assert(
          Math.hypot(p.x - b.x, p.z - b.z) < 0.01,
          `blocked route ${JSON.stringify(a)} -> ${JSON.stringify(b)}`,
        );
      }
    // Flood the outdoor navigation domain at 5-unit spacing using swept edges.
    const size = 5,
      key = (p: { x: number; z: number }) =>
        `${Math.round(p.x / size)},${Math.round(p.z / size)}`;
    const queue = [{ x: 0, z: 440 }],
      seen = new Set([key(queue[0])]);
    for (let i = 0; i < queue.length; i++)
      for (const [dx, dz] of [
        [size, 0],
        [-size, 0],
        [0, size],
        [0, -size],
      ]) {
        const a = queue[i],
          b = { x: a.x + dx, z: a.z + dz },
          k = key(b);
        if (seen.has(k) || !nav.valid(b, radius)) continue;
        const moved = nav.move(a, dx, dz, radius);
        if (Math.hypot(moved.x - b.x, moved.z - b.z) > 0.01) continue;
        seen.add(k);
        queue.push(b);
      }
    for (const c of IRONVEIL_POCKETS) {
      const p = ironveilPoint((c.minU + c.maxU) / 2, (c.minV + c.maxV) / 2);
      assert(seen.has(key(p)), c.name);
    }
    assert(seen.has(key(IRONVEIL_ENTRANCE)));
  }
});
await test('terrain triangle grounding, gentle grades, deterministic sparse population and open area', () => {
  const h = ironveilHeightfield();
  assert.equal(h.length, 257 * 129);
  for (let j = 1; j < 128; j += 11)
    for (let i = 1; i < 256; i += 13) {
      const k = j * 257 + i;
      for (const [a, b] of [
        [0.2, 0.3],
        [0.8, 0.7],
      ]) {
        const expected =
          a + b <= 1
            ? h[k] + a * (h[k + 1] - h[k]) + b * (h[k + 257] - h[k])
            : h[k + 258] +
              (1 - a) * (h[k + 257] - h[k + 258]) +
              (1 - b) * (h[k + 1] - h[k + 258]);
        assert(
          Math.abs(
            ironveilGroundHeight(
              (i + a) * IRONVEIL_STEP - 500,
              (j + b) * IRONVEIL_STEP,
            ) - expected,
          ) < 0.00001,
        );
      }
    }
  assert.equal(ironveilGroundHeight(220, -50), 12);
  for (const path of IRONVEIL_PATHS)
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1],
        b = path.points[i],
        n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z));
      for (let k = 0; k < n; k++) {
        const f = (t: number) =>
          ironveilGroundHeight(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
        assert(
          Math.abs(f((k + 1) / n) - f(k / n)) < Math.tan((8 * Math.PI) / 180),
        );
      }
    }
  const props = ironveilProps();
  assert.equal(props, ironveilProps());
  for (const [kind, count] of [
    ['cypress', 42],
    ['shrub', 0],
    ['grass', 0],
    ['rock', 24],
  ])
    assert.equal(props.filter((p) => p.kind === kind).length, count);
  for (const p of props.filter((p) => p.kind === 'cypress')) {
    assert(p.height >= 32 && p.height <= 46);
    assert.equal(p.radius, p.height * 0.09);
  }
  for (const c of [
    ...IRONVEIL_POCKETS,
    { name: 'outdoor', minU: 21, maxU: 979, minV: 501, maxV: 979 },
  ]) {
    let total = 0,
      open = 0;
    for (let u = c.minU; u <= c.maxU; u += 5)
      for (let v = c.minV; v <= c.maxV; v += 5) {
        total++;
        if (ironveilWalkable(ironveilPoint(u, v), 1.8)) open++;
      }
    assert(open / total > (c.name === 'outdoor' ? 0.85 : 0.8), c.name);
  }
});
await test('trees sit below local ground and scenery covers the field without crowding paths', () => {
  const props = ironveilProps();
  const sectors = new Map<string, Set<string>>();
  for (const p of props) {
    const key = `${Math.floor((p.x + 450) / 150)},${Math.floor((p.z - 20) / 110)}`;
    if (!sectors.has(key)) sectors.set(key, new Set());
    sectors.get(key)!.add(p.kind);
    const canopy = p.kind === 'cypress' ? p.height * 0.21 : p.radius;
    assert(ironveilPathDistance(p) - canopy >= 15, 'path clearance');
    if (p.kind === 'cypress') {
      const base = ironveilCypressBaseHeight(p);
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 16)
        assert(
          ironveilGroundHeight(
            p.x + Math.cos(a) * p.radius,
            p.z + Math.sin(a) * p.radius,
          ) -
            base >
            1.3,
          'buried roots on slopes',
        );
    }
  }
  assert.equal(sectors.size, 24);
  for (const kinds of sectors.values())
    assert(kinds.has('cypress') && kinds.has('rock'));
  for (let i = 0; i < props.length; i++)
    for (let j = i + 1; j < props.length; j++)
      assert(
        Math.hypot(props[i].x - props[j].x, props[i].z - props[j].z) >= 50,
        'scenery spacing',
      );
});
await test('save loading preserves distant coordinates and recovers invalid exterior positions without schema change', () => {
  for (const p of [IRONVEIL_ENTRY, IRONVEIL_ENTRANCE, { x: -300, z: 380 }]) {
    const h = freshHero();
    h.level = 8;
    travel(h, IRONVEIL_ID);
    Object.assign(h, p);
    const loaded = parseSave(JSON.stringify(h))!;
    assert.equal(loaded.currentField, IRONVEIL_ID);
    assert.equal(loaded.x, p.x);
    assert.equal(loaded.z, p.z);
  }
  const h = freshHero();
  h.level = 8;
  travel(h, IRONVEIL_ID);
  h.x = 0;
  h.z = -450;
  const loaded = parseSave(JSON.stringify(h))!;
  assert.equal(loaded.x, IRONVEIL_ENTRY.x);
  assert.equal(loaded.z, IRONVEIL_ENTRY.z);
});

await test('old Ironveil saves migrate once, preserving city positions and earned progress', () => {
  for (const inCity of [false, true]) {
    const hero = freshHero();
    Object.assign(hero, {
      level: 8,
      inCity,
      currentCity: 'arunika',
      currentField: 'ironveil-mines',
      x: 40,
      z: -20,
      gold: 1234,
    });
    hero.unlockedFields = ['ironveil-mines'];
    hero.fieldProgress = { 'ironveil-mines': 12 };
    hero.monsterRespawnState = { 'ironveil-mines-0:spawn:0': 12345 };
    hero.completedQuests = ['field-ironveil-mines-easy'];
    const loaded = parseSave(JSON.stringify(hero))!;
    assert.equal(loaded.currentField, IRONVEIL_ID);
    assert(loaded.unlockedFields.includes(IRONVEIL_ID));
    assert(!loaded.unlockedFields.includes('ironveil-mines'));
    assert.deepEqual(
      { x: loaded.x, z: loaded.z },
      inCity ? { x: 40, z: -20 } : IRONVEIL_ENTRY,
    );
    for (const key of [
      'gold',
      'level',
      'equipment',
      'completedQuests',
      'monsterRespawnState',
    ] as const)
      assert.deepEqual(loaded[key], hero[key]);
    assert.deepEqual(loaded.fieldProgress, { [IRONVEIL_ID]: 12 });
    assert.equal(loaded.currentCity, inCity ? 'arunika' : 'averion');
    const again = parseSave(JSON.stringify(loaded))!;
    assert.equal(again.x, loaded.x);
    assert.equal(again.z, loaded.z);
  }
});
await test('under-level exterior preview saves return safely to town', () => {
  for (const id of ['ironveil-mines', IRONVEIL_ID]) {
    const hero = freshHero();
    Object.assign(hero, { level: 7, inCity: false, currentField: id });
    const loaded = parseSave(JSON.stringify(hero))!;
    assert(loaded.inCity);
    assert.equal(loaded.currentCity, 'averion');
    assert.deepEqual({ x: loaded.x, z: loaded.z }, { x: 0, z: 8 });
    assert(!loaded.unlockedFields.includes(IRONVEIL_ID));
    assert(!travel(loaded, IRONVEIL_ID).ok);
  }
});
