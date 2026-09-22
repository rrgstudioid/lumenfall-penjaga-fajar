import type { ResolvedSkillHit } from './skill-action.ts';
import type { StatusTarget } from './combat-status.ts';
import { hasActiveStatusFromSource } from './combat-status.ts';
import type { TransientCombatState } from './combat-transient.ts';
import { BLADE_MASTER_FLOW_CONSUMERS, BLADE_MASTER_TEMPO_GENERATORS, BLADE_MASTER_TEMPO_LIFETIME } from './blade-master-v3.ts';

/** Per-cast impact state. The world and the clean browser fixture use this same
 * first-damaging-impact contract; pressing a hotkey never consumes Flow/Tempo. */
export class BladeMasterImpactSession {
  readonly tempoAtCast: number;
  readonly skillId: string;
  private state: TransientCombatState;
  private firstDamagingImpact = false;
  private flow = false;
  private ownArmorBreak = false;
  constructor(skillId: string, state: TransientCombatState, now: number) {
    this.skillId = skillId;
    this.state = state;
    this.tempoAtCast = skillId === 'v3-blade-master-blade-tempest' ? state.tempoCount(now) : 0;
  }
  prepare(hit: ResolvedSkillHit, index: number, lastIndex: number, target: StatusTarget, sourceActorId: string, now: number) {
    if (!this.firstDamagingImpact) {
      this.flow = BLADE_MASTER_FLOW_CONSUMERS.has(this.skillId) && this.state.bladeFlowActive(now);
      this.ownArmorBreak = this.skillId === 'v3-blade-master-piercing-sequence' && hasActiveStatusFromSource(target,'armor_break',sourceActorId,now);
    }
    const result={...hit};
    if(this.flow)result.criticalRate+=5;
    if(this.ownArmorBreak){result.accuracy+=10;if(index===lastIndex)result.criticalRate+=10;}
    if(this.skillId==='v3-blade-master-blade-tempest'&&this.tempoAtCast===3&&index===lastIndex){
      result.criticalRate+=25;
      result.damageMultiplier*=1.1;
    }
    return result;
  }
  commitDamagingImpact(now: number, masteryRank: number, tempoEnabled: boolean, dualActive: boolean) {
    if(this.firstDamagingImpact)return;
    this.firstDamagingImpact=true;
    if(this.flow)this.state.consumeBladeFlow(now);
    if(this.skillId==='v3-blade-master-blade-tempest'&&this.tempoAtCast===3)this.state.consumeBladeTempo(now);
    if(BLADE_MASTER_TEMPO_GENERATORS.has(this.skillId)&&tempoEnabled&&dualActive&&masteryRank>=1){
      this.state.gainBladeTempo(now,BLADE_MASTER_TEMPO_LIFETIME[Math.min(4,masteryRank-1)]);
    }
  }
}
