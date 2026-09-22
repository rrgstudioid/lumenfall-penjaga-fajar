import test from 'node:test';
import assert from 'node:assert/strict';
import {createV2CoreFoundationHero,createV2TestHero,activeSkills,derivedStats,resolveHeroSkill,chooseV2CoreJob,parseSave,calculateEquipmentStats} from './rules.ts';
import {ALL_SKILLS,ALL_PASSIVES,type SkillDefinition} from './skills.ts';
import {getVisibleJobArchitecture} from './job-presentation.ts';
import {getJobSkillNodes} from './character-view.ts';
import {createItem,canEquipItem,validateOffHandCompatibility} from './items.ts';
import {resolveWeaponStyle,meetsWeaponRequirement} from './weapon-style.ts';
import {relativePosition,forwardFromYaw,type PositionContext} from './combat-position.ts';
import {enterStealth,exitStealth,isStealthed,breakStealth,STEALTH_CAPABILITIES} from './stealth.ts';
import {applyStatus,hasStatus,removeStatus} from './combat-status.ts';
import {resolveTargetHit,type CombatModifier} from './combat-modifiers.ts';
import {skillHitDamage} from './skill-action.ts';
import {criticalChance} from './combat-mechanics.ts';
import {calculateCombatPowerFromStats,buildCombatPowerProfile} from './combat-power.ts';

const dagger=(id:string)=>({...createItem('field-verdant-plains-dagger',{id}),allowedJobs:[],requiredCoreJob:null});
const definition=():SkillDefinition=>({...structuredClone(ALL_SKILLS.find(s=>s.id==='v2-warrior-strike')!),id:'fixture-thief-only',job:'thief',tree:{id:'thief',architecture:'v2'},weaponRequirement:[],modifiers:[]});
const rear:PositionContext={attackerPosition:{x:0,z:2},targetPosition:{x:0,z:0},targetForward:forwardFromYaw(0)};

test('4B canonical Thief fixture: no Rogue/Warrior inheritance, no public activation, save identities stay distinct',()=>{
  const hero=createV2CoreFoundationHero('thief',30);
  assert.equal(hero.job,'thief');assert.equal(hero.coreJob,'thief');assert.equal(hero.progressionArchitecture,'v2_test');
  assert(activeSkills(hero).every(s=>s.job==='adventurer'||s.job==='thief'));
  assert.equal(ALL_SKILLS.filter(s=>s.job==='thief').length,16);assert.equal(ALL_PASSIVES.filter(s=>s.job==='thief').length,14);
  assert.equal(getVisibleJobArchitecture(hero).currentName,'Thief');
  assert(!JSON.stringify(getJobSkillNodes(hero,'core')).includes('rogue-foundation'));
  const fresh=createV2TestHero();fresh.level=15;
  assert.deepEqual(getVisibleJobArchitecture(fresh).v2CoreChoices.filter(j=>j.available).map(j=>j.id),['warrior']);
  assert.equal(fresh.coreJob,null);assert.equal(fresh.job,'adventurer');
  // Deliberately test the public runtime boundary, not TypeScript casting as authorization.
  assert.equal(chooseV2CoreJob(fresh,'thief' as never),false);
  assert.equal(parseSave(JSON.stringify(hero))!.coreJob,'thief');
  const legacy=parseSave(JSON.stringify({...hero,progressionArchitecture:'legacy',coreJob:'rogue',job:'rogue'}))!;
  assert.equal(legacy.coreJob,'rogue');assert.notEqual(legacy.progressionArchitecture,'v2_test');
  assert(Number.isFinite(derivedStats(hero).physicalAttack));
});

test('4B real dual dagger: distinct one-hand instances only, slot validation and no style-based Attack duplication',()=>{
  const main=dagger('main'),off=dagger('off');
  assert.equal(resolveWeaponStyle(main,off),'dual_dagger');
  assert.equal(resolveWeaponStyle(main,null),'dagger');assert.equal(resolveWeaponStyle(main,main),'dagger');
  assert.equal(validateOffHandCompatibility(main,main).ok,false);
  assert.equal(validateOffHandCompatibility(main,off).ok,true);
  assert.equal(canEquipItem(off,{level:59,coreJob:'thief',specialization:null},'offHand').ok,true);
  const sword={...main,id:'sword',equipmentType:'one_hand_sword' as const};
  assert.notEqual(resolveWeaponStyle(sword,off),'dual_dagger');
  assert.equal(resolveWeaponStyle(sword,{...sword,id:'sword2'}),'dual_sword');
  assert.equal(meetsWeaponRequirement(['dual_dagger'],main,null,'dual_dagger'),false);
  assert.equal(meetsWeaponRequirement(['dual_sword'],main,off,'dual_sword'),false);
  assert.equal(resolveWeaponStyle({...main,twoHanded:true,weaponType:'dual_dagger'},off),'none');
  const slotDagger={...off,equipmentType:'off_hand_dagger' as const,handedness:'off_hand' as const};
  assert.equal(resolveWeaponStyle(main,slotDagger),'dual_dagger');
  const h=createV2CoreFoundationHero('thief');h.inventory=[main,off];h.equipment={...h.equipment,mainHand:main.id,offHand:off.id};
  const before=calculateEquipmentStats(h).attack;
  main.weaponType='dual_dagger';off.weaponType='dual_dagger';
  assert.equal(calculateEquipmentStats(h).attack,before,'existing equipped-item contributions only; style is not a multiplier');
});

test('4B position uses target world facing, configurable cones, safe zero/invalid geometry',()=>{
  assert.equal(relativePosition(rear),'rear');
  assert.equal(relativePosition({...rear,attackerPosition:{x:0,z:-2}}),'front');
  assert.equal(relativePosition({...rear,attackerPosition:{x:2,z:0}}),'side');
  assert.equal(relativePosition({...rear,targetForward:forwardFromYaw(Math.PI)}),'front');
  assert.equal(relativePosition({...rear,attackerPosition:{x:1,z:1}},{rearAngle:60}),'side');
  assert.equal(relativePosition({...rear,attackerPosition:{x:1,z:1}},{rearAngle:120}),'rear');
  assert.equal(relativePosition({...rear,attackerPosition:{x:0,z:0}}),undefined);
  assert.equal(relativePosition({...rear,targetForward:{x:NaN,z:0}}),undefined);
  assert.equal(relativePosition({...rear,cameraYaw:Math.PI} as PositionContext),'rear');
});

test('4B stealth lifecycle: explicit break reasons, finite duration, legacy no-break default, no AI invisibility claim',()=>{
  const h=createV2CoreFoundationHero('thief');
  assert.equal(enterStealth(h,Infinity),false);
  assert(enterStealth(h,3,{breakOn:['basic_attack','damage_dealt','received_damage','offensive_skill']}));
  assert(isStealthed(h));assert(breakStealth(h,'basic_attack'));assert(!isStealthed(h));
  for(const reason of ['damage_dealt','received_damage','offensive_skill'] as const){enterStealth(h,3,{breakOn:[reason]});assert(breakStealth(h,reason));}
  enterStealth(h,3);assert.equal(breakStealth(h,'basic_attack'),false);
  h.statusEffects.stealth=0;assert(!isStealthed(h));
  enterStealth(h,2);assert(exitStealth(h));assert(!exitStealth(h));
  enterStealth(h,2);assert.equal(parseSave(JSON.stringify(h))!.statusEffects.stealth,undefined);
  assert.deepEqual(STEALTH_CAPABILITIES,{combatCondition:true,enemyDetection:false,lineOfSight:false});
});

test('4B timed Mark reuses timer storage, legacy boolean semantics preserved, target-local conditions',()=>{
  const a={marked:false,statusEffects:{} as Record<string,number>},b={marked:false};
  applyStatus(a,'mark',2);assert(hasStatus(a,'mark'));assert(!hasStatus(b,'mark'));
  applyStatus(a,'mark',3);assert.equal(a.statusEffects.marked,3);
  delete a.statusEffects.marked;assert(!hasStatus(a,'mark'));
  a.marked=true;assert(hasStatus(a,'mark'));removeStatus(a,'mark');assert(!hasStatus(a,'mark'));
});

test('4B conditional action crit/damage: marked + stealth + rear + real dual dagger; unqualified stats stay unchanged',()=>{
  const h=createV2CoreFoundationHero('thief');const main=dagger('m'),off=dagger('o');h.inventory=[main,off];h.equipment.mainHand=main.id;h.equipment.offHand=off.id;
  const mod:CombatModifier={id:'fixture-conditions',selector:{weaponStyles:['dual_dagger']},condition:{targetStatuses:['mark'],attackerStealthed:true,targetPosition:'rear'},action:{damagePercent:20,criticalRateBonus:10,criticalDamageBonus:30,accuracyBonus:12}};
  const stats=derivedStats(h),s=definition();s.modifiers=[mod];
  const action=resolveHeroSkill(h,s,1,stats),base=action.hitSequence[0];
  const target={marked:true},ctx={attackerStealthed:true,position:rear};
  const hit=resolveTargetHit(base,action.targetModifiers,target,0,ctx);
  assert.equal(hit.criticalRate,base.criticalRate+10);assert.equal(hit.criticalDamage,base.criticalDamage+30);assert.equal(hit.accuracy,base.accuracy+12);
  assert.equal(skillHitDamage(hit,stats),skillHitDamage(base,stats)*1.2);
  for(const [t,c] of [[{marked:false},ctx],[target,{...ctx,attackerStealthed:false}],[target,{...ctx,position:{...rear,targetForward:forwardFromYaw(Math.PI)}}]] as const)
    assert.equal(resolveTargetHit(base,action.targetModifiers,t,0,c).criticalDamage,base.criticalDamage);
  h.equipment.offHand=null;const single=resolveHeroSkill(h,s,1,stats);assert.equal(single.targetModifiers.length,0);
  assert.equal(derivedStats(h).criticalDamage,stats.criticalDamage);
  assert.equal(criticalChance(500),.8,'existing live cap');
});

test('4B impact vs explicit cast snapshot remain distinct; conditional crit CP only scores resolved facts',()=>{
  const h=createV2CoreFoundationHero('thief'),stats=derivedStats(h),s=definition();
  const mod:CombatModifier={id:'position-fixture',condition:{targetPosition:'rear'},action:{damagePercent:25,criticalRateBonus:20,criticalDamageBonus:40}};
  s.modifiers=[mod];s.canCrit=true;
  const context={target:{marked:false},position:rear,attackerStealthed:true,now:0};
  const impact=resolveHeroSkill(h,s,1,stats,undefined,[],context);
  assert.equal(impact.targetModifiers.length,1);
  const front={...context,position:{...rear,targetForward:forwardFromYaw(Math.PI)}};
  assert.equal(resolveTargetHit(impact.hitSequence[0],impact.targetModifiers,context.target,1,front).damageMultiplier,impact.hitSequence[0].damageMultiplier);
  s.modifiers=[{...mod,conditionTiming:'cast'}];const frozen=resolveHeroSkill(h,s,1,stats,undefined,[],context);
  assert.equal(frozen.targetModifiers.length,0);assert.equal(frozen.hitSequence[0].criticalDamage,stats.criticalDamage+40);
  assert.equal(resolveTargetHit(frozen.hitSequence[0],[],context.target,1,front).criticalDamage,stats.criticalDamage+40);
  assert.equal(resolveHeroSkill(h,s,1,stats).hitSequence[0].criticalDamage,stats.criticalDamage,'no imaginary rear in preview');
  const profile=buildCombatPowerProfile(h);const basic=profile.actions[0];
  const power=(action:typeof impact)=>calculateCombatPowerFromStats(stats,{...profile,actions:[{...basic,id:'fixture',hits:action.hitSequence,targetModifiers:action.targetModifiers,attackSpeed:false,rate:1}]}).details.expectedDPS;
  assert(power(frozen)>power(impact),'known resolved crit uses same per-hit values; unmodeled rear earns no guessed bonus');
});
