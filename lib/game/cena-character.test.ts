/* oxlint-disable typescript/unbound-method */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createCharacterModel, disposeCharacterModel } from './character-model.ts';
import { freshHero, createItem } from './rules.ts';
import { CENA_CHARACTER_ASSET, CENA_CHARACTER_TRIANGLES, loadCenaCharacter } from './cena-character.ts';

await test('Cena body-only asset keeps its rig, colors and real weapon grips without source animation', async () => {
  const bytes = await readFile(new URL('../../public' + CENA_CHARACTER_ASSET, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  assert.equal(gltf.animations.length, 0);
  let triangles = 0;
  gltf.scene.traverse(o => {
    assert.ok(!o.name.startsWith('Meteor_'), 'no baked-in sword props');
    if (o instanceof T.SkinnedMesh) {
      triangles += o.geometry.index!.count / 3;
      assert.equal(o.skeleton.bones.length, 52);
      assert.ok(o.geometry.attributes.color, 'baked procedural color');
      const w = o.geometry.attributes.skinWeight;
      for (let i = 0; i < w.count; i++) assert.ok(Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1) < 1e-4);
    }
  });
  assert.equal(triangles, CENA_CHARACTER_TRIANGLES);
  const original = GLTFLoader.prototype.loadAsync;
  // Deliberately inject a named native clip; the Cena loader must still ignore it.
  gltf.animations.push(new T.AnimationClip('DualSword_Attack_01', 1, []));
  GLTFLoader.prototype.loadAsync = async () => gltf;
  try {
    const hero = freshHero();
    const main = createItem('legacy-fajar-blade'), off = createItem('legacy-fajar-blade');
    main.equipmentType = off.equipmentType = 'one_hand_sword';
    hero.inventory.push(main, off);
    hero.equipment.mainHand = main.id; hero.equipment.offHand = off.id;
    const saved = JSON.stringify(hero);
    const model = createCharacterModel(hero, { assetSource: loadCenaCharacter });
    model.actor.position.set(12, 3, -17); model.actor.rotation.y = 1.2;
    assert.equal(await model.ready, true);
    assert.equal(JSON.stringify(hero), saved);
    assert.equal(model.actor.userData.assetKind, 'cena');
    assert.deepEqual(model.actor.userData.nativeAnimations, []);
    assert.equal(model.actor.userData.animationMixer, undefined);
    const visual = model.actor.getObjectByName('CenaVisual')!;
    const pos = (o: T.Object3D) => o.getWorldPosition(new T.Vector3());
    const axis = (o: T.Object3D) => new T.Vector3(0, 1, 0).applyQuaternion(o.getWorldQuaternion(new T.Quaternion()));
    const bones = new Map<string, T.Object3D>();
    visual.traverse(o => bones.set(o.name.replace(/[. _]/g, ''), o));
    function check() {
      model.actor.updateMatrixWorld(true);
      for (const [side, slot, pivot] of [['R', 'mainHand', model.sockets.rightHand], ['L', 'offHand', model.sockets.leftHand]] as const) {
        const socket = bones.get('WeaponSocket' + side)!;
        const holder = model.actor.getObjectByName('equipment:' + slot)!;
        assert.ok(pos(socket).distanceTo(pos(pivot)) < 1e-5, `${slot} grip position`);
        const alignment = axis(socket).dot(axis(holder));
        assert.ok(alignment > .999, `${slot} fitted grip orientation: ${alignment}`);
      }
      visual.traverse(o => {
        if (!(o instanceof T.SkinnedMesh)) return;
        o.skeleton.update();
        const vertex = new T.Vector3();
        for (let i = 0; i < o.geometry.attributes.position.count; i += 503) {
          o.getVertexPosition(i, vertex).applyMatrix4(o.matrixWorld);
          assert.ok(vertex.toArray().every(Number.isFinite));
          assert.ok(vertex.distanceTo(model.actor.position) < 5, 'bounded skin deformation');
        }
      });
    }
    check();
    const first = pos(bones.get('WeaponSocketR')!);
    for (const action of ['basic_attack', 'dash', 'magic_cast', 'hit'] as const) {
      model.animator.reset(); model.animator.play(action, .6);
      for (let i = 0; i < 45; i++) {
        model.animator.update(1 / 60, { moving: true, sprinting: i > 20 });
        if (i % 5 === 0) check();
      }
    }
    assert.ok(pos(bones.get('WeaponSocketR')!).distanceTo(first) > .01);
    assert.deepEqual(model.actor.position.toArray(), [12, 3, -17]);
    assert.equal(model.actor.userData.activeNativeAnimation, undefined);
    const copy = await loadCenaCharacter();
    const meshA: T.SkinnedMesh[] = [], meshB: T.SkinnedMesh[] = [];
    visual.traverse(o => { if (o instanceof T.SkinnedMesh) meshA.push(o); });
    copy.traverse(o => { if (o instanceof T.SkinnedMesh) meshB.push(o); });
    assert.notEqual(meshA[0].skeleton, meshB[0].skeleton);
    assert.notEqual(meshA[0].geometry, meshB[0].geometry);
    assert.notEqual(meshA[0].material, meshB[0].material);
    disposeCharacterModel(model.actor);
    assert.ok(meshB[0].skeleton.bones.every(b => b.parent));
    disposeCharacterModel(copy);
  } finally { GLTFLoader.prototype.loadAsync = original; }
});
