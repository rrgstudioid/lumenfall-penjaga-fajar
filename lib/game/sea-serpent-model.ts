import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import {
  SERPENT_BOSS_ID,
  GUARDIAN_ATTACKS,
  BOSS_ATTACKS,
} from './sea-serpent-combat.ts';
import {
  SERPENT_BOSS_LENGTH,
  SERPENT_GUARDIAN_LENGTH,
} from './abysal-trench-population.ts';
export type SerpentVisual = {
  update(dt: number, clip: string, time?: number, distance?: number): void;
  dispose(): void;
};
/** Empty during the region loading lock; never substitutes a finished creature. */
export function createSerpentBody(id: string) {
  const boss = id === SERPENT_BOSS_ID,
    length = boss ? SERPENT_BOSS_LENGTH : SERPENT_GUARDIAN_LENGTH;
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute([], 3));
  const body = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({ visible: false }),
  );
  body.name = id;
  body.userData.navigationRadius = length * 0.5 + 1;
  body.userData.combatShape = {
    halfLength: length * 0.38,
    radius: length * 0.07,
  };
  body.userData.labelHeight = length * 0.22;
  body.userData.serpent = true;
  return body;
}
/** Map-owned prototypes share PBR textures/geometry; clones own bones and mixers. */
export function createSerpentKit() {
  const assets = new Map<string, GLTF>(),
    visuals = new Set<SerpentVisual>();
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    visuals.forEach((v) => v.dispose());
    visuals.clear();
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>(),
      textures = new Set<T.Texture>();
    for (const gltf of assets.values())
      gltf.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          geometries.add(o.geometry);
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            materials.add(m);
            for (const v of Object.values(m))
              if (v instanceof T.Texture) textures.add(v);
          }
        }
      });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => {
      t.dispose();
      if (typeof t.image?.close === 'function') t.image.close();
    });
    assets.clear();
  }
  return {
    async load() {
      for (const name of ['serpent-guardian', 'sea-serpent-boss']) {
        const gltf = await new GLTFLoader().loadAsync(
          `/assets/maps/sunken-ruins/revision13/${name}.glb`,
        );
        assets.set(name, gltf);
        const required =
          name === 'serpent-guardian' ? GUARDIAN_ATTACKS : BOSS_ATTACKS;
        for (const a of required)
          if (!gltf.animations.some((c) => c.name === a.id))
            throw Error(`Missing serpent animation ${a.id}`);
      }
    },
    attach(body: T.Mesh) {
      const boss = body.name === SERPENT_BOSS_ID,
        gltf = assets.get(boss ? 'sea-serpent-boss' : 'serpent-guardian');
      if (!gltf || disposed) throw Error('Serpent kit unavailable');
      const model = clone(gltf.scene),
        mixer = new T.AnimationMixer(model);
      const ownMaterials: T.Material[] = [],
        skeletons = new Set<T.Skeleton>(),
        meshes: T.Mesh[] = [];
      const hitFlash = { value: 0 };
      model.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false;
          meshes.push(o);
          o.visible = !o.name.includes('_LOD');
          o.material = (
            Array.isArray(o.material) ? o.material : [o.material]
          ).map((m) => {
            const c = m.clone();
            if (c instanceof T.MeshStandardMaterial) {
              c.metalness = 0.08;
              c.roughness = 0.65;
              c.aoMapIntensity = 0.6;
              // Texture-colored ambient floor keeps the imported skin legible in
              // abyssal shadows without brightening terrain or adding 200 lights.
              c.onBeforeCompile = (shader) => {
                shader.uniforms.serpentHitFlash = hitFlash;
                shader.fragmentShader =
                  'uniform float serpentHitFlash;\n' + shader.fragmentShader;
                shader.fragmentShader = shader.fragmentShader.replace(
                  '#include <emissivemap_fragment>',
                  '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.20 + vec3(1.0, 0.35, 0.2) * serpentHitFlash;',
                );
              };
              c.customProgramCacheKey = () => 'serpent-abyssal-skin-v2';
            }
            ownMaterials.push(c);
            return c;
          });
          if (o.material.length === 1) o.material = o.material[0];
          o.userData.serpentSharedGeometry = true;
        }
        if (o instanceof T.SkinnedMesh) skeletons.add(o.skeleton);
      });
      body.add(model);
      const actions = new Map(
        gltf.animations.map((c) => [c.name, mixer.clipAction(c)]),
      );
      let active: T.AnimationAction | undefined,
        last = '',
        released = false;
      const visual: SerpentVisual = {
        update(dt, clip, time, distance = 0) {
          hitFlash.value =
            (body.material as T.MeshStandardMaterial).emissiveIntensity > 1
              ? 0.7
              : 0;
          const lod = distance > 90 ? 2 : distance > 45 ? 1 : 0;
          for (const o of meshes)
            o.visible =
              lod === 0
                ? !o.name.includes('_LOD')
                : o.name.endsWith(`_LOD${lod}`);
          const next = actions.get(clip) ?? actions.get('idle')!;
          if (clip !== last) {
            const prev = active;
            next.reset().setEffectiveWeight(1).play();
            next.clampWhenFinished = true;
            next.setLoop(
              clip === 'idle' || clip === 'swim' ? T.LoopRepeat : T.LoopOnce,
              Infinity,
            );
            if (prev && prev !== next) next.crossFadeFrom(prev, 0.16, false);
            active = next;
            last = clip;
          }
          mixer.update(dt);
          if (time !== undefined && active) {
            active.time = Math.min(time, active.getClip().duration);
            mixer.update(0);
          }
          body.userData.activeSerpentAnimation = last;
        },
        dispose() {
          if (released) return;
          released = true;
          mixer.stopAllAction();
          mixer.uncacheRoot(model);
          skeletons.forEach((s) => s.dispose());
          ownMaterials.forEach((m) => m.dispose());
          model.removeFromParent();
          visuals.delete(visual);
        },
      };
      body.userData.serpentVisual = visual;
      visuals.add(visual);
      visual.update(0, 'idle');
      return visual;
    },
    dispose,
  };
}
