import { criticalChance, mitigateDamage, resolveHitAgainstEvasion, type DamageType } from './combat-mechanics.ts';

export type DamagePolicy = { damageType: DamageType; damageKind?: 'direct' | 'dot';
  canCrit?: boolean; critException?: 'assassin_skill_poison'; criticalRate?: number; criticalDamage?: number };
export function canDamageCrit(policy: DamagePolicy) {
  return policy.damageType === 'physical' && policy.canCrit === true &&
    (policy.damageKind !== 'dot' || policy.critException === 'assassin_skill_poison');
}
export function resolveCombatHit(policy: DamagePolicy & { accuracy: number }, targetEvasion: number, rng = Math.random) {
  if (policy.damageType === 'magic' || policy.damageKind === 'dot') return {
    result: 'HIT' as const, hitChance: 1, roll: 0, attackerAccuracy: 0, targetEvasion: 0,
    accuracyPressure: 0, effectiveEvasion: 0,
  };
  return resolveHitAgainstEvasion({ attackerAccuracy: policy.accuracy, targetEvasion, rng });
}
export function resolveCriticalDamage(raw: number, policy: DamagePolicy, rng = Math.random, expected = false) {
  if (!canDamageCrit(policy)) return raw;
  const chance = Math.max(0, criticalChance(policy.criticalRate ?? 0));
  const bonus = (policy.criticalDamage ?? 150) / 100 - 1;
  return raw * (1 + (expected ? chance : rng() < chance ? 1 : 0) * bonus);
}
export function resolveCombatDamage(input: {
  rawDamage: number; damageType: DamageType; attackerLevel: number;
  physicalDefense: number; magicDefense: number; physicalPenetration?: number; magicPenetration?: number;
  targetBonusPercent?: number; defenseMultiplier?: number;
}) {
  const magic = input.damageType === 'magic';
  return mitigateDamage(input.rawDamage * (1 + (input.targetBonusPercent ?? 0) / 100),
    (magic ? input.magicDefense : input.physicalDefense) * (input.defenseMultiplier ?? 1),
    input.attackerLevel, (magic ? input.magicPenetration : input.physicalPenetration) ?? 0);
}
