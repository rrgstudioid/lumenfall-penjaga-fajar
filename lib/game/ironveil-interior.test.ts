import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MINE_ID,
  MINE_ENTRY,
  MINE_EXIT,
  MINE_ROOMS,
  MINE_ROUTES,
  MINE_CURVES,
  MINE_BLOCKERS,
  MINE_BRIDGE,
  MineNavigation,
  mineShell,
  mineGroundHeight,
  mineCeiling,
  mineWalkable,
  mineDistance,
  mineLanterns,
  minePoint,
  mineGrid,
  MINE_CELLS,
} from './ironveil-interior-layout.ts';
import { IRONVEIL_ID, IRONVEIL_TRANSITION } from './ironveil-mines-layout.ts';
import { FIELDS, travel } from './regions.ts';
import { fieldSpawns } from './field-layout.ts';
import { freshHero, parseSave } from './rules.ts';

await test('sub-map identity, door contract and exterior population are independent', () => {
  assert(!FIELDS[MINE_ID]);
  assert.equal(MINE_ROOMS.length, 14);
  assert.deepEqual(MINE_ENTRY, { x: 0, z: 436 });
  assert.deepEqual(MINE_EXIT, { x: 0, z: 450 });
  assert.deepEqual(IRONVEIL_TRANSITION.interiorArrival, MINE_ENTRY);
  assert.deepEqual(IRONVEIL_TRANSITION.interiorReturnDoor, MINE_EXIT);
  assert.equal(fieldSpawns(FIELDS[IRONVEIL_ID]).length, 129);
});
await test('closed floor footprint stays inside 1000 units and retains the planned floor allocation', () => {
  const shell = mineShell();
  assert(shell.area > 250000 && shell.area < 290000);
  for (const tri of shell.floors)
    for (const p of tri) {
      assert(Math.abs(p.x) <= 500 && Math.abs(p.z) <= 500);
      assert(Math.abs(mineGroundHeight(p.x, p.z) - p.y) < 0.0001);
    }
  assert(shell.boundary.length > 1000);
});
await test('every route and all fourteen rooms connect for both actor radii', () => {
  for (const radius of [0.45, 1.8]) {
    const nav = new MineNavigation();
    for (const route of MINE_CURVES) {
      let p = route.id === 'main' ? MINE_ENTRY : route.points[0];
      assert(nav.valid(p, radius), route.id + ' start');
      for (const target of route.points.slice(1)) {
        const result = nav.move(p, target.x - p.x, target.z - p.z, radius);
        assert(
          Math.hypot(result.x - target.x, result.z - target.z) < 0.1,
          route.id +
            ' disconnected ' +
            JSON.stringify({ p, target, result, radius }),
        );
        p = result;
      }
    }
    for (const room of MINE_ROOMS) assert(nav.valid(room, radius), room.id);
  }
});
await test('hierarchy stays broad, chambers open, and floor grades gentle', () => {
  for (const route of MINE_ROUTES) assert([18, 24, 32].includes(route.width));
  for (const room of MINE_ROOMS) {
    const covered = MINE_BLOCKERS.filter(
      (p) =>
        Math.hypot(
          (p.x - room.x) / (room.width / 2),
          (p.z - room.z) / (room.depth / 2),
        ) < 1,
    ).reduce((s, p) => s + Math.PI * p.radius * p.radius, 0);
    assert(covered < ((Math.PI * room.width * room.depth) / 4) * 0.2);
    assert(
      mineCeiling(room.x, room.z) - mineGroundHeight(room.x, room.z) >=
        room.ceiling,
    );
  }
  for (const route of MINE_CURVES)
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1],
        b = route.points[i],
        n = Math.ceil(Math.hypot(a.x - b.x, a.z - b.z));
      let prev = mineGroundHeight(a.x, a.z);
      for (let j = 1; j <= n; j++) {
        const x = a.x + ((b.x - a.x) * j) / n,
          z = a.z + ((b.z - a.z) * j) / n,
          y = mineGroundHeight(x, z);
        assert(Math.abs(y - prev) < Math.tan((8 * Math.PI) / 180) * 1.1);
        prev = y;
      }
    }
});
await test('swept motion cannot cross stone, local props or bridge sides', () => {
  const nav = new MineNavigation();
  for (const angle of Array.from(
    { length: 32 },
    (_, i) => (i * Math.PI) / 16,
  )) {
    const q = nav.move(
      MINE_ENTRY,
      Math.cos(angle) * 1200,
      Math.sin(angle) * 1200,
    );
    assert(nav.valid(q));
  }
  for (const p of MINE_BLOCKERS) {
    const start = nav.restore({ x: p.x - p.radius - 3, z: p.z });
    const q = nav.move(start, p.radius * 2 + 6, 0);
    assert(nav.valid(q));
    assert(Math.hypot(q.x - p.x, q.z - p.z) >= p.radius + 0.44);
  }
  const b = nav.move(MINE_BRIDGE, 100 / Math.SQRT2, 100 / Math.SQRT2);
  assert(Math.hypot(b.x - MINE_BRIDGE.x, b.z - MINE_BRIDGE.z) < 10);
  assert(!mineWalkable(minePoint(500, 980)));
  assert(mineDistance(490, -490) < 0);
});
await test('teleport denied in both directions, reload and corrupt positions remain interior', () => {
  const h = freshHero();
  h.level = 8;
  travel(h, IRONVEIL_ID);
  assert(!travel(h, MINE_ID).ok);
  h.interiorId = MINE_ID;
  Object.assign(h, MINE_ROOMS[6]);
  const previous = { x: h.x, z: h.z };
  for (const id of ['averion', IRONVEIL_ID, 'verdant-plains-v2', MINE_ID])
    assert(!travel(h, id).ok);
  const loaded = parseSave(JSON.stringify(h))!;
  assert.equal(loaded.interiorId, MINE_ID);
  assert.deepEqual({ x: loaded.x, z: loaded.z }, previous);
  assert.equal(loaded.version, 3);
  for (const bad of [
    { x: NaN, z: Infinity },
    { x: 9000, z: -2000 },
    { x: 490, z: 490 },
  ]) {
    Object.assign(h, bad);
    const recovered = parseSave(JSON.stringify(h))!;
    assert.equal(recovered.interiorId, MINE_ID);
    assert(mineWalkable(recovered));
  }
  delete h.interiorId;
  Object.assign(h, IRONVEIL_TRANSITION.returnAnchor);
  assert.equal(parseSave(JSON.stringify(h))!.interiorId, undefined);
});
await test('lantern budget and entrance safety', () => {
  assert(mineLanterns().length <= 280);
  assert(mineLanterns().length > 200);
  assert(
    !MINE_BLOCKERS.some(
      (p) => Math.hypot(p.x - MINE_ENTRY.x, p.z - MINE_ENTRY.z) < 28,
    ),
  );
});

await test('floor topology has exactly five main loops plus two physical shortcuts', () => {
  const distance = mineGrid().distance,
    stride = MINE_CELLS + 1,
    seen = new Uint8Array(distance.length);
  let enclosed = 0;
  for (let start = 0; start < distance.length; start++) {
    if (seen[start] || distance[start] >= 0) continue;
    const queue = [start];
    seen[start] = 1;
    let outer = false;
    for (let i = 0; i < queue.length; i++) {
      const q = queue[i],
        x = q % stride,
        z = Math.floor(q / stride);
      if (x === 0 || z === 0 || x === stride - 1 || z === stride - 1)
        outer = true;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (x + dx < 0 || x + dx >= stride || z + dz < 0 || z + dz >= stride)
          continue;
        const n = q + dx + dz * stride;
        if (!seen[n] && distance[n] < 0) {
          seen[n] = 1;
          queue.push(n);
        }
      }
    }
    if (!outer) enclosed++;
  }
  assert.equal(enclosed, 7);
});

await test('dense interior population covers all rooms and levels without sharing exterior identities', async () => {
  const { mineMonsterSpawns, mineSafe } =
    await import('./ironveil-interior-population.ts');
  const spawns = mineMonsterSpawns(),
    nav = new MineNavigation();
  assert.equal(spawns.length, 480);
  assert.equal(new Set(spawns.map((p) => p.id)).size, 480);
  assert.deepEqual(
    [...new Set(spawns.map((p) => p.definition.level))].sort((a, b) => a - b),
    Array.from({ length: 13 }, (_, i) => 12 + i),
  );
  for (const p of spawns) {
    assert(nav.valid(p, 3));
    assert(!mineSafe(p, 16));
    assert(p.definition.id.startsWith(MINE_ID));
    assert.equal(p.definition.variant, 'normal');
  }
  for (const r of MINE_ROOMS)
    assert(
      spawns.filter(
        (p) =>
          Math.hypot((p.x - r.x) / (r.width / 2), (p.z - r.z) / (r.depth / 2)) <
          1,
      ).length >= 5,
      r.id,
    );
  for (let i = 0; i < spawns.length; i++)
    for (let j = i + 1; j < spawns.length; j++)
      assert(
        Math.hypot(spawns[i].x - spawns[j].x, spawns[i].z - spawns[j].z) >= 10,
      );
  assert.equal(fieldSpawns(FIELDS[IRONVEIL_ID]).length, 129);
});
await test('interior monsters cannot be knocked through walls or into the entrance safe area', async () => {
  const { mineMonsterSpawns, moveMineMonster, mineSafe } =
    await import('./ironveil-interior-population.ts');
  const nav = new MineNavigation();
  for (const p of mineMonsterSpawns().filter((_, i) => i % 17 === 0))
    for (const [dx, dz] of [
      [150, 0],
      [-150, 90],
      [0, 150],
      [0, -150],
    ]) {
      const q = moveMineMonster(p, dx, dz);
      assert(nav.valid(q, 0.55));
      assert(!mineSafe(q, 0.55));
    }
  const q = moveMineMonster({ x: 0, z: 390 }, 0, 70);
  assert(q.z < MINE_ENTRY.z - 28);
});
await test('rail gauge is continuous through corners and sleepers retain uniform spacing', async () => {
  const { MINE_RAIL_SECTIONS, railSleepers } =
    await import('./ironveil-interior-rails.ts');
  for (const sections of MINE_RAIL_SECTIONS) {
    for (let i = 1; i < sections.length; i++) {
      const a = sections[i - 1],
        b = sections[i];
      assert(b.distance > a.distance);
      assert(b.distance - a.distance <= 2.001);
      assert(Math.hypot(b.nx, b.nz) < 1.2);
      if (b.z < 447) assert(mineDistance(b.x, b.z) > 2);
      const dx = (b.x - a.x) / (b.distance - a.distance),
        dz = (b.z - a.z) / (b.distance - a.distance);
      assert(Math.abs((-dz * b.nx + dx * b.nz) * 2.8 - 2.8) < 0.001);
    }
    const sleepers = railSleepers(sections);
    for (let i = 1; i < sleepers.length; i++)
      assert(
        Math.abs(sleepers[i].distance - sleepers[i - 1].distance - 2.6) <
          0.00001,
      );
  }
});

await test('all lanterns hang above the floor from rock or existing timber',()=>{
  const lights=mineLanterns();assert(lights.some(l=>l.support==='wall'));assert(lights.some(l=>l.support==='beam'));
  for(const l of lights){
    assert(l.y-mineGroundHeight(l.x,l.z)>6.5);
    assert(l.mount.y>l.y+.7);
    assert(l.y+1<mineCeiling(l.x,l.z));
    if(l.support==='wall')assert(mineDistance(l.mount.x,l.mount.z)<.1);
    else assert(Math.hypot(l.mount.x-l.x,l.mount.z-l.z)<.001);
  }
});
