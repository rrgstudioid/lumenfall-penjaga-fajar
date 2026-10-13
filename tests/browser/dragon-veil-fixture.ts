import * as T from 'three';
import {
  createCharacterModel,
  disposeCharacterModel,
} from '../../lib/game/character-model.ts';
import { createNewCharacter, equipItem } from '../../lib/game/rules.ts';
import { createItem } from '../../lib/game/items.ts';
import { DRAGON_VEIL_PIECES } from '../../lib/game/dragon-veil.ts';
import {
  dragonVeilCacheStats,
  releaseUnusedDragonVeilAssets,
} from '../../lib/game/dragon-veil-model.ts';
import type { CharacterAction } from '../../lib/game/character-animation.ts';
const scene = new T.Scene();
scene.background = new T.Color('#18232b');
const renderer = new T.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const camera = new T.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 40);
scene.add(new T.HemisphereLight('#fff4da', '#36524d', 2.8));
for (const [x, z] of [
  [3, -4],
  [-3, 4],
]) {
  const light = new T.DirectionalLight('#fff0de', 2.4);
  light.position.set(x, 4, z);
  light.castShadow = true;
  scene.add(light);
}
const floor = new T.Mesh(
  new T.CircleGeometry(2.5, 64),
  new T.MeshStandardMaterial({ color: '#30443a', roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.015;
floor.receiveShadow = true;
scene.add(floor);
let model: ReturnType<typeof createCharacterModel> | undefined;
let view = 'front',
  mask = 15;
function render(next = view) {
  view = next;
  const views: Record<string, number[]> = {
    front: [0, 1.5, -6.8],
    back: [0, 1.5, 6.8],
    side: [6.8, 1.5, 0],
    quarter: [3.6, 2, -5.5],
    close: [0, 1.85, -3.3],
    'legs-front': [0, 0.78, -2.9],
    'legs-back': [0, 0.78, 2.9],
    'legs-side': [2.9, 0.78, 0],
  };
  camera.position.fromArray(views[view]);
  camera.lookAt(
    0,
    view.startsWith('legs-') ? 0.78 : view === 'close' ? 1.65 : 1.25,
    0,
  );
  renderer.render(scene, camera);
  document.querySelector('#label')!.textContent =
    `Dragon Veil · slots ${mask} · ${view} · ${model?.actor.userData.equipmentStatus}`;
}
async function build(
  nextMask = 15,
  wings = false,
  hair = 'hair_01',
  preview = false,
  enhancements: number | Record<string, number> = 0,
) {
  if (model) {
    scene.remove(model.actor);
    disposeCharacterModel(model.actor);
  }
  mask = nextMask;
  const hero = createNewCharacter('dv-fitting', 'Dragon Veil', {
    gender: 'male',
    hairStyleId: hair,
  });
  const levelFor = (id: string) =>
    typeof enhancements === 'number' ? enhancements : (enhancements[id] ?? 0);
  hero.inventory.find(
    (item) => item.id === hero.equipment.mainHand,
  )!.enhancementLevel = levelFor('mainHand');
  for (let i = 0; i < DRAGON_VEIL_PIECES.length; i++)
    if (mask & (1 << i)) {
      const item = createItem(DRAGON_VEIL_PIECES[i].id, {
        enhancementLevel: levelFor(DRAGON_VEIL_PIECES[i].id),
      });
      hero.inventory.push(item);
      equipItem(hero, item.id);
    }
  if (wings) {
    const item = createItem('dragon-veil-wings', {
      enhancementLevel: levelFor('dragon-veil-wings'),
    });
    hero.inventory.push(item);
    equipItem(hero, item.id);
  }
  const candidate = createCharacterModel(hero, {
    renderer,
    quality: 'high',
    preview,
  });
  model = candidate;
  scene.add(candidate.actor);
  const [body, equipment] = await Promise.all([
    candidate.ready,
    candidate.equipmentReady,
    candidate.accessoryReady,
  ]);
  if (model === candidate) {
    candidate.animator.update(0);
    render();
  }
  return { ...snapshot(candidate), ready: body && equipment };
}
function pose(kind: string, time = 0.3, nextView = view) {
  model!.animator.reset();
  if (
    ['basic_attack', 'ranged_attack', 'magic_cast', 'dash', 'hit'].includes(
      kind,
    )
  )
    model!.animator.play(kind as CharacterAction, 1.0);
  for (let t = 0; t < time; t += 1 / 60)
    model!.animator.update(1 / 60, {
      moving: ['walk', 'run', 'swim'].includes(kind),
      sprinting: kind === 'run',
      dead: kind === 'dead',
      movementMode: kind === 'swim' ? 'underwater' : 'ground',
    });
  render(nextView);
  return snapshot();
}
function snapshot(target = model) {
  if (!target) return { pieces: [], cache: dragonVeilCacheStats() };
  target.actor.updateMatrixWorld(true);
  const pieces: Array<{
      id: string;
      lod: number;
      min: number[];
      max: number[];
    }> = [],
    hair: string[] = [];
  target.actor.traverse((o) => {
    if (o.visible && o.userData.assetPath?.startsWith('hair/'))
      hair.push(o.userData.assetPath);
    if (o instanceof T.SkinnedMesh && o.userData.dragonVeil) {
      o.skeleton.update();
      o.computeBoundingBox();
      const box = new T.Box3().setFromObject(o);
      pieces.push({
        id: o.userData.templateId,
        lod: o.userData.lod,
        min: box.min.toArray(),
        max: box.max.toArray(),
      });
    }
  });
  return {
    pieces,
    emission: emissionSnapshot(target.actor),
    hair,
    status: target.actor.userData.equipmentStatus,
    disposed: !!target.actor.userData.disposed,
    cache: dragonVeilCacheStats(),
    calls: renderer.info.render.calls,
  };
}
function emissionSnapshot(actor: T.Object3D) {
  const values: Array<{ id: string; level: number; intensity: number }> = [];
  actor.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    let owner: T.Object3D | null = object;
    while (owner && !owner.userData.templateId) owner = owner.parent;
    if (!owner) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      if (!(material instanceof T.MeshStandardMaterial)) continue;
      const glow = material.userData.equipmentEmissive;
      values.push({
        id: owner.userData.templateId,
        level: glow?.level ?? 0,
        intensity: glow?.intensity ?? 0,
      });
    }
  });
  return values;
}
Object.assign(window, {
  dragonVeilQA: {
    build,
    render,
    pose,
    snapshot,
    model: () => model,
    appearance: async (
      value: Parameters<
        ReturnType<typeof createCharacterModel>['setAppearance']
      >[0],
    ) => {
      await model!.setAppearance(value);
      render();
      return snapshot();
    },
    lod: async (n: 0 | 1 | 2 | 3) => {
      await model!.setVisualLOD(n);
      render();
      return snapshot();
    },
    dispose: () => {
      const watched = new Map<T.Material, number>();
      if (model) {
        model.actor.traverse((o) => {
          if (!(o instanceof T.Mesh)) return;
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            if (!m.userData.equipmentEmissive || watched.has(m)) continue;
            watched.set(m, 0);
            m.addEventListener('dispose', () =>
              watched.set(m, watched.get(m)! + 1),
            );
          }
        });
        scene.remove(model.actor);
        disposeCharacterModel(model.actor);
        model = undefined;
      }
      releaseUnusedDragonVeilAssets();
      return { ...snapshot(), disposedEmission: [...watched.values()] };
    },
  },
});
await build();
