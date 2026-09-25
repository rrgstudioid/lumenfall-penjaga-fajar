import * as T from 'three';
import { createCharacterModel, disposeCharacterModel } from '../../lib/game/character-model.ts';
import { freshHero, createItem } from '../../lib/game/rules.ts';

const scene = new T.Scene(); scene.background = new T.Color('#18232b');
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1);
renderer.outputColorSpace = T.SRGBColorSpace;
document.querySelector('body')!.appendChild(renderer.domElement);
const camera = new T.PerspectiveCamera(35, innerWidth / innerHeight, .01, 50);
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
async function equip(mode: 'unarmed' | 'one' | 'dual' | 'two' | 'female') {
  if (model) { scene.remove(model.actor); disposeCharacterModel(model.actor); }
  hero.gender = mode === 'female' ? 'female' : 'male'; clearEquipment(); hero.inventory = [];
  if (mode !== 'unarmed' && mode !== 'female') {
    const main = createItem('legacy-fajar-blade'); main.equipmentType = mode === 'two' ? 'two_hand_sword' : 'one_hand_sword';
    hero.inventory.push(main); hero.equipment.mainHand = main.id;
    if (mode === 'dual') { const off = createItem('legacy-fajar-blade'); off.equipmentType = 'one_hand_sword'; hero.inventory.push(off); hero.equipment.offHand = off.id; }
  }
  const before = JSON.stringify(hero);
  // Use the default production factory, including its actual gender loader.
  model = createCharacterModel(hero); scene.add(model.actor);
  if (!await model.ready) throw Error('Character load failed');
  if (JSON.stringify(hero) !== before) throw Error('Visual factory changed the save');
  pose('idle'); return snapshot();
}
function pose(kind: string) {
  model.animator.reset();
  if (kind === 'attack') model.animator.play('basic_attack', .6);
  for (let i = 0; i < 16; i++) model.animator.update(1 / 60, { moving: kind === 'run', sprinting: kind === 'run' });
  render('front');
}
function render(view = 'front') {
  const offsets: Record<string, number[]> = { front: [0, 1.45, -6.5], threeQuarter: [4.1, 2.1, -5.2], side: [6, 1.5, 0], back: [0, 1.5, 6.5], hands: [1.7, 1.4, -2.3] };
  camera.position.fromArray(offsets[view]); camera.lookAt(0, view === 'hands' ? 1.22 : 1.25, 0);
  renderer.render(scene, camera);
  document.querySelector('#status')!.textContent = `${model.actor.userData.assetKind} · ${hero.equipment.offHand ? 'Dual sword' : hero.equipment.mainHand ? 'Main-hand sword' : 'Tanpa senjata'} · ${view}`;
}
function snapshot() {
  model.actor.updateMatrixWorld(true);
  const pos = (o: T.Object3D) => o.getWorldPosition(new T.Vector3());
  const sockets = new Map<string, T.Object3D>();
  let triangles = 0, meshes = 0;
  model.actor.traverse(o => {
    sockets.set(o.name.replace(/[. _]/g, ''), o);
    if (o instanceof T.SkinnedMesh) { meshes++; triangles += o.geometry.index!.count / 3; }
  });
  return { asset: model.actor.userData.assetKind, triangles, meshes,
    nativeAnimations: model.actor.userData.nativeAnimations,
    mixer: Boolean(model.actor.userData.animationMixer),
    rightGripError: pos(sockets.get('WeaponSocketR')!).distanceTo(pos(model.sockets.rightHand)),
    leftGripError: pos(sockets.get('WeaponSocketL')!).distanceTo(pos(model.sockets.leftHand)),
    mainEquipped: Boolean(model.actor.getObjectByName('equipment:mainHand')),
    offEquipped: Boolean(model.actor.getObjectByName('equipment:offHand')),
    renderTriangles: renderer.info.render.triangles };
}
await equip('unarmed');
Object.assign(window, { __cenaReview: { equip, pose, render, snapshot } });
