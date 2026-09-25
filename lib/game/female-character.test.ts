import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {freshHero,parseSave} from './rules.ts';
import {createCharacterModel,disposeCharacterModel} from './character-model.ts';
import {FEMALE_CHARACTER_ASSET,FEMALE_CHARACTER_TRIANGLES} from './female-character.ts';
async function asset(){
  const b=await readFile(new URL('../../public'+FEMALE_CHARACTER_ASSET,import.meta.url));
  const loader=new GLTFLoader();
  // Geometry/animation tests are headless; actual embedded textures are verified in Chrome.
  loader.register(parser=>({name:'HeadlessMaterials',loadMaterial:(index:number)=>Promise.resolve(new T.MeshStandardMaterial({name:parser.json.materials[index].name}))}));
  const gltf=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  gltf.scene.userData.lumenfallAnimations=gltf.animations;gltf.scene.userData.runningAnimationSource='army-man-running-blender';return gltf;
}
await test('legacy saves stay male and female choice survives serialization without changing stats',()=>{
  const hero=freshHero('slot-2','adventurer','Female QA','female');assert.equal(parseSave(JSON.stringify(hero))?.gender,'female');
  const old={...freshHero()};delete (old as Partial<typeof old>).gender;
  const loaded=parseSave(JSON.stringify(old))!;assert.equal(loaded.gender,'male');assert.equal(loaded.gold,old.gold);assert.deepEqual(loaded.equipment,old.equipment);
  assert.equal(parseSave(JSON.stringify({...hero,gender:'invalid'}))?.gender,'male');
});
await test('female asset keeps the original 9389 triangles and has weighted geometry and all game clips',async()=>{
  const g=await asset();let triangles=0,skinned=0;
  g.scene.traverse(o=>{if(!(o instanceof T.Mesh))return;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
    assert.ok(o instanceof T.SkinnedMesh,o.name+' skinned');skinned++;
    const weights=o.geometry.attributes.skinWeight;for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5);
  });
  assert.equal(triangles,FEMALE_CHARACTER_TRIANGLES);assert.equal(skinned,8);
  for(const name of ['Walk','Run','DualSword_Attack_01','DualSword_Attack_02','DualSword_Attack_03'])assert.ok(g.animations.some(a=>a.name===name));
  const size=new T.Box3().setFromObject(g.scene).getSize(new T.Vector3());assert.ok(size.y>2&&size.y<2.1,JSON.stringify(size));
  disposeCharacterModel(g.scene);
});
await test('female body runs/attacks/returns to idle with finite skin and hand-attached equipment',async()=>{
  const hero=freshHero('slot-2','adventurer','Female QA','female');
  const model=createCharacterModel(hero,{assetSource:async()=>(await asset()).scene});assert.equal(await model.ready,true);
  assert.equal(model.actor.userData.assetKind,'female-rpg');assert.ok(model.actor.getObjectByName('FemaleRPGVisual'));
  const socket=model.actor.getObjectByName('WeaponSocketR')!;assert.ok(socket);
  model.actor.position.set(-7,2,11);model.actor.rotation.y=.9;
  let before:T.Vector3|undefined;
  for(let i=0;i<240;i++){
    if(i===80)model.animator.play('basic_attack',.3);
    model.animator.update(1/60,{moving:i<70,sprinting:true,speed:7.564});model.actor.updateMatrixWorld(true);
    const p=socket.getWorldPosition(new T.Vector3());if(i===10)before=p.clone();if(i===50)assert.ok(p.distanceTo(before!)>.1);
    assert.ok(p.distanceTo(model.sockets.rightHand.getWorldPosition(new T.Vector3()))<1e-5);
    model.actor.traverse(o=>{if(!(o instanceof T.SkinnedMesh))return;o.skeleton.update();const v=new T.Vector3();for(let j=0;j<o.geometry.attributes.position.count;j+=83){o.getVertexPosition(j,v);v.applyMatrix4(o.matrixWorld);assert.ok(v.toArray().every(Number.isFinite));assert.ok(v.distanceTo(model.actor.position)<5);}});
  }
  assert.equal(model.actor.userData.activeNativeAnimation,'');assert.deepEqual(model.actor.position.toArray(),[-7,2,11]);disposeCharacterModel(model.actor);
});
