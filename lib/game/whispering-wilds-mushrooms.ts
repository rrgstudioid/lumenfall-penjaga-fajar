import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { wildsTerrainHeight } from './whispering-wilds-layout.ts';
import {
  wildsMushrooms,
  WILDS_MUSHROOM_NAMES,
} from './whispering-wilds-mushroom-layout.ts';

export const WILDS_MUSHROOM_BREATH = { period: 9, peak: 6 } as const;
export function wildsMushroomGlow(time: number) {
  const wave =
    0.5 - 0.5 * Math.cos((time * Math.PI * 2) / WILDS_MUSHROOM_BREATH.period);
  return WILDS_MUSHROOM_BREATH.peak * wave * wave * (3 - 2 * wave);
}

export async function createWildsMushrooms() {
  const gltf = await new GLTFLoader().loadAsync(
    '/assets/maps/whispering-wilds-v2/mushrooms/five-mushrooms.glb',
  );
  const root = new T.Group();
  root.name = 'Thirty scattered mushroom trees';
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.MeshStandardMaterial>(),
    textures = new Set<T.Texture>();
  const sources: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>[] = [];
  gltf.scene.traverse((o) => {
    if (o instanceof T.Mesh) {
      sources.push(o);
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m);
        for (const value of Object.values(m))
          if (value instanceof T.Texture) textures.add(value);
      }
    }
  });
  function cleanup() {
    root.traverse((o) => {
      if (o instanceof T.InstancedMesh) o.dispose();
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => {
      t.dispose();
      const data = t.source.data;
      if (typeof data?.close === 'function') data.close();
    });
  }
  try {
    if (sources.length !== 5)
      throw new Error('Expected exactly five mushroom variants');
    materials.forEach((m) => {
      m.roughness = 0.85;
      m.metalness = 0;
      // The supplied atlas supplies emission colour as well as surface colour.
      m.emissive.set('#ffffff');
      m.emissiveMap = m.map;
      m.emissiveIntensity = 0;
      if (m.map) m.map.anisotropy = 4;
    });
    const placements = wildsMushrooms(),
      dummy = new T.Object3D();
    sources.forEach((source, variant) => {
      const batch = new T.InstancedMesh(source.geometry, source.material, 6);
      batch.name = `Mushroom trees — ${WILDS_MUSHROOM_NAMES[variant]}`;
      batch.userData.mushroomVariant = variant;
      placements
        .filter((p) => p.variant === variant)
        .forEach((p, index) => {
          dummy.position.set(p.x, wildsTerrainHeight(p.x, p.z) - 0.22, p.z);
          dummy.scale.setScalar(p.height);
          dummy.rotation.set(0, p.yaw, 0);
          dummy.updateMatrix();
          batch.setMatrixAt(index, dummy.matrix);
        });
      batch.castShadow = batch.receiveShadow = true;
      batch.computeBoundingSphere();
      root.add(batch);
    });
    let glow = 0,
      phase = 0;
    return {
      root,
      geometries,
      materials,
      textures,
      update(time: number) {
        phase = time % WILDS_MUSHROOM_BREATH.period;
        glow = wildsMushroomGlow(time);
        for (const material of materials) material.emissiveIntensity = glow;
      },
      metrics: () => ({
        total: placements.length,
        variants: 5,
        perVariant: [6, 6, 6, 6, 6],
        drawCalls: 5,
        emissiveIntensity: glow,
        breathPeriod: WILDS_MUSHROOM_BREATH.period,
        breathPhase: phase,
      }),
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
