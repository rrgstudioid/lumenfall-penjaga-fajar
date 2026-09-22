import './terrain-prototype.css';
import * as T from 'three';
if(!import.meta.env.DEV||!['localhost','127.0.0.1'].includes(location.hostname))throw Error('Local development only');
class MemoryStorage implements Storage{private data=new Map<string,string>();get length(){return this.data.size}clear(){this.data.clear()}getItem(k:string){return this.data.get(k)??null}setItem(k:string,v:string){this.data.set(k,String(v))}removeItem(k:string){this.data.delete(k)}key(i:number){return [...this.data.keys()][i]??null}}
Object.defineProperty(window,'localStorage',{value:new MemoryStorage(),configurable:false});Object.defineProperty(window,'sessionStorage',{value:new MemoryStorage(),configurable:false});
const [{Game},rules,{buildPrototype}]=await Promise.all([import('../../lib/game/world'),import('../../lib/game/rules'),import('./terrain-prototype-scene')]);
const terrain=await buildPrototype();
const hero=rules.freshHero('slot-1','adventurer','Penjelajah Prototype');hero.inCity=false;Object.assign(hero,terrain.m.spawn);rules.saveCharacter(hero,true);
let view='player';
class PrototypeGame extends Game{
 override get fieldTerrain(){return undefined;}
 override get isSandsLocation(){return false;}
 override get nearSanctuary(){return false;}
 override restoreSavedPosition(){Object.assign(this.hero,terrain.m.spawn);}
 override buildTerrain(){}
 override buildEnemies(){this.enemies=[];}
 override buildRegionDecor(){this.regionDecor=terrain.group;this.scene.add(terrain.group);this.shrine.visible=false;this.scene.fog=new T.Fog('#aebfac',240,620);this.scene.background=new T.Color('#aebfac');}
 override groundHeight(x:number,z:number){return terrain.ground.heightAt(x,z)??0;}
 override groundDistance(a:T.Vector3,b:T.Vector3){return Math.hypot(a.x-b.x,a.z-b.z);}
 override placeActor(){Object.assign(this.hero,terrain.ground.nearestPoint(this.hero,terrain.m.spawn));this.actor.position.set(this.hero.x,this.groundHeight(this.hero.x,this.hero.z),this.hero.z);}
 override moveHeroOnGround(p:{x:number;z:number},dx:number,dz:number){return terrain.ground.move(p,dx,dz);}
 override emit(){}
 override save(){} // No native storage; nothing in this map can become progression state.
 override changeRegion(){return false;}
 override updateCamera(dt:number){
  terrain.palette.time.value=this.elapsed;
  if(view==='player'){if(this.scene.fog instanceof T.Fog){this.scene.fog.near=240;this.scene.fog.far=620;}super.updateCamera(dt);const y=terrain.ground.heightAt(this.camera.position.x,this.camera.position.z);if(y!==undefined&&this.camera.position.y<y+1.2){this.camera.position.y=y+1.2;this.camera.lookAt(this.actor.position.clone().add(new T.Vector3(0,1.5,0)));}}
  else{if(this.scene.fog instanceof T.Fog){this.scene.fog.near=1000;this.scene.fog.far=1600;}this.camera.position.set(view==='top'?0:330,view==='top'?625:345,view==='top'?1:410);this.camera.far=1800;this.camera.lookAt(0,18,0);this.camera.updateProjectionMatrix();}
 }
 override drawMap(){drawPlan();}
}
const map=document.querySelector<HTMLCanvasElement>('#map')!,world=document.querySelector<HTMLElement>('#world')!,labels=document.querySelector<HTMLElement>('#labels')!;
const g=new PrototypeGame(world,labels,map,()=>{},()=>g.pause(!g.paused));
document.querySelector('#legend')!.innerHTML=terrain.m.zones.map((z:{id:number;name:string;landmark:string})=>`<div><b>${z.id}. ${z.name}</b><br>${z.landmark}</div>`).join('');
const markerEls=terrain.labels.map(q=>{const el=document.createElement('div');el.className='marker';el.textContent=q.text;labels.appendChild(el);return el;});
function drawPlan(){const c=map.getContext('2d')!;c.fillStyle='#20382b';c.fillRect(0,0,256,300);const X=(x:number)=>(x+160)*.8,Z=(z:number)=>(z+192)*.78125;
 for(let j=0;j<terrain.m.nz;j+=2)for(let i=0;i<terrain.m.nx;i+=2){const y=terrain.heights[j*terrain.m.nx+i];c.fillStyle=`hsl(${100-y*.45} 22% ${19+y*.55}%)`;c.fillRect(i*1.6,j*1.5625,3.3,3.3);}
 c.strokeStyle='#71bdc6';c.lineWidth=5;c.beginPath();for(let z=-174;z<=174;z+=2)c.lineTo(X(terrain.riverX(z)),Z(z));c.stroke();
 for(const r of terrain.m.roads){c.strokeStyle=r.width===8?'#edce92':'#baa675';c.lineWidth=r.width*.45;c.beginPath();for(const p of r.points)c.lineTo(X(p[0]),Z(p[1]));c.stroke();}
 for(const z of terrain.m.zones){c.fillStyle='#16251b';c.beginPath();c.arc(X(z.x),Z(z.z),8,0,Math.PI*2);c.fill();c.fillStyle='#fff2c5';c.font='bold 11px sans-serif';c.textAlign='center';c.fillText(String(z.id),X(z.x),Z(z.z)+4);}
 c.fillStyle='#73ffff';c.beginPath();c.arc(X(g.hero.x),Z(g.hero.z),3,0,Math.PI*2);c.fill();
}
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-view]'))b.onclick=()=>{view=b.dataset.view!;g.clearInput();g.renderer.domElement.focus();};
document.querySelector<HTMLButtonElement>('#spawn')!.onclick=()=>{Object.assign(g.hero,terrain.m.spawn);g.placeActor();g.cameraFocus.copy(g.actor.position);view='player';g.renderer.domElement.focus();};
document.querySelector<HTMLButtonElement>('#wire')!.onclick=()=>terrain.material.wireframe=!terrain.material.wireframe;
await g.prepareWorld();g.start();g.camera.far=1600;
let raf=0,last=performance.now(),frames=0,fps=0;
function hud(){if(g.disposed)return;frames++;const now=performance.now();if(now-last>1000){fps=frames*1000/(now-last);frames=0;last=now;}
 terrain.labels.forEach((q,i)=>{const v=new T.Vector3(q.x,q.y,q.z).project(g.camera),el=markerEls[i];el.hidden=v.z>1||Math.abs(v.x)>1||Math.abs(v.y)>1||(view!=='player'&&i>=7);el.style.left=`${(v.x*.5+.5)*innerWidth}px`;el.style.top=`${(-v.y*.5+.5)*innerHeight}px`;});
 document.querySelector('#status')!.textContent=`${g.paused?'PAUSED':'READY'} · x ${g.hero.x.toFixed(1)} z ${g.hero.z.toFixed(1)} y ${g.actor.position.y.toFixed(1)} · ${fps.toFixed(0)} fps · ${g.renderer.info.render.calls} draws`;
 raf=requestAnimationFrame(hud);
}hud();drawPlan();
const qa={g,terrain,setView(v:string){view=v;},teleport(x:number,z:number){g.hero.x=x;g.hero.z=z;g.placeActor();g.cameraFocus.copy(g.actor.position);},state(){return {ready:g.started,position:{x:g.hero.x,z:g.hero.z,y:g.actor.position.y},view,fps,draws:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,enemyCount:g.enemies.length,storage:'memory-only',chunks:30,terrainTriangles:terrain.triangles};}};
(window as unknown as {terrainQA:typeof qa}).terrainQA=qa;
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);g.dispose();terrain.dispose();},{once:true});
