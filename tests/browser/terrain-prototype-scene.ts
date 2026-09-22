import * as T from 'three';
import { ImportedMapGround } from '../../lib/game/imported-map';
import { ArunikaMaterials,addArunikaSurfaceUv,ARUNIKA_NOISE_GLSL } from '../../lib/game/arunika-surface-materials';
import { loadArunikaGrassTextures,enhanceArunikaGrassTufts } from '../../lib/game/arunika-grass-material';
import manifestUrl from '../../dev-prototypes/lumenfall-terrain-prototype-01/manifest.json?url';
import type manifestShape from '../../dev-prototypes/lumenfall-terrain-prototype-01/manifest.json';

export async function buildPrototype(){
 const base=new URL('.',new URL(manifestUrl,location.origin));
 const m=await (await fetch(manifestUrl)).json() as typeof manifestShape;
 const heights=new Float32Array(await(await fetch(new URL(m.height,base))).arrayBuffer());
 const roads=new Float32Array(await(await fetch(new URL(m.roadMask,base))).arrayBuffer());
 const h=(i:number,j:number)=>heights[Math.max(0,Math.min(m.nz-1,j))*m.nx+Math.max(0,Math.min(m.nx-1,i))];
 const riverX=(z:number)=>30+10*Math.sin((z+10)/60),waterY=(z:number)=>9+(170-z)*.025;
 const group=new T.Group(),collision=new T.Group(),palette=new ArunikaMaterials();group.name=m.id;
 const [grass]=await loadArunikaGrassTextures();
 const rock=await new T.TextureLoader().loadAsync('/assets/materials/terrain/arunika/rocky-terrain-02/rocky_terrain_02_diff_2k.jpg');
 rock.colorSpace=T.SRGBColorSpace;rock.wrapS=rock.wrapT=T.RepeatWrapping;rock.anisotropy=4;
 const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.92});material.name='prototype-ground';
 material.onBeforeCompile=s=>{
  Object.assign(s.uniforms,{pGrass:{value:grass},pRock:{value:rock}});
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 prototypeWeights; varying vec2 vPW; varying vec3 vPP;varying vec3 vPN;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPW=prototypeWeights;vPP=position;vPN=normal;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>\nuniform sampler2D pGrass;uniform sampler2D pRock;varying vec2 vPW;varying vec3 vPP;varying vec3 vPN;${ARUNIKA_NOISE_GLSL}`).replace('#include <map_fragment>',`
   vec3 g=texture2D(pGrass,vPP.xz/4.8).rgb;
   vec3 tw=pow(abs(normalize(vPN)),vec3(4.));tw/=max(tw.x+tw.y+tw.z,.001);
   vec3 r=texture2D(pRock,vPP.yz/12.).rgb*tw.x+texture2D(pRock,vPP.xz/12.).rgb*tw.y+texture2D(pRock,vPP.xy/12.).rgb*tw.z;
   float grit=aNoise(vPP.xz*3.);
   vec3 soil=mix(vec3(.19,.12,.065),vec3(.39,.29,.16),grit);
   diffuseColor.rgb=mix(mix(g,r,vPW.y),soil,vPW.x*.95);
  `);
 };material.customProgramCacheKey=()=> 'lumenfall-prototype-terrain-v1';
 const colliderMat=new T.MeshBasicMaterial();colliderMat.name='prototype-ground';
 let triangles=0;
 for(let z0=0;z0<m.nz-1;z0+=32)for(let x0=0;x0<m.nx-1;x0+=32){
  const w=Math.min(32,m.nx-1-x0),d=Math.min(32,m.nz-1-z0),p:number[]=[],n:number[]=[],weights:number[]=[],idx:number[]=[],walk:number[]=[];
  for(let j=0;j<=d;j++)for(let i=0;i<=w;i++){
   const ix=x0+i,iz=z0+j,x=m.bounds.minX+ix*2,z=m.bounds.minZ+iz*2,y=h(ix,iz),normal=new T.Vector3(h(ix-1,iz)-h(ix+1,iz),4,h(ix,iz-1)-h(ix,iz+1)).normalize();
   p.push(x,y,z);n.push(normal.x,normal.y,normal.z);weights.push(roads[iz*m.nx+ix],T.MathUtils.smoothstep(1-normal.y,.08,.38));
  }
  for(let j=0;j<d;j++)for(let i=0;i<w;i++){
   const a=j*(w+1)+i,b=a+1,c=a+w+1,e=c+1;const ts=[a,c,b,b,c,e];idx.push(...ts);
   for(let k=0;k<6;k+=3){const ids=ts.slice(k,k+3),wet=ids.some(v=>Math.abs(p[v*3+2])<175&&Math.abs(p[v*3]-riverX(p[v*3+2]))<5.5);if(!wet)walk.push(...ids);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('prototypeWeights',new T.Float32BufferAttribute(weights,2));g.setIndex(idx);g.computeBoundingSphere();
  const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;mesh.name=`terrain-chunk-${x0}-${z0}`;group.add(mesh);triangles+=idx.length/3;
  const cg=new T.BufferGeometry();cg.setAttribute('position',g.getAttribute('position'));cg.setIndex(walk);collision.add(new T.Mesh(cg,colliderMat));
 }
 const bridgeG=new T.BoxGeometry(m.bridge.width,.5,m.bridge.depth);bridgeG.translate(m.bridge.x,m.bridge.y-.25,m.bridge.z);addArunikaSurfaceUv(bridgeG);
 const bridge=new T.Mesh(bridgeG,palette.get('wood_planks'));bridge.receiveShadow=true;group.add(bridge);
 collision.add(new T.Mesh(bridgeG,colliderMat));
 const ground=new ImportedMapGround(collision,['prototype-ground']);
 const waterP:number[]=[],waterI:number[]=[];
 for(let z=-174;z<=174;z+=2){waterP.push(riverX(z)-4,waterY(z),z,riverX(z)+4,waterY(z),z);if(z<174){const a=(z+174);waterI.push(a,a+2,a+1,a+1,a+2,a+3);}}
 const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(waterP,3));wg.setIndex(waterI);wg.computeVertexNormals();addArunikaSurfaceUv(wg);group.add(new T.Mesh(wg,palette.get('water_pond')));
 const add=(g:T.BufferGeometry,kind:Parameters<ArunikaMaterials['get']>[0],x:number,y:number,z:number)=>{addArunikaSurfaceUv(g);const o=new T.Mesh(g,palette.get(kind));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;};
 const labels:{x:number;y:number;z:number;text:string}[]=[];
 for(const zone of m.zones){
  const y=ground.heightAt(zone.x,zone.z)??zone.y;
  labels.push({x:zone.x,y:y+12,z:zone.z,text:`${zone.id} · ${zone.name}`});
  // Abstract survey stakes and footprints, NOT completed landmarks or imported placements.
  const mx=zone.id===5?zone.x:zone.x-9,mz=zone.id===5?zone.z+3.4:zone.z,my=ground.heightAt(mx,mz)??y;
  add(new T.CylinderGeometry(.5,.7,8,8),'wood_beams',mx,my+4,mz);
  add(new T.OctahedronGeometry(1.5),'shrine_stone',mx,my+9,mz);
  const ring=new T.Mesh(new T.RingGeometry(zone.id===6?17:5,zone.id===6?17.3:5.3,64),new T.MeshBasicMaterial({color:'#dcb66d',side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(zone.x,y+.12,zone.z);group.add(ring);
 }
 // Neutral scale gallery beside spawn: only measured proxies, no NPC/monster entities.
 const scale=[{name:'NPC 1.75m',x:-89,z:108,r:.3,height:1.75},{name:'Small proxy 0.8m',x:-85,z:108,r:.28,height:.8},{name:'Large proxy 3.8m',x:-80,z:108,r:.8,height:3.8}];
 for(const q of scale){const y=ground.heightAt(q.x,q.z)!;add(new T.CapsuleGeometry(q.r,q.height-2*q.r,4,8),'temple_stone',q.x,y+q.height/2,q.z);labels.push({x:q.x,y:y+q.height+1,z:q.z,text:q.name});}
 const footprint=new T.Box3Helper(new T.Box3(new T.Vector3(-122,24.1,97),new T.Vector3(-110,32.1,113)),0xead6a2);group.add(footprint);
 for(const r of [3.5,8]){const ring=new T.Mesh(new T.RingGeometry(r-.045,r+.045,64),new T.MeshBasicMaterial({color:r<4?0x6cdef5:0xecb261,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(-100,24.08,110);group.add(ring);}
 const tufts=new T.InstancedMesh(new T.PlaneGeometry(.44,.7),new T.MeshStandardMaterial(),160);
 let planted=0;for(let i=0;i<240&&planted<160;i++){const a=i*2.399963,r=Math.sqrt(i/240),x=-60+26*r*Math.cos(a),z=22+20*r*Math.sin(a),ix=Math.round((x+160)/2),iz=Math.round((z+192)/2);if(roads[iz*m.nx+ix]>.15)continue;const y=ground.heightAt(x,z)??14;const mx=new T.Matrix4().compose(new T.Vector3(x,y+.35,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),a),new T.Vector3(1,1,1));tufts.setMatrixAt(planted++,mx);}tufts.count=planted;
 await enhanceArunikaGrassTufts(tufts);group.add(tufts);
 return {m,group,ground,collision,palette,labels,material,triangles,heights,roads,riverX,waterY,dispose(){for(const o of collision.children)if(o instanceof T.Mesh&&o.geometry!==bridgeG)o.geometry.dispose();colliderMat.dispose();rock.dispose();palette.dispose();}};
}
