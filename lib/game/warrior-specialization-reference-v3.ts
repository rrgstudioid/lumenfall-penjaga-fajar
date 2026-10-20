import { composeAttackCore, composeBonusScaling, prepareRawAttackExecution, type AttackExecutionSnapshot, type AttackOwner, type AttackSource, type FoundationResult } from './attack-range-v2.ts';
import { validateWarriorFamilyContext, warriorLifecycleSignature, warriorReferenceSkillMetadata, type WarriorBuffReceipt, type WarriorReferenceHost } from './warrior-reference-v3.ts';
import { BERSERKER_V3_SKILL_MAP, BERSERKER_V3_RUNTIME_SKILLS } from './berserker-v3.ts';
import { BLADE_MASTER_V3_SKILL_MAP, BLADE_MASTER_V3_RUNTIME_SKILLS } from './blade-master-v3.ts';
import { WARRIOR_V3_RUNTIME_SKILLS } from './warrior-v3.ts';
import { IRON_SWORD_RANGE_V2 } from './iron-sword-range-v2.ts';
import { JAYANTARA_RANGE_V3 } from './jayantara-range-v3.ts';
import { NO_COUNTER, type CounterContext } from './combat-modifiers.ts';
import type { ResolvedSkillAction } from './skill-action.ts';
import { basePhysicalAttackForLevel, derivedStats, resolveHeroSkill, type DerivedStats, type Hero } from './rules.ts';
import type { ItemData } from './items.ts';
import type { SkillDefinition } from './skills.ts';

export const SPECIALIZATION_REFERENCE = Object.freeze({
  version:'WARRIOR_SPECIALIZATIONS_SB1_SB6_V1',
  skills:Object.freeze([...WARRIOR_V3_RUNTIME_SKILLS,...BERSERKER_V3_RUNTIME_SKILLS,...BLADE_MASTER_V3_RUNTIME_SKILLS].map(d=>d.id)),
});
type Scope='berserker'|'blade_master';
type Host=WarriorReferenceHost;
export type SpecializationBinding=Readonly<{version:typeof SPECIALIZATION_REFERENCE.version}>;
type State={host:Host;hero:Hero;items:ItemData[];scope:Scope;signature:string;owner:AttackOwner;serial:number;receipts:WarriorBuffReceipt[]};
const bindings=new WeakMap<SpecializationBinding,State>();
const prepared=new WeakMap<ResolvedSkillAction,State>();
const definitions=new Map([...WARRIOR_V3_RUNTIME_SKILLS,...BERSERKER_V3_RUNTIME_SKILLS,...BLADE_MASTER_V3_RUNTIME_SKILLS].map(d=>[d.id,{source:d,fingerprint:JSON.stringify(d)}]));
const canonical={...BERSERKER_V3_SKILL_MAP,...BLADE_MASTER_V3_SKILL_MAP};
let epoch=0;
const fail=(code:string):FoundationResult<never>=>Object.freeze({ok:false,code,path:'specialization',reason:code});
const freeze=<T>(value:T):T=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export function specializationSkillMetadata(id:string,rank:number) {
  const inherited=warriorReferenceSkillMetadata(id,rank);if(inherited)return Object.freeze({...inherited,version:SPECIALIZATION_REFERENCE.version});
  const d=canonical[id],runtime=definitions.get(id)?.source;
  if(!d||!runtime||!Number.isInteger(rank)||rank<1||rank>d.maxRank)return null;
  const passive=d.skillType==='MASTERY',buff=passive||d.targeting?.targetType==='self';
  const v=runtime.rankValues?.[rank-1]??{};
  const sequence=runtime.rankEffects?.[rank-1]?.hitSequence;
  return freeze({version:SPECIALIZATION_REFERENCE.version,id,rank,
    coefficient:buff?null:v.physicalCoefficient??runtime.physicalCoefficient??0,
    bonusSTRCoefficient:buff?null:v.statScaling?.str??0,bonusDEXCoefficient:buff?null:v.statScaling?.dex??0,
    mana:passive?0:v.manaCost??runtime.manaCost,cooldown:passive?0:v.cooldown??runtime.cooldown,
    gate:d.rankLevelRequirements![rank-1],range:v.range??runtime.range,radius:v.radius??runtime.areaRadius,
    maxTargets:buff?0:v.maxTargets??runtime.maxTargets??1,targetType:runtime.targetType,
    hits:buff?0:sequence?.length??1,duration:v.duration??runtime.duration,
    temporaryBuffs:structuredClone(runtime.rankEffects?.[rank-1]?.temporaryBuffs),canCrit:!buff,healPercent:null});
}
export function openSpecializationBinding(host:Host,previous?:SpecializationBinding):FoundationResult<SpecializationBinding> {
  const scope=host.hero.specialization;if(scope!=='berserker'&&scope!=='blade_master')return fail('UNSUPPORTED_SPECIALIZATION');
  const prior=previous&&bindings.get(previous);
  const receipts:WarriorBuffReceipt[]=prior?.host===host&&prior.scope===scope?prior.receipts.flatMap(r=>{
    if(r.expires<=host.combatTime)return [];
    if(r.kind)return [{...r}];
    const entry=host.hero.temporaryModifiers?.find(e=>e.remaining>0&&JSON.stringify(e.modifier)===r.fingerprint&&e.remaining<=r.expires-host.combatTime+1e-8);
    return entry?[{...r,modifier:entry.modifier}]:[];
  }):[];
  const admitted=validateWarriorFamilyContext(host,receipts,scope);if(!admitted.ok)return admitted;
  const items=[admitted.value];if(host.hero.equipment.offHand)items.push(host.hero.inventory.find(i=>i.id===host.hero.equipment.offHand)!);
  const binding=Object.freeze({version:SPECIALIZATION_REFERENCE.version});
  bindings.set(binding,{host,hero:host.hero,items,scope,signature:warriorLifecycleSignature(host.hero),owner:Object.freeze({actorId:host.hero.characterId,epoch:++epoch}),serial:0,receipts});
  return Object.freeze({ok:true,value:binding});
}
export function currentSpecializationBinding(binding:SpecializationBinding|undefined,host:Host) {
  const s=binding&&bindings.get(binding);
  return !!s&&s.host===host&&s.hero===host.hero&&s.signature===warriorLifecycleSignature(host.hero)&&
    s.items.every((i,index)=>host.hero.inventory.find(item=>item.id===host.hero.equipment[index?'offHand':'mainHand'])===i&&host.hero.inventory.filter(item=>item.id===i.id).length===1);
}
export function readSpecializationBinding(binding:SpecializationBinding|undefined,host:Host) {
  if(!currentSpecializationBinding(binding,host))return fail('STALE_ACTOR_OR_ITEM');
  const s=bindings.get(binding!)!;return validateWarriorFamilyContext(host,s.receipts,s.scope);
}
function snapshot(s:State,stats:Readonly<DerivedStats>,id:string,coefficient:number,str:number,dex:number,hits:readonly {hand:'MAIN'|'OFF'|'BOTH';weight:number}[],readOnly=false):FoundationResult<AttackExecutionSnapshot> {
  const owner=s.owner,source=(category:AttackSource['category'],suffix:string):AttackSource=>({category,sourceId:owner.actorId+':'+owner.epoch+':'+id+':'+suffix,owner});
  const core=composeAttackCore({damageType:'physical',owner,base:{value:basePhysicalAttackForLevel(s.hero.level),source:source('BASE','level')},primary:{stat:'STR',effective:stats.str,source:source('PRIMARY_STAT','str')},globalFlat:[]});if(!core.ok)return core;
  const scaling=composeBonusScaling({STR:stats.str,DEX:stats.dex,VIT:stats.vit,INT:stats.int},{STR:str,DEX:dex});if(!scaling.ok)return scaling;
  const identities=s.items.map(i=>({instanceId:i.id,kind:'weapon' as const,owner}));
  const dual=s.items.length===2;
  const instances={MAIN:identities[0],...(dual?{OFF:identities[1]}:{})};
  const layers=Object.fromEntries(s.items.map((_,index)=>{
    const hand=index?'OFF' as const:'MAIN' as const;
    return [hand,{hand,identity:identities[index],damageType:'physical' as const,source:source('RAW_WEAPON',hand),composition:{stage:'BASE' as const,range:s.scope==='berserker'?JAYANTARA_RANGE_V3.baseRange:IRON_SWORD_RANGE_V2.baseRange,enhancementMultiplier:1,contributionMultiplier:1,...(index?{offHandEfficiency:.5}:{})}}];
  }));
  return prepareRawAttackExecution({context:{validation:'VALIDATED_EXECUTION_CONTEXT',executionId:owner.actorId+':'+owner.epoch+':'+(readOnly?'PRESENTATION':++s.serial),owner,mode:hits.some(h=>h.hand!=='MAIN')?(hits.length===1?'DUAL_COMBINED':'DUAL_SEQUENCE'):'SINGLE_MAIN',dualWeaponAuthorized:dual,thrownAuthorized:false,magicSourceHands:[],instances},core:core.value,layers,attackModifier:{scope:'ATTACK_RANGE',damageType:'physical',multiplier:1,sources:[]},rankBudget:{coefficient,scaling:scaling.value,source:source('SKILL_RANK','rank')},hits});
}
/** Pure composition with a read-only identity; no execution serial allocation. */
export function specializationRangePresentation(binding:SpecializationBinding|undefined,host:Host) {
  const admitted=readSpecializationBinding(binding,host);if(!admitted.ok)return admitted;
  const s=bindings.get(binding!)!,stats=Object.freeze(derivedStats({...host.hero,activeBuffs:{...host.hero.activeBuffs}}));
  const result=snapshot(s,stats,'presentation',1,0,0,[{hand:s.items.length===2?'BOTH':'MAIN',weight:1}],true);if(!result.ok)return result;
  const weapon=s.scope==='berserker'?JAYANTARA_RANGE_V3.baseRange:IRON_SWORD_RANGE_V2.baseRange;
  const off=result.value.weaponRanges.OFF,core=result.value.hits[0].attack.min-weapon.min-(off?.min??0);
  return freeze({ok:true as const,value:{version:SPECIALIZATION_REFERENCE.version,base:basePhysicalAttackForLevel(host.hero.level),bonusSTR:stats.str-15,core,weapon,OFF:off??null,MAIN:result.value.hits[0].attack,itemId:s.items[0].id}});
}
export type PreparedSpecialization=Readonly<{snapshot?:AttackExecutionSnapshot;stats:Readonly<DerivedStats>;action:ResolvedSkillAction;hero:Hero;rank:number;level:number}>;
function composeSpecializationAction(binding:SpecializationBinding,host:Host,definition:SkillDefinition,counter:CounterContext=NO_COUNTER,tempoReduction=0,execute=true):FoundationResult<PreparedSpecialization> {
  const admitted=readSpecializationBinding(binding,host);if(!admitted.ok)return admitted;
  const s=bindings.get(binding)!,entry=definitions.get(definition.id),rank=host.hero.skillProgressionV3!.skillRanks[definition.id];
  if(!entry||entry.source!==definition||entry.fingerprint!==JSON.stringify(definition))return fail('DEFINITION_PROVENANCE');
  const d=canonical[definition.id];if(d&&d.jobId!==s.scope)return fail('SIBLING_SKILL');
  const meta=specializationSkillMetadata(definition.id,rank);if(!meta||d?.skillType==='MASTERY')return fail('UNLEARNED_OR_PASSIVE');
  const stats=Object.freeze(derivedStats({...host.hero,activeBuffs:{...host.hero.activeBuffs},temporaryModifiers:host.hero.temporaryModifiers?.slice()}));
  const fresh=structuredClone(definition);
  fresh.baseDamage=0;fresh.physicalCoefficient=0;fresh.magicCoefficient=0;fresh.skillPowerCoefficient=0;fresh.statScaling={};
  fresh.baseDamageMinByRank=undefined;fresh.baseDamageMaxByRank=undefined;fresh.skillPowerFactor=0;fresh.rankPowerFactorByRank=Array(definition.maxLevel).fill(1);
  fresh.knockbackStrength=0;fresh.nonDamaging=meta.hits===0;fresh.canCrit=meta.canCrit;fresh.modifierComposition='scoped_additive';
  fresh.rankValues=fresh.rankValues?.map(v=>({...v,baseDamage:0,physicalCoefficient:0,magicCoefficient:0,skillPowerCoefficient:0,statScaling:{},knockbackStrength:0}));
  if(definition.id==='v3-warrior-iron-charge')fresh.effect='dash_damage';
  if(d?.jobId==='berserker'&&fresh.targetType==='frontal_arc')fresh.angle=90;
  for(const effect of fresh.rankEffects??[]) {
    for(const hit of effect.hitSequence??[]) {hit.physicalCoefficient=0;hit.magicCoefficient=0;hit.baseDamage=0;}
    for(const buff of effect.temporaryBuffs??[]) {
      buff.modifier.sourceOwner=s.owner.actorId;
      if(buff.modifier.stats?.percent?.damageReduction!==undefined) {
        const dr=buff.modifier.stats.percent.damageReduction;delete buff.modifier.stats.percent.damageReduction;
        buff.modifier.stats.flat={...buff.modifier.stats.flat,damageReduction:dr};
      }
    }
  }
  // Reuse original mastery/Drive/trance/weapon/timing modifier consumers. All
  // arithmetic coefficients and legacy roll sources are zeroed before this call;
  // only the immutable foundation snapshot later supplies physical hit power.
  const action=resolveHeroSkill(host.hero,fresh,rank,stats,counter,[],undefined,tempoReduction,()=>{throw new Error('Specialization composition must not draw RNG');});
  if(action.actionLockDuration||action.timing.impact!==0)return fail('UNSUPPORTED_ACTION_TIMING');
  let execution:AttackExecutionSnapshot|undefined;
  if(meta.hits&&execute) {
    const original=definition.rankEffects?.[rank-1]?.hitSequence;
    const hits=original?.length?original.map(h=>({hand:h.weaponHand??'MAIN',weight:definition.id==='v3-blade-master-blade-tempest'?(h.physicalCoefficient??0)/meta.coefficient!:(h.sharedContributionWeight??1)})):[{hand:'MAIN' as const,weight:1}];
    const result=snapshot(s,stats,definition.id,meta.coefficient!,meta.bonusSTRCoefficient!,meta.bonusDEXCoefficient!,hits);if(!result.ok)return result;execution=result.value;
    if(action.hitSequence.length!==execution.hits.length)return fail('HIT_BUDGET_MISMATCH');
    action.hitSequence.forEach((hit,index)=>{hit.sharedContributionWeight=execution!.hits[index].weight;});
  }
  if(execute)prepared.set(action,s);
  return Object.freeze({ok:true,value:Object.freeze({snapshot:execution,stats,action,hero:host.hero,rank,level:host.hero.level})});
}
export const prepareSpecializationReference=(binding:SpecializationBinding,host:Host,definition:SkillDefinition,counter:CounterContext=NO_COUNTER,tempoReduction=0)=>composeSpecializationAction(binding,host,definition,counter,tempoReduction);
/** Same resolved action plumbing, but no snapshot/receipt/serial or random draw. */
export function specializationSkillCost(binding:SpecializationBinding|undefined,host:Host,definition:SkillDefinition,tempoReduction=0) {
  if(!binding)return fail('STALE_ACTOR_OR_ITEM');
  const read=composeSpecializationAction(binding,host,definition,NO_COUNTER,tempoReduction,false);
  return read.ok?Object.freeze({ok:true as const,value:read.value.action.manaCost}):read;
}
export function prepareSpecializationBasic(binding:SpecializationBinding,host:Host,combo:number) {
  const admitted=readSpecializationBinding(binding,host);if(!admitted.ok)return admitted;
  if(!Number.isInteger(combo)||combo<1||combo>3)return fail('UNSUPPORTED_COMBO');
  const s=bindings.get(binding)!,stats=Object.freeze(derivedStats({...host.hero,activeBuffs:{...host.hero.activeBuffs}}));
  const result=snapshot(s,stats,'basic',1,0,0,[{hand:s.items.length===2?'BOTH':'MAIN',weight:1}]);
  return result.ok?Object.freeze({ok:true as const,value:Object.freeze({snapshot:result.value,stats,level:host.hero.level})}):result;
}
export function recordCommittedSpecializationBuffs(binding:SpecializationBinding,host:Host,action:ResolvedSkillAction,driveExpiry?:number) {
  const s=bindings.get(binding);if(!s||prepared.get(action)!==s||s.host!==host||s.hero!==host.hero)return;
  for(const buff of action.temporaryBuffs??[]) {
    const fingerprint=JSON.stringify({...structuredClone(buff.modifier),stage:'temporary'});
    const entry=host.hero.temporaryModifiers?.find(e=>JSON.stringify(e.modifier)===fingerprint&&e.remaining===buff.duration);
    if(entry){s.receipts=s.receipts.filter(r=>r.modifier.id!==entry.modifier.id);s.receipts.push({modifier:entry.modifier,fingerprint,expires:host.combatTime+buff.duration});}
  }
  if(action.skillId==='v3-berserker-trance') {
    s.receipts=s.receipts.filter(r=>r.modifier.id!==action.skillId);
    s.receipts.push({kind:'transient',modifier:{id:action.skillId},fingerprint:'transient',expires:host.combatTime+action.duration});
  }
  if(action.skillId==='v3-blade-master-tempo-drive'&&Number.isFinite(driveExpiry)&&driveExpiry!>host.combatTime) {
    const modifier=host.hero.combatStateModifiers?.find(m=>m.id==='v3-blade-master-tempo-drive-speed');
    if(modifier){s.receipts=s.receipts.filter(r=>r.modifier.id!==modifier.id);s.receipts.push({kind:'state',modifier,fingerprint:JSON.stringify(modifier),expires:driveExpiry!});}
  }
  // Signature changes only through an actual, prepared committed action.
  s.signature=warriorLifecycleSignature(host.hero);
}
