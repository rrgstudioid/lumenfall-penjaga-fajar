import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createV3AdventurerHero, derivedStats, gainXP, xpNeeded, allocateStatPoint,
  equipItem, parseSave, characterStatBreakdown, type Hero} from './rules.ts';
import {createItem} from './items.ts';
import {attributeEffects} from './character-screen.ts';
import {previewEquipmentChange} from './character-view.ts';
import {resolveCombatHit, resolveCombatDamage} from './combat-resolver.ts';

// Primary authority: MASTER 795758f3 + OWNER 45b290a7, recovered in BRANCH_EVIDENCE.
// These tests do NOT approve new HP/Mana/job profiles, BaseMagic, or DEX secondary baselines.
const near=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

await test('approved neutral Accuracy90 and MDEF20 at Lv1; unrelated resource/secondary baselines retained',()=>{
  const h=createV3AdventurerHero('Stat authority');
  const s=derivedStats(h, h.allocatedStats, {}, false);
  assert.equal(s.accuracy,90);
  assert.equal(s.magicDefense,20); // 8 + .60*15 + .20*15
  assert.equal(s.physicalDefense,15.5);
  assert.equal(s.maxHP,230);assert.equal(s.maxMana,62);
  // Subsequent direct OWNER ACC: BonusDEX .10/.10/.15, neutral 0/2/100.
  assert.equal(s.evasion,0);assert.equal(s.criticalRate,2);assert.equal(s.attackSpeed,100);
});

// Profile identities are source-level fixtures, NOT proof of legal job selection/unlocks.
const profiles:Array<{label:string; core:Hero['coreJob']; spec:Hero['specialization']}>= [
  {label:'Adventurer',core:null,spec:null},
  {label:'Warrior',core:'warrior',spec:null},
  {label:'Thief V3',core:'thief',spec:null},
  {label:'Berserker',core:'warrior',spec:'berserker'},
  {label:'Blade Master',core:'warrior',spec:'blade_master'},
  {label:'Rogue V3',core:'thief',spec:'rogue'},
  {label:'Assasin V3',core:'thief',spec:'assasin'},
];
for(const profile of profiles)await test(`${profile.label}: shared primary authority at Lv1/15/30/60/100 without changing class kits`,()=>{
  const h=createV3AdventurerHero(profile.label);h.coreJob=profile.core;h.specialization=profile.spec;
  for(const level of [1,15,30,60,100]){
    h.level=level;
    for(const allocation of [{str:0,vit:0,dex:0,int:0},{str:0,vit:3,dex:4,int:5}]){
      // Controlled resolver inputs only; unspent-point validation belongs to actual transactions below.
      const s=derivedStats(h,allocation,{},false);
      assert.equal(s.accuracy,90+allocation.dex);
      near(s.magicDefense,8+1.5*(level-1)+.60*(15+allocation.vit)+.20*(15+allocation.int));
      near(s.physicalDefense,8+1.5*(level-1)+.50*(15+allocation.vit));
    }
  }
});

await test('effective DEX sources counted once above base15; negative source clamps BonusDEX, not flat Accuracy',()=>{
  const h=createV3AdventurerHero('Sources');
  const s=derivedStats(h,{str:0,vit:3,dex:4,int:5},{dex:6,vit:2,int:3,accuracy:7,magicDefense:11},false);
  assert.equal(s.accuracy,107); // 90 + (15+4+6-15) + 7
  assert.equal(s.magicDefense,35.6); // 8 + .6*20 + .2*23 + 11
  assert.equal(derivedStats(h,h.allocatedStats,{dex:-20,accuracy:-3},false).accuracy,87);
});

await test('legal XP/allocation transactions preserve points and use corrected VIT/INT/DEX contributions',()=>{
  let h=createV3AdventurerHero('Legal stats');
  while(h.level<4)assert.equal(gainXP(h,xpNeeded(h.level)),1);
  const before=derivedStats(h);const ledger=structuredClone(h.skillProgressionV3);
  for(const stat of ['vit','int','dex'] as const){
    const result=allocateStatPoint(h,stat);assert(result.ok);h=result.hero;
  }
  const after=derivedStats(h);
  assert.equal(h.statPoints,3);near(after.magicDefense-before.magicDefense,.8);
  assert.equal(after.accuracy-before.accuracy,1);
  assert.deepEqual(h.skillProgressionV3,ledger);
  const saved=JSON.stringify(h),loaded=parseSave(saved,h.slotId);
  assert(loaded);assert.deepEqual(loaded.allocatedStats,h.allocatedStats);
  assert.equal(derivedStats(loaded).accuracy,after.accuracy);
  assert.equal(derivedStats(loaded).magicDefense,after.magicDefense);
});

await test('Character tooltip and breakdown agree; owned-item preview/equip use the same source and stay pure',()=>{
  const h=createV3AdventurerHero('Presentation');
  while(h.level<10)gainXP(h,xpNeeded(h.level));
  const ring=createItem('arunika-ring1');
  // Mechanical item options; not a new catalog/budget decision.
  ring.baseStats={};ring.bonusStats={dex:2,vit:3,int:4,accuracy:5,magicDefense:7};
  h.inventory.push(ring);
  const before=JSON.stringify(h),base=derivedStats(h);
  assert.equal(attributeEffects(h,'vit').find(x=>x.id==='magicDefense')?.delta,.6);
  assert.equal(attributeEffects(h,'int').find(x=>x.id==='magicDefense')?.delta,.2);
  assert.equal(attributeEffects(h,'dex').find(x=>x.id==='accuracy')?.delta,1);
  const preview=previewEquipmentChange(h,ring,'ring1');assert(preview.validation.ok);
  assert.equal(JSON.stringify(h),before);
  assert.equal(preview.after.accuracy-base.accuracy,7);
  near(preview.after.magicDefense-base.magicDefense,9.6);
  assert(equipItem(h,ring.id,'ring1').ok);
  const actual=derivedStats(h);assert.equal(actual.accuracy,preview.after.accuracy);
  assert.equal(actual.magicDefense,preview.after.magicDefense);
  const breakdown=characterStatBreakdown(h);
  for(const field of ['accuracy','magicDefense'] as const)
    near(breakdown.base[field]+breakdown.columns.reduce((sum,c)=>sum+c.stats[field],0),actual[field]);
});

await test('physical hit resolver consumes corrected Accuracy; magic still bypasses physical avoidance',()=>{
  const h=createV3AdventurerHero('Hit');const stats=derivedStats(h);
  let draws=0;const rng=()=>{draws++;return .905;};
  const physical=resolveCombatHit({damageType:'physical',accuracy:stats.accuracy},10,rng);
  assert.equal(physical.hitChance,.9);assert.equal(physical.result,'EVADED');assert.equal(draws,1);
  const magic=resolveCombatHit({damageType:'magic',accuracy:stats.accuracy},99,rng);
  assert.equal(magic.result,'HIT');assert.equal(draws,1);
});

await test('shared magic mitigation receives corrected MDEF; physical mitigation and fractional policy unchanged',()=>{
  const h=createV3AdventurerHero('Defense');const s=derivedStats(h);
  near(resolveCombatDamage({rawDamage:100,damageType:'magic',attackerLevel:1,physicalDefense:s.physicalDefense,magicDefense:s.magicDefense}),100*510/530);
  near(resolveCombatDamage({rawDamage:100,damageType:'physical',attackerLevel:1,physicalDefense:s.physicalDefense,magicDefense:s.magicDefense}),100*510/525.5);
});
