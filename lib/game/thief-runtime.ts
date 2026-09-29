import type { Hero } from './rules.ts';
import type { SkillDefinition, SkillHit } from './skills.ts';
import type { CombatModifier } from './combat-modifiers.ts';
import { getActiveSkillForFamily } from './skill-family.ts';
import { applySourceOwnedStatus, getActiveStatusApplications, type StatusTarget } from './combat-status.ts';
import { THIEF_V3_SKILLS, THIEF_V3_SKILL_MAP, THIEF_V3_ACTIVE_FAMILY_IDS, resolveThiefCanonicalRank } from './thief-v3.ts';

/** Replaceable presentation; impact timing belongs to gameplay, not animation events. */
export const THIEF_MOTION = {
  dagger_training: 'MASTERY_PASSIVE', quick_stab: 'DAGGER_THRUST', twin_fang: 'ALTERNATING_DAGGER_STRIKES',
  quickstep: 'GROUNDED_DAGGER_APPROACH', thief_evasion: 'EVASIVE_STANCE', weakpoint: 'PRECISION_DAGGER_STRIKE',
  positional_strike: 'POSITIONAL_DAGGER_CUT', fan_of_blades: 'CLOSE_CIRCULAR_SWEEP', fatal_opening: 'COMMITTED_PRECISION_STRIKE',
} as const;

export const THIEF_V3_RUNTIME_SKILLS: readonly SkillDefinition[] = THIEF_V3_SKILLS.map(definition => {
  const damaging = !!definition.damageProfile;
  const ranks = Array.from({ length: definition.maxRank }, (_, i) => resolveThiefCanonicalRank(definition.id, i + 1)!);
  const hits = definition.mechanics.hits ?? [{ weaponHand: 'MAIN' as const, weight: 1 }];
  const rankEffects: NonNullable<SkillDefinition['rankEffects']> = ranks.map(({ values: v }) => {
    const modifiers: CombatModifier[] = [];
    if (v.skillAccuracy) modifiers.push({ id: `${definition.id}:accuracy`, action: { accuracyBonus: v.skillAccuracy } });
    for (const [position, bonus] of [['side', v.flankFinalDamagePercent], ['rear', v.rearFinalDamagePercent]] as const)
      if (bonus) modifiers.push({ id: `${definition.id}:${position}`, layer: 'payoff', payoffGroup: 'thief-position', condition: { targetPosition: position }, action: { damagePercent: bonus } });
    if (v.ownWeakpointFinalDamagePercent) modifiers.push({ id: `${definition.id}:weakpoint`, layer: 'payoff', payoffGroup: 'thief-fatal', condition: { targetStatusesFromSource: ['weakpoint'] }, action: { damagePercent: v.ownWeakpointFinalDamagePercent } });
    return {
      modifiers,
      ...(damaging ? { hitSequence: hits.map((hit, index): SkillHit => ({
        // A single cast budget. Weapon coefficient is NOT weighted a second time.
        delay: index * .15, weaponHand: hit.weaponHand, sharedContributionWeight: hit.weight,
        physicalCoefficient: v.physicalCoefficient! * hit.weight, weaponContributionCoefficient: 1,
        knockbackStrength: 0,
      })) } : {}),
      ...(definition.familyId === 'thief_evasion' ? { temporaryBuffs: [{
        duration: v.durationSeconds!, modifier: { id: `${definition.id}:evasion`,
          stats: { flat: { evasion: v.evasion! }, percent: { movementSpeed: v.movementSpeedPercent ?? 0 } } },
      }] } : {}),
    };
  });
  return {
    id: definition.id, name: definition.name, description: definition.presentation?.description ?? '',
    familyId: definition.familyId, familyRole: definition.familyRole, familyStage: definition.familyStage,
    motionArchetype: definition.id === 'v3-thief-rending-fang' ? 'DAGGER_TRIPLE_FINISHER' : THIEF_MOTION[definition.familyId],
    nonDamaging: !damaging,
    job: 'thief', specialization: null, slot: 1, unlockLevel: definition.unlockLevel!, maxLevel: definition.maxRank,
    manaCost: ranks[0].values.mana ?? 0, cooldown: ranks[0].values.cooldownSeconds ?? 0,
    castingTime: .3, actionLockDuration: Math.max(.3, (hits.length - 1) * .15 + .15), movementAllowedDuringLock: false,
    baseDamage: 0, scalingStat: damaging ? 'attack' : 'none', damageCoefficient: 0,
    physicalCoefficient: ranks[0].values.physicalCoefficient ?? 0, magicCoefficient: 0, damageType: 'physical',
    combatScaling: { physical: damaging ? 1 : 0, magic: 0, damageType: 'physical' },
    baseDamageMinByRank: definition.baseDamageMinByRank, baseDamageMaxByRank: definition.baseDamageMaxByRank,
    skillPowerFactor: definition.skillPowerFactor, rankPowerFactorByRank: definition.rankPowerFactorByRank,
    weaponMode: damaging ? definition.mechanics.weaponMode ?? 'SINGLE_MAIN' : undefined,
    progressionMode: 'rank_values', rankValues: ranks.map(({ values: v }) => ({
      physicalCoefficient: v.physicalCoefficient ?? 0, statScaling: { str: v.bonusStrCoefficient ?? 0, dex: v.bonusDexCoefficient ?? 0 },
      manaCost: v.mana ?? 0, cooldown: v.cooldownSeconds ?? 0, duration: v.durationSeconds ?? 0,
      range: damaging ? v.movementRangeMeters ?? v.radiusMeters ?? 3.5 : 0, radius: v.radiusMeters ?? 0, maxTargets: damaging ? v.targetCap ?? 1 : 0,
    })), rankEffects,
    targetType: !damaging ? 'self' : definition.mechanics.areaShape ? 'area' : 'single',
    range: 3.5, areaRadius: 0, duration: 0, statusEffect: null,
    effect: !damaging ? 'buff' : definition.mechanics.movement?.approach ? 'dash_damage' : 'damage',
    actionType: damaging ? 'skill' : 'buff', canCrit: damaging, knockbackStrength: 0,
    animation: damaging ? 'basic_attack' : 'magic_cast', visualEffect: '', soundEffect: '',
    weaponRequirement: !damaging ? [] : definition.mechanics.weaponPolicy === 'DUAL_DAGGERS' ? ['dual_dagger'] : ['dagger', 'dual_dagger'],
    masteryOptions: [], usableFromHotbar: definition.familyRole !== 'PASSIVE', hotbarCategory: 'primary', skillType: 'active',
    prerequisites: definition.prerequisiteSkills, modifierComposition: 'scoped_additive', tags: ['v3-thief', `thief-family:${definition.familyId}`],
  };
});

export function activeThiefFamily(hero: Hero, familyId: string) {
  if (hero.skillArchitectureVersion !== 3 || hero.coreJob !== 'thief' || !hero.skillProgressionV3) return null;
  const definition = getActiveSkillForFamily({ state: hero.skillProgressionV3, level: hero.level, skills: THIEF_V3_SKILL_MAP }, familyId);
  return definition ? resolveThiefCanonicalRank(definition.id, hero.skillProgressionV3.skillRanks[definition.id]) : null;
}
export function thiefPassiveModifiers(hero: Hero): CombatModifier[] {
  const active = activeThiefFamily(hero, 'dagger_training');
  if (!active) return [];
  const v = active.values;
  return [{ id: 'v3-thief-training', stage: 'passive', stats: {
    flat: { accuracy: v.accuracy ?? 0, criticalRate: v.criticalRatePercentagePoints ?? 0 },
    percent: { attackSpeed: v.attackSpeedPercent ?? 0 },
  } }];
}
export function thiefManaReduction(hero: Hero, skillId: string) {
  const skill = THIEF_V3_SKILL_MAP[skillId];
  return skill && THIEF_V3_ACTIVE_FAMILY_IDS.some(family => family === skill.familyId)
    ? activeThiefFamily(hero, 'dagger_training')?.values.coreThiefManaReductionPercent ?? 0 : 0;
}
/** Evolution/reset removes the old buff; it does not activate the new one for free. */
export function reconcileThiefBuffs(hero: Hero) {
  if (hero.skillArchitectureVersion !== 3) return;
  const active = activeThiefFamily(hero, 'thief_evasion');
  hero.temporaryModifiers = hero.temporaryModifiers?.filter(entry =>
    !entry.modifier.id.startsWith('v3-thief-') || !entry.modifier.id.endsWith(':evasion') || entry.modifier.id === `${active?.skillId}:evasion`);
  for (const id of Object.keys(hero.activeBuffs))
    if (THIEF_V3_SKILL_MAP[id]?.familyId === 'thief_evasion' && id !== active?.skillId) delete hero.activeBuffs[id];
}
export function ownWeakpointCrit(target: StatusTarget, sourceActorId: string, now: number) {
  return getActiveStatusApplications(target, 'weakpoint', now).find(entry => entry.sourceActorId === sourceActorId)?.strength ?? 0;
}
export function applyThiefWeakpoint(target: StatusTarget, sourceActorId: string, skillId: string, rank: number, now: number) {
  const data = resolveThiefCanonicalRank(skillId, rank);
  if (!data?.mechanics.weakpoint) return;
  applySourceOwnedStatus(target, 'weakpoint', { sourceActorId, sourceSkillId: skillId,
    strength: data.values.weakpointCritPercentagePoints!, appliedAt: now, duration: data.values.durationSeconds!,
  }, { refresh: 'replace', compatibilityTimer: false });
}
