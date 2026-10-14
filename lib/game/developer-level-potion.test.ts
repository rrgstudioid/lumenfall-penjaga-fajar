import test from 'node:test';
import assert from 'node:assert/strict';
import {createItem,ITEM_CATALOG,normalizeItem} from './items.ts';
import {buyShopItem,shopStock,shopItemPrice,fieldShopStock} from './city-services.ts';
import {freshHero,createV3AdventurerHero,consumeInventoryItem,gainXP,xpNeeded,learnSkill,allocateStatPoint,parseSave} from './rules.ts';
import {equipmentDropPool,lootItemPool} from './monster-loot.ts';

const ID='developer-level-100-potion';
const buy=(hero:ReturnType<typeof freshHero>)=>{
  assert.equal(buyShopItem(hero,ID,'developer-materials',2).ok,true);
  return hero.inventory.find(i=>i.templateId===ID)!;
};
await test('developer potion is free only at Developer; existing health potion remains unchanged',()=>{
  const hero=freshHero(),potion=ITEM_CATALOG[ID];
  assert.equal(shopItemPrice(potion,'developer-materials'),0);
  assert.ok(shopStock(hero,'developer-materials').includes(potion));
  for(const service of ['consumable','equipment','seal'])assert.ok(!shopStock(hero,service).includes(potion));
  assert.ok(!fieldShopStock('verdant-plains').includes(potion));
  assert.ok(!equipmentDropPool('verdant-plains').some(x=>x.value===ID));
  assert.ok(!lootItemPool('verdant-plains','normal','potion').some(x=>x.value===ID));
  assert.equal(ITEM_CATALOG['health-potion-1'].useEffect?.type,'heal');
  assert.equal(ITEM_CATALOG['health-potion-1'].restoreValue,30);
  assert.equal(normalizeItem(createItem(ID))?.useEffect?.type,'developerLevel100');
});
await test('one use raises fresh actor to100 through existing progression, grants199SP/198points and consumes exactly one',()=>{
  const hero=createV3AdventurerHero(),item=buy(hero),ranks=structuredClone(hero.skillProgressionV3),equipment=structuredClone(hero.equipment);
  assert.equal(consumeInventoryItem(hero,item.id).ok,true);
  assert.equal(hero.level,100);assert.equal(hero.xp,0);
  assert.equal(hero.skillProgressionV3?.totalEarnedSP,199);assert.equal(hero.skillPoints,199);assert.equal(hero.statPoints,198);
  assert.deepEqual(hero.skillProgressionV3?.skillRanks,ranks?.skillRanks);
  assert.deepEqual(hero.skillProgressionV3?.grantedRanks,ranks?.grantedRanks);
  assert.equal(hero.coreJob,null);assert.equal(hero.specialization,null);
  assert.deepEqual(hero.equipment,equipment);assert.equal(hero.inventory.find(i=>i.id===item.id)?.quantity,1);
  const saved=parseSave(JSON.stringify(hero))!;assert.equal(saved.level,100);assert.equal(saved.skillPoints,199);assert.equal(saved.statPoints,198);
  assert.equal(saved.inventory.find(i=>i.id===item.id)?.useEffect?.type,'developerLevel100');
  const before=JSON.stringify(hero);assert.equal(consumeInventoryItem(hero,item.id).ok,false);assert.equal(JSON.stringify(hero),before);
});
await test('existing paid ranks, allocated points, partial XP and other items are preserved',()=>{
  let hero=createV3AdventurerHero();gainXP(hero,xpNeeded(1));assert.equal(learnSkill(hero,'v3-adventurer-power-strike'),true);
  const allocation=allocateStatPoint(hero,'str');assert.equal(allocation.ok,true);hero=allocation.hero!;
  gainXP(hero,42);const item=buy(hero),others=structuredClone(hero.inventory.filter(i=>i.templateId!==ID));
  const ranks=structuredClone(hero.skillProgressionV3?.skillRanks),allocated=structuredClone(hero.allocatedStats);
  assert.equal(consumeInventoryItem(hero,item.id).ok,true);assert.equal(hero.level,100);
  assert.equal(hero.skillPoints,198);assert.equal(hero.statPoints,197);
  assert.deepEqual(hero.allocatedStats,allocated);assert.deepEqual(hero.skillProgressionV3?.skillRanks,ranks);
  assert.deepEqual(hero.inventory.filter(i=>i.templateId!==ID),others);
});
await test('dead/locked/missing items and forged developer effect reject without progression or consumption',()=>{
  for(const kind of ['dead','locked','missing','forged']){
    const hero=freshHero(),item=createItem(ID);hero.inventory.push(item);
    if(kind==='dead')hero.hp=0;
    if(kind==='locked')item.isLocked=true;
    if(kind==='forged')item.templateId='health-potion-1';
    const before=JSON.stringify(hero);
    assert.equal(consumeInventoryItem(hero,kind==='missing'?'missing':item.id).ok,false);
    assert.equal(JSON.stringify(hero),before);
  }
});
await test('legacy character still follows its own existing progression without a V3 conversion',()=>{
  const hero=freshHero(),item=buy(hero),architecture=hero.skillArchitectureVersion,job=hero.job;
  assert.equal(consumeInventoryItem(hero,item.id).ok,true);
  assert.equal(hero.level,100);assert.equal(hero.skillArchitectureVersion,architecture);assert.equal(hero.job,job);
});
