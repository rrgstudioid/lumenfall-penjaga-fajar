import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type SunkenPbrPart = {
  geometry: T.BufferGeometry;
  material: T.MeshStandardMaterial;
};
/** Map-local textured prototypes. Keep every material slot and all glTF PBR textures. */
export function createSunkenPbrKit(adapt: (m: T.MeshStandardMaterial) => void) {
  const prototypes = new Map<string, SunkenPbrPart[]>();
  const geometry = new Set<T.BufferGeometry>(),
    materials = new Set<T.MeshStandardMaterial>(),
    textures = new Set<T.Texture>();
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    geometry.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    const images = new Set<ImageBitmap>();
    textures.forEach((t) => {
      if (typeof t.image?.close === 'function') images.add(t.image);
      t.dispose();
    });
    images.forEach((i) => i.close());
    prototypes.clear();
    geometry.clear();
    materials.clear();
    textures.clear();
  }
  async function load(
    url = '/__sunken-dev/revision3/tripo-kit.glb',
    names = ['pillar', 'reef_cluster'],
  ) {
    try {
      const gltf = await new GLTFLoader().loadAsync(url);
      gltf.scene.updateMatrixWorld(true);
      // Register all resources first so malformed prototypes still clean up on Retry.
      gltf.scene.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        geometry.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!(m instanceof T.MeshStandardMaterial))
            throw Error('Sunken PBR kit requires standard glTF materials');
          if (materials.has(m)) continue;
          materials.add(m);
          for (const value of Object.values(m))
            if (value instanceof T.Texture) {
              value.anisotropy = 4;
              textures.add(value);
            }
          adapt(m);
        }
      });
      for (const node of gltf.scene.children) {
        const parts: SunkenPbrPart[] = [];
        node.traverse((o) => {
          if (!(o instanceof T.Mesh)) return;
          if (Array.isArray(o.material))
            throw Error('Export one glTF primitive per material');
          const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
          geometry.add(g);
          parts.push({
            geometry: g,
            material: o.material as T.MeshStandardMaterial,
          });
        });
        parts.sort((a, b) => a.material.name.localeCompare(b.material.name));
        prototypes.set(node.name, parts);
      }
      for (const name of names) {
        const count = prototypes.get(name)?.length;
        if (
          !count ||
          ['_lod', '_far'].some(
            (s) => prototypes.get(name + s)?.length !== count,
          )
        )
          throw Error(`Incomplete Sunken PBR LODs: ${name}`);
      }
    } catch (error) {
      dispose();
      throw error;
    }
  }
  return {
    prototypes,
    load,
    dispose,
    metrics: () => ({
      geometries: geometry.size,
      materials: materials.size,
      textures: textures.size,
    }),
  };
}
