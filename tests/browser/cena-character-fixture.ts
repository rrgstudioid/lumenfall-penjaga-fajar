import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createCharacterModel, disposeCharacterModel } from '../../lib/game/character-model.ts';
import { freshHero, createItem } from '../../lib/game/rules.ts';

const scene = new T.Scene(); scene.background = new T.Color('#18232b');
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1);
renderer.outputColorSpace = T.SRGBColorSpace;
document.querySelector('body')!.appendChild(renderer.domElement);
const camera = new T.PerspectiveCamera(35, innerWidth / innerHeight, .01, 50);
const controls = new OrbitControls(camera, renderer.domElement);
controls.addEventListener('change', () => renderer.render(scene, camera));
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); renderer.render(scene, camera);
});
scene.add(new T.HemisphereLight('#e8f1ff', '#60615b', 2.2));
const sun = new T.DirectionalLight('#fff2da', 2.5); sun.position.set(-3, 5, -4); scene.add(sun);
const fill = new T.DirectionalLight('#b5d8ff', 1.5); fill.position.set(4, 3, 2); scene.add(fill);
const ground = new T.Mesh(new T.CircleGeometry(5, 64), new T.MeshStandardMaterial({ color: '#36424a', roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -.01; scene.add(ground);
const hero = freshHero(); hero.gender = 'male';
function clearEquipment() {
  for (const slot of Object.keys(hero.equipment) as Array<keyof typeof hero.equipment>) hero.equipment[slot] = null;
}
clearEquipment();
let model: ReturnType<typeof createCharacterModel>;
let playback = 'idle', playbackFrames = 0, attackElapsed = 0;
async function equip(mode: 'unarmed' | 'one' | 'dual' | 'meteor' | 'two' | 'female') {
  const selector = document.getElementById('equipment');
  if (selector instanceof HTMLSelectElement) selector.value = mode;
  if (model) { scene.remove(model.actor); disposeCharacterModel(model.actor); }
  hero.gender = mode === 'female' ? 'female' : 'male'; clearEquipment(); hero.inventory = [];
  if (mode !== 'unarmed' && mode !== 'female') {
    const main = createItem(mode === 'meteor' ? 'field-meteorfall-citadel-sword' : 'legacy-fajar-blade'); main.equipmentType = mode === 'two' ? 'two_hand_sword' : 'one_hand_sword';
    hero.inventory.push(main); hero.equipment.mainHand = main.id;
    if (mode === 'dual' || mode === 'meteor') { const off = createItem(mode === 'meteor' ? 'field-meteorfall-citadel-sword' : 'legacy-fajar-blade'); off.equipmentType = 'one_hand_sword'; hero.inventory.push(off); hero.equipment.offHand = off.id; }
  }
  const before = JSON.stringify(hero);
  // Use the default production factory, including its actual gender loader.
  model = createCharacterModel(hero); scene.add(model.actor);
  if (!await model.ready) throw Error('Character load failed');
  if (JSON.stringify(hero) !== before) throw Error('Visual factory changed the save');
  pose('idle'); return snapshot();
}
function pose(kind: string) {
  playback = 'paused';
  model.animator.reset();
  if (kind === 'attack') model.animator.play('basic_attack', .6);
  for (let i = 0; i < 16; i++) model.animator.update(1 / 60, { moving: kind === 'run' || kind === 'walk', sprinting: kind === 'run' });
  render('front');
}
function play(kind: string) {
  playback = kind; attackElapsed = 0;
  if (kind !== 'attack') model.animator.reset();
  if (kind === 'attack') model.animator.play('basic_attack', .6);
}
function render(view = 'front') {
  const offsets: Record<string, number[]> = { front: [0, 1.45, -6.5], threeQuarter: [4.1, 2.1, -5.2], side: [6, 1.5, 0], back: [0, 1.5, 6.5], hands: [1.7, 1.4, -2.3], handsReverse: [-1.7, 1.4, -2.3], face: [0, 2.2, -1.05], faceSide: [1.05, 2.2, -.06], faceThreeQuarter: [.75, 2.2, -.8] };
  camera.position.fromArray(offsets[view]); controls.target.set(0, view.startsWith('face') ? 2.17 : view.startsWith('hands') ? 1.22 : 1.25, 0); controls.update();
  renderer.render(scene, camera);
  document.querySelector('#status')!.textContent = `${model.actor.userData.assetKind} · ${hero.equipment.offHand ? 'Dual sword' : hero.equipment.mainHand ? 'Main-hand sword' : 'Tanpa senjata'} · ${view}`;
}
function snapshot() {
  model.actor.updateMatrixWorld(true);
  const pos = (o: T.Object3D) => o.getWorldPosition(new T.Vector3());
  const sockets = new Map<string, T.Object3D>();
  let triangles = 0, meshes = 0, meteorModels = 0;
  model.actor.traverse(o => {
    sockets.set(o.name.replace(/[. _]/g, ''), o);
    if (o.name === 'AltiverseCrimsonSword') meteorModels++;
    if (o instanceof T.SkinnedMesh) { meshes++; triangles += o.geometry.index!.count / 3; }
  });
  const anatomyAlignment: Record<string, number> = {};
  const bladeWidthUp: Record<string, number> = {};
  if (model.actor.userData.assetKind === 'cena') {
    for (const [side, slot] of [['r', 'mainHand'], ['l', 'offHand']]) {
      const holder = model.actor.getObjectByName('equipment:' + slot);
      if (!holder) continue;
      const direction = new T.Vector3(0, 1, 0).transformDirection(holder.matrixWorld);
      const knuckles = pos(sockets.get('index01' + side)!).sub(pos(sockets.get('pinky01' + side)!)).normalize();
      anatomyAlignment[slot] = direction.dot(knuckles);
      const importedBlade = holder.getObjectByName('sword_swordTX_0');
      bladeWidthUp[slot] = Math.abs(new T.Vector3(1, 0, 0).transformDirection((importedBlade ?? holder).matrixWorld).y);
    }
  }
  return { asset: model.actor.userData.assetKind, triangles, meshes,
    playback, playbackFrames, activeClip: model.actor.userData.activeNativeAnimation ?? '',
    poseSample: ['handr', 'handl', 'footr', 'footl'].flatMap(name => {
      const bone = sockets.get(name); return bone ? pos(bone).toArray() : [];
    }),
    anatomyAlignment, bladeWidthUp, meteorModels,
    nativeAnimations: model.actor.userData.nativeAnimations,
    mixer: Boolean(model.actor.userData.animationMixer),
    rightGripError: pos(sockets.get('WeaponSocketR')!).distanceTo(pos(model.sockets.rightHand)),
    leftGripError: pos(sockets.get('WeaponSocketL')!).distanceTo(pos(model.sockets.leftHand)),
    mainEquipped: Boolean(model.actor.getObjectByName('equipment:mainHand')),
    offEquipped: Boolean(model.actor.getObjectByName('equipment:offHand')),
    renderTriangles: renderer.info.render.triangles };
}
const initialEquipment = new URLSearchParams(location.search).get('equipment');
await equip(initialEquipment === 'meteor' ? 'meteor' : 'unarmed');
if (initialEquipment === 'meteor') render('handsReverse');
const initialView = new URLSearchParams(location.search).get('view');
if (initialView && ['face', 'faceSide', 'faceThreeQuarter'].includes(initialView)) render(initialView);
Object.assign(window, { __cenaReview: { equip, pose, play, render, snapshot } });
document.querySelector('#equipment')!.addEventListener('change', async event => {
  await equip((event.target as HTMLSelectElement).value as Parameters<typeof equip>[0]);
  render('hands');
});
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.addEventListener('click', () => render(button.dataset.view)));
document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach(button => button.addEventListener('click', () => play(button.dataset.pose!)));
let previousFrame = performance.now();
renderer.setAnimationLoop(now => {
  const dt = Math.min(.05, Math.max(0, (now - previousFrame) / 1000)); previousFrame = now;
  if (model && playback !== 'paused') {
    if (playback === 'attack') {
      attackElapsed += dt;
      if (attackElapsed >= 1.65) { model.animator.play('basic_attack', .6); attackElapsed = 0; }
    }
    model.animator.update(dt, { moving: playback === 'walk' || playback === 'run', sprinting: playback === 'run', speed: playback === 'run' ? 5.2 : 3 });
    playbackFrames++;
  }
  renderer.render(scene, camera);
});
