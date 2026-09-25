import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createCharacterModel, disposeCharacterModel } from './character-model.ts';
import { freshHero, createItem } from './rules.ts';

function equipped() {
  const hero = freshHero();
  const source = createItem('legacy-fajar-blade');
  for (const slot of ['mainHand', 'gloves', 'boots', 'legs', 'ring1', 'necklace', 'earring1'] as const) {
    const item = { ...source, id: `model-test-${slot}` };
    hero.inventory.push(item); hero.equipment[slot] = item.id;
  }
  return hero;
}
const point = (object: T.Object3D) => object.getWorldPosition(new T.Vector3());

await test('temporary aura switch disables legacy body, weapon and ember effects', () => {
  for (const options of [undefined, { aura: true }, { aura: false }]) {
    // No DOM/TextureLoader stub: disabled aura must not request its atlas either.
    const m = createCharacterModel(equipped(), options);
    assert.equal(m.aura.visible, false);
    assert.equal(m.aura.userData.enabled, false);
    assert.equal(m.aura.userData.bodyEnabled, false);
    assert.equal(m.aura.userData.weaponEnabled, false);
    assert.equal(m.aura.children.length, 0);
    assert.equal(m.actor.getObjectByName('RedAuraWeaponFlipbook'), undefined);
    assert.equal(m.actor.getObjectByName('RedAuraBodyFlipbook'), undefined);
    assert.ok(m.sockets.rightHand.children.length > 0, 'weapon itself remains equipped');
    disposeCharacterModel(m.actor);
  }
});

await test('loading character keeps attachment pivots without the retired procedural body', () => {
  const m = createCharacterModel(freshHero(), { aura: false });
  assert.equal(m.rig.leftLowerLeg.parent, m.rig.leftUpperLeg);
  assert.equal(m.rig.rightFoot.parent, m.rig.rightLowerLeg);
  assert.equal(m.rig.rightLowerArm.parent, m.rig.rightUpperArm);
  assert.equal(m.sockets.rightHand.parent, m.rig.rightHand);
  assert.equal(m.sockets.back.parent, m.rig.chest);
  let meshes = 0, triangles = 0;
  m.actor.traverse(object => {
    assert.ok(!(object instanceof T.Bone) && !(object instanceof T.SkinnedMesh));
    if (object instanceof T.Mesh) { meshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; }
  });
  assert.ok(meshes <= 6 && triangles < 500, 'only equipment/accessory geometry remains during GLB loading');
  assert.equal(m.actor.userData.assetKind, 'cena-loading');
  assert.ok(m.actor.userData.heightMeters > 2.3 && m.actor.userData.heightMeters < 2.5, 'keeps the previous game model scale');
  disposeCharacterModel(m.actor);
});

await test('walk moves both full leg chains in opposite phases and settles when stopped', () => {
  const m = createCharacterModel(freshHero(), { aura: false });
  const before = point(m.rig.rightFoot);
  m.animator.update(.15, { moving: true });
  assert.ok(m.rig.rightUpperLeg.rotation.x * m.rig.leftUpperLeg.rotation.x < 0);
  assert.ok(point(m.rig.rightFoot).distanceTo(before) > .1);
  assert.ok(Math.abs(m.rig.leftLowerLeg.rotation.x) > .05);
  assert.equal(m.actor.position.length(), 0, 'procedural pose cannot move the gameplay anchor');
  for (let i = 0; i < 120; i++) m.animator.update(1/60);
  assert.ok(Math.abs(m.rig.rightUpperLeg.rotation.x) < .0001);
  disposeCharacterModel(m.actor);
});

await test('equipment follows its owning joints during walk, attack and body turn', () => {
  const m = createCharacterModel(equipped(), { aura: false });
  const weapon = m.actor.getObjectByName('equipment:mainHand')!;
  const glove = m.actor.getObjectByName('equipment:gloves:right')!;
  const boot = m.actor.getObjectByName('equipment:boots:right')!;
  assert.equal(glove.parent, m.rig.rightHand);
  assert.equal(boot.parent, m.rig.rightFoot);
  assert.equal(m.actor.getObjectByName('equipment:ring1')!.parent, m.rig.rightHand);
  assert.equal(m.actor.getObjectByName('equipment:earring1')!.parent, m.rig.head);
  const before = point(weapon);
  m.animator.play('basic_attack'); m.animator.update(.15, { moving: true });
  assert.ok(point(weapon).distanceTo(before) > .3);
  assert.ok(point(weapon).distanceTo(point(m.rig.rightHand)) < 1e-6);
  assert.ok(point(boot).distanceTo(point(m.rig.rightFoot)) < 1e-6);
  m.actor.rotation.y = 1.4; m.actor.position.set(12, 3, -5);
  assert.ok(point(weapon).distanceTo(point(glove)) < 1e-6);
  disposeCharacterModel(m.actor);
});

await test('timed attack/cast poses complete, stay finite, and restore across equipment rebuilds', () => {
  const m = createCharacterModel(equipped(), { aura: false });
  for (const action of ['basic_attack', 'ranged_attack', 'magic_cast', 'dash', 'hit'] as const) {
    m.animator.reset(); m.animator.play(action, .5); m.animator.update(.2);
    const pose = m.animator.snapshot();
    const replacement = createCharacterModel(equipped(), { aura: false }); replacement.animator.restore(pose);
    assert.ok(replacement.rig.rightUpperArm.rotation.x === m.rig.rightUpperArm.rotation.x);
    replacement.actor.traverse(object => assert.ok([...object.position, ...object.quaternion].every(Number.isFinite)));
    m.animator.update(1);
    assert.equal(m.animator.snapshot().action, null);
    assert.equal(m.rig.root.position.z, 0);
    disposeCharacterModel(replacement.actor);
  }
  m.animator.update(1, { dead: true }); assert.ok(m.rig.hips.position.y < .7);
  m.animator.reset(); assert.ok(m.rig.hips.position.y > .9);
  disposeCharacterModel(m.actor);
});

await test('swords are held at the grip centre and point forward relative to character facing', () => {
  for (const equipmentType of ['one_hand_sword', 'two_hand_sword'] as const) {
    const hero = equipped();
    hero.inventory.find(item => item.id === hero.equipment.mainHand)!.equipmentType = equipmentType;
    const m = createCharacterModel(hero, { aura: false });
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      m.actor.rotation.y = yaw;
      const grip = point(m.actor.getObjectByName('SwordGrip')!);
      const tip = point(m.actor.getObjectByName('SwordTip')!);
      const forward = new T.Vector3(0, 0, -1).applyQuaternion(m.actor.quaternion);
      assert.ok(grip.distanceTo(point(m.rig.rightHand)) < 1e-6);
      assert.ok(tip.sub(grip).normalize().dot(forward) > .98, 'tip faces forward, not up the arm');
    }
    for (const motion of [{ moving: true }, { moving: true, sprinting: true }]) {
      m.animator.reset();
      for (let frame = 0; frame < 90; frame++) {
        m.animator.update(1 / 60, motion);
        const grip = point(m.actor.getObjectByName('SwordGrip')!);
        const tip = point(m.actor.getObjectByName('SwordTip')!);
        const forward = new T.Vector3(0, 0, -1).applyQuaternion(m.actor.quaternion);
        assert.ok(grip.distanceTo(point(m.rig.rightHand)) < 1e-6);
        assert.ok(tip.sub(grip).normalize().dot(forward) > .45, 'walk/run keeps the sword ahead');
      }
    }
    m.animator.reset(); m.animator.play('basic_attack', .5);
    for (let frame = 0; frame < 45; frame++) {
      m.animator.update(1 / 60);
      assert.ok(point(m.actor.getObjectByName('SwordGrip')!).distanceTo(point(m.rig.rightHand)) < 1e-6);
      assert.ok(point(m.actor.getObjectByName('SwordTip')!).y > .05);
    }
    disposeCharacterModel(m.actor);
  }
});

await test('all sword-like equipment uses the owning hand and points forward, including twin blades', () => {
  const swordTemplates = ['legacy-fajar-blade', 'jayantara-two-hand-sword', 'caroq-daggers', 'anom-dagger'];
  for (const templateId of swordTemplates) {
    const hero = freshHero();
    const item = createItem(templateId);
    hero.inventory.push(item);
    hero.equipment.mainHand = item.id;
    if (item.offHand) hero.equipment.offHand = item.id;
    const model = createCharacterModel(hero, { aura: false });
    const slots = item.offHand ? ['mainHand', 'offHand'] as const : ['mainHand'] as const;
    for (const slot of slots) {
      const holder = model.actor.getObjectByName(`equipment:${slot}`)!;
      const grip = holder.getObjectByName(item.equipmentType === 'one_hand_sword' || item.equipmentType === 'two_hand_sword' ? 'SwordGrip' : 'DaggerGrip')!;
      const tip = holder.getObjectByName(item.equipmentType === 'one_hand_sword' || item.equipmentType === 'two_hand_sword' ? 'SwordTip' : 'DaggerTip')!;
      const hand = slot === 'mainHand' ? model.rig.rightHand : model.rig.leftHand;
      const forward = new T.Vector3(0, 0, -1);
      assert.ok(point(grip).distanceTo(point(hand)) < 1e-6, `${templateId} ${slot} grip is in hand`);
      assert.ok(point(tip).sub(point(grip)).normalize().dot(forward) > .98, `${templateId} ${slot} blade points forward`);
    }
    disposeCharacterModel(model.actor);
  }
});

await test('creating/animating a character does not mutate saved equipment or stats', () => {
  const hero = equipped(), before = JSON.stringify(hero);
  const m = createCharacterModel(hero, { aura: false });
  m.animator.play('magic_cast'); m.animator.update(.1, { moving: true, sprinting: true });
  assert.equal(JSON.stringify(hero), before);
  disposeCharacterModel(m.actor);
});

await test('owned geometry, materials and textures dispose once including shared equipment material', () => {
  const m = createCharacterModel(equipped(), { aura: false });
  const resources = new Set<T.BufferGeometry | T.Material | T.Texture>();
  m.actor.traverse(object => {
    if (object instanceof T.Mesh) {
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
    }
  });
  const material = m.actor.getObjectByName('equipment:mainHand')!.children[0] as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
  material.material.map = new T.Texture(); resources.add(material.material.map);
  const counts = new Map<unknown, number>();
  resources.forEach(resource => resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1)));
  disposeCharacterModel(m.actor);
  resources.forEach(resource => assert.equal(counts.get(resource), 1));
});
