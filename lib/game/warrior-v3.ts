import type { SkillDefinition, SkillRankValues } from './skills.ts';
import type { SkillDefinitionV3, SkillProgressionV3State } from './skill-progression-v3.ts';

const swords = ['one_hand_sword', 'two_hand_sword'];
const _r = (values: SkillRankValues[]) => values;
const _profile = (coefficient: number, str: number, mana: number, cooldown: number) => ({
  damageProfile: { physicalCoefficient: coefficient, statScaling: { str } },
  resourceCost: { mana }, cooldown,
});
const motion = (motionArchetype: string, motionNotes: string, animationNoGo: string[]) => ({ motionArchetype, motionNotes, animationNoGo });

const makeDamage = (patch: Partial<SkillDefinitionV3> & Pick<SkillDefinitionV3, 'id' | 'name' | 'maxRank' | 'rankLevelRequirements' | 'damageProfile' | 'resourceCost' | 'cooldown' | 'presentation' | 'motion'>): SkillDefinitionV3 => ({
  jobId: 'warrior', jobTier: 'core', spCostPerRank: 2, skillType: 'ACTIVE_DAMAGE', weaponRequirement: swords, targeting: { targetType: 'single', range: 3.8 }, ...patch,
});
export const ARMOR_BREAK_REDUCTION_BY_RANK = [6, 7.5, 9, 10.5, 12] as const;

export const WARRIOR_V3_SKILLS: readonly SkillDefinitionV3[] = [
  makeDamage({ id: 'v3-warrior-strike', name: 'Warrior Strike', maxRank: 10, rankLevelRequirements: [15,18,21,24,28,32,36,41,47,55], damageProfile: { physicalCoefficient: 1, statScaling: { str: .08 } }, resourceCost: { mana: 5 }, cooldown: 3.2, baseDamageMinByRank: [25,29,33,37,41,45,49,53,57,60], baseDamageMaxByRank: [40,45,50,55,60,66,72,78,84,90], skillPowerFactor: 6, rankPowerFactorByRank: [1,1.05,1.1,1.15,1.2,1.25,1.3,1.35,1.4,1.45], presentation: { description: 'Deliver a reliable sword strike against a single enemy.' }, motion: motion('QUICK_DIAGONAL_SLASH','Fast diagonal sword strike with small forward weight shift.',['no full spin','no jump','no knockback','no ground slam']) }),
  makeDamage({ id: 'v3-warrior-iron-charge', name: 'Iron Charge', maxRank: 5, rankLevelRequirements: [15,26,35,44,53], damageProfile: { physicalCoefficient: .75, statScaling: { str: .05 } }, resourceCost: { mana: 8 }, cooldown: 8, targeting: { targetType: 'single', range: 6.5 }, stunProfile: { chance: [.10,.15,.20,.25,.30], pveDuration: 1.5, pvpDuration: .75, minimumTravelDistance: 3.5, targetPolicy: 'NORMAL' }, effects: { movement: 'charge', tags: ['stun-after-distance','no-knockback'] }, baseDamageMinByRank: [20,26,32,38,45], baseDamageMaxByRank: [35,44,53,62,70], skillPowerFactor: 6, rankPowerFactorByRank: [1,1.05,1.1,1.15,1.2], presentation: { description: 'Rush toward an enemy and strike on impact. Charging from sufficient distance gives the impact a chance to Stun.' }, motion: motion('CHARGE_IMPACT','Rush toward an enemy and strike on impact.',['no knockback','no teleport','no giant leap','no repeated hits']) }),
  makeDamage({ id: 'v3-warrior-sweeping-slash', name: 'Sweeping Slash', maxRank: 8, rankLevelRequirements: [15,24,29,34,40,46,51,56], damageProfile: { physicalCoefficient: .88, statScaling: { str: .08 } }, resourceCost: { mana: 8 }, cooldown: 6, targeting: { targetType: 'frontal_arc', range: 4.8, radius: 4.0, maxTargets: 3 }, prerequisiteSkills: [{ skillId: 'v3-warrior-strike', requiredRank: 2 }], effects: { tags: ['arc:120','no-knockback'] }, baseDamageMinByRank: [20,25,30,35,40,45,50,55], baseDamageMaxByRank: [35,41,47,53,60,67,73,80], skillPowerFactor: 6, rankPowerFactorByRank: [1,1.05,1.1,1.15,1.2,1.25,1.3,1.35], presentation: { description: 'Swing your sword in a wide horizontal arc, striking multiple enemies in front of you.' }, motion: motion('HORIZONTAL_SWEEP','Wide horizontal sword sweep.',['no full 360 spin','no jump','no knockback','no ground slam']) }),
  {
    id: 'v3-warrior-guard-stance', name: 'Guard Stance', jobId: 'warrior', jobTier: 'core', maxRank: 5, rankLevelRequirements: [15,30,38,46,54], spCostPerRank: 2, skillType: 'STANCE', weaponRequirement: swords, targeting: { targetType: 'self' }, resourceCost: { mana: 10 }, cooldown: 18, effects: { buffs: ['damageReduction','blockRate'] }, presentation: { description: 'Assume a defensive sword stance, reducing incoming damage and improving your ability to block attacks for a short time.' }, motion: motion('DEFENSIVE_GUARD','Defensive sword guard.',['no attack','no giant shield bubble','no immobility requirement','no offensive damage'])
  },
  makeDamage({ id: 'v3-warrior-armor-breaker', name: 'Armor Breaker', maxRank: 5, rankLevelRequirements: [17,33,41,48,55], damageProfile: { physicalCoefficient: 1, statScaling: { str: .10 } }, resourceCost: { mana: 11 }, cooldown: 10, prerequisiteSkills: [{ skillId: 'v3-warrior-strike', requiredRank: 3 }], effects: { debuffs: ['armor_break'], tags: ['refresh-strongest-only'] }, baseDamageMinByRank: [30,38,45,52,60], baseDamageMaxByRank: [45,56,67,78,90], skillPowerFactor: 6, rankPowerFactorByRank: [1,1.05,1.1,1.15,1.2], presentation: { description: "Deliver a forceful strike against the enemy's guard, weakening its Defense for a short duration." }, motion: motion('HEAVY_GUARD_BREAK','Forceful strike against the enemy guard.',['no knockback']) }),
  {
    id: 'v3-warrior-battle-cry', name: 'Battle Cry', jobId: 'warrior', jobTier: 'core', maxRank: 5, rankLevelRequirements: [20,35,42,49,56], spCostPerRank: 2, skillType: 'ACTIVE_BUFF', targeting: { targetType: 'self' }, resourceCost: { mana: 14 }, cooldown: 35, effects: { buffs: ['physicalDamagePercent'] }, presentation: { description: 'Release a powerful battle cry, temporarily increasing your physical offensive strength.' }, motion: motion('POWER_BUFF','Battle cry power-up pose.',['no damage','no sword attack','no giant magical explosion'])
  },
  makeDamage({ id: 'v3-warrior-counter-slash', name: 'Counter Slash', maxRank: 5, rankLevelRequirements: [17,37,44,50,57], damageProfile: { physicalCoefficient: .90, statScaling: { str: .08, dex: .08 } }, resourceCost: { mana: 9 }, cooldown: 6.5, prerequisiteSkills: [{ skillId: 'v3-warrior-guard-stance', requiredRank: 2 }], effects: { tags: ['counter-payoff:15,18,22,26,30'] }, baseDamageMinByRank: [35,44,53,61,70], baseDamageMaxByRank: [50,64,77,91,105], skillPowerFactor: 6, rankPowerFactorByRank: [1,1.05,1.1,1.15,1.2], presentation: { description: 'Strike back with a swift retaliatory slash. The attack becomes stronger after a successful defensive action.' }, motion: motion('REACTIVE_COUNTER','Swift retaliatory slash.',['no stun','no knockback']) }),
  {
    id: 'v3-warrior-battle-focus', name: 'Battle Focus', jobId: 'warrior', jobTier: 'core', maxRank: 5, rankLevelRequirements: [20,40,46,52,58], spCostPerRank: 2, skillType: 'ACTIVE_BUFF', targeting: { targetType: 'self' }, resourceCost: { mana: 14 }, cooldown: 35, effects: { buffs: ['accuracy','criticalRate'] }, presentation: { description: 'Steady your breathing and sharpen your combat awareness, temporarily improving Accuracy and Critical Rate.' }, motion: motion('FOCUS_BUFF','Focused combat awareness pose.',['no raw physical damage'])
  },
  makeDamage({ id: 'v3-warrior-ground-breaker', name: 'Ground Breaker', maxRank: 5, rankLevelRequirements: [20,43,48,53,58], damageProfile: { physicalCoefficient: 1.05, statScaling: { str: .15 } }, resourceCost: { mana: 15 }, cooldown: 11, targeting: { targetType: 'area', radius: 4.3, maxTargets: 5 }, prerequisiteSkills: [{ skillId: 'v3-warrior-sweeping-slash', requiredRank: 4 }], effects: { tags: ['radial','no-stagger','no-stun','no-knockback'] }, baseDamageMinByRank: [45,56,67,78,90], baseDamageMaxByRank: [65,81,97,113,130], skillPowerFactor: 6, rankPowerFactorByRank: [1,1.05,1.1,1.15,1.2], presentation: { description: 'Raise your sword overhead and slam it into the ground, releasing a powerful shockwave that strikes nearby enemies.' }, motion: motion('OVERHEAD_GROUND_SLAM','Overhead sword ground slam.',['no spinning attack','no jump-heavy attack','no knockback','no repeated shockwave hits']) }),
  {
    id: 'v3-warrior-unbroken-stance', name: 'Unbroken Stance', jobId: 'warrior', jobTier: 'core', maxRank: 5, rankLevelRequirements: [25,47,51,55,59], spCostPerRank: 2, skillType: 'ACTIVE_BUFF', targeting: { targetType: 'self' }, resourceCost: { mana: 16 }, cooldown: 28, prerequisiteSkills: [{ skillId: 'v3-warrior-guard-stance', requiredRank: 3 }], effects: { buffs: ['damageReduction','displacementResistance'] }, presentation: { description: 'Brace yourself against incoming pressure, temporarily increasing your survivability and resistance to displacement.' }, motion: motion('BRACED_STANCE','Anchored survival stance.',['no max HP amplification','no stun immunity'])
  },
  makeDamage({ id: 'v3-warrior-crushing-finale', name: 'Crushing Finale', maxRank: 3, rankLevelRequirements: [20,56,59], damageProfile: { physicalCoefficient: 1.45, statScaling: { str: .22 } }, resourceCost: { mana: 20 }, cooldown: 14, prerequisiteSkills: [{ skillId: 'v3-warrior-armor-breaker', requiredRank: 3 }], effects: { tags: ['finisher','armor-break-payoff:10'] }, baseDamageMinByRank: [70,90,110], baseDamageMaxByRank: [100,127,155], skillPowerFactor: 6, rankPowerFactorByRank: [1,1.05,1.1], presentation: { description: 'Deliver a devastating finishing strike. The attack becomes more powerful against enemies weakened by your Armor Break.' }, motion: motion('HEAVY_FINISHING_SLASH','Heavy finishing sword slash.',['no stun','no knockback']) }),
];

const arrays: Record<string, { coefficients: number[]; str: number[]; dex?: number[]; mana: number[]; cooldown: number[]; duration?: number[]; range?: number[]; radius?: number[]; maxTargets?: number[] }> = {
  'v3-warrior-strike': { coefficients: [1,1.02,1.04,1.07,1.09,1.11,1.13,1.15,1.18,1.2], str: [.08,.09,.1,.11,.12,.13,.14,.15,.16,.18], mana: [5,5,6,6,7,7,8,8,9,10], cooldown: [3.2,3.15,3.1,3.05,3,2.95,2.9,2.85,2.8,2.8] },
  'v3-warrior-iron-charge': { coefficients: [.75,.8,.85,.9,.95], str: [.05,.07,.08,.1,.12], range: [6.5,7,7.5,8,8.5], mana: [8,9,10,11,12], cooldown: [8,7.6,7.2,6.8,6.5] },
  'v3-warrior-sweeping-slash': { coefficients: [.88,.92,.96,1,1.05,1.1,1.14,1.18], str: [.08,.1,.11,.13,.15,.17,.18,.2], radius: [4,4.1,4.2,4.3,4.4,4.5,4.65,4.8], maxTargets: [3,3,4,4,4,5,5,5], mana: [8,9,10,11,12,13,14,15], cooldown: [6,5.9,5.8,5.6,5.5,5.3,5.1,5] },
  'v3-warrior-guard-stance': { coefficients: [0,0,0,0,0], str: [0,0,0,0,0], mana: [10,11,12,13,14], cooldown: [18,17.5,17,16.5,16], duration: [5,5.5,6,6.5,7] },
  'v3-warrior-armor-breaker': { coefficients: [1,1.05,1.1,1.15,1.2], str: [.1,.12,.14,.16,.18], mana: [11,12,13,14,15], cooldown: [10,9.6,9.2,8.8,8.5] },
  'v3-warrior-battle-cry': { coefficients: [0,0,0,0,0], str: [0,0,0,0,0], mana: [14,15,16,17,18], cooldown: [35,35,35,35,35], duration: [20,22,24,26,28] },
  'v3-warrior-counter-slash': { coefficients: [.9,.94,.99,1.03,1.08], str: [.08,.095,.11,.125,.14], dex: [.08,.105,.13,.155,.18], mana: [9,10,11,12,13], cooldown: [6.5,6.25,6,5.75,5.5] },
  'v3-warrior-battle-focus': { coefficients: [0,0,0,0,0], str: [0,0,0,0,0], mana: [14,15,16,17,18], cooldown: [35,35,35,35,35], duration: [20,22,24,26,28] },
  'v3-warrior-ground-breaker': { coefficients: [1.05,1.12,1.2,1.27,1.35], str: [.15,.18,.22,.26,.3], radius: [4.3,4.5,4.65,4.8,5], maxTargets: [5,5,5,6,6], mana: [15,16,17,18,19], cooldown: [11,10.6,10.2,9.8,9.5] },
  'v3-warrior-unbroken-stance': { coefficients: [0,0,0,0,0], str: [0,0,0,0,0], mana: [16,18,20,22,24], cooldown: [28,27.5,27,26.5,26], duration: [8,8.5,9,9.5,10] },
  'v3-warrior-crushing-finale': { coefficients: [1.45,1.58,1.7], str: [.22,.27,.32], mana: [20,22,24], cooldown: [14,13,12] },
};

const adapter = (definition: SkillDefinitionV3): SkillDefinition => {
  const values = arrays[definition.id];
  const first = values?.coefficients[0] ?? 0;
  const rankValues = values?.coefficients.map((coefficient, index) => ({ physicalCoefficient: coefficient, statScaling: { str: values.str[index], ...(values.dex ? { dex: values.dex[index] } : {}) }, ...(values.duration ? { duration: values.duration[index] } : {}), ...(values.range ? { range: values.range[index] } : {}), ...(values.radius ? { radius: values.radius[index] } : {}), ...(values.maxTargets ? { maxTargets: values.maxTargets[index] } : {}), manaCost: values.mana[index], cooldown: values.cooldown[index] })) ?? [{ manaCost: definition.resourceCost?.mana ?? 0, cooldown: definition.cooldown ?? 0 }];
  const effect = definition.skillType === 'STANCE' || definition.skillType === 'ACTIVE_BUFF' ? 'buff' : definition.skillType === 'ACTIVE_MOBILITY' ? 'dash_damage' : definition.effects?.debuffs ? 'debuff' : 'damage';
  const rankEffects = definition.id === 'v3-warrior-counter-slash'
    ? [15,18,22,26,30].map((damagePercent) => ({ modifiers: [
      { id: `${definition.id}-blocked`, layer: 'payoff' as const, condition: { counter: ['blocked'] as ['blocked'] }, action: { damagePercent } },
      { id: `${definition.id}-parried`, layer: 'payoff' as const, condition: { counter: ['parried'] as ['parried'] }, action: { damagePercent } },
    ] }))
    : definition.id === 'v3-warrior-crushing-finale'
      ? [10,10,10].map(() => ({ modifiers: [{ id: `${definition.id}-armor-break`, layer: 'payoff' as const, payoffGroup: `${definition.id}-armor-break`, condition: { targetStatusesFromSource: ['armor_break'] }, action: { damagePercent: 10 } }] }))
      : undefined;
  const buffRankEffects = definition.id === 'v3-warrior-battle-cry'
    ? [3,4,5,6,7].map((value, index) => ({ temporaryBuffs: [{ duration: [20,22,24,26,28][index], modifier: { id: `${definition.id}-buff`, action: { damagePercent: value } } }] }))
    : definition.id === 'v3-warrior-guard-stance'
      ? [8,10,12,14,16].map((value, index) => ({ temporaryBuffs: [{ duration: [5,5.5,6,6.5,7][index], modifier: { id: `${definition.id}-buff`, stats: { percent: { damageReduction: value }, flat: { blockRate: [4,6,8,10,12][index] } } } }] }))
      : definition.id === 'v3-warrior-battle-focus'
        ? [5,7,9,11,13].map((value, index) => ({ temporaryBuffs: [{ duration: [20,22,24,26,28][index], modifier: { id: `${definition.id}-buff`, stats: { flat: { accuracy: value, criticalRate: [1,1.5,2,2.5,3][index] } } } }] }))
        : definition.id === 'v3-warrior-unbroken-stance'
          ? [3,4,5,6,7].map((value, index) => ({ temporaryBuffs: [{ duration: [8,8.5,9,9.5,10][index], modifier: { id: `${definition.id}-buff`, stats: { percent: { damageReduction: value } }, incoming: { knockbackMultiplier: 1 - [15,20,25,30,35][index] / 100 } } }] }))
          : undefined;
  return {
    id: definition.id, name: definition.name, description: definition.presentation?.description ?? '', job: 'warrior', specialization: null,
    slot: 1, unlockLevel: definition.unlockLevel ?? definition.rankLevelRequirements?.[0] ?? 15, maxLevel: definition.maxRank,
    manaCost: definition.resourceCost?.mana ?? 0, cooldown: definition.cooldown ?? 0, castingTime: .45, baseDamage: 0, scalingStat: 'attack', damageCoefficient: 0,
    combatScaling: { physical: 1, magic: 0, damageType: 'physical' }, physicalCoefficient: first, statScaling: definition.damageProfile?.statScaling, stunProfile: definition.stunProfile, magicCoefficient: 0, damageType: 'physical', progressionMode: 'rank_values', rankValues, knockbackStrength: 0,
    targetType: definition.targeting?.targetType === 'frontal_arc' ? 'frontal_arc' : definition.targeting?.targetType === 'area' ? 'area' : definition.targeting?.targetType === 'self' ? 'self' : 'single', range: definition.targeting?.range ?? 0, areaRadius: definition.targeting?.radius ?? 0, angle: definition.id === 'v3-warrior-sweeping-slash' ? 120 : undefined, maxTargets: definition.targeting?.maxTargets, dash: definition.id === 'v3-warrior-iron-charge' ? { stopDistance: 1.2, impactRange: 1.0 } : undefined,
    duration: 0, statusEffect: definition.id === 'v3-warrior-armor-breaker' ? 'defenseDown' : null, effect, animation: effect === 'buff' ? 'magic_cast' : 'basic_attack', visualEffect: effect === 'buff' ? 'barrier' : '', soundEffect: '', weaponRequirement: (definition.weaponRequirement ?? []) as SkillDefinition['weaponRequirement'], masteryOptions: [], usableFromHotbar: true, hotbarCategory: 'primary', skillType: 'active', tags: ['v3-warrior'],
    prerequisiteSkillIds: definition.prerequisiteSkills?.map((entry) => entry.skillId), counterPolicy: definition.id === 'v3-warrior-counter-slash' ? { accepted: ['blocked','parried'], windowMs: 2500 } : undefined,
    rankEffects: rankEffects ?? buffRankEffects,
    armorBreakStrengthByRank: definition.id === 'v3-warrior-armor-breaker' ? [...ARMOR_BREAK_REDUCTION_BY_RANK] : undefined,
    statuses: definition.id === 'v3-warrior-armor-breaker' ? [{ id: 'armor_break', duration: 8 }] : [],
  };
};

export const WARRIOR_V3_RUNTIME_SKILLS: readonly SkillDefinition[] = WARRIOR_V3_SKILLS.map(adapter);
export const WARRIOR_V3_SKILL_MAP = Object.fromEntries(WARRIOR_V3_SKILLS.map((skill) => [skill.id, skill])) as Record<string, SkillDefinitionV3>;
export const WARRIOR_V3_RUNTIME_MAP = Object.fromEntries(WARRIOR_V3_RUNTIME_SKILLS.map((skill) => [skill.id, skill]));
export const WARRIOR_V3_JOB = { id: 'warrior', tier: 'core' as const, parent: 'adventurer' };

export function warriorV3StateAfterCoreChange(previous: SkillProgressionV3State): SkillProgressionV3State {
  return { ...previous, skillRanks: { ...previous.grantedRanks }, chosenCoreJob: 'warrior', chosenSpecialization: null, chosenAdvancedJob: null };
}
