// Tests capture prototype methods only to restore them after loader stubs.
/* oxlint-disable typescript/unbound-method */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createCharacterModel, disposeCharacterModel } from './character-model.ts';
import { REVISION02_TRIANGLES, loadRevision02Character } from './revision02-character.ts';
import { freshHero, createItem } from './rules.ts';
import { ARMY_RUNNING_ASSET } from './army-running.ts';

async function source() {
  const b = await readFile(new URL('../../public/assets/characters/male-revision-02/male-revision-02.glb', import.meta.url));
  return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene;
}
const world = (o: T.Object3D) => o.getWorldPosition(new T.Vector3());
function named(root: T.Object3D, name: string) {
  let found: T.Object3D | undefined;
  root.traverse(o => { if (o.name.replace(/[. _]/g, '') === name) found = o; });
  assert.ok(found, name); return found;
}

await test('ships the original male-base-02 GLB, not a high-poly revision', async () => {
  const scene = await source(); let total = 0, hair = 0;
  scene.traverse(o => { if (o instanceof T.Mesh) { const n = (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; total += n; if (o.name.startsWith('Hair')) hair += n; } });
  assert.equal(total, REVISION02_TRIANGLES); assert.equal(total - hair, 19134);
  assert.equal(named(scene, 'MaleRig').userData.assetVersion, 'male-base-02');
  disposeCharacterModel(scene);
});

await test('world and preview factory use the rigged revision at the existing game scale', async () => {
  const model = createCharacterModel(freshHero(), { assetSource: source });
  assert.equal(await model.ready, true);
  assert.equal(model.actor.userData.assetKind, 'male-revision-02');
  const visual = model.actor.getObjectByName('MaleRevision02Visual')!;
  assert.ok(visual); let skinned = 0;
  visual.traverse(o => { if (o instanceof T.SkinnedMesh) skinned++; });
  assert.ok(skinned >= 20);
  const size = new T.Box3().setFromObject(visual).getSize(new T.Vector3());
  assert.ok(size.y > 2.3 && size.y < 2.5, String(size.y));
  assert.ok(new T.Vector3(0,0,1).transformDirection(visual.matrixWorld).z < -.99);
  assert.equal(model.aura.visible, false);
  disposeCharacterModel(model.actor);
});

await test('weapons remain at real GLB grip sockets through motion, combat and transformed actors', async () => {
  const hero = freshHero(), sword = createItem('legacy-fajar-blade');
  hero.inventory.push(sword); hero.equipment.mainHand = sword.id;
  const model = createCharacterModel(hero, { assetSource: source });
  model.actor.position.set(12, 3, -17); model.actor.rotation.y = 1.2;
  assert.equal(await model.ready, true);
  const visual = model.actor.getObjectByName('MaleRevision02Visual')!;
  const grip = named(visual, 'WeaponSocketR');
  const first = world(grip);
  for (const action of ['basic_attack','ranged_attack','magic_cast','dash','hit'] as const) {
    model.animator.reset(); model.animator.play(action, .6);
    for (let i=0;i<40;i++) {
      model.animator.update(1/60, { moving: true, sprinting: i > 20, blocking: i < 10 });
      model.actor.updateMatrixWorld(true);
      assert.ok(world(grip).distanceTo(world(model.sockets.rightHand)) < 1e-6);
      assert.ok(world(grip).distanceTo(world(model.rig.rightHand)) < 1e-6);
      const v = new T.Vector3();
      visual.traverse(o => {
        if (!(o instanceof T.SkinnedMesh)) return;
        o.skeleton.update();
        for (let j=0;j<o.geometry.attributes.position.count;j+=137) {
          o.getVertexPosition(j,v); v.applyMatrix4(o.matrixWorld);
          assert.ok(v.toArray().every(Number.isFinite));
          assert.ok(v.distanceTo(model.actor.position)<5, 'bounded deformation');
        }
      });
    }
  }
  assert.ok(first.distanceTo(world(grip)) > .01);
  assert.deepEqual(model.actor.position.toArray(), [12,3,-17]);
  const state = model.animator.snapshot();
  const next = createCharacterModel(hero, { assetSource: source }); next.animator.restore(state);
  assert.equal(await next.ready, true); assert.deepEqual(next.animator.snapshot(),state);
  model.animator.update(.2,{dead:true}); model.animator.reset();
  assert.ok(world(grip).toArray().every(Number.isFinite));
  disposeCharacterModel(model.actor); disposeCharacterModel(next.actor);
});

await test('late loads cannot resurrect a disposed character; load errors retain fallback', async () => {
  const scene = await source(); let resolve!: (scene:T.Group)=>void;
  const model=createCharacterModel(freshHero(),{assetSource:()=>new Promise(r=>{resolve=r;})});
  disposeCharacterModel(model.actor);resolve(scene);assert.equal(await model.ready,false);
  assert.equal(model.actor.getObjectByName('MaleRevision02Visual'),undefined);
  const warn=console.warn;console.warn=()=>{};
  try { const fallback=createCharacterModel(freshHero(),{assetSource:async()=>{throw Error('offline');}});assert.equal(await fallback.ready,false);assert.equal(fallback.actor.userData.modelStatus,'fallback');disposeCharacterModel(fallback.actor); }
  finally { console.warn=warn; }
});

await test('cached world/preview loads have independent skeletons and disposable resources', async () => {
  const original=GLTFLoader.prototype.loadAsync, template=await source();let loads=0;
  const bytes=await readFile(new URL('../../public'+ARMY_RUNNING_ASSET,import.meta.url));
  const motion=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  GLTFLoader.prototype.loadAsync=async(url)=>{loads++;return url===ARMY_RUNNING_ASSET?motion:{scene:template,scenes:[template],animations:[],cameras:[],asset:{version:'2.0'},parser:undefined,userData:{}} as unknown as Awaited<ReturnType<typeof original>>;};
  try {
    const [a,b]=await Promise.all([loadRevision02Character(),loadRevision02Character()]);
    assert.equal(loads,2); // one cached body + one cached animation, shared by both instances
    assert.equal(a.userData.runningAnimationSource,'army-man-running-blender');
    const bodyA=named(a,'MaleBodySkinned') as T.SkinnedMesh,bodyB=named(b,'MaleBodySkinned') as T.SkinnedMesh;
    assert.notEqual(bodyA.skeleton,bodyB.skeleton);assert.notEqual(bodyA.geometry,bodyB.geometry);assert.notEqual(bodyA.material,bodyB.material);
    let disposed=0;bodyB.geometry.addEventListener('dispose',()=>disposed++);
    disposeCharacterModel(a);assert.equal(disposed,0);
    assert.ok(bodyB.skeleton.bones.every(bone=>bone.parent));
    disposeCharacterModel(b);
  } finally { GLTFLoader.prototype.loadAsync=original; }
});
