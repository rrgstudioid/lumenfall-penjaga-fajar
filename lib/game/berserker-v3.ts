import type { SkillDefinition, SkillRankValues } from './skills.ts';
import type { SkillDefinitionV3, SkillProgressionV3State } from './skill-progression-v3.ts';

const twoHand = ['two_hand_sword'];
const swords = ['one_hand_sword', 'two_hand_sword'];
const motion = (motionArchetype: string, motionNotes: string, animationNoGo: string[]) => ({ motionArchetype, motionNotes, animationNoGo });
const rankValues = (coefficients: number[], str: number[], mana: number[], cooldown: number[], extra: Array<Record<string, number>> = []) =>
  coefficients.map((physicalCoefficient, index) => ({ physicalCoefficient, statScaling: { str: str[index] }, manaCost: mana[index], cooldown: cooldown[index], ...(extra[index] ?? {}) }));

const makeDamage = (patch: Partial<SkillDefinitionV3> & Pick<SkillDefinitionV3, 'id' | 'name' | 'maxRank' | 'rankLevelRequirements' | 'damageProfile' | 'resourceCost' | 'cooldown' | 'presentation' | 'motion'>): SkillDefinitionV3 => ({
  jobId: 'berserker', jobTier: 'specialization', spCostPerRank: 3, skillType: 'ACTIVE_DAMAGE',
  weaponRequirement: twoHand, targeting: { targetType: 'single', range: 5.2 }, ...patch,
});

const makeArea = (patch: Partial<SkillDefinitionV3> & Pick<SkillDefinitionV3, 'id' | 'name' | 'maxRank' | 'rankLevelRequirements' | 'damageProfile' | 'resourceCost' | 'cooldown' | 'presentation' | 'motion'>): SkillDefinitionV3 => makeDamage({
  targeting: { targetType: 'area', radius: 5, maxTargets: 5 }, ...patch,
});

export const BERSERKER_V3_SKILLS: readonly SkillDefinitionV3[] = [
  {
    id: 'v3-berserker-two-hand-mastery', name: 'Two-Hand Sword Mastery', jobId: 'berserker', jobTier: 'specialization',
    unlockLevel: 60, maxRank: 5, rankLevelRequirements: [60, 64, 68, 73, 78], spCostPerRank: 4,
    skillType: 'MASTERY', weaponRequirement: twoHand, targeting: { targetType: 'self' },
    effects: { buffs: ['two_hand_accuracy', 'berserker_mana_efficiency'] },
    presentation: { description: 'Master the use of Two-Hand Swords, improving your control and efficiency with heavy Berserker techniques.' },
    motion: motion('MASTERY_PASSIVE', 'Passive heavy-sword control and efficiency.', ['no active attack', 'no weapon unlock', 'no raw damage multiplier']),
    status: 'DESIGN_LOCKED',
  },
  makeArea({
    id: 'v3-berserker-raging-cleave', name: 'Raging Cleave', maxRank: 8, rankLevelRequirements: [60, 63, 65, 68, 70, 73, 76, 79],
    damageProfile: { physicalCoefficient: .95, statScaling: { str: .15 } }, resourceCost: { mana: 14 }, cooldown: 7,
    prerequisiteSkills: [{ skillId: 'v3-warrior-sweeping-slash', requiredRank: 4 }], weaponRequirement: twoHand,
    targeting: { targetType: 'frontal_arc', range: 5.5, radius: 4.6, maxTargets: 4 }, effects: { tags: ['berserker_damage', 'no-stun', 'no-knockback'] },
    presentation: { description: 'Swing your Two-Hand Sword in a massive sweeping arc, striking multiple enemies in front of you with overwhelming force.' },
    motion: motion('HEAVY_WIDE_SWEEP', 'Heavy wide two-hand sword sweep.', ['no repeated spin', 'no jump', 'no knockback', 'no repeated hit sequence']),
  }),
  makeDamage({
    id: 'v3-berserker-crushing-blow', name: 'Crushing Blow', maxRank: 5, rankLevelRequirements: [60, 65, 69, 74, 79],
    damageProfile: { physicalCoefficient: 1.2, statScaling: { str: .22 } }, resourceCost: { mana: 14 }, cooldown: 8.5,
    presentation: { description: 'Deliver a brutal Two-Hand Sword strike against a single enemy, sacrificing speed for tremendous impact.' },
    motion: motion('TWO_HAND_POWER_STRIKE', 'Deliberate heavy two-hand power strike.', ['no stun', 'no knockback', 'no AoE']),
  }),
  {
    id: 'v3-berserker-iron-blood', name: 'Iron Blood', jobId: 'berserker', jobTier: 'specialization', unlockLevel: 60, maxRank: 5,
    rankLevelRequirements: [60, 66, 70, 75, 80], spCostPerRank: 3, skillType: 'ACTIVE_BUFF', targeting: { targetType: 'self' },
    resourceCost: { mana: 18 }, cooldown: 34, effects: { buffs: ['temporary_max_hp', 'damage_reduction'] },
    presentation: { description: 'Harden your body through sheer battle fury, temporarily increasing Max HP and reducing incoming damage.' },
    motion: motion('BERSERKER_FORTIFY', 'Temporary fortification through battle fury.', ['no permanent tankiness', 'no hidden VIT scaling', 'no free healing']),
  },
  makeArea({
    id: 'v3-berserker-breaker-entry', name: 'Breaker Entry', maxRank: 5, rankLevelRequirements: [60, 67, 71, 75, 79],
    damageProfile: { physicalCoefficient: .75, statScaling: { str: .10 } }, resourceCost: { mana: 12 }, cooldown: 10,
    weaponRequirement: swords, prerequisiteSkills: [{ skillId: 'v3-warrior-iron-charge', requiredRank: 3 }],
    targeting: { targetType: 'area', radius: 3.5, maxTargets: 3 }, effects: { tags: ['breaker-entry-consumer', 'no-charge', 'no-stun', 'no-knockback'] },
    presentation: { description: 'Follow a successful charge with a crushing sweep, striking nearby enemies as you force your way into the fight.' },
    motion: motion('CHARGE_FOLLOWUP_SMASH', 'Short impact-area follow-up at the entered target position.', ['no second charge', 'no teleport', 'no stun', 'no knockback']),
  }),
  makeArea({
    id: 'v3-berserker-earth-splitter', name: 'Earth Splitter', maxRank: 5, rankLevelRequirements: [66, 69, 72, 76, 80],
    damageProfile: { physicalCoefficient: 1.2, statScaling: { str: .25 } }, resourceCost: { mana: 22 }, cooldown: 14,
    prerequisiteSkills: [{ skillId: 'v3-berserker-raging-cleave', requiredRank: 3 }],
    targeting: { targetType: 'area', radius: 5, maxTargets: 5 },
    stunProfile: { chance: [.08, .10, .12, .15, .18], pveDuration: 1.5, pvpDuration: .75, minimumTravelDistance: 0, targetPolicy: 'NORMAL' },
    effects: { tags: ['berserker_damage', 'per-target-stun', 'radial', 'no-knockback'] },
    presentation: { description: 'Drive your Two-Hand Sword into the earth with tremendous force, damaging nearby enemies and giving the impact a chance to Stun them.' },
    motion: motion('EARTH_SPLITTING_SLAM', 'One heavy radial earth impact.', ['no repeated shockwaves', 'no knockback', 'no Stagger', 'no spinning attack']),
  }),
  makeArea({
    id: 'v3-berserker-ruinous-arc', name: 'Ruinous Arc', maxRank: 5, rankLevelRequirements: [66, 71, 74, 77, 80],
    damageProfile: { physicalCoefficient: 1.1, statScaling: { str: .20 } }, resourceCost: { mana: 17 }, cooldown: 10.5,
    prerequisiteSkills: [{ skillId: 'v3-warrior-armor-breaker', requiredRank: 3 }], targeting: { targetType: 'frontal_arc', range: 5.2, radius: 4.5, maxTargets: 4 },
    effects: { tags: ['berserker_damage', 'armor-break-payoff:8', 'no-stun', 'no-knockback'] },
    presentation: { description: 'Carve a devastating arc through enemies in front of you, dealing greater damage to targets already weakened by your Armor Break.' },
    motion: motion('RISING_HEAVY_ARC', 'Heavy rising two-hand arc.', ['no stun', 'no knockback', 'no repeated hit sequence']),
  }),
  makeArea({
    id: 'v3-berserker-fury-harvest', name: 'Fury Harvest', maxRank: 5, rankLevelRequirements: [70, 73, 75, 78, 80],
    damageProfile: { physicalCoefficient: 1, statScaling: { str: .15 } }, resourceCost: { mana: 24 }, cooldown: 13,
    prerequisiteSkills: [{ skillId: 'v3-berserker-earth-splitter', requiredRank: 3 }, { skillId: 'v3-berserker-iron-blood', requiredRank: 2 }],
    targeting: { targetType: 'area', radius: 4.5, maxTargets: 5 }, effects: { tags: ['berserker_damage', 'fury-harvest-recovery', 'controlled-circular', 'no-knockback'] },
    presentation: { description: 'Sweep through nearby enemies and draw strength from every foe struck, restoring a portion of your HP based on the number of enemies hit.' },
    motion: motion('REAPING_CIRCULAR_STRIKE', 'One controlled near-360 sweep.', ['no repeated spinning', 'no jump', 'no knockback']),
  }),
  {
    id: 'v3-berserker-trance', name: 'Berserker Trance', jobId: 'berserker', jobTier: 'specialization', unlockLevel: 70, maxRank: 3,
    rankLevelRequirements: [70, 78, 80], spCostPerRank: 5, skillType: 'ULTIMATE', weaponRequirement: twoHand, targeting: { targetType: 'self' },
    prerequisiteSkills: [{ skillId: 'v3-berserker-two-hand-mastery', requiredRank: 3 }], jobInvestmentRequirement: { jobId: 'berserker', minimumSP: 18 },
    resourceCost: { mana: 30 }, cooldown: 90, effects: { buffs: ['berserker_trance', 'frenzy_guard'] },
    presentation: { description: 'Enter a state of unrestrained battle fury, empowering your Two-Hand Sword techniques and strengthening your ability to survive while fighting groups of enemies.' },
    motion: motion('BERSERKER_TRANSFORMATION', 'Temporary battle-fury stance without forced control loss.', ['no giant body transformation', 'no invulnerability', 'no permanent aura', 'no auto-control']),
  },
];

const arrays: Record<string, { coefficients: number[]; str: number[]; mana: number[]; cooldown: number[]; duration?: number[]; radius?: number[]; maxTargets?: number[] }> = {
  'v3-berserker-raging-cleave': { coefficients: [.95,1,1.05,1.1,1.15,1.2,1.25,1.3], str: [.15,.17,.19,.21,.24,.27,.29,.32], mana: [14,15,16,17,18,19,20,21], cooldown: [7,6.8,6.6,6.4,6.2,6,5.9,5.8], radius: [4.6,4.7,4.8,5,5.1,5.25,5.4,5.5], maxTargets: [4,4,5,5,6,6,7,7] },
  'v3-berserker-crushing-blow': { coefficients: [1.2,1.28,1.37,1.46,1.55], str: [.22,.26,.3,.34,.38], mana: [14,15,17,18,20], cooldown: [8.5,8.25,8,7.75,7.5] },
  'v3-berserker-breaker-entry': { coefficients: [.75,.81,.87,.94,1], str: [.1,.12,.15,.17,.2], mana: [12,13,14,15,16], cooldown: [10,9.6,9.2,8.8,8.5], radius: [3.5,3.7,3.9,4,4.2], maxTargets: [3,3,4,4,5] },
  'v3-berserker-earth-splitter': { coefficients: [1.2,1.28,1.37,1.46,1.55], str: [.25,.3,.35,.4,.45], mana: [22,24,26,28,30], cooldown: [14,13.5,13,12.5,12], radius: [5,5.25,5.5,5.75,6], maxTargets: [5,6,6,7,8] },
  'v3-berserker-ruinous-arc': { coefficients: [1.1,1.18,1.25,1.32,1.4], str: [.2,.24,.28,.31,.35], mana: [17,18,20,21,23], cooldown: [10.5,10.1,9.7,9.3,9], radius: [4.5,4.7,4.9,5,5.2], maxTargets: [4,4,5,5,6] },
  'v3-berserker-fury-harvest': { coefficients: [1,1.06,1.12,1.18,1.25], str: [.15,.18,.21,.24,.28], mana: [24,26,28,30,32], cooldown: [13,12.5,12,11.5,11], radius: [4.5,4.7,4.9,5,5.2], maxTargets: [5,5,6,6,7] },
  'v3-berserker-trance': { coefficients: [0,0,0], str: [0,0,0], mana: [30,34,38], cooldown: [90,88,85], duration: [12,14,16] },
};

const ironBlood = [
  { hp: 5, dr: 2, duration: 8, mana: 18, cooldown: 34 }, { hp: 6, dr: 2.5, duration: 9, mana: 20, cooldown: 33.5 },
  { hp: 7, dr: 3, duration: 10, mana: 22, cooldown: 33 }, { hp: 8.5, dr: 4, duration: 11, mana: 24, cooldown: 32.5 },
  { hp: 10, dr: 5, duration: 12, mana: 26, cooldown: 32 },
];

const adapter = (definition: SkillDefinitionV3): SkillDefinition => {
  const values = arrays[definition.id];
  const blood = definition.id === 'v3-berserker-iron-blood' ? ironBlood : undefined;
  const coefficients = values?.coefficients ?? (blood ? blood.map(() => 0) : [0]);
  const stats = values?.str ?? coefficients.map(() => 0);
  const rankValues: SkillRankValues[] = coefficients.map((coefficient, index) => ({
    physicalCoefficient: coefficient, statScaling: { str: stats[index] },
    manaCost: blood?.[index]?.mana ?? values?.mana[index] ?? definition.resourceCost?.mana ?? 0,
    cooldown: blood?.[index]?.cooldown ?? values?.cooldown[index] ?? definition.cooldown ?? 0,
    ...(values?.duration ? { duration: values.duration[index] } : {}),
    ...(values?.radius ? { radius: values.radius[index] } : {}),
    ...(values?.maxTargets ? { maxTargets: values.maxTargets[index] } : {}),
  }));
  const rankEffects = blood?.map((entry) => ({ temporaryBuffs: [{ duration: entry.duration, modifier: { id: `${definition.id}-buff`, stats: { percent: { maxHP: entry.hp, damageReduction: entry.dr } } } }] }))
    ?? (definition.id === 'v3-berserker-two-hand-mastery' ? [2,4,6,8,10].map((accuracy) => ({ modifiers: [{ id: `${definition.id}-accuracy`, stats: { flat: { accuracy } } }] })) : undefined);
  const effect = definition.skillType === 'ACTIVE_BUFF' || definition.skillType === 'MASTERY' || definition.id === 'v3-berserker-trance' ? 'buff' : definition.targeting?.targetType === 'area' || definition.targeting?.targetType === 'frontal_arc' ? 'aoe_damage' : 'damage';
  return {
    id: definition.id, name: definition.name, description: definition.presentation?.description ?? '', job: 'warrior', specialization: 'berserker',
    slot: 1, unlockLevel: definition.unlockLevel ?? definition.rankLevelRequirements?.[0] ?? 60, maxLevel: definition.maxRank,
    manaCost: definition.resourceCost?.mana ?? 0, cooldown: definition.cooldown ?? 0, castingTime: .55, baseDamage: 0, scalingStat: 'attack', damageCoefficient: 0,
    combatScaling: { physical: 1, magic: 0, damageType: 'physical' }, physicalCoefficient: definition.damageProfile?.physicalCoefficient ?? 0, statScaling: definition.damageProfile?.statScaling,
    magicCoefficient: 0, damageType: 'physical', progressionMode: 'rank_values', rankValues, rankEffects, knockbackStrength: 0,
    targetType: definition.targeting?.targetType === 'frontal_arc' ? 'frontal_arc' : definition.targeting?.targetType === 'area' ? 'area' : definition.targeting?.targetType === 'self' ? 'self' : 'single',
    range: definition.targeting?.range ?? 0, areaRadius: definition.targeting?.radius ?? 0, maxTargets: definition.targeting?.maxTargets, duration: 0, statusEffect: null, effect,
    animation: effect === 'buff' || effect === 'ultimate' ? 'magic_cast' : 'basic_attack', visualEffect: effect === 'ultimate' ? 'thunder' : effect === 'buff' ? 'barrier' : '', soundEffect: '',
    weaponRequirement: (definition.weaponRequirement ?? []) as SkillDefinition['weaponRequirement'], masteryOptions: [], usableFromHotbar: definition.skillType !== 'MASTERY', hotbarCategory: 'primary',
    // Runtime SkillDefinition remains an actionable shape; usableFromHotbar=false
    // keeps Mastery out of casting/hotbar while the V3 schema retains MASTERY.
    skillType: 'active', tags: ['v3-berserker', ...(definition.effects?.tags ?? [])], prerequisiteSkillIds: definition.prerequisiteSkills?.map((entry) => entry.skillId),
    stunProfile: definition.stunProfile, statuses: [],
  };
};

export const BERSERKER_V3_RUNTIME_SKILLS: readonly SkillDefinition[] = BERSERKER_V3_SKILLS.map(adapter);
export const BERSERKER_V3_SKILL_MAP = Object.fromEntries(BERSERKER_V3_SKILLS.map((skill) => [skill.id, skill])) as Record<string, SkillDefinitionV3>;
export const BERSERKER_V3_RUNTIME_MAP = Object.fromEntries(BERSERKER_V3_RUNTIME_SKILLS.map((skill) => [skill.id, skill]));
export const BERSERKER_V3_JOB = { id: 'berserker', tier: 'specialization' as const, parent: 'warrior' };

export function berserkerV3StateAfterSpecialization(previous: SkillProgressionV3State): SkillProgressionV3State {
  return { ...previous, skillRanks: { ...(previous.grantedRanks ?? {}) }, chosenCoreJob: 'warrior', chosenSpecialization: 'berserker', chosenAdvancedJob: null };
}

export const BERSERKER_MASTERY_ACCURACY = [2, 4, 6, 8, 10] as const;
export const BERSERKER_MASTERY_MANA_REDUCTION = [2, 4, 6, 8, 10] as const;
export const BERSERKER_MASTERY_MANA_SKILLS = new Set([
  'v3-berserker-raging-cleave',
  'v3-berserker-crushing-blow',
  'v3-berserker-earth-splitter',
  'v3-berserker-ruinous-arc',
  'v3-berserker-fury-harvest',
  'v3-berserker-trance',
]);
export const BERSERKER_TRANCE_DAMAGE_SKILLS = new Set([
  'v3-berserker-raging-cleave',
  'v3-berserker-crushing-blow',
  'v3-berserker-earth-splitter',
  'v3-berserker-ruinous-arc',
  'v3-berserker-fury-harvest',
]);
export const BERSERKER_TRANCE_AOE_SKILLS = new Set([
  'v3-berserker-raging-cleave',
  'v3-berserker-breaker-entry',
  'v3-berserker-earth-splitter',
  'v3-berserker-ruinous-arc',
  'v3-berserker-fury-harvest',
]);
export const EARTH_SPLITTER_STUN_CHANCE = [.08, .10, .12, .15, .18] as const;
export const FURY_HARVEST_RECOVERY_PERCENT = [.6, .7, .8, .9, 1] as const;
