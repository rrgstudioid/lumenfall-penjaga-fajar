import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { alignCrimsonSword, CRIMSON_SWORD_GRIP, setupCrimsonSwordGlow, updateCrimsonSwordGlow } from './special-sword-model.ts';
import { createCharacterModel, disposeCharacterModel } from './character-model.ts';
import { freshHero, createItem } from './rules.ts';
import { SWORD_AURA, updateSwordAuras } from './sword-aura.ts';

async function actualSword() {
  const bytes = await readFile(new URL('../../public/assets/equipment/jayantara-two-hand-sword/altiverse_crimson_sword.glb', import.meta.url));
  const loader = new GLTFLoader();
  // Geometry and the complete real GLB hierarchy; only textures need a browser.
  loader.register(() => ({ name: 'test-material', loadMaterial: () => Promise.resolve(new T.MeshBasicMaterial()) }));
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}

await test('real Crimson GLB handle is at the palm and its blade points forward in every heading', async () => {
  const source = await actualSword();
  const fitted = alignCrimsonSword(source, 1.1);
  const blade = fitted.getObjectByName('sword_swordTX_0') as T.Mesh;
  const hero = freshHero();
  const item = createItem('legacy-fajar-blade');
  hero.inventory.push(item); hero.equipment.mainHand = item.id;
  const character = createCharacterModel(hero, { aura: false });
  const holder = character.actor.getObjectByName('equipment:mainHand')!;
  holder.add(fitted);
  const grip = () => blade.localToWorld(CRIMSON_SWORD_GRIP.clone());
  const tip = () => blade.localToWorld(new T.Vector3(0, 0, blade.geometry.boundingBox!.min.z));
  const palm = () => character.rig.rightHand.getWorldPosition(new T.Vector3());

  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    character.actor.rotation.y = yaw;
    character.actor.position.set(8, 2, -17);
    assert.ok(grip().distanceTo(palm()) < 1e-6, 'actual mesh handle, not wrapper origin, meets palm');
    const forward = new T.Vector3(0, 0, -1).applyQuaternion(character.actor.quaternion);
    assert.ok(tip().sub(grip()).normalize().dot(forward) > .97);
    assert.ok(tip().y > grip().y, 'slightly raised blade');
  }
  for (const motion of [{ moving: true }, { moving: true, sprinting: true }, {}]) {
    character.animator.reset();
    if (!('moving' in motion)) character.animator.play('basic_attack', .6);
    for (let frame = 0; frame < 90; frame++) {
      character.animator.update(1 / 60, motion);
      assert.ok(grip().distanceTo(palm()) < 1e-6, 'handle cannot detach during animation');
    }
  }
  const sourceSpan = blade.geometry.boundingBox!.max.z - blade.geometry.boundingBox!.min.z;
  assert.ok(Math.abs(fitted.scale.x * sourceSpan - 1.1) < 1e-8);
  assert.equal(fitted.scale.x, fitted.scale.y);
  assert.equal(fitted.scale.x, fitted.scale.z, 'no distorted proportions');
  assert.ok(fitted.getObjectByName('core_coreTX_0'));
  assert.ok(fitted.getObjectByName('eye_eyeTX_0'));
  disposeCharacterModel(character.actor);
});

await test('an unexpected GLB cannot silently attach at an arbitrary guessed offset', () => {
  assert.throws(() => alignCrimsonSword(new T.Group(), 1.55), /mesh is missing/);
});

await test('Meteor Sword orange emissive materials pulse without changing its geometry', () => {
  const model = new T.Group();
  const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({
    name: 'sword_swordTX_0', emissive: '#ff7a20', emissiveIntensity: 0.2,
  }));
  const before = mesh.geometry.uuid;
  model.add(mesh);
  setupCrimsonSwordGlow(model);
  updateCrimsonSwordGlow(model, 0);
  const dim = (mesh.material as T.MeshStandardMaterial).emissiveIntensity;
  updateCrimsonSwordGlow(model, 1);
  const bright = (mesh.material as T.MeshStandardMaterial).emissiveIntensity;
  assert.equal(mesh.geometry.uuid, before);
  assert.ok(bright > dim);
  const emissive = (mesh.material as T.MeshStandardMaterial).emissive;
  assert.ok(emissive.r > emissive.g && emissive.g > emissive.b, 'glow stays warm orange');
  mesh.geometry.dispose(); (mesh.material as T.Material).dispose();
});

await test('Meteor Sword loads Crimson at 2.25x original size with aligned grip and +5 aura during animation', async t => {
  const source = await actualSword();
  t.mock.method(T.TextureLoader.prototype, 'load', (_url: string, onLoad: (texture: T.Texture) => void) => {
    const texture = new T.Texture(); onLoad(texture); return texture;
  });
  const load = t.mock.method(GLTFLoader.prototype, 'load', (url: string, onLoad: (gltf: { scene: T.Group }) => void) => {
    assert.equal(url, '/assets/equipment/jayantara-two-hand-sword/altiverse_crimson_sword_optimized.glb');
    queueMicrotask(() => onLoad({ scene: source }));
  });
  const hero = freshHero(), item = createItem('field-meteorfall-citadel-sword');
  assert.equal(item.name, 'Meteor Sword');
  assert.equal(item.equipmentType, 'one_hand_sword');
  assert.equal(item.twoHanded, false);
  item.enhancementLevel = 5;
  hero.inventory.push(item); hero.equipment.mainHand = item.id;
  const character = createCharacterModel(hero);
  const flame = character.aura.userData.swordFlames[0] as T.Group;
  await Promise.resolve(); // Complete the real GLB replacement callback.
  assert.equal(load.mock.callCount(), 1);
  assert.equal(character.actor.getObjectByName('SwordTip'), undefined, 'procedural placeholder is replaced');
  assert.equal(flame.parent?.name, 'CrimsonBladeAuraSocket');
  assert.equal(character.aura.userData.swordFlames.length, 1, 'reuse existing effect/atlas, not a second aura');
  assert.equal(flame.children.length, 4);
  const blade = character.actor.getObjectByName('sword_swordTX_0') as T.Mesh;
  const fitted = character.actor.getObjectByName('AltiverseCrimsonSword')!;
  const sourceSpan = blade.geometry.boundingBox!.max.z - blade.geometry.boundingBox!.min.z;
  assert.ok(Math.abs(fitted.scale.x * sourceSpan - 1.1 * 2.25) < 1e-8, 'Meteor is 25% smaller than its previous 3x size');
  assert.equal(fitted.scale.x, fitted.scale.y);
  assert.equal(fitted.scale.x, fitted.scale.z, 'enlarge all dimensions without distorting the blade');
  const halfLength = flame.parent!.userData.bladeLength / 2;
  assert.ok(Math.abs(flame.position.y - halfLength * (SWORD_AURA.sizeMultiplier - .44)) < 1e-9);
  const plane = flame.children[0] as T.Mesh<T.PlaneGeometry>;
  assert.ok(Math.abs(plane.geometry.parameters.height * flame.scale.y - halfLength * 2 * SWORD_AURA.sizeMultiplier) < 1e-9);
  assert.ok(Math.abs(plane.geometry.parameters.height * flame.scale.y - halfLength * 2 * 1.25 * 2) < 1e-9, 'GLB aura length doubles');
  assert.ok(Math.abs(plane.geometry.parameters.width * flame.scale.x - flame.parent!.userData.bladeWidth * 1.25 * 2) < 1e-9, 'GLB aura width doubles');
  for (const motion of [{ moving: true }, { moving: true, sprinting: true }, {}]) {
    character.animator.reset();
    character.animator.play('basic_attack', .6);
    for (let frame = 0; frame < 60; frame++) {
      character.actor.rotation.y = frame * .08;
      character.animator.update(1 / 60, motion);
      const base = blade.localToWorld(new T.Vector3(0, 0, 42));
      const tip = blade.localToWorld(new T.Vector3(0, 0, blade.geometry.boundingBox!.min.z));
      const centre = flame.getWorldPosition(new T.Vector3());
      assert.ok(centre.distanceTo(base.clone().lerp(tip, SWORD_AURA.sizeMultiplier / 2 - .22)) < 1e-6);
      const auraBase = flame.localToWorld(new T.Vector3(0, -plane.geometry.parameters.height / 2, 0));
      assert.ok(auraBase.distanceTo(base.clone().lerp(tip, -.22)) < 1e-6, 'small gripward offset stays fixed throughout animation');
      const palm = character.rig.rightHand.getWorldPosition(new T.Vector3());
      assert.ok(auraBase.clone().sub(palm).dot(tip.clone().sub(base)) > 0, 'aura still starts ahead of the palm');
      const axis = flame.localToWorld(new T.Vector3(0, 1, 0)).sub(centre).normalize();
      assert.ok(axis.dot(tip.clone().sub(base).normalize()) > .999999);
      assert.ok(blade.localToWorld(CRIMSON_SWORD_GRIP.clone())
        .distanceTo(character.rig.rightHand.getWorldPosition(new T.Vector3())) < 1e-6);
    }
  }
  updateSwordAuras(character.aura.userData.swordFlames, 1);
  assert.equal(flame.userData.frame, 15, 'reparenting preserves flipbook animation');
  assert.equal(character.actor.getObjectByName('EnhancedSwordInferno13'), undefined);
  assert.equal(character.actor.getObjectByName('WeaponEnergyBallAura'), undefined);
  disposeCharacterModel(character.actor);
});

await test('Jayantara Greatsword and other one-hand swords keep their procedural models and +5 aura', t => {
  const load = t.mock.method(GLTFLoader.prototype, 'load', () => {
    assert.fail('only Meteor Sword may request the Crimson GLB');
  });
  t.mock.method(T.TextureLoader.prototype, 'load', (_url: string, onLoad: (texture: T.Texture) => void) => {
    const texture = new T.Texture(); onLoad(texture); return texture;
  });
  for (const templateId of ['jayantara-two-hand-sword', 'field-sunken-ruins-sword']) {
    const hero = freshHero(), item = createItem(templateId);
    item.enhancementLevel = 5;
    hero.inventory.push(item); hero.equipment.mainHand = item.id;
    const character = createCharacterModel(hero);
    const holder = character.actor.getObjectByName('equipment:mainHand')!;
    assert.ok(holder.getObjectByName('SwordGrip'));
    assert.ok(holder.getObjectByName('SwordTip'));
    assert.equal(holder.getObjectByName('AltiverseCrimsonSword'), undefined);
    assert.equal(character.aura.userData.swordFlames[0].parent, holder);
    disposeCharacterModel(character.actor);
  }
  assert.equal(load.mock.callCount(), 0);
});
