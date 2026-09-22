import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { insideBoundary, terrainHeight, terrainPathDistance, terrainWalkable, terrainSafe, terrainBridge, terrainRiverZ, terrainRiver, terrainPonds, TERRAIN_RINGS, type FieldTerrain } from './field-terrain.ts';
import { addPlanarUv, createBasicMapMaterial } from './basic-map-materials.ts';
import { enhanceArunikaGrassTufts } from './arunika-grass-material.ts';
import { ArunikaMaterials, addArunikaSurfaceUv, addArunikaCampfireDetails, type ArunikaSurface } from './arunika-surface-materials.ts';

// A radial grid follows the polygon exactly (no rectangular floor under it).
export function buildFieldTerrain(t:FieldTerrain, arunikaMaterials?:ArunikaMaterials) {
  const palette=t.id==='verdant-plains'?(arunikaMaterials??new ArunikaMaterials()):null;
  const group=new T.Group();group.name=`terrain-${t.id}`;
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[];
  const count=t.boundary.length,rings=TERRAIN_RINGS;
  const color=new T.Color();
  for(let r=0;r<=rings;r++)for(let i=0;i<count;i++) {
    const p=t.boundary[i],x=p.x*r/rings,z=p.z*r/rings,h=terrainHeight(t,x,z,false);
    vertices.push(x,h,z);
    const path=terrainPathDistance(t,{x,z}),bank=Math.abs(z-terrainRiverZ(t,x));
    color.set(path<2?'#b0aa77':bank<4?'#8c9167':z<-25?'#5f854d':'#88a955');
    color.multiplyScalar(.94+.06*Math.sin(x*.6+z*.7));
    colors.push(color.r,color.g,color.b);
    if(r>0){const a=(r-1)*count+i,b=(r-1)*count+(i+1)%count,c=r*count+i,d=r*count+(i+1)%count;indices.push(a,b,c,b,d,c);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();addPlanarUv(geometry,8);
  const surface=new T.Mesh(geometry,createBasicMapMaterial('terrain',{vertexColors:true,side:T.DoubleSide}));
  surface.name='walkable-terrain';surface.receiveShadow=true;group.add(surface);
  // Closed rock/soil skirt extends down below surrounding water.
  const skirt:number[]=[],faces:number[]=[];
  for(let layer=0;layer<3;layer++)for(const p of t.boundary)skirt.push(p.x*(1+layer*.012),layer===0?terrainHeight(t,p.x,p.z,false):layer===1?-2:-12,p.z*(1+layer*.012));
  for(let layer=0;layer<2;layer++)for(let i=0;i<count;i++) {const a=layer*count+i,b=layer*count+(i+1)%count,c=a+count,d=b+count;faces.push(a,c,b,b,c,d);}
  const cliffs=new T.BufferGeometry();cliffs.setAttribute('position',new T.Float32BufferAttribute(skirt,3));cliffs.setIndex(faces);cliffs.computeVertexNormals();addPlanarUv(cliffs,8);
  if(palette) addArunikaSurfaceUv(cliffs);
  const skirtMesh=new T.Mesh(cliffs,palette?.get('cliff_rock')??createBasicMapMaterial('rock',{flatShading:true,side:T.DoubleSide}));skirtMesh.name='cliff-skirt';group.add(skirtMesh);
  const seaGeo=new T.CircleGeometry(260,64);if(palette)addArunikaSurfaceUv(seaGeo);
  const sea=new T.Mesh(seaGeo,palette?.get('distant_water')??createBasicMapMaterial('water',{opacity:.72}));sea.rotation.x=-Math.PI/2;sea.position.y=-7;sea.name='distant-water';group.add(sea);
  const ready = buildLandmarks(t,group,palette);
  return {group,surface,ready};
}

function buildLandmarks(t:FieldTerrain,group:T.Group,palette:ArunikaMaterials|null) {
  // Static architecture batches by material, vegetation uses shared instancing.
  const batches=new Map<string,T.BufferGeometry[]>();
  const batchSurfaces=new Map<string,{kind:ArunikaSurface;color:string}>();
  const stone='#9c9b80',wood='#795239',darkWood='#4c4333',roof='#74503e',gold='#c8a35b';
  const eastern=t.theme==='eastern-frontier';
  const layoutScale=t.id==='verdant-plains'?2:1;
  const layout=(value:number)=>value*layoutScale;
  let architectureTransform:T.Matrix4|null=null;
  let surfaceRole:ArunikaSurface='temple_stone';
  function part(geometry:T.BufferGeometry,color:string,x:number,y:number,z:number,rx=0,ry=0,rz=0,surface?:ArunikaSurface) {
    const kind=surface??(color===roof?'roof_tiles':color===darkWood?'wood_beams':color===wood?(surfaceRole==='wood_props'?'wood_props':'wood_planks'):surfaceRole);
    const m=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1));
    if(palette&&kind==='fire_effect') {
      const fire=new T.Mesh(addArunikaSurfaceUv(geometry),palette.get(kind));fire.applyMatrix4(m);
      fire.name='arunika-campfire-flame';fire.raycast=()=>{};group.add(fire);return;
    }
    if(palette)addArunikaSurfaceUv(geometry);
    const plain=geometry.index?geometry.toNonIndexed():geometry;
    plain.deleteAttribute('uv');plain.applyMatrix4(m);
    if(architectureTransform)plain.applyMatrix4(architectureTransform);
    const key=palette?`${kind}|${color}`:color;
    const list=batches.get(key)??[];list.push(plain);batches.set(key,list);batchSurfaces.set(key,{kind,color});
    if(plain!==geometry)geometry.dispose();
  }
  const box=(x:number,z:number,w:number,h:number,d:number,color:string,y=terrainHeight(t,x,z)+h/2,ry=0,surface?:ArunikaSurface)=>part(new T.BoxGeometry(w,h,d),color,x,y,z,0,ry,0,surface);
  function beam(a:T.Vector3,b:T.Vector3,r:number,color:string) {
    const g=new T.CylinderGeometry(r,r*1.16,a.distanceTo(b),6);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));
    const p=a.clone().add(b).multiplyScalar(.5);part(g,color,p.x,p.y,p.z,0,0,0,'wood_beams');
  }
  function gate(x:number,z:number,scale=1,yaw=0) {
    if(yaw)architectureTransform=new T.Matrix4().makeTranslation(x,0,z).multiply(new T.Matrix4().makeRotationY(yaw)).multiply(new T.Matrix4().makeTranslation(-x,0,-z));
    const h=terrainHeight(t,x,z);
    for(const side of [-1,1]) {
      box(x+side*4.2*scale,z,1.2*scale,2.1*scale,1.4*scale,stone,h+1.05*scale);
      box(x+side*4.2*scale,z,.55*scale,5.1*scale,.55*scale,wood,h+2.55*scale);
      box(x+side*4.2*scale,z,.72*scale,.3*scale,.72*scale,gold,h+3.9*scale);
      box(x+side*3.3*scale,z,.7*scale,2*scale,.08,'#bd7656',h+3.2*scale,0,'fabric_banner');
    }
    box(x,z,10*scale,.7*scale,1.3*scale,darkWood,h+5*scale);
    const canopy=new T.ConeGeometry(6*scale,1.45*scale,4);canopy.rotateY(Math.PI/4);canopy.scale(1,1,.26);
    part(canopy,roof,x,h+6*scale,z);
    box(x,z-.7*scale,2.3*scale,.65*scale,.12,gold,h+4.9*scale);
    architectureTransform=null;
  }
  gate(t.cityGate.x,t.cityGate.z,1,t.cityGateYaw??0);
  if(!eastern)gate(t.exit.x,t.exit.z,.65);
  else {
    const {x,z}=t.exit,h=terrainHeight(t,x,z);
    for(const side of [-1,1]){
      box(x+side*3.4,z,1.8,1.1,2.4,stone,h+.55);
      box(x+side*3.4,z,1.3,4.8,1.6,'#9ea99a',h+2.6);
      box(x+side*3.4,z,1.7,.5,2,'#c1c7a4',h+5.2);
      box(x+side*3.4,z-.85,.22,2.7,.08,'#70c8de',h+3);
      part(new T.OctahedronGeometry(.5,0),'#94e5f4',x+side*3.4,h+5.9,z);
    }
    part(new T.TorusGeometry(3.4,.5,6,24,Math.PI),'#afb9a2',x,h+3,z);
    box(x,z,8,.24,4.8,stone,h+.06);
  }

  // Stream, pond and waterfall are separated from the solid walkable mesh.
  const waterMat=createBasicMapMaterial('water');
  const streamVertices:number[]=[],streamIndices:number[]=[];
  const stream=terrainRiver(t);
  if(palette) {
    const s=t.horizontalScale??1;
    palette.river.value.set(stream.offset*s,stream.amplitude*s,stream.phase*s,stream.frequency/s);
    palette.halfWidth.value=stream.halfWidth;
    t.bridges.slice(0,2).forEach((bridge,i)=>palette.bridges.value[i].set(bridge.x,bridge.z,bridge.width/2,bridge.length/2));
  }
  let previous=-1;
  const minX=Math.min(...t.boundary.map(p=>p.x)),maxX=Math.max(...t.boundary.map(p=>p.x));
  for(let x=minX+.001;x<maxX;x+=.4) {
    // Clip both stream banks to the real coastline, not a rectangular water strip.
    const intersections:number[]=[];
    for(let i=0;i<t.boundary.length;i++) {
      const a=t.boundary[i],b=t.boundary[(i+1)%t.boundary.length];
      if((a.x>x)!==(b.x>x))intersections.push(a.z+(b.z-a.z)*(x-a.x)/(b.x-a.x));
    }
    intersections.sort((a,b)=>a-b);
    const z=terrainRiverZ(t,x);
    let low=0,high=0;
    for(let i=0;i+1<intersections.length;i+=2) {
      const a=Math.max(z-stream.halfWidth,intersections[i]),b=Math.min(z+stream.halfWidth,intersections[i+1]);
      if(b>a){low=a;high=b;break;}
    }
    if(high<=low){previous=-1;continue;}
    const current=streamVertices.length/3;
    streamVertices.push(x,stream.surfaceHeight,low,x,stream.surfaceHeight,high);
    if(previous>=0)streamIndices.push(previous,current,previous+1,previous+1,current,current+1);
    previous=current;
  }
  const riverGeo=new T.BufferGeometry();riverGeo.setAttribute('position',new T.Float32BufferAttribute(streamVertices,3));riverGeo.setIndex(streamIndices);riverGeo.computeVertexNormals();addPlanarUv(riverGeo,8);
  if(palette)addArunikaSurfaceUv(riverGeo);
  const river=new T.Mesh(riverGeo,palette?.get('water_river')??waterMat);river.name='river';group.add(river);
  for(const p of terrainPonds(t)){
    const geo=new T.CircleGeometry(1,32);if(palette)addArunikaSurfaceUv(geo);
    const pond=new T.Mesh(geo,palette?.get('water_pond')??waterMat);pond.rotation.x=-Math.PI/2;pond.scale.set(p.rx,p.rz,1);pond.position.set(p.x,p.surfaceHeight,p.z);pond.name='pond';group.add(pond);
  }
  // Waterfalls follow actual polygon/stream intersections at either coastline.
  for(const direction of [-1,1]) {
    let x=0;while(insideBoundary(t,{x:x+direction*.5,z:terrainRiverZ(t,x+direction*.5)}))x+=direction*.5;
    const geo=new T.PlaneGeometry(stream.halfWidth*1.92,9);if(palette)addArunikaSurfaceUv(geo);
    const fall=new T.Mesh(geo,palette?.get('waterfall')??waterMat);fall.position.set(x, stream.surfaceHeight-4.5,terrainRiverZ(t,x));fall.rotation.y=Math.PI/2;fall.name='waterfall';group.add(fall);
    for(let k=0;k<5;k++)part(new T.IcosahedronGeometry(1,0),'#c7e8de',x+direction*.8,-6.4,terrainRiverZ(t,x)+(k-2)*.85,0,0,0,'water_foam');
  }
  if(palette)waterMat.dispose();
  for(const bridge of t.bridges) {
    for(let j=0;j<32;j++) {
      const z=bridge.z-bridge.length/2+(j+.5)*bridge.length/32,y=terrainHeight(t,bridge.x,z);
      box(bridge.x,z,bridge.width,.18,bridge.length/32+.015,wood,y-.09);
    }
    for(const side of [-1,1])for(let j=0;j<=8;j++) {
      const z=bridge.z-bridge.length/2+j*bridge.length/8,x=bridge.x+side*bridge.width/2,y=terrainHeight(t,bridge.x,z);
      box(x,z,.16,1.05,.16,darkWood,y+.5);
      if(j<8) {
        const nextZ=z+bridge.length/8,nextY=terrainHeight(t,bridge.x,nextZ);
        beam(new T.Vector3(x,y+.9,z),new T.Vector3(x,nextY+.9,nextZ),.08,gold);
      }
    }
  }
  if(!eastern){
  // Preserve landmark sizes while expanding only their Padang positions.
  for(let i=0;i<3;i++) {
    const z=layout(17+i*6);
    box(layout(-36),z,15,.16,4.7,'#92894e',undefined,0,'soil_tilled');
    for(let j=0;j<9;j++) {
      const x=layout(-42+j*1.45);
      box(x,z,.16,.48,3.8,'#c5b65c',undefined,0,'crop_foliage');
    }
    box(layout(-36),z+layout(2.7),16,.1,.48,'#66a8a0',undefined,0,'water_pond');
    for(const x of [-44,-28])box(layout(x),z,.24,.6,4.7,wood);
  }
  // Supply cart and entry signposts. No collider blocks the gateway or routes.
  box(layout(12),layout(45),1.8,.6,2.3,wood,undefined,0,'wood_props');
  for(const side of [-1,1])part(new T.CylinderGeometry(.65,.65,.16,10),darkWood,layout(12+side*1.1),terrainHeight(t,layout(12),layout(45))+.45,layout(45),0,0,Math.PI/2,'wood_props');
  for(const [x,z] of [[24,32],[-19,17],[29,-20]]) {
    const px=layout(x),pz=layout(z);
    box(px,pz,.18,2.4,.18,wood);
    box(px,pz,1.7,.45,.16,gold,terrainHeight(t,px,pz)+2.1,0,'wood_props');
  }
  // Campfire, supplies and a small banner.
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4;part(new T.IcosahedronGeometry(.26,0),stone,layout(24+Math.cos(a)*.9),terrainHeight(t,layout(24),layout(40))+.16,layout(40+Math.sin(a)*.9),0,0,0,'rock_natural');
  }
  part(new T.ConeGeometry(.55,1.25,5),'#e9a45b',layout(24),terrainHeight(t,layout(24),layout(40))+.55,layout(40),0,0,0,'fire_effect');
  if(palette)addArunikaCampfireDetails(group,layout(24),terrainHeight(t,layout(24),layout(40)),layout(40),palette);
  box(layout(18),layout(39),.15,3,.15,darkWood);box(layout(18.55),layout(39),1.1,1.1,.07,'#ba674e',terrainHeight(t,layout(18.55),layout(39))+2.35,0,'fabric_banner');
  } else {
    // Dusun Purnama: terraced crop plots around an open village road.
    for(const [x,z] of [[-20,33],[-17,18],[-5,40]]){
      box(x,z,9,.14,4.8,'#9b9654');
      for(let j=0;j<7;j++)box(x-3.8+j*1.2,z,.2,.45,4,'#d5c269');
      box(x,z+2.8,10,.12,.42,'#69a7a6');
      for(const side of [-1,1])box(x+side*4.8,z,.16,.7,5,wood);
    }
    // Camp and trade supplies beside the western gate, not in a monster cluster.
    const fire={x:t.camp.x+3,z:t.camp.z-1};
    for(let i=0;i<8;i++){const a=i*Math.PI/4;part(new T.IcosahedronGeometry(.24,0),stone,fire.x+Math.cos(a)*.85,terrainHeight(t,fire.x,fire.z)+.15,fire.z+Math.sin(a)*.85);}
    part(new T.ConeGeometry(.5,1.2,5),'#efab5c',fire.x,terrainHeight(t,fire.x,fire.z)+.5,fire.z);
    for(const [x,z] of [[-36,25],[-23,23],[32,0],[20,45]]){
      box(x,z,.15,3,.15,darkWood);box(x+.6,z,1.2,1.4,.06,'#4c8296',terrainHeight(t,x,z)+2.1);
    }
    box(-24,38,1.8,.7,2.5,wood);
    for(const side of [-1,1])part(new T.CylinderGeometry(.55,.55,.16,10),darkWood,-24+side*1.1,terrainHeight(t,-24,38)+.4,38,0,0,Math.PI/2);
    // Small water mill at the western crossing; wheel is scenery, not another system.
    const mill=t.bridges[0],wheelY=terrainHeight(t,mill.x-4,mill.z)+1.5;
    part(new T.TorusGeometry(1.5,.14,5,16),wood,mill.x-4,wheelY,mill.z,0,Math.PI/2);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;beam(new T.Vector3(mill.x-4,wheelY,mill.z),new T.Vector3(mill.x-4,wheelY+Math.sin(a)*1.5,mill.z+Math.cos(a)*1.5),.07,gold);}
    // Wetland reeds, low islets and a docked fishing skiff. All use existing water collision.
    for(const p of terrainPonds(t))for(let i=0;i<18;i++){
      const a=i*Math.PI/9,x=p.x+Math.cos(a)*(p.rx+.45),z=p.z+Math.sin(a)*(p.rz+.45);
      if(!terrainWalkable(t,{x,z},.1)||Math.abs(x-20)<3)continue;
      part(new T.ConeGeometry(.3,1.4,4),'#76944c',x,terrainHeight(t,x,z)+.6,z);
    }
    for(const [x,z] of [[2,18],[5,17]])part(new T.IcosahedronGeometry(1.2,0),'#8d9d70',x,1.75,z);
    const hull=new T.SphereGeometry(1,8,5);hull.scale(1.15,.45,2.8);
    part(hull,wood,24,1.96,35);box(24,35,1.8,.15,4.3,darkWood,2.15);
    box(24,35,.13,3.5,.13,wood,3.8);part(new T.PlaneGeometry(1.65,2.2),'#dbc99b',24.8,4.05,35);
    // Low ruined stair and root fragments are kept outside the open boss clearing.
    const stairs=t.stairs!;
    for(let i=0;i<10;i++){const z=stairs.z-(i+.5)*stairs.length/10;box(stairs.x,z,stairs.width,.25,stairs.length/10+.02,stone,terrainHeight(t,stairs.x,z)-.12);}
  }

  for(const prop of t.props) {
    const {x,z,kind,scale:s}=prop,h=terrainHeight(t,x,z,false);
    surfaceRole=kind==='tent'?'fabric_canvas':kind==='crate'?'wood_props':'temple_stone';
    if(kind==='granary'||kind==='hut') {
      const w=kind==='granary'?5:4;
      for(const dx of [-1,1])for(const dz of [-1,1])box(x+dx*w*.38*s,z+dz*1.5*s,.35*s,2*s,.35*s,darkWood,h+s);
      box(x,z,w*s,2.4*s,3.8*s,wood,h+2.4*s);
      box(x,z+1.93*s,1.15*s,1.5*s,.08,darkWood,h+2.15*s);
      part(new T.ConeGeometry(w*.85*s,2*s,4),roof,x,h+4.35*s,z,0,Math.PI/4);
      part(new T.ConeGeometry(w*.55*s,1.4*s,4),gold,x,h+5.1*s,z,0,Math.PI/4,0,'roof_tiles');
    } else if(kind==='tent') {
      part(new T.CylinderGeometry(2.8,2.8,3.2,3), '#d1b77a',x,h+1.3,z,Math.PI/2,0,Math.PI/2);
      for(const side of [-1,1])box(x,z+side*1.9,.12,3.1,.12,wood,h+1.55);
    } else if(kind==='crate') {
      box(x,z,1.4,1.2,1.4,wood);box(x,z,1.5,.15,1.5,gold,h+.98);
    } else if(kind==='watchtower') {
      for(const dx of [-1,1])for(const dz of [-1,1])box(x+dx*1.1*s,z+dz*1.1*s,.25*s,5*s,.25*s,darkWood,h+2.5*s);
      box(x,z,3*s,.35*s,3*s,wood,h+4.8*s);
      for(const side of [-1,1])box(x+side*1.3*s,z,.15*s,1.2*s,2.8*s,wood,h+5.5*s);
      part(new T.ConeGeometry(2.4*s,1.8*s,4),roof,x,h+7*s,z,0,Math.PI/4);
    } else if(kind==='ruin-column') {
      box(x,z,2*s,.5,2*s,stone,h+.25);box(x,z,1.1*s,3*s,1.1*s,'#a0aa90',h+1.7*s);
      part(new T.DodecahedronGeometry(.9,0),'#c1bc9b',x,h+3.4*s,z);
    } else if(kind==='ruins') {
      box(x,z,10,.8,6,stone,h+.4);
      for(const side of [-1,1]){box(x+side*3.1,z,1.3,5,1.6,'#a7b097',h+3);box(x+side*3.1,z,1.7,.5,2,gold,h+5.4);}
      part(new T.TorusGeometry(3.1,.6,6,20,Math.PI),'#a7b097',x,h+3.6,z);
      box(x-1,z+1,1.6,1.3,1.6,'#879476',h+.8,.4);
    } else if(kind==='temple') {
      for(let i=0;i<4;i++)box(x,z,10-i*1.5,1,8-i*1.1,stone,h+.5+i);
      for(const side of [-1,1])box(x+side*2,z,.85,5,.85,'#75806e',h+5);
      box(x,z,5.8,.8,3,'#656f5c',h+7.4);
      part(new T.ConeGeometry(3.3,2.4,4),stone,x,h+8.9,z,0,Math.PI/4);
      // Wide stairs face the arena; walking uses the matching gentle ramp.
      for(let i=0;i<12;i++) {
        const sx=layout(-3),sz=layout(-43-(i+.5)*.5);
        box(sx,sz,5.2,.25,.51,'#a4a587',terrainHeight(t,sx,sz)-.12);
      }
    }
  }
  // Roots frame the arena instead of obstructing its center.
  surfaceRole='wood_beams';
  if(!eastern)for(let i=0;i<12;i++) {
    const a=i*Math.PI/6,x=Math.cos(a)*layout(16),z=t.arena.z+Math.sin(a)*layout(16);
    if(z>layout(-28)||Math.abs(x+layout(3))<layout(4))continue;
    const h=terrainHeight(t,x,z),end=new T.Vector3(x*1.18,h+2,z-2);
    const rootCurve=new T.CatmullRomCurve3([new T.Vector3(x*.93,h+.12,z+1),new T.Vector3(x,h+.4,z),end,new T.Vector3(x*1.15,h+1.3,z-3)]);
    part(new T.TubeGeometry(rootCurve,9,.38,5,false),darkWood,0,0,0);
  }
  // Roots climbing the temple walls, away from stairs and the boss clearing.
  if(!eastern)for(const side of [-1,1]) {
    const x=layout(-3+side*4.8),z=layout(-53),h=terrainHeight(t,x,z);
    const curve=new T.CatmullRomCurve3([new T.Vector3(x+side*3,h,z+4),new T.Vector3(x,h+1,z+3),new T.Vector3(x-side,h+3,z),new T.Vector3(x-side*2,h+6,z-1)]);
    part(new T.TubeGeometry(curve,12,.5,5,false),wood,0,0,0);
  }
  if(eastern)for(let i=0;i<10;i++) {
    const a=i*Math.PI/5,x=t.arena.x+Math.cos(a)*17,z=t.arena.z+Math.sin(a)*17;
    if(z>t.arena.z+4||terrainPathDistance(t,{x,z})<4)continue;
    const y=terrainHeight(t,x,z),curve=new T.CatmullRomCurve3([new T.Vector3(x,y+.1,z),new T.Vector3(x+1,y+.9,z-1),new T.Vector3(x+3,y+.2,z-3)]);
    part(new T.TubeGeometry(curve,8,.4,5,false),darkWood,0,0,0);
  }
  // Weathered rock columns break up the cliff skirt and low-detail distant crags.
  for(let i=0;i<t.boundary.length;i+=2) {
    const p=t.boundary[i],h=terrainHeight(t,p.x,p.z,false);
    const column=new T.CylinderGeometry(1.8,2.4,h+9,5);column.scale(1,1,1.3);
    part(column,i%4?'#7c8070':'#8d8b74',p.x*1.012,(h-9)/2,p.z*1.012,.025*Math.sin(i),i,.035*Math.cos(i),'cliff_rock');
  }
  for(let i=0;i<7;i++) {
    const a=3.4+i*.4,r=105+i%3*12;
    part(new T.ConeGeometry(15+i%3*3,24+i%4*5,6),'#889f91',Math.cos(a)*r,-1,Math.sin(a)*r,0,i*.7,0,'distant_rock');
  }
  for(const [key,geometries] of batches) {
    const {color,kind:surface}=batchSurfaces.get(key)!;
    const combined=mergeGeometries(geometries,false)!;geometries.forEach(g=>g.dispose());
    addPlanarUv(combined,5);
    const kind=color===wood?'wood':color===roof||color===darkWood?'wood':color===stone||color===gold?'rock':'rock';
    const mesh=new T.Mesh(combined,palette?.get(surface,color)??createBasicMapMaterial(kind,{color,roughness:.95,flatShading:true}));
    mesh.name='landscape-static';mesh.receiveShadow=true;mesh.castShadow=true;group.add(mesh);
  }
  const rocks=t.props.filter(p=>p.kind==='rock');
  const matrix=new T.Object3D();
  for(const [geo,color,offset,list] of [
    [new T.DodecahedronGeometry(1.6,0),'#90917a',.6,rocks],
  ] as const) {
    if(palette)addArunikaSurfaceUv(geo);
    const instance=new T.InstancedMesh(geo,palette?.get('rock_natural')??createBasicMapMaterial('rock',{color,roughness:1,flatShading:true}),list.length);
    list.forEach((p,i)=>{matrix.position.set(p.x,terrainHeight(t,p.x,p.z,false)+offset*p.scale,p.z);matrix.scale.setScalar(p.scale);matrix.rotation.y=i*2.4;matrix.updateMatrix();instance.setMatrixAt(i,matrix.matrix);});
    instance.name='landscape-instanced';instance.castShadow=true;instance.receiveShadow=true;instance.computeBoundingSphere();group.add(instance);
  }
  let seed=9241;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const grassPoints=[];
  const grassExtent=t.id==='verdant-plains'?120:62;
  for(let i=0;i<1200;i++) {
    const p={x:(rand()-.5)*grassExtent*2,z:(rand()-.5)*grassExtent*2};
    if(eastern&&terrainBridge(t,p,-.5))continue;
    if(terrainWalkable(t,p,.15)&&terrainPathDistance(t,p)>2.5&&!terrainSafe(t,p)&&Math.hypot(p.x-t.arena.x,p.z-t.arena.z)>14)grassPoints.push(p);
  }
  const grass=new T.InstancedMesh(new T.ConeGeometry(.22,.7,3),createBasicMapMaterial('grass',{color:'#c3d47e',roughness:1}),grassPoints.length);
  grass.name='field-grass-tufts';
  grassPoints.forEach((p,i)=>{matrix.position.set(p.x,terrainHeight(t,p.x,p.z)+.25,p.z);matrix.scale.set(1,1,1);matrix.rotation.y=i;matrix.updateMatrix();grass.setMatrixAt(i,matrix.matrix);});grass.computeBoundingSphere();group.add(grass);
  const ready = t.id==='verdant-plains'&&typeof document!=='undefined'
    ? enhanceArunikaGrassTufts(grass).catch(error=>console.warn('Material rumput Padang Arunika gagal dimuat; memakai rumput dasar.',error))
    : Promise.resolve();
  const flowerGeo=new T.IcosahedronGeometry(.16,0);if(palette)addArunikaSurfaceUv(flowerGeo);
  const flowers=new T.InstancedMesh(flowerGeo,palette?.get('flower_foliage')??createBasicMapMaterial('sand',{color:'#f1dfa2'}),Math.floor(grassPoints.length/5));
  for(let i=0;i<flowers.count;i++){const p=grassPoints[i*5];matrix.position.set(p.x+.25,terrainHeight(t,p.x,p.z)+.4,p.z);matrix.scale.setScalar(1);matrix.updateMatrix();flowers.setMatrixAt(i,matrix.matrix);}flowers.computeBoundingSphere();group.add(flowers);
  return ready;
}
