import * as T from 'three';
import {
  GLTFLoader,
  type GLTF,
} from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  CharacterAssetCache,
  type AssetLease,
} from './character-asset-cache.ts';
import {
  DRAGON_VEIL_PIECES,
  DRAGON_VEIL_ROOT,
  DRAGON_VEIL_REVISION,
  type DragonVeilLoadout,
  type DragonVeilEnhancements,
} from './dragon-veil.ts';
import type { CharacterLOD } from './character-quality.ts';
import { cloneEquipmentEmissive } from './equipment-emissive.ts';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const skinMeshes = (root: T.Object3D) => {
  const meshes: T.SkinnedMesh[] = [];
  root.traverse((o) => {
    if (o instanceof T.SkinnedMesh) meshes.push(o);
  });
  return meshes;
};
const cache = new CharacterAssetCache<GLTF>(
  async (path) => {
    const asset = await loader.loadAsync(
      `${DRAGON_VEIL_ROOT}${path}?v=${DRAGON_VEIL_REVISION}`,
    );
    if (!skinMeshes(asset.scene).length)
      throw Error(`Dragon Veil mesh missing: ${path}`);
    asset.scene.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      o.geometry.userData.sharedCharacter = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        m.userData.modularOwned = true;
        for (const t of Object.values(m))
          if (t instanceof T.Texture) t.userData.sharedCharacter = true;
      }
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
    ms.forEach((m) => {
      for (const t of Object.values(m)) if (t instanceof T.Texture) ts.add(t);
      m.dispose();
    });
    gs.forEach((g) => g.dispose());
    ts.forEach((t) => t.dispose());
    ss.forEach((s) => s.dispose());
  },
  (asset) => {
    const buffers = new Set<ArrayBufferLike>(),
      textures = new Set<T.Texture>();
    let bytes = 0;
    for (const mesh of skinMeshes(asset.scene)) {
      for (const a of [
        ...Object.values(mesh.geometry.attributes),
        mesh.geometry.index,
      ]) {
        if (!a) continue;
        const buffer = a.array.buffer;
        if (!buffers.has(buffer)) {
          buffers.add(buffer);
          bytes += buffer.byteLength;
        }
      }
      for (const m of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material])
        for (const t of Object.values(m))
          if (t instanceof T.Texture) textures.add(t);
    }
    textures.forEach((t) => {
      bytes += ((t.image?.width ?? 0) * (t.image?.height ?? 0) * 4 * 4) / 3;
    });
    return bytes;
  },
);

export function bindDragonVeilMesh(
  template: T.SkinnedMesh,
  body: T.SkinnedMesh,
  enhancementLevel = 0,
) {
  const bodyNames = new Map(body.skeleton.bones.map((b, i) => [b.name, i]));
  const indices = template.skeleton.bones.map((b) => bodyNames.get(b.name));
  if (indices.some((i) => i === undefined))
    throw Error('Dragon Veil skeleton mismatch');
  for (let i = 0; i < indices.length; i++) {
    const inverse = body.skeleton.boneInverses[indices[i]!];
    if (
      template.skeleton.boneInverses[i].elements.some(
        (v, j) => Math.abs(v - inverse.elements[j]) > 1e-5,
      )
    )
      throw Error(
        `Dragon Veil bind pose mismatch: ${template.skeleton.bones[i].name}`,
      );
  }
  const mesh = new T.SkinnedMesh(template.geometry, template.material);
  if (enhancementLevel > 0) {
    const copies = (
      Array.isArray(template.material) ? template.material : [template.material]
    ).map((material) => cloneEquipmentEmissive(material, enhancementLevel));
    copies.forEach((material) => {
      material.userData.modularOwned = true;
    });
    mesh.material = Array.isArray(template.material) ? copies : copies[0];
    mesh.userData.enhancementMaterials = copies;
  }
  mesh.name = template.name;
  mesh.position.copy(template.position);
  mesh.quaternion.copy(template.quaternion);
  mesh.scale.copy(template.scale);
  mesh.bind(
    new T.Skeleton(
      indices.map((i) => body.skeleton.bones[i!]),
      indices.map((i) => body.skeleton.boneInverses[i!].clone()),
    ),
    template.bindMatrix,
  );
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Replaces a complete LOD atomically; stale loads never attach to a disposed actor. */
export function createDragonVeilVisual(
  scene: T.Group,
  body: T.SkinnedMesh,
  loadout: DragonVeilLoadout,
  enhancements: DragonVeilEnhancements = {},
) {
  let revision = 0,
    disposed = false,
    currentLOD = -1;
  let current: Array<{ lease: AssetLease<GLTF>; meshes: T.SkinnedMesh[] }> = [];
  const pieces = DRAGON_VEIL_PIECES.filter((p) => loadout[p.slot] === p.id);
  const release = (items: typeof current) =>
    items.forEach(({ lease, meshes }) => {
      meshes.forEach((m) => {
        m.removeFromParent();
        m.skeleton.dispose();
        for (const material of m.userData.enhancementMaterials ?? [])
          material.dispose();
      });
      lease.release();
    });
  return {
    async update(lod: CharacterLOD) {
      if (disposed || currentLOD === lod) return;
      const token = ++revision;
      const results = await Promise.allSettled(
        pieces.map(async (p) => {
          const lease = await cache.acquire(`${p.piece}-lod${lod}.glb`);
          const meshes: T.SkinnedMesh[] = [];
          try {
            for (const source of skinMeshes(lease.value.scene)) {
              const mesh = bindDragonVeilMesh(
                source,
                body,
                enhancements[p.slot] ?? 0,
              );
              mesh.userData = {
                ...mesh.userData,
                slot: p.slot,
                templateId: p.id,
                dragonVeil: true,
                lod,
              };
              meshes.push(mesh);
            }
            return { lease, meshes };
          } catch (e) {
            release([{ lease, meshes }]);
            throw e;
          }
        }),
      );
      const loaded = results.flatMap((r) =>
        r.status === 'fulfilled' ? [r.value] : [],
      );
      const failure = results.find((r) => r.status === 'rejected');
      if (disposed || token !== revision || failure) {
        release(loaded);
        if (failure?.status === 'rejected' && !disposed && token === revision)
          throw failure.reason;
        return;
      }
      release(current);
      current = loaded;
      currentLOD = lod;
      current.forEach((entry) => entry.meshes.forEach((m) => scene.add(m)));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ++revision;
      release(current);
      current = [];
    },
  };
}

/** Mask in the undeformed body coordinates: all poses and shadow passes agree. */
export function applyDragonVeilCoverage(
  material: T.MeshStandardMaterial,
  loadout: DragonVeilLoadout,
) {
  const coverage = new T.Vector3(
    loadout.chest ? 1 : 0,
    loadout.legs ? 1 : 0,
    loadout.boots ? 1 : 0,
  );
  for (const mat of [
    material,
    material.userData.depthMaterial,
    material.userData.distanceMaterial,
  ] as T.Material[]) {
    const previous = mat.onBeforeCompile.bind(mat),
      previousKey = mat.customProgramCacheKey();
    mat.onBeforeCompile = (shader, renderer) => {
      previous(shader, renderer);
      shader.uniforms.dvCoverage = { value: coverage };
      shader.vertexShader =
        'varying vec3 dvRestPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ndvRestPosition=position;',
      );
      shader.fragmentShader =
        'uniform vec3 dvCoverage; varying vec3 dvRestPosition;\n' +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        `void main() {
        float y=dvRestPosition.y; float x=abs(dvRestPosition.x);
        bool coveredChest=(y>.88 && y<1.435)||(x>.17 && y>1.20 && y<1.50);
        if ((dvCoverage.x>.5 && coveredChest) || (dvCoverage.y>.5 && y>.468 && y<1.02) || (dvCoverage.z>.5 && y<.47)) discard;
      `,
      );
    };
    mat.customProgramCacheKey = () => previousKey + ':dragon-veil-coverage-v2';
  }
}
export const dragonVeilCacheStats = () => cache.stats();
export const releaseUnusedDragonVeilAssets = () => cache.trim(true);
