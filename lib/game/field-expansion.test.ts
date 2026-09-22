import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FIELDS, fieldContent } from './regions.ts';
import { FIELD_TERRAINS, terrainWalkable } from './field-terrain.ts';
import { FIELD_LAYOUT, regionHalfExtent, fieldSpawns, isFieldWater, isFieldSafe, monsterRespawnKey, restoreRespawnDeadline } from './field-layout.ts';
import { MONSTER_MODELS, createMonsterBody } from './monster-models.ts';
import { MONSTER_LOOT_PROFILES, EQUIPMENT_DROP_RARITIES, RUNE_DROP_RARITIES, BOSS_RUNE_DROPS, monsterDropChance, lootItemPool, weightedPick, rollMonsterItem } from './monster-loot.ts';
import { ITEM_CATALOG } from './items.ts';
import { freshHero, grantMonsterLoot, parseSave, collectPendingLoot } from './rules.ts';

await test('all registered fields retain one boss and have 42 safe, unique, stable spawns',()=>{
  assert.ok(Math.abs((regionHalfExtent(false)/45)**2-2)<1e-12);
  assert.equal(regionHalfExtent(true),67.5);
  assert.equal(FIELD_LAYOUT.normalCount+FIELD_LAYOUT.eliteCount+FIELD_LAYOUT.bossCount,14*3);
  for(const field of Object.values(FIELDS)){
    const spawns=fieldSpawns(field);
    assert.deepEqual(spawns,fieldSpawns(field));
    assert.equal(spawns.length,42);
    assert.equal(new Set(spawns.map(s=>s.id)).size,42);
    assert.equal(new Set(spawns.map(s=>`${s.x},${s.z}`)).size,42);
    assert.equal(spawns.filter(s=>s.definition.variant==='normal').length,36);
    assert.equal(spawns.filter(s=>s.definition.variant==='elite').length,5);
    assert.equal(spawns.filter(s=>s.definition.variant==='boss').length,1);
    const terrain=FIELD_TERRAINS[field.id];
    const terrainExtent=terrain?Math.max(...terrain.boundary.flatMap(p=>[Math.abs(p.x),Math.abs(p.z)]))+1:regionHalfExtent(false);
    for(const s of spawns){assert.ok(Math.abs(s.x)<terrainExtent&&Math.abs(s.z)<terrainExtent);assert.ok(!isFieldSafe(field.id,s.x,s.z));if(terrain)assert.ok(terrainWalkable(terrain,s,.55,true));else assert.ok(!isFieldWater(s.x,s.z));}
    for(const species of field.normalMonsters)assert.equal(spawns.filter(s=>s.definition.id===species.id).length,9);
    if(!FIELD_TERRAINS[field.id]&&field.id!=='sands-location')assert.ok(spawns.some(s=>s.x>45)&&spawns.some(s=>s.x<-45)&&spawns.some(s=>s.z>45)&&spawns.some(s=>s.z<-45));
  }
});

await test('36 named species have distinct valid low-poly geometry, one body draw call, and readable label anchors',()=>{
  const hashes=new Set<string>();
  for(const field of Object.values(FIELDS))for(const monster of [...field.normalMonsters,...field.eliteMonsters,field.fieldBoss]){
    assert.ok(MONSTER_MODELS[monster.id],monster.name);
    const mesh=createMonsterBody(monster),position=mesh.geometry.getAttribute('position');
    assert.equal(mesh.children.length,0);
    assert.ok(position.count<5000,monster.name);
    assert.equal(position.count,mesh.geometry.getAttribute('color').count);
    assert.ok(Array.from(position.array).every(Number.isFinite));
    assert.ok(mesh.userData.labelHeight>mesh.geometry.boundingBox!.max.y);
    hashes.add(createHash('sha256').update(Buffer.from(position.array.buffer)).digest('hex'));
    mesh.geometry.dispose();mesh.material.dispose();
  }
  assert.equal(hashes.size,36);
});

await test('respawn uses independent instance deadlines and migrates old species timers without hiding every copy',()=>{
  const field=FIELDS['verdant-plains'],id=field.normalMonsters[0].id,deadline=Date.now()+25000;
  const state={[id]:deadline,[monsterRespawnKey(id,4)]:deadline+9000};
  assert.equal(restoreRespawnDeadline(state,id,0),deadline);
  assert.equal(restoreRespawnDeadline(state,id,4),deadline+9000);
  assert.equal(restoreRespawnDeadline(state,id,8),0);
  const hero=freshHero();hero.inCity=false;hero.x=58;hero.z=-56;hero.monsterRespawnState=state;
  const loaded=parseSave(JSON.stringify(hero))!;
  assert.ok(terrainWalkable(FIELD_TERRAINS[loaded.currentField],loaded));assert.deepEqual(loaded.monsterRespawnState,state);
  assert.equal(loaded.level,hero.level);assert.equal(loaded.gold,hero.gold);assert.deepEqual(loaded.equipment,hero.equipment);
});

await test('every loot family, item, and rarity has a nonempty independent weighted interval in every field',()=>{
  for(const field of Object.values(FIELDS))for(const variant of ['normal','elite','boss'] as const){
    const profile=MONSTER_LOOT_PROFILES[variant];
    assert.equal(profile.reduce((n,p)=>n+p.weight,0),100);
    assert.equal(EQUIPMENT_DROP_RARITIES[variant].reduce((n,p)=>n+p.weight,0),100);
    assert.equal(RUNE_DROP_RARITIES[variant].reduce((n,p)=>n+p.weight,0),100);
    let offset=0;
    for(const family of profile){
      assert.equal(weightedPick(profile,()=> (offset+family.weight/2)/100),family.value);offset+=family.weight;
      const pool=lootItemPool(field.id,variant,family.value),total=pool.reduce((n,p)=>n+p.weight,0);
      assert.ok(pool.length>0);let itemOffset=0;
      for(const entry of pool){assert.ok(ITEM_CATALOG[entry.value],entry.value);assert.equal(weightedPick(pool,()=>(itemOffset+entry.weight/2)/total),entry.value);itemOffset+=entry.weight;}
      if(family.value==='equipment')for(const item of pool){assert.ok(ITEM_CATALOG[item.value].levelRequirement<=field.maxLevel);if(item.value.startsWith('field-'))assert.ok(item.value.startsWith(`field-${fieldContent(field.id).id}-`));}
    }
    assert.equal(lootItemPool(field.id,variant,'rune').length,10);
  }
});

await test('normal, elite, and boss chance checks actually run and drop bonus is capped',()=>{
  const field=FIELDS['verdant-plains'];
  for(const monster of [field.normalMonsters[0],field.eliteMonsters[0],field.fieldBoss]){
    const hero=freshHero(),before=JSON.stringify(hero);
    assert.equal(grantMonsterLoot(hero,monster,()=>.99999),null);assert.equal(JSON.stringify(hero),before);
    const drop=grantMonsterLoot(hero,monster,()=>0)!;
    assert.ok(drop);assert.equal(drop.source.sourceId,monster.id);assert.ok(drop.source.label.includes(monster.name));
  }
  assert.equal(monsterDropChance(field.normalMonsters[0]),.35);
  assert.equal(monsterDropChance(field.eliteMonsters[0]),.7);
  assert.equal(monsterDropChance(field.fieldBoss),.95);
  assert.equal(monsterDropChance(field.normalMonsters[0],100),.7);
  assert.equal(monsterDropChance(field.fieldBoss,999),1);
});

await test('all ten rune themes, six unique boss runes, optimizer tiers and gear branches are reachable',()=>{
  for(const field of Object.values(FIELDS))for(const variant of ['normal','elite','boss'] as const){
    const profile=MONSTER_LOOT_PROFILES[variant];let offset=0;
    for(const family of profile){
      const categoryRoll=(offset+family.weight/2)/100;offset+=family.weight;
      const pool=lootItemPool(field.id,variant,family.value),total=pool.reduce((n,p)=>n+p.weight,0);let itemOffset=0;
      for(const p of pool){
        const itemRoll=(itemOffset+p.weight/2)/total;itemOffset+=p.weight;let draws=0;
        const item=rollMonsterItem(field.id,variant,null,field.fieldBoss.id,()=>draws++===0?itemRoll:.5,categoryRoll);
        assert.equal(item.templateId,p.value);
        if(family.value==='uniqueRune')assert.equal(item.templateId,BOSS_RUNE_DROPS[fieldContent(field.id).id]);
        if(family.value==='equipment'&&variant!=='boss')assert.equal(item.sockets.length,0);
        if(family.value==='rune')assert.equal(item.runeRarity,variant==='boss'?'epic':variant==='elite'?'refined':'cracked');
        if(family.value==='optimizer'&&variant==='normal')assert.equal(item.optimizerTier,'basic');
      }
    }
  }
});

await test('new monster loot is preserved in overflow and survives save/load without duplication',()=>{
  const hero=freshHero();hero.inventoryCapacity=hero.inventory.length;
  // Force boss rune branch and a unique, nonstacking item.
  const draws=[0,.90,0,.5];const drop=grantMonsterLoot(hero,FIELDS[hero.currentField].fieldBoss,()=>draws.shift()??.5)!;
  assert.ok(drop);assert.equal(hero.pendingLoot.length,1);
  const loaded=parseSave(JSON.stringify(hero))!;
  assert.equal(loaded.pendingLoot[0].id,drop.id);loaded.inventoryCapacity=100;
  collectPendingLoot(loaded);collectPendingLoot(loaded);
  assert.equal(loaded.pendingLoot.length,0);assert.equal(loaded.inventory.filter(item=>item.id===drop.id).length,1);
});
