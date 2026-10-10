import { AssasinPoisonState, canApplyAssasinPoison, type PoisonActor, type PoisonSnapshot, type AssasinPoisonProfile } from './assasin-poison.ts';
import { ECLIPSE_DURATION, ECLIPSE_TICK_INTERVAL, ECLIPSE_PROFILES, ECLIPSE_STACK_MULTIPLIERS, EXECUTION_HP_THRESHOLD, EXECUTION_PAYOFF, type AssasinSkillConfig } from './assasin-v3.ts';

type Target = { hp: number; max: number };
type EclipseRecord = { casterId:string; targetId:string; rank:number; expiresAt:number; nextTickAt:number; ticks:number;
  multiplier:number; snapshot:PoisonSnapshot };
export type EclipseTick = { rawDamage:number; snapshot:PoisonSnapshot; damageKind:'dot'; canCrit:false; casterId:string };
const owner = (actor:PoisonActor) => actor.characterId ?? actor.slotId;

/** All Assasin-specific state stays out of Hero/save. The existing normal Poison
 * store remains the sole authority for its stacks, cadence and strongest Slow. */
export class AssasinCombatState<T extends Target> {
  private eclipses = new WeakMap<T,Map<string,EclipseRecord>>();
  constructor(readonly poison:AssasinPoisonState<T>, private dealTick:(target:T,tick:EclipseTick)=>void, private rng:()=>number=Math.random) {}
  clear() { this.eclipses=new WeakMap(); }
  clearTarget(target:T) { this.eclipses.delete(target); }
  hasPending(target:T) { return !!this.eclipses.get(target)?.size; }
  requirement(actor:PoisonActor, config:AssasinSkillConfig, target:T|undefined, now:number) {
    if (!canApplyAssasinPoison(actor)) return {ok:false,reason:'Assasin required.'};
    if (config.execution && (!target || target.hp<=0 || target.max<=0 || target.hp>target.max*EXECUTION_HP_THRESHOLD || this.poison.getPoisonStacks(owner(actor),target,now)<1))
      return {ok:false,reason:'Requires target HP ≤30% and your normal Poison.'};
    return {ok:true,reason:''};
  }
  executionMultiplier(actor:PoisonActor,target:T,now:number) {
    const stacks=this.poison.getPoisonStacks(owner(actor),target,now);
    return 1+(stacks>0 ? EXECUTION_PAYOFF[stacks-1] ?? 0 : 0);
  }
  beginExecution(actor:PoisonActor,skillId:string,config:AssasinSkillConfig,rank:number,
    potency:()=>{profile:AssasinPoisonProfile|undefined;snapshot:PoisonSnapshot}) {
    const casterId=owner(actor),seen=new Set<string>(); let applications=0;
    return { commitDamage:(current:PoisonActor,target:T,targetId:string,impact:number,damage:number,now:number)=>{
      if (!canApplyAssasinPoison(current) || owner(current)!==casterId || !(damage>0) || !Number.isInteger(impact) || impact<0 || !Number.isFinite(now)) return false;
      const key=JSON.stringify([targetId,impact]); if (seen.has(key)) return false;
      seen.add(key);
      if (config.execution) { this.poison.consumePoisonStacks(casterId,target,'all',now); return true; }
      if (target.hp<=0) return false;
      // Re-read current mastery/stats at successful application, not the old
      // skill's rank or an obsolete projectile profile.
      const currentPotency=potency();
      if (config.eclipse) {
        this.advanceTarget(target,now); this.poison.advanceTarget(target,now);
        if (target.hp<=0) return false;
        const stacks=this.poison.getPoisonStacks(casterId,target,now);
        let records=this.eclipses.get(target); if (!records) { records=new Map(); this.eclipses.set(target,records); }
        records.set(casterId,{casterId,targetId,rank,expiresAt:now+ECLIPSE_DURATION,nextTickAt:now+ECLIPSE_TICK_INTERVAL,ticks:0,
          multiplier:ECLIPSE_STACK_MULTIPLIERS[stacks],snapshot:{...currentPotency.snapshot}});
        if (stacks>0) this.poison.refreshPoison(current,target,now,{duration:ECLIPSE_DURATION});
        return true;
      }
      if (!config.normalPoison || applications >= (config.maxPoisonStacksGrantedPerExecution ?? 0) || !currentPotency.profile) return false;
      this.poison.advanceTarget(target,now);
      const existing=this.poison.getPoisonStacks(casterId,target,now);
      const source={targetActorId:targetId,sourceSkillId:skillId,profile:currentPotency.profile,snapshot:currentPotency.snapshot,successfulDamage:damage};
      const applied=config.normalPoison==='REFRESH_OR_APPLY' && existing>0
        ? this.poison.refreshPoison(current,target,now,{profile:source.profile,snapshot:source.snapshot})
        : this.poison.applyPoisonStack(current,target,source,now);
      if (!applied) return false;
      applications++;
      if (config.crippling) {
        const bonus=config.crippling.bonusPPByRank[rank-1];
        this.poison.setCripplingSlow(current,target,{sourceSkillId:skillId,pveBonusPP:bonus,pvpBonusPP:bonus,duration:config.crippling.duration},now);
      }
      return true;
    }};
  }
  advanceTarget(target:T,now:number) {
    if (!Number.isFinite(now)) return;
    if (target.hp<=0) { this.clearTarget(target); return; }
    const records=this.eclipses.get(target); if (!records) return;
    for (;;) {
      const due=[...records.values()].filter(r=>r.ticks<10 && r.nextTickAt<=now && r.nextTickAt<=r.expiresAt)
        .sort((a,b)=>a.nextTickAt-b.nextTickAt || a.casterId.localeCompare(b.casterId))[0];
      if (!due) break;
      due.ticks++; due.nextTickAt+=ECLIPSE_TICK_INTERVAL;
      const p=ECLIPSE_PROFILES[due.rank-1]; if (!p) { records.delete(due.casterId); continue; }
      const roll=p.min+(p.max-p.min)*Math.max(0,Math.min(1,this.rng()));
      const rawDamage=(roll*10+due.snapshot.physicalAttack*p.physical+Math.max(0,due.snapshot.effectiveDex-15)*p.dex)*
        (1+.05*(due.rank-1))*due.multiplier;
      this.dealTick(target,{rawDamage,snapshot:{...due.snapshot},damageKind:'dot',canCrit:false,casterId:due.casterId});
      if (target.hp<=0) { this.clearTarget(target); return; }
      if (this.eclipses.get(target)!==records) return;
    }
    for (const [id,record] of records) if (record.expiresAt<=now || record.ticks>=10) records.delete(id);
    if (!records.size) this.clearTarget(target);
  }
  presentation(target:T,viewerId:string,now:number) {
    const record=this.eclipses.get(target)?.get(viewerId);
    return target.hp>0 && record && record.expiresAt>now ? {label:'Your Venom Eclipse',remaining:record.expiresAt-now} : null;
  }
}
