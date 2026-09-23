/** Production combat math, shared by the world and its CP benchmark. */
export type DamageType = 'physical' | 'magic';
export const COMBAT_MECHANICS = Object.freeze({
  criticalChanceCap: .8,
  evasionChanceCap: .5,
  blockChanceCap: .5,
  blockDamageReduction: .3,
  armorBreakDefenseMultiplier: .8,
  comboFinisherDamage: 1.65,
  comboFinisherDelay: .22,
  poisonInterval: .6,
  poisonAttackCoefficient: .08,
  poisonMinimumDamage: 2,
});
export const barrierAmount = (maxHP: number) => 35 + maxHP * .18;
export function mitigateDamage(rawDamage: number, defense: number, attackerLevel: number, penetration = 0) {
  const effectiveDefense = Math.max(0, defense * (1 - Math.max(0, penetration) / 100));
  const reduction = effectiveDefense / (effectiveDefense + 500 + Math.max(1, attackerLevel) * 10);
  return Math.max(0, rawDamage * (1 - reduction));
}
export const criticalChance = (rate: number) => Math.min(COMBAT_MECHANICS.criticalChanceCap, rate / 100);
export const evasionChance = (rate: number) => Math.min(COMBAT_MECHANICS.evasionChanceCap, rate / 100);
export const blockChance = (rate: number) => Math.min(COMBAT_MECHANICS.blockChanceCap, rate / 100);

export type HitResolutionResult = 'HIT' | 'EVADED';
export type HitAgainstEvasion = {
  attackerAccuracy: number;
  targetEvasion: number;
  accuracyPressure: number;
  effectiveEvasion: number;
  hitChance: number;
  roll: number;
  result: HitResolutionResult;
};

/** Model B: Accuracy directly counters Evasion with one avoidance roll. */
export function resolveHitAgainstEvasion({
  attackerAccuracy,
  targetEvasion,
  rng = Math.random,
}: {
  attackerAccuracy: number;
  targetEvasion: number;
  rng?: () => number;
}): HitAgainstEvasion {
  const accuracy = Number.isFinite(attackerAccuracy) ? attackerAccuracy : 90;
  const evasion = Number.isFinite(targetEvasion) ? Math.max(0, targetEvasion) : 0;
  const accuracyPressure = (accuracy - 90) * 0.1;
  const effectiveEvasion = Math.min(50, Math.max(0, evasion - accuracyPressure));
  const hitChance = 1 - effectiveEvasion / 100;
  const rawRoll = rng();
  const roll = Number.isFinite(rawRoll) ? Math.min(1, Math.max(0, rawRoll)) : 1;
  return {
    attackerAccuracy: accuracy,
    targetEvasion: evasion,
    accuracyPressure,
    effectiveEvasion,
    hitChance,
    roll,
    result: roll < hitChance ? 'HIT' : 'EVADED',
  };
}
