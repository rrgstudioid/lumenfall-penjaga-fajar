import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as T from 'three';
import { createSunkenVfx } from './sunken-ruins-vfx.ts';
import { SUNKEN_HABITATS } from './sunken-ruins-marine-motion.ts';
import {
  SUNKEN_ID,
  SUNKEN_PREVIEW_ID,
  SUNKEN_ENTRY,
  SUNKEN_PATHS,
  SUNKEN_ZONES,
  SUNKEN_PORTALS,
  SUNKEN_OBSTACLES,
  SUNKEN_REEFS,
  SUNKEN_COLLIDERS,
  SUNKEN_CLEARINGS,
  SUNKEN_WALL,
  SUNKEN_WALL_COLLIDERS,
  SUNKEN_WALL_HEIGHT,
  sunkenInsideWall,
  sunkenMonsterWalkable,
  sunkenCollisionFree,
  sunkenWalkable,
  sunkenGroundHeight,
} from './sunken-ruins-layout.ts';
import { SunkenNavigation } from './sunken-ruins-navigation.ts';
import {
  DEEP_OCEAN_ID,
  DEEP_OCEAN_ENTRY,
  DEEP_OCEAN_RETURN,
  DEEP_OCEAN_GATE,
  UNDERWATER_GRID_SIZE,
  ABYSAL_TRENCH_ID,
  ABYSAL_TRENCH_GATE,
  ABYSAL_TRENCH_ENTRY,
  ABYSAL_TRENCH_RETURN,
} from './underwater-regions.ts';
import {
  deepOceanWalkable,
  deepOceanGroundHeight,
  DEEP_OCEAN_REEFS,
  DEEP_OCEAN_COLLIDERS,
  DEEP_OCEAN_PORTALS,
} from './deep-ocean-layout.ts';
import {
  abysalTrenchGroundHeight,
  abysalTrenchFloorHeight,
  abysalTrenchWalkable,
  ABYSAL_TRENCH_PATH,
  ABYSAL_TRENCH_ARENA,
  ABYSAL_TRENCH_PORTALS,
} from './abysal-trench-layout.ts';
import { sunkenCameraDistance } from './sunken-ruins-camera.ts';
import { FIELDS, FIELD_NPCS, travel, unlockReason } from './regions.ts';
import { fieldSpawns } from './field-layout.ts';
import {
  sunkenPopulation,
  SUNKEN_BOSS_HOME,
  SUNKEN_HOME_SPACING,
  sunkenPopulationMetrics,
} from './sunken-ruins-population.ts';
import { monsterRespawnKey, isFieldSafe } from './field-layout.ts';
import { freshHero, createItem, parseSave } from './rules.ts';
import {
  createCharacterModel,
  disposeCharacterModel,
} from './character-model.ts';

await test('production registers the underwater replacement and preserves its sub-map saves', () => {
  for (const mapId of [SUNKEN_ID, DEEP_OCEAN_ID, ABYSAL_TRENCH_ID]) {
    const source = `import {FIELDS} from './lib/game/regions.ts';import {freshHero,parseSave} from './lib/game/rules.ts';import {SUNKEN_WALL} from './lib/game/sunken-ruins-layout.ts';const id='${mapId}',h=freshHero();Object.assign(h,{currentField:id,currentCity:'jayantara',inCity:false,level:32,...FIELDS[id].entry});const p=parseSave(JSON.stringify(h));console.log(JSON.stringify({registered:!!FIELDS[id],previewRegistered:!!FIELDS['${SUNKEN_PREVIEW_ID}'],walls:SUNKEN_WALL.segments.length>0,field:p.currentField,city:p.currentCity,inCity:p.inCity,x:p.x,z:p.z,level:p.level}));`;
    const result = JSON.parse(
      execFileSync(
        process.execPath,
        ['--experimental-transform-types', '--input-type=module', '-e', source],
        {
          cwd: new URL('../..', import.meta.url),
          env: { ...process.env, NODE_ENV: 'production' },
          encoding: 'utf8',
        },
      ),
    );
    assert.deepEqual(result, {
      registered: true,
      previewRegistered: false,
      walls: true,
      field: mapId,
      city: 'jayantara',
      inCity: false,
      ...FIELDS[mapId].entry,
      level: 32,
    });
  }
});

await test('one canonical Sunken Ruins replaces the retired field and keeps the level 32 gate', () => {
  const field = FIELDS[SUNKEN_ID],
    hero = freshHero();
  hero.level = 31;
  assert.match(unlockReason(hero, SUNKEN_ID), /32/);
  assert.equal(travel(hero, SUNKEN_ID).ok, false);
  hero.level = 32;
  assert.equal(travel(hero, SUNKEN_ID).ok, true);
  assert.deepEqual({ x: hero.x, z: hero.z }, SUNKEN_ENTRY);
  assert.equal(fieldSpawns(field).length, 324);
  assert.equal(field.fieldBoss?.level, 42);
  assert.equal(field.questList.length, 0);
  assert.deepEqual(field.materialTable, FIELDS['sunken-ruins'].materialTable);
  assert.equal(SUNKEN_ID, 'sunken-ruins');
  assert.equal(field.displayName, 'Sunken Ruins');
  assert.equal(FIELDS[SUNKEN_PREVIEW_ID], undefined);
  assert.equal(FIELD_NPCS[SUNKEN_ID], undefined);
  assert.deepEqual(
    field.subAreas,
    SUNKEN_ZONES.map((z) => z.name),
  );
  assert.equal(
    Object.values(FIELDS).filter((f) => f.displayName === 'Sunken Ruins')
      .length,
    1,
  );
});
await test('all blueprint path cores and zone/gate anchors are connected and navigable', () => {
  const nav = new SunkenNavigation();
  for (const p of [...SUNKEN_ZONES, ...SUNKEN_PORTALS])
    assert.ok(nav.valid(p), JSON.stringify(p));
  for (const path of SUNKEN_PATHS)
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1],
        b = path.points[i],
        n = Math.ceil(Math.hypot(a.x - b.x, a.z - b.z));
      for (let j = 0; j <= n; j++) {
        const p = {
          x: a.x + ((b.x - a.x) * j) / n,
          z: a.z + ((b.z - a.z) * j) / n,
        };
        // Reef islands can occupy the wider 48-80 sand avenues, leaving a 24/36-unit through lane.
        const nearDoor = SUNKEN_PORTALS.some(
          (g) => Math.hypot(g.x - p.x, g.z - p.z) < 22,
        );
        assert.ok(
          nav.valid(p, nearDoor ? 0.45 : path.width >= 72 ? 17.9 : 11.9),
          'clear path including arch opening',
        );
      }
    }
  for (const gate of SUNKEN_PORTALS) {
    assert.notEqual(gate.destination, SUNKEN_ID);
    assert.ok(
      Math.hypot(gate.x - SUNKEN_ENTRY.x, gate.z - SUNKEN_ENTRY.z) > 4.5,
    );
  }
});
await test('shelf walls have visible footprints and eight traversable openings; open sand has no contour wall', () => {
  const nav = new SunkenNavigation();
  let playable = 0;
  for (let z = -495; z < 500; z += 10)
    for (let x = -495; x < 500; x += 10) if (nav.valid({ x, z })) playable++;
  assert.ok(playable > 9000, `only ${playable / 100}% accessible`);
  assert.ok(SUNKEN_PATHS.every((p) => p.width >= 48));
  assert.equal(SUNKEN_WALL.openings.length, 8);
  assert.equal(SUNKEN_WALL_HEIGHT, 18);
  assert.ok(SUNKEN_WALL_COLLIDERS.every((p) => p.height >= 18));
  for (const p of SUNKEN_WALL.openings) {
    const length = Math.hypot(p.x, p.z + 50),
      dx = p.x / length,
      dz = (p.z + 50) / length;
    const from = { x: p.x - dx * 6, z: p.z - dz * 6 };
    const to = { x: p.x + dx * 6, z: p.z + dz * 6 };
    assert.ok(nav.clear(from, to), JSON.stringify(p));
    const moved = nav.move(from, dx * 12, dz * 12);
    assert.ok(Math.hypot(moved.x - to.x, moved.z - to.z) < 1e-5);
  }
  for (const p of SUNKEN_WALL_COLLIDERS) assert.equal(nav.valid(p), false);
  const boundary = nav.move({ x: 495, z: 495 }, 0, 100);
  assert.ok(boundary.z > 499 && boundary.z <= 499.55);
  assert.ok(sunkenGroundHeight(750, 200) < sunkenGroundHeight(500, 200) - 100);
  for (const p of [
    { x: 500, z: 0 },
    { x: -500, z: 0 },
    { x: 0, z: 500 },
    { x: 0, z: -500 },
  ])
    assert.equal(nav.valid(p), false);
});
await test('G7 travels to the Deep Ocean hunting sub-map and returns outside the portal trigger', () => {
  const hero = freshHero();
  hero.level = 32;
  travel(hero, SUNKEN_ID);
  const gate = SUNKEN_PORTALS.find((p) => p.destination === DEEP_OCEAN_ID)!;
  assert.deepEqual({ x: gate.x, z: gate.z }, DEEP_OCEAN_GATE);
  assert.equal(UNDERWATER_GRID_SIZE, 8);
  assert.deepEqual(DEEP_OCEAN_GATE, { x: 312.5, z: 312.5 });
  assert.equal(sunkenInsideWall(gate), false);
  assert.ok(sunkenWalkable(gate));
  assert.equal(DEEP_OCEAN_REEFS.length, 0);
  assert.equal(DEEP_OCEAN_COLLIDERS.length, 0);
  assert.equal(travel(hero, DEEP_OCEAN_ID).ok, false);
  assert.equal(travel(hero, DEEP_OCEAN_ID, gate.id).ok, false);
  Object.assign(hero, { x: gate.x, z: gate.z + 3 });
  assert.ok(travel(hero, DEEP_OCEAN_ID, gate.id).ok);
  assert.deepEqual({ x: hero.x, z: hero.z }, DEEP_OCEAN_ENTRY);
  assert.equal(fieldSpawns(FIELDS[DEEP_OCEAN_ID]).length, 335);
  Object.assign(hero, { x: 250, z: -275 });
  const saved = parseSave(JSON.stringify(hero))!;
  assert.equal(saved.currentField, DEEP_OCEAN_ID);
  assert.ok(deepOceanWalkable(saved));
  assert.ok(deepOceanGroundHeight(saved.x, saved.z) < -180);
  assert.ok(travel(hero, SUNKEN_ID).ok);
  assert.deepEqual({ x: hero.x, z: hero.z }, DEEP_OCEAN_RETURN);
  assert.ok(Math.hypot(hero.x - gate.x, hero.z - gate.z) > 4.5);
});
await test('underwater sub-maps require a nearby connected warp and preserve return/reload positions', () => {
  const hero = freshHero();
  hero.level = 32;
  assert.ok(
    FIELDS[DEEP_OCEAN_ID].warpOnly && FIELDS[ABYSAL_TRENCH_ID].warpOnly,
  );
  assert.equal(travel(hero, DEEP_OCEAN_ID, 'deep-ocean-g7').ok, false);
  assert.equal(travel(hero, ABYSAL_TRENCH_ID, 'abysal-trench-f1').ok, false);
  travel(hero, SUNKEN_ID);
  Object.assign(hero, DEEP_OCEAN_GATE);
  assert.ok(travel(hero, DEEP_OCEAN_ID, 'deep-ocean-g7').ok);
  assert.equal(travel(hero, ABYSAL_TRENCH_ID, 'abysal-trench-f1').ok, false);
  Object.assign(hero, ABYSAL_TRENCH_GATE);
  assert.deepEqual(ABYSAL_TRENCH_GATE, { x: 187.5, z: -437.5 });
  assert.equal(travel(hero, ABYSAL_TRENCH_ID).ok, false);
  assert.equal(travel(hero, ABYSAL_TRENCH_ID, 'return-sunken').ok, false);
  hero.level = 31;
  assert.match(travel(hero, ABYSAL_TRENCH_ID, 'abysal-trench-f1').reason, /32/);
  hero.level = 32;
  assert.ok(travel(hero, ABYSAL_TRENCH_ID, 'abysal-trench-f1').ok);
  assert.deepEqual({ x: hero.x, z: hero.z }, ABYSAL_TRENCH_ENTRY);
  assert.equal(fieldSpawns(FIELDS[ABYSAL_TRENCH_ID]).length, 201);
  Object.assign(hero, { x: 90, z: -370 });
  const restored = parseSave(JSON.stringify(hero))!;
  assert.equal(restored.currentField, ABYSAL_TRENCH_ID);
  assert.deepEqual({ x: restored.x, z: restored.z }, { x: 90, z: -370 });
  assert.ok(abysalTrenchGroundHeight(restored.x, restored.z) < -1500);
  Object.assign(hero, ABYSAL_TRENCH_PORTALS[0]);
  assert.ok(travel(hero, DEEP_OCEAN_ID, 'return-deep-ocean-f1').ok);
  assert.deepEqual({ x: hero.x, z: hero.z }, ABYSAL_TRENCH_RETURN);
  assert.ok(
    Math.hypot(hero.x - ABYSAL_TRENCH_GATE.x, hero.z - ABYSAL_TRENCH_GATE.z) >
      4.5,
  );
  assert.ok(DEEP_OCEAN_PORTALS.every((p) => deepOceanWalkable(p)));
});

await test('Deep Ocean arrives at northern depth with a short gentle descent and a flat basin', () => {
  for (let x = -490; x <= 490; x += 35) {
    let previous = deepOceanGroundHeight(x, 500);
    assert.ok(previous < -765 && previous > -767);
    for (let z = 490; z >= -500; z -= 10) {
      const height = deepOceanGroundHeight(x, z);
      if (z <= 180)
        assert.ok(Math.abs(height + 780) <= 0.25, 'broad flat abyssal floor');
      assert.ok(Math.abs(previous - height) < 1.3, 'short gentle landing ramp');
      previous = height;
    }
  }
  for (const x of [62.5, 187.5]) {
    assert.ok(deepOceanGroundHeight(x, -650) < -1450);
    assert.ok(
      deepOceanGroundHeight(x, -650) < deepOceanGroundHeight(-250, -650) - 500,
    );
    assert.ok(
      Math.abs(
        deepOceanGroundHeight(x, -500.01) - deepOceanGroundHeight(x, -499.99),
      ) < 0.02,
    );
    assert.equal(deepOceanWalkable({ x, z: -501 }), false);
  }
});
await test('tectonic corridor, boss basin and old save recovery use the visible plate boundary', () => {
  const nav = new SunkenNavigation(abysalTrenchWalkable, ABYSAL_TRENCH_ENTRY);
  const route = [...ABYSAL_TRENCH_PATH, ABYSAL_TRENCH_ARENA];
  assert.ok(
    nav.valid(ABYSAL_TRENCH_ENTRY) && nav.valid(ABYSAL_TRENCH_PORTALS[0]),
  );
  for (let i = 1; i < route.length; i++)
    assert.ok(nav.clear(route[i - 1], route[i], 6));
  assert.ok(abysalTrenchGroundHeight(0, 320) < -1780);
  assert.ok(Math.abs(abysalTrenchFloorHeight(-85, 170) + 1800) < 0.25);
  assert.ok(
    abysalTrenchGroundHeight(65, 325) - abysalTrenchFloorHeight(65, 325) > 60,
  );
  const blocked = nav.move({ x: 0, z: 300 }, 400, 0);
  assert.ok(blocked.x < 30 && nav.valid(blocked));
  assert.ok(!nav.valid({ x: 65, z: 300 }));
  let area = 0;
  for (let x = -495; x < 500; x += 10)
    for (let z = -495; z < 500; z += 10) if (nav.valid({ x, z })) area += 100;
  assert.ok(area > 280000 && area < 400000, `corridor area ${area}`);
  const hero = freshHero();
  Object.assign(hero, {
    level: 32,
    inCity: false,
    currentField: ABYSAL_TRENCH_ID,
    x: 350,
    z: 0,
  });
  assert.ok(nav.valid(parseSave(JSON.stringify(hero))!));
  assert.equal(fieldSpawns(FIELDS[ABYSAL_TRENCH_ID]).length, 201);
  assert.equal(FIELDS[ABYSAL_TRENCH_ID].fieldBoss?.level, 60);
  assert.ok(nav.valid(ABYSAL_TRENCH_ARENA, 6));
});
await test('removed statues and masonry leave traversable clearings without ghost colliders', () => {
  const nav = new SunkenNavigation();
  for (const p of SUNKEN_CLEARINGS) {
    const from = { x: p.x - 2, z: p.z },
      to = { x: p.x + 2, z: p.z };
    assert.ok(nav.clear(from, to));
    assert.ok(Math.abs(nav.move(from, 4, 0).x - to.x) < 1e-6);
    const y = sunkenGroundHeight(p.x, p.z) + 2;
    assert.equal(sunkenCameraDistance({ ...from, y }, { ...to, y }), 4);
  }
});
await test('hunting homes are stable, separated, safe and within the level band', () => {
  const spawns = fieldSpawns(FIELDS[SUNKEN_ID]);
  assert.deepEqual(spawns, fieldSpawns(FIELDS[SUNKEN_ID]));
  assert.equal(new Set(spawns.map((p) => p.id)).size, spawns.length);
  assert.equal(
    spawns.filter((p) => p.definition.variant === 'normal').length,
    306,
  );
  assert.equal(
    spawns.filter((p) => p.definition.variant === 'elite').length,
    17,
  );
  assert.equal(spawns.filter((p) => p.definition.variant === 'boss').length, 1);
  assert.deepEqual(
    { x: spawns.at(-1)!.x, z: spawns.at(-1)!.z },
    SUNKEN_BOSS_HOME,
  );
  for (const p of spawns) {
    assert.ok(p.definition.level >= 32 && p.definition.level <= 42);
    assert.ok(sunkenWalkable(p, 3));
    assert.ok(sunkenInsideWall(p, 24));
    assert.equal(isFieldSafe(SUNKEN_ID, p.x, p.z, 24), false);
    assert.notEqual(
      monsterRespawnKey(p.definition.id, p.id, SUNKEN_ID),
      `${p.definition.id}:spawn:${p.id}`,
    );
  }
  for (const p of sunkenPopulation())
    for (const q of sunkenPopulation())
      if (p.id !== q.id)
        assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= SUNKEN_HOME_SPACING);
  // Finite-difference continuity across the depth contour and slope blend endpoints.
  for (let z = 430; z < 600; z += 0.25)
    assert.ok(
      Math.abs(
        sunkenGroundHeight(-100, z + 0.01) - sunkenGroundHeight(-100, z),
      ) < 0.03,
    );
});
await test('reef proxies remain solid for movement and local routing, with exact broad-phase queries', () => {
  const nav = new SunkenNavigation();
  assert.ok(SUNKEN_REEFS.filter((p) => p.radius > 0).length > 100);
  for (const p of SUNKEN_REEFS.filter((p) => p.radius > 0))
    assert.equal(nav.valid(p), false);
  for (let i = 0; i < 1000; i++) {
    const p = { x: Math.sin(i * 2.7) * 475, z: Math.cos(i * 1.7) * 475 },
      radius = [0.45, 2, 18][i % 3];
    assert.equal(
      sunkenCollisionFree(p, radius),
      SUNKEN_COLLIDERS.every(
        (o) => Math.hypot(p.x - o.x, p.z - o.z) >= o.radius + radius,
      ),
    );
  }
  let routed = 0;
  for (const reef of SUNKEN_REEFS.filter((p) => p.name === 'reef_cluster')) {
    const from = { x: reef.x - reef.radius - 2, z: reef.z },
      to = { x: reef.x + reef.radius + 2, z: reef.z };
    if (!nav.valid(from) || !nav.valid(to)) continue;
    assert.equal(nav.clear(from, to), false);
    const moved = nav.move(from, to.x - from.x, 0);
    assert.ok(nav.valid(moved) && moved.x < reef.x);
    const route = nav.route(from, to);
    if (
      !route.length ||
      Math.hypot(route.at(-1)!.x - to.x, route.at(-1)!.z - to.z) > 0.01
    )
      continue;
    let current = from;
    for (const p of route) {
      assert.ok(nav.clear(current, p));
      current = nav.move(current, p.x - current.x, p.z - current.z);
    }
    assert.ok(Math.hypot(current.x - to.x, current.z - to.z) < 0.01);
    if (++routed === 8) break;
  }
  assert.equal(routed, 8);
});
await test('swept movement and local obstacle routing retain the horizontal navigation plane', () => {
  const nav = new SunkenNavigation(),
    o = SUNKEN_OBSTACLES.find((p) => p.kind === 'pillar')!;
  const from = { x: o.x - 8, z: o.z },
    to = { x: o.x + 8, z: o.z };
  assert.ok(nav.valid(from) && nav.valid(to));
  assert.equal(nav.clear(from, to), false);
  const route = nav.route(from, to);
  assert.ok(route.length > 2);
  let p = from;
  for (const next of route) {
    assert.ok(nav.clear(p, next));
    p = nav.move(p, next.x - p.x, next.z - p.z);
    assert.ok(nav.valid(p));
  }
  assert.ok(Math.hypot(p.x - to.x, p.z - to.z) < 0.01);
  const swept = nav.move(from, 16, 0);
  assert.ok(nav.valid(swept));
  assert.ok(swept.x < o.x);
  assert.deepEqual(nav.restore({ x: NaN, z: Infinity }), SUNKEN_ENTRY);
  assert.ok(sunkenWalkable(nav.restore({ x: 499, z: -499 })));
});
await test('large map save retains coordinates and restores invalid points without touching progression', () => {
  const hero = freshHero();
  hero.level = 32;
  travel(hero, SUNKEN_ID);
  Object.assign(hero, SUNKEN_ZONES[4]);
  const restored = parseSave(JSON.stringify(hero))!;
  assert.equal(restored.currentField, SUNKEN_ID);
  assert.equal(restored.z, hero.z);
  assert.equal(restored.level, 32);
  assert.ok(
    sunkenWalkable(
      parseSave(JSON.stringify({ ...hero, x: Infinity, z: NaN }))!,
    ),
  );
});
await test('orbit still retracts before a retained solid pillar', () => {
  const p = SUNKEN_OBSTACLES.find((o) => o.kind === 'pillar')!;
  const y = sunkenGroundHeight(p.x, p.z) + 3;
  const focus = { x: p.x - 5, y, z: p.z },
    desired = { x: p.x + 5, y, z: p.z };
  assert.ok(sunkenCameraDistance(focus, desired) < 3);
});
await test('swim presentation preserves actor, action timing and both dagger attachment chains', () => {
  for (const gender of ['male', 'female'] as const) {
    const hero = freshHero();
    hero.gender = gender;
    hero.appearance.gender = gender;
    hero.coreJob = 'thief';
    hero.job = 'thief';
    for (const slot of ['mainHand', 'offHand'] as const) {
      const item = createItem('anom-dagger');
      hero.inventory.push(item);
      hero.equipment[slot] = item.id;
    }
    const model = createCharacterModel(hero, { aura: false }),
      anchor = new T.Vector3(45, sunkenGroundHeight(45, 225), 225);
    model.actor.position.copy(anchor);
    const motions = [
      {},
      { moving: true, localForward: 1 },
      { moving: true, localForward: -1 },
      { moving: true, localRight: 1 },
      { turn: 1 },
      { blocking: true },
      { dead: true },
    ];
    for (const motion of motions)
      for (let i = 0; i < 30; i++) {
        model.animator.update(1 / 60, {
          ...motion,
          movementMode: 'underwater',
        });
        assert.deepEqual(model.actor.position, anchor);
        for (const [slot, hand] of [
          ['mainHand', model.rig.rightHand],
          ['offHand', model.rig.leftHand],
        ] as const) {
          const grip = model.actor
            .getObjectByName(`equipment:${slot}`)!
            .getObjectByName('DaggerGrip')!;
          assert.ok(
            grip
              .getWorldPosition(new T.Vector3())
              .distanceTo(hand.getWorldPosition(new T.Vector3())) < 1e-6,
          );
        }
      }
    for (const action of [
      'basic_attack',
      'ranged_attack',
      'magic_cast',
      'dash',
      'hit',
    ] as const) {
      model.animator.play(action, 0.5);
      model.animator.update(0.2, { movementMode: 'underwater' });
      assert.equal(model.animator.snapshot().action, action);
      model.animator.update(0.31, { movementMode: 'underwater' });
      assert.equal(model.animator.snapshot().action, null);
    }
    assert.equal(model.animator.snapshot().swim, 1);
    model.animator.update(0.2, { movementMode: 'ground' });
    assert.equal(model.animator.snapshot().swim, 0);
    assert.equal(model.rig.root.rotation.x, 0);
    disposeCharacterModel(model.actor);
  }
});

await test('marine life stays in world space when player moves, turns or changes height', () => {
  const geometry = new T.BoxGeometry(),
    kit = new Map(['fish', 'jellyfish', 'ray'].map((n) => [n, geometry]));
  const vfx = createSunkenVfx(kit, 'high');
  const habitat = SUNKEN_HABITATS.reduce((best, h) =>
    Math.hypot(h.x - 45, h.z - 225) < Math.hypot(best.x - 45, best.z - 225)
      ? h
      : best,
  );
  const capture = () => {
    const poses = new Map<string, number[]>();
    vfx.root.traverse((o) => {
      if (!(o instanceof T.InstancedMesh) || !o.userData.marineIds) return;
      const matrix = new T.Matrix4();
      o.userData.marineIds.forEach((id: string, i: number) => {
        o.getMatrixAt(i, matrix);
        poses.set(id, matrix.toArray());
      });
    });
    return poses;
  };
  vfx.update({ ...habitat, y: 0 }, 0.1);
  const before = capture();
  vfx.update({ x: habitat.x + 20, z: habitat.z + 10, y: 80 }, 0);
  const moved = capture();
  const shared = [...before.keys()].filter((id) => moved.has(id));
  assert.ok(shared.length >= 10);
  for (const id of shared)
    assert.deepEqual(
      moved.get(id),
      before.get(id),
      `${id} translated with observer`,
    );
  vfx.update({ x: habitat.x + 20, z: habitat.z + 10 }, 0.1);
  const advanced = capture();
  for (const id of shared.filter((id) => !id.startsWith('jellyfish'))) {
    const start = new T.Matrix4().fromArray(moved.get(id)!);
    const end = new T.Matrix4().fromArray(advanced.get(id)!);
    const travel = new T.Vector3()
      .setFromMatrixPosition(end)
      .sub(new T.Vector3().setFromMatrixPosition(start));
    travel.y = 0;
    const heading = (
      id.startsWith('fish') ? new T.Vector3(-1, 0, 0) : new T.Vector3(0, 0, 1)
    ).transformDirection(start);
    assert.ok(heading.dot(travel.normalize()) > 0.999, `${id} swims backwards`);
  }
  assert.ok(
    shared.some(
      (id) =>
        JSON.stringify(advanced.get(id)) !== JSON.stringify(moved.get(id)),
    ),
  );
  vfx.setQuality('office');
  vfx.update(habitat, 0);
  assert.ok(vfx.metrics().fish <= 24);
  let borrowedDisposed = 0;
  geometry.addEventListener('dispose', () => borrowedDisposed++);
  vfx.dispose();
  assert.equal(borrowedDisposed, 0);
  geometry.dispose();
});

await test('monsters cannot leave the wall through player openings, including swept knockback', () => {
  const player = new SunkenNavigation(),
    monster = new SunkenNavigation(sunkenMonsterWalkable, SUNKEN_BOSS_HOME);
  let checked = 0;
  for (const gate of SUNKEN_WALL.openings) {
    const l = Math.hypot(gate.x, gate.z + 50),
      dx = gate.x / l,
      dz = (gate.z + 50) / l;
    const from = { x: gate.x - dx * 10, z: gate.z - dz * 10 },
      to = { x: gate.x + dx * 12, z: gate.z + dz * 12 };
    if (!monster.valid(from) || !player.clear(from, to)) continue;
    const p = player.move(from, dx * 22, dz * 22),
      m = monster.move(from, dx * 22, dz * 22, 0.55);
    assert.ok(Math.hypot(p.x - to.x, p.z - to.z) < 0.01);
    assert.ok(sunkenInsideWall(m, 3));
    assert.ok(monster.valid(m));
    const route = monster.route(from, to);
    assert.ok(route.every((p) => monster.valid(p)));
    checked++;
  }
  assert.ok(checked >= 4, `only ${checked} checked gates`);
  const census = sunkenPopulationMetrics();
  assert.ok(census.usableArea > 300000);
  assert.equal(census.normals + census.elites + census.bosses, 324);
});
