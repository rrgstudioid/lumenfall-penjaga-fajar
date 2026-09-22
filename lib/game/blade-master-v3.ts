import type { SkillDefinition, SkillHit, SkillRankValues } from './skills.ts';
import type { SkillDefinitionV3, SkillProgressionV3State } from './skill-progression-v3.ts';
import type { ResolvedSkillAction } from './skill-action.ts';
import type { ItemData } from './items.ts';

const swords = ['one_hand_sword', 'two_hand_sword'];
const anySword = swords;
const dualSword = ['dual_sword'];
const motion = (motionArchetype: string, motionNotes: string, animationNoGo: string[]) => ({ motionArchetype, motionNotes, animationNoGo });
const rankValues = (coefficients: number[], str: number[], dex: number[], mana: number[], cooldown: number[]) => coefficients.map((physicalCoefficient, index) => ({ physicalCoefficient, statScaling: { str: str[index], dex: dex[index] }, manaCost: mana[index], cooldown: cooldown[index] }));

export const BLADE_MASTER_V3_SKILLS: readonly SkillDefinitionV3[] = [
  {
    id: 'v3-blade-master-twin-blade-mastery', name: 'Twin Blade Mastery', jobId: 'blade_master', jobTier: 'specialization', unlockLevel: 60, maxRank: 5,
    rankLevelRequirements: [60,64,68,73,78], spCostPerRank: 4, skillType: 'MASTERY', targeting: { targetType: 'self' },
    effects: { buffs: ['dual_wield_unlock', 'dual_wield_accuracy', 'blade_master_mana_efficiency'] },
    presentation: { description: 'Master the art of fighting with two One-Hand Swords. Rank 1 unlocks Dual Wield, while higher ranks improve your control and efficiency with twin-blade combat.' },
    motion: motion('MASTERY_PASSIVE', 'Passive twin-blade control and efficiency.', ['no active attack', 'no raw weapon attack', 'no raw STR', 'no raw crit damage']), status: 'DESIGN_LOCKED',
  },
  {
    id: 'v3-blade-master-twin-assault', name: 'Twin Assault', jobId: 'blade_master', jobTier: 'specialization', maxRank: 8,
    rankLevelRequirements: [60,63,65,68,70,73,76,79], spCostPerRank: 3, skillType: 'ACTIVE_DAMAGE', weaponRequirement: dualSword,
    prerequisiteSkills: [{ skillId: 'v3-blade-master-twin-blade-mastery', requiredRank: 1 }], targeting: { targetType: 'single', range: 3.8 },
    damageProfile: { physicalCoefficient: .8, statScaling: { str: .08, dex: .10 } }, resourceCost: { mana: 10 }, cooldown: 4.5,
    presentation: { description: 'Strike a single enemy with both swords in rapid succession, delivering two precise hits.' }, motion: motion('DUAL_ALTERNATING_STRIKE', 'Main-hand slash immediately followed by an off-hand slash.', ['no spin','no AoE','no knockback','no simultaneous giant impact','no duplicated full character damage per hit']),
    effects: { tags: ['blade-master-damage','dual-sequence','flow-eligible','no-stun','no-knockback'] },
  },
  {
    id: 'v3-blade-master-blade-rush', name: 'Blade Rush', jobId: 'blade_master', jobTier: 'specialization', maxRank: 5,
    rankLevelRequirements: [62,66,70,74,79], spCostPerRank: 3, skillType: 'ACTIVE_MOBILITY', weaponRequirement: anySword,
    prerequisiteSkills: [{ skillId: 'v3-warrior-iron-charge', requiredRank: 3 }], targeting: { targetType: 'single', range: 6.5 },
    damageProfile: { physicalCoefficient: .75, statScaling: { str: .05, dex: .12 } }, resourceCost: { mana: 10 }, cooldown: 7.5,
    effects: { movement: 'technical_pass_through', tags: ['blade-rush','opens-flow','no-stun','no-knockback'] },
    presentation: { description: 'Follow your charge training with a rapid repositioning strike, slipping past the enemy and opening a short window for your next technique.' }, motion: motion('TECHNICAL_PASS_THROUGH', 'Collision-safe pass-through toward an endpoint approximately 1.5m beyond the target.', ['no teleport','no knockback','no Iron Charge Stun']),
  },
  {
    id: 'v3-blade-master-counterflow', name: 'Counterflow', jobId: 'blade_master', jobTier: 'specialization', maxRank: 5,
    rankLevelRequirements: [63,67,71,75,79], spCostPerRank: 3, skillType: 'ACTIVE_DAMAGE', weaponRequirement: anySword,
    prerequisiteSkills: [{ skillId: 'v3-warrior-counter-slash', requiredRank: 3 }], targeting: { targetType: 'single', range: 3.8 },
    damageProfile: { physicalCoefficient: 1, statScaling: { str: .08, dex: .16 } }, resourceCost: { mana: 12 }, cooldown: 8,
    stunProfile: { chance: [1,1,1,1,1], pveDuration: .8, pvpDuration: .4, minimumTravelDistance: 0, targetPolicy: 'NORMAL' },
    effects: { tags: ['counterflow','counter-required','opens-flow','stun-on-impact','no-knockback'] },
    presentation: { description: 'Turn a successful defense into an immediate counterattack, striking with precise timing and briefly disrupting the enemy.' }, motion: motion('PRECISION_COUNTER', 'A precise counterattack after a valid defensive event.', ['no knockback','no AoE']),
  },
  {
    id: 'v3-blade-master-blade-focus', name: 'Blade Focus', jobId: 'blade_master', jobTier: 'specialization', maxRank: 5,
    rankLevelRequirements: [64,68,72,76,80], spCostPerRank: 3, skillType: 'ACTIVE_BUFF', weaponRequirement: anySword, targeting: { targetType: 'self' },
    resourceCost: { mana: 16 }, cooldown: 35, effects: { buffs: ['blade_focus','flow_extension'] },
    presentation: { description: 'Sharpen your sword technique and combat perception, improving precision and making chained techniques easier to execute.' }, motion: motion('BLADE_FOCUS_STANCE', 'Focused technical sword stance.', ['no raw physical damage','no weapon ATK','no STR/DEX increase']),
  },
  {
    id: 'v3-blade-master-cross-sever', name: 'Cross Sever', jobId: 'blade_master', jobTier: 'specialization', maxRank: 5,
    rankLevelRequirements: [66,69,72,76,80], spCostPerRank: 3, skillType: 'ACTIVE_DAMAGE', weaponRequirement: dualSword,
    prerequisiteSkills: [{ skillId: 'v3-blade-master-twin-assault', requiredRank: 3 }], targeting: { targetType: 'single', range: 3.8 },
    damageProfile: { physicalCoefficient: 1.2, statScaling: { str: .12, dex: .18 } }, resourceCost: { mana: 16 }, cooldown: 8,
    effects: { tags: ['blade-master-damage','dual-combined','flow-eligible','no-stun','no-knockback'] },
    presentation: { description: 'Cross both swords through a single enemy in a powerful synchronized strike, combining both blades into one devastating impact.' },
    motion: motion('DUAL_CROSS_SLASH', 'Both swords cross through the target in an X-shaped synchronized strike.', ['no spin','no AoE','no knockback','no duplicated shared-core calculation']),
  },
  {
    id: 'v3-blade-master-piercing-sequence', name: 'Piercing Sequence', jobId: 'blade_master', jobTier: 'specialization', maxRank: 5,
    rankLevelRequirements: [68,71,74,77,80], spCostPerRank: 3, skillType: 'ACTIVE_DAMAGE', weaponRequirement: anySword,
    prerequisiteSkills: [{ skillId: 'v3-blade-master-blade-rush', requiredRank: 2 }, { skillId: 'v3-warrior-armor-breaker', requiredRank: 3 }], targeting: { targetType: 'single', range: 3.8 },
    damageProfile: { physicalCoefficient: 1.15, statScaling: { str: .08, dex: .20 } }, resourceCost: { mana: 15 }, cooldown: 8.5,
    effects: { tags: ['blade-master-damage','single-main','flow-eligible','no-stun','no-knockback'] },
    presentation: { description: 'Execute a precise three-step assault against a weakened enemy, exploiting openings created by your mobility and Armor Break.' },
    motion: motion('THREE_STEP_PRECISION_CHAIN', 'Three distinct precise strikes into a single target.', ['no AoE','no knockback','no spin loop','no teleport','no offhand raw attack duplication under Dual Wield']),
  },
  {
    id: 'v3-blade-master-tempo-drive', name: 'Tempo Drive', jobId: 'blade_master', jobTier: 'specialization', maxRank: 5,
    rankLevelRequirements: [71,73,75,78,80], spCostPerRank: 3, skillType: 'ACTIVE_BUFF', weaponRequirement: dualSword,
    prerequisiteSkills: [{ skillId: 'v3-blade-master-twin-assault', requiredRank: 4 }], targeting: { targetType: 'self' },
    // The 7B contract does not define Mana/CD for Tempo Drive. The adapter's
    // neutral 0 defaults keep it castable without inventing a balance value.
    effects: { buffs: ['tempo_drive'] },
    presentation: { description: 'Consume your accumulated Tempo to enter a short burst of heightened sword control, increasing attack speed and improving the efficiency of your dual-blade techniques.' },
    motion: motion('TEMPO_RELEASE', 'Release accumulated twin-blade tempo into a short control burst.', ['no transformation','no raw-damage explosion','no invulnerability','no Stun','no forced movement']),
  },
  {
    id: 'v3-blade-master-blade-tempest', name: 'Blade Tempest', jobId: 'blade_master', jobTier: 'specialization', maxRank: 3,
    rankLevelRequirements: [75,78,80], spCostPerRank: 5, skillType: 'ULTIMATE', weaponRequirement: dualSword,
    prerequisiteSkills: [{ skillId: 'v3-blade-master-twin-blade-mastery', requiredRank: 3 }], jobInvestmentRequirement: { jobId: 'blade_master', minimumSP: 18 }, targeting: { targetType: 'single', range: 3.8 },
    damageProfile: { physicalCoefficient: 1.75, statScaling: { str: .18, dex: .28 } }, resourceCost: { mana: 36 }, cooldown: 70,
    effects: { tags: ['blade-master-damage','dual-sequence','flow-eligible','no-stun','no-knockback'] },
    presentation: { description: 'Unleash a relentless sequence of twin-blade strikes against a single enemy, ending with a devastating synchronized finishing blow.' },
    motion: motion('ULTIMATE_TWIN_BLADE_SEQUENCE', 'Rapid readable alternating slashes followed by a powerful crossed-blade finisher.', ['no AoE','no endless spin','no giant leap','no knockback','no duplicated full-character damage per hit']),
  },
];

const arrays: Record<string, { coefficients: number[]; str: number[]; dex: number[]; mana: number[]; cooldown: number[] }> = {
  'v3-blade-master-twin-assault': { coefficients: [.8,.84,.88,.93,.98,1.03,1.08,1.12], str: [.08,.09,.10,.11,.12,.14,.16,.18], dex: [.10,.11,.12,.14,.16,.18,.20,.22], mana: [10,11,12,13,14,15,16,17], cooldown: [4.5,4.4,4.3,4.2,4.1,4,3.9,3.8] },
  'v3-blade-master-blade-rush': { coefficients: [.75,.82,.9,.98,1.06], str: [.05,.06,.07,.08,.10], dex: [.12,.15,.18,.21,.24], mana: [10,11,12,13,14], cooldown: [7.5,7.1,6.7,6.3,6] },
  'v3-blade-master-counterflow': { coefficients: [1,1.06,1.12,1.18,1.25], str: [.08,.09,.10,.12,.14], dex: [.16,.19,.22,.26,.30], mana: [12,13,14,15,16], cooldown: [8,7.6,7.2,6.8,6.5] },
  'v3-blade-master-blade-focus': { coefficients: [0,0,0,0,0], str: [0,0,0,0,0], dex: [0,0,0,0,0], mana: [16,17,18,19,20], cooldown: [35,35,35,35,35] },
  'v3-blade-master-cross-sever': { coefficients: [1.2,1.28,1.35,1.43,1.5], str: [.12,.14,.16,.18,.20], dex: [.18,.21,.24,.27,.30], mana: [16,17,18,20,21], cooldown: [8,7.8,7.6,7.4,7.2] },
  'v3-blade-master-piercing-sequence': { coefficients: [1.15,1.25,1.35,1.45,1.55], str: [.08,.09,.10,.12,.14], dex: [.20,.24,.28,.32,.36], mana: [15,16,17,18,20], cooldown: [8.5,8.1,7.7,7.3,7] },
  'v3-blade-master-tempo-drive': { coefficients: [0,0,0,0,0], str: [0,0,0,0,0], dex: [0,0,0,0,0], mana: [0,0,0,0,0], cooldown: [0,0,0,0,0] },
  'v3-blade-master-blade-tempest': { coefficients: [1.75,2,2.25], str: [.18,.22,.26], dex: [.28,.34,.40], mana: [36,40,44], cooldown: [70,68,65] },
};

function adapter(definition: SkillDefinitionV3): SkillDefinition {
  const values = arrays[definition.id];
  const ranks = values ? rankValues(values.coefficients, values.str, values.dex, values.mana, values.cooldown) : [{ manaCost: 16, cooldown: 35 }];
  const rankEffects = definition.id === 'v3-blade-master-twin-blade-mastery'
    ? [2,4,6,8,10].map((accuracy, index) => ({ modifiers: [{ id: `${definition.id}-accuracy-r${index + 1}`, stats: { flat: { accuracy } } }] }))
    : definition.id === 'v3-blade-master-twin-assault'
    ? values!.coefficients.map((_, index) => ({ hitSequence: [
        { delay: 0, physicalCoefficient: values!.coefficients[index] / 2, weaponHand: 'MAIN' as const, sharedContributionWeight: .5, weaponContributionCoefficient: 1 },
        { delay: .18, physicalCoefficient: values!.coefficients[index] / 2, weaponHand: 'OFF' as const, sharedContributionWeight: .5, weaponContributionCoefficient: 1 },
      ] as SkillHit[] }))
    : definition.id === 'v3-blade-master-blade-focus'
      ? [20,22,24,26,28].map((duration, index) => ({ temporaryBuffs: [{ duration, modifier: { id: 'v3-blade-master-blade-focus-buff', stats: { flat: { accuracy: [6,9,12,15,18][index], criticalRate: [2,3,4,5,6][index] } } } }] }))
    : definition.id === 'v3-blade-master-piercing-sequence'
      ? values!.coefficients.map((coefficient) => ({ hitSequence: ([.3,.3,.4] as const).map((weight, index) => ({ delay: index * .16, physicalCoefficient: coefficient * weight, weaponHand: 'MAIN' as const, sharedContributionWeight: weight, weaponContributionCoefficient: 1 })) }))
    : definition.id === 'v3-blade-master-cross-sever'
      ? values!.coefficients.map((coefficient) => ({ hitSequence: [{ delay: 0, physicalCoefficient: coefficient, weaponHand: 'BOTH' as const, sharedContributionWeight: 1, weaponContributionCoefficient: 1 }] }))
    : definition.id === 'v3-blade-master-blade-tempest'
      ? [[.25,.25,.25,.25,.75],[.28,.28,.28,.28,.88],[.30,.30,.30,.30,1.05]].map((hits) => ({ hitSequence: hits.map((coefficient, index) => ({ delay: index * .18, physicalCoefficient: coefficient, weaponHand: index === 4 ? 'BOTH' as const : index % 2 === 0 ? 'MAIN' as const : 'OFF' as const, sharedContributionWeight: index === 4 ? .4 : .15, weaponContributionCoefficient: 1 })) }))
      : undefined;
  const effect = definition.skillType === 'ACTIVE_BUFF' ? 'buff' : definition.skillType === 'ACTIVE_MOBILITY' ? 'dash_damage' : 'damage';
  return {
    id: definition.id, name: definition.name, description: definition.presentation?.description ?? '', job: 'warrior', specialization: 'blade_master', slot: 1,
    unlockLevel: definition.unlockLevel ?? definition.rankLevelRequirements?.[0] ?? 60, maxLevel: definition.maxRank, manaCost: definition.resourceCost?.mana ?? 0,
    cooldown: definition.cooldown ?? 0, castingTime: .45, baseDamage: 0, scalingStat: 'attack', damageCoefficient: 0, combatScaling: { physical: 1, magic: 0, damageType: 'physical' },
    physicalCoefficient: definition.damageProfile?.physicalCoefficient ?? 0, statScaling: definition.damageProfile?.statScaling, magicCoefficient: 0, damageType: 'physical', progressionMode: 'rank_values', rankValues: ranks, canCrit: definition.skillType === 'ACTIVE_DAMAGE' || definition.skillType === 'ULTIMATE',
    rankEffects, targetType: definition.targeting?.targetType === 'self' ? 'self' : 'single', range: definition.targeting?.range ?? 0, areaRadius: 0, maxTargets: 1, duration: 0, statusEffect: null,
    effect, animation: effect === 'buff' ? 'magic_cast' : 'basic_attack', visualEffect: effect === 'buff' ? 'barrier' : '', soundEffect: '', weaponRequirement: (definition.weaponRequirement ?? []) as SkillDefinition['weaponRequirement'], masteryOptions: [],
    usableFromHotbar: definition.skillType !== 'MASTERY', hotbarCategory: 'primary', skillType: 'active', tags: ['v3-blade-master', ...(definition.effects?.tags ?? [])],
    prerequisiteSkillIds: definition.prerequisiteSkills?.map((entry) => entry.skillId), stunProfile: definition.stunProfile, counterPolicy: definition.id === 'v3-blade-master-counterflow' ? { accepted: ['blocked','parried'], windowMs: 2500 } : undefined,
    dash: definition.id === 'v3-blade-master-blade-rush' ? { stopDistance: 1.2, impactRange: 1 } : undefined,
    knockbackStrength: 0, statuses: [],
  };
}

export const BLADE_MASTER_V3_RUNTIME_SKILLS: readonly SkillDefinition[] = BLADE_MASTER_V3_SKILLS.map(adapter);
export const BLADE_MASTER_V3_SKILL_MAP = Object.fromEntries(BLADE_MASTER_V3_SKILLS.map((skill) => [skill.id, skill])) as Record<string, SkillDefinitionV3>;
export const BLADE_MASTER_V3_RUNTIME_MAP = Object.fromEntries(BLADE_MASTER_V3_RUNTIME_SKILLS.map((skill) => [skill.id, skill]));
export const BLADE_MASTER_V3_JOB = { id: 'blade_master', tier: 'specialization' as const, parent: 'warrior' };
export const BLADE_MASTER_TEMPO_LIFETIME = [5, 5.5, 6, 6.5, 7] as const;
export const BLADE_MASTER_FLOW_CONSUMERS = new Set(['v3-blade-master-twin-assault','v3-blade-master-cross-sever','v3-blade-master-piercing-sequence','v3-blade-master-blade-tempest']);
export const BLADE_MASTER_DUAL_MANA_SKILLS = new Set(['v3-blade-master-twin-assault','v3-blade-master-cross-sever','v3-blade-master-blade-tempest']);
export const BLADE_MASTER_TEMPO_GENERATORS = new Set(['v3-blade-master-twin-assault','v3-blade-master-cross-sever']);
/** Compose the explicitly declared per-hand layers after the ordinary V3 resolver.
 * Full item/Rune character stats stay in shared core; only raw item Weapon ATK is hand-local. */
export function composeBladeWeaponHits(action: ResolvedSkillAction, physicalAttack: number, main: ItemData | null, off: ItemData | null, weaponFactor = 1) {
  if (!action.hitSequence.some(hit => hit.weaponHand)) return action;
  const raw = (item: ItemData | null) => (item?.baseStats.attack ?? 0) * (1 + (item?.enhancementLevel ?? 0) * .08) * weaponFactor;
  const mainAttack = raw(main), offAttack = raw(off);
  const sharedCore = physicalAttack - mainAttack - (action.resolvedWeaponStyle === 'dual_sword' ? offAttack : 0);
  const totalCoefficient = action.hitSequence.reduce((sum, hit) => sum + hit.physicalCoefficient, 0);
  action.hitSequence = action.hitSequence.map(hit => {
    const weapon = hit.weaponHand === 'BOTH' ? mainAttack + offAttack : hit.weaponHand === 'OFF' ? offAttack : mainAttack;
    return { ...hit, composedPhysicalPower: sharedCore * totalCoefficient * (hit.sharedContributionWeight ?? 1) + weapon * hit.physicalCoefficient * (hit.weaponContributionCoefficient ?? 1) };
  });
  return action;
}
export function bladeMasterV3StateAfterSpecialization(previous: SkillProgressionV3State): SkillProgressionV3State {
  return { ...previous, skillRanks: { ...(previous.grantedRanks ?? {}) }, chosenCoreJob: 'warrior', chosenSpecialization: 'blade_master', chosenAdvancedJob: null };
}
export function bladeMasterTwinMasteryRank(hero: { specialization: string | null; skillProgressionV3?: SkillProgressionV3State } | null | undefined) {
  return hero?.specialization === 'blade_master' ? (hero.skillProgressionV3?.skillRanks['v3-blade-master-twin-blade-mastery'] ?? 0) : 0;
}
export function bladeMasterDualWieldActive(hero: { specialization: string | null; skillProgressionV3?: SkillProgressionV3State } | null | undefined) { return bladeMasterTwinMasteryRank(hero) >= 1; }
