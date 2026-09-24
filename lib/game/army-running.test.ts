import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARMY_RUNNING_ASSET, ARMY_RUNNING_REFERENCE_SPEED, armyRunningCadence, prepareArmyRunningClip, replaceRunningClip } from './army-running.ts';
import { createCharacterModel, disposeCharacterModel } from './character-model.ts';
import { freshHero } from './rules.ts';
async function gltf(path:string){const b=await readFile(new URL('../../public'+path,import.meta.url));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
async function motion(){return prepareArmyRunningClip((await gltf(ARMY_RUNNING_ASSET)).animations);}
async function source(){
  const body=await gltf('/assets/characters/male-revision-02/male-revision-02-dual-sword.glb');
  body.scene.userData.lumenfallAnimations=replaceRunningClip(body.animations,await motion());
  body.scene.userData.runningAnimationSource='army-man-running-blender';return body.scene;
}
await test('Blender output contains motion only, with a seamless 50-frame loop and stable scale',async()=>{
  const bytes=await readFile(new URL('../../public'+ARMY_RUNNING_ASSET,import.meta.url));assert.ok(bytes.length<40000);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.equal(json.meshes,undefined);assert.equal(json.images,undefined);assert.equal(json.textures,undefined);
  const clip=await motion();assert.equal(clip.name,'Run');assert.ok(Math.abs(clip.duration-50/60)<1e-6);
  assert.equal(clip.tracks.length,21);
  for(const track of clip.tracks){
    assert.equal(track.times[0],0);assert.ok([...track.values].every(Number.isFinite));
    const n=track.getValueSize();for(let j=0;j<n;j++)assert.ok(Math.abs(track.values[j]-track.values[track.values.length-n+j])<1e-6,track.name+' seam');
    assert.ok(track.name.endsWith('.quaternion')||track.name==='Hips.position');
    if(n===4)for(let i=0;i<track.values.length;i+=4)assert.ok(Math.abs(Math.hypot(...track.values.slice(i,i+4))-1)<1e-5);
  }
});
await test('only Run is replaced; existing idle/walk/combat data is kept',async()=>{
  const body=await gltf('/assets/characters/male-revision-02/male-revision-02-dual-sword.glb'),run=await motion();
  const merged=replaceRunningClip(body.animations,run);
  assert.equal(merged.length,body.animations.length);assert.equal(merged.filter(c=>c.name==='Run').length,1);
  for(const clip of body.animations.filter(c=>c.name!=='Run'))assert.equal(merged.find(c=>c.name===clip.name),clip);
  assert.throws(()=>prepareArmyRunningClip([]));
  assert.throws(()=>prepareArmyRunningClip([new T.AnimationClip('wrong',1,[])]));
});
await test('stride cadence follows actual speed instead of changing gameplay movement',()=>{
  assert.equal(armyRunningCadence(),1);
  assert.ok(Math.abs(armyRunningCadence(6.2*1.22)-1.454615)<1e-5);
  assert.equal(armyRunningCadence(-1),.5);assert.equal(armyRunningCadence(100),2.4);
});
await test('running articulates feet/hands, keeps equipment sockets, and returns to procedural idle',async()=>{
  const model=createCharacterModel(freshHero(),{assetSource:source});assert.equal(await model.ready,true);
  model.actor.position.set(12,3,-17);model.actor.rotation.y=1.2;
  const visual=model.actor.getObjectByName('MaleRevision02Visual')!,points:Record<string,T.Vector3[]>={FootL:[],FootR:[],HandL:[],HandR:[]};
  const named=(name:string)=>{let found:T.Object3D|undefined;visual.traverse(o=>{if(o.name.replace(/[. _]/g,'')===name)found=o;});assert.ok(found,name);return found;};
  let maxGripError=0;
  for(let i=0;i<140;i++){
    model.animator.update(1/60,{moving:true,sprinting:true,speed:ARMY_RUNNING_REFERENCE_SPEED});model.actor.updateMatrixWorld(true);
    for(const name of Object.keys(points))points[name].push(named(name).getWorldPosition(new T.Vector3()));
    maxGripError=Math.max(maxGripError,named('WeaponSocketR').getWorldPosition(new T.Vector3()).distanceTo(model.sockets.rightHand.getWorldPosition(new T.Vector3())));
  }
  assert.equal(model.actor.userData.activeNativeAnimation,'Run');assert.ok(maxGripError<1e-6);
  for(const [name,poses]of Object.entries(points))assert.ok(new T.Box3().setFromPoints(poses).getSize(new T.Vector3()).length()>.3,name+' moves');
  assert.deepEqual(model.actor.position.toArray(),[12,3,-17]);
  for(let i=0;i<60;i++)model.animator.update(1/60,{moving:false});
  assert.equal(model.actor.userData.activeNativeAnimation,'');
  assert.ok(model.actor.userData.animationMixer.stats.actions.inUse===0);
  model.animator.play('basic_attack',.3);model.animator.update(.05);
  assert.equal(model.actor.userData.activeNativeAnimation,'DualSword_Attack_01');
  for(let i=0;i<140;i++)model.animator.update(1/60,{moving:false});
  assert.equal(model.actor.userData.activeNativeAnimation,'');
  assert.ok(model.actor.userData.animationMixer.stats.actions.inUse===0);
  disposeCharacterModel(model.actor);
});
