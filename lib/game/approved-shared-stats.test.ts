import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createV3AdventurerHero,derivedStats,gainXP,xpNeeded,allocateStatPoint,equipItem,unequipItem,parseSave,reconcileResourceMaximums,recoverActiveResources,baseMagicAttackForLevel,skillHealingPreview,resolveHeroSkill} from './rules.ts';
import {createItem} from './items.ts';
import {applyStatModifiers,addTemporaryModifier,tickTemporaryModifiers,type CombatModifier} from './combat-modifiers.ts';
import {composeSharedMagicCore,readSharedMagicRange} from './shared-magic-stat-foundation.ts';
import {passiveBlockChance} from './combat-mechanics.ts';
import {resolveCastTiming} from './cast-timing.ts';
import {STAT_TUNING} from './canonical-config.ts';
import {ADVENTURER_V3_RUNTIME_SKILLS} from './adventurer-v3.ts';
import {previewEquipmentChange} from './character-view.ts';
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const context={weaponStyle:'none' as const,hp:100,maxHP:230};
const hero=()=>createV3AdventurerHero('APPROVED STAT MECHANICAL FIXTURE');

await test('neutral and legal DEX use BonusDEX once, preserve Accuracy/MDEF/resources',()=>{
 let h=hero(),s=derivedStats(h);assert.deepEqual([s.evasion,s.criticalRate,s.attackSpeed,s.accuracy,s.magicDefense,s.maxHP,s.maxMana],[0,2,100,90,20,230,62]);
 gainXP(h,xpNeeded(h.level));const next=allocateStatPoint(h,'dex');assert(next.ok);h=next.hero;s=derivedStats(h);
 assert.deepEqual([s.evasion,s.criticalRate,s.attackSpeed,s.accuracy],[.1,2.1,100.15,91]);
 const extra=derivedStats(h,h.allocatedStats,{dex:9});assert.deepEqual([extra.evasion,extra.criticalRate,extra.attackSpeed,extra.accuracy],[1,3,101.5,100]);
 const below=derivedStats(h,h.allocatedStats,{dex:-20});assert.deepEqual([below.evasion,below.criticalRate,below.attackSpeed],[0,2,100]);
});
await test('normal relative percentages add, explicit independent group multiplies; source dedupe and conflict are visible',()=>{
 const s=derivedStats(hero());
 const a:CombatModifier={id:'source-a',stats:{flat:{magicAttack:3},percent:{magicAttack:10}}},b:CombatModifier={id:'source-b',stats:{percent:{magicAttack:20}}};
 near(applyStatModifiers(s,[a,b,a],context).magicAttack,(s.magicAttack+3)*1.3);
 near(applyStatModifiers(s,[b,a],context).magicAttack,(s.magicAttack+3)*1.3);
 near(applyStatModifiers(s,[a,{...b,statPercentGroup:'explicit-independent'}],context).magicAttack,(s.magicAttack+3)*1.1*1.2);
 assert.throws(()=>applyStatModifiers(s,[a,{...a,stats:{flat:{magicAttack:999}}}],context),/Conflicting/);
 assert.throws(()=>applyStatModifiers(s,[{...a,statPercentGroup:''}],context),/Ambiguous/);
 assert.throws(()=>applyStatModifiers(s,[{...a,statPercentGroup:'independent',stats:{percent:{magicAttack:NaN}}}],context),/Invalid/);
});
await test('resource max gain/expiry/allocation/equip/load preserve absolute current values then clamp',()=>{
 let h=hero();gainXP(h,xpNeeded(h.level));h.hp=50;h.mana=12;
 const added=allocateStatPoint(h,'vit');assert(added.ok);h=added.hero;assert.equal(h.hp,50);
 const ring=createItem('arunika-ring1');ring.baseStats={};ring.bonusStats={hp:100,maxMana:50};h.inventory.push(ring);assert(equipItem(h,ring.id,'ring1').ok);assert.equal(h.hp,50);assert.equal(h.mana,12);
 addTemporaryModifier(h,{id:'mechanical-resource',stats:{percent:{maxHP:50,maxMana:50}}},1);
 const boosted=derivedStats(h);reconcileResourceMaximums(h);assert.equal(h.hp,50);assert.equal(h.mana,12);
 h.hp=boosted.maxHP;h.mana=boosted.maxMana;tickTemporaryModifiers(h,1);const s=derivedStats(h);reconcileResourceMaximums(h);assert.equal(h.hp,s.maxHP);assert.equal(h.mana,s.maxMana);
 h.hp=20;h.mana=7;unequipItem(h,'ring1');assert.equal(h.hp,20);assert.equal(h.mana,7);
 const loaded=parseSave(JSON.stringify(h),h.slotId);assert(loaded);assert.equal(loaded.hp,20);assert.equal(loaded.mana,7);
});
await test('active continuous recovery clamps HP and Mana; invalid dt/dead no catch-up or revive',()=>{
 const h=hero();h.hp=100;recoverActiveResources(h,.25);near(h.hp,100+.375);
 recoverActiveResources(h,2);near(h.hp,103.375);h.hp=229;recoverActiveResources(h,1);assert.equal(h.hp,230);
 h.hp=0;recoverActiveResources(h,10);assert.equal(h.hp,0);
 h.hp=100;for(const dt of [0,-1,NaN,Infinity])recoverActiveResources(h,dt);assert.equal(h.hp,100);
});
await test('magic universal core and explicit range use kernel A; missing/scalar/wrong channel no fallback',()=>{
 const owner={actorId:'MECHANICAL',epoch:0};const source=(category:'BASE'|'PRIMARY_STAT'|'GLOBAL_FLAT'|'RAW_WEAPON'|'SKILL_RANK',sourceId:string)=>({category,sourceId,owner});
 for(const level of [1,2,14,30,60,100]){
  assert.equal(baseMagicAttackForLevel(level),7+Math.floor(level*1.1));
  const r=composeSharedMagicCore({level,owner,baseSource:source('BASE','base'),primary:{stat:'INT',effective:18,source:source('PRIMARY_STAT','int')},globalFlat:[{value:4,source:source('GLOBAL_FLAT','flat')}]});assert(r.ok);assert.equal(r.value.value,7+Math.floor(level*1.1)+6+4);
 }
 const c=composeSharedMagicCore({level:1,owner,baseSource:source('BASE','b'),primary:{stat:'INT',effective:15,source:source('PRIMARY_STAT','i')},globalFlat:[]});assert(c.ok);
 const missing=readSharedMagicRange(c.value);assert(!missing.ok);assert.equal(missing.code,'MAGIC_RANGE_INPUT_MISSING');
 const identity={instanceId:'MATHEMATICAL MAGIC SOURCE',kind:'weapon' as const,owner};
 const input={context:{validation:'VALIDATED_EXECUTION_CONTEXT' as const,executionId:'PURE DTO NO ACTOR AUTHORITY',owner,mode:'SINGLE_MAIN' as const,dualWeaponAuthorized:false,thrownAuthorized:false,magicSourceHands:['MAIN' as const],instances:{MAIN:identity}},layers:{MAIN:{hand:'MAIN' as const,identity,damageType:'magic' as const,source:source('RAW_WEAPON','weapon'),composition:{stage:'BASE' as const,range:{min:5,max:7},enhancementMultiplier:1,contributionMultiplier:1}}},attackModifier:{scope:'ATTACK_RANGE' as const,damageType:'magic' as const,multiplier:1,sources:[]},rankBudget:{coefficient:1,scaling:0,source:source('SKILL_RANK','dto')},hits:[{hand:'MAIN' as const,weight:1}]};
 const before=JSON.stringify(input),r=readSharedMagicRange(c.value,input);assert(r.ok);assert.deepEqual(r.value.MAIN,{min:13,max:15});assert(Object.isFrozen(r.value.MAIN));assert.equal(JSON.stringify(input),before);
 assert(!readSharedMagicRange(c.value,{...input,layers:{MAIN:{...input.layers.MAIN,damageType:'physical'}}}).ok);
});
await test('VCT/FCT caps and explicit skill timing apply without CastStat conversion or metadata delay',()=>{
 // Latest OWNER closure supersedes the earlier HOLD conversion.
 assert.equal(STAT_TUNING.castStatToVct,.25);
 const r=resolveCastTiming({vct:2,fct:.4,chargeTime:.3},10,90,{statVariablePercent:90,variablePercent:5,fixedPercent:90});
 near(r.vct,.3);near(r.fct,.2);near(r.chargeTime,.3);near(r.castDelay,.8);near(r.cooldown,6);
 assert.equal(resolveCastTiming({vct:2},10,0,{statVariablePercent:200,variablePercent:20}).vct,0);
 const h=hero();h.temporaryModifiers=[{remaining:5,modifier:{id:'MECHANICAL EXPLICIT TIMING',stats:{flat:{variableCastReduction:20,fixedCastReduction:25}}}}];
 const definition={...ADVENTURER_V3_RUNTIME_SKILLS[0],baseDamageMinByRank:undefined,baseDamageMaxByRank:undefined,skillPowerFactor:0,castTiming:{vct:2,fct:.4,chargeTime:.3}};
 const resolved=resolveHeroSkill(h,definition,1,derivedStats(h),undefined,[],undefined,0,()=>{throw Error('no BaseRoll');});
 assert(resolved.castTiming);near(resolved.castTiming.vct,1.6);near(resolved.castTiming.fct,.3);near(resolved.castTiming.chargeTime,.3);near(resolved.hitSequence[0].delay,2.2);
 const noTiming=resolveHeroSkill(h,ADVENTURER_V3_RUNTIME_SKILLS[2],1);assert.deepEqual(noTiming.castTiming,{vct:0,fct:0,chargeTime:0});
});
await test('Block scope live50/30 separate from CP, physical direct blockable only',()=>{
 const yes={damageType:'physical' as const,damageKind:'direct' as const,blockable:true};assert.equal(passiveBlockChance(90,yes),.5);assert.equal(passiveBlockChance(0,yes),0);
 for(const policy of [{...yes,damageKind:'dot' as const},{...yes,damageType:'magic' as const},{...yes,blockable:false}])assert.equal(passiveBlockChance(90,policy),0);
});
await test('preview/read purity and Minor Heal percent-MaxHP remain independent of magic/stat sources',()=>{
 const h=hero(),ring=createItem('arunika-ring1');h.inventory.push(ring);const before=JSON.stringify(h);
 for(let i=0;i<4;i++)previewEquipmentChange(h,ring,'ring1');assert.equal(JSON.stringify(h),before);
 const heal=ADVENTURER_V3_RUNTIME_SKILLS[2];for(const rank of [1,2,3])assert.equal(skillHealingPreview(h,heal,rank),Math.round(230*[6,8,10][rank-1]/100));
});
