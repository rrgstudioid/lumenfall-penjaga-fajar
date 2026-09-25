import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './kingdom-city-kit-compositions.css';

const stage='/dev-assets/kingdom-city-kit-v1/';
const viewport=document.getElementById('viewport')!;
const status=document.getElementById('status')!;
const notes=document.getElementById('notes')!;
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#142636');
const camera=new THREE.PerspectiveCamera(42,1,.01,500);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
const root=new THREE.Group();scene.add(root);
scene.add(new THREE.HemisphereLight(0xbaddff,0x28342a,2));
const sun=new THREE.DirectionalLight(0xffe4c2,3);sun.position.set(10,14,8);scene.add(sun);
const loader=new GLTFLoader();let proxy:THREE.Object3D|null=null;
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}
addEventListener('resize',resize);resize();
function clear(){while(root.children.length){const o=root.children.pop()!;o.traverse(n=>{const m=n as THREE.Mesh;m.geometry?.dispose();const ms=Array.isArray(m.material)?m.material:m.material?[m.material]:[];ms.forEach(x=>x.dispose())})}}
async function load(id:string,pos:[number,number,number]){const a=await fetch(stage+'metadata/kit-manifest.json').then(r=>r.json()) as {assets:Array<{assetId:string;format:string;viewerUrl:string;displayName:string}>};const d=a.assets.find(x=>x.assetId===id);if(!d||d.format!=='GLTF')throw new Error(`${id} is not renderable GLTF`);const g=await loader.loadAsync(d.viewerUrl);g.scene.position.set(...pos);g.scene.traverse(n=>{const m=n as THREE.Mesh;m.castShadow=true;m.receiveShadow=true});root.add(g.scene);return d.displayName}
async function loadProxy(){if(proxy)return;try{const g=await loader.loadAsync('/assets/characters/male-revision-02/male-revision-02.glb');proxy=g.scene;const b=new THREE.Box3().setFromObject(proxy);proxy.scale.setScalar(1.75/(b.max.y-b.min.y))}catch{}}
async function build(kind:string){
  clear();await loadProxy();
  if(kind==='fortification'){
    await Promise.all([load('env_model_wall_plaster_straight',[-6,0,0]),load('env_model_roof_tower_roundtiles',[-2,0,0]),load('env_model_doorframe_round_brick',[2,0,0]),load('env_model_wall_arch',[6,0,0])]);
    if(proxy){const p=proxy.clone();p.position.set(0,0,2.3);p.visible=(document.getElementById('proxy') as HTMLInputElement).checked;root.add(p)}
    notes.textContent='Fortification test: wall → tower → gate → arch → wall.\nObserved family: Medieval Village modular GLTF. Castle/fort package remains HOLD because BLEND conversion is pending.';
  }else if(kind==='house'){
    await Promise.all([load('env_model_floor_brick',[-4,0,0]),load('env_model_corner_exterior_brick',[-4,0,0]),load('env_model_doorframe_flat_brick',[-1,0,0]),load('env_model_corner_exteriorwide_wood',[3,0,0])]);
    if(proxy){const p=proxy.clone();p.position.set(0,0,2);p.visible=(document.getElementById('proxy') as HTMLInputElement).checked;root.add(p)}
    notes.textContent='House test: floor/foundation → corner → doorframe → wood corner.\nFilename-based modular compatibility is visually checkable here; final assembly still needs authored pivot/fit validation.';
  }else{
    await Promise.all([load('env_model_floor_redbrick',[-4,0,0]),load('env_model_stall_empty',[-1,0,0]),load('env_model_prop_wagon',[3,0,0]),load('env_model_barrel',[5,0,0]),load('env_model_bench',[6,0,0]),load('env_model_banner_1',[1,0,2])]);
    if(proxy){const p=proxy.clone();p.position.set(-6,0,0);p.visible=(document.getElementById('proxy') as HTMLInputElement).checked;root.add(p)}
    notes.textContent='Street/market test: neutral road tile + stall + wagon + barrel + bench + banner.\nTree/vegetation is not rendered because all shortlisted vegetation is BLEND HOLD.';
  }
  const box=new THREE.Box3().setFromObject(root);const size=box.getSize(new THREE.Vector3());const center=box.getCenter(new THREE.Vector3());controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(Math.max(size.x,size.y,size.z)*.95,Math.max(size.y,2)*.7,Math.max(size.x,size.z)*1.15));camera.lookAt(center);controls.update();status.textContent=`${kind} composition rendered without source rescale`;
}
document.querySelectorAll<HTMLElement>('[data-scene]').forEach(b=>b.addEventListener('click',()=>void build(b.dataset.scene ?? 'street').catch(console.error)));
document.getElementById('proxy')!.addEventListener('change',()=>{void build('street').catch(console.error)});
build('fortification').catch(e=>{status.textContent=`ERROR: ${e.message}`;console.error(e)});
function frame(){requestAnimationFrame(frame);controls.update();renderer.render(scene,camera)}frame();
