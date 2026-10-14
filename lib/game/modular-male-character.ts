import * as T from 'three';
import {
  GLTFLoader,
  type GLTF,
} from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  CharacterAssetCache,
  type AssetLease,
} from './character-asset-cache.ts';
import {
  normalizeMaleAppearance,
  MALE_HAIR_ASSET_REVISION,
  MALE_BODY_ASSET_REVISION,
} from './character-appearance.ts';
import type { CharacterVisualProfile } from './revision02-character.ts';
import {
  createMaleBodyMaterial,
  createMaleHairMaterial,
  loadMaleTextures,
} from './character-materials.ts';
import type { CharacterLOD } from './character-quality.ts';

export const MALE_V2_ROOT = '/assets/characters/male-v2/';
/** Enabled only after the asset and browser gates; the explicit fixture can always load candidates. */
export const MODULAR_MALE_ENABLED = true;
export const MALE_V2_PROFILE: CharacterVisualProfile = {
  assetKind: 'male-v2',
  visualName: 'MaleV2Visual',
  triangles: 10000,
  authoredHeight: 2.08,
  authoredGround: 0,
  restPose: { rightUpperArm: [0, 0, -1.22], leftUpperArm: [0, 0, 1.22] },
  jointNames: {
    hips: 'pelvis',
    spine: 'spine_01',
    chest: 'spine_03',
    neck: 'neck_01',
    head: 'head',
    rightUpperArm: 'upperarm_r',
    rightLowerArm: 'lowerarm_r',
    rightHand: 'hand_r',
    leftUpperArm: 'upperarm_l',
    leftLowerArm: 'lowerarm_l',
    leftHand: 'hand_l',
    rightUpperLeg: 'thigh_r',
    rightLowerLeg: 'calf_r',
    rightFoot: 'foot_r',
    leftUpperLeg: 'thigh_l',
    leftLowerLeg: 'calf_l',
    leftFoot: 'foot_l',
  },
};
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
function meshes(root: T.Object3D) {
  const result: T.SkinnedMesh[] = [];
  root.traverse((o) => {
    if (o instanceof T.SkinnedMesh) result.push(o);
  });
  return result;
}
const cache = new CharacterAssetCache<GLTF>(
  async (key) => {
    const asset = await loader.loadAsync(
      MALE_V2_ROOT +
        key +
        `?v=${key.startsWith('hair/') ? MALE_HAIR_ASSET_REVISION : MALE_BODY_ASSET_REVISION}`,
    );
    asset.scene.traverse((o) => {
      if (o instanceof T.Mesh) o.geometry.userData.sharedCharacter = true;
    });
    return asset;
  },
  (asset) => {
    const gs = new Set<T.BufferGeometry>(),
      ms = new Set<T.Material>(),
      ts = new Set<T.Texture>(),
      ss = new Set<T.Skeleton>();
    asset.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        gs.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          ms.add(m);
      }
      if (o instanceof T.SkinnedMesh) ss.add(o.skeleton);
    });
    for (const m of ms)
      for (const v of Object.values(m)) if (v instanceof T.Texture) ts.add(v);
    gs.forEach((g) => g.dispose());
    ms.forEach((m) => m.dispose());
    ts.forEach((t) => t.dispose());
    ss.forEach((s) => s.dispose());
  },
  (asset) => {
    const seen = new Set<ArrayBufferLike>();
    let bytes = 0;
    asset.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        for (const a of [
          ...Object.values(o.geometry.attributes),
          o.geometry.index,
        ])
          if (a) {
            const array = 'array' in a ? a.array : a.data.array;
            if (!seen.has(array.buffer)) {
              seen.add(array.buffer);
              bytes += array.buffer.byteLength;
            }
          }
      }
    });
    return bytes;
  },
);
let motion: Promise<T.AnimationClip[]> | undefined;
async function loadMotion() {
  motion ??= fetch(
    MALE_V2_ROOT + `animations/motion.json?v=${MALE_BODY_ASSET_REVISION}`,
  )
    .then(async (r) => {
      if (!r.ok) throw Error('Male motion ' + r.status);
      const p = (await r.json()) as {
        clips: Parameters<typeof T.AnimationClip.parse>[0][];
      };
      return p.clips.map((clip) => T.AnimationClip.parse(clip));
    })
    .catch((e) => {
      motion = undefined;
      throw e;
    });
  return motion;
}
export async function loadModularMaleCharacter(
  value: unknown,
  initialLOD: CharacterLOD = 1,
  renderer?: T.WebGLRenderer,
  animated = true,
) {
  let appearance = normalizeMaleAppearance(value),
    lod = initialLOD,
    revision = 0,
    disposed = false;
  const bodyLease = await cache.acquire(`body/body-lod${lod}.glb`);
  let textures: Awaited<ReturnType<typeof loadMaleTextures>>;
  let textureSize: 1024 | 2048 = initialLOD ? 1024 : 2048;
  try {
    textures = await loadMaleTextures(textureSize, renderer);
  } catch (e) {
    bodyLease.release();
    throw e;
  }
  const scene = clone(bodyLease.value.scene) as T.Group;
  const body = meshes(scene)[0];
  if (!body) {
    bodyLease.release();
    textures.release();
    throw Error('Male body missing skin');
  }
  let currentBodyLease = bodyLease;
  const bodyMaterial = createMaleBodyMaterial(textures, appearance),
    hairMaterial = createMaleHairMaterial(appearance),
    sourceHairMaterial = createMaleHairMaterial(appearance, textures);
  bodyMaterial.userData.modularOwned = true;
  hairMaterial.userData.modularOwned = true;
  sourceHairMaterial.userData.modularOwned = true;
  for (const mesh of meshes(scene)) {
    mesh.material = bodyMaterial;
    mesh.customDepthMaterial = bodyMaterial.userData.depthMaterial;
    mesh.customDistanceMaterial = bodyMaterial.userData.distanceMaterial;
    mesh.frustumCulled = false;
  }
  const slots = new Map<
    string,
    { mesh: T.SkinnedMesh; lease: AssetLease<GLTF> }
  >();
  let ownedLOD = lod;
  const bindMesh = (template: T.SkinnedMesh, material: T.Material) => {
    const names = template.skeleton.bones.map((b) => b.name);
    if (names.join('|') !== body.skeleton.bones.map((b) => b.name).join('|'))
      throw Error('Male attachment skeleton mismatch');
    if (
      template.skeleton.boneInverses.some((matrix, i) =>
        matrix.elements.some(
          (n, j) =>
            Math.abs(n - body.skeleton.boneInverses[i].elements[j]) > 1e-5,
        ),
      )
    )
      throw Error('Male attachment bind pose mismatch');
    const m = new T.SkinnedMesh(template.geometry, material);
    m.name = template.name;
    m.position.copy(template.position);
    m.quaternion.copy(template.quaternion);
    m.scale.copy(template.scale);
    m.bind(body.skeleton, template.bindMatrix);
    m.frustumCulled = false;
    m.castShadow = body.castShadow;
    m.receiveShadow = true;
    return m;
  };
  async function update(next: unknown, nextLOD: CharacterLOD = lod) {
    if (disposed) return;
    const desired = normalizeMaleAppearance(next),
      token = ++revision;
    const desiredSlots = [
      ['hair', `hair/${desired.hairStyleId}-lod${nextLOD}.glb`],
    ];
    const acquired: AssetLease<GLTF>[] = [];
    let newTextures: Awaited<ReturnType<typeof loadMaleTextures>> | undefined;
    try {
      const desiredSize = nextLOD ? 1024 : 2048;
      if (textureSize !== desiredSize)
        newTextures = await loadMaleTextures(desiredSize, renderer);
      const bodyNext =
        ownedLOD === nextLOD
          ? undefined
          : await cache.acquire(`body/body-lod${nextLOD}.glb`);
      if (bodyNext) acquired.push(bodyNext);
      const results = await Promise.allSettled(
        desiredSlots.map(async ([slot, path]) => {
          const old = slots.get(slot);
          if (old?.mesh.userData.assetPath === path) return { slot, path, old };
          const lease = await cache.acquire(path);
          acquired.push(lease);
          return {
            slot,
            path,
            lease,
            mesh: bindMesh(
              meshes(lease.value.scene)[0],
              path.includes('/hair_01-') ? sourceHairMaterial : hairMaterial,
            ),
          };
        }),
      );
      const failure = results.find((r) => r.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
      const loaded = results.map((r) => {
        if (r.status === 'rejected') throw r.reason;
        return r.value;
      });
      if (disposed || token !== revision) {
        acquired.forEach((l) => l.release());
        newTextures?.release();
        return;
      }
      if (bodyNext) {
        const template = meshes(bodyNext.value.scene)[0];
        bindMesh(template, bodyMaterial);
        body.geometry = template.geometry;
        currentBodyLease.release();
        currentBodyLease = bodyNext;
        ownedLOD = nextLOD;
      }
      for (const [slot, old] of slots)
        if (!desiredSlots.some(([s]) => s === slot)) {
          old.mesh.removeFromParent();
          old.lease.release();
          slots.delete(slot);
        }
      for (const item of loaded)
        if (item.lease && item.mesh) {
          const old = slots.get(item.slot);
          old?.mesh.removeFromParent();
          old?.lease.release();
          item.mesh.userData.assetPath = item.path;
          scene.add(item.mesh);
          slots.set(item.slot, { mesh: item.mesh, lease: item.lease });
        }
      appearance = desired;
      lod = nextLOD;
      bodyMaterial.userData.applyAppearance(desired);
      hairMaterial.color.set(desired.hairColor);
      sourceHairMaterial.color.set(desired.hairColor);
      if (newTextures) {
        bodyMaterial.userData.setTextures(newTextures);
        sourceHairMaterial.map = newTextures.base;
        sourceHairMaterial.normalMap = newTextures.normal;
        textures.release();
        textures = newTextures;
        textureSize = desiredSize;
      }
      scene.userData.appearance = desired;
      scene.userData.lod = lod;
    } catch (error) {
      acquired.forEach((l) => l.release());
      newTextures?.release();
      throw error;
    }
  }
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    ++revision;
    for (const item of slots.values()) {
      item.mesh.removeFromParent();
      item.lease.release();
    }
    slots.clear();
    bodyMaterial.dispose();
    hairMaterial.dispose();
    sourceHairMaterial.dispose();
    currentBodyLease.release();
    textures.release();
  };
  scene.userData.disposeCharacterResources = dispose;
  scene.userData.setAppearance = update;
  scene.userData.characterVisualProfile = MALE_V2_PROFILE;
  scene.userData.preserveAuthoredAppearance = true;
  scene.userData.importedSwordGripRoll = 0;
  try {
    await update(appearance, lod);
    scene.userData.lumenfallAnimations = animated ? await loadMotion() : [];
    scene.userData.runningAnimationSource = 'male-v2-retarget';
  } catch (e) {
    dispose();
    body.skeleton.dispose();
    throw e;
  }
  return scene;
}
export function maleAssetCacheStats() {
  return cache.stats();
}
export function releaseUnusedMaleAssets() {
  cache.trim(true);
}
