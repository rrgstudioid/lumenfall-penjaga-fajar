import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createItem } from './items.ts';
import { canLearnSkill, chooseV3BladeMaster, chooseV3Warrior, createV3AdventurerHero, derivedStats, learnSkill, resolveHeroSkill, resetSkillPoints } from './rules.ts';
import { BLADE_MASTER_V3_RUNTIME_MAP, BLADE_MASTER_V3_SKILL_MAP, BLADE_MASTER_FLOW_CONSUMERS, BLADE_MASTER_DUAL_MANA_SKILLS, BLADE_MASTER_MASTERY_MANA_SKILLS } from './blade-master-v3.ts';
import { TransientCombatState } from './combat-transient.ts';
import { skillHitDamage, SkillHitQueue } from './skill-action.ts';
import { applySourceOwnedStatus, effectiveArmorBreakStrength, hasActiveStatusFromSource } from './combat-status.ts';
import { assignPrimaryHotbarSlot, validatePrimaryHotbar } from './hotbar.ts';
import { criticalChance, mitigateDamage } from './combat-mechanics.ts';
import { BERSERKER_V3_RUNTIME_MAP } from './berserker-v3.ts';
import { chooseV3Berserker } from './rules.ts';
import { BladeMasterImpactSession } from './blade-master-impact.ts';

const id = (short: string) => `v3-blade-master-${short}`;
function setup(level = 80) {
  const hero = createV3AdventurerHero(); hero.level = level; hero.skillProgressionV3!.totalEarnedSP = 500;
  assert.equal(chooseV3Warrior(hero), true); assert.equal(chooseV3BladeMaster(hero), true);
  const sword = (name: string, attack: number) => createItem('legacy-fajar-blade', { id: name, baseStats: { attack }, equipSlot: 'mainHand', mainHand: true, equipmentType: 'one_hand_sword', weaponType: 'one_hand_sword', handedness: 'one_hand', twoHanded: false });
  const main = sword('advanced-main', 100), off = sword('advanced-off', 70);
  hero.inventory.push(main,off);hero.equipment.mainHand=main.id;hero.equipment.offHand=off.id;
  hero.skillProgressionV3!.skillRanks[id('twin-blade-mastery')] = 5;
  return { hero, main, off };
}

test('7B exactly nine skills, 149 SP total, ranks, levels, prerequisites and no AoE', () => {
  const skills = Object.values(BLADE_MASTER_V3_SKILL_MAP);
  assert.equal(skills.length,9);
  assert.equal(skills.reduce((sum,skill) => sum + Array.from({length:skill.maxRank},(_,i)=>typeof skill.spCostPerRank==='number'?skill.spCostPerRank:skill.spCostPerRank?.[i]??0).reduce((a,b)=>a+b,0),0),149);
  for (const short of ['cross-sever','piercing-sequence','tempo-drive','blade-tempest']) assert.equal(BLADE_MASTER_V3_RUNTIME_MAP[id(short)].targetType,short==='tempo-drive'?'self':'single');
  assert.deepEqual(BLADE_MASTER_V3_SKILL_MAP[id('cross-sever')].rankLevelRequirements,[65,69,72,76,80]);
  assert.deepEqual(BLADE_MASTER_V3_SKILL_MAP[id('piercing-sequence')].prerequisiteSkills?.map(p=>p.requiredRank),[2,3]);
  assert.deepEqual(BLADE_MASTER_V3_SKILL_MAP[id('blade-tempest')].jobInvestmentRequirement,{jobId:'blade_master',minimumSP:18});
  assert.deepEqual([...BLADE_MASTER_FLOW_CONSUMERS],[id('twin-assault'),id('cross-sever'),id('piercing-sequence'),id('blade-tempest')]);
  assert.deepEqual([...BLADE_MASTER_DUAL_MANA_SKILLS],[id('twin-assault'),id('cross-sever'),id('blade-tempest')]);
});

test('7B purchase gates enforce level, cross-tier requirements, 18-SP investment and rank limits', () => {
  const {hero}=setup(65);
  hero.skillProgressionV3!.skillRanks[id('twin-blade-mastery')]=3;
  assert.equal(canLearnSkill(id('cross-sever'),hero).ok,false);
  hero.level=80;
  assert.equal(canLearnSkill(id('cross-sever'),hero).ok,false);
  assert.equal(canLearnSkill(id('blade-tempest'),hero).ok,false);
  hero.skillProgressionV3!.skillRanks[id('twin-assault')]=3;
  assert.equal(learnSkill(hero,id('cross-sever')),true);
  assert.equal(canLearnSkill(id('piercing-sequence'),hero).ok,false);
  hero.skillProgressionV3!.skillRanks[id('blade-rush')]=2;
  hero.skillProgressionV3!.skillRanks['v3-warrior-armor-breaker']=3;
  assert.equal(learnSkill(hero,id('piercing-sequence')),true);
  hero.skillProgressionV3!.skillRanks[id('blade-focus')]=5;
  assert.equal(learnSkill(hero,id('blade-tempest')),true);
  for(let rank=2;rank<=3;rank++)assert.equal(learnSkill(hero,id('blade-tempest')),true);
  assert.equal(learnSkill(hero,id('blade-tempest')),false);
  const reset=resetSkillPoints(hero);
  assert.equal(reset.ok,false); // No Gold in this fixture; no accidental free respec.
});

test('Cross Sever composes one combined impact and shared core exactly once', () => {
  const {hero,off}=setup(); const skill=BLADE_MASTER_V3_RUNTIME_MAP[id('cross-sever')];
  const stats=derivedStats(hero); const action=resolveHeroSkill(hero,skill,5,stats);
  assert.equal(action.hitSequence.length,1);assert.equal(action.hitSequence[0].weaponHand,'BOTH');
  assert.equal(action.hitSequence[0].physicalCoefficient,1.5);
  assert.ok((action.hitSequence[0].composedPhysicalPower??0)>0);
  const damage=skillHitDamage(action.hitSequence[0],stats);
  const replacement = createItem('legacy-fajar-blade', { id:'stronger-off',baseStats:{attack:170},equipSlot:'offHand',offHand:true,equipmentType:'one_hand_sword',weaponType:'one_hand_sword',handedness:'one_hand',twoHanded:false });
  hero.inventory.push(replacement);hero.equipment.offHand=replacement.id;
  assert.ok(Math.abs(skillHitDamage(resolveHeroSkill(hero,skill,5).hitSequence[0],derivedStats(hero))-damage-150)<1e-6);
  assert.equal(off.baseStats.attack,70);
});

test('Piercing Sequence and Tempest preserve real hits, fixed timing, hand identity and weighted shared contribution', () => {
  const {hero}=setup();
  for(const [short,rank,weights,hands,total] of [
    ['piercing-sequence',5,[.3,.3,.4],['MAIN','MAIN','MAIN'],1.55],
    ['blade-tempest',3,[.15,.15,.15,.15,.4],['MAIN','OFF','MAIN','OFF','BOTH'],2.25],
  ] as const){
    const action=resolveHeroSkill(hero,BLADE_MASTER_V3_RUNTIME_MAP[id(short)],rank);
    assert.deepEqual(action.hitSequence.map(h=>h.weaponHand),hands);
    assert.deepEqual(action.hitSequence.map(h=>h.sharedContributionWeight),weights);
    assert.equal(action.hitSequence.reduce((sum,h)=>sum+(h.sharedContributionWeight??0),0),1);
    assert.equal(action.rankValues?.[rank-1]?.physicalCoefficient,total);
    assert.ok(action.hitSequence.every(h=>(h.composedPhysicalPower??0)>0&&h.knockbackStrength===0));
    const times:number[]=[];const queue=new SkillHitQueue();queue.schedule(action.hitSequence,()=>true,hit=>times.push(hit.delay));queue.update(1);
    assert.equal(times.length,hands.length);
  }
});

test('Tempo caps at three, refreshes, expires, Drive consumes by stack count and clears on capability loss', () => {
  for(let stacks=1;stacks<=3;stacks++){
    const state=new TransientCombatState();
    for(let n=0;n<stacks+1;n++)state.gainBladeTempo(n,5);
    assert.equal(state.tempoCount(stacks),Math.min(stacks+1,3));
    const drive=state.activateBladeTempoDrive(stacks,5)!;
    assert.equal(drive.stacks,Math.min(stacks+1,3));
    assert.equal(drive.attackSpeedPercent,8+4*drive.stacks);
    assert.equal(drive.manaReductionPercent,6+4*drive.stacks);
    assert.equal(drive.expiresAt-stacks,[0,5.5,7,8.5][drive.stacks]);
    assert.equal(state.tempoCount(stacks),0);
    state.updateBladeTempo(stacks+9,true);assert.equal(state.bladeTempoDrive,null);
  }
  const state=new TransientCombatState();state.gainBladeTempo(0,5);state.gainBladeTempo(4,5);
  assert.equal(state.tempoCount(8.99),2);assert.equal(state.tempoCount(9),0);
  state.gainBladeTempo(10,5);state.activateBladeTempoDrive(10,1);state.gainBladeTempo(11,5);
  state.updateBladeTempo(11,false);assert.equal(state.tempoCount(11),0);assert.equal(state.bladeTempoDrive,null);
});

test('Impact contract preserves Flow/Tempo until first damaging hit and generates at most one stack per cast', () => {
  const {hero}=setup(),target={hp:100,sourceOwnedStatuses:{} as Record<string,import('./combat-status.ts').SourceOwnedStatus[]>};
  const state=new TransientCombatState();state.openBladeFlow(0,3);
  const twin=resolveHeroSkill(hero,BLADE_MASTER_V3_RUNTIME_MAP[id('twin-assault')],1);
  const first=new BladeMasterImpactSession(twin.skillId,state,0);
  assert.equal(first.prepare(twin.hitSequence[0],0,1,target,'A',0).criticalRate,twin.hitSequence[0].criticalRate+5);
  assert.equal(state.bladeFlowActive(0),true);assert.equal(state.tempoCount(0),0);
  first.commitDamagingImpact(0,5,true,true);
  assert.equal(state.bladeFlowActive(0),false);assert.equal(state.tempoCount(0),1);
  first.commitDamagingImpact(.18,5,true,true);assert.equal(state.tempoCount(.18),1);
  const tempest=resolveHeroSkill(hero,BLADE_MASTER_V3_RUNTIME_MAP[id('blade-tempest')],3);
  state.gainBladeTempo(.2,7);state.gainBladeTempo(.2,7);
  const ultimate=new BladeMasterImpactSession(tempest.skillId,state,.2);
  assert.equal(ultimate.tempoAtCast,3);
  ultimate.prepare(tempest.hitSequence[0],0,4,target,'A',.2);
  assert.equal(state.tempoCount(.2),3);
  ultimate.commitDamagingImpact(.2,5,true,true);
  assert.equal(state.tempoCount(.2),0);
  const final=ultimate.prepare(tempest.hitSequence[4],4,4,target,'A',.92);
  assert.equal(final.criticalRate,tempest.hitSequence[4].criticalRate+25);
  assert.equal(final.damageMultiplier,tempest.hitSequence[4].damageMultiplier*1.1);
  assert.equal(ultimate.prepare(tempest.hitSequence[0],0,4,target,'A',.2).damageMultiplier,tempest.hitSequence[0].damageMultiplier);
});

test('Mastery and Drive Mana reductions use strongest source on dual skills only', () => {
  const {hero}=setup();const stats={...derivedStats(hero),manaCostReduction:3};
  for(const short of ['twin-assault','cross-sever','blade-tempest']){
    const skill=BLADE_MASTER_V3_RUNTIME_MAP[id(short)];const rank=skill.maxLevel;
    const base=skill.rankValues![rank-1].manaCost!;
    assert.equal(resolveHeroSkill(hero,skill,rank,stats,undefined,[],undefined,18).manaCost,Math.ceil(base*.82));
  }
  const piercing=BLADE_MASTER_V3_RUNTIME_MAP[id('piercing-sequence')];
  assert.equal(resolveHeroSkill(hero,piercing,5,stats,undefined,[],undefined,18).manaCost,Math.ceil(20*.97));
});

test('Tempo Drive uses canonical rank Mana/cooldown, receives Mastery reduction, and not its own active reduction', () => {
  const {hero}=setup(); const stats={...derivedStats(hero),manaCostReduction:0};
  const drive=BLADE_MASTER_V3_RUNTIME_MAP[id('tempo-drive')];
  assert.deepEqual(drive.rankValues?.map(value=>value.manaCost),[14,15,16,17,18]);
  assert.deepEqual(drive.rankValues?.map(value=>value.cooldown),[24,23,22,21,20]);
  assert.equal(BLADE_MASTER_MASTERY_MANA_SKILLS.has(drive.id),true);
  assert.equal(BLADE_MASTER_DUAL_MANA_SKILLS.has(drive.id),false);
  assert.equal(resolveHeroSkill(hero,drive,5,stats).manaCost,Math.ceil(18*.92));
  assert.equal(resolveHeroSkill(hero,drive,5,stats,undefined,[],undefined,18).manaCost,Math.ceil(18*.92));
});

test('Armor Break source ownership is queryable independently of strongest mitigation', () => {
  const target={sourceOwnedStatuses: {} as Record<string,import('./combat-status.ts').SourceOwnedStatus[]>};
  applySourceOwnedStatus(target,'armor_break',{sourceActorId:'A',sourceSkillId:'v3-warrior-armor-breaker',strength:6,appliedAt:0,duration:10});
  applySourceOwnedStatus(target,'armor_break',{sourceActorId:'B',sourceSkillId:'v3-warrior-armor-breaker',strength:12,appliedAt:0,duration:3});
  assert.equal(effectiveArmorBreakStrength(target,1),12);
  assert.equal(hasActiveStatusFromSource(target,'armor_break','A',1),true);
  assert.equal(hasActiveStatusFromSource(target,'armor_break','B',1),true);
  assert.equal(effectiveArmorBreakStrength(target,4),6);
  assert.equal(hasActiveStatusFromSource(target,'armor_break','B',4),false);
});

test('7B hotbar rejects unlearned ranks and accepts purchased active skill references', () => {
  const {hero}=setup();
  assert.equal(assignPrimaryHotbarSlot(hero,0,id('cross-sever')).ok,false);
  hero.skillProgressionV3!.skillRanks[id('cross-sever')]=1;hero.skillLevels[id('cross-sever')]=1;
  const assigned=assignPrimaryHotbarSlot(hero,0,id('cross-sever'));
  assert.equal(assigned.ok,true);
  assert.equal(validatePrimaryHotbar(assigned.hero).primaryHotbar[0],id('cross-sever'));
  assert.equal(assignPrimaryHotbarSlot(hero,1,id('twin-blade-mastery')).ok,false);
});

test('Tempo Drive ASPD uses existing character stat modifier path and never rewrites fixed hit timing', () => {
  const {hero}=setup();const base=derivedStats(hero).attackSpeed;
  hero.combatStateModifiers=[{id:'v3-blade-master-tempo-drive-speed',stats:{percent:{attackSpeed:20}}}];
  assert.ok(Math.abs(derivedStats(hero).attackSpeed-base*1.2)<1e-6);
  const before=resolveHeroSkill(hero,BLADE_MASTER_V3_RUNTIME_MAP[id('blade-tempest')],3).hitSequence.map(h=>h.delay);
  delete hero.combatStateModifiers;
  const after=resolveHeroSkill(hero,BLADE_MASTER_V3_RUNTIME_MAP[id('blade-tempest')],3).hitSequence.map(h=>h.delay);
  assert.deepEqual(before,after);
});

test('Lv75/80 controlled damage sanity matrix does not duplicate weapon or stat layers', () => {
  const matrix=[];
  for(const level of [75,80]){
    const {hero}=setup(level),stats=derivedStats(hero);
    const power=(short:string,rank:number,flow=false,tempo=false,armor=false)=>{
      const action=resolveHeroSkill(hero,BLADE_MASTER_V3_RUNTIME_MAP[id(short)],rank,stats);
      return Math.round(action.hitSequence.reduce((sum,hit,index)=>{
        const last=index===action.hitSequence.length-1;
        const crit=criticalChance(hit.criticalRate+(flow?5:0)+(armor&&short==='piercing-sequence'&&last?10:0)+(tempo&&short==='blade-tempest'&&last?25:0));
        const raw=Math.round(skillHitDamage(hit,stats)*(tempo&&short==='blade-tempest'&&last?1.1:1));
        return sum+mitigateDamage(raw,100*(armor?.91:1),level)*(1+crit*(hit.criticalDamage/100-1));
      },0)*100)/100;
    };
    const berserker=createV3AdventurerHero();berserker.level=level;berserker.skillProgressionV3!.totalEarnedSP=500;chooseV3Warrior(berserker);chooseV3Berserker(berserker);
    const two=createItem('legacy-fajar-blade',{id:`two-${level}`,baseStats:{attack:170},equipSlot:'mainHand',mainHand:true,equipmentType:'two_hand_sword',weaponType:'two_hand_sword',handedness:'two_hand',twoHanded:true});
    berserker.inventory.push(two);berserker.equipment.mainHand=two.id;
    const berserkerStats=derivedStats(berserker);
    const berserkerPower=(name:string,rank:number)=>resolveHeroSkill(berserker,BERSERKER_V3_RUNTIME_MAP[`v3-berserker-${name}`],rank,berserkerStats).hitSequence.reduce((sum,hit)=>sum+mitigateDamage(Math.round(skillHitDamage(hit,berserkerStats)),100,level),0);
    matrix.push({level,dualBasicMain:stats.physicalAttack-70,dualBasicOff:stats.physicalAttack-100,twinAssault:power('twin-assault',level===75?6:8),crossSever:power('cross-sever',level===75?3:5),piercingSequence:power('piercing-sequence',level===75?3:5),piercingOwnArmorBreak:power('piercing-sequence',level===75?3:5,false,false,true),counterflow:power('counterflow',level===75?4:5),tempestNormal:power('blade-tempest',level===75?1:3),tempestFlow:power('blade-tempest',level===75?1:3,true),tempestThreeTempo:power('blade-tempest',level===75?1:3,false,true),tempestFlowThreeTempo:power('blade-tempest',level===75?1:3,true,true),berserkerCrushingBlow:berserkerPower('crushing-blow',level===75?4:5),berserkerEarthSplitter:berserkerPower('earth-splitter',level===75?3:5)});
  }
  console.log('BLADE_MASTER_7B_SANITY_MATRIX',JSON.stringify(matrix));
  assert.equal(matrix.length,2);
  assert.ok(matrix.every(entry=>entry.tempestThreeTempo>entry.tempestNormal&&entry.tempestFlowThreeTempo>entry.tempestThreeTempo));
});
