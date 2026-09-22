import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createCharacterModel, disposeCharacterModel } from './character-model.ts';
import { freshHero, createItem } from './rules.ts';
import { HUNYUAN_CHARACTER_ASSET, HUNYUAN_CHARACTER_TRIANGLES, loadHunyuanCharacter } from './hunyuan-character.ts';

test('Hunyuan body loads with texture, animates, and keeps equipment at both grip sockets', async () => {
  // Node has no image decoder; retain the embedded PNG dimensions for loader validation.
  Object.assign(globalThis, { self: globalThis, createImageBitmap: async (blob: Blob) => {
    const bytes = new DataView(await blob.arrayBuffer());
    return { width: bytes.getUint32(16), height: bytes.getUint32(20), close() {} };
  }});
  const bytes = await readFile(new URL('../../public'+HUNYUAN_CHARACTER_ASSET, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength), '');
  const original = GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync = async () => gltf;
  try {
    const hero = freshHero();
    const sword = createItem('legacy-fajar-blade');
    hero.inventory.push(sword); hero.equipment.mainHand = sword.id;
    const saved = JSON.stringify(hero);
    const model = createCharacterModel(hero, { assetSource: loadHunyuanCharacter });
    model.actor.position.set(12, 3, -17); model.actor.rotation.y = 1.2;
    assert.equal(await model.ready, true);
    assert.equal(JSON.stringify(hero), saved, 'loading must preserve save progress and equipment');
    assert.equal(model.actor.userData.assetKind, 'astra-hunyuan');
    const visual = model.actor.getObjectByName('AstraHunyuanVisual')!;
    assert.ok(visual);
    const body = model.actor.getObjectByName('AstraHunyuanBody') as T.SkinnedMesh;
    assert.ok(body.isSkinnedMesh);
    assert.equal(body.geometry.index!.count/3, HUNYUAN_CHARACTER_TRIANGLES);
    assert.deepEqual([(body.material as T.MeshStandardMaterial).map!.image.width,
      (body.material as T.MeshStandardMaterial).map!.image.height], [2048, 2048]);
    assert.deepEqual(new Set(model.actor.userData.nativeAnimations), new Set(['Run', 'Walk',
      'DualSword_Attack_01', 'DualSword_Attack_02', 'DualSword_Attack_03']));
    const weights = body.geometry.attributes.skinWeight;
    for (let i=0; i<weights.count; i++)
      assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<.0001);
    const wp = (o:T.Object3D) => o.getWorldPosition(new T.Vector3());
    const joints = new Map<string,T.Object3D>();
    visual.traverse(o=>joints.set(o.name.replace(/[. _]/g,''),o));
    const grip = joints.get('WeaponSocketR')!;
    const first = wp(grip), vertex = new T.Vector3();
    function check() {
      model.actor.updateMatrixWorld(true); body.skeleton.update();
      assert.ok(wp(grip).distanceTo(wp(model.sockets.rightHand)) < 1e-5, 'right-hand grip');
      assert.ok(wp(joints.get('WeaponSocketL')!).distanceTo(wp(model.sockets.leftHand)) < 1e-5, 'left-hand grip');
      for (let i=0; i<body.geometry.attributes.position.count; i+=157) {
        body.getVertexPosition(i,vertex).applyMatrix4(body.matrixWorld);
        assert.ok(vertex.toArray().every(Number.isFinite));
        assert.ok(vertex.distanceTo(model.actor.position)<4, 'bounded skin deformation');
      }
    }
    for (let i=0;i<90;i++) { model.animator.update(1/60,{moving:true,sprinting:true,speed:5.2}); if(i%5===0)check(); }
    assert.equal(model.actor.userData.activeNativeAnimation,'Run');
    assert.ok(wp(grip).distanceTo(first)>.05);
    for (let combo=0;combo<3;combo++) {
      model.animator.play('basic_attack');
      for(let i=0;i<100;i++){model.animator.update(1/60);if(i%5===0)check();}
    }
    for(let i=0;i<100;i++)model.animator.update(1/60);
    assert.equal(model.actor.userData.activeNativeAnimation,'');
    check();
    const copy = await loadHunyuanCharacter();
    const other = copy.getObjectByName('AstraHunyuanBody') as T.SkinnedMesh;
    assert.notEqual(body.skeleton,other.skeleton); assert.notEqual(body.geometry,other.geometry);
    assert.notEqual(body.material,other.material);
    disposeCharacterModel(model.actor);
    assert.ok(other.skeleton.bones.every(b=>b.parent));
    disposeCharacterModel(copy);
  } finally { GLTFLoader.prototype.loadAsync = original; }
});
