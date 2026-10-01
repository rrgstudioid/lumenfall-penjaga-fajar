import * as T from 'three';
import { createCharacterModel, disposeCharacterModel } from '../../lib/game/character-model.ts';
import { createNewCharacter, equipItem } from '../../lib/game/rules.ts';
import { createItem } from '../../lib/game/items.ts';

const scene = new T.Scene(); scene.background = new T.Color('#18232b');
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1);
document.body.appendChild(renderer.domElement);
const camera = new T.PerspectiveCamera(35, innerWidth / innerHeight, .1, 40);
scene.add(new T.HemisphereLight('#fff4da', '#36524d', 2.8));
for (const [x, z] of [[3, -4], [-3, 4]]) {
  const light = new T.DirectionalLight('#fff0de', 2.4); light.position.set(x, 4, z); scene.add(light);
}
const floor = new T.Mesh(new T.CircleGeometry(2.5, 64), new T.MeshStandardMaterial({ color: '#30443a', roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.015; scene.add(floor);
let model: ReturnType<typeof createCharacterModel>;
async function build() {
  if (model) { scene.remove(model.actor); disposeCharacterModel(model.actor); }
  const hero = createNewCharacter('wing-fitting', 'Wing Fitting', { gender: 'male' });
  hero.equipment.mainHand = null;
  const wings = createItem('dragon-veil-wings'); hero.inventory.push(wings); equipItem(hero, wings.id);
  model = createCharacterModel(hero, { renderer, preview: true }); scene.add(model.actor);
  await Promise.all([model.ready, model.accessoryReady]);
  model.animator.update(0); render('back');
  return snapshot();
}
function render(view = 'back') {
  const views: Record<string, number[]> = { front: [0, 1.6, -7], back: [0, 1.6, 7], side: [6.5, 1.6, 0], quarter: [4.6, 2.2, 5] };
  camera.position.fromArray(views[view]); camera.lookAt(0, 1.25, .25); renderer.render(scene, camera);
  document.querySelector('#label')!.textContent = `Dragon Veil Wings · ${model.actor.userData.gender} · ${view}`;
}
function pose(kind: string, view = 'back') {
  model.animator.reset();
  if (kind === 'attack') model.animator.play('basic_attack', .6);
  for (let i = 0; i < 18; i++) model.animator.update(1 / 60, { moving: kind === 'walk' || kind === 'run', sprinting: kind === 'run' });
  render(view); return snapshot();
}
function snapshot() {
  model.actor.updateMatrixWorld(true);
  const wings = model.actor.getObjectByName('DragonVeilWings')!;
  const bounds = new T.Box3().setFromObject(wings);
  const socket = model.sockets.accessory;
  return { status: model.actor.userData.accessoryStatus, gender: model.actor.userData.gender,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    socket: socket.getWorldPosition(new T.Vector3()).toArray(), parent: socket.parent?.name,
    local: wings.matrix.toArray(), meshCount: wings.children.length };
}
Object.assign(window, { wingsQA: { build, render, pose, snapshot, model: () => model } });
await build();
