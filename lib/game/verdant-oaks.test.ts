import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { PLAINS_OAKS } from './verdant-plains-oaks.ts';
import { PLAINS_SPAWN_LAYOUT } from './verdant-plains-spawn-layout.ts';
import { oakLod } from './verdant-oak-lod.ts';
import * as L from './verdant-plains-layout.ts';
import { fieldSpawns } from './field-layout.ts';
import { FIELDS } from './regions.ts';
import { freshHero, parseSave } from './rules.ts';
const baseline = JSON.parse(
  readFileSync(
    new URL('../../tests/fixtures/oak/legacy-layout.json', import.meta.url),
    'utf8',
  ),
);
const zones: Record<string, number[]> = {
  camp: [60, 210, 335, 630, 4],
  northwest: [90, 425, 60, 290, 5],
  'central-west': [230, 455, 295, 555, 4],
  averion: [445, 740, 35, 185, 4],
  'clearing-east': [680, 820, 200, 385, 3],
  northeast: [760, 900, 60, 195, 3],
  southeast: [690, 885, 540, 790, 4],
  coast: [340, 670, 665, 810, 3],
};

await test('exactly 30 static oak IDs, zone quotas and 10/10/10 variants replace all old trees', () => {
  assert.equal(PLAINS_OAKS.length, 30);
  assert.equal(new Set(PLAINS_OAKS.map((p) => p.id)).size, 30);
  assert.deepEqual(
    PLAINS_OAKS.map((p) => p.id),
    Array.from(
      { length: 30 },
      (_, i) => 'oak-' + String(i + 1).padStart(3, '0'),
    ),
  );
  assert.equal(L.plainsProps().filter((p) => p.kind === 'oak').length, 30);
  assert.equal(
    L.plainsProps().filter((p) => p.kind === 'fir' || p.kind === 'tree').length,
    0,
  );
  assert.deepEqual(
    [0, 1, 2].map((v) => PLAINS_OAKS.filter((p) => p.variant === v).length),
    [10, 10, 10],
  );
  for (const [zone, [u0, u1, v0, v1, count]] of Object.entries(zones)) {
    const trees = PLAINS_OAKS.filter((p) => p.zone === zone);
    assert.equal(trees.length, count, zone);
    assert.ok(trees.filter((p) => p.landmark).length <= 1);
    for (const p of trees) {
      assert.ok(
        p.x + 500 >= u0 &&
          p.x + 500 <= u1 &&
          p.z + 500 >= v0 &&
          p.z + 500 <= v1,
      );
      assert.ok(p.scale >= 0.86 * 1.35 && p.scale <= 1.18 * 1.35);
      if (p.landmark) assert.equal(p.scale, 1.18 * 1.35);
    }
  }
});
await test('all 497 spawn identities, coordinates and species plus all 509 retained decorations match baseline', () => {
  assert.deepEqual(PLAINS_SPAWN_LAYOUT, baseline.spawns);
  assert.deepEqual(
    fieldSpawns(FIELDS[L.PLAINS_ID]).map((p) => ({
      id: p.id,
      x: p.x,
      z: p.z,
      speciesId: p.definition.id,
      rank: p.definition.rank,
    })),
    baseline.spawns,
  );
  for (const kind of ['rock', 'shrub'])
    assert.deepEqual(
      L.plainsProps().filter((p) => p.kind === kind),
      baseline.props.filter((p: { kind: string }) => p.kind === kind),
    );
});
await test('30 enlarged canopies respect protected areas, grove spacing, terrain slopes and existing decorations', () => {
  for (const p of PLAINS_OAKS) {
    const R = p.canopyRadius;
    assert.ok(L.plainsRoadDistance(p) >= R + 4, p.id + ' road');
    assert.ok(L.plainsRiverDistance(p) >= R + 6, p.id + ' river');
    assert.ok(L.plainsCoast(p.x) - p.z >= R + 10, p.id + ' coast');
    assert.ok(!L.plainsSafe(p, R + 20));
    assert.ok(
      Math.hypot(p.x - L.PLAINS_EXIT.x, p.z - L.PLAINS_EXIT.z) >= R + 30,
    );
    assert.ok(
      Math.hypot(p.x - L.PLAINS_CLEARING.x, p.z - L.PLAINS_CLEARING.z) >=
        R + 68,
    );
    for (const q of L.PLAINS_POCKETS)
      assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= q.radius + R + 8);
    for (const q of PLAINS_SPAWN_LAYOUT)
      assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= 10);
    for (const q of L.plainsProps().filter(
      (q) => q.kind === 'rock' || q.kind === 'shrub',
    ))
      assert.ok(
        Math.hypot(p.x - q.x, p.z - q.z) >=
          p.radius + (q.kind === 'rock' ? q.radius : q.scale * 1.4),
      );
    const h = L.plainsTerrainHeight(p.x, p.z);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      assert.ok(
        Math.abs(
          L.plainsTerrainHeight(p.x + Math.cos(a) * 2, p.z + Math.sin(a) * 2) -
            h,
        ) <=
          Math.tan(Math.PI / 15) * 2,
      );
    }
    for (const q of PLAINS_OAKS)
      if (q.id !== p.id) {
        const same = p.group === q.group;
        assert.ok(
          Math.hypot(p.x - q.x, p.z - q.z) >=
            (R + q.canopyRadius) * (same ? 0.8 : 1) + (same ? 0 : 30),
          p.id + ' spacing ' + q.id,
        );
      }
  }
  // Sum of disks is a conservative upper bound even where crowns overlap.
  let area = 0;
  for (let x = -498; x < 498; x += 4)
    for (let z = -498; z < 498; z += 4)
      if (L.plainsWalkable({ x, z })) area += 16;
  assert.ok(
    PLAINS_OAKS.reduce((s, p) => s + Math.PI * p.canopyRadius ** 2, 0) / area <
      0.1,
  );
});
await test('walking/dash stop at trunks and old saves inside a new trunk recover locally', () => {
  const nav = new L.PlainsNavigation();
  for (const p of PLAINS_OAKS) {
    assert.equal(nav.valid(p), false);
    const recovered = nav.restore(p);
    assert.ok(nav.valid(recovered));
    assert.ok(Math.hypot(p.x - recovered.x, p.z - recovered.z) <= 10);
    const start = { x: p.x - 4, z: p.z };
    if (nav.valid(start)) {
      const moved = nav.move(start, 8, 0);
      assert.ok(moved.x < p.x);
      assert.ok(nav.valid(moved));
    }
  }
  const hero = freshHero();
  Object.assign(hero, {
    inCity: false,
    currentField: L.PLAINS_ID,
    ...PLAINS_OAKS[0],
  });
  const restored = parseSave(JSON.stringify(hero))!;
  assert.ok(nav.valid(restored));
  assert.ok(Math.hypot(restored.x - hero.x, restored.z - hero.z) <= 10);
  assert.deepEqual(nav.restore({ x: NaN, z: Infinity }), L.PLAINS_ENTRY);
});
await test('screen LOD has 15% hysteresis and Light never uses LOD0', () => {
  assert.equal(oakLod(550, 1, false), 1);
  assert.equal(oakLod(580, 1, false), 0);
  assert.equal(oakLod(440, 0, false), 0);
  assert.equal(oakLod(420, 0, false), 1);
  assert.equal(oakLod(900, 3, true), 1);
  assert.equal(oakLod(40, 0, false), 3);
  assert.equal(oakLod(75, 3, false), 3);
  assert.equal(oakLod(81, 3, false), 2);
});
await test('runtime asset package, materials, LODs and shadow proxies obey budgets', () => {
  const dir = new URL(
    '../../public/assets/maps/verdant-plains-v2/oak/',
    import.meta.url,
  );
  const gltf = JSON.parse(readFileSync(new URL('oak.gltf', dir), 'utf8'));
  assert.equal(gltf.materials.length, 2);
  const counts = new Map<string, number>();
  for (const n of gltf.nodes) {
    if (n.mesh === undefined) continue;
    const m = n.name.match(/Oak(\d)_L(\d)_/);
    assert.ok(m);
    const key = m[1] + ':' + m[2],
      tri = gltf.meshes[n.mesh].primitives.reduce(
        (s: number, p: { indices: number }) =>
          s + gltf.accessors[p.indices].count / 3,
        0,
      );
    counts.set(key, (counts.get(key) ?? 0) + tri);
  }
  for (let v = 0; v < 3; v++)
    for (const [l, max] of [
      [0, 28000],
      [1, 12000],
      [2, 3500],
      [4, 1500],
      [5, 2500],
    ])
      assert.ok(counts.get(v + ':' + l)! <= max);
  for (const im of gltf.images)
    assert.ok(statSync(new URL(im.uri, dir)).size > 0);
  const bytes = readdirSync(dir).reduce(
    (s, n) => s + statSync(new URL(n, dir)).size,
    0,
  );
  assert.ok(bytes <= 16 * 1024 ** 2, 'package ' + bytes);
});
