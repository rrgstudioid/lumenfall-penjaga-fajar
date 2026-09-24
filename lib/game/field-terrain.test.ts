import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { VERDANT_TERRAIN as t, FIELD_TERRAINS, terrainWalkable, terrainHeight, moveOnTerrain, terrainWater, terrainRoute, nearestTerrainPoint, terrainRiverZ, verdantRiverZ, insideBoundary } from './field-terrain.ts';
import {buildFieldTerrain} from './field-terrain-renderer.ts';
import {FIELDS,FIELD_NPCS,travel} from './regions.ts';
import {fieldSpawns,monsterRespawnKey,restoreRespawnDeadline} from './field-layout.ts';
import {freshHero,parseSave} from './rules.ts';

await test('organic fields opt in explicitly; Padang entry, camp and portal retain their layout',()=>{
  assert.deepEqual(Object.keys(FIELD_TERRAINS),['verdant-plains','east-gate-arunika']);
  assert.deepEqual(FIELDS[t.id].entry,t.entry);assert.deepEqual(FIELDS[t.id].exit,t.exit);
  assert.equal(FIELD_NPCS[t.id].x,t.camp.x);assert.equal(FIELDS[t.id].nextMap,'ironveil-mines');
  const h=freshHero();assert(travel(h,t.id).ok);assert.equal(h.x,t.entry.x);assert.equal(h.z,t.entry.z);
  for(const p of [t.entry,t.camp,t.cityGate,t.exit,{x:0,z:-36}])assert(terrainWalkable(t,p));
});
await test('all 42 instance IDs and species retain their population and respawn deadlines',()=>{
  const spawns=fieldSpawns(FIELDS[t.id]);
  assert.equal(spawns.length,42);assert.equal(new Set(spawns.map(s=>s.id)).size,42);
  assert.equal(new Set(spawns.map(s=>`${s.x},${s.z}`)).size,42);
  for(const s of spawns){assert(terrainWalkable(t,s,s.definition.variant==='boss'?1.8:.6,true),String(s.id));const key=monsterRespawnKey(s.definition.id,s.id);assert.equal(restoreRespawnDeadline({[key]:123456},s.definition.id,s.id),123456);}
  for(const species of FIELDS[t.id].normalMonsters)assert.equal(spawns.filter(s=>s.definition===species).length,9);
  assert.equal(spawns.filter(s=>s.definition.variant==='elite').length,5);
  assert.equal(spawns.find(s=>s.id===100)!.z,t.arena.z);
});
await test('swept movement blocks coast, water, props and long dashes; bridges connect both banks',()=>{
  for(const b of t.bridges){const start={x:b.x,z:b.z+10},end=moveOnTerrain(t,start,0,-20);assert(Math.abs(end.z-(b.z-10))<.01);assert(!terrainWater(t,end));}
  const river=terrainRiverZ(t,16),start={x:16,z:river+8};const stopped=moveOnTerrain(t,start,0,-24);
  assert(stopped.z>river+2.5);assert(terrainWalkable(t,stopped));
  const coast=moveOnTerrain(t,t.entry,200,200);assert(terrainWalkable(t,coast));
  for(const p of t.props)assert(!terrainWalkable(t,p),p.kind);
  for(let z=-56;z<56;z+=8)for(let x=-56;x<56;x+=8){const p=nearestTerrainPoint(t,{x,z});assert(terrainWalkable(t,p));}
});
await test('boss arena is clear and elevation provides gentle bands above the entry',()=>{
  assert(terrainHeight(t,t.arena.x,t.arena.z)>terrainHeight(t,t.entry.x,t.entry.z)+4);
  for(let dz=-8;dz<=8;dz+=2)for(let dx=-8;dx<=8;dx+=2)if(Math.hypot(dx,dz)<7)assert(terrainWalkable(t,{x:t.arena.x+dx,z:t.arena.z+dz},1.8,true));
  for(const b of t.bridges)for(let z=b.z-7.9;z<b.z+7.9;z+=.1)assert(Math.abs(terrainHeight(t,b.x,z+.1)-terrainHeight(t,b.x,z))<.09);
});
await test('navigation connects banks and every enemy home to nearby open terrain',()=>{
  const path=terrainRoute(t,{x:18,z:8},{x:20,z:-19});assert(path.length>4);
  for(const p of path)assert(terrainWalkable(t,p,.55,true));
  assert(path.some(p=>Math.abs(p.x-25)<3||Math.abs(p.x+24)<3));
  for(const s of fieldSpawns(FIELDS[t.id]))assert(terrainRoute(t,s,{x:0,z:-36},s.definition.variant==='boss'?1.8:.55).length>0,`reachable spawn ${s.id}`);
});
await test('legacy invalid coordinates migrate without touching inventory, quest or respawn progress',()=>{
  for(const p of [{x:58,z:-56},{x:43,z:23},{x:16,z:46},{x:24,z:verdantRiverZ(24)}]){
    const h=freshHero();h.inCity=false;h.x=p.x;h.z=p.z;h.monsterRespawnState={'verdant-plains-5:spawn:100':Date.now()+120000};h.gold=9876;
    const loaded=parseSave(JSON.stringify(h))!;assert(terrainWalkable(t,loaded));
    for(const key of ['inventory','equipment','gold','level','xp','completedQuests','monsterRespawnState','pet'] as const){
      const comparable=(value:unknown)=>Array.isArray(value)?value.map((entry:Record<string, unknown>)=>{const {isEquipped:_isEquipped,...rest}=entry;return rest;}):value;
      assert.deepEqual(comparable(loaded[key]),comparable(h[key]),key);
    }
  }
  const h=freshHero();h.inCity=false;h.currentField='ironveil-mines';h.x=58;h.z=-56;
  const loaded=parseSave(JSON.stringify(h))!;assert.equal(loaded.x,58);assert.equal(loaded.z,-56);
});
await test('render geometry follows the boundary with bounded geometry and ground sample error',()=>{
  const {group,surface}=buildFieldTerrain(t);group.updateMatrixWorld(true);
  assert(surface.geometry.getAttribute('position').count<4000);
  assert(group.children.length<40);
  const water=(group.getObjectByName('river') as T.Mesh).geometry.getAttribute('position');
  for(let i=0;i<water.count;i++)assert(insideBoundary(t,{x:water.getX(i)*.99999,z:water.getZ(i)*.99999}),`river vertex ${i} outside coastline`);
  const ray=new T.Raycaster();let error=0;
  for(const s of fieldSpawns(FIELDS[t.id])){
    ray.set(new T.Vector3(s.x,30,s.z),new T.Vector3(0,-1,0));const hit=ray.intersectObject(surface)[0];assert(hit);
    error=Math.max(error,Math.abs(hit.point.y-terrainHeight(t,s.x,s.z)));
  }
  assert(error<.0001,`terrain sample error ${error}`);
  group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
});
