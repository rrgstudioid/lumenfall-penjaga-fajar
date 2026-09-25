import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {FIELDS,CITIES,FIELD_NPCS,startingFieldIds,fieldContent,travel,unlockReason,getQuestRegistry,acceptRegionQuest,regionQuestProgress} from './regions.ts';
import {EAST_GATE_TERRAIN as t,VERDANT_TERRAIN,terrainHeight,terrainWalkable,terrainSafe,terrainWater,terrainRiverZ,terrainPonds,terrainRoute,moveOnTerrain,insideBoundary} from './field-terrain.ts';
import {fieldSpawns,monsterRespawnKey,restoreRespawnDeadline} from './field-layout.ts';
import {buildFieldTerrain} from './field-terrain-renderer.ts';
import {MONSTER_LOOT_PROFILES,lootItemPool,monsterDropChance} from './monster-loot.ts';
import {freshHero,parseSave} from './rules.ts';
import {fieldShopStock,buyFieldShopItem,sellInventoryItem} from './city-services.ts';
import {BGM_TRACKS} from './bgm.ts';
const east=FIELDS[t.id],old=FIELDS['verdant-plains'];

await test('East Gate remains independent and connected alongside imported Sands',()=>{
  assert.ok(Object.keys(FIELDS).length >= 8);
  assert.ok(FIELDS['sands-location']);
  assert.deepEqual(CITIES.arunika.connectedFields,['verdant-plains','ironveil-mines','whispering-wilds',t.id,'sands-location']);
  assert.equal(east.chapter,1);assert.equal(east.minLevel,1);assert.equal(east.maxLevel,8);
  assert.equal(east.regionType,'field');assert.equal(east.cityDirection,'east');
  assert.deepEqual(east.subAreas,['Gerbang Timur','Dusun Purnama','Lembah Cahaya']);
  assert.equal(east.nextMap,'ironveil-mines');assert.notEqual(east,old);
  const h=freshHero();h.inCity=true;assert(travel(h,t.id).ok);
  assert.equal(h.currentField,t.id);assert.equal(h.currentCity,'arunika');assert(!h.inCity);
  assert.equal(h.x,t.entry.x);assert.equal(h.z,t.entry.z);
  assert.match(unlockReason(h,'ironveil-mines'),/8/);assert(!travel(h,'ironveil-mines').ok);
  h.level=8;assert(travel(h,'ironveil-mines').ok);
});
await test('Padang expansion is isolated and East Gate retains its footprint',()=>{
  assert.equal(VERDANT_TERRAIN.horizontalScale,2);
  assert.equal(t.horizontalScale,undefined);
  assert.ok(Math.max(...VERDANT_TERRAIN.boundary.flatMap(p=>[Math.abs(p.x),Math.abs(p.z)]))>100);
  assert.ok(Math.max(...t.boundary.flatMap(p=>[Math.abs(p.x),Math.abs(p.z)]))<100);
  assert.notDeepEqual(fieldSpawns(old).map(s=>[s.x,s.z]),fieldSpawns(old).map(s=>[s.x,s.z]).map(([x,z])=>[x/2,z/2]));
  const {group}=buildFieldTerrain(VERDANT_TERRAIN);
  assert.ok(group.children.length<50);
  dispose(group);
});
await test('monster and material definitions are references, not copies; every weighted loot pool matches',()=>{
  assert.equal(east.normalMonsters,old.normalMonsters);assert.equal(east.eliteMonsters,old.eliteMonsters);assert.equal(east.fieldBoss,old.fieldBoss);
  assert.equal(east.materialTable,old.materialTable);assert.equal(east.dropTable,old.dropTable);assert.equal(fieldContent(t.id),old);
  for(const v of ['normal','elite','boss'] as const)for(const f of MONSTER_LOOT_PROFILES[v])assert.deepEqual(lootItemPool(t.id,v,f.value),lootItemPool(old.id,v,f.value));
  assert.deepEqual([...east.normalMonsters,...east.eliteMonsters,east.fieldBoss].map(m=>[m.maxHP,m.attack,m.defense,m.magicDefense,m.exp,monsterDropChance(m),m.respawnTime]),[[46,10,5,4,10,.35,25],[78,15,7,6,52,.35,25],[110,19,10,8,112,.35,25],[142,23,12,10,185,.35,25],[395,38,16,14,452,.7,60],[1900,60,23,20,1580,.95,120]]);
});
await test('36 normal, 5 elite and 1 boss spawns are unique, safe and connected',()=>{
  const spawns=fieldSpawns(east);
  assert.equal(spawns.length,42);assert.equal(new Set(spawns.map(s=>`${s.x},${s.z}`)).size,42);
  assert.equal(spawns.filter(s=>s.definition.variant==='normal').length,36);
  assert.equal(spawns.filter(s=>s.definition.variant==='elite').length,5);
  assert.deepEqual(spawns.filter(s=>s.definition.variant==='boss').map(s=>[s.x,s.z]),[[t.arena.x,t.arena.z]]);
  for(const m of old.normalMonsters)assert.equal(spawns.filter(s=>s.definition===m).length,9);
  for(const s of spawns){
    assert(terrainWalkable(t,s,s.definition.variant==='boss'?1.8:.6,true),`spawn ${s.id}`);
    assert(!terrainSafe(t,s,1));assert(!terrainWater(t,s));
    assert(terrainRoute(t,s,t.arena,s.definition.variant==='boss'?1.8:.55).length,`route ${s.id}`);
  }
  assert.notDeepEqual(spawns.map(s=>[s.x,s.z]),fieldSpawns(old).map(s=>[s.x,s.z]));
});
await test('organic boundary, water, props and bridges share movement constraints',()=>{
  for(const p of [t.entry,t.camp,t.cityGate,t.exit])assert(terrainWalkable(t,p));
  assert(terrainHeight(t,t.arena.x,t.arena.z)>terrainHeight(t,t.entry.x,t.entry.z)+5);
  for(let z=-39;z<-21;z+=2)for(let x=3;x<21;x+=2)assert(terrainWalkable(t,{x,z},1.8,true));
  for(const p of t.props)assert(!terrainWalkable(t,p),p.kind);
  for(const p of t.props.filter(p=>['hut','granary','tent','ruins','watchtower'].includes(p.kind)))assert(insideBoundary(t,p,p.radius),`${p.kind} footprint outside cliff`);
  for(const b of t.bridges.filter(b=>b.kind!=='dock')){
    const end=moveOnTerrain(t,{x:b.x,z:b.z+10},0,-20);
    assert(Math.abs(end.z-(b.z-10))<.01);assert(!terrainWater(t,end));
  }
  const z=terrainRiverZ(t,10),blocked=moveOnTerrain(t,{x:10,z:z+8},0,-30);
  assert(blocked.z>z+2.7);assert(terrainWalkable(t,blocked));
  assert(terrainWalkable(t,moveOnTerrain(t,t.entry,-300,0)));
  const dock=t.bridges.find(b=>b.kind==='dock')!;
  assert.equal(terrainHeight(t,dock.x,dock.z),dock.deckHeight);
  assert(!terrainWater(t,dock));assert(terrainWalkable(t,dock));
  for(const p of terrainPonds(t))assert(terrainHeight(t,p.x,p.z,false)<p.surfaceHeight-.3,'plazas must not bury the water');
});
await test('terrain renderer matches spawn heights, clips water and stays inside geometry budgets',()=>{
  const {group,surface}=buildFieldTerrain(t);group.updateMatrixWorld(true);
  assert(surface.geometry.attributes.position.count<4000);assert(group.children.length<50);
  const river=(group.getObjectByName('river') as T.Mesh).geometry.attributes.position;
  for(let i=0;i<river.count;i++)assert(insideBoundary(t,{x:river.getX(i)*.99999,z:river.getZ(i)*.99999}));
  const ray=new T.Raycaster();
  for(const s of fieldSpawns(east)){
    ray.set(new T.Vector3(s.x,40,s.z),new T.Vector3(0,-1,0));
    const hit=ray.intersectObject(surface)[0];assert(hit);assert(Math.abs(hit.point.y-terrainHeight(t,s.x,s.z))<.0001);
  }
  assert(group.children.some(o=>o instanceof T.InstancedMesh));dispose(group);
});
await test('shared species have independent persistent respawn deadlines in each region',()=>{
  for(const s of fieldSpawns(east)){
    const oldKey=monsterRespawnKey(s.definition.id,s.id,old.id),newKey=monsterRespawnKey(s.definition.id,s.id,t.id);
    assert.notEqual(oldKey,newKey);assert.equal(oldKey,monsterRespawnKey(s.definition.id,s.id));
    const state={[s.definition.id]:1000,[oldKey]:2000,[newKey]:3000};
    assert.equal(restoreRespawnDeadline(state,s.definition.id,s.id,old.id),2000);
    assert.equal(restoreRespawnDeadline(state,s.definition.id,s.id,t.id),3000);
    delete state[newKey];assert.equal(restoreRespawnDeadline(state,s.definition.id,s.id,t.id),0);
  }
});
await test('old saves gain starting field safely; East invalid coordinates relocate without losing progress',()=>{
  const starting = startingFieldIds();
  assert(starting.includes('verdant-plains'));
  assert(starting.includes(t.id));
  assert(starting.includes('sands-location'));
  const h=freshHero();h.unlockedFields=['verdant-plains','ironveil-mines'];h.gold=5432;
  h.monsterRespawnState={'verdant-plains-5:spawn:100':123456};
  let loaded=parseSave(JSON.stringify(h))!;
  assert(loaded.unlockedFields.includes(t.id));assert(loaded.unlockedFields.includes('ironveil-mines'));
  for(const p of [{x:100,z:100},{x:3,z:18},{x:-27,z:27}]){
    h.currentField=t.id;h.inCity=false;Object.assign(h,p);loaded=parseSave(JSON.stringify(h))!;
    assert(terrainWalkable(t,loaded));assert.equal(loaded.currentField,t.id);
    for(const k of ['gold','inventory','equipment','completedQuests','activeQuests','monsterRespawnState','level','xp','primaryHotbar'] as const){
      const comparable=(value:unknown)=>Array.isArray(value)?value.map((entry:unknown)=>entry==null?entry:(()=>{const {isEquipped:_isEquipped,...rest}=entry as Record<string, unknown>;return rest;})()):value;
      assert.deepEqual(comparable(loaded[k]),comparable(h[k]),k);
    }
  }
});
await test('East quest identities and kill counters cannot complete Padang quests',()=>{
  const registry=getQuestRegistry();assert.equal(new Set(registry.map(q=>q.id)).size,registry.length);
  const quests=registry.filter(q=>q.targetMapId===t.id);assert.equal(quests.length,3);
  for(const q of quests){assert.equal(q.giverNpcId,FIELD_NPCS[t.id].id);assert.equal(q.giverMapId,t.id);assert(!old.questList.includes(q.id));}
  const h=freshHero();assert(!acceptRegionQuest(h,east.questList[0]));
  travel(h,old.id);assert(acceptRegionQuest(h,old.questList[0]));assert(!acceptRegionQuest(h,east.questList[0]));
  travel(h,t.id);assert(acceptRegionQuest(h,east.questList[0]));h.fieldProgress[t.id]=2;
  assert.equal(regionQuestProgress(h,east.questList[0]).current,2);
  assert.equal(regionQuestProgress(h,old.questList[0]).current,0);
});
await test('camp reuses stock, Buy, Sell and audio fallback without duplicating inventory',()=>{
  assert.deepEqual(FIELD_NPCS[t.id].services,['buy','sell','teleport','quest']);
  assert.equal(FIELD_NPCS[t.id].name,'Penjaga Pos Timur');assert.equal(FIELD_NPCS[t.id].x,t.camp.x);
  assert.deepEqual(fieldShopStock(t.id),fieldShopStock(old.id));
  const h=freshHero();h.gold=3000;travel(h,t.id);
  assert(buyFieldShopItem(h,t.id,'health-potion-1').ok);assert(h.gold<3000);
  const item=h.inventory.find(i=>i.templateId==='health-potion-1')!;assert(sellInventoryItem(h,item.id,1).ok);
  assert.equal(BGM_TRACKS[east.musicId].src,BGM_TRACKS[old.musicId].src);
});
function dispose(group:T.Group){group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
