import type { FieldTerrain, GroundPoint, TerrainProp } from './field-terrain.ts';

const point=(x:number,z:number):GroundPoint=>({x,z});
// A broad western arrival, narrow northern highlands and a southern coastal lobe.
// Vertex angles stay ordered for the shared radial terrain mesh / height sampler.
const boundary=Array.from({length:64},(_,i)=>{
  const a=i*Math.PI*2/64,r=1+.1*Math.cos(3*a-.6)+.055*Math.sin(5*a+.7);
  return point(Math.cos(a)*61*r,Math.sin(a)*54*r);
});
const river={offset:3,amplitude:6,frequency:.06,phase:-6,slope:.18,halfWidth:2.7,surfaceHeight:2.1,bedHeight:1.55,bankWidth:14};
const riverZ=(x:number)=>river.offset+river.slope*x+river.amplitude*Math.sin((x+river.phase)*river.frequency);
const props:TerrainProp[]=[
  {kind:'tent',x:-41,z:31,radius:2.5,scale:1},
  {kind:'crate',x:-35,z:31,radius:1,scale:1},
  {kind:'hut',x:-27,z:27,radius:3.2,scale:1},
  {kind:'hut',x:-8,z:30,radius:3.1,scale:.95},
  {kind:'hut',x:-18,z:41,radius:3,scale:.9},
  {kind:'granary',x:-30,z:37,radius:3.7,scale:1},
  {kind:'granary',x:35,z:30,radius:3.2,scale:.85},
  {kind:'watchtower',x:-47,z:9,radius:1.8,scale:1},
  {kind:'watchtower',x:37,z:-6,radius:1.8,scale:1},
  {kind:'watchtower',x:31,z:35,radius:1.6,scale:.85},
  {kind:'ruins',x:16,z:-47,radius:5,scale:1,halfWidth:5,halfDepth:3},
  {kind:'ruin-column',x:31,z:-42,radius:1.3,scale:1.1},
  {kind:'ruin-column',x:-12,z:-27,radius:1.1,scale:.9},
  {kind:'collision',x:-24,z:38,radius:1.5,scale:1},
  {kind:'collision',x:-20,z:riverZ(-16),radius:1.5,scale:1},
  {kind:'collision',x:-35,z:26,radius:.9,scale:1},
];
for(const side of [-1,1]){
  props.push({kind:'collision',x:-51,z:20+side*4.2,radius:.85,scale:1});
  props.push({kind:'collision',x:49+side*3.4,z:-9,radius:1.1,scale:1});
}

export const EAST_GATE_TERRAIN:FieldTerrain={
  id:'east-gate-arunika',theme:'eastern-frontier',boundary,
  entry:point(-43,20),camp:point(-38,27),cityGate:point(-51,20),cityGateYaw:Math.PI/2,
  exit:point(49,-9),sanctuary:point(-34,16),arena:{x:12,z:-30,radius:14},
  river,ponds:[{x:20,z:35,rx:10,rz:7,surfaceHeight:1.9,bedHeight:1.25},{x:3,z:18,rx:6,rz:4,surfaceHeight:2,bedHeight:1.35}],
  elevation:{base:2.6,rise:6.5,northStart:18,northEnd:-34,rolling:.55,arenaHeight:9.5,
    plazas:[{x:-42,z:23,radius:10,falloff:19,height:2.8},{x:-20,z:30,radius:12,falloff:20,height:3},{x:22,z:43,radius:8,falloff:17,height:2.9}]},
  stairs:{x:16,z:-39,width:5.2,length:5,rise:.8},
  bridges:[...[-16,30].map(x=>({x,z:riverZ(x),width:6,length:18})),{x:20,z:39,width:4,length:13,deckHeight:3.05,kind:'dock'}],
  spawnZones:[point(-28,9),point(-15,31),point(-30,-23),point(38,-23)],
  eliteSpawns:[point(-39,-17),point(-21,-39),point(36,-37),point(42,4),point(-3,-20)],
  safeZones:[{x:-51,z:20,radius:4},{x:49,z:-9,radius:5}],
  landmarks:[{name:'Gerbang Timur',x:-43,z:20},{name:'Dusun Purnama',x:-19,z:28},{name:'Lembah Cahaya',x:12,z:-30},{name:'Rawa Sinar',x:3,z:18},{name:'Pelabuhan Timur',x:20,z:43}],
  paths:[
    [point(-53,20),point(-43,20),point(-32,22),point(-20,24),point(-16,11),point(-16,riverZ(-16)),point(-17,-18),point(-3,-25),point(12,-30)],
    [point(-20,24),point(-10,24),point(-3,29),point(5,33),point(10,43),point(20,46)],
    [point(-10,24),point(-3,29),point(17,24),point(30,riverZ(30)),point(32,1),point(42,-6),point(49,-9)],
    [point(12,-30),point(29,-25),point(40,-17),point(49,-9)],
    [point(12,-30),point(16,-39),point(16,-43)],
    [point(-32,22),point(-41,1),point(-29,-1),point(-16,riverZ(-16)),point(-17,-18)],
  ],props,
};
