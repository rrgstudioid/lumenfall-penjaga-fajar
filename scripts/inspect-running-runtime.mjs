import {readFile,writeFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {prepareArmyRunningClip,replaceRunningClip} from '../lib/game/army-running.ts';
import {createCharacterModel} from '../lib/game/character-model.ts';
import {freshHero} from '../lib/game/rules.ts';
async function load(path){const b=await readFile(path);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const body=await load('public/assets/characters/male-revision-02/male-revision-02-dual-sword.glb');
const clip=prepareArmyRunningClip((await load('public/assets/animations/army-running/army-running-revision02.glb')).animations);
body.scene.userData.lumenfallAnimations=replaceRunningClip(body.animations,clip);body.scene.userData.runningAnimationSource='army-man-running-blender';
const model=createCharacterModel(freshHero(),{assetSource:async()=>body.scene});await model.ready;
const feet=[];model.actor.traverse(o=>{if(o.name.replace(/[. _]/g,'').startsWith('Bootsole'))feet.push(o);});
const soles=()=>feet.map(o=>{o.skeleton.update();const box=new T.Box3();const v=new T.Vector3();for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,v);v.applyMatrix4(o.matrixWorld);box.expandByPoint(v);}return {min:box.min.toArray(),centre:box.getCenter(v).toArray()};});
for(let i=0;i<100;i++)model.animator.update(1/60,{moving:true,sprinting:true});
const poses=[];for(let i=0;i<51;i++){model.animator.update(1/60,{moving:true,sprinting:true});model.actor.updateMatrixWorld(true);poses.push(soles());}
const speeds=[];
for(let i=1;i<poses.length;i++)for(let side=0;side<2;side++)if(poses[i][side].min[1]<.04&&poses[i-1][side].min[1]<.04){const speed=(poses[i][side].centre[2]-poses[i-1][side].centre[2])*60;if(speed>0)speeds.push(speed);}
speeds.sort((a,b)=>a-b);
console.log('Foot speeds during support',speeds,'median',speeds[Math.floor(speeds.length/2)]);
const transitions=[];const allBones=[];model.actor.traverse(o=>{if(o.isBone)allBones.push(o);});
let previous=allBones.map(o=>o.quaternion.clone());
for(let i=0;i<60;i++){model.animator.update(1/60,{moving:false});const changes=allBones.map((o,j)=>({name:o.name,angle:previous[j].angleTo(o.quaternion)})).sort((a,b)=>b.angle-a.angle);transitions.push({frame:i,...changes[0]});previous=allBones.map(o=>o.quaternion.clone());}
console.log('transition maximum',transitions.sort((a,b)=>b.angle-a.angle).slice(0,8));
await writeFile('work/army-running/runtime-ground-report.json',JSON.stringify({poses,speeds,transitions},null,2));
