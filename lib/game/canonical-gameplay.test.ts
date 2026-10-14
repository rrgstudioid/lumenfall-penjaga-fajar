import { resolveSkillPresentation } from './skill-presentation-v3.ts';
import { ASSASIN_V3_SKILL_MAP, ASSASIN_V3_RUNTIME_SKILLS } from './assasin-v3.ts';
import { LEGACY_SPECIALIZATION_IDS } from './gameplay-test-fixtures.ts';
import { createV2TestHero, chooseSpecialization, authorizeV2Warrior, authorizeV2Thief, freshHero, chooseCoreJob, canEquipItem } from './rules.ts';
import { getJobSkillNodes } from './character-view.ts';
import { SPECIALIZATIONS } from './skills.ts';
import { simulatePvE, SIMULATION_SCENARIOS } from './gameplay-simulation.ts';
import { FIELDS } from './regions.ts';
import { AssasinCombatState } from './assasin-combat.ts';
import { ENHANCEMENT_STEPS } from './canonical-config.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_RULES, totalSkillPoints, skillPointsAtLevel, WEAPON_TUNING } from './canonical-config.ts';
import { createV3AdventurerHero, derivedStats, gainXP, chooseV3Thief, chooseV3Rogue, chooseV3Warrior,
  getTotalSkillPointsForLevel, calculateEquipmentStats, parseSave, parseSaveCollection, enhancementPreview,
  enhanceItem, saveCharacter, loadCharacter, SAVE_KEY, resetSkillPoints, learnSkill, activeSkills } from './rules.ts';
import { emptyEquipment, createItem, calculateEquipmentStats as itemStats } from './items.ts';
import { resolveCombatHit, resolveCriticalDamage, resolveCombatDamage } from './combat-resolver.ts';
import { resolveSkillAction, skillHitDamage } from './skill-action.ts';
import { WARRIOR_V3_RUNTIME_SKILLS } from './warrior-v3.ts';
import { resolveCastTiming } from './cast-timing.ts';
import { weaponAttack } from './dual-wield.ts';
import { resolveArmorSets, type ArmorSet } from './equipment-layers.ts';
import { encodeCharacterV2, decodeCharacterV2 } from './save-v2.ts';
import { JOB_V2_REGISTRY } from './job-registry-v2.ts';
import { characterAttributes } from './character-screen.ts';
import { getCombatPower } from './combat-power.ts';
import { ECLIPSE_PROFILES, VENOM_PROFILES } from './assasin-v3.ts';
import { resolvePvPCC, resolvePvPDamage, PvPCastBudget, type PvPConfig } from './pvp-layer.ts';
import { AssasinPoisonState } from './assasin-poison.ts';
import { chooseV3Assasin, characterStatBreakdown } from './rules.ts';
import { resolveDamageTransfer, SHARED_EFFECTS, validateSharedEffect } from './shared-effects.ts';
import { auditGameplayCatalog } from './gameplay-catalog-audit.ts';

const heroAt = (level = 80) => {
  const h = createV3AdventurerHero('slot-1', 'Canonical'); h.level = level; h.equipment = emptyEquipment();
  h.skillProgressionV3!.totalEarnedSP = totalSkillPoints(level); h.skillPoints = totalSkillPoints(level);
  h.gameplayContractVersion = 2; return h;
};
await test('LOCK: SP schedule boundaries, total199, stats through100, advanced locked', () => {
  assert.deepEqual([1,2,20,21,40,41,60,61,80,81,100].map(skillPointsAtLevel), [0,1,1,2,2,3,3,4,4,0,0]);
  assert.equal(getTotalSkillPointsForLevel(80),199); assert.equal(totalSkillPoints(100),199);
  const h = heroAt(80); const before = h.statPoints;
  assert.equal(gainXP(h, 1e8),20); assert.equal(h.level,100); assert.equal(h.statPoints - before,40);
  assert.equal(h.skillProgressionV3!.totalEarnedSP,199); assert.equal(CHARACTER_RULES.advancedPlayable,false);
});
await test('Job change refunds core and specialization ranks, not earned SP', () => {
  const h = heroAt(); assert(chooseV3Thief(h));
  h.skillProgressionV3!.skillRanks['v3-thief-stab'] = 3; h.skillLevels['v3-thief-stab'] = 3;
  assert(chooseV3Rogue(h)); assert.equal(h.skillProgressionV3!.totalEarnedSP,199);
  assert.deepEqual(h.skillProgressionV3!.skillRanks,h.skillProgressionV3!.grantedRanks);
  assert.equal(h.skillPoints,199); assert.equal(h.skillLevels['v3-thief-stab'],undefined);
  assert.equal(resetSkillPoints(h).ok,false);
});
await test('Canonical primary stats and CastStat; INT supplies no MCR/CDR; STR no crit; DEX no PATK', () => {
  const h = heroAt(1); const base = derivedStats(h);
  assert.deepEqual(characterAttributes(h),{str:15,vit:15,dex:15,int:15});
  h.allocatedStats.int = 10; h.allocatedStats.dex = 4;
  const next = derivedStats(h); assert.equal(next.castStat,18); assert.equal(next.manaCostReduction,base.manaCostReduction);
  assert.equal(next.cooldownReduction,base.cooldownReduction); assert(next.healingPower > base.healingPower);
  assert.equal(next.physicalAttack,base.physicalAttack);
  h.allocatedStats.str = 20; assert.equal(derivedStats(h).criticalRate,next.criticalRate);
  assert.equal(base.criticalDamage,150);
});
await test('Magic never rolls physical avoidance or critical; mitigation uses MDEF', () => {
  const badRng = () => { throw new Error('Magic must not roll'); };
  assert.equal(resolveCombatHit({damageType:'magic',accuracy:0},1e6,badRng).result,'HIT');
  assert.equal(resolveCriticalDamage(100,{damageType:'magic',canCrit:true,criticalRate:100},badRng),100);
  assert.equal(resolveCombatDamage({rawDamage:100,damageType:'magic',attackerLevel:1,physicalDefense:1e6,magicDefense:0}),100);
  assert.equal(resolveCriticalDamage(100,{damageType:'physical',canCrit:true,criticalRate:100},()=>0),150);
});
await test('Only marked Assassin poison DoT can crit', () => {
  const common = {damageType:'physical' as const,damageKind:'dot' as const,canCrit:true,criticalRate:100};
  assert.equal(resolveCriticalDamage(100,common,()=>0),100);
  assert.equal(resolveCriticalDamage(100,{...common,critException:VENOM_PROFILES[0].critException},()=>0),150);
  assert.equal(resolveCriticalDamage(100,{...common,damageType:'magic',critException:VENOM_PROFILES[0].critException},()=>0),100);
});
await test('Production Assassin poison scheduler carries only the explicit profile exception',()=>{
  const actor=heroAt(); chooseV3Thief(actor); chooseV3Assasin(actor);
  const amounts:number[]=[]; const target={hp:10000};
  const store=new AssasinPoisonState((_,tick)=>amounts.push(resolveCriticalDamage(tick.rawDamage,{...tick,criticalRate:100},()=>0)),()=>0);
  const profile=VENOM_PROFILES[0],snapshot={physicalAttack:100,effectiveDex:15,level:80,physicalPenetration:0,bossDamage:0,eliteDamage:0};
  assert(store.applyPoisonStack(actor,target,{sourceSkillId:'v3-assasin-venom-strike',targetActorId:'target',profile,snapshot,successfulDamage:1},0));
  store.advanceTarget(target,1); assert.equal(amounts[0],(16*8+100*.1)*1.5);
  store.clear(); amounts.length=0;
  assert(store.applyPoisonStack(actor,target,{sourceSkillId:'v3-assasin-venom-strike',targetActorId:'target',profile:{...profile,critException:undefined},snapshot,successfulDamage:1},0));
  store.advanceTarget(target,1); assert.equal(amounts[0],16*8+100*.1);
});
await test('Multi-hit consumes one coefficient and one stat-scaling budget', () => {
  const h=heroAt(), stats=derivedStats(h);
  const skill={...WARRIOR_V3_RUNTIME_SKILLS[0], baseDamageMinByRank:undefined,baseDamageMaxByRank:undefined,
    skillPowerFactor:0,rankValues:undefined,statScaling:{str:1},physicalCoefficient:2,baseDamage:0,
    hitSequence:[{delay:0,physicalCoefficient:2},{delay:.2,physicalCoefficient:2}]};
  const action=resolveSkillAction(skill,{stats,rank:1,masteryPower:1,masteryCooldown:1,equipmentDamage:0,weaponAllowed:true,weaponStyle:'one_hand_sword',primaryStats:{str:10,vit:0,dex:0,int:0}});
  assert.equal(action.hitSequence.reduce((s,h)=>s+h.physicalCoefficient,0),2);
  assert.equal(action.hitSequence.reduce((s,h)=>s+h.baseDamage,0),10);
  assert.equal(action.hitSequence.reduce((s,h)=>s+skillHitDamage(h,stats),0),stats.physicalAttack*2+10);
});
await test('Timing: CDR affects cooldown only; VCT/FCT/charge remain explicit',()=>{
  assert.deepEqual(resolveCastTiming({vct:2,fct:1,chargeTime:3},10,20),{vct:2,fct:1,chargeTime:3,castDelay:6,cooldown:8});
});
await test('Offhand penalty applies to raw weapon only; equipment/rune layers remain once',()=>{
  const h=heroAt(); chooseV3Thief(h);
  const item=createItem('field-verdant-plains-dagger',{id:'dagger-a',enhancementLevel:0});
  item.baseStats={attack:100,dex:10}; item.bonusStats={dex:5}; item.uniqueStatsLocked=false; item.sockets=[];
  const off={...structuredClone(item),id:'dagger-b'}; h.inventory=[item,off]; h.equipment.mainHand=item.id; h.equipment.offHand=off.id;
  const stats=calculateEquipmentStats(h);
  assert.equal(stats.attack,135); assert.equal(stats.dex,30);
  assert.equal(weaponAttack(off,'OFF'),45); assert.equal(WEAPON_TUNING.offHandBaseline,.5);
  item.enhancementLevel=5; assert.equal(itemStats(item).dex,19); // 10*1.4 + unique5
});
await test('Set thresholds2/3/4 count unique template pieces and unique sets only',()=>{
  const set:ArmorSet={id:'fixture',level:5,pieces:['a','b','c','d'],enabled:true,bonuses:{2:{hp:10},3:{hp:20},4:{hp:30}}};
  const items=set.pieces.map((templateId,i)=>({...createItem('arunika-head'),id:String(i),templateId,category:'armor' as const}));
  assert.equal(resolveArmorSets([...items,items[0]],[set,set]).hp,60);
  assert.equal(resolveArmorSets(items.slice(0,2),[set]).hp,10);
  assert.deepEqual(resolveArmorSets(items),{});
});
await test('Enhancement failure consumes materials, never item/Rune/level; +13 waits for tuning',()=>{
  const h=heroAt(), sword=createItem('field-verdant-plains-sword',{id:'sword',enhancementLevel:8});
  h.inventory=[sword,createItem('vibranium',{quantity:20})];
  const before=structuredClone(sword.sockets); assert(enhanceItem(h,sword.id,1).attempted);
  assert.equal(h.inventory.find(i=>i.id===sword.id)?.enhancementLevel,8);
  assert.deepEqual(h.inventory.find(i=>i.id===sword.id)?.sockets,before);
  assert.equal(h.inventory.find(i=>i.templateId==='vibranium')?.quantity,17);
  h.inventory.find(i=>i.id===sword.id)!.enhancementLevel=12;
  assert.match(enhancementPreview(h,sword.id)!.blockedReason,/belum ditetapkan/);
});
await test('Save C/K/J roundtrip preserves character, inventory, journal and paid ranks',()=>{
  const h=heroAt(); chooseV3Warrior(h); learnSkill(h,'v3-warrior-strike');
  h.completedQuests=['unknown-but-valid-journal-id']; h.gold=1234;
  const envelope=encodeCharacterV2(h); assert.equal(envelope.saveVersion,2); assert.equal(envelope.C.gold,1234);
  assert.equal(envelope.K.coreJob,'warrior'); assert.deepEqual(envelope.J.completedQuests,h.completedQuests);
  assert.deepEqual(decodeCharacterV2(envelope),h);
  const loaded=parseSave(JSON.stringify(envelope))!; assert(loaded); assert.equal(loaded.characterId,h.characterId);
  assert.equal(loaded.gold,h.gold); assert.deepEqual(loaded.completedQuests,h.completedQuests);
  assert.deepEqual(loaded.skillProgressionV3,h.skillProgressionV3);
  const collection=parseSaveCollection(JSON.stringify({characters:{'slot-1':envelope,'slot-2':{saveVersion:99,original:'keep'}}}))!;
  assert.deepEqual(collection.preservedCharacters?.['slot-2'],{saveVersion:99,original:'keep'});
});
await test('Legacy278 migration archives original and is idempotent',()=>{
  const h=heroAt(); delete h.gameplayContractVersion; h.skillProgressionV3!.totalEarnedSP=278;
  const migrated=parseSave(JSON.stringify(h))!; assert.equal(migrated.skillProgressionV3!.totalEarnedSP,199);
  assert(migrated.migrationArchive?.original);
  const again=parseSave(JSON.stringify(encodeCharacterV2(migrated)))!;
  assert.deepEqual(again.skillProgressionV3,migrated.skillProgressionV3); assert.deepEqual(again.migrationArchive,migrated.migrationArchive);
});
await test('Persistence retains previous source backup and loads per character',()=>{
  const original=globalThis.localStorage; const data=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)},configurable:true});
  try { const h=heroAt(); data.set(SAVE_KEY,JSON.stringify({characters:{'slot-1':h}}));
    saveCharacter(h,true); assert(data.has(SAVE_KEY+':before-contract-v2'));
    assert.equal(JSON.parse(data.get(SAVE_KEY)!).characters['slot-1'].saveVersion,2);
    assert.equal(loadCharacter('slot-1').characterId,h.characterId);
  } finally { Object.defineProperty(globalThis,'localStorage',{value:original,configurable:true}); }
});
await test('UI primary and CP consume final resolver; EHP is geometric mean',()=>{
  const h=heroAt(),stats=derivedStats(h); assert.deepEqual(characterAttributes(h),{str:stats.str,vit:stats.vit,dex:stats.dex,int:stats.int});
  const cp=getCombatPower(h); assert.equal(cp.details.coreDefensiveEHP,Math.sqrt(cp.details.physicalEHP*cp.details.magicEHP));
  const item=createItem('field-verdant-plains-sword',{id:'breakdown-weapon',enhancementLevel:4});
  item.bonusStats={dex:10}; item.uniqueStatsLocked=false; h.inventory=[item]; h.equipment.mainHand=item.id;
  assert.deepEqual(characterStatBreakdown(h).final,derivedStats(h));
});
await test('Registry preserves7/14/14; unfinished kits and advanced stay inactive',()=>{
  const jobs=Object.values(JOB_V2_REGISTRY); assert.deepEqual([1,2,3].map(t=>jobs.filter(j=>j.tier===t).length),[7,14,14]);
  assert(jobs.filter(j=>j.referenceStatus==='UNRESOLVED').every(j=>j.playable===false&&j.name==='Belum ditetapkan'));
  const h=heroAt(); assert(activeSkills(h).every(s=>s.job==='adventurer'));
  assert.equal(JOB_V2_REGISTRY.ranger.primaryPath,'INT'); assert.equal(JOB_V2_REGISTRY.marksman.primaryPath,'STR');
  const audit=auditGameplayCatalog(); assert.deepEqual(audit.duplicates,[]); assert.deepEqual(audit.orphans,[]);
});
await test('Shared effects leave unresolved policies inactive and conserve transfer',()=>{
  assert(SHARED_EFFECTS.every(validateSharedEffect)); assert(SHARED_EFFECTS.filter(e=>!['block','guard'].includes(e.kind)).every(e=>!e.enabled));
  const split=resolveDamageTransfer(100,'a','b',{fraction:.3,allowSelf:false,chaining:false}); assert.equal(split.retained+split.transferred,100);
});
await test('PvP unavailable until configured; synthetic configuration stops one-shot/continuous CC',()=>{
  assert.equal(resolvePvPDamage(1000,100).enabled,false);
  const cfg:PvPConfig={damageMultiplier:.5,maxSingleHitHPFraction:.4,ccDurationMultiplier:.5,maxContinuousCCSeconds:2,ccImmunitySeconds:3};
  assert.equal(resolvePvPDamage(1000,100,cfg).damage,40);
  const cast=new PvPCastBudget(cfg);
  assert.equal([1,2,3,4].reduce(sum=>sum+cast.resolveHit('target',1000,100).damage,0),40);
  let cc=resolvePvPCC(null,0,2,cfg); cc=resolvePvPCC(cc,.5,8,cfg); assert.equal(cc?.endsAt,2);
  assert.deepEqual(resolvePvPCC(cc,1,100,cfg),cc); assert.equal(cc?.immuneUntil,5);
});

await test('All five Venom profiles and three Eclipse ranks carry the narrow Assassin poison exception', () => {
  const presentationHero=heroAt(80);assert(chooseV3Thief(presentationHero));assert(chooseV3Assasin(presentationHero));
  for(const [slug,maxRank,label] of [['venom-mastery',5,'Poison Profile'],['venom-eclipse',3,'Ultimate DoT']] as const)for(let rank=1;rank<=maxRank;rank++){
    const id='v3-assasin-'+slug;presentationHero.skillProgressionV3!.skillRanks[id]=rank;
    const view=resolveSkillPresentation(presentationHero,ASSASIN_V3_SKILL_MAP[id],ASSASIN_V3_RUNTIME_SKILLS.find(s=>s.id===id)!);
    assert.match(view.specialMechanics.find(row=>row.label===label)!.value,/can crit/i);
    assert.doesNotMatch(view.specialMechanics.find(row=>row.label===label)!.value,/cannot crit|no crit/i);
  }

  const actor=heroAt(); assert(chooseV3Thief(actor)); assert(chooseV3Assasin(actor));
  const snapshot={physicalAttack:100,effectiveDex:25,level:80,physicalPenetration:0,bossDamage:0,eliteDamage:0,criticalRate:100,criticalDamage:150};
  for (const profile of VENOM_PROFILES) {
    const amounts:number[]=[]; const target={hp:100000,max:100000};
    const poison=new AssasinPoisonState<typeof target>((_,tick)=>{
      assert.equal(tick.critException,'assassin_skill_poison');
      amounts.push(resolveCriticalDamage(tick.rawDamage,{...tick,...snapshot},()=>0)/tick.rawDamage);
    },()=>0);
    assert(poison.applyPoisonStack(actor,target,{sourceSkillId:'v3-assasin-poison-dagger',targetActorId:'boss',profile,snapshot,successfulDamage:1},0));
    poison.advanceTarget(target,1); assert.equal(amounts.length,1); assert.equal(amounts[0],1.5);
  }
  for (let rank=1;rank<=ECLIPSE_PROFILES.length;rank++) {
    const target={hp:100000,max:100000}; let count=0;
    const poison=new AssasinPoisonState<typeof target>(()=>{},()=>0);
    const combat=new AssasinCombatState(poison,(_,tick)=>{
      count++; assert.equal(tick.canCrit,true); assert.equal(tick.critException,'assassin_skill_poison');
      assert.equal(resolveCriticalDamage(tick.rawDamage,{...tick,...snapshot},()=>0),tick.rawDamage*1.5);
      assert.equal(resolveCriticalDamage(tick.rawDamage,{...tick,...snapshot,critException:undefined},()=>0),tick.rawDamage);
    },()=>0);
    assert(combat.beginExecution(actor,'v3-assasin-venom-eclipse',{eclipse:true},rank,()=>({profile:VENOM_PROFILES[0],snapshot})).commitDamage(actor,target,'boss',0,1,0));
    combat.advanceTarget(target,10); assert.equal(count,10);
  }
});
await test('Enhancement schema stores +15 and incomplete +13..15 attempts are atomic',()=>{
  assert.deepEqual(Object.keys(ENHANCEMENT_STEPS).map(Number),Array.from({length:15},(_,i)=>i+1));
  for (const level of [12,13,14]) {
    assert.equal(ENHANCEMENT_STEPS[level+1],null);
    const h=heroAt(); const item=createItem('legacy-fajar-blade',{id:'enhancement-fixture',enhancementLevel:level});
    h.inventory=[item]; const original=JSON.stringify(h);
    assert.equal(enhancementPreview(h,item.id)?.blockedReason !== undefined,true);
    assert.equal(enhanceItem(h,item.id,0).ok,false); assert.equal(JSON.stringify(h),original);
  }
  const item=createItem('legacy-fajar-blade',{enhancementLevel:15}); assert.equal(item.enhancementLevel,15); assert.equal(item.maxEnhancementLevel,15);
  const h=heroAt(); h.inventory=[item]; const loaded=parseSave(JSON.stringify(h))!; assert.equal(loaded.inventory[0].enhancementLevel,15);
});
await test('Manual reset is disabled regardless of Gold and preserves paid ranks and state',()=>{
  const h=heroAt(); chooseV3Warrior(h); assert(learnSkill(h,'v3-warrior-strike')); h.gold=1000000;
  const before=JSON.stringify(h); const result=resetSkillPoints(h);
  assert.equal(result.ok,false); assert.equal(result.returnedPoints,0); assert.equal(JSON.stringify(h),before); assert.deepEqual(result.hero,h);
});

await test('Simulation preserves seed replay, effective damage, mana and cooldown budgets, and survival stop',()=>{
  const h=heroAt(); chooseV3Warrior(h); assert(learnSkill(h,'v3-warrior-strike'));
  const weapon=createItem('legacy-fajar-blade',{id:'simulation-main'});h.inventory=[weapon];h.equipment.mainHand=weapon.id;
  const boss={...FIELDS['meteorfall-citadel'].fieldBoss!,maxHP:1000000};
  const a=simulatePvE(h,boss,['v3-warrior-strike'],42,120);
  assert.deepEqual(a,simulatePvE(h,boss,['v3-warrior-strike'],42,120));
  assert(a.remainingMana>=0); assert(a.manaSpent<=derivedStats(h).maxMana+a.manaRegenerated+1e-6);
  for(let i=1;i<a.timeline.length;i++)assert(a.timeline[i].time+1e-6>=a.timeline[i-1].time+a.timeline[i-1].cooldown);
  const tiny=simulatePvE(h,{...boss,maxHP:1},['v3-warrior-strike'],42);
  assert.equal(tiny.totalDamage,1);assert(tiny.overkill>0);assert.equal(tiny.outcome,'defeated');
  const window=simulatePvE(h,{...boss,maxHP:1},['v3-warrior-strike'],42,10,SIMULATION_SCENARIOS[2]);
  assert.equal(window.outcome,'window-complete'); assert.equal(window.ttk,null); assert(window.totalDamage>1); assert.equal(window.elapsed,10);
  const deadly=simulatePvE(h,{...boss,attack:1e9},[],42,120,SIMULATION_SCENARIOS[1]);
  assert.equal(deadly.outcome,'actor-dead');assert.equal(deadly.ttk,null);assert.equal(deadly.remainingHP,0);
});

await test('ISOLATION: legacy specialization tests cannot activate legacy kits in V2 or V3',()=>{
 assert.equal(LEGACY_SPECIALIZATION_IDS.length,10);
 assert.equal(Object.keys(SPECIALIZATIONS).length,14);
 const v2=createV2TestHero();v2.level=60;authorizeV2Warrior(v2);
 const v3=heroAt(60);assert.equal(chooseV3Warrior(v3),true);
 for(const hero of [v2,v3])for(const id of LEGACY_SPECIALIZATION_IDS){
  const before=JSON.stringify(hero);assert.equal(chooseSpecialization(hero,id),false);assert.equal(JSON.stringify(hero),before);
  const stale={...hero,specialization:id};
  assert(activeSkills(stale).every(skill=>!LEGACY_SPECIALIZATION_IDS.some(legacy=>skill.id.startsWith(legacy+'-'))));
  assert.deepEqual(getJobSkillNodes(stale,'mastery'),{active:[],passive:[]});
 }
});

await test('ISOLATION: Caroq reward compatibility preserves canonical Dagger access and cannot grant V2/V3 legacy rewards',()=>{
 const legacy=freshHero();legacy.level=60;legacy.equipment=emptyEquipment();
 assert(chooseCoreJob(legacy,'rogue'));assert(chooseSpecialization(legacy,'caroq'));
 const rewards=legacy.inventory.filter(item=>item.templateId==='caroq-daggers');
 assert.equal(rewards.length,1);assert.equal(legacy.equipment.mainHand,rewards[0].id);
 assert.equal(rewards[0].requiredSpecialJob,null);assert.equal(rewards[0].quantity,1);
 const after=JSON.stringify(legacy);assert.equal(chooseSpecialization(legacy,'caroq'),false);assert.equal(JSON.stringify(legacy),after);
 const v2=createV2TestHero();v2.level=60;assert(authorizeV2Thief(v2));
 const v3=heroAt(60);assert(chooseV3Thief(v3));
 assert.equal(canEquipItem(rewards[0],v3,'mainHand').ok,true);
 for(const hero of [v2,v3]){
  const before=JSON.stringify(hero);assert.equal(chooseSpecialization(hero,'caroq'),false);assert.equal(JSON.stringify(hero),before);
  const stale={...hero,specialization:'caroq' as const};
  assert(activeSkills(stale).every(skill=>!skill.id.startsWith('caroq-')));
  assert.deepEqual(getJobSkillNodes(stale,'mastery'),{active:[],passive:[]});
 }
});
