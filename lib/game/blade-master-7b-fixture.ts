import { createItem } from './items.ts';
import { chooseV3BladeMaster, chooseV3Warrior, createV3AdventurerHero, derivedStats, resolveHeroSkill, mitigateDamage } from './rules.ts';
import { BLADE_MASTER_V3_RUNTIME_MAP, BLADE_MASTER_TEMPO_LIFETIME } from './blade-master-v3.ts';
import { TransientCombatState } from './combat-transient.ts';
import { SkillHitQueue, skillHitDamage } from './skill-action.ts';
import { applySourceOwnedStatus, effectiveArmorBreakStrength } from './combat-status.ts';
import { resolveTargetHit } from './combat-modifiers.ts';
import { criticalChance } from './combat-mechanics.ts';
import { BladeMasterImpactSession } from './blade-master-impact.ts';

/** World-free browser simulation: real SPV3 actor, item layers, CFV3 resolver,
 * source-owned statuses, hit queue and combat transience; no sampled/mocked damage. */
export class BladeMaster7BFixture {
  run() {
    const hero=createV3AdventurerHero('blade-master-7b-fixture','Blade Master 7B Fixture');
    hero.level=80;hero.skillProgressionV3!.totalEarnedSP=500;
    if(!chooseV3Warrior(hero)||!chooseV3BladeMaster(hero))throw new Error('Specialization transition failed');
    hero.skillProgressionV3!.skillRanks={
      'v3-blade-master-twin-blade-mastery':5,'v3-blade-master-twin-assault':8,'v3-blade-master-cross-sever':5,
      'v3-blade-master-piercing-sequence':5,'v3-blade-master-tempo-drive':5,'v3-blade-master-blade-tempest':3,
    };
    const sword=(name:string,atk:number)=>createItem('legacy-fajar-blade',{id:name,baseStats:{attack:atk},equipSlot:'mainHand',mainHand:true,equipmentType:'one_hand_sword',weaponType:'one_hand_sword',handedness:'one_hand',twoHanded:false});
    const main=sword('7b-main',100),off=sword('7b-off',70);
    hero.inventory.push(main,off);hero.equipment.mainHand=main.id;hero.equipment.offHand=off.id;
    const stats=derivedStats(hero),core=stats.physicalAttack-170;
    const target={hp:10000,defense:100,sourceOwnedStatuses:{} as Record<string,import('./combat-status.ts').SourceOwnedStatus[]>};
    const action=(name:string,rank:number)=>resolveHeroSkill(hero,BLADE_MASTER_V3_RUNTIME_MAP[`v3-blade-master-${name}`],rank,stats);
    const impact=(name:string,rank:number,opts:{flow?:boolean;tempo?:number;armorSource?:string}={})=>{
      const skill=action(name,rank),initial=target.hp,queue=new SkillHitQueue(),log:Array<{hand:string;coefficient:number;composedPower:number;critRate:number;damage:number;delay:number}>=[];
      const state=new TransientCombatState();
      if(opts.flow)state.openBladeFlow(1,3);
      for(let n=0;n<(opts.tempo??0);n++)state.gainBladeTempo(1,7);
      const session=new BladeMasterImpactSession(skill.skillId,state,1);
      const tempoBeforeImpact=state.tempoCount(1),flowBeforeImpact=state.bladeFlowActive(1);
      queue.schedule(skill.hitSequence,()=>target.hp>0,hit=>{
        const resolved=session.prepare(resolveTargetHit(hit,[],target,1),skill.hitSequence.indexOf(hit),skill.hitSequence.length-1,target,'A',1);
        const critRate=resolved.criticalRate;
        const deterministicRng=1; // no random crit; crit chance is still resolved per hit.
        const raw=skillHitDamage(resolved,stats)*(resolved.canCrit&&deterministicRng<criticalChance(critRate)?resolved.criticalDamage/100:1);
        const reduction=effectiveArmorBreakStrength(target,1);
        const effectiveDefense=target.defense*(1-reduction/100);
        const damage=Math.round(mitigateDamage(raw,effectiveDefense,hero.level));
        target.hp-=damage;
        log.push({hand:hit.weaponHand??'MAIN',coefficient:hit.physicalCoefficient,composedPower:hit.composedPhysicalPower??0,critRate,damage,delay:hit.delay});
        if(damage>0)session.commitDamagingImpact(1,5,true,true);
      });
      queue.update(2);
      return {hpBefore:initial,hpAfter:target.hp,damage:initial-target.hp,hits:log,sharedWeights:skill.hitSequence.map(h=>h.sharedContributionWeight),mana:skill.manaCost,tempoBeforeImpact,tempoAfterImpact:state.tempoCount(1),flowBeforeImpact,flowAfterImpact:state.bladeFlowActive(1)};
    };
    const cross=impact('cross-sever',5);
    applySourceOwnedStatus(target,'armor_break',{sourceActorId:'B',sourceSkillId:'v3-warrior-armor-breaker',strength:12,appliedAt:0,duration:8});
    const piercingOther=impact('piercing-sequence',5,{armorSource:'B'});
    applySourceOwnedStatus(target,'armor_break',{sourceActorId:'A',sourceSkillId:'v3-warrior-armor-breaker',strength:6,appliedAt:0,duration:8});
    const piercingOwn=impact('piercing-sequence',5,{armorSource:'A'});
    const piercingFlow=impact('piercing-sequence',5,{flow:true,armorSource:'A'});
    const tempo=new TransientCombatState(),tempoLog:number[]=[];
    for(let n=0;n<4;n++)tempoLog.push(tempo.gainBladeTempo(n,BLADE_MASTER_TEMPO_LIFETIME[4]));
    const drives=[1,2,3].map(stacks=>{const state=new TransientCombatState();for(let n=0;n<stacks;n++)state.gainBladeTempo(1,7);return state.activateBladeTempoDrive(1,5);});
    const tempest=impact('blade-tempest',3),tempestEnhanced=impact('blade-tempest',3,{tempo:3}),tempestFlow=impact('blade-tempest',3,{flow:true,tempo:3});
    const result={status:'PASS',worldImported:false,mapLoaded:false,exactSkillCount:Object.keys(BLADE_MASTER_V3_RUNTIME_MAP).length,
      sharedCore:core,mainWeaponAttack:100,offWeaponAttack:70,cross,piercingOther,piercingOwn,piercingFlow,
      tempoLog,tempoExpiry:tempo.bladeTempo?.expiresAt,drives,tempest,tempestEnhanced,tempestFlow,
      noWorldOrFlaris:true};
    if(cross.hits.length!==1||piercingOwn.hits.length!==3||tempest.hits.length!==5||tempoLog.join()!=='1,2,3,3'||cross.hpAfter>=cross.hpBefore)throw new Error('7B fixture result invalid');
    return result;
  }
}
