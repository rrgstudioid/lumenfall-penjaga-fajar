import type { SkillDefinitionV3, SkillProfileV3 } from './skill-progression-v3.ts';
import type { WeaponContributionMode } from './dual-wield.ts';

/** Phase 3 canonical numbers. Phase 4 adapters in thief-runtime.ts consume these
 * arrays without replacing or migrating legacy Thief V2. */
export const THIEF_V3_SKILL_POWER_FACTOR = 6;
export const THIEF_V3_SP_PER_RANK = 2;
export const THIEF_V3_FAMILY_IDS = [
  'dagger_training', 'quick_stab', 'twin_fang', 'quickstep', 'thief_evasion',
  'weakpoint', 'positional_strike', 'fan_of_blades', 'fatal_opening',
] as const;
export type ThiefFamilyId = typeof THIEF_V3_FAMILY_IDS[number];
export const THIEF_V3_ACTIVE_FAMILY_IDS = THIEF_V3_FAMILY_IDS.filter(id => id !== 'dagger_training');
export const THIEF_V3_DAMAGE_CONTRACT = {
  baseRoll: 'ONE_PER_CAST',
  skillPowerFactor: THIEF_V3_SKILL_POWER_FACTOR,
  bonusStatBaseline: 15,
  bonusStatFloor: 0,
  rankPowerBase: 1,
  rankPowerPerAdditionalRank: 0.05,
  formula: '(BaseRoll * 6 + PATK * PhysicalCoefficient + BonusSTR * STRCoefficient + BonusDEX * DEXCoefficient) * RankPowerFactor',
  sequenceDistribution: 'DISTRIBUTE_TOTAL_CORE_AND_SCALING_BY_HIT_WEIGHT',
  independentPerHit: ['ACCURACY_EVASION', 'CRITICAL', 'DEFENSE'],
  currentDamagePreview: false,
} as const;

/** Percent and percentage-point suffixes intentionally distinguish units. */
export type ThiefRankArrays = {
  baseDamageMin?: number[];
  baseDamageMax?: number[];
  physicalCoefficient?: number[];
  bonusStrCoefficient?: number[];
  bonusDexCoefficient?: number[];
  mana?: number[];
  cooldownSeconds?: number[];
  durationSeconds?: number[];
  accuracy?: number[];
  coreThiefManaReductionPercent?: number[];
  attackSpeedPercent?: number[];
  criticalRatePercentagePoints?: number[];
  skillAccuracy?: number[];
  evasion?: number[];
  movementSpeedPercent?: number[];
  movementRangeMeters?: number[];
  repositionDistanceMeters?: number[];
  weakpointCritPercentagePoints?: number[];
  ownWeakpointFinalDamagePercent?: number[];
  flankFinalDamagePercent?: number[];
  rearFinalDamagePercent?: number[];
  radiusMeters?: number[];
  targetCap?: number[];
};

export type ThiefSkillMechanics = {
  weaponPolicy: 'AT_LEAST_ONE_DAGGER' | 'DUAL_DAGGERS' | 'NOT_SPECIFIED';
  weaponMode?: WeaponContributionMode;
  weaponModeSource?: 'CONTRACT' | 'EXISTING_SINGLE_MAIN_DEFAULT';
  hits?: { weaponHand: 'MAIN' | 'OFF'; weight: number }[];
  baseRollPolicy?: 'ONE_PER_CAST';
  passiveEffectPolicy?: 'REPLACE_PREDECESSOR';
  coreThiefManaFamilyWhitelist?: readonly ThiefFamilyId[];
  extendPassiveToSpecializationSkills?: false;
  weakpoint?: {
    statusId: 'weakpoint'; skillFamilyId: 'weakpoint'; ownership: 'CASTER';
    application: 'SUCCESSFUL_DAMAGING_IMPACT'; globalDefenseReduction: false; partyBenefit: false;
  };
  weakpointPayoff?: { statusId: 'weakpoint'; sourceFamilyId: 'weakpoint'; ownership: 'CASTER'; modifier: 'FINAL_DAMAGE_PERCENT' };
  positional?: { reference: 'TARGET_FACING_WORLD_SPACE'; regions: readonly ['FRONT', 'FLANK', 'REAR']; frontBonusPercent: 0; payoffCombination: 'ONE_REGION_ONLY' };
  movement?: {
    approach?: 'CLOSE_DISTANCE';
    after?: 'SEQUENCE' | 'IMPACT_ATTEMPT';
    direction?: 'PLAYER_INPUT_LEFT_RIGHT' | 'BACKWARD';
    invulnerability: false; iframe: false; teleportImmunity: false; hardCCImmunity: false;
  };
  areaShape?: 'RADIAL';
  /** Deliberately unresolved, not zero-valued fallback gameplay. */
  pendingRuntimeDecisions?: string[];
};

export type ThiefSkillDefinitionV3 = SkillDefinitionV3 & {
  familyId: ThiefFamilyId;
  rankData: ThiefRankArrays;
  mechanics: ThiefSkillMechanics;
  branchIdentity?: string;
  runtimeAvailability: 'CORE_THIEF_RUNTIME';
};

/** A prepared record shape, not a live debuff handler or save field. Each actor
 * keeps its own record; no global Defense reduction or party-wide vulnerability. */
export type ThiefWeakpointApplication = {
  actorId: string;
  skillFamilyId: 'weakpoint';
  sourceSkillId: string;
  appliedAt: number;
  expiresAt: number;
  critBonusPercentagePoints: number;
};

const id = (slug: string) => `v3-thief-${slug}`;
type NodeInput = {
  slug: string; name: string; gate: number; ranks: ThiefRankArrays;
  description: string; branchIdentity?: string;
  prerequisites?: { skillId: string; requiredRank: number }[];
  mechanics?: Partial<ThiefSkillMechanics>;
};
type FamilyInput = {
  familyId: ThiefFamilyId; role: 'ACTIVE' | 'PASSIVE' | 'UTILITY';
  skillType: SkillDefinitionV3['skillType']; mechanics: ThiefSkillMechanics;
  root: NodeInput; upgrade: NodeInput; branches: [NodeInput, NodeInput];
};
const mainDagger: ThiefSkillMechanics = { weaponPolicy: 'AT_LEAST_ONE_DAGGER', weaponMode: 'SINGLE_MAIN', weaponModeSource: 'CONTRACT', hits: [{ weaponHand: 'MAIN', weight: 1 }], baseRollPolicy: 'ONE_PER_CAST' };
// Positional/Fatal do not explicitly name a mode: keep Phase 1's single-main
// default, never infer an extra offhand hit from the equipped Dual Dagger label.
const defaultMainDagger: ThiefSkillMechanics = { ...mainDagger, weaponModeSource: 'EXISTING_SINGLE_MAIN_DEFAULT' };
const twinDaggers: ThiefSkillMechanics = { weaponPolicy: 'DUAL_DAGGERS', weaponMode: 'DUAL_SEQUENCE', weaponModeSource: 'CONTRACT', hits: [{ weaponHand: 'MAIN', weight: .45 }, { weaponHand: 'OFF', weight: .55 }], baseRollPolicy: 'ONE_PER_CAST' };
const movementSafety = { invulnerability: false, iframe: false, teleportImmunity: false, hardCCImmunity: false } as const;

function makeFamily(input: FamilyInput): ThiefSkillDefinitionV3[] {
  const nodes = [input.root, input.upgrade, ...input.branches];
  return nodes.map((node, index) => {
    const maxRank = index === 0 ? 5 : 3;
    const predecessor = index === 0 ? undefined : index === 1 ? input.root : input.upgrade;
    const predecessorRank = index === 1 ? 5 : 3;
    const rankData = node.ranks;
    const mechanics = { ...input.mechanics, ...node.mechanics };
    const damaging = rankData.baseDamageMin !== undefined;
    const damageProfile: SkillDefinitionV3['damageProfile'] = damaging ? {
      weaponMode: mechanics.weaponMode,
      physicalCoefficient: rankData.physicalCoefficient![0],
      statScaling: { str: rankData.bonusStrCoefficient![0], dex: rankData.bonusDexCoefficient![0] },
      hits: mechanics.hits?.map(hit => ({
        weaponHand: hit.weaponHand, coefficient: hit.weight,
        sharedContributionWeight: hit.weight, weaponContributionCoefficient: hit.weight,
      })),
    } : undefined;
    return {
      id: id(node.slug), name: node.name, jobId: 'thief', jobTier: 'core',
      jobRequirement: 'thief', ancestryRequirement: ['adventurer'],
      familyId: input.familyId, familyRole: input.role,
      familyStage: index === 0 ? 'ROOT' : index === 1 ? 'UPGRADE' : 'BRANCH',
      ...(predecessor ? { familyPredecessorId: id(predecessor.slug), replacesSkillId: id(predecessor.slug), familyPredecessorRank: predecessorRank } : {}),
      familyNextOptions: index === 0 ? [id(input.upgrade.slug)] : index === 1 ? input.branches.map(branch => id(branch.slug)) : [],
      ...(index >= 2 ? { branchGroupId: `${input.familyId}:core_branch`, branchChoiceId: node.slug, isMutuallyExclusive: true } : {}),
      unlockLevel: node.gate, maxRank,
      // Only a node gate was specified. Do not invent extra per-rank levels.
      rankLevelRequirements: Array(maxRank).fill(node.gate), spCostPerRank: THIEF_V3_SP_PER_RANK,
      prerequisiteSkills: [
        ...(predecessor ? [{ skillId: id(predecessor.slug), requiredRank: predecessorRank }] : []),
        ...(node.prerequisites ?? []),
      ],
      ...(mechanics.weaponPolicy === 'DUAL_DAGGERS' ? { weaponRequirement: ['dual_dagger'] }
        : mechanics.weaponPolicy === 'AT_LEAST_ONE_DAGGER' ? { weaponRequirement: ['dagger', 'dual_dagger'] } : {}),
      skillType: input.skillType,
      targeting: { targetType: input.role === 'PASSIVE' || input.role === 'UTILITY' ? 'self' : mechanics.areaShape ? 'area' : 'single',
        ...(rankData.radiusMeters ? { radius: rankData.radiusMeters[0], maxTargets: rankData.targetCap![0] } : {}),
      },
      ...(damaging ? { damageProfile, statScaling: damageProfile!.statScaling,
        baseDamageMinByRank: rankData.baseDamageMin, baseDamageMaxByRank: rankData.baseDamageMax,
        skillPowerFactor: THIEF_V3_SKILL_POWER_FACTOR,
        rankPowerFactorByRank: Array.from({ length: maxRank }, (_, i) => 1 + .05 * i),
      } : {}),
      ...(rankData.mana ? { resourceCost: { mana: rankData.mana[0] } } : {}),
      ...(rankData.cooldownSeconds ? { cooldown: rankData.cooldownSeconds[0] } : {}),
      effects: { crowdControl: [], tags: ['v3-thief', 'core-thief-canonical-data', 'no-stun', 'no-knockback', 'no-poison', 'no-ambush'],
        ...(mechanics.weakpoint ? { debuffs: ['weakpoint'] } : {}),
        ...(input.familyId === 'thief_evasion' ? { buffs: ['evasion', ...(rankData.movementSpeedPercent ? ['movementSpeed'] : [])] } : {}),
      },
      ...(mechanics.weakpoint ? {
        familyMechanics: { weakpoint: { eligible: true, sourceScope: 'FAMILY' as const } },
      } : {}),
      presentation: { description: node.description }, branchIdentity: node.branchIdentity,
      status: 'IMPLEMENTED', runtimeAvailability: 'CORE_THIEF_RUNTIME',
      rankData, mechanics,
    };
  });
}

const families: FamilyInput[] = [
  {
    familyId: 'dagger_training', role: 'PASSIVE', skillType: 'PASSIVE',
    mechanics: { weaponPolicy: 'NOT_SPECIFIED', passiveEffectPolicy: 'REPLACE_PREDECESSOR', coreThiefManaFamilyWhitelist: THIEF_V3_ACTIVE_FAMILY_IDS, extendPassiveToSpecializationSkills: false },
    root: { slug: 'dagger-training', name: 'Dagger Training', gate: 15, description: 'Improve Accuracy and Mana efficiency for Core Thief techniques.',
      ranks: { accuracy: [2,4,6,8,10], coreThiefManaReductionPercent: [1,2,3,4,5] } },
    upgrade: { slug: 'dagger-expertise', name: 'Dagger Expertise', gate: 30, description: 'Refine your dagger training with greater Accuracy and Core Thief Mana efficiency.',
      ranks: { accuracy: [11,12,13], coreThiefManaReductionPercent: [6,7,8] } },
    branches: [
      { slug: 'swift-edge', name: 'Swift Edge', gate: 45, description: 'Develop a faster dagger fighting style.', branchIdentity: 'Attack Speed emphasis',
        ranks: { accuracy: [13,14,15], coreThiefManaReductionPercent: [8,8,8], attackSpeedPercent: [2,4,6] } },
      { slug: 'precision-edge', name: 'Precision Edge', gate: 45, description: 'Develop a more accurate, critical-focused dagger fighting style.', branchIdentity: 'Accuracy and Critical emphasis',
        ranks: { accuracy: [15,17,19], coreThiefManaReductionPercent: [8,8,8], criticalRatePercentagePoints: [1,2,3] } },
    ],
  },
  {
    familyId: 'quick_stab', role: 'ACTIVE', skillType: 'ACTIVE_DAMAGE', mechanics: mainDagger,
    root: { slug: 'quick-stab', name: 'Quick Stab', gate: 15, description: 'Quickly strikes a single enemy with a dagger.',
      ranks: { baseDamageMin: [22,26,30,34,38], baseDamageMax: [34,39,44,49,55], physicalCoefficient: [.85,.89,.93,.97,1], bonusStrCoefficient: [.03,.04,.05,.05,.06], bonusDexCoefficient: [.10,.12,.14,.16,.18], mana: [5,5,6,6,7], cooldownSeconds: [3,2.9,2.8,2.7,2.6] } },
    upgrade: { slug: 'quick-stab-ii', name: 'Quick Stab II', gate: 28, description: 'Deliver a refined, fast single dagger strike.',
      ranks: { baseDamageMin: [45,52,60], baseDamageMax: [65,74,84], physicalCoefficient: [1.02,1.08,1.15], bonusStrCoefficient: [.07,.08,.09], bonusDexCoefficient: [.20,.23,.26], mana: [8,9,10], cooldownSeconds: [2.6,2.5,2.4] } },
    branches: [
      { slug: 'rapid-stab', name: 'Rapid Stab', gate: 42, description: 'Deliver one quick dagger strike with a short recovery.', branchIdentity: 'Higher frequency / lower commitment; one hit',
        ranks: { baseDamageMin: [29,33,37], baseDamageMax: [40,45,49], physicalCoefficient: [.54,.575,.61], bonusStrCoefficient: [.035,.040,.045], bonusDexCoefficient: [.14,.155,.17], mana: [10,11,12], cooldownSeconds: [1,1,1] } },
      { slug: 'precision-stab', name: 'Precision Stab', gate: 42, description: 'Deliver a stronger, more accurate single dagger strike.', branchIdentity: 'Slower, stronger, more accurate single hit',
        ranks: { baseDamageMin: [105,120,135], baseDamageMax: [143,162,180], physicalCoefficient: [1.875,1.980,2.100], bonusStrCoefficient: [.120,.135,.150], bonusDexCoefficient: [.450,.495,.540], skillAccuracy: [8,10,12], mana: [11,12,13], cooldownSeconds: [5,5,5] } },
    ],
  },
  {
    familyId: 'twin_fang', role: 'ACTIVE', skillType: 'ACTIVE_DAMAGE', mechanics: twinDaggers,
    root: { slug: 'twin-fang', name: 'Twin Fang', gate: 17, description: 'Strikes a single enemy twice in rapid succession.', prerequisites: [{ skillId: id('dagger-training'), requiredRank: 1 }],
      ranks: { baseDamageMin: [35,40,45,50,55], baseDamageMax: [50,56,63,69,75], physicalCoefficient: [.90,.95,1,1.05,1.10], bonusStrCoefficient: [.04,.05,.06,.07,.08], bonusDexCoefficient: [.14,.16,.19,.21,.24], mana: [7,8,9,10,11], cooldownSeconds: [4.5,4.4,4.3,4.15,4] } },
    upgrade: { slug: 'twin-fang-ii', name: 'Twin Fang II', gate: 31, description: 'Strike once with each dagger in a refined rapid sequence.',
      ranks: { baseDamageMin: [65,72,80], baseDamageMax: [90,100,110], physicalCoefficient: [1.15,1.22,1.30], bonusStrCoefficient: [.08,.09,.10], bonusDexCoefficient: [.26,.29,.32], mana: [12,13,14], cooldownSeconds: [3.9,3.8,3.7] } },
    branches: [
      { slug: 'rending-fang', name: 'Rending Fang', gate: 45, description: 'Follows rapid dagger strikes with a powerful finishing cut.', branchIdentity: 'Higher total damage, longer commitment',
        mechanics: { hits: [{ weaponHand: 'MAIN', weight: .30 }, { weaponHand: 'OFF', weight: .30 }, { weaponHand: 'MAIN', weight: .40 }] },
        ranks: { baseDamageMin: [90,102,115], baseDamageMax: [120,135,150], physicalCoefficient: [1.35,1.45,1.55], bonusStrCoefficient: [.10,.115,.13], bonusDexCoefficient: [.34,.38,.42], mana: [15,16,18], cooldownSeconds: [5.5,5.25,5] } },
      { slug: 'reversal-fang', name: 'Reversal Fang', gate: 45, description: 'Strikes twice and uses the second attack to reposition around the enemy.', branchIdentity: 'Lower damage plus player-directed lateral reposition',
        mechanics: { movement: { ...movementSafety, after: 'SEQUENCE', direction: 'PLAYER_INPUT_LEFT_RIGHT' } },
        ranks: { baseDamageMin: [80,90,100], baseDamageMax: [110,123,135], physicalCoefficient: [1.25,1.34,1.42], bonusStrCoefficient: [.08,.095,.11], bonusDexCoefficient: [.36,.41,.46], mana: [14,15,16], cooldownSeconds: [5,4.8,4.6], repositionDistanceMeters: [1.5,1.75,2] } },
    ],
  },
  {
    familyId: 'quickstep', role: 'ACTIVE', skillType: 'ACTIVE_MOBILITY', mechanics: { ...mainDagger, movement: { ...movementSafety, approach: 'CLOSE_DISTANCE' } },
    root: { slug: 'quickstep', name: 'Quickstep', gate: 17, description: 'Quickly closes a short distance and strikes the target.',
      ranks: { baseDamageMin: [20,25,30,35,40], baseDamageMax: [30,35,40,47,55], physicalCoefficient: [.65,.70,.75,.80,.85], bonusStrCoefficient: [.02,.025,.03,.035,.04], bonusDexCoefficient: [.10,.12,.14,.16,.18], movementRangeMeters: [3.5,3.75,4,4.25,4.5], mana: [8,9,10,11,12], cooldownSeconds: [8,7.7,7.4,7.1,6.8] } },
    upgrade: { slug: 'quickstep-ii', name: 'Quickstep II', gate: 33, description: 'Close a greater distance with a refined dagger approach.',
      ranks: { baseDamageMin: [45,50,55], baseDamageMax: [60,68,75], physicalCoefficient: [.90,.95,1], bonusStrCoefficient: [.04,.045,.05], bonusDexCoefficient: [.20,.22,.24], movementRangeMeters: [4.8,5,5.2], mana: [12,13,14], cooldownSeconds: [6.5,6.25,6] } },
    branches: [
      { slug: 'pursuit-step', name: 'Pursuit Step', gate: 47, description: 'Pursue the target with an extended offensive dagger approach.', branchIdentity: 'Offensive pursuit',
        ranks: { baseDamageMin: [60,68,75], baseDamageMax: [80,90,100], physicalCoefficient: [1.05,1.12,1.18], bonusStrCoefficient: [.05,.06,.07], bonusDexCoefficient: [.25,.28,.30], movementRangeMeters: [5.5,5.75,6], mana: [13,14,15], cooldownSeconds: [6,5.8,5.6] } },
      { slug: 'retreat-step', name: 'Retreat Step', gate: 47, description: 'Attempt a dagger strike, then disengage with a short backward step.', branchIdentity: 'Attack and disengage',
        mechanics: { movement: { ...movementSafety, after: 'IMPACT_ATTEMPT', direction: 'BACKWARD' }, pendingRuntimeDecisions: ['Retreat Step approach/strike range is not specified; do not inherit predecessor range implicitly.'] },
        ranks: { baseDamageMin: [45,52,60], baseDamageMax: [65,72,80], physicalCoefficient: [.90,.98,1.05], bonusStrCoefficient: [.04,.05,.06], bonusDexCoefficient: [.28,.31,.34], mana: [13,14,15], cooldownSeconds: [7,6.6,6.2], repositionDistanceMeters: [2,2.5,3] } },
    ],
  },
  {
    familyId: 'thief_evasion', role: 'UTILITY', skillType: 'ACTIVE_BUFF', mechanics: { weaponPolicy: 'NOT_SPECIFIED' },
    root: { slug: 'evasive-stance', name: 'Evasive Stance', gate: 20, description: 'Temporarily increases Evasion.',
      ranks: { evasion: [4,6,8,10,12], durationSeconds: [6,6.5,7,7.5,8], mana: [12,13,14,15,16], cooldownSeconds: [24,23,22,21,20] } },
    upgrade: { slug: 'reflex-stance', name: 'Reflex Stance', gate: 34, description: 'Adopt a refined stance that temporarily increases Evasion.',
      ranks: { evasion: [12,14,16], durationSeconds: [8,9,10], mana: [18,20,22], cooldownSeconds: [22,21,20] } },
    branches: [
      { slug: 'fleet-reflex', name: 'Fleet Reflex', gate: 48, description: 'Temporarily increase Evasion and Movement Speed.', branchIdentity: 'Evasion plus mobility',
        ranks: { evasion: [12,14,16], movementSpeedPercent: [4,6,8], durationSeconds: [8,9,10], mana: [22,24,26], cooldownSeconds: [22,21,20] } },
      { slug: 'calm-reflex', name: 'Calm Reflex', gate: 48, description: 'Focus on stronger temporary Evasion without a Movement Speed bonus.', branchIdentity: 'Stronger pure Evasion',
        ranks: { evasion: [15,17,19], durationSeconds: [7,8,9], mana: [22,24,26], cooldownSeconds: [24,23,22] } },
    ],
  },
  {
    familyId: 'weakpoint', role: 'ACTIVE', skillType: 'ACTIVE_DEBUFF',
    mechanics: { ...mainDagger, weakpoint: { statusId: 'weakpoint', skillFamilyId: 'weakpoint', ownership: 'CASTER', application: 'SUCCESSFUL_DAMAGING_IMPACT', globalDefenseReduction: false, partyBenefit: false } },
    root: { slug: 'expose-weakness', name: 'Expose Weakness', gate: 20, description: 'Strikes a vulnerable point, making the target easier for you to critically hit.',
      ranks: { baseDamageMin: [28,33,38,43,48], baseDamageMax: [42,48,54,61,68], physicalCoefficient: [.80,.85,.90,.95,1], bonusStrCoefficient: [.03,.04,.05,.055,.06], bonusDexCoefficient: [.12,.145,.17,.195,.22], weakpointCritPercentagePoints: [3,4,5,6,7], durationSeconds: [5,5.5,6,6.5,7], mana: [9,10,11,12,13], cooldownSeconds: [9,8.6,8.2,7.8,7.5] } },
    upgrade: { slug: 'weakpoint-read', name: 'Weakpoint Read', gate: 35, description: 'Read the target’s vulnerable point to improve your own Critical opportunity.',
      ranks: { baseDamageMin: [55,62,70], baseDamageMax: [75,85,95], physicalCoefficient: [1.05,1.11,1.18], bonusStrCoefficient: [.06,.07,.08], bonusDexCoefficient: [.24,.27,.30], weakpointCritPercentagePoints: [7,8,9], durationSeconds: [7,8,9], mana: [14,15,16], cooldownSeconds: [7.5,7.25,7] } },
    branches: [
      { slug: 'open-guard', name: 'Open Guard', gate: 50, description: 'Create a stronger but shorter personal Weakpoint opportunity.', branchIdentity: 'Stronger, shorter Weakpoint window',
        ranks: { baseDamageMin: [75,85,95], baseDamageMax: [100,112,125], physicalCoefficient: [1.20,1.275,1.35], bonusStrCoefficient: [.07,.08,.09], bonusDexCoefficient: [.32,.35,.38], weakpointCritPercentagePoints: [10,12,14], durationSeconds: [4.5,5,5.5], mana: [16,17,18], cooldownSeconds: [8,7.7,7.4] } },
      { slug: 'marked-weakness', name: 'Marked Weakness', gate: 50, description: 'Maintain a weaker but longer personal Weakpoint opportunity.', branchIdentity: 'Weaker, longer Weakpoint window',
        ranks: { baseDamageMin: [60,70,80], baseDamageMax: [85,95,105], physicalCoefficient: [1.10,1.18,1.26], bonusStrCoefficient: [.06,.07,.08], bonusDexCoefficient: [.30,.33,.36], weakpointCritPercentagePoints: [7,8,9], durationSeconds: [10,11,12], mana: [16,17,18], cooldownSeconds: [8.5,8.2,8] } },
    ],
  },
  {
    familyId: 'positional_strike', role: 'ACTIVE', skillType: 'ACTIVE_DAMAGE',
    mechanics: { ...defaultMainDagger, positional: { reference: 'TARGET_FACING_WORLD_SPACE', regions: ['FRONT','FLANK','REAR'], frontBonusPercent: 0, payoffCombination: 'ONE_REGION_ONLY' }, pendingRuntimeDecisions: ['Flank/rear angle thresholds are not specified by the canonical data.'] },
    root: { slug: 'side-cut', name: 'Side Cut', gate: 23, description: 'Strike from an advantageous angle for increased damage.', prerequisites: [{ skillId: id('quick-stab'), requiredRank: 2 }],
      ranks: { baseDamageMin: [35,40,45,50,55], baseDamageMax: [50,56,63,69,75], physicalCoefficient: [.90,.95,1,1.05,1.10], bonusStrCoefficient: [.04,.05,.06,.065,.07], bonusDexCoefficient: [.16,.185,.21,.235,.26], flankFinalDamagePercent: [4,5,6,7,8], rearFinalDamagePercent: [6,8,10,12,14], mana: [8,9,10,11,12], cooldownSeconds: [5.5,5.3,5.1,4.9,4.7] } },
    upgrade: { slug: 'backlash', name: 'Backlash', gate: 37, description: 'Exploit the target’s flank or rear with a stronger positional strike.',
      ranks: { baseDamageMin: [65,72,80], baseDamageMax: [90,100,110], physicalCoefficient: [1.15,1.22,1.30], bonusStrCoefficient: [.07,.08,.09], bonusDexCoefficient: [.28,.31,.34], flankFinalDamagePercent: [8,10,12], rearFinalDamagePercent: [12,15,18], mana: [13,14,15], cooldownSeconds: [6,5.7,5.4] } },
    branches: [
      { slug: 'rear-fang', name: 'Rear Fang', gate: 52, description: 'Specialize in striking the target from behind.', branchIdentity: 'Maximum rear-position payoff',
        ranks: { baseDamageMin: [90,102,115], baseDamageMax: [120,135,150], physicalCoefficient: [1.35,1.45,1.55], bonusStrCoefficient: [.08,.09,.10], bonusDexCoefficient: [.36,.40,.44], flankFinalDamagePercent: [5,5,5], rearFinalDamagePercent: [18,20,22], mana: [16,17,18], cooldownSeconds: [7,6.7,6.4] } },
      { slug: 'flanking-cut', name: 'Flanking Cut', gate: 52, description: 'Gain a consistent positional payoff from either the flank or rear.', branchIdentity: 'Flexible flank or rear payoff',
        ranks: { baseDamageMin: [80,92,105], baseDamageMax: [110,123,135], physicalCoefficient: [1.28,1.36,1.45], bonusStrCoefficient: [.07,.08,.09], bonusDexCoefficient: [.38,.42,.46], flankFinalDamagePercent: [12,14,16], rearFinalDamagePercent: [12,14,16], mana: [16,17,18], cooldownSeconds: [6.5,6.2,6] } },
    ],
  },
  {
    familyId: 'fan_of_blades', role: 'ACTIVE', skillType: 'ACTIVE_DAMAGE',
    mechanics: { weaponPolicy: 'NOT_SPECIFIED', areaShape: 'RADIAL', baseRollPolicy: 'ONE_PER_CAST', pendingRuntimeDecisions: ['Fan of Blades weapon configuration, hand contribution mode and gameplay hit count are not explicitly specified; no dual-combined assumption.'] },
    root: { slug: 'fan-of-blades', name: 'Fan of Blades', gate: 25, description: 'Slash nearby enemies with a quick circular dagger attack.',
      ranks: { baseDamageMin: [30,35,40,45,50], baseDamageMax: [45,50,56,63,70], physicalCoefficient: [.75,.80,.85,.90,.95], bonusStrCoefficient: [.03,.035,.04,.045,.05], bonusDexCoefficient: [.12,.14,.16,.18,.20], radiusMeters: [3,3.1,3.2,3.3,3.4], targetCap: [3,3,3,4,4], mana: [10,11,12,13,14], cooldownSeconds: [7,6.75,6.5,6.25,6] } },
    upgrade: { slug: 'blade-fan-ii', name: 'Blade Fan II', gate: 39, description: 'Refine the circular dagger attack against nearby enemies.',
      ranks: { baseDamageMin: [60,68,75], baseDamageMax: [80,90,100], physicalCoefficient: [1,1.08,1.15], bonusStrCoefficient: [.05,.06,.07], bonusDexCoefficient: [.22,.25,.28], radiusMeters: [3.5,3.6,3.7], targetCap: [3,4,4], mana: [15,16,17], cooldownSeconds: [6,5.8,5.6] } },
    branches: [
      { slug: 'wide-fan', name: 'Wide Fan', gate: 54, description: 'Expand the dagger sweep to cover more nearby enemies.', branchIdentity: 'Larger coverage and target cap',
        ranks: { baseDamageMin: [70,80,90], baseDamageMax: [95,107,120], physicalCoefficient: [1.10,1.175,1.25], bonusStrCoefficient: [.05,.06,.07], bonusDexCoefficient: [.26,.29,.32], radiusMeters: [4,4.25,4.5], targetCap: [4,5,5], mana: [18,19,20], cooldownSeconds: [6.4,6.1,5.8] } },
      { slug: 'focused-fan', name: 'Focused Fan', gate: 54, description: 'Concentrate the dagger sweep on fewer enemies for higher damage per target.', branchIdentity: 'Higher per-target damage, smaller coverage',
        ranks: { baseDamageMin: [90,102,115], baseDamageMax: [120,135,150], physicalCoefficient: [1.25,1.35,1.45], bonusStrCoefficient: [.06,.07,.08], bonusDexCoefficient: [.30,.34,.38], radiusMeters: [3,3.1,3.2], targetCap: [3,3,3], mana: [18,20,21], cooldownSeconds: [6.2,6,5.8] } },
    ],
  },
  {
    familyId: 'fatal_opening', role: 'ACTIVE', skillType: 'ACTIVE_DAMAGE', mechanics: { ...defaultMainDagger, weakpointPayoff: { statusId: 'weakpoint', sourceFamilyId: 'weakpoint', ownership: 'CASTER', modifier: 'FINAL_DAMAGE_PERCENT' } },
    root: { slug: 'fatal-opening', name: 'Fatal Opening', gate: 27, description: 'Exploit a vulnerable opening with a powerful precision strike.', prerequisites: [{ skillId: id('expose-weakness'), requiredRank: 3 }],
      ranks: { baseDamageMin: [60,68,75,82,90], baseDamageMax: [85,95,105,115,125], physicalCoefficient: [1.25,1.30,1.35,1.40,1.45], bonusStrCoefficient: [.05,.06,.07,.075,.08], bonusDexCoefficient: [.22,.245,.27,.295,.32], ownWeakpointFinalDamagePercent: [6,7,8,9,10], mana: [14,15,16,17,18], cooldownSeconds: [10,9.6,9.2,8.8,8.5] } },
    upgrade: { slug: 'fatal-opening-ii', name: 'Fatal Opening II', gate: 42, description: 'Refine the precision finisher, exploiting your own Weakpoint when present.',
      ranks: { baseDamageMin: [105,118,130], baseDamageMax: [145,160,175], physicalCoefficient: [1.55,1.65,1.75], bonusStrCoefficient: [.08,.09,.10], bonusDexCoefficient: [.34,.38,.42], ownWeakpointFinalDamagePercent: [12,14,16], mana: [20,22,24], cooldownSeconds: [9,8.7,8.4] } },
    branches: [
      { slug: 'vital-pierce', name: 'Vital Pierce', gate: 56, description: 'Deliver a precision strike with a high payoff against your own Weakpoint.', branchIdentity: 'High setup payoff',
        ranks: { baseDamageMin: [140,160,180], baseDamageMax: [185,210,235], physicalCoefficient: [1.85,1.98,2.10], bonusStrCoefficient: [.10,.11,.12], bonusDexCoefficient: [.45,.50,.55], ownWeakpointFinalDamagePercent: [18,22,26], mana: [25,27,29], cooldownSeconds: [12,11.5,11] } },
      { slug: 'opportunist-cut', name: 'Opportunist Cut', gate: 56, description: 'Deliver reliable raw damage with a smaller personal Weakpoint payoff.', branchIdentity: 'Reliable damage with lower setup dependence',
        ranks: { baseDamageMin: [160,180,200], baseDamageMax: [210,235,260], physicalCoefficient: [1.95,2.08,2.20], bonusStrCoefficient: [.10,.11,.12], bonusDexCoefficient: [.42,.46,.50], ownWeakpointFinalDamagePercent: [6,7,8], mana: [25,27,29], cooldownSeconds: [11,10.5,10] } },
    ],
  },
];

export const THIEF_V3_SKILLS: readonly ThiefSkillDefinitionV3[] = families.flatMap(makeFamily);
export const THIEF_V3_SKILL_MAP: Record<string, ThiefSkillDefinitionV3> = Object.fromEntries(THIEF_V3_SKILLS.map(skill => [skill.id, skill]));
export const THIEF_V3_FAMILIES = Object.fromEntries(families.map(family => [family.familyId, {
  familyId: family.familyId, role: family.role, rootSkillId: id(family.root.slug),
  upgradeSkillId: id(family.upgrade.slug), branchSkillIds: family.branches.map(branch => id(branch.slug)),
}])) as Record<ThiefFamilyId, { familyId: ThiefFamilyId; role: FamilyInput['role']; rootSkillId: string; upgradeSkillId: string; branchSkillIds: string[] }>;

export type ThiefCanonicalRank = {
  skillId: string; familyId: ThiefFamilyId; rank: number;
  values: Partial<Record<keyof ThiefRankArrays, number>>;
  profile: SkillProfileV3;
  skillPowerFactor?: number; rankPowerFactor?: number;
  mechanics: ThiefSkillMechanics;
};

/** Read-only rank projection for Phase 4 adapters/presentation. No cast, RNG,
 * buffs, status application or equipment-dependent damage preview is performed. */
export function resolveThiefCanonicalRank(skillId: string, rank: number): ThiefCanonicalRank | null {
  const skill = THIEF_V3_SKILL_MAP[skillId];
  if (!skill || !Number.isInteger(rank) || rank < 1 || rank > skill.maxRank) return null;
  const values = Object.fromEntries(Object.entries(skill.rankData).map(([key, ranks]) => [key, ranks[rank - 1]])) as ThiefCanonicalRank['values'];
  return {
    skillId, familyId: skill.familyId, rank, values, mechanics: skill.mechanics,
    ...(skill.damageProfile ? { skillPowerFactor: THIEF_V3_SKILL_POWER_FACTOR, rankPowerFactor: skill.rankPowerFactorByRank![rank - 1] } : {}),
    profile: {
      ...(skill.damageProfile ? { damageProfile: { ...skill.damageProfile, physicalCoefficient: values.physicalCoefficient,
        statScaling: { str: values.bonusStrCoefficient, dex: values.bonusDexCoefficient } },
        statScaling: { str: values.bonusStrCoefficient, dex: values.bonusDexCoefficient },
      } : {}),
      ...(values.mana !== undefined ? { resourceCost: { mana: values.mana } } : {}),
      ...(values.cooldownSeconds !== undefined ? { cooldown: values.cooldownSeconds } : {}),
      ...(values.durationSeconds !== undefined ? { effectDuration: values.durationSeconds } : {}),
    },
  };
}
