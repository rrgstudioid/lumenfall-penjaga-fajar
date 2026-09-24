import type { SkillDefinition, SkillRankValues } from './skills.ts';
import type { SkillDefinitionV3, SkillProgressionV3State } from './skill-progression-v3.ts';

const ranks = (values: SkillRankValues[]): SkillRankValues[] => values;

export const ADVENTURER_V3_SKILLS: readonly SkillDefinitionV3[] = [
  {
    id: 'v3-adventurer-quick-slash', name: 'Quick Slash', jobId: 'adventurer', jobTier: 'adventurer',
    unlockLevel: 1, maxRank: 5, rankLevelRequirements: [1, 3, 6, 9, 13], spCostPerRank: 1,
    weaponRequirement: ['one_hand_sword'], skillType: 'ACTIVE_DAMAGE',
    targeting: { targetType: 'single', range: 3.8 },
    damageProfile: { physicalCoefficient: 1.05, statScaling: { str: .02 } },
    resourceCost: { mana: 3 }, cooldown: 3.2,
    baseDamageMinByRank: [8, 10, 12, 14, 16],
    baseDamageMaxByRank: [12, 15, 18, 21, 24],
    skillPowerFactor: 4,
    rankPowerFactorByRank: [1, 1.05, 1.1, 1.15, 1.2],
    presentation: { description: 'Deliver a quick sword strike to a single enemy.' },
    motion: { motionArchetype: 'QUICK_DIAGONAL_SLASH', motionNotes: 'Fast single diagonal sword slash with a small forward weight shift.', movementIntent: 'SMALL_FORWARD_WEIGHT_SHIFT', hitStyle: 'SINGLE_QUICK_HIT', animationNoGo: ['no spin', 'no jump', 'no knockback', 'no ground slam'] },
    defaultProfile: { damageProfile: { physicalCoefficient: 1.05, statScaling: { str: .02 } }, resourceCost: { mana: 3 }, cooldown: 3.2 },
    status: 'DESIGN_LOCKED',
  },
  {
    id: 'v3-adventurer-power-strike', name: 'Power Strike', jobId: 'adventurer', jobTier: 'adventurer',
    unlockLevel: 1, maxRank: 5, rankLevelRequirements: [1, 7, 10, 12, 14], spCostPerRank: 1,
    weaponRequirement: ['one_hand_sword'], skillType: 'ACTIVE_DAMAGE',
    targeting: { targetType: 'single', range: 3.8 },
    damageProfile: { physicalCoefficient: 1.2, statScaling: { str: .04 } },
    resourceCost: { mana: 5 }, cooldown: 6,
    baseDamageMinByRank: [12, 15, 18, 21, 24],
    baseDamageMaxByRank: [18, 22, 26, 30, 35],
    skillPowerFactor: 4,
    rankPowerFactorByRank: [1, 1.05, 1.1, 1.15, 1.2],
    presentation: { description: 'Deliver a heavy sword strike to a single enemy, trading speed for greater power.' },
    motion: { motionArchetype: 'HEAVY_DIAGONAL_STRIKE', motionNotes: 'A deliberate heavy diagonal/downward sword strike with stronger wind-up and recovery than Quick Slash.', hitStyle: 'SINGLE_HEAVY_HIT', animationNoGo: ['no spin', 'no jump', 'no knockback', 'no AoE shockwave'] },
    defaultProfile: { damageProfile: { physicalCoefficient: 1.2, statScaling: { str: .04 } }, resourceCost: { mana: 5 }, cooldown: 6 },
    status: 'DESIGN_LOCKED',
  },
  {
    id: 'v3-adventurer-minor-heal', name: 'Minor Heal', jobId: 'adventurer', jobTier: 'adventurer',
    unlockLevel: 1, maxRank: 3, rankLevelRequirements: [1, 8, 14], spCostPerRank: 1,
    skillType: 'ACTIVE_HEAL', targeting: { targetType: 'self' },
    resourceCost: { mana: 8 }, cooldown: 30,
    defaultProfile: { healing: 6, resourceCost: { mana: 8 }, cooldown: 30 },
    presentation: { description: 'Restore a small amount of your own HP.' },
    motion: { motionArchetype: 'MINOR_SELF_HEAL', motionNotes: 'Short self-recovery pose with a subtle healing glow.', movementIntent: 'NONE', animationNoGo: ['no large spell circle', 'no resurrection-like animation', 'no giant magical burst', 'no attack motion'] },
    status: 'DESIGN_LOCKED',
  },
];

const rankValues: SkillRankValues[][] = [
  ranks([
    { physicalCoefficient: 1.05, statScaling: { str: .02 }, manaCost: 3, cooldown: 3.2 },
    { physicalCoefficient: 1.08, statScaling: { str: .03 }, manaCost: 3, cooldown: 3.1 },
    { physicalCoefficient: 1.12, statScaling: { str: .04 }, manaCost: 4, cooldown: 3 },
    { physicalCoefficient: 1.16, statScaling: { str: .05 }, manaCost: 4, cooldown: 2.9 },
    { physicalCoefficient: 1.2, statScaling: { str: .06 }, manaCost: 5, cooldown: 2.8 },
  ]),
  ranks([
    { physicalCoefficient: 1.2, statScaling: { str: .04 }, manaCost: 5, cooldown: 6 },
    { physicalCoefficient: 1.26, statScaling: { str: .05 }, manaCost: 5, cooldown: 5.75 },
    { physicalCoefficient: 1.32, statScaling: { str: .06 }, manaCost: 6, cooldown: 5.5 },
    { physicalCoefficient: 1.38, statScaling: { str: .07 }, manaCost: 6, cooldown: 5.25 },
    { physicalCoefficient: 1.45, statScaling: { str: .08 }, manaCost: 7, cooldown: 5 },
  ]),
  ranks([{ manaCost: 8, cooldown: 30 }, { manaCost: 10, cooldown: 28 }, { manaCost: 12, cooldown: 26 }]),
];

export const ADVENTURER_V3_RUNTIME_SKILLS: readonly SkillDefinition[] = ADVENTURER_V3_SKILLS.map((definition, index) => ({
  id: definition.id,
  name: definition.name,
  description: definition.presentation?.description ?? '',
  job: 'adventurer', specialization: null,
  slot: (index + 1) as 1 | 2 | 3 | 4,
  unlockLevel: definition.unlockLevel ?? 1,
  maxLevel: definition.maxRank,
  manaCost: definition.resourceCost?.mana ?? 0,
  cooldown: definition.cooldown ?? 0,
  castingTime: index === 2 ? .5 : .35,
  baseDamage: 0,
  scalingStat: index === 2 ? 'hp' : 'attack',
  damageCoefficient: 0,
  targetType: definition.targeting?.targetType === 'self' ? 'self' : 'single',
  progressionMode: 'rank_values',
  rankValues: rankValues[index],
  physicalCoefficient: definition.damageProfile?.physicalCoefficient ?? 0,
  statScaling: definition.damageProfile?.statScaling,
  baseDamageMinByRank: definition.baseDamageMinByRank,
  baseDamageMaxByRank: definition.baseDamageMaxByRank,
  skillPowerFactor: definition.skillPowerFactor,
  rankPowerFactorByRank: definition.rankPowerFactorByRank,
  damageType: index === 2 ? 'physical' : 'physical',
  canCrit: index !== 2,
  range: definition.targeting?.range ?? 0,
  areaRadius: definition.targeting?.radius ?? 0,
  duration: 0,
  statusEffect: null,
  effect: index === 2 ? 'heal' : 'damage',
  animation: index === 2 ? 'magic_cast' : 'basic_attack',
  visualEffect: index === 2 ? 'holy' : '',
  soundEffect: '',
  weaponRequirement: (definition.weaponRequirement ?? []) as SkillDefinition['weaponRequirement'],
  masteryOptions: [],
  usableFromHotbar: true,
  hotbarCategory: 'primary',
  skillType: 'active',
  tags: ['v3-adventurer'],
  rankMechanics: index === 2 ? [
    { values: { baseDamage: 0 } }, { values: { baseDamage: 0 } }, { values: { baseDamage: 0 } },
  ] : undefined,
}));

export const ADVENTURER_V3_SKILL_MAP = Object.fromEntries(
  ADVENTURER_V3_SKILLS.map((skill) => [skill.id, skill]),
) as Record<string, SkillDefinitionV3>;

export const ADVENTURER_V3_JOB = { id: 'adventurer', tier: 'adventurer' as const, parent: null };

export function adventurerV3StartingState(): SkillProgressionV3State {
  return {
    skillArchitectureVersion: 3,
    totalEarnedSP: 0,
    skillRanks: { 'v3-adventurer-quick-slash': 1 },
    grantedRanks: { 'v3-adventurer-quick-slash': 1 },
    chosenCoreJob: null,
    chosenSpecialization: null,
    chosenAdvancedJob: null,
  };
}

export function adventurerV3RankValues(id: string): readonly SkillRankValues[] {
  const index = ADVENTURER_V3_SKILLS.findIndex((skill) => skill.id === id);
  return index < 0 ? [] : rankValues[index];
}
