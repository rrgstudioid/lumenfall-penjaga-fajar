import { EAST_GATE_TERRAIN } from './east-gate-layout.ts';
export { EAST_GATE_TERRAIN } from './east-gate-layout.ts';
// Field geometry and navigation share this data. Other regions retain their renderer.
export type GroundPoint = { x: number; z: number };
export type TerrainProp = GroundPoint & { kind: 'rock'|'hut'|'granary'|'temple'|'tent'|'crate'|'collision'|'watchtower'|'ruins'|'ruin-column'; radius: number; scale: number; halfWidth?:number; halfDepth?:number };
export type TerrainPond=GroundPoint & {rx:number;rz:number;surfaceHeight:number;bedHeight:number};
export type TerrainRiver={offset:number;amplitude:number;frequency:number;phase:number;slope:number;halfWidth:number;surfaceHeight:number;bedHeight:number;bankWidth:number};
export type FieldTerrain = {
  id: string; boundary: GroundPoint[]; entry: GroundPoint; camp: GroundPoint;
  exit: GroundPoint; cityGate: GroundPoint; sanctuary:GroundPoint; arena: GroundPoint & {radius:number};
  bridges: Array<GroundPoint & {width:number; length:number;deckHeight?:number;kind?:'dock'}>;
  paths: GroundPoint[][]; props: TerrainProp[];
  theme?:'eastern-frontier';cityGateYaw?:number;river?:TerrainRiver;ponds?:TerrainPond[];
  elevation?:{base:number;rise:number;northStart:number;northEnd:number;rolling:number;arenaHeight:number;plazas:Array<GroundPoint & {radius:number;falloff:number;height:number}>};
  stairs?:GroundPoint & {width:number;length:number;rise:number};
  spawnZones?:GroundPoint[];eliteSpawns?:GroundPoint[];safeZones?:Array<GroundPoint & {radius:number}>;
  landmarks?:Array<GroundPoint & {name:string}>;
  /** Horizontal world expansion for this field only; elevation remains unscaled. */
  horizontalScale?: number;
};
const smooth = (a:number,b:number,v:number) => { const t=Math.max(0,Math.min(1,(v-a)/(b-a))); return t*t*(3-2*t); };
const point = (x:number,z:number):GroundPoint => ({x,z});
export const verdantRiverZ = (x:number) => -6 + 4*Math.sin((x+10)*.06);
const DEFAULT_RIVER:TerrainRiver={offset:-6,amplitude:4,frequency:.06,phase:10,slope:0,halfWidth:2.5,surfaceHeight:2.05,bedHeight:1.55,bankWidth:14};
const DEFAULT_PONDS:TerrainPond[]=[{x:43,z:23,rx:8,rz:6,surfaceHeight:1.9,bedHeight:1.25}];
export const terrainRiver=(t:FieldTerrain)=>t.river??DEFAULT_RIVER;
const rawTerrainRiverZ=(t:FieldTerrain,x:number)=>{const r=terrainRiver(t);return r.offset+r.slope*x+r.amplitude*Math.sin((x+r.phase)*r.frequency);};
export const terrainRiverZ=(t:FieldTerrain,x:number)=>{const scale=t.horizontalScale??1;return rawTerrainRiverZ(t,x/scale)*scale;};
export const terrainPonds=(t:FieldTerrain)=>t.ponds??(t.id==='verdant-plains'
  ? DEFAULT_PONDS.map(pond=>({...pond,x:pond.x*2,z:pond.z*2}))
  : DEFAULT_PONDS);
const boundary = Array.from({length:64},(_,i)=>{
  const a=i*Math.PI*2/64, r=1+.07*Math.sin(a*3+.8)+.045*Math.cos(a*7);
  return point(Math.cos(a)*60*r, Math.sin(a)*60*r);
});
export const VERDANT_TERRAIN: FieldTerrain = {
  id:'verdant-plains', boundary, entry:point(28,39), camp:point(20,42), cityGate:point(28,48), exit:point(40,-28), sanctuary:point(12,32),
  arena:{x:0,z:-36,radius:14},
  bridges:[-24,25].map(x=>({...point(x,verdantRiverZ(x)),width:6,length:16})),
  paths:[
    [point(28,49),point(28,43),point(22,30),point(10,20),point(-9,21),point(-26,20),point(-24,8),point(-24,verdantRiverZ(-24)),point(-24,-23),point(-10,-31),point(0,-36)],
    [point(10,20),point(25,14),point(25,verdantRiverZ(25)),point(26,-17),point(23,-28),point(11,-35),point(0,-36)],
    [point(23,-28),point(35,-29),point(40,-28)],
    [point(-26,20),point(-43,25),point(-44,10),point(-39,-1),point(-24,-23)],
    [point(0,-36),point(-3,-47)],
  ], props:[],
};
export const FIELD_TERRAINS: Readonly<Record<string,FieldTerrain>> = {'verdant-plains':VERDANT_TERRAIN,'east-gate-arunika':EAST_GATE_TERRAIN};
export function segmentDistance(p:GroundPoint,a:GroundPoint,b:GroundPoint) {
  const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
}
export function insideBoundary(t:FieldTerrain,p:GroundPoint,margin=0) {
  let inside=false;
  for(let i=0,j=t.boundary.length-1;i<t.boundary.length;j=i++) {
    const a=t.boundary[i],b=t.boundary[j];
    if(margin && segmentDistance(p,a,b)<margin)return false;
    if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside;
}
export function terrainPathDistance(t:FieldTerrain,p:GroundPoint) {
  let d=Infinity;
  for(const path of t.paths)for(let i=1;i<path.length;i++)d=Math.min(d,segmentDistance(p,path[i-1],path[i]));
  return d;
}
export function terrainBridge(t:FieldTerrain,p:GroundPoint,margin=0) {
  return t.bridges.find(b=>Math.abs(p.x-b.x)<=b.width/2-margin&&Math.abs(p.z-b.z)<=b.length/2);
}
export function terrainWater(t:FieldTerrain,p:GroundPoint,margin=0) {
  if(terrainBridge(t,p,margin))return false;
  return Math.abs(p.z-terrainRiverZ(t,p.x))<terrainRiver(t).halfWidth+margin || terrainPonds(t).some(pond=>((p.x-pond.x)/(pond.rx+margin))**2+((p.z-pond.z)/(pond.rz+margin))**2<1);
}
export function terrainSafe(t:FieldTerrain,p:GroundPoint,margin=0) {
  return Math.hypot(p.x-t.entry.x,p.z-t.entry.z)<8+margin || Math.hypot(p.x-t.camp.x,p.z-t.camp.z)<9+margin || Math.hypot(p.x-t.sanctuary.x,p.z-t.sanctuary.z)<4.7+margin || Boolean(t.safeZones?.some(s=>Math.hypot(p.x-s.x,p.z-s.z)<s.radius+margin));
}
export const TERRAIN_RINGS=48;
const heightGrids=new WeakMap<FieldTerrain,Array<Array<GroundPoint & {y:number}>>>();
const boundaryAngles=new WeakMap<FieldTerrain,number[]>();
// Interpolate the same radial triangles the renderer uses: feet match the actual mesh.
function meshHeight(t:FieldTerrain,x:number,z:number) {
  let rows=heightGrids.get(t);
  if(!rows) {
    rows=Array.from({length:TERRAIN_RINGS+1},(_,r)=>t.boundary.map(p=>{const x=p.x*r/TERRAIN_RINGS,z=p.z*r/TERRAIN_RINGS;return {x,z,y:terrainHeight(t,x,z,false)};}));
    heightGrids.set(t,rows);
  }
  // Elliptical/irregular layouts do not have equally spaced polar angles. Find
  // the actual wedge rather than assuming the vertex index is angle / 2PI.
  let angles=boundaryAngles.get(t);
  if(!angles){angles=t.boundary.map(p=>(Math.atan2(p.z,p.x)+Math.PI*2)%(Math.PI*2));boundaryAngles.set(t,angles);}
  const angle=(Math.atan2(z,x)+Math.PI*2)%(Math.PI*2);
  let lo=0,hi=angles.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(angles[mid]<=angle)lo=mid+1;else hi=mid;}
  const i=Math.max(0,lo-1),j=(i+1)%t.boundary.length;
  const a=t.boundary[i],b=t.boundary[j],det=a.x*b.z-b.x*a.z;
  const u=(x*b.z-b.x*z)/det,v=(a.x*z-x*a.z)/det,r=Math.max(0,Math.min(TERRAIN_RINGS-1,Math.floor((u+v)*TERRAIN_RINGS)));
  for(const [aa,bb,cc] of [[rows[r][i],rows[r][j],rows[r+1][i]],[rows[r][j],rows[r+1][j],rows[r+1][i]]]) {
    const d=(bb.z-cc.z)*(aa.x-cc.x)+(cc.x-bb.x)*(aa.z-cc.z);if(Math.abs(d)<1e-9)continue;
    const w1=((bb.z-cc.z)*(x-cc.x)+(cc.x-bb.x)*(z-cc.z))/d,w2=((cc.z-aa.z)*(x-cc.x)+(aa.x-cc.x)*(z-cc.z))/d,w3=1-w1-w2;
    if(Math.min(w1,w2,w3)>-1e-6)return aa.y*w1+bb.y*w2+cc.y*w3;
  }
  return terrainHeight(t,x,z,false);
}
// Continuous heightfield construction, plus the inexpensive matching walk surface.
export function terrainHeight(t:FieldTerrain,x:number,z:number,walkSurface=true):number {
  const scale=t.horizontalScale??1;
  const sourceX=x/scale,sourceZ=z/scale;
  const river=terrainRiver(t),e=t.elevation;
  const riverDistance=Math.abs(sourceZ-rawTerrainRiverZ(t,sourceX));
  const north=smooth(e?.northStart??14,e?.northEnd??-35,sourceZ);
  const rolling=(e?.rolling??.4)*Math.sin(sourceX*.105)*Math.cos(sourceZ*.08);
  let h=(e?.base??2.3)+(e?.rise??5.5)*north+rolling;
  h+=(1-smooth(13,24,Math.hypot(sourceX-t.arena.x/scale,sourceZ-t.arena.z/scale)))*((e?.arenaHeight??8.3)-h);
  // East settlement terraces must not refill the river / harbor lake below.
  if(e)for(const p of e.plazas)h+=(p.height-h)*(1-smooth(p.radius,p.falloff,Math.hypot(sourceX-p.x/scale,sourceZ-p.z/scale)));
  // Wide, gentle banks lead into the stream bed; water itself is not walkable.
  h+=(1-smooth(river.halfWidth,river.bankWidth,riverDistance))*(river.bedHeight-h);
  for(const p of terrainPonds(t)){
    const pond=Math.hypot((x-p.x)/p.rx,(z-p.z)/p.rz);
    h+=(1-smooth(.85,1.5,pond))*(p.bedHeight-h);
  }
  // Arrival/camp and farm terraces have broad level surfaces.
  if(!e) {
   const plaza=1-smooth(9,18,Math.hypot(sourceX-24,sourceZ-43)); h+=(2.4-h)*plaza;
   if(sourceX>-47&&sourceX<-25&&sourceZ>12&&sourceZ<37) {
    const blend=smooth(-47,-44,sourceX)*(1-smooth(-28,-25,sourceX))*smooth(12,15,sourceZ)*(1-smooth(34,37,sourceZ));
    h+=(2.8+.18*Math.sin(sourceZ*.5)-h)*blend;
   }
  }
  if(walkSurface) {
    h=meshHeight(t,x,z);
    const bridge=terrainBridge(t,{x,z});
    if(bridge) {
      const start=meshHeight(t,bridge.x,bridge.z-bridge.length/2);
      const end=meshHeight(t,bridge.x,bridge.z+bridge.length/2);
      const u=(z-(bridge.z-bridge.length/2))/bridge.length;
      h=bridge.deckHeight??(start*(1-u)+end*u+.12*Math.sin(Math.PI*u));
    }
    // Temple steps have a matching simple collision ramp.
    const stairs=t.stairs??{x:-3,z:-43,width:5.2,length:6,rise:.96};
    if(Math.abs(x-stairs.x)<stairs.width/2&&z>=stairs.z-stairs.length&&z<=stairs.z)h+=(stairs.z-z)*stairs.rise/stairs.length;
  }
  return h;
}
export function terrainWalkable(t:FieldTerrain,p:GroundPoint,radius=.45,enemy=false) {
  return Number.isFinite(p.x)&&Number.isFinite(p.z)&&insideBoundary(t,p,1.3+radius)&&
    !terrainWater(t,p,radius)&&(!enemy||!terrainSafe(t,p,radius))&&
    !t.props.some(prop=>prop.halfWidth!==undefined&&prop.halfDepth!==undefined
      ?Math.hypot(Math.max(0,Math.abs(prop.x-p.x)-prop.halfWidth),Math.max(0,Math.abs(prop.z-p.z)-prop.halfDepth))<radius
      :Math.hypot(prop.x-p.x,prop.z-p.z)<prop.radius+radius);
}
export function nearestTerrainPoint(t:FieldTerrain,p:GroundPoint,radius=.45,enemy=false):GroundPoint {
  if(terrainWalkable(t,p,radius,enemy))return {...p};
  if(Number.isFinite(p.x)&&Number.isFinite(p.z))for(let r=1;r<150;r+=1) {
    for(let i=0;i<32;i++) {
      const a=i*Math.PI/16,q=point(p.x+Math.cos(a)*r,p.z+Math.sin(a)*r);
      if(terrainWalkable(t,q,radius,enemy))return q;
    }
  }
  return enemy?point(t.arena.x,t.arena.z):{...t.entry};
}
// Sweep in small steps so a dodge, dash or knockback cannot tunnel across water/cliffs.
export function moveOnTerrain(t:FieldTerrain,from:GroundPoint,dx:number,dz:number,radius=.45,enemy=false) {
  let p=terrainWalkable(t,from,radius,enemy)?{...from}:nearestTerrainPoint(t,from,radius,enemy);
  const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3)),sx=dx/count,sz=dz/count;
  for(let i=0;i<count;i++) {
    const target=point(p.x+sx,p.z+sz);
    if(terrainWalkable(t,target,radius,enemy))p=target;
    else if(terrainWalkable(t,point(p.x+sx,p.z),radius,enemy))p.x+=sx;
    else if(terrainWalkable(t,point(p.x,p.z+sz),radius,enemy))p.z+=sz;
  }
  return p;
}
// Deterministic props also define cheap circle colliders. Keep paths and arena clear.
const fixed:TerrainProp[]=[
  {x:16,z:46,kind:'tent',radius:2.5,scale:1},
  {x:15,z:40,kind:'crate',radius:.9,scale:1},
  {x:-39,z:34,kind:'granary',radius:3.6,scale:1},
  {x:-46,z:19,kind:'hut',radius:3,scale:1},
  {x:-33,z:10,kind:'granary',radius:3.2,scale:.85},
  {x:-3,z:-54,kind:'temple',radius:4.5,scale:1,halfWidth:5,halfDepth:4},
];
fixed.push({x:12,z:45,kind:'collision',radius:1.5,scale:1});
for(const side of [-1,1]) {
  fixed.push({x:VERDANT_TERRAIN.cityGate.x+side*4.2,z:VERDANT_TERRAIN.cityGate.z,kind:'collision',radius:.85,scale:1});
  fixed.push({x:VERDANT_TERRAIN.exit.x+side*4.2*.65,z:VERDANT_TERRAIN.exit.z,kind:'collision',radius:.6,scale:1});
}
VERDANT_TERRAIN.props.push(...fixed);
let seed=7163;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<450;i++) {
  if(i%4!==0)continue;
  const p=point((rand()-.5)*126,(rand()-.5)*126),kind='rock' as const;
  if(!terrainWalkable(VERDANT_TERRAIN,p,1.8)||terrainSafe(VERDANT_TERRAIN,p,3)||terrainPathDistance(VERDANT_TERRAIN,p)<4.5||Math.hypot(p.x,p.z+36)<17)continue;
  if(p.x<-24&&p.z>6&&p.z<40)continue;
  // Forest clusters around the highlands and coast; open middle for combat.
  if(p.z>0&&Math.abs(p.x)<42&&i%5!==0)continue;
  const scale=.8+rand()*.65;
  VERDANT_TERRAIN.props.push({...p,kind,radius:1.65*scale,scale});
}

// The new field uses the same prop validation and shared renderer, with its own seed/layout.
let eastSeed=64829;
const eastRand=()=>{eastSeed=(Math.imul(eastSeed,1664525)+1013904223)>>>0;return eastSeed/4294967296;};
for(let i=0;i<460;i++) {
  if(i%4!==0)continue;
  const t=EAST_GATE_TERRAIN,p=point((eastRand()-.5)*132,(eastRand()-.5)*120),kind='rock' as const;
  if(!terrainWalkable(t,p,2)||terrainSafe(t,p,3)||terrainPathDistance(t,p)<4.8||Math.hypot(p.x-t.arena.x,p.z-t.arena.z)<18)continue;
  if((p.x>-34&&p.x<0&&p.z>14&&p.z<44)||(p.x>6&&p.x<34&&p.z>22))continue;
  if(p.z>0&&Math.abs(p.x)<38&&i%5!==0)continue;
  if(p.z>-20&&p.z<-10&&p.x>0&&p.x<24)continue;
  const scale=.85+eastRand()*.7;
  t.props.push({...p,kind,radius:1.65*scale,scale});
}

// Padang Arunika is the only existing field expanded in this pass. Layout
// spacing and terrain footprint grow around the same origin; actor geometry,
// elevations, collision radii, and monster definitions remain unchanged.
function expandPadangLayout(t:FieldTerrain, scale:number) {
  const mapPoint=(p:GroundPoint):GroundPoint=>({x:p.x*scale,z:p.z*scale});
  t.boundary=t.boundary.map(mapPoint);
  t.entry=mapPoint(t.entry);t.camp=mapPoint(t.camp);t.exit=mapPoint(t.exit);
  t.cityGate=mapPoint(t.cityGate);t.sanctuary=mapPoint(t.sanctuary);
  t.arena={...mapPoint(t.arena),radius:t.arena.radius};
  t.bridges=t.bridges.map(b=>({...b,...mapPoint(b)}));
  t.paths=t.paths.map(path=>path.map(mapPoint));
  t.props=t.props.map(prop=>({...prop,...mapPoint(prop)}));
  if(t.ponds)t.ponds=t.ponds.map(pond=>({...pond,...mapPoint(pond)}));
  if(t.stairs)t.stairs={...t.stairs,...mapPoint(t.stairs)};
  if(t.spawnZones)t.spawnZones=t.spawnZones.map(mapPoint);
  if(t.eliteSpawns)t.eliteSpawns=t.eliteSpawns.map(mapPoint);
  if(t.safeZones)t.safeZones=t.safeZones.map(zone=>({...zone,...mapPoint(zone)}));
  if(t.landmarks)t.landmarks=t.landmarks.map(landmark=>({...landmark,...mapPoint(landmark)}));
  t.horizontalScale=scale;
}

expandPadangLayout(VERDANT_TERRAIN,2);

// Small navigation grid for blocked enemy pursuits. Built lazily once per field/radius.
const navigation=new WeakMap<FieldTerrain,Map<number,{points:Map<string,GroundPoint>; size:number}>>();
export function terrainRoute(t:FieldTerrain,from:GroundPoint,to:GroundPoint,radius=.55):GroundPoint[] {
  let cache=navigation.get(t);if(!cache){cache=new Map();navigation.set(t,cache);}
  let grid=cache.get(radius);
  if(!grid) {
    const points=new Map<string,GroundPoint>();
    const extent=Math.ceil(Math.max(...t.boundary.flatMap(p=>[Math.abs(p.x),Math.abs(p.z)]))/2);
    for(let x=-extent;x<=extent;x++)for(let z=-extent;z<=extent;z++){const p={x:x*2,z:z*2};if(terrainWalkable(t,p,radius,true))points.set(`${x},${z}`,p);}
    grid={points,size:2};cache.set(radius,grid);
  }
  const nearest=(p:GroundPoint)=>{let key='',d=Infinity;for(const [k,q] of grid!.points){const dd=(q.x-p.x)**2+(q.z-p.z)**2;if(dd<d){key=k;d=dd;}}return key;};
  const start=nearest(from),end=nearest(to),queue=[start],previous=new Map<string,string|null>([[start,null]]);
  for(let n=0;n<queue.length;n++) {
    const key=queue[n];if(key===end)break;
    const [x,z]=key.split(',').map(Number);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next=`${x+dx},${z+dz}`;
      if(!grid.points.has(next)||previous.has(next))continue;
      const a=grid.points.get(key)!,b=grid.points.get(next)!;
      if(!terrainWalkable(t,{x:(a.x+b.x)/2,z:(a.z+b.z)/2},radius,true))continue;
      previous.set(next,key);queue.push(next);
    }
  }
  if(!previous.has(end))return [];
  const path:GroundPoint[]=[];let key:string|null=end;
  while(key!==null){path.unshift(grid.points.get(key)!);key=previous.get(key)??null;}
  return path;
}
