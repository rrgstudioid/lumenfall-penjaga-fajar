import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WILDS_ID,
  WILDS_ALTAR,
  WILDS_ENTRY,
  WILDS_BOUNDS,
  WILDS_PATHS,
  WILDS_RIVER,
  WILDS_TRIBUTARIES,
  WILDS_NORTH_SEA_LEVEL,
  WILDS_SOUTH_SEA_LEVEL,
  WILDS_SOUTH_MOUTH_Z,
  wildsUplandHeight,
  wildsWaterLevel,
  WILDS_BRIDGES,
  WILDS_FALLS,
  WILDS_PORTALS,
  WILDS_LANDMARKS,
  WILDS_LAKE_ISLAND,
  WILDS_CLEARINGS,
  wildsOpenAreaStats,
  wildsProps,
  wildsArchitectureObstacles,
  wildsGroundHeight,
  wildsRawHeight,
  wildsHeightfield,
  wildsTerrainHeight,
  wildsWater,
  wildsIslandDistance,
} from './whispering-wilds-layout.ts';
import { WildsNavigation } from './whispering-wilds-navigation.ts';
import {
  FIELDS,
  CITIES,
  FIELD_NPCS,
  travel,
  WILDS_LEGACY_CONTENT,
} from './regions.ts';
import {
  fieldSpawns,
  isFieldSafe,
  monsterRespawnKey,
  restoreRespawnDeadline,
} from './field-layout.ts';
import {
  wildsPopulation,
  WILDS_BOSS_HOME,
} from './whispering-wilds-population.ts';
import { freshHero, parseSave } from './rules.ts';
import { createPlainsSky } from './verdant-plains-sky.ts';
import { createWildsVfx, fireflyColorIndex } from './whispering-wilds-vfx.ts';
import {
  WILDS_QUALITY,
  WILDS_GRASS_RENDER,
} from './whispering-wilds-quality.ts';
import {
  wildsMushroomGlow,
  WILDS_MUSHROOM_BREATH,
} from './whispering-wilds-mushrooms.ts';
import {
  createWildsGrass,
  wildsGrassGround,
  WILDS_GRASS_COLOR,
  WILDS_GRASS_EMISSION,
} from './whispering-wilds-grass.ts';
import * as T from 'three';
import { wildsMushrooms } from './whispering-wilds-mushroom-layout.ts';

await test('permanent hunting field replaces the retired entry and enforces level 16', () => {
  const f = FIELDS[WILDS_ID],
    h = freshHero();
  assert.equal(f.displayName, 'Whispering Wilds');
  assert.equal(f.minLevel, 16);
  assert.equal(f.fieldBoss?.level, 24);
  assert.equal(f.recommendedLevel, '16–24');
  assert.deepEqual(f.questList, []);
  assert.equal(FIELD_NPCS[WILDS_ID], undefined);
  assert.equal(FIELDS['whispering-wilds'], undefined);
  assert(!travel(h, WILDS_ID).ok);
  h.level = 15;
  assert(!travel(h, WILDS_ID).ok);
  h.level = 16;
  assert(travel(h, WILDS_ID).ok);
  assert(!travel(h, 'jayantara').ok);
  h.level = 24;
  assert(travel(h, 'jayantara').ok);
  for (const p of WILDS_PORTALS)
    assert(CITIES[p.destination].connectedFields.includes(WILDS_ID));
  travel(h, WILDS_ID);
  const restored = parseSave(JSON.stringify(h));
  assert(restored);
  assert.equal(restored.x, WILDS_ENTRY.x);
  assert.equal(restored.z, WILDS_ENTRY.z);
});
await test('1000-unit deterministic heightfield and main loop and city access support actor radii', () => {
  assert.equal(WILDS_BOUNDS.maxX - WILDS_BOUNDS.minX, 1000);
  assert.equal(wildsHeightfield().length, 513 * 513);
  assert.equal(wildsHeightfield(), wildsHeightfield());
  const nav = new WildsNavigation();
  assert(nav.valid(WILDS_ENTRY));
  for (const p of WILDS_PORTALS) assert(nav.valid(p, 1.8));
  for (const radius of [0.45, 0.55, 1.8])
    for (const [route, path] of WILDS_PATHS.entries().filter(
      ([i]) => i === 0 || i >= 6,
    ))
      for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1],
          b = path.points[i],
          steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2);
        for (let j = 0; j <= steps; j++) {
          const p = {
            x: a.x + ((b.x - a.x) * j) / steps,
            z: a.z + ((b.z - a.z) * j) / steps,
          };
          assert(
            nav.valid(p, radius),
            `route ${route}/${i}, radius ${radius}: ${JSON.stringify(p)}`,
          );
        }
      }
});
await test('water, bridges, restoration and swept movement use authoritative collision', () => {
  const nav = new WildsNavigation();
  const lake = { ...WILDS_LANDMARKS[1], z: WILDS_LANDMARKS[1].z + 100 };
  assert(!nav.valid(WILDS_LAKE_ISLAND));
  assert(nav.valid({ x: WILDS_LAKE_ISLAND.x + 22, z: WILDS_LAKE_ISLAND.z }));
  assert(!nav.valid(lake));
  assert(wildsWater(lake).distance < 0);
  for (const b of WILDS_BRIDGES) {
    assert(nav.valid(b, 1.8));
    assert.equal(wildsGroundHeight(b.x, b.z), b.height);
    const a = { x: b.x - b.axis.x * 25, z: b.z - b.axis.z * 25 },
      end = nav.move(a, b.axis.x * 50, b.axis.z * 50, 1.8);
    assert(
      Math.hypot(end.x - (a.x + b.axis.x * 50), end.z - (a.z + b.axis.z * 50)) <
        0.1,
    );
  }
  assert.deepEqual(nav.restore({ x: NaN, z: Infinity }), WILDS_ENTRY);
  assert(nav.valid(nav.restore(lake)));
  assert(
    wildsProps().every((p) => p.kind === 'rock'),
    'ordinary forest props remain removed',
  );
  const rock = wildsProps()[0];
  assert(!nav.valid(rock));
  assert(!nav.valid({ x: 499, z: 0 }));
});
await test('solid landmark supports block movement and the river has no waterfall drops', () => {
  const navigation = new WildsNavigation();
  for (const p of wildsArchitectureObstacles()) assert(!navigation.valid(p));
  assert.equal(WILDS_FALLS.length, 0);
});
await test('open gameplay terrain and combat cores retain gentle slopes', () => {
  const area = wildsOpenAreaStats();
  assert(area.openFraction >= 0.98, JSON.stringify(area));
  for (const c of WILDS_CLEARINGS)
    for (let z = c.z - c.rz; z < c.z + c.rz; z += 4)
      for (let x = c.x - c.rx; x < c.x + c.rx; x += 4) {
        if (
          Math.hypot((x - c.x) / c.rx, (z - c.z) / c.rz) > 0.75 ||
          wildsWater({ x, z }).distance < 15
        )
          continue;
        // Terrain slope; the raised altar has a separate 20 cm platform step.
        const h = wildsTerrainHeight(x, z),
          grade = Math.hypot(
            wildsTerrainHeight(x + 1, z) - h,
            wildsTerrainHeight(x, z + 1) - h,
          );
        assert(grade < Math.tan((5 * Math.PI) / 180), `${c.name}: ${grade}`);
      }
  const path = WILDS_PATHS[0];
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1],
      b = path.points[i],
      length = Math.hypot(b.x - a.x, b.z - a.z),
      steps = Math.ceil(length);
    let prev = wildsGroundHeight(a.x, a.z);
    for (let j = 1; j <= steps; j++) {
      const h = wildsGroundHeight(
        a.x + ((b.x - a.x) * j) / steps,
        a.z + ((b.z - a.z) * j) / steps,
      );
      // Raised dry shelves now approach the river through longer slopes.
      // Keep these traversable while preserving the flat clearing cores above.
      const z = a.z + ((b.z - a.z) * j) / steps;
      const limit = z > 100 ? 30 : 26;
      assert(
        Math.abs(h - prev) / (length / steps) <
          Math.tan((limit * Math.PI) / 180),
      );
      prev = h;
    }
  }
});

await test('E–G drains continuously to a southern sea mouth beyond the playable boundary', () => {
  const nav = new WildsNavigation();
  assert.equal(WILDS_FALLS.length, 0);
  assert(wildsUplandHeight(75) - wildsUplandHeight(470) > 50);
  for (let z = 110; z < WILDS_SOUTH_MOUTH_Z; z += 0.5) {
    const next = wildsWaterLevel(z + 0.5),
      here = wildsWaterLevel(z);
    assert(next <= here);
    assert(here - next < 0.09, `abrupt south-water step at ${z}`);
  }
  assert.equal(wildsWaterLevel(WILDS_SOUTH_MOUTH_Z), WILDS_SOUTH_SEA_LEVEL);
  assert(wildsWaterLevel(500) > WILDS_SOUTH_SEA_LEVEL + 15);
  for (let z = 501; z <= 800; z += 10)
    for (const x of [-100, -40, 0, 100]) assert(!nav.valid({ x, z }));
  for (const p of WILDS_RIVER.filter((p) => p.z >= 110)) {
    assert(wildsRawHeight(p.x, p.z) < wildsWater(p).height - 2.8);
  }
});

await test('southern scenery water matches boundary triangles and joins the map without a height seam', async () => {
  const { createWildsBoundary } =
    await import('./whispering-wilds-boundary.ts');
  const material = new T.MeshStandardMaterial(),
    texture = new T.Texture();
  const boundary = createWildsBoundary(material, texture, material);
  const water = boundary.root.getObjectByName(
    'Southern river continuation beyond G',
  ) as T.Mesh<T.BufferGeometry>;
  const terrain = boundary.root.getObjectByName(
    'Boundary hills 2',
  ) as T.Mesh<T.BufferGeometry>;
  const vertices = water.geometry.getAttribute('position');
  assert(vertices.count > 1000);
  const ray = new T.Raycaster(),
    hits: T.Intersection[] = [];
  let join = 0,
    mouth = 0;
  for (let i = 0; i < vertices.count; i += 3) {
    const p = new T.Vector3();
    for (let j = 0; j < 3; j++) {
      p.x += vertices.getX(i + j) / 3;
      p.y += vertices.getY(i + j) / 3;
      p.z += vertices.getZ(i + j) / 3;
      if (Math.abs(vertices.getZ(i + j) - 500) < 0.001) {
        const w = wildsWater({ x: vertices.getX(i + j), z: 500 });
        assert(Math.abs(vertices.getY(i + j) - w.height) < 0.02);
        join++;
      }
    }
    // Sample the actual rendered triangles, including the coarser scenery grid.
    if (i % 90 === 0) {
      ray.set(new T.Vector3(p.x, 100, p.z), new T.Vector3(0, -1, 0));
      hits.length = 0;
      ray.intersectObject(terrain, false, hits);
      assert(hits.length > 0);
      assert(p.y - hits[0].point.y > 0.035);
    }
    if (p.z > WILDS_SOUTH_MOUTH_Z - 15) mouth++;
  }
  assert(join > 10);
  assert(mouth > 10);
  boundary.geometries.forEach((g) => g.dispose());
  boundary.materials.forEach((m) => m.dispose());
  material.dispose();
  texture.dispose();
});
await test('night sky is opt-in and preserves existing day/dawn settings', () => {
  const texture = new T.Texture(),
    day = createPlainsSky(texture),
    dawn = createPlainsSky(texture, true),
    night = createPlainsSky(texture, false, true),
    chaotic = createPlainsSky(texture, false, true, texture);
  assert.equal(day.mesh.material.uniforms.uNight.value, 0);
  assert.equal(dawn.mesh.material.uniforms.uNight.value, 0);
  assert.equal(dawn.mesh.material.uniforms.uCold.value, 1);
  assert.equal(night.mesh.material.uniforms.uNight.value, 1);
  assert.equal(day.mesh.material.uniforms.uChaotic.value, 0);
  assert.equal(dawn.mesh.material.uniforms.uChaotic.value, 0);
  assert.equal(night.mesh.material.uniforms.uChaotic.value, 0);
  assert.equal(chaotic.mesh.material.uniforms.uChaotic.value, 1);
  assert.equal(chaotic.mesh.material.uniforms.uChaoticSky.value, texture);
  const camera = new T.PerspectiveCamera();
  camera.position.set(100, 40, -90);
  night.update(camera, 3);
  assert(night.mesh.position.equals(camera.position));
  chaotic.update(camera, 3);
  assert(chaotic.mesh.position.equals(camera.position));
  for (const s of [day, dawn, night, chaotic]) {
    s.mesh.geometry.dispose();
    s.mesh.material.dispose();
  }
  texture.dispose();
});
await test('local fireflies evenly cover the rainbow and preserve quality caps through movement', () => {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 700; i++) counts[fireflyColorIndex(i)]++;
  assert.deepEqual(counts, [100, 100, 100, 100, 100, 100, 100]);
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 1400),
    vfx = createWildsVfx('office');
  for (const quality of Object.keys(WILDS_QUALITY) as Array<
    keyof typeof WILDS_QUALITY
  >) {
    vfx.setQuality(quality);
    for (let k = 0; k < 80; k++) {
      const p = k < 40 ? WILDS_ENTRY : WILDS_LANDMARKS[0];
      camera.position.set(p.x, wildsGroundHeight(p.x, p.z) + 8, p.z + 12);
      camera.lookAt(p.x, 10, p.z);
      camera.updateMatrixWorld();
      vfx.update(camera, p, 0.1, 1);
      assert(vfx.metrics().activeFireflies <= WILDS_QUALITY[quality].fireflies);
    }
  }
  vfx.dispose();
  vfx.dispose();
  assert.equal(vfx.root.children.length, 0);
});

await test('water triangles stay above their submerged terrain without spanning waterfall drops', async () => {
  const { buildWildsWaterGeometry } =
    await import('./whispering-wilds-water.ts');
  const geometry = buildWildsWaterGeometry(),
    p = geometry.getAttribute('position');
  assert(p.count > 1000);
  for (let i = 0; i < p.count; i += 3) {
    const ys = [p.getY(i), p.getY(i + 1), p.getY(i + 2)];
    assert(Math.max(...ys) - Math.min(...ys) < 4);
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const y = ys.reduce((a, b) => a + b) / 3;
    assert(y - wildsTerrainHeight(x, z) > 0.035);
  }
  geometry.dispose();
});

await test('fireflies scatter on player contact, pause safely, and recover after departure', () => {
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 1400),
    vfx = createWildsVfx('office');
  const start = { x: -190, z: 280 };
  camera.position.set(
    start.x,
    wildsGroundHeight(start.x, start.z) + 12,
    start.z + 20,
  );
  camera.lookAt(start.x, wildsGroundHeight(start.x, start.z), start.z);
  camera.updateMatrixWorld();
  for (let i = 0; i < 30; i++) vfx.update(camera, start, 0.1, 1, true);
  const geometry = (vfx.root.children[0] as T.Points).geometry;
  const position = geometry.getAttribute('position'),
    fade = geometry.getAttribute('fade'),
    reaction = geometry.getAttribute('reaction');
  let index = -1;
  for (let i = 0; i < 700; i++)
    if (
      fade.getX(i) > 0.5 &&
      Math.hypot(position.getX(i) - start.x, position.getZ(i) - start.z) > 8
    ) {
      index = i;
      break;
    }
  assert(index >= 0);
  const contact = { x: position.getX(index), z: position.getZ(index) };
  const magnitude = () =>
    Math.hypot(
      reaction.getX(index),
      reaction.getY(index),
      reaction.getZ(index),
    );
  for (let i = 0; i < 12; i++) vfx.update(camera, contact, 1 / 60, 1, true);
  assert(magnitude() > 0.15, 'contact must visibly scatter the particle');
  assert(vfx.metrics().playerContacts > 0);
  const paused = magnitude();
  vfx.update(camera, contact, 0, 1, true);
  assert.equal(magnitude(), paused);
  for (let i = 0; i < 80; i++) vfx.update(camera, start, 0.05, 1, true);
  assert(magnitude() < 0.08, 'particle must return after the player leaves');
  vfx.setQuality('high');
  assert(reaction.array.every((n) => n === 0));
  vfx.dispose();
});

await test('Whispering sky uses only Chaotic Skies without a UDS sampler', async () => {
  const { createWildsSky } = await import('./whispering-wilds-sky.ts');
  const texture = new T.Texture(),
    sky = createWildsSky(texture);
  assert.equal(sky.mesh.material.uniforms.uChaoticSky.value, texture);
  assert.equal(sky.mesh.material.uniforms.uClouds, undefined);
  assert(!sky.mesh.material.fragmentShader.includes('uClouds'));
  assert(!sky.mesh.material.fragmentShader.includes('stars('));
  assert(!sky.mesh.material.fragmentShader.includes('moonDisc'));
  assert.equal(sky.mesh.material.uniforms.uSun, undefined);
  const camera = new T.PerspectiveCamera();
  camera.position.set(40, 20, 60);
  sky.update(camera, 10);
  assert(sky.mesh.position.equals(camera.position));
  sky.mesh.geometry.dispose();
  sky.mesh.material.dispose();
  texture.dispose();
});

await test('land borders rise into hills and the southern seabed descends', () => {
  assert(wildsRawHeight(-460, 0) > 50);
  assert(wildsRawHeight(0, -470) > 60);
  assert(wildsRawHeight(520, 0) > 50);
  assert(wildsRawHeight(0, 850) < -59);
});

await test('one descending main river connects the northern sea; loose rocks remain only at the boss clearing', () => {
  assert.equal(WILDS_TRIBUTARIES.length, 0);
  assert(WILDS_RIVER[0].z < -500);
  assert.equal(wildsWaterLevel(-500), WILDS_NORTH_SEA_LEVEL);
  assert.equal(wildsWaterLevel(-440), WILDS_NORTH_SEA_LEVEL);
  for (let i = 1; i < WILDS_RIVER.length; i++) {
    assert(WILDS_RIVER[i].z >= WILDS_RIVER[i - 1].z);
    assert(
      wildsWaterLevel(WILDS_RIVER[i].z) <=
        wildsWaterLevel(WILDS_RIVER[i - 1].z),
    );
  }
  for (let z = -500; z < 450; z += 10)
    assert(wildsUplandHeight(z) >= wildsUplandHeight(z + 10));
  const boss = WILDS_LANDMARKS.find((p) => p.name === 'Twilight Clearing')!;
  assert(wildsProps().length > 0);
  for (const p of wildsProps())
    assert(
      Math.hypot((p.x - boss.x) / boss.rx, (p.z - boss.z) / boss.rz) < 1.65,
    );
  for (let z = -650; z <= -400; z += 5)
    assert(wildsRawHeight(325, z) < WILDS_NORTH_SEA_LEVEL);
});

await test('wide central island is surrounded by blocked water and reached across its full bridge', () => {
  const nav = new WildsNavigation(),
    island = WILDS_LAKE_ISLAND,
    b = WILDS_BRIDGES.at(-1)!;
  assert.equal(b.length, 155);
  assert(!nav.valid(island));
  assert(nav.valid({ x: island.x + 22, z: island.z }));
  for (const radius of [0.45, 0.55, 1.8]) {
    const start = { x: b.x - b.length / 2 - 8, z: b.z };
    assert(nav.valid(start, radius));
    const end = nav.move(start, b.length + 16, 0, radius);
    assert(Math.abs(end.x - (b.x + b.length / 2 + 8)) < 0.1);
  }
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16,
      p = { x: island.x + Math.cos(a) * 110, z: island.z + Math.sin(a) * 95 };
    if (Math.abs(p.z - b.z) < 6 && p.x < island.x) continue;
    assert(wildsWater(p).distance < 0);
    assert(!nav.valid(p));
  }
  assert(wildsGroundHeight(225, -55) > wildsGroundHeight(island.x, island.z));
  // A bridge crosses a level river cross-section, rather than upstream water
  // cutting across one end of its horizontal deck.
  for (const b of WILDS_BRIDGES.slice(0, 3))
    for (const t of [-6, 0, 6]) {
      const w = wildsWater({ x: b.x + b.axis.x * t, z: b.z + b.axis.z * t });
      assert(Math.abs(w.height - (b.height - 4.8)) < 0.08);
    }
});

await test('northern river grade is continuous and joins its source sea and lake without drops', () => {
  assert.equal(wildsWaterLevel(-440), 48);
  assert.equal(wildsWaterLevel(-200), 12);
  for (let z = -500; z < -150; z += 0.25) {
    const a = wildsWaterLevel(z),
      b = wildsWaterLevel(z + 0.25);
    assert(b <= a);
    assert(a - b < 0.057);
    const before = (a - wildsWaterLevel(z - 0.25)) / 0.25;
    const after = (b - a) / 0.25;
    assert(Math.abs(after - before) < 0.002);
  }
});

await test('cut riverbanks remain above water and bridge grading joins the raised ground', () => {
  let samples = 0;
  for (let z = -490; z <= 700; z += 4)
    for (let x = -480; x <= 480; x += 4) {
      const p = { x, z },
        water = wildsWater(p);
      if (water.source !== 'river' || water.distance < 8 || water.distance > 35)
        continue;
      // Offshore seabed is intentionally submerged; scenery valley banks are not.
      if (z < 500 && wildsIslandDistance(p) > 0) continue;
      assert(wildsRawHeight(x, z) - water.height >= 3.49, JSON.stringify(p));
      samples++;
    }
  assert(samples > 3000);
  for (const b of WILDS_BRIDGES)
    for (const side of [-1, 1]) {
      const x = b.x + b.axis.x * (b.length / 2 + 0.2) * side;
      const z = b.z + b.axis.z * (b.length / 2 + 0.2) * side;
      assert(Math.abs(wildsTerrainHeight(x, z) - b.height) < 0.1);
    }
});

await test('one island elder reaches the northern peak with bounded geometry and blocked trunk', async () => {
  const { createWildsIconTree } =
    await import('./whispering-wilds-icon-tree.ts');
  const tree = createWildsIconTree(),
    nav = new WildsNavigation();
  tree.root.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(tree.root);
  assert(Math.abs(bounds.max.y - tree.metrics().peakElevation) < 0.01);
  assert(tree.metrics().height > 115);
  assert.equal(tree.root.position.x, WILDS_LAKE_ISLAND.x);
  assert.equal(tree.root.position.z, WILDS_LAKE_ISLAND.z);
  assert(!nav.valid(WILDS_LAKE_ISLAND));
  assert(nav.valid(nav.restore(WILDS_LAKE_ISLAND)));
  const start = { x: WILDS_LAKE_ISLAND.x - 25, z: WILDS_LAKE_ISLAND.z };
  const end = nav.move(start, 50, 0);
  assert(end.x < WILDS_LAKE_ISLAND.x - 8);
  let triangles = 0;
  tree.root.traverse((o) => {
    if (o instanceof T.Mesh)
      triangles +=
        ((o.geometry.index?.count ??
          o.geometry.getAttribute('position').count) /
          3) *
        (o instanceof T.InstancedMesh ? o.count : 1);
  });
  assert(triangles < 170000, `elder triangles: ${triangles}`);
  const position = tree.root.position.clone();
  tree.setDetail('office');
  assert.equal(tree.metrics().leafSprays, 1400);
  tree.setDetail('high');
  assert.equal(tree.metrics().leafSprays, 2200);
  assert(tree.root.position.equals(position));
  assert.equal(tree.root.children.length, 3);
  assert.equal(tree.metrics().trunkParticles, 0);
  assert.equal(tree.metrics().rainbowBark, true);
  tree.root.traverse((o) => {
    if (o instanceof T.InstancedMesh) o.dispose();
  });
  tree.geometries.forEach((g) => g.dispose());
  tree.materials.forEach((m) => m.dispose());
  tree.textures.forEach((t) => t.dispose());
});

await test('meadow grass avoids bridge decks and water and bounds its travel cache', () => {
  for (const b of WILDS_BRIDGES) {
    for (let along = -b.length / 2; along <= b.length / 2; along += 2)
      for (const across of [-b.width / 2, 0, b.width / 2])
        assert.equal(
          wildsGrassGround(
            b.x + b.axis.x * along - b.axis.z * across,
            b.z + b.axis.z * along + b.axis.x * across,
          ),
          undefined,
        );
  }
  for (const p of WILDS_RIVER)
    if (wildsWater(p).distance < 0)
      assert.equal(wildsGrassGround(p.x, p.z), undefined);
  const grass = createWildsGrass('high'),
    camera = new T.PerspectiveCamera();
  const matrix = new T.Matrix4(),
    point = new T.Vector3();
  for (const location of [
    { x: -190, z: 280 },
    { x: -200, z: -55 },
    { x: 40, z: -25 },
    { x: 280, z: 260 },
  ]) {
    const ground = wildsTerrainHeight(location.x, location.z);
    camera.position.set(location.x, ground + 35, location.z + 50);
    camera.lookAt(location.x, ground, location.z);
    camera.updateMatrixWorld();
    for (let i = 0; i < 34; i++) grass.update(camera, location, 0.1);
    assert(grass.metrics().cachedCells <= WILDS_GRASS_RENDER.cacheCells);
    assert(grass.metrics().visibleTufts > 500);
    for (const child of grass.root.children) {
      const mesh = child as T.InstancedMesh;
      for (let i = 0; i < mesh.count; i += 31) {
        mesh.getMatrixAt(i, matrix);
        point.setFromMatrixPosition(matrix).add(mesh.position);
        const ground = wildsGrassGround(point.x, point.z);
        assert(ground !== undefined, 'grass instance on blocked/wet ground');
        assert(
          Math.abs(point.y + 0.12 - ground) < 0.001,
          'grass roots float off terrain',
        );
      }
    }
  }
  camera.position.set(-300, wildsTerrainHeight(-300, -200) + 35, -200);
  camera.lookAt(-300, wildsTerrainHeight(-300, -200), -220);
  camera.updateMatrixWorld();
  for (let i = 0; i < 34; i++)
    grass.update(camera, { x: 280, z: 260 }, 0.1, true);
  assert(
    grass.root.children.some(
      (c) =>
        c.visible && Math.hypot(c.position.x + 300, c.position.z + 200) < 50,
    ),
  );
  grass.dispose();
  grass.dispose();
  assert.equal(grass.root.children.length, 0);
});

await test('grass uses a 250-metre GPU neighborhood and excludes off-camera cells', () => {
  for (const profile of Object.values(WILDS_QUALITY))
    assert.equal(profile.grassRange, 250);
  const grass = createWildsGrass('office'),
    camera = new T.OrthographicCamera(-320, 320, 320, -320, 0.1, 1000);
  const focus = { x: -160, z: 170 };
  camera.position.set(focus.x, 400, focus.z);
  camera.up.set(0, 0, -1);
  camera.lookAt(focus.x, 0, focus.z);
  camera.updateMatrixWorld();
  for (let i = 0; i < 110; i++) grass.update(camera, focus, 0.1);
  assert.equal(grass.metrics().range, 250);
  assert.equal(grass.metrics().fadeStart, 200);
  let farthest = 0;
  for (const c of grass.root.children)
    if (c.visible) {
      const dx = Math.max(
          c.position.x - focus.x,
          0,
          focus.x - (c.position.x + 32),
        ),
        dz = Math.max(c.position.z - focus.z, 0, focus.z - (c.position.z + 32));
      const nearest = Math.hypot(dx, dz);
      assert(nearest < 250);
      farthest = Math.max(farthest, nearest);
    }
  assert(farthest > 220, 'grass must actually populate the extended radius');
  camera.lookAt(focus.x, 800, focus.z);
  camera.updateMatrixWorld();
  grass.update(camera, focus, 0.1);
  assert.equal(
    grass.metrics().visibleCells,
    0,
    'off-camera cells must not be submitted',
  );
  assert.equal(grass.metrics().gpuTriangles, 0);
  assert(grass.metrics().cachedCells <= WILDS_GRASS_RENDER.cacheCells);
  grass.dispose();
});

await test('mushroom breathing reaches a bright peak, fades off and loops smoothly', () => {
  assert.equal(WILDS_MUSHROOM_BREATH.period, 9);
  assert.equal(wildsMushroomGlow(0), 0);
  assert.equal(wildsMushroomGlow(4.5), WILDS_MUSHROOM_BREATH.peak);
  assert.equal(wildsMushroomGlow(9), 0);
  for (let i = 1; i <= 45; i++)
    assert(wildsMushroomGlow(i / 10) >= wildsMushroomGlow((i - 1) / 10));
  for (let i = 46; i <= 90; i++)
    assert(wildsMushroomGlow(i / 10) <= wildsMushroomGlow((i - 1) / 10));
  assert(Math.abs(wildsMushroomGlow(1.7) - wildsMushroomGlow(10.7)) < 0.00001);
});

await test('area-scaled forest population stays on dry navigable ground and preserves legacy respawns', () => {
  const field = FIELDS[WILDS_ID],
    legacy = WILDS_LEGACY_CONTENT;
  const spawns = fieldSpawns(field),
    population = wildsPopulation(),
    nav = new WildsNavigation();
  assert.equal(population.normalCount, 256);
  assert.equal(population.eliteCount, 16);
  assert.equal(spawns.length, 273);
  assert.deepEqual(fieldSpawns(field), spawns);
  assert.equal(new Set(spawns.map((s) => s.id)).size, spawns.length);
  assert.equal(legacy.fieldBoss?.level, 26);
  assert.equal(field.fieldBoss?.maxHP, 4140);
  assert.deepEqual(
    field.normalMonsters.map((m) => m.id),
    legacy.normalMonsters.map((m) => m.id),
  );
  const boss = spawns.find((s) => s.definition.variant === 'boss')!;
  assert.equal(boss.x, WILDS_BOSS_HOME.x);
  assert.equal(boss.z, WILDS_BOSS_HOME.z);
  assert.equal(boss.x, WILDS_ALTAR.x);
  assert.equal(boss.z, WILDS_ALTAR.z);
  assert(
    Math.abs(
      wildsGroundHeight(boss.x, boss.z) -
        wildsTerrainHeight(boss.x, boss.z) -
        WILDS_ALTAR.rise,
    ) < 0.00001,
  );
  for (const [i, s] of spawns.entries()) {
    assert(s.definition.level >= 16 && s.definition.level <= 24);
    assert(nav.valid(s, s.definition.variant === 'boss' ? 4 : 3));
    assert(!isFieldSafe(WILDS_ID, s.x, s.z));
    assert(wildsWater(s).distance >= 12);
    for (const other of spawns.slice(i + 1))
      assert(Math.hypot(s.x - other.x, s.z - other.z) >= 24);
    if (s !== boss) assert(Math.hypot(s.x - boss.x, s.z - boss.z) >= 90);
    const key = monsterRespawnKey(s.definition.id, s.id, WILDS_ID);
    const oldKey = monsterRespawnKey(s.definition.id, s.id, legacy.id);
    assert.notEqual(key, oldKey);
    assert.equal(
      restoreRespawnDeadline(
        { [oldKey]: 999999 },
        s.definition.id,
        s.id,
        WILDS_ID,
      ),
      0,
    );
    assert.equal(
      restoreRespawnDeadline({ [key]: 12345 }, s.definition.id, s.id, WILDS_ID),
      12345,
    );
  }
  for (const p of [WILDS_ENTRY, ...WILDS_PORTALS])
    assert(isFieldSafe(WILDS_ID, p.x, p.z));
});

await test('fireflies submit visible indices only, reach 250m and follow the free camera', () => {
  const vfx = createWildsVfx('office'),
    camera = new T.OrthographicCamera(-310, 310, 310, -310, 0.1, 1400);
  const focus = { x: -160, z: 170 };
  camera.position.set(focus.x, 600, focus.z);
  camera.lookAt(focus.x, 0, focus.z);
  camera.updateMatrixWorld();
  for (let i = 0; i < 30; i++) vfx.update(camera, focus, 0.1, 1);
  const geometry = (vfx.root.children[0] as T.Points).geometry;
  assert.equal(vfx.metrics().renderRange, 250);
  assert.equal(vfx.metrics().fadeStart, 200);
  assert(vfx.metrics().farthestRendered > 220);
  assert(vfx.metrics().farthestRendered < 250);
  assert.equal(geometry.drawRange.count, vfx.metrics().gpuFireflies);
  assert(vfx.metrics().gpuFireflies > 100);
  const index = geometry.getIndex()!;
  const indices = Array.from({ length: geometry.drawRange.count }, (_, i) =>
    index.getX(i),
  );
  assert.equal(new Set(indices).size, indices.length);
  camera.lookAt(focus.x, 1200, focus.z);
  camera.updateMatrixWorld();
  vfx.update(camera, focus, 0.1, 1);
  assert.equal(vfx.metrics().gpuFireflies, 0);
  camera.position.set(300, 600, -300);
  camera.lookAt(300, 0, -300);
  camera.updateMatrixWorld();
  for (let i = 0; i < 40; i++) vfx.update(camera, focus, 0.1, 1, true);
  assert(vfx.metrics().gpuFireflies > 20);
  assert(vfx.metrics().farthestRendered < 250);
  vfx.dispose();
});

await test('grass uses only cyan shades and increases emission exactly fifty percent', () => {
  assert.equal(WILDS_GRASS_EMISSION, 0.12 * 1.5);
  const grass = createWildsGrass('office'),
    camera = new T.OrthographicCamera(-40, 40, 40, -40, 0.1, 1000);
  camera.position.set(-190, 400, 280);
  camera.lookAt(-190, 0, 280);
  camera.updateMatrixWorld();
  for (let i = 0; i < 15; i++) grass.update(camera, { x: -190, z: 280 }, 0.1);
  const expected = new T.Color(WILDS_GRASS_COLOR),
    tint = new T.Color();
  let count = 0;
  for (const child of grass.root.children) {
    const mesh = child as T.InstancedMesh;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getColorAt(i, tint);
      assert(Math.abs(tint.r / tint.b - expected.r / expected.b) < 0.000001);
      assert(Math.abs(tint.g / tint.b - expected.g / expected.b) < 0.000001);
      count++;
    }
  }
  assert(count > 500);
  grass.dispose();
});

await test('thirty source mushrooms have six of each variant and broad dry-ground spacing', () => {
  const mushrooms = wildsMushrooms(),
    nav = new WildsNavigation();
  assert.equal(mushrooms.length, 30);
  assert.deepEqual(
    [0, 1, 2, 3, 4].map(
      (variant) => mushrooms.filter((p) => p.variant === variant).length,
    ),
    [6, 6, 6, 6, 6],
  );
  for (let i = 0; i < mushrooms.length; i++) {
    const p = mushrooms[i];
    assert(p.height >= 12 && p.height <= 14.5);
    assert(wildsWater(p).distance >= 18);
    assert(!nav.valid(p), 'mushroom stem must block movement');
    assert(
      nav.valid(nav.restore(p)),
      'a saved position inside a stem must recover',
    );
    assert.equal(wildsGrassGround(p.x, p.z), undefined);
    for (const q of mushrooms.slice(i + 1))
      assert(Math.hypot(p.x - q.x, p.z - q.z) >= 70);
  }
});

await test('crafted bridges keep exact deck collision and batch their decorative geometry', async () => {
  const { createWildsBridges } = await import('./whispering-wilds-bridges.ts');
  const wood = new T.MeshStandardMaterial(),
    stone = new T.MeshStandardMaterial();
  const bridges = createWildsBridges(wood, stone);
  assert.equal(bridges.colliders.length, WILDS_BRIDGES.length);
  assert.equal(bridges.root.children.length, WILDS_BRIDGES.length);
  bridges.colliders.forEach((c, i) => {
    const b = WILDS_BRIDGES[i];
    c.updateMatrixWorld();
    const box = new T.Box3().setFromObject(c);
    assert(Math.abs(box.max.y - b.height) < 0.0001);
    assert.equal(c.position.x, b.x);
    assert.equal(c.position.z, b.z);
    assert(c.userData.bridge);
    assert(bridges.root.children[i].children.length <= 4);
    for (const part of bridges.root.children[i].children) {
      const p = (part as T.Mesh).geometry.getAttribute('position');
      for (let j = 0; j < p.count; j++) {
        if (
          Math.abs(p.getX(j)) < b.length / 2 &&
          Math.abs(p.getZ(j)) < b.width / 2 - 0.4
        )
          assert(
            p.getY(j) <= 0.001,
            `bridge ${i}: support protrudes through the walkable floor at ${p.getX(j)}, ${p.getY(j)}, ${p.getZ(j)}`,
          );
      }
    }
  });
  bridges.geometries.forEach((g) => g.dispose());
  bridges.materials.forEach((m) => m.dispose());
  bridges.textures.forEach((t) => t.dispose());
  wood.dispose();
  stone.dispose();
});
