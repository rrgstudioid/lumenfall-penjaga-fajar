import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createV3AdventurerHero,createV2TestHero,derivedStats,combatModifiersFor,characterStatBreakdown,allocateStatPoint,gainXP,xpNeeded,parseSave,equipItem,unequipItem,resolveMaxMana,skillHealingPreview} from './rules.ts';
import {ADVENTURER_V3_RUNTIME_SKILLS} from './adventurer-v3.ts';
import {resolveCastTiming} from './cast-timing.ts';
import {createItem} from './items.ts';
import {previewEquipmentChange} from './character-view.ts';
import {attributeEffects,characterStatNote,ADVANCED_STATS} from './character-screen.ts';
import {statDisplayValue} from './stat-presentation.ts';
import {reconcileThiefBuffs} from './thief-runtime.ts';
import {getCombatPower} from './combat-power.ts';
const freeze=<T>(value:T):T=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

await test('stat reads, breakdown, primary projection and legacy CP leave frozen V3 sources untouched',()=>{
 const h=createV3AdventurerHero('Read purity');
 h.activeBuffs['v3-thief-evasion']=10;
 h.temporaryModifiers=[{remaining:8,modifier:{id:'v3-thief-obsolete:evasion',stats:{flat:{evasion:20}}}}];
 const expected=structuredClone(h);reconcileThiefBuffs(expected);
 const before=structuredClone(h),stats=derivedStats(expected),mods=combatModifiersFor(expected);
 freeze(h);
 for(let i=0;i<3;i++){
  assert.deepEqual(derivedStats(h),stats);assert.deepEqual(combatModifiersFor(h),mods);
  assert.deepEqual(characterStatBreakdown(h).final,stats);attributeEffects(h,'int');getCombatPower(h);
 }
 assert.deepEqual(h,before);
});
await test('equipment preview deeply detaches sources and is numerically identical to actual equip',()=>{
 const h=createV3AdventurerHero('Preview');while(h.level<10)gainXP(h,xpNeeded(h.level));
 const ring=createItem('arunika-ring1');h.inventory.push(ring);
 const before=structuredClone(h);freeze(h);
 const preview=previewEquipmentChange(h,ring,'ring1');assert(preview.validation.ok);
 const actual=structuredClone(h);assert(equipItem(actual,ring.id,'ring1').ok);
 assert.deepEqual(preview.after,derivedStats(actual));assert.deepEqual(h,before);
 preview.hero.inventory[0].baseStats.attack=999;preview.hero.activeBuffs.damageReduction=999;
 assert.deepEqual(h,before);
});
await test('ranked passive is included in unbuffed breakdown exactly once, same as final consumer',()=>{
 // Mechanical V2 profile, not a legal V3 class progression claim.
 const h=createV2TestHero();h.coreJob='warrior';h.level=20;h.passiveLevels['v2-warrior-conditioning']=3;
 const base=derivedStats(h,h.allocatedStats,{},false),final=derivedStats(h,h.allocatedStats,{});
 assert.deepEqual(base,final);
 const without=structuredClone(h);without.passiveLevels={};
 assert(base.maxHP>derivedStats(without,without.allocatedStats,{},false).maxHP);
 assert.equal(characterStatBreakdown(h).columns.find(c=>c.label==='Buff')?.stats.maxHP??0,0);
});
await test('Max Mana fraction display matches existing resolver; other rate encodings stay unchanged',()=>{
 const h=createV3AdventurerHero('Mana');
 assert.equal(statDisplayValue('maxManaPercent',.1),'+10%');
 assert.equal(statDisplayValue('maxManaPercent',-.125),'-12.5%');
 assert.equal(statDisplayValue('critRate',10),'+10%');
 assert.equal(statDisplayValue('attackPercent',10),'+10%');
 assert.equal(statDisplayValue('accuracy',10),'+10');
 const a=resolveMaxMana(h,h.allocatedStats,{}),b=resolveMaxMana(h,h.allocatedStats,{maxManaPercent:.1});
 assert.equal(b,Math.round(a*1.1));
});
for(const invalid of [NaN,Infinity,-1,.5,999])await test('V3 allocator rejects malformed remaining budget '+invalid,()=>{
 const h=createV3AdventurerHero('Invalid');gainXP(h,xpNeeded(h.level));h.statPoints=invalid;
 const before=structuredClone(h),r=allocateStatPoint(h,'str');assert.equal(r.ok,false);assert.equal(r.hero,h);assert.deepEqual(h,before);
});
await test('V3 allocator rejects malformed allocations/level/missing fields without cleanup or resource writes',()=>{
 const base=createV3AdventurerHero('Bad source');gainXP(base,xpNeeded(base.level));
 for(const mutate of [(h:typeof base)=>{h.allocatedStats.int=NaN;},(h:typeof base)=>{h.allocatedStats.vit=-1;},(h:typeof base)=>{h.level=2.5;},(h:typeof base)=>{delete (h.allocatedStats as Partial<typeof h.allocatedStats>).dex;},(h:typeof base)=>{h.allocatedStats.str=2;}]){
  const h=structuredClone(base);mutate(h);const before=structuredClone(h);assert.equal(allocateStatPoint(h,'int').ok,false);assert.deepEqual(h,before);
 }
});
await test('legal XP/allocation/equip/unequip/load preserve budgets and existing resource policy',()=>{
 let h=createV3AdventurerHero('Legal');while(h.level<4)gainXP(h,xpNeeded(h.level));
 h.hp=50;h.mana=12;
 for(const stat of ['str','vit','dex','int','vit','int'] as const){const r=allocateStatPoint(h,stat);assert(r.ok);h=r.hero;}
 assert.equal(h.statPoints,0);assert.equal(h.hp,50);assert.equal(h.mana,12);
 assert.equal(allocateStatPoint(h,'str').ok,false);
 const saved=parseSave(JSON.stringify(h),h.slotId);assert(saved);assert.deepEqual(saved.allocatedStats,h.allocatedStats);
 assert.equal(derivedStats(h).accuracy,91);
 const ring=createItem('arunika-ring1');h.inventory.push(ring);assert(equipItem(h,ring.id,'ring1').ok);unequipItem(h,'ring1');
 assert.equal(h.hp,50);assert.equal(h.mana,12);
});
await test('legacy mechanical allocation contract remains available without imposing V3 budget',()=>{
 const h=createV2TestHero();h.statPoints=1;
 assert(allocateStatPoint(h,'str').ok);
});
await test('UI availability distinguishes computed recovery/casting and raw rating from consumer effect',()=>{
 assert.match(characterStatNote('hpRecovery')!,/HP pulih/);
 // Latest OWNER closure explicitly approves CastStat/4; retain gated timing metadata.
 assert.match(characterStatNote('castStat')!,/CastStat ÷ 4/);
 assert.match(characterStatNote('criticalRate')!,/80%/);
 assert.match(characterStatNote('blockRate')!,/50%/);
 assert.match(characterStatNote('healingPower')!,/Minor Heal/);
 assert(ADVANCED_STATS.some(s=>s.id==='castStat'));
});
await test('mechanical flat/relative magic source uses approved normal-group sum and fractional result, without writeback',()=>{
 const h=createV3AdventurerHero('Modifier fixture'),base=derivedStats(h).magicAttack;
 h.temporaryModifiers=[
  {remaining:5,modifier:{id:'a-source',stats:{flat:{magicAttack:3},percent:{magicAttack:10}}}},
  {remaining:5,modifier:{id:'b-source',stats:{percent:{magicAttack:20}}}},
 ];
 const before=structuredClone(h);freeze(h);
 assert.equal(derivedStats(h).magicAttack,(base+3)*1.3);
 assert.equal(characterStatBreakdown(h).final.magicAttack,(base+3)*1.3);
 assert.deepEqual(h,before);
});
await test('INT technical source affects magic/healing; Minor Heal ignores HealingPower; timing remains explicit without supplied CastStat',()=>{
 const h=createV3AdventurerHero('Heal fixture');gainXP(h,xpNeeded(h.level));
 const result=allocateStatPoint(h,'int');assert(result.ok);const base=derivedStats(h),next=derivedStats(result.hero);
 assert.equal(next.magicAttack-base.magicAttack,2);assert.equal(next.healingPower-base.healingPower,.25);
 const heal=ADVENTURER_V3_RUNTIME_SKILLS.find(s=>s.id==='v3-adventurer-minor-heal')!;
 for(const rank of [1,2,3]){
  assert.equal(skillHealingPreview(h,heal,rank),Math.round(base.maxHP*[6,8,10][rank-1]/100));
  assert.equal(skillHealingPreview(result.hero,heal,rank),skillHealingPreview(h,heal,rank));
 }
 assert.deepEqual(resolveCastTiming({vct:1.2,fct:.3,chargeTime:.5},10,99),{vct:1.2,fct:.3,chargeTime:.5,castDelay:2,cooldown:6});
 assert.equal(next.castStat,1);assert.equal(resolveCastTiming({},10,0).castDelay,0);
});
