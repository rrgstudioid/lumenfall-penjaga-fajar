import { composeAttackCore, composeBonusScaling, prepareRawAttackExecution, type AttackExecutionSnapshot, type AttackOwner, type AttackSource, type FoundationResult } from './attack-range-v2.ts';
import { IRON_SWORD_RANGE_V2, ironSwordAuthoredRange } from './iron-sword-range-v2.ts';
import { WARRIOR_V3_RUNTIME_SKILLS, WARRIOR_V3_SKILLS, WARRIOR_V3_SKILL_MAP } from './warrior-v3.ts';
import { ADVENTURER_V3_SKILL_MAP } from './adventurer-v3.ts';
import { availableSkillPointsV3, spentSkillPointsV3, skillCostThroughRank } from './skill-progression-v3.ts';
import { resolveSkillAction, type ResolvedSkillAction } from './skill-action.ts';
import { NO_COUNTER, type CounterContext, type CombatModifier } from './combat-modifiers.ts';
import { ITEM_CATALOG, canEquipItem, emptyEquipment, type ItemData } from './items.ts';
import { basePhysicalAttackForLevel, calculateBaseStats, derivedStats, combatModifiersFor, modifierContextFor, getTotalSkillPointsForLevel, type Hero, type DerivedStats } from './rules.ts';
import type { SkillDefinition } from './skills.ts';
import { BERSERKER_V3_SKILL_MAP } from './berserker-v3.ts';
import { BLADE_MASTER_V3_SKILL_MAP } from './blade-master-v3.ts';
import { JAYANTARA_RANGE_V3, jayantaraAuthoredRange } from './jayantara-range-v3.ts';
import { selectedItemSources, selectedPhysicalWeaponRange, validateMappedWarriorSword, validateSelectedBodyLoadout } from './selected-loadout-v1.ts';

/** W1–W4 human approval; local Warrior authority, never an Adventurer token. */
export const WARRIOR_REFERENCE = Object.freeze({ version:'WARRIOR_IRON_W1_W4_V1', skills:Object.freeze(WARRIOR_V3_SKILLS.map(s=>s.id)) });
export type WarriorReferenceHost = {hero:Hero; combatTime:number};
type Host = WarriorReferenceHost;
export type WarriorBinding = Readonly<{version:typeof WARRIOR_REFERENCE.version}>;
export type WarriorBuffReceipt = {modifier:CombatModifier; fingerprint:string; expires:number; kind?:'transient'|'state'};
type Receipt = WarriorBuffReceipt;
type State = {host:Host;hero:Hero;item:ItemData;owner:AttackOwner;signature:string;serial:number;receipts:Receipt[]};
const bindings = new WeakMap<WarriorBinding,State>();
const prepared = new WeakMap<ResolvedSkillAction,State>();
const sourceDefinitions = new Map(WARRIOR_V3_RUNTIME_SKILLS.map(s=>[s.id,{source:s,fingerprint:JSON.stringify(s),canonical:JSON.stringify(WARRIOR_V3_SKILL_MAP[s.id])}]));
const canonical = {...ADVENTURER_V3_SKILL_MAP,...WARRIOR_V3_SKILL_MAP,...BERSERKER_V3_SKILL_MAP,...BLADE_MASTER_V3_SKILL_MAP};
const canonicalProof=new Map(Object.entries(canonical).map(([id,d])=>[id,JSON.stringify(d)]));
const slots=emptyEquipment(), primary=['str','vit','dex','int'] as const;
const quick='v3-adventurer-quick-slash';
let epoch=0;
const fail=(code:string,path='hero'):FoundationResult<never>=>Object.freeze({ok:false,code,path,reason:`Warrior reference rejected: ${code} (${path})`});
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const zero=(v:unknown)=>obj(v)&&Object.values(v).every(n=>n===0);
export function warriorLifecycleSignature(h:Hero) {
  return JSON.stringify([h.characterId,h.slotId,h.level,h.job,h.jobTier,h.coreJob,h.specialization,h.progressionArchitecture,h.skillArchitectureVersion,h.skillProgressionV3,h.skillLevels,h.skillPoints,h.allocatedStats,h.statPoints,h.equipment,h.inventory,h.pet,h.fateRune,h.eternalSeal,h.passiveLevels,h.masteryChoices]);
}
export function warriorReferenceSkillMetadata(id:string,rank:number) {
  const d=WARRIOR_V3_SKILL_MAP[id],runtime=sourceDefinitions.get(id)?.source;
  if(!d||!runtime||!Number.isInteger(rank)||rank<1||rank>d.maxRank)return null;
  const v=runtime.rankValues![rank-1],buff=runtime.targetType==='self';
  const effect=runtime.rankEffects?.[rank-1];
  const temporaryBuffs=effect?.temporaryBuffs?.map(entry=>{
    const copied=structuredClone(entry);
    const freeze=(value:object)=>{for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);Object.freeze(value);};
    freeze(copied);return copied;
  });
  if(temporaryBuffs)Object.freeze(temporaryBuffs);
  return Object.freeze({version:WARRIOR_REFERENCE.version,id,rank,coefficient:buff?null:v.physicalCoefficient!,bonusSTRCoefficient:buff?null:v.statScaling?.str??0,bonusDEXCoefficient:buff?null:v.statScaling?.dex??0,mana:v.manaCost!,cooldown:v.cooldown!,gate:d.rankLevelRequirements![rank-1],range:v.range??runtime.range,radius:v.radius??runtime.areaRadius,maxTargets:v.maxTargets??runtime.maxTargets??1,targetType:runtime.targetType,hits:buff?0:1,duration:v.duration??runtime.duration,temporaryBuffs,canCrit:!buff,healPercent:null});
}
function validReceipts(h:Hero,receipts:Receipt[],now:number) {
  if(!zero(h.statusEffects)||h.barrier!==0)return false;
  if(h.combatStateModifiers?.some(m=>!receipts.some(r=>r.kind==='state'&&r.fingerprint===JSON.stringify(m)&&now<r.expires)))return false;
  const active=(h.temporaryModifiers??[]).filter(e=>e.remaining>0);
  if(active.length!==new Set(active.map(e=>e.modifier.id)).size)return false;
  if(active.some(e=>!Number.isFinite(e.remaining)||!receipts.some(r=>r.modifier===e.modifier&&r.fingerprint===JSON.stringify(e.modifier)&&now<=r.expires&&e.remaining<=r.expires-now+1e-8)))return false;
  return obj(h.activeBuffs)&&Object.entries(h.activeBuffs).every(([id,t])=>t===0||typeof t==='number'&&Number.isFinite(t)&&t>0&&(active.some(e=>e.modifier.id===id+'-buff'&&t<=e.remaining+1e-8)||receipts.some(r=>r.kind==='transient'&&r.modifier.id===id&&now<r.expires&&t<=r.expires-now+1e-8)));
}
/** Shared full validation only; this function never opens a runtime binding.
 * Standalone Warrior callers always pass the closed default scope. */
export function validateWarriorFamilyContext(host:Host,receipts:Receipt[],scope:'warrior'|'berserker'|'blade_master'='warrior'):FoundationResult<ItemData> {
  const h=host.hero,s=h.skillProgressionV3;
  if(Object.entries(canonical).some(([id,d])=>canonicalProof.get(id)!==JSON.stringify(d)))return fail('DEFINITION_PROVENANCE');
  const specialization=scope==='warrior'?null:scope;
  const dual=scope==='blade_master'&&(s?.skillRanks['v3-blade-master-twin-blade-mastery']??0)>0;
  if(h.job!=='warrior'||h.jobTier!==(specialization?'specialization':'core')||h.coreJob!=='warrior'||h.specialization!==specialization||h.skillArchitectureVersion!==3||h.progressionArchitecture!=='v3_adventurer'||!Number.isInteger(h.level)||h.level<(specialization?60:15)||h.level>(specialization?80:61)||typeof h.characterId!=='string'||!h.characterId.trim()||typeof h.slotId!=='string'||!h.slotId.trim()||h.canDualWieldOneHandSwords!==false)return fail('UNSUPPORTED_ACTOR');
  if(!s||s.skillArchitectureVersion!==3||s.chosenCoreJob!=='warrior'||s.chosenSpecialization!==specialization||s.chosenAdvancedJob!==null||!obj(s.skillRanks)||!obj(s.grantedRanks)||!obj(h.skillLevels)||s.totalEarnedSP!==getTotalSkillPointsForLevel(h.level))return fail('INVALID_LEDGER');
  if(s.skillRanks[quick]!==1||h.skillLevels[quick]!==1||s.grantedRanks[quick]!==1||Object.entries(s.grantedRanks).some(([id,r])=>id!==quick&&r!==0))return fail('INVALID_GRANT');
  let spent=0;
  for(const [id,d] of Object.entries(canonical)) {
    const rank=s.skillRanks[id]??0,mirror=h.skillLevels[id]??0;
    if(s.skillRanks[id]===null||h.skillLevels[id]===null||!Number.isInteger(rank)||rank<0||rank>d.maxRank||mirror!==rank)return fail('INVALID_RANK_MIRROR',id);
    if(id===quick)continue;
    if(!WARRIOR_V3_SKILL_MAP[id]&&!(scope==='berserker'&&BERSERKER_V3_SKILL_MAP[id])&&!(scope==='blade_master'&&BLADE_MASTER_V3_SKILL_MAP[id])&&rank!==0)return fail('UNSUPPORTED_INHERITED_RANK',id);
    if(rank>0) {
      if(h.level<(d.rankLevelRequirements?.[rank-1]??d.unlockLevel??15)||d.prerequisiteSkills?.some(p=>(s.skillRanks[p.skillId]??0)<p.requiredRank))return fail('RANK_GATE_OR_PREREQUISITE',id);
      // The first paid rank cannot fund its own original job-investment gate.
      const investment=d.jobInvestmentRequirement;
      if(investment&&Object.entries(canonical).reduce((total,[other,definition])=>total+(other!==id&&definition.jobId===investment.jobId?skillCostThroughRank(definition,s.skillRanks[other]??0):0),0)<investment.minimumSP)return fail('JOB_INVESTMENT_REQUIREMENT',id);
      if(d.spCostPerRank===undefined)return fail('MISSING_SP_CONTRACT',id);
      spent+=Array.isArray(d.spCostPerRank)?d.spCostPerRank.slice(0,rank).reduce((n,cost)=>n+cost,0):rank*d.spCostPerRank;
    }
  }
  if(Object.entries(s.skillRanks).some(([id,r])=>!canonical[id]&&r!==0)||Object.entries(h.skillLevels).some(([id,r])=>!canonical[id]&&r!==0)||s.totalEarnedSP<spent||spentSkillPointsV3(s,canonical)!==spent||availableSkillPointsV3(s,canonical)!==h.skillPoints||h.skillPoints!==s.totalEarnedSP-spent)return fail('INVALID_LEDGER');
  if(!obj(h.allocatedStats)||Object.keys(h.allocatedStats).length!==4||primary.some(k=>!Number.isSafeInteger(h.allocatedStats[k])||h.allocatedStats[k]!<0)||!Number.isSafeInteger(h.statPoints)||h.statPoints<0||h.statPoints+primary.reduce((n,k)=>n+h.allocatedStats[k]!,0)!==2*(h.level-1))return fail('INVALID_PRIMARY_BUDGET');
  if(h.pet!==null||h.fateRune!==null||h.eternalSeal!==null||!zero(h.passiveLevels)||!obj(h.masteryChoices)||Object.keys(h.masteryChoices).length||!validReceipts(h,receipts,host.combatTime))return fail('UNPROVEN_BONUS_SOURCE');
  if(!obj(h.equipment)||Object.keys(h.equipment).length!==Object.keys(slots).length||Object.keys(h.equipment).some(k=>!Object.hasOwn(slots,k))||!Array.isArray(h.inventory))return fail('UNSUPPORTED_EQUIPMENT');
  const body=validateSelectedBodyLoadout(h,dual?['mainHand','offHand']:['mainHand']);if(!body.ok)return body;
  const matches=h.inventory.filter(i=>i.id===h.equipment.mainHand);
  if(matches.length!==1)return fail('AMBIGUOUS_ITEM');
  const i=matches[0];
  const items=[i];
  if(h.equipment.offHand!==null) {
    const off=h.inventory.filter(item=>item.id===h.equipment.offHand);
    if(!dual||off.length!==1||off[0]===i||off[0].id===i.id)return fail('INVALID_OFFHAND');
    items.push(off[0]);
  }
  for(const [index,item] of items.entries()) {
    if(item.authoredEquipmentVersion !== undefined || item.authoredEquipmentProfile !== undefined) {
      // Only standalone Warrior MAIN gains mapped field Sword admission here.
      if(scope!=='warrior'||index!==0)return fail('UNSUPPORTED_EQUIPMENT_AUTHORING');
      const sword=validateMappedWarriorSword(h,item);if(!sword.ok)return sword;
      continue;
    }
    const great=scope==='berserker',c=ITEM_CATALOG[great?'jayantara-two-hand-sword':IRON_SWORD_RANGE_V2.templateId];
    if(!c||c.authoredAttackVersion!==(great?JAYANTARA_RANGE_V3.version:IRON_SWORD_RANGE_V2.version)||c.levelRequirement!==(great?45:10)||c.baseStats.attack!==(great?46:14)||JSON.stringify(item.allowedJobs)!==JSON.stringify(c.allowedJobs))return fail('CATALOG_PROVENANCE');
    if(!(great?jayantaraAuthoredRange(item):ironSwordAuthoredRange(item))||!c||!item.id.trim()||item.quantity!==1||!item.isEquipped||item.itemType!==c.itemType||item.weaponType!==c.weaponType||item.requiredCoreJob!==null||item.requiredSpecialJob!==null||item.jobRequirement!==null||!canEquipItem(item,h,index?'offHand':'mainHand').ok)return fail(great?'UNSUPPORTED_OWNED_JAYANTARA':'UNSUPPORTED_OWNED_IRON');
    if(!obj(item.baseStats)||Object.entries(item.baseStats).some(([k,n])=>k!=='attack'&&!(great&&k==='str'&&n===4)&&n!==0))return fail('UNSUPPORTED_ITEM_BONUS');
    const sources=selectedItemSources(item);if(!sources.ok)return sources;
  }
  const b=calculateBaseStats(h);
  if(primary.some(k=>b[k]!==15+h.allocatedStats[k]!))return fail('INVALID_EFFECTIVE_PRIMARY');
  return Object.freeze({ok:true,value:i});
}
const admit=(host:Host,receipts:Receipt[])=>validateWarriorFamilyContext(host,receipts);
export function openWarriorBinding(host:Host,previous?:WarriorBinding):FoundationResult<WarriorBinding> {
  // A caller may transfer receipts only at an already-authorized world transaction.
  // The old token remains opaque and correlated to this exact host.
  const prior=previous&&bindings.get(previous);
  const receipts=prior?.host===host ? prior.receipts.flatMap(r=>{
    const current=host.hero.temporaryModifiers?.find(e=>e.modifier.id===r.modifier.id&&JSON.stringify(e.modifier)===r.fingerprint&&e.remaining>0&&e.remaining<=r.expires-host.combatTime+1e-8);
    return current?[{...r,modifier:current.modifier}]:[];
  }):[];
  const result=admit(host,receipts);if(!result.ok)return result;
  const binding=Object.freeze({version:WARRIOR_REFERENCE.version}),owner=Object.freeze({actorId:host.hero.characterId,epoch:++epoch});
  bindings.set(binding,{host,hero:host.hero,item:result.value,owner,signature:warriorLifecycleSignature(host.hero),serial:0,receipts});
  return Object.freeze({ok:true,value:binding});
}
export function currentWarriorBinding(binding:WarriorBinding|undefined,host:Host):boolean {
  const s=binding&&bindings.get(binding);
  return !!s&&s.host===host&&s.hero===host.hero&&s.signature===warriorLifecycleSignature(host.hero)&&s.item===host.hero.inventory.find(i=>i.id===host.hero.equipment.mainHand)&&host.hero.inventory.filter(i=>i.id===s.item.id).length===1;
}
export function readWarriorBinding(binding:WarriorBinding|undefined,host:Host) {
  if(!currentWarriorBinding(binding,host))return fail('STALE_ACTOR_OR_ITEM');
  return admit(host,bindings.get(binding!)!.receipts);
}
export type PreparedWarrior=Readonly<{snapshot?:AttackExecutionSnapshot;stats:Readonly<DerivedStats>;action:ResolvedSkillAction;hero:Hero;rank:number;level:number}>;
/** Same foundation and strict standalone Warrior admission, now also for Basic. */
function composeWarriorBasic(binding:WarriorBinding,host:Host,combo:number,readOnly=false) {
  const admitted=readWarriorBinding(binding,host);if(!admitted.ok)return admitted;
  if(!Number.isInteger(combo)||combo<1||combo>3)return fail('UNSUPPORTED_COMBO');
  const state=bindings.get(binding)!,stats=Object.freeze(derivedStats({...host.hero,activeBuffs:{...host.hero.activeBuffs}}));
  const source=(category:AttackSource['category'],suffix:string):AttackSource=>({category,sourceId:state.owner.actorId+':'+state.owner.epoch+':basic:'+suffix,owner:state.owner});
  const core=composeAttackCore({damageType:'physical',owner:state.owner,base:{value:basePhysicalAttackForLevel(host.hero.level),source:source('BASE','base')},primary:{stat:'STR',effective:stats.str,source:source('PRIMARY_STAT','str')},globalFlat:[]});if(!core.ok)return core;
  const identity={instanceId:state.item.id,kind:'weapon' as const,owner:state.owner};
  const result=prepareRawAttackExecution({context:{validation:'VALIDATED_EXECUTION_CONTEXT',executionId:state.owner.actorId+':'+state.owner.epoch+':'+(readOnly?'PRESENTATION':++state.serial),owner:state.owner,mode:'SINGLE_MAIN',dualWeaponAuthorized:false,thrownAuthorized:false,magicSourceHands:[],instances:{MAIN:identity}},core:core.value,layers:{MAIN:{hand:'MAIN',identity,damageType:'physical',source:source('RAW_WEAPON','iron'),composition:{stage:'BASE',range:selectedPhysicalWeaponRange(state.item)!,enhancementMultiplier:1,contributionMultiplier:1}}},attackModifier:{scope:'ATTACK_RANGE',damageType:'physical',multiplier:1,sources:[]},rankBudget:{coefficient:1,scaling:0,source:source('SKILL_RANK','C1')},hits:[{hand:'MAIN',weight:1}]});
  return result.ok?Object.freeze({ok:true as const,value:Object.freeze({snapshot:result.value,stats,level:host.hero.level})}):result;
}
export const prepareWarriorBasic=(binding:WarriorBinding,host:Host,combo:number)=>composeWarriorBasic(binding,host,combo);
export function warriorRangePresentation(binding:WarriorBinding|undefined,host:Host) {
  if(!binding)return fail('STALE_ACTOR_OR_ITEM');
  const result=composeWarriorBasic(binding,host,1,true);if(!result.ok)return result;
  const state=bindings.get(binding)!;
  return Object.freeze({ok:true as const,value:Object.freeze({version:WARRIOR_REFERENCE.version,base:basePhysicalAttackForLevel(host.hero.level),bonusSTR:result.value.stats.str-15,core:result.value.snapshot.hits[0].attack.min-selectedPhysicalWeaponRange(state.item)!.min,weapon:selectedPhysicalWeaponRange(state.item)!,OFF:null,MAIN:result.value.snapshot.hits[0].attack,itemId:state.item.id})});
}
function composeWarriorAction(binding:WarriorBinding,host:Host,definition:SkillDefinition,counter:CounterContext=NO_COUNTER,execute=true):FoundationResult<PreparedWarrior> {
  const admitted=readWarriorBinding(binding,host);if(!admitted.ok)return admitted;
  const state=bindings.get(binding)!,entry=sourceDefinitions.get(definition.id),rank=host.hero.skillProgressionV3!.skillRanks[definition.id];
  if(!entry||entry.source!==definition||JSON.stringify(definition)!==entry.fingerprint||JSON.stringify(WARRIOR_V3_SKILL_MAP[definition.id])!==entry.canonical)return fail('DEFINITION_PROVENANCE',definition.id);
  const meta=warriorReferenceSkillMetadata(definition.id,rank);if(!meta)return fail('UNLEARNED_OR_INVALID_RANK',definition.id);
  const stats=Object.freeze(derivedStats({...host.hero,activeBuffs:{...host.hero.activeBuffs},temporaryModifiers:host.hero.temporaryModifiers?.slice()}));
  if(Object.values(stats).some(n=>typeof n==='number'&&!Number.isFinite(n))||[stats.bossDamage,stats.eliteDamage,stats.physicalPenetration,stats.magicPenetration,stats.skillDamage].some(n=>n!==0))return fail('UNSUPPORTED_RESOLVED_SOURCE');
  const fresh=structuredClone(definition);
  fresh.baseDamage=0;fresh.physicalCoefficient=0;fresh.magicCoefficient=0;fresh.skillPowerCoefficient=0;fresh.statScaling={};fresh.baseDamageMinByRank=undefined;fresh.baseDamageMaxByRank=undefined;fresh.skillPowerFactor=0;fresh.rankPowerFactorByRank=Array(definition.maxLevel).fill(1);fresh.knockbackStrength=0;fresh.nonDamaging=meta.hits===0;fresh.canCrit=meta.canCrit;fresh.modifierComposition='scoped_additive';
  fresh.rankValues=fresh.rankValues?.map(v=>({...v,baseDamage:0,physicalCoefficient:0,magicCoefficient:0,skillPowerCoefficient:0,statScaling:{},knockbackStrength:0}));
  if(definition.id==='v3-warrior-iron-charge')fresh.effect='dash_damage';
  for(const effect of fresh.rankEffects??[])for(const buff of effect.temporaryBuffs??[]) {
    buff.modifier.sourceOwner=state.owner.actorId;
    if(buff.modifier.stats?.percent?.damageReduction!==undefined) {
      const dr=buff.modifier.stats.percent.damageReduction;delete buff.modifier.stats.percent.damageReduction;
      buff.modifier.stats.flat={...buff.modifier.stats.flat,damageReduction:dr};
    }
  }
  const action=resolveSkillAction(fresh,{stats,rank,primaryStats:calculateBaseStats(host.hero),masteryPower:1,masteryCooldown:1,equipmentDamage:0,weaponAllowed:true,weaponStyle:'one_hand_sword',modifiers:combatModifiersFor(host.hero),combat:{...modifierContextFor(host.hero,stats),counter},rng:()=>{throw new Error('Warrior preparation must not draw RNG');}});
  if(action.hitSequence.length!==meta.hits||action.hitSequence.some(h=>h.delay!==0)||action.actionLockDuration||action.timing.impact!==0)return fail('UNSUPPORTED_ACTION_TIMING');
  let snapshot:AttackExecutionSnapshot|undefined;
  if(meta.hits&&execute) {
    const source=(category:AttackSource['category'],suffix:string):AttackSource=>Object.freeze({category,sourceId:`${state.owner.actorId}:${state.owner.epoch}:${definition.id}:${suffix}`,owner:state.owner});
    const core=composeAttackCore({damageType:'physical',owner:state.owner,base:{value:basePhysicalAttackForLevel(host.hero.level),source:source('BASE','base')},primary:{stat:'STR',effective:stats.str,source:source('PRIMARY_STAT','str')},globalFlat:[]});if(!core.ok)return core;
    const scaling=composeBonusScaling({STR:stats.str,DEX:stats.dex,VIT:stats.vit,INT:stats.int},{STR:meta.bonusSTRCoefficient!,DEX:meta.bonusDEXCoefficient!});if(!scaling.ok)return scaling;
    const identity=Object.freeze({instanceId:state.item.id,kind:'weapon' as const,owner:state.owner});
    const result=prepareRawAttackExecution({context:{validation:'VALIDATED_EXECUTION_CONTEXT',executionId:`${state.owner.actorId}:${state.owner.epoch}:${++state.serial}`,owner:state.owner,mode:'SINGLE_MAIN',dualWeaponAuthorized:false,thrownAuthorized:false,magicSourceHands:[],instances:{MAIN:identity}},core:core.value,layers:{MAIN:{hand:'MAIN',identity,damageType:'physical',source:source('RAW_WEAPON','iron'),composition:{stage:'BASE',range:selectedPhysicalWeaponRange(state.item)!,enhancementMultiplier:1,contributionMultiplier:1}}},attackModifier:{scope:'ATTACK_RANGE',damageType:'physical',multiplier:1,sources:[]},rankBudget:{coefficient:meta.coefficient!,scaling:scaling.value,source:source('SKILL_RANK','rank')},hits:[{hand:'MAIN',weight:1}]});
    if(!result.ok)return result;snapshot=result.value;
  }
  if(execute)prepared.set(action,state);
  return Object.freeze({ok:true,value:Object.freeze({snapshot,stats,action,hero:host.hero,rank,level:host.hero.level})});
}
export const prepareWarriorReference=(binding:WarriorBinding,host:Host,definition:SkillDefinition,counter:CounterContext=NO_COUNTER)=>composeWarriorAction(binding,host,definition,counter);
export function warriorSkillCost(binding:WarriorBinding|undefined,host:Host,definition:SkillDefinition) {
  if(!binding)return fail('STALE_ACTOR_OR_ITEM');
  const read=composeWarriorAction(binding,host,definition,NO_COUNTER,false);
  return read.ok?Object.freeze({ok:true as const,value:read.value.action.manaCost}):read;
}
/** Correlate original addTemporaryModifier output after an actual committed self buff. */
export function recordCommittedWarriorBuffs(binding:WarriorBinding,host:Host,action:ResolvedSkillAction) {
  const s=bindings.get(binding);
  if(!s||prepared.get(action)!==s||s.host!==host||s.hero!==host.hero)return;
  for(const buff of action.temporaryBuffs??[]) {
    const expected=JSON.stringify({...structuredClone(buff.modifier),stage:'temporary'});
    const entry=host.hero.temporaryModifiers?.find(e=>JSON.stringify(e.modifier)===expected&&e.remaining===buff.duration);
    if(entry) {
      s.receipts=s.receipts.filter(r=>r.modifier.id!==entry.modifier.id);
      s.receipts.push({modifier:entry.modifier,fingerprint:expected,expires:host.combatTime+buff.duration});
    }
  }
}

