import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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
const publicRoot = new URL(
  '../../public/assets/characters/male-v2/',
  import.meta.url,
);
const root = process.env.LUMENFALL_ASSET_STAGE
  ? pathToFileURL(resolve(process.env.LUMENFALL_ASSET_STAGE) + '/')
  : publicRoot;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function load(path: string) {
  const bytes = await readFile(new URL(path, root));
  return loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
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
    const budget = item.path.startsWith('body/')
      ? [5000, 3700, 1900, 900]
      : [11000, 7200, 3900, 1700];
    assert.ok(item.triangles <= budget[item.lod], item.path);
    assert.ok(
      mesh.geometry.getAttribute('uv'),
      'Owner atlas UVs missing: ' + item.path,
    );
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
await test('owner bald face retains source positions/UVs, with no alternate scalp or old hair surface', async () => {
  const ref = JSON.parse(
    await readFile(
      new URL(
        '../../tests/fixtures/owner-male-reference.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const manifest = JSON.parse(
    await readFile(new URL('manifest.json', root), 'utf8'),
  );
  assert.equal(manifest.sources[0].sha256, ref.sha256);
  const asset = await load('body/body-lod0.glb');
  let body: T.SkinnedMesh | undefined;
  asset.scene.traverse((o) => {
    if (o instanceof T.SkinnedMesh) body = o;
  });
  const g = body!.geometry,
    pos = g.getAttribute('position'),
    uv = g.getAttribute('uv');
  assert.equal(g.index!.count / 3, ref.triangles);
  assert.equal(
    g.getAttribute('color'),
    undefined,
    'Legacy scalp visibility tags remain',
  );
  for (const v of ref.headVertices) {
    let best = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const delta = Math.hypot(
        pos.getX(i) - v[0],
        pos.getY(i) - v[1],
        pos.getZ(i) - v[2],
      );
      if (delta < 1e-5)
        best = Math.min(best, Math.hypot(uv.getX(i) - v[3], uv.getY(i) - v[4]));
    }
    assert.ok(
      best < 0.0001,
      'Original face vertex or atlas changed: ' + v.join(','),
    );
  }
  disposeCharacterModel(asset.scene);
});
await test('every hairstyle shares head motion exactly at all LODs and keeps finite geometry', async () => {
  for (let lod = 0; lod < 4; lod++)
    for (let style = 1; style <= 10; style++) {
      const path = `hair/hair_${String(style).padStart(2, '0')}-lod${lod}.glb`;
      const asset = await load(path);
      let mesh: T.SkinnedMesh | undefined;
      asset.scene.traverse((o) => {
        if (o instanceof T.SkinnedMesh) mesh = o;
      });
      const g = mesh!.geometry,
        p = g.getAttribute('position'),
        w = g.getAttribute('skinWeight'),
        j = g.getAttribute('skinIndex');
      const head = mesh!.skeleton.bones.findIndex((b) => b.name === 'head');
      for (let i = 0; i < p.count; i++) {
        assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)), path);
        assert.ok(
          Math.abs(p.getX(i)) < 0.65 &&
            p.getY(i) > 1.1 &&
            p.getY(i) < 2.5 &&
            Math.abs(p.getZ(i)) < 0.65,
          path,
        );
        assert.equal(j.getX(i), head, path);
        assert.ok(
          w.getX(i) > 0.999 && w.getY(i) + w.getZ(i) + w.getW(i) < 0.001,
          path,
        );
      }
      const bone = mesh!.skeleton.bones[head];
      const sample = mesh!.getVertexPosition(0, new T.Vector3());
      bone.rotation.z += 0.5;
      asset.scene.updateMatrixWorld(true);
      mesh!.skeleton.update();
      assert.ok(
        mesh!.getVertexPosition(0, new T.Vector3()).distanceTo(sample) > 0.005,
        path + ' hair failed to follow head',
      );
      disposeCharacterModel(asset.scene);
    }
});
await test('new male rig keeps finite bounds through native and procedural actions', async () => {
  const source = await load('body/body-lod1.glb');
  source.scene.userData.characterVisualProfile = MALE_V2_PROFILE;
  source.scene.userData.preserveAuthoredAppearance = true;
  const motion = JSON.parse(
    await readFile(new URL('animations/motion.json', publicRoot), 'utf8'),
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
await test('hair derivatives contain no generic scalp and retain source detail at close range', async () => {
  // Counts from the supplied hair montage, before any fitting or simplification.
  const sourceTriangles = [
    3429, 10893, 2740, 6666, 6672, 3996, 5639, 6935, 5217, 5535,
  ];
  for (let lod = 0; lod < 4; lod++)
    for (let style = 1; style <= 10; style++) {
      const path = `hair/hair_${String(style).padStart(2, '0')}-lod${lod}.glb`;
      const asset = await load(path);
      asset.scene.traverse((o) => {
        if (!(o instanceof T.SkinnedMesh)) return;
        const g = o.geometry,
          uv = g.getAttribute('uv'),
          index = g.index!;
        if (lod === 0)
          assert.equal(
            index.count / 3,
            sourceTriangles[style - 1] -
              (style === 8 ? 279 : 0) +
              (style === 1
                ? 119
                : style === 5
                  ? 165
                  : style === 8
                    ? 654
                    : style === 10
                      ? 101
                      : 0),
            path + ' lost source detail or added geometry',
          );
        for (let i = 0; i < index.count; i += 3) {
          const cap = [0, 1, 2].every(
            (j) =>
              Math.abs(uv.getX(index.getX(i + j)) - 0.5) < 0.0001 &&
              Math.abs(uv.getY(index.getX(i + j)) - 0.5) < 0.0001,
          );
          assert.ok(!cap, path + ' contains a generated basic hair surface');
        }
      });
      disposeCharacterModel(asset.scene);
    }
});
await test('full hair keeps rear and crown coverage after LOD reduction; shaved temples stay bare', async () => {
  const ray = new T.Raycaster(),
    failures: string[] = [];
  for (let lod = 0; lod < 4; lod++) {
    const body = await load(`body/body-lod${lod}.glb`);
    body.scene.updateMatrixWorld(true);
    for (let style = 1; style <= 10; style++) {
      const asset = await load(
        `hair/hair_${String(style).padStart(2, '0')}-lod${lod}.glb`,
      );
      asset.scene.updateMatrixWorld(true);
      if (![3, 4, 8].includes(style)) {
        const probes: { origin: T.Vector3; direction: T.Vector3 }[] = [];
        for (const x of [-0.1, 0, 0.1])
          for (const y of [1.74, 1.82, 1.9])
            probes.push({
              origin: new T.Vector3(x, y, -1),
              direction: new T.Vector3(0, 0, 1),
            });
        for (const x of [-0.06, 0.06])
          for (const z of [-0.06, 0.06])
            probes.push({
              origin: new T.Vector3(x, 2.5, z),
              direction: new T.Vector3(0, -1, 0),
            });
        for (const { origin, direction } of probes) {
          ray.set(origin, direction);
          const skin = ray.intersectObject(body.scene, true)[0],
            hair = ray.intersectObject(asset.scene, true)[0];
          if (skin && !(hair && hair.distance < skin.distance + 0.002))
            failures.push(
              `hair_${style} LOD${lod}: exposed scalp at ${origin.toArray().join(',')}`,
            );
        }
      } else if (style !== 8) {
        ray.set(new T.Vector3(0.8, 1.67, -0.025), new T.Vector3(-1, 0, 0));
        const skin = ray.intersectObject(body.scene, true)[0],
          hair = ray.intersectObject(asset.scene, true)[0];
        assert.ok(
          skin && (!hair || hair.distance > skin.distance),
          `hair_${style} LOD${lod}: shaved temple covered`,
        );
      }
      disposeCharacterModel(asset.scene);
    }
    disposeCharacterModel(body.scene);
  }
  assert.deepEqual(failures, []);
});
await test('ponytail covers the rear scalp and bowl cut fits the head at every LOD', async () => {
  const ray = new T.Raycaster();
  for (let lod = 0; lod < 4; lod++) {
    const body = await load(`body/body-lod${lod}.glb`);
    const pony = await load(`hair/hair_05-lod${lod}.glb`);
    const bowl = await load(`hair/hair_06-lod${lod}.glb`);
    for (const asset of [body, pony, bowl]) asset.scene.updateMatrixWorld(true);
    for (const angle of [-60, -40, -20, 0, 20, 40, 60])
      for (const y of [1.65, 1.69, 1.73, 1.77, 1.81, 1.85]) {
        const a = (angle * Math.PI) / 180;
        const direction = new T.Vector3(Math.sin(a), 0, -Math.cos(a));
        ray.set(
          new T.Vector3(direction.x, y, direction.z - 0.025),
          direction.clone().negate(),
        );
        const skin = ray.intersectObject(body.scene, true)[0];
        const hair = ray.intersectObject(pony.scene, true)[0];
        assert.ok(
          skin && hair && hair.distance <= skin.distance + 0.002,
          `Ponytail LOD${lod}: exposed rear scalp at ${angle} degrees, height ${y}`,
        );
      }
    const bounds = new T.Box3().setFromObject(bowl.scene);
    assert.ok(
      bounds.max.y <= 2.045,
      `Bowl LOD${lod}: crown sits too high (${bounds.max.y})`,
    );
    assert.ok(
      bounds.max.x - bounds.min.x <= 0.565,
      `Bowl LOD${lod}: silhouette is too wide`,
    );
    for (const asset of [body, pony, bowl]) disposeCharacterModel(asset.scene);
  }
});
await test('messy spikes covers the lower rear scalp from rear-quarter views at every LOD', async () => {
  const ray = new T.Raycaster();
  const failures: string[] = [];
  for (let lod = 0; lod < 4; lod++) {
    const body = await load(`body/body-lod${lod}.glb`);
    const hair = await load(`hair/hair_01-lod${lod}.glb`);
    for (const asset of [body, hair]) asset.scene.updateMatrixWorld(true);
    for (const angle of [-60, -40, -20, 0, 20, 40, 60])
      for (const y of [1.63, 1.66, 1.69, 1.72, 1.76, 1.8, 1.85, 1.9]) {
        const a = (angle * Math.PI) / 180;
        const direction = new T.Vector3(Math.sin(a), 0, -Math.cos(a));
        ray.set(
          new T.Vector3(direction.x, y, direction.z - 0.025),
          direction.clone().negate(),
        );
        const skin = ray.intersectObject(body.scene, true)[0];
        const lock = ray.intersectObject(hair.scene, true)[0];
        if (skin && (!lock || lock.distance > skin.distance + 0.002))
          failures.push(
            `Messy Spikes LOD${lod}: rear gap at ${angle} degrees, height ${y}`,
          );
      }
    for (const asset of [body, hair]) disposeCharacterModel(asset.scene);
  }
  assert.deepEqual(failures, []);
});
await test('messy spikes stays compact and long tied hair covers the right temple at every LOD', async () => {
  const ray = new T.Raycaster(),
    failures: string[] = [];
  for (let lod = 0; lod < 4; lod++) {
    const body = await load(`body/body-lod${lod}.glb`);
    const messy = await load(`hair/hair_01-lod${lod}.glb`);
    const tied = await load(`hair/hair_10-lod${lod}.glb`);
    for (const asset of [body, messy, tied])
      asset.scene.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(messy.scene),
      size = bounds.getSize(new T.Vector3());
    if (size.x > 0.6 || size.z > 0.57 || bounds.max.y > 2.09)
      failures.push(
        `Messy LOD${lod}: excess volume (${size.x}, ${size.z}, crown ${bounds.max.y})`,
      );
    for (const y of [1.72, 1.74, 1.76, 1.78, 1.8, 1.82, 1.84, 1.86, 1.88, 1.9])
      for (const z of [
        -0.12, -0.1, -0.08, -0.06, -0.04, -0.02, 0, 0.02, 0.04, 0.06, 0.08, 0.1,
      ]) {
        ray.set(new T.Vector3(-1, y, z), new T.Vector3(1, 0, 0));
        const skin = ray.intersectObject(body.scene, true)[0],
          hair = ray.intersectObject(tied.scene, true)[0];
        if (skin && (!hair || hair.distance > skin.distance + 0.002))
          failures.push(
            `Long Hair Tied LOD${lod}: right scalp exposed at ${y},${z}`,
          );
      }
    for (const asset of [body, messy, tied]) disposeCharacterModel(asset.scene);
  }
  assert.deepEqual(failures, []);
});
await test('long tied hair covers the lower rear scalp and rear quarters at every LOD', async () => {
  const ray = new T.Raycaster(),
    failures: string[] = [];
  for (let lod = 0; lod < 4; lod++) {
    const body = await load(`body/body-lod${lod}.glb`);
    const tied = await load(`hair/hair_10-lod${lod}.glb`);
    for (const asset of [body, tied]) asset.scene.updateMatrixWorld(true);
    for (const angle of [-65, -50, -35, -20, 0, 20, 35, 50, 65])
      for (const y of [1.62, 1.65, 1.68, 1.71, 1.74, 1.77, 1.8, 1.84, 1.88]) {
        const a = (angle * Math.PI) / 180;
        const direction = new T.Vector3(Math.sin(a), 0, -Math.cos(a));
        ray.set(
          new T.Vector3(direction.x, y, direction.z - 0.025),
          direction.clone().negate(),
        );
        const skin = ray.intersectObject(body.scene, true)[0];
        const hair = ray.intersectObject(tied.scene, true)[0];
        if (skin && (!hair || hair.distance > skin.distance + 0.002))
          failures.push(
            `Long Hair Tied LOD${lod}: rear gap at ${angle} degrees, height ${y}`,
          );
      }
    for (const asset of [body, tied]) disposeCharacterModel(asset.scene);
  }
  assert.deepEqual(failures, []);
});
await test('cornrow tubes are closed and the two rear rows stay continuous at every LOD', async () => {
  const ray = new T.Raycaster();
  const probes = [
    [-0.099, 0.147, 1.879],
    [-0.099, 0.162, 1.864],
    [-0.099, 0.18, 1.846],
    [-0.085, 0.2, 1.815],
    [0.05, 0.19, 1.871],
    [0.04, 0.21, 1.849],
    [0.04, 0.225, 1.823],
    [0.05, 0.235, 1.8],
  ];
  for (let lod = 0; lod < 4; lod++) {
    const body = await load(`body/body-lod${lod}.glb`);
    const hair = await load(`hair/hair_08-lod${lod}.glb`);
    body.scene.updateMatrixWorld(true);
    hair.scene.updateMatrixWorld(true);
    hair.scene.traverse((o) => {
      if (!(o instanceof T.SkinnedMesh)) return;
      const position = o.geometry.getAttribute('position'),
        index = o.geometry.index!;
      // Weld UV/normal seams by position before checking geometric boundaries.
      const keys = Array.from({ length: position.count }, (_, i) =>
        [position.getX(i), position.getY(i), position.getZ(i)]
          .map((v) => Math.round(v * 1e6))
          .join(','),
      );
      const edges = new Map<string, number>();
      for (let i = 0; i < index.count; i += 3) {
        const vertices = [0, 1, 2].map((j) => keys[index.getX(i + j)]);
        for (let j = 0; j < 3; j++) {
          if (vertices[j] === vertices[(j + 1) % 3]) continue;
          const key = [vertices[j], vertices[(j + 1) % 3]].sort().join('|');
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      assert.equal(
        [...edges.values()].filter((n) => n === 1).length,
        0,
        `Cornrows LOD${lod}: open cuts remain in braid tubes`,
      );
    });
    for (const [x, y, z] of probes) {
      const center = new T.Vector3(0, 1.73, -0.025);
      const direction = new T.Vector3(x, z, -y).sub(center).normalize();
      ray.set(center.clone().add(direction), direction.clone().negate());
      const skin = ray.intersectObject(body.scene, true)[0],
        braid = ray.intersectObject(hair.scene, true)[0];
      assert.ok(
        skin && braid && braid.distance <= skin.distance + 0.002,
        `Cornrows LOD${lod}: rear row gap at ${x},${y},${z}`,
      );
    }
    disposeCharacterModel(body.scene);
    disposeCharacterModel(hair.scene);
  }
});
await test('mohawk roots contact the scalp along the crest at every LOD', async () => {
  const ray = new T.Raycaster();
  for (let lod = 0; lod < 4; lod++) {
    const body = await load(`body/body-lod${lod}.glb`);
    const hair = await load(`hair/hair_03-lod${lod}.glb`);
    for (const asset of [body, hair]) {
      asset.scene.updateMatrixWorld(true);
      asset.scene.traverse((o) => {
        if (o instanceof T.Mesh)
          for (const material of Array.isArray(o.material)
            ? o.material
            : [o.material])
            material.side = T.DoubleSide;
      });
    }
    let contacts = 0;
    for (const x of [-0.025, 0, 0.025])
      for (let step = 0; step < 13; step++) {
        const z = 0.14 - step * 0.02;
        ray.set(new T.Vector3(x, 2.6, z), new T.Vector3(0, -1, 0));
        const skin = ray.intersectObject(body.scene, true)[0];
        ray.set(new T.Vector3(x, 1.4, z), new T.Vector3(0, 1, 0));
        const root = ray.intersectObject(hair.scene, true)[0];
        if (!skin || !root) continue;
        contacts++;
        assert.ok(
          root.point.y - skin.point.y <= 0.004,
          `Mohawk LOD${lod}: floating root at ${x},${z}, gap ${root.point.y - skin.point.y}`,
        );
      }
    assert.ok(
      contacts >= 30,
      `Mohawk LOD${lod}: incomplete root coverage (${contacts})`,
    );
    for (const x of [-0.025, 0, 0.025, 0.05])
      for (const y of [1.78, 1.81, 1.84, 1.87]) {
        ray.set(new T.Vector3(x, y, -1), new T.Vector3(0, 0, 1));
        const skin = ray.intersectObject(body.scene, true)[0];
        const tip = ray.intersectObject(hair.scene, true)[0];
        assert.ok(
          skin && (!tip || tip.distance > skin.distance),
          `Mohawk LOD${lod}: isolated rear tip at ${x},${y}`,
        );
      }
    disposeCharacterModel(body.scene);
    disposeCharacterModel(hair.scene);
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
