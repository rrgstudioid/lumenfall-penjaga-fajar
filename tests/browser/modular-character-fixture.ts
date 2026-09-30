import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createCharacterModel, disposeCharacterModel } from '../../lib/game/character-model.ts';
import { loadModularMaleCharacter, maleAssetCacheStats, releaseUnusedMaleAssets } from '../../lib/game/modular-male-character.ts';
import { normalizeMaleAppearance } from '../../lib/game/character-appearance.ts';
import { freshHero } from '../../lib/game/rules.ts';
import { loadCenaCharacter } from '../../lib/game/cena-character.ts';
import {planCharacterCrowd,type CharacterLOD} from '../../lib/game/character-quality.ts';
import {maleTextureCacheStats} from '../../lib/game/character-materials.ts';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);document.body.appendChild(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#24353c');
scene.add(new T.HemisphereLight('#fff4e0','#617b81',2.0));const light=new T.DirectionalLight('#fff2dc',2.6);light.position.set(-3,5,-4);scene.add(light);
const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#41584d',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);
const camera=new T.PerspectiveCamera(35,innerWidth/innerHeight,.1,250);camera.position.set(0,1.5,-6.5);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.2,0);controls.update();
let actors:ReturnType<typeof createCharacterModel>[]=[],appearance=normalizeMaleAppearance({}),movement=false,previous=performance.now();
let managed=false,planningAt=0,frames:number[]=[],cpu:number[]=[],collect=false,poseFrozen=false;
const pendingLOD=new Map<number,CharacterLOD>(),poseTimes=new Map<number,number>();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);render();});
const errors:string[]=[];addEventListener('error',e=>errors.push(e.message));
function render(){renderer.render(scene,camera);}
function snapshot(){
  let triangles=0;const geometries=new Set(),skeletons=new Set(),materials=new Set(),textures=new Set();
  scene.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof T.Texture)textures.add(v);}if(o instanceof T.SkinnedMesh)skeletons.add(o.skeleton);}});
  const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  return {actors:actors.length,hairAttachments:actors.map(m=>{let count=0;m.actor.traverse(o=>{if(o.userData.assetPath?.startsWith('hair/'))count++;});return count;}),triangles,calls:renderer.info.render.calls,renderTriangles:renderer.info.render.triangles,geometryCount:geometries.size,skeletonCount:skeletons.size,materialCount:materials.size,textureCount:textures.size,cache:maleAssetCacheStats(),errors,
    gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',memory:renderer.info.memory,texturePayloadEstimate:maleTextureCacheStats(renderer),
    bounds:actors[0]?new T.Box3().setFromObject(actors[0].actor).getSize(new T.Vector3()).toArray():[]};
}
async function crowd(count=1,legacy=false,lod:0|1|2|3=1){
  for(const m of actors){m.actor.removeFromParent();disposeCharacterModel(m.actor);}actors=[];
  pendingLOD.clear();poseTimes.clear();managed=false;
  for(let i=0;i<count;i++){
    const hero=freshHero();hero.appearance={...appearance,hairStyleId:`hair_${String(1+i%10).padStart(2,'0')}`};
    for(const slot of Object.keys(hero.equipment))hero.equipment[slot as keyof typeof hero.equipment]=null;
    const model=createCharacterModel(hero,{assetSource:legacy?loadCenaCharacter:()=>loadModularMaleCharacter(hero.appearance,lod,renderer)});
    scene.add(model.actor);actors.push(model);if(!await model.ready)throw Error('Actor failed');
    if(count>1){model.actor.position.set((i%10-4.5)*1.25,0,Math.floor(i/10)*1.6);}
  }
  camera.position.set(0,count>1?8:1.5,count>1?-18:-6.5);controls.target.set(0,1.2,count>1?4:0);controls.update();render();return snapshot();
}
async function appearanceChange(value:unknown,lod?:0|1|2|3){
  appearance=normalizeMaleAppearance({...appearance,...value as object});
  for(const model of actors){let visual:T.Object3D|undefined;model.actor.traverse(o=>{if(o.userData.setAppearance)visual=o;});await visual?.userData.setAppearance(appearance,lod);}
  render();return snapshot();
}
function view(kind='front'){
  const pos:Record<string,number[]>={front:[0,1.5,-6.5],side:[6,1.5,0],back:[0,1.5,6.5],quarter:[3,2,-5],face:[0,2.03,-1.8],headRight:[1.8,2.03,0],headBack:[0,2.03,1.8],headLeft:[-1.8,2.03,0]};
  camera.position.fromArray(pos[kind]);controls.target.set(0,(kind==='face'||kind.startsWith('head'))?1.92:1.2,0);controls.update();render();return snapshot();
}
let plan=planCharacterCrowd([],'office');
function tick(now:number){requestAnimationFrame(tick);const elapsed=now-previous,dt=Math.min(.1,elapsed/1000);previous=now;const start=performance.now();
  if(managed&&now-planningAt>200){
    planningAt=now;camera.updateMatrixWorld();const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    plan=planCharacterCrowd(actors.map((m,id)=>{const distance=camera.position.distanceTo(m.actor.position);return{id,distance,pixels:2.4*innerHeight/(2*Math.tan(camera.fov*Math.PI/360)*distance),visible:frustum.intersectsSphere(new T.Sphere(m.actor.position.clone().add(new T.Vector3(0,1.2,0)),1.8)),self:id===0,previous:pendingLOD.get(id)??1};}),'office');
    const visible=new Set(plan.actors.map(e=>e.id));actors.forEach((m,id)=>{m.actor.visible=visible.has(id);});
    for(const entry of plan.actors){if(pendingLOD.get(entry.id)!==entry.lod){pendingLOD.set(entry.id,entry.lod);void actors[entry.id].setVisualLOD(entry.lod).catch(e=>errors.push(String(e)));}}
  }
  for(const [id,m]of actors.entries()){
    if(!m.actor.visible||poseFrozen)continue;
    const interval=managed?plan.actors.find(e=>e.id===id)?.poseInterval??0:0;
    const accumulated=(poseTimes.get(id)??0)+dt;
    if(accumulated>=interval){m.animator.update(accumulated,{moving:movement,sprinting:movement});poseTimes.set(id,0);}else poseTimes.set(id,accumulated);
  }
  render();if(collect){frames.push(elapsed);cpu.push(performance.now()-start);}
}
requestAnimationFrame(tick);
Object.assign(window,{maleV2:{crowd,appearance:appearanceChange,view,snapshot,move:(value:boolean)=>{movement=value;},attack:()=>actors.forEach(m=>m.animator.play('basic_attack')),
  shadows:(value:boolean)=>{renderer.shadowMap.enabled=value;light.castShadow=value;light.shadow.mapSize.set(512,512);floor.receiveShadow=value;if(!value){light.shadow.dispose();light.shadow.map=null;}render();},
  freeze:(value:boolean)=>{poseFrozen=value;},
  hairVisible:(value:boolean)=>{for(const model of actors)model.actor.traverse(o=>{if(o.userData.assetPath?.startsWith('hair/'))o.visible=value;if(o instanceof T.Mesh&&!Array.isArray(o.material)&&o.material.userData.setScalpVisible)o.material.userData.setScalpVisible(!value||appearance.hairStyleId!=='hair_01');});render();return snapshot();},
  manage:(value:boolean)=>{managed=value;planningAt=0;},
  sample:async(duration=2500)=>{frames=[];cpu=[];collect=true;await new Promise(r=>setTimeout(r,duration));collect=false;const q=(values:number[],p:number)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)];return{...snapshot(),samples:frames.length,frameMs:{p50:q(frames,.5),p95:q(frames,.95),p99:q(frames,.99)},cpuMs:{p50:q(cpu,.5),p95:q(cpu,.95)},budget:managed?plan.triangles:null};},
  reset:async()=>{for(const m of actors){m.actor.removeFromParent();disposeCharacterModel(m.actor);}actors=[];releaseUnusedMaleAssets();render();return snapshot();}}});
void crowd().then(()=>{document.getElementById('status')!.textContent='Male V2 · isolated acceptance';}).catch(e=>{errors.push(String(e));document.getElementById('status')!.textContent=String(e);});
