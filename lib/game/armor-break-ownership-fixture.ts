import { applySourceOwnedStatus, clearExpiredSourceStatuses, effectiveArmorBreakStrength, getActiveStatusApplications, hasActiveStatusFromSource } from './combat-status.ts';
import { resolveTargetHit, type CombatModifier } from './combat-modifiers.ts';
import { ARMOR_BREAK_REDUCTION_BY_RANK } from './warrior-v3.ts';

const hit = () => ({ delay: 0, baseDamage: 100, physicalCoefficient: 0, magicCoefficient: 0, skillPowerCoefficient: 0, knockbackStrength: 0, damageMultiplier: 1, damageType: 'physical' as const, canCrit: false, criticalRate: 0, criticalDamage: 150, accuracy: 0, statuses: [], scopedComposition: { base: { damageMultiplier: 1, knockbackStrength: 1 }, normal: { damageMultiplier: 0, knockbackStrength: 0 }, payoff: { damageMultiplier: 1, knockbackStrength: 1 } } });
const payoff = (id: string, percent: number): CombatModifier => ({ id, layer: 'payoff', payoffGroup: id, condition: { targetStatusesFromSource: ['armor_break'] }, action: { damagePercent: percent } });

export class ArmorBreakOwnershipFixture {
  readonly target = { statusEffects: {}, sourceOwnedStatuses: {} };
  readonly trace: Array<Record<string, unknown>> = [];
  time = 0;
  apply(actor: string, strength: number, duration: number) {
    applySourceOwnedStatus(this.target, 'armor_break', { sourceActorId: actor, sourceSkillId: 'v3-warrior-armor-breaker', strength, appliedAt: this.time, duration });
    this.trace.push({ stage: 'armor_break_applied', actor, strength, duration, time: this.time });
  }
  attack(actor: string, skillId: 'crushing-finale' | 'ruinous-arc', percent: number) {
    const resolved = resolveTargetHit(hit(), [payoff(skillId, percent)], this.target, this.time, { source: { sourceActorId: actor, sourceGeneration: 1 }, now: this.time });
    const payoffApplied = resolved.damageMultiplier > 1;
    this.trace.push({ stage: 'payoff_evaluated', actor, skillId, payoffApplied, damageMultiplier: resolved.damageMultiplier, time: this.time });
    return { actor, skillId, payoffApplied, damageMultiplier: resolved.damageMultiplier };
  }
  advance(seconds: number) {
    this.time += seconds;
    clearExpiredSourceStatuses(this.target, this.time);
    return { time: this.time, effectiveReduction: effectiveArmorBreakStrength(this.target, this.time), active: getActiveStatusApplications(this.target, 'armor_break', this.time) };
  }
  run() {
    this.apply('A', ARMOR_BREAK_REDUCTION_BY_RANK[0], 10);
    const aFinale = this.attack('A', 'crushing-finale', 10);
    const bFinale = this.attack('B', 'crushing-finale', 10);
    const aRuinous = this.attack('A', 'ruinous-arc', 8);
    const bRuinous = this.attack('B', 'ruinous-arc', 8);
    this.apply('B', ARMOR_BREAK_REDUCTION_BY_RANK[4], 5);
    const strongest = this.advance(0);
    const afterB = this.advance(5);
    this.apply('A', ARMOR_BREAK_REDUCTION_BY_RANK[2], 8);
    const refreshed = this.advance(0);
    const afterAll = this.advance(9);
    return { actorA: 'A', actorB: 'B', target: 'target-1', aFinale, bFinale, aRuinous, bRuinous, strongest, afterB, refreshed, afterAll, recordsAfterRefresh: getActiveStatusApplications(this.target, 'armor_break', this.time), trace: this.trace };
  }
}
