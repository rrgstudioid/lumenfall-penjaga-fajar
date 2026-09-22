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
