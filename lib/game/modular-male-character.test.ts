import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { MALE_V2_PROFILE } from './modular-male-character.ts';
import {
  createCharacterModel,
  disposeCharacterModel,
} from './character-model.ts';
import {
  freshHero,
  parseSave,
  derivedStats,
  normalizeAppearance,
} from './rules.ts';
const root = new URL(
  '../../public/assets/characters/male-v2/',
  import.meta.url,
);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function load(path: string) {
  const bytes = await readFile(new URL(path, root));
  return loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
}
// Raycasting does not execute the visibility shader. Select exactly the
// triangles used by an alternate hairstyle before inspecting its bald base.
function selectBaldSurface(scene: T.Object3D) {
  scene.traverse((o) => {
    if (!(o instanceof T.SkinnedMesh)) return;
    const g = o.geometry.clone(),
      c = g.getAttribute('color'),
      index = g.index!;
    const active: number[] = [];
    for (let i = 0; i < index.count; i += 3) {
      const b = c.getZ(index.getX(i));
      if (b > 0.25 && b < 0.75) continue;
      active.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    }
    o.geometry = g;
    g.setIndex(active);
  });
}
await test('all 44 derivatives share the canonical bind pose and stay inside their geometry budget', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('manifest.json', root), 'utf8'),
  );
  let reference: T.Skeleton | undefined;
  assert.equal(manifest.assets.length, 44);
  for (const item of manifest.assets) {
    const asset = await load(item.path);
    const meshes: T.SkinnedMesh[] = [];
    asset.scene.traverse((o) => {
      if (o instanceof T.SkinnedMesh) meshes.push(o);
    });
    assert.equal(meshes.length, 1, item.path);
    const mesh = meshes[0];
    assert.equal(mesh.skeleton.bones.length, 20, item.path);
    assert.equal(mesh.geometry.index!.count / 3, item.triangles);
    reference ??= mesh.skeleton;
    assert.deepEqual(
      mesh.skeleton.bones.map((b) => b.name),
      reference.bones.map((b) => b.name),
    );
    mesh.skeleton.boneInverses.forEach((m, i) =>
      m.elements.forEach((v, j) =>
        assert.ok(
          Math.abs(v - reference!.boneInverses[i].elements[j]) < 1e-5,
          item.path,
        ),
      ),
    );
    const weights = mesh.geometry.getAttribute('skinWeight');
    assert.equal(weights.itemSize, 4);
    for (let i = 0; i < weights.count; i++) {
      const total =
        weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
      assert.ok(Math.abs(total - 1) < 0.025, `${item.path}: weight ${i}`);
    }
    asset.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
      }
    });
    mesh.skeleton.dispose();
  }
});
await test('source body preserves atlas UVs and keeps the alternate scalp separate at every LOD', async () => {
  for (let lod = 0; lod < 4; lod++) {
    const asset = await load(`body/body-lod${lod}.glb`);
    asset.scene.traverse((o) => {
      if (!(o instanceof T.SkinnedMesh)) return;
      const g = o.geometry,
        c = g.getAttribute('color'),
        uv = g.getAttribute('uv'),
        p = g.getAttribute('position'),
        index = g.index!;
      assert.ok(c && uv, 'Missing original UVs or hidden-scalp tag');
      let original = 0,
        cap = 0;
      for (let i = 0; i < index.count; i += 3) {
        const tags = [0, 1, 2].map((n) => c.getZ(index.getX(i + n)));
        assert.ok(
          tags.every((v) => v === 0 || v === 1 || Math.abs(v - 0.5) < 0.01),
        );
        assert.equal(
          new Set(tags).size,
          1,
          'Hidden cap merged into source surface',
        );
        if (tags[0] > 0.75) cap++;
        else original++;
      }
      assert.ok(original > 100 && cap > 20);
      for (let i = 0; i < p.count; i++) {
        assert.ok(Number.isFinite(p.getY(i)));
        if (p.getY(i) < 0.3)
          assert.equal(c.getZ(i), 0, 'Source bare foot lost');
        // The back/nape of the clean head uses skin, never the source atlas.
        if (c.getZ(i) > 0.75 && p.getZ(i) < -0.03)
          assert.equal(
            c.getY(i),
            0,
            `LOD${lod}: facial/source texture projected onto back ${p.getX(i)},${p.getY(i)},${p.getZ(i)}`,
          );
      }
    });
    disposeCharacterModel(asset.scene);
  }
});
await test('LOD0 visible body and default hair retain the source mesh positions and UVs', async () => {
  const ref = JSON.parse(
    await readFile(
      new URL(
        '../../tests/fixtures/chibi-source-reference.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  let triangles = 0,
    maxPositionError = 0,
    maxUVError = 0;
  for (const path of ['body/body-lod0.glb', 'hair/hair_01-lod0.glb']) {
    const asset = await load(path);
    asset.scene.traverse((o) => {
      if (!(o instanceof T.SkinnedMesh)) return;
      const g = o.geometry,
        p = g.getAttribute('position'),
        uv = g.getAttribute('uv'),
        c = g.getAttribute('color'),
        index = g.index!;
      for (let i = 0; i < index.count; i += 3)
        if (!c || c.getZ(index.getX(i)) < 0.75) triangles++;
      for (let i = 0; i < p.count; i++) {
        if (c && c.getZ(i) > 0.75) continue;
        let nearest = Infinity,
          uvError = Infinity;
        for (const v of ref.vertices) {
          const d = Math.hypot(
            p.getX(i) - v[0],
            p.getY(i) - v[1],
            p.getZ(i) - v[2],
          );
          if (d < 1e-5) {
            nearest = Math.min(nearest, d);
            uvError = Math.min(
              uvError,
              Math.hypot(uv.getX(i) - v[3], uv.getY(i) - v[4]),
            );
          }
        }
        maxPositionError = Math.max(maxPositionError, nearest);
        maxUVError = Math.max(maxUVError, uvError);
      }
    });
    disposeCharacterModel(asset.scene);
  }
  assert.equal(triangles, ref.triangles);
  assert.ok(
    maxPositionError < 1e-5,
    `Source geometry changed: ${maxPositionError}`,
  );
  assert.ok(maxUVError < 0.0001, `Source atlas changed: ${maxUVError}`);
});
await test('base body has a smooth bald crown independent of selected hairstyle', async () => {
  const ray = new T.Raycaster(),
    center = new T.Vector3(0, 1.706, -0.025);
  for (let lod = 0; lod < 4; lod++) {
    const asset = await load(`body/body-lod${lod}.glb`);
    selectBaldSurface(asset.scene);
    asset.scene.updateMatrixWorld(true);
    for (let i = 0; i < 32; i++) {
      // Avoid rays exactly on welded meridians: floating-point edge tests can
      // reject both adjacent triangles at x=0 despite a watertight surface.
      const a = ((i + 0.17) * Math.PI) / 16,
        direction = new T.Vector3(
          Math.cos(a) * 0.3,
          1,
          Math.sin(a) * 0.3,
        ).normalize();
      ray.set(
        center.clone().addScaledVector(direction, 1),
        direction.clone().negate(),
      );
      const hit = ray.intersectObject(asset.scene, true)[0];
      assert.ok(hit, `LOD${lod} ray${i}: bald crown hole`);
      const delta = hit.point.clone().sub(center);
      const surface = Math.sqrt(
        (delta.x / 0.202) ** 2 +
          (delta.y / 0.232) ** 2 +
          (delta.z / 0.215) ** 2,
      );
      assert.ok(
        Math.abs(surface - 1) < (lod < 2 ? 0.018 : lod === 2 ? 0.045 : 0.1),
        `LOD${lod}: crew-cut ridge or dent remains (${surface})`,
      );
      assert.ok(hit.point.y <= 1.94, 'base contains raised hairstyle geometry');
    }
    disposeCharacterModel(asset.scene);
  }
});
await test('optional hair attachments stay connected after refitting', async () => {
  for (let style = 2; style <= 10; style++)
    for (let lod = 0; lod < 4; lod++) {
      const path = `hair/hair_${String(style).padStart(2, '0')}-lod${lod}.glb`;
      const asset = await load(path);
      let mesh: T.SkinnedMesh | undefined;
      asset.scene.traverse((o) => {
        if (o instanceof T.SkinnedMesh) mesh = o;
      });
      const geometry = mesh!.geometry,
        positions = geometry.getAttribute('position'),
        index = geometry.index!;
      // glTF duplicates vertices at normal/attribute seams; connectivity is geometric.
      const ids = new Map<string, number>(),
        canonical: number[] = [],
        parent: number[] = [];
      for (let i = 0; i < positions.count; i++) {
        const key = [positions.getX(i), positions.getY(i), positions.getZ(i)]
          .map((n) => Math.round(n * 100000))
          .join(',');
        let id = ids.get(key);
        if (id === undefined) {
          id = ids.size;
          ids.set(key, id);
          parent.push(id);
        }
        canonical.push(id);
      }
      const find = (i: number): number =>
        parent[i] === i ? i : (parent[i] = find(parent[i]));
      const used = new Set<number>();
      for (let i = 0; i < index.count; i += 3) {
        const a = canonical[index.getX(i)],
          b = canonical[index.getX(i + 1)],
          c = canonical[index.getX(i + 2)];
        parent[find(b)] = find(a);
        parent[find(c)] = find(a);
        used.add(a);
        used.add(b);
        used.add(c);
      }
      assert.equal(
        new Set([...used].map(find)).size,
        1,
        `${path}: detached hair surface`,
      );
      disposeCharacterModel(asset.scene);
    }
});
await test('new male rig keeps finite bounds through native and procedural actions', async () => {
  const source = await load('body/body-lod1.glb');
  source.scene.userData.characterVisualProfile = MALE_V2_PROFILE;
  source.scene.userData.preserveAuthoredAppearance = true;
  const motion = JSON.parse(
    await readFile(new URL('animations/motion.json', root), 'utf8'),
  );
  source.scene.userData.lumenfallAnimations = motion.clips.map(
    (c: Parameters<typeof T.AnimationClip.parse>[0]) =>
      T.AnimationClip.parse(c),
  );
  const hero = freshHero();
  for (const slot of Object.keys(hero.equipment))
    hero.equipment[slot as keyof typeof hero.equipment] = null;
  const model = createCharacterModel(hero, {
    assetSource: async () => source.scene,
  });
  assert.ok(await model.ready);
  for (let frame = 0; frame < 240; frame++) {
    if (frame === 100) model.animator.play('basic_attack');
    model.animator.update(1 / 60, {
      moving: frame < 90,
      sprinting: frame < 45,
    });
    model.actor.updateMatrixWorld(true);
    source.scene.traverse((o) => {
      if (o instanceof T.SkinnedMesh) {
        o.skeleton.update();
        for (let i = 0; i < o.geometry.attributes.position.count; i += 101) {
          const v = o.getVertexPosition(i, new T.Vector3());
          assert.ok(Number.isFinite(v.length()) && v.length() < 5);
        }
      }
    });
  }
  disposeCharacterModel(model.actor);
});
await test('hair LODs cover their intended scalp regions; shaved presets leave sides bare', async () => {
  const center = new T.Vector3(0, 1.706, -0.025);
  const directions: T.Vector3[] = [];
  // Inspect the top and upper ring from every azimuth, including the previous
  // bald gaps between the source's disconnected spikes.
  for (const elevation of [0.5, 0.9, 1.3])
    for (let i = 0; i < 16; i++) {
      const angle = ((i + 0.17) * Math.PI) / 8;
      directions.push(
        new T.Vector3(
          Math.cos(angle) * Math.cos(elevation),
          Math.sin(elevation),
          Math.sin(angle) * Math.cos(elevation),
        ),
      );
    }
  const ray = new T.Raycaster();
  const sections = [
    ...[1.495, 1.56, 1.66, 1.795].map((y) => ({
      origin: new T.Vector3(0, y, -1),
      direction: new T.Vector3(0, 0, 1),
    })),
    ...[-1, 1].flatMap((side) => [
      {
        origin: new T.Vector3(side, 1.77, -0.025),
        direction: new T.Vector3(-side, 0, 0),
      },
      {
        origin: new T.Vector3(side * 0.9, 1.704, 0.4),
        direction: new T.Vector3(-side * 0.9, 0, -0.425).normalize(),
      },
      {
        origin: new T.Vector3(side * 0.8, 1.616, -0.8),
        direction: new T.Vector3(-side * 0.8, 0, 0.775).normalize(),
      },
    ]),
  ];
  for (let lod = 0; lod < 4; lod++) {
    const body = await load(`body/body-lod${lod}.glb`);
    selectBaldSurface(body.scene);
    body.scene.updateMatrixWorld(true);
    // Original hair keeps the source cut-out silhouette; its fidelity has a
    // separate source-surface gate and the generated scalp is hidden for it.
    for (let style = 2; style <= 10; style++) {
      const path = `hair/hair_${String(style).padStart(2, '0')}-lod${lod}.glb`;
      const hair = await load(path);
      hair.scene.updateMatrixWorld(true);
      const shaved = style === 3 || style === 4;
      const requiredDirections = shaved
        ? directions.filter(
            (d) => d.y > 0.96 && (style !== 3 || Math.abs(d.x) < 0.1),
          )
        : directions;
      for (const direction of requiredDirections) {
        ray.set(
          center.clone().addScaledVector(direction, 2),
          direction.clone().negate(),
        );
        const skinHit = ray.intersectObject(body.scene, true)[0];
        const hairHit = ray.intersectObject(hair.scene, true)[0];
        assert.ok(
          skinHit && hairHit && hairHit.distance <= skinHit.distance + 0.003,
          `${path}: exposed scalp toward ${direction.toArray().join(',')} skin=${skinHit?.distance} hair=${hairHit?.distance}`,
        );
      }
      for (const { origin, direction } of shaved ? [] : sections) {
        ray.set(origin, direction);
        const skinHit = ray.intersectObject(body.scene, true)[0],
          hairHit = ray.intersectObject(hair.scene, true)[0];
        assert.ok(
          skinHit && hairHit && hairHit.distance <= skinHit.distance + 0.003,
          `${path}: exposed rear/temple at ${origin.toArray().join(',')} skin=${skinHit?.distance} hair=${hairHit?.distance}`,
        );
      }
      if (shaved) {
        ray.set(new T.Vector3(1, 1.704, -0.025), new T.Vector3(-1, 0, 0));
        const skin = ray.intersectObject(body.scene, true)[0],
          attachment = ray.intersectObject(hair.scene, true)[0];
        assert.ok(
          skin && (!attachment || attachment.distance > skin.distance + 0.01),
          `${path}: shaved temple covered by generic cap`,
        );
      }
      disposeCharacterModel(hair.scene);
    }
    disposeCharacterModel(body.scene);
  }
});
await test('appearance migration preserves inventory, progression, stats and female payloads', () => {
  const hero = parseSave(JSON.stringify(freshHero()))!;
  hero.appearance = {
    gender: 'male',
    faceStyleId: 'face_default',
    hairStyleId: 'hair_short',
    skinToneId: 'tone_04',
    hairColorId: 'silver',
  };
  const before = derivedStats(hero),
    inventory = structuredClone(hero.inventory),
    equipment = { ...hero.equipment };
  const restored = parseSave(JSON.stringify(hero))!;
  assert.ok(restored);
  assert.equal(restored.appearance.hairStyleId, 'hair_02');
  assert.equal(restored.appearance.hairColor, '#aeb8c6');
  assert.deepEqual(derivedStats(restored), before);
  assert.deepEqual(restored.inventory, inventory);
  assert.deepEqual(restored.equipment, equipment);
  const female = {
    gender: 'female' as const,
    faceStyleId: 'face_default',
    hairStyleId: 'hair_short',
    skinToneId: 'tone_04',
    hairColorId: 'silver',
  };
  assert.deepEqual(normalizeAppearance(female, 'female'), female);
});
