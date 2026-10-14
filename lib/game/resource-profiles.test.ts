import test from 'node:test';
import assert from 'node:assert/strict';
import {APPROVED_RESOURCE_PROFILES,approvedResourceProfile,intrinsicClassResources} from './resource-profiles.ts';
import {allocateStatPoint,chooseV3Warrior,chooseV3Thief,chooseV3Berserker,chooseV3BladeMaster,chooseV3Rogue,chooseV3Assasin,createV3AdventurerHero,derivedStats,freshHero,gainXP,xpNeeded,unequipItem,parseSave,reconcileResourceMaximums,recoverActiveResources,resourceProfileFor} from './rules.ts';
import {characterResourceBreakdown,attributeEffects} from './character-screen.ts';
// Independent OWNER table/oracle. Metadata-only rows are mathematical cohorts.
const owner = {
 adventurer:[100,100],warrior:[125,90],thief:[90,95],acolyte:[100,130],
 archer:[90,105],knight:[145,85],mage:[80,140],smith:[110,110],
 berserker:[140,85],blade_master:[115,100],rogue:[85,100],assasin:[85,105],
 luminary:[90,150],sacred_fist:[120,110],ranger:[85,135],marksman:[85,100],
 vanguard:[160,90],phalanx:[135,95],summoner:[90,145],sorcerer:[75,155],
 blacksmith:[125,100],specialist:[105,130],
} as const;
const oracle=(hp:number,mp:number,L:number,v:number,i:number)=>({
 hp:Math.floor((hp*(23000+2875*(L-1))+100*v*(800+5*(L-1))+5000)/10000),
 mana:Math.floor((mp*(6000+250*L+L*L)+30000*i)/10000),
});
for(const [id,[h,m]] of Object.entries(owner))await test('approved profile '+id+' mathematical Lv15/30/60/80/100 primary budgets',()=>{
 const p=approvedResourceProfile(id)!;assert(p);assert(Object.isFrozen(p));
 for(const L of [15,30,60,80,100])for(const [vit,int] of [[0,0],[28,0],[0,28],[L-1,L-1],[2*(L-1),0]]){
  const raw=intrinsicClassResources(p,L,15+vit,int),expected=oracle(h,m,L,vit,int);
  assert.equal(Math.round(raw.unroundedHP),expected.hp);assert.equal(raw.intrinsicMana,expected.mana);
  assert.equal(raw.intMana,3*int);assert.equal(raw.vit,(15+vit)*(8+.05*(L-1)));
  assert.equal(p.baseHP,230*(h/100)-120);assert.equal(p.hpPerLevel,28.75*(h/100)-.75);
 }
});
function hero(L=15){
 const h=createV3AdventurerHero('profile-proof');
 while(h.level<L)assert.equal(gainXP(h,xpNeeded(h.level)),1);
 for(const s of Object.keys(h.equipment) as Array<keyof typeof h.equipment>)if(h.equipment[s])assert(unequipItem(h,s).ok);
 return h;
}
await test('approved roster, invalid inputs, Advanced and spelling are visibly excluded',()=>{
 assert.equal(Object.keys(APPROVED_RESOURCE_PROFILES).length,22);
 for(const id of ['assassin','wizard','warlock','mastersmith','siege','__proto__'])assert.equal(approvedResourceProfile(id),null);
 const p=approvedResourceProfile('smith')!;
 for(const [L,v,i] of [[0,15,0],[101,15,0],[15,NaN,0],[15,15,-1],[15,Infinity,0]])
  assert.throws(()=>intrinsicClassResources(p,L,v,i));
 assert.throws(()=>intrinsicClassResources({...p},15,15,0));
 assert.throws(()=>intrinsicClassResources(p,100,Number.MAX_VALUE,0));
});
await test('Adventurer anchor, current clamp and pure preview remain unchanged across legal XP/allocation',()=>{
 let h=hero();assert.deepEqual([derivedStats(h).maxHP,derivedStats(h).maxMana],[633,99]);
 h.hp=40;h.mana=12;
 for(let j=0;j<28;j++){const r=allocateStatPoint(h,j%2?'int':'vit');assert(r.ok);h=r.hero;}
 const s=derivedStats(h);assert.equal(s.maxHP,754);assert.equal(s.maxMana,141);
 assert.equal(h.hp,40);assert.equal(h.mana,12);
 const before=JSON.stringify(h);
 for(let j=0;j<20;j++){characterResourceBreakdown(h);attributeEffects(h,'vit');resourceProfileFor(h);}
 assert.equal(JSON.stringify(h),before);
 const loaded=parseSave(JSON.stringify(h))!;assert.equal(loaded.hp,40);assert.equal(loaded.mana,12);
 assert.equal(loaded.statPoints,0);assert.deepEqual(loaded.allocatedStats,h.allocatedStats);
});
await test('Warrior Lv15 resource791/89, VIT/INT once and item layers outside class target',()=>{
 const h=hero();assert(chooseV3Warrior(h));assert.deepEqual([derivedStats(h).maxHP,derivedStats(h).maxMana],[791,89]);
 const base=derivedStats(h),gear=derivedStats(h,h.allocatedStats,{vit:2,int:2,hp:100,maxMana:20,maxManaPercent:.1});
 assert.equal(gear.maxHP,908);assert.equal(gear.maxMana,126);
 assert.equal(gear.maxHP,Math.round(790.625+2*8.7+100));
 assert.equal(gear.maxMana,Math.floor((Math.floor(.9*99.75+6)+20)*1.1));
 assert(base.maxHP<gear.maxHP);
});
for(const [core,spec,choose] of [
 ['warrior','berserker',chooseV3Berserker],['warrior','blade_master',chooseV3BladeMaster],
 ['thief','rogue',chooseV3Rogue],['thief','assasin',chooseV3Assasin],
] as const)await test('legal '+core+'→'+spec+' preserves absolute resources and allocation, once-only load',()=>{
 let h=hero();assert(core==='warrior'?chooseV3Warrior(h):chooseV3Thief(h));
 while(h.level<60)gainXP(h,xpNeeded(h.level));
 for(let j=0;j<28;j++){const r=allocateStatPoint(h,j%2?'vit':'int');assert(r.ok);h=r.hero;}
 const alloc=structuredClone(h.allocatedStats),points=h.statPoints,earned=h.skillProgressionV3!.totalEarnedSP;
 // Mechanical current-resource setup at full live maxima exercises a shrinking
 // specialization maximum; level/rank/allocation still use legal consumers.
 h.hp=derivedStats(h).maxHP;h.mana=derivedStats(h).maxMana;
 const hp=h.hp,mp=h.mana;assert(choose(h));const [hPercent,mPercent]=owner[spec];const expected=oracle(hPercent,mPercent,60,14,14);
 assert.equal(derivedStats(h).maxHP,expected.hp);assert.equal(derivedStats(h).maxMana,expected.mana);
 assert.equal(h.hp,Math.min(hp,expected.hp));assert.equal(h.mana,Math.min(mp,expected.mana));
 assert.deepEqual(h.allocatedStats,alloc);assert.equal(h.statPoints,points);
 assert.equal(h.skillProgressionV3!.totalEarnedSP,earned);
 const snap=JSON.stringify(h);assert.equal(choose(h),false);assert.equal(JSON.stringify(h),snap);
 const loaded=parseSave(snap)!;assert.deepEqual(loaded.allocatedStats,alloc);assert.equal(loaded.statPoints,points);
 assert.equal(loaded.mana,h.mana);assert.equal(loaded.hp,h.hp);
});
await test('legacy identity does not acquire canonical Rogue or Ranger profile from names',()=>{
 const h=freshHero(); // mechanical legacy compatibility fixture, not canonical progression
 h.job='rogue';const legacy=resourceProfileFor(h);assert.equal(legacy.authority,'LEGACY_CLASS_COMPATIBILITY');
 assert.notEqual(legacy.baseHP,approvedResourceProfile('rogue')!.baseHP);
});
await test('same-input HP curves never cross; shared VIT does not amplify class target',()=>{
 for(const L of [15,30,60,80,100])for(const v of [15,43,15+2*(L-1)]){
  const ordered=Object.values(APPROVED_RESOURCE_PROFILES).sort((a,b)=>a.targetHPPercent-b.targetHPPercent);
  for(let j=1;j<ordered.length;j++)assert(intrinsicClassResources(ordered[j],L,v,0).unroundedHP>=intrinsicClassResources(ordered[j-1],L,v,0).unroundedHP);
 }
});
await test('resource recalculation/expiry and recovery never refill automatically or revive',()=>{
 const h=hero();assert(chooseV3Warrior(h));h.hp=400;h.mana=20;
 const larger=derivedStats(h,h.allocatedStats,{hp:100,maxMana:20});
 reconcileResourceMaximums(h,larger);assert.equal(h.hp,400);assert.equal(h.mana,20);
 h.mana=109;reconcileResourceMaximums(h);assert.equal(h.mana,89);
 recoverActiveResources(h,2);assert.equal(h.hp,403);
 h.hp=0;recoverActiveResources(h,10);assert.equal(h.hp,0);
});
