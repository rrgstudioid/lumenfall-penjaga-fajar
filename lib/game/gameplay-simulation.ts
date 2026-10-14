import { skillFamilyDefinitions } from './skill-family-runtime.ts';
import { activeSkills, basicAttackPower, combatProfile, derivedStats, isSkillUnlocked, resolveHeroSkill, type Hero } from './rules.ts';
import { resolveCombatDamage, resolveCombatHit, resolveCriticalDamage, type DamagePolicy } from './combat-resolver.ts';
import { skillHitDamage } from './skill-action.ts';
import type { MonsterDefinition } from './regions.ts';
import { BALANCE_TARGETS } from './canonical-config.ts';
import { COMBAT_MECHANICS, blockChance } from './combat-mechanics.ts';
import { resolveDefenseMultiplier } from './shared-effects.ts';
import { AssasinPoisonState } from './assasin-poison.ts';
import { AssasinCombatState } from './assasin-combat.ts';
import { VENOM_PROFILES, venomMasteryRank } from './assasin-v3.ts';
import { resolveWeaponAttackContext } from './dual-wield.ts';
export function seededCombatRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
export type SimulationScenario = { id: string; incoming: boolean; movementCycle: number; movementSeconds: number; damageWindow?: boolean };
export const SIMULATION_SCENARIOS: readonly SimulationScenario[] = [
  {id:'stationary-output',incoming:false,movementCycle:8,movementSeconds:0},
  {id:'survival-scripted-75pct-uptime',incoming:true,movementCycle:8,movementSeconds:2},
  {id:'stationary-120s-sustain',incoming:false,movementCycle:8,movementSeconds:0,damageWindow:true},
  {id:'survival-120s-window',incoming:true,movementCycle:8,movementSeconds:2,damageWindow:true},
];
/** A bounded single-target model, NOT the world/AI renderer. Scenario movement
 * is an explicit sensitivity assumption, never a live rule or measured uptime. */
export function simulatePvE(hero: Hero, target: MonsterDefinition, rotation: readonly string[], seed: number, maxSeconds = 300,
  scenario: SimulationScenario = SIMULATION_SCENARIOS[0]) {
  const actor = structuredClone(hero), stats = derivedStats(actor), rng = seededCombatRandom(seed);
  const skills = activeSkills(actor);
  if (rotation.some(id => skillFamilyDefinitions[id]?.skillType!=='ACTIVE_DAMAGE' || !skills.some(s => s.id === id && isSkillUnlocked(actor, s)))) throw new Error('Unlearned rotation skill');
  const enemy={hp:target.maxHP,max:target.maxHP}; actor.hp=stats.maxHP;
  let mana=stats.maxMana,totalDamage=0,rawDamageTotal=0,overkill=0,casts=0,nextBasic=0,lockedUntil=0,combo=0,lastBasic=-Infinity;
  let burstDamage=0;
  let elapsed=0,activeSeconds=0,manaSpent=0,manaRegenerated=0,incomingDamage=0,nextEnemy=1.1,basicAttacks=0,poisonDamage=0;
  let nextHand:'MAIN'|'OFF'='MAIN';
  const ready: Record<string, number> = {};
  const timeline:Array<{time:number;skill:string;rank:number;manaCost:number;cooldown:number;lock:number}>=[];
  const pending:Array<{at:number;order:number;run:()=>void}>=[]; let order=0;
  const dt=.05;
  const damage=(rawDamage:number,damageType:'physical'|'magic',dot=false)=>{
    if(enemy.hp<=0)return 0;
    const n=resolveCombatDamage({rawDamage,damageType,attackerLevel:actor.level,physicalDefense:target.defense,
      magicDefense:target.magicDefense,physicalPenetration:stats.physicalPenetration,magicPenetration:stats.magicPenetration,
      targetBonusPercent:stats.bossDamage});
    const effective=scenario.damageWindow?n:Math.min(enemy.hp,n); rawDamageTotal+=rawDamage; totalDamage+=effective;if(elapsed<10)burstDamage+=effective;overkill+=n-effective;
    if(dot)poisonDamage+=effective;if(!scenario.damageWindow)enemy.hp-=effective;return effective;
  };
  const snapshot=()=>({physicalAttack:stats.physicalAttack,effectiveDex:stats.dex,level:actor.level,
    physicalPenetration:stats.physicalPenetration,bossDamage:stats.bossDamage,eliteDamage:stats.eliteDamage,
    criticalRate:stats.criticalRate,criticalDamage:stats.criticalDamage});
  const dotSink=(_:typeof enemy,tick:{rawDamage:number;snapshot:ReturnType<typeof snapshot>} & DamagePolicy)=>
    damage(resolveCriticalDamage(tick.rawDamage,{...tick,...tick.snapshot},rng),'physical',true);
  const poison=new AssasinPoisonState<typeof enemy>((e,t)=>dotSink(e,{...t,snapshot:{...snapshot(),...t.snapshot}}),rng);
  const assassin=new AssasinCombatState(poison,(e,t)=>dotSink(e,{...t,snapshot:{...snapshot(),...t.snapshot}}),rng);
  const main=actor.inventory.find(i=>i.id===actor.equipment.mainHand)??null;
  const off=actor.inventory.find(i=>i.id===actor.equipment.offHand)??null;
  const dual=!!main&&!!off&&off.category==='weapon';
  const weaponContext=resolveWeaponAttackContext(main,off);
  for(let step=0;step<=Math.floor(maxSeconds/dt);step++){
    const time=step*dt;elapsed=time;
    // Poison catches up on its own target clock and remains distinct from direct hits.
    poison.advanceTarget(enemy,time);assassin.advanceTarget(enemy,time);
    pending.sort((a,b)=>a.at-b.at||a.order-b.order);
    while(pending.length&&pending[0].at<=time&&enemy.hp>0)pending.shift()!.run();
    if(enemy.hp<=0)return result(time,'defeated');
    if(step>0){const regen=Math.min(stats.maxMana-mana,stats.manaRecovery*dt);mana+=regen;manaRegenerated+=regen;}
    const moving=scenario.movementSeconds>0&&time%scenario.movementCycle>=scenario.movementCycle-scenario.movementSeconds;
    if(!moving&&step>0)activeSeconds+=dt;
    if(scenario.incoming&&time>=nextEnemy){
      nextEnemy=time+3.3; // world boss: 1.1 s windup + 2.2 s recovery, when in range.
      if(!moving&&resolveCombatHit({damageType:'physical',accuracy:COMBAT_MECHANICS.accuracyBase},stats.evasion,rng).result==='HIT'){
        const amount=resolveCombatDamage({rawDamage:target.attack,damageType:'physical',attackerLevel:target.level,
          physicalDefense:stats.physicalDefense,magicDefense:stats.magicDefense})*
          resolveDefenseMultiplier({damageReduction:stats.damageReduction,blocked:rng()<blockChance(stats.blockRate)});
        incomingDamage+=Math.min(actor.hp,amount);actor.hp=Math.max(0,actor.hp-amount);
        if(actor.hp<=0)return result(null,'actor-dead');
      }
    }
    if(moving||time<lockedUntil)continue;
    let cast=false;
    for(const id of rotation){
      if((ready[id]??0)>time)continue;
      const skill=skills.find(s=>s.id===id)!;
      if(skill.assasin&&!assassin.requirement(actor,skill.assasin,enemy,time).ok)continue;
      const rank=actor.skillLevels[id];
      // Deterministic preview must not consume combat RNG on rejected casts.
      const preview=resolveHeroSkill(actor,skill,rank,stats,undefined,[],undefined,0,()=>.5);
      if(!preview.weaponAllowed||mana<preview.manaCost)continue;
      const action=resolveHeroSkill(actor,skill,rank,stats,undefined,[],undefined,0,rng);
      casts++;mana-=action.manaCost;manaSpent+=action.manaCost;ready[id]=time+Math.max(dt,action.cooldown);
      lockedUntil=time+(action.actionLockDuration??0);cast=true;
      timeline.push({time,skill:id,rank,manaCost:action.manaCost,cooldown:action.cooldown,lock:action.actionLockDuration??0});
      const execution=action.assasin?assassin.beginExecution(actor,id,action.assasin,rank,()=>({profile:VENOM_PROFILES[venomMasteryRank(actor)-1],snapshot:snapshot()})):undefined;
      action.hitSequence.forEach((hit,index)=>pending.push({at:time+hit.delay,order:order++,run:()=>{
        if(resolveCombatHit(hit,0,rng).result!=='HIT')return;
        const effective=damage(resolveCriticalDamage(skillHitDamage(hit,stats),hit,rng),hit.damageType);
        execution?.commitDamage(actor,enemy,target.id,index,effective,elapsed);
      }}));
      break;
    }
    // One input action per simulation step, respecting the same declared action locks.
    if(cast||time<nextBasic)continue;
    combo=time-lastBasic<1.1?combo%3+1:1;lastBasic=time;basicAttacks++;
    let raw=basicAttackPower(actor,nextHand);
    if(dual&&main?.equipmentType==='one_hand_sword')raw=stats.physicalAttack-weaponContext.mainHandWeaponAttack-weaponContext.offHandWeaponAttack+
      (nextHand==='MAIN'?weaponContext.mainHandWeaponAttack:weaponContext.offHandWeaponAttack);
    if(dual)nextHand=nextHand==='MAIN'?'OFF':'MAIN';
    if(combo===3)raw*=COMBAT_MECHANICS.comboFinisherDamage;
    if(resolveCombatHit({damageType:'physical',accuracy:stats.accuracy},0,rng).result==='HIT')
      damage(resolveCriticalDamage(raw,{damageType:'physical',canCrit:true,criticalRate:stats.criticalRate,criticalDamage:stats.criticalDamage},rng),'physical');
    nextBasic=time+(combatProfile(actor).cooldown+(combo===3?COMBAT_MECHANICS.comboFinisherDelay:0))/(stats.attackSpeed/100);
    if(enemy.hp<=0)return result(time,'defeated');
  }
  return result(null,scenario.damageWindow?'window-complete':'timeout');
  function result(ttk:number|null,outcome:string){return {seed,scenario:scenario.id,mode:scenario.damageWindow?'nonlethal-damage-window':'encounter',level:actor.level,target:target.id,targetHP:target.maxHP,targetLevel:target.level,targetDefense:target.defense,targetMagicDefense:target.magicDefense,
    job:actor.job,specialization:actor.specialization,stats,equipmentItems:actor.inventory.filter(i=>Object.values(actor.equipment).includes(i.id)),
    movement:{cycle:scenario.movementCycle,seconds:scenario.movementSeconds,model:'scripted contact loss'},
    burst10sDPS:burstDamage/Math.min(10,Math.max(.05,elapsed)),sustainedAfter10sDPS:elapsed>10?(totalDamage-burstDamage)/(elapsed-10):null,
    rotation:[...rotation],allocatedStats:actor.allocatedStats,equipment:actor.equipment,ranks:actor.skillProgressionV3?.skillRanks,
    ttk,elapsed,outcome,targetSeconds:BALANCE_TARGETS.fieldBossSeconds,dps:elapsed>0?totalDamage/elapsed:0,
    casts,basicAttacks,manaSpent,manaRegenerated,remainingMana:mana,totalDamage,rawDamageTotal,overkill,poisonDamage,
    incomingDamage,remainingHP:actor.hp,actualUptime:elapsed>0?Math.min(1,activeSeconds/elapsed):0,maxSeconds,timeline,
    limitations:['Selected direct-damage rotations, passive stats and Assassin Poison/Eclipse; no active buffs, Flow/Tempo, Berserker transients, Rogue Ambush, general statuses or defensive skills',
      'Scripted movement is sensitivity input, no collision, distance, projectile travel, terrain, AI pursuit, enrage or reset; pending hits assume contact',
      'Boss evasion absent from registry: zero as world default. Incoming uses world 1.1+2.2 cadence, mitigation/evasion/block only; no full hurtHero modifier/barrier path',
      'No potions, HP regeneration, consumables or unlimited mana. 50ms input grid; not a browser timing measurement; live HP tuning is not justified']};}
}
