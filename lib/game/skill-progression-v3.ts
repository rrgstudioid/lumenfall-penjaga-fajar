/**
 * Skill Progression V3 foundation.
 *
 * This module is intentionally content-agnostic. It does not register or
 * activate any V3 Adventurer/Warrior/Thief skill. Existing V2 content keeps
 * using its current registry until a later migration phase.
 */

export type SkillTierV3 = 'adventurer' | 'core' | 'specialization' | 'advanced';
export type SkillTypeV3 =
  | 'ACTIVE_DAMAGE'
  | 'ACTIVE_BUFF'
  | 'ACTIVE_DEBUFF'
  | 'ACTIVE_HEAL'
  | 'ACTIVE_MOBILITY'
  | 'STANCE'
  | 'UTILITY'
  | 'PASSIVE'
  | 'MASTERY'
  | 'ULTIMATE';

export type SkillStatScalingV3 = Partial<{
  str: number;
  vit: number;
  dex: number;
  int: number;
}>;

export type SkillDamageProfileV3 = {
  flatPower?: number;
  physicalCoefficient?: number;
  magicCoefficient?: number;
  statScaling?: SkillStatScalingV3;
  hits?: Array<{
    coefficient?: number;
    flatPower?: number;
    delay?: number;
  }>;
};

export type SkillResourceCostV3 = {
  mana?: number;
};

export type SkillTargetingV3 = {
  targetType?: 'single' | 'area' | 'self' | 'line' | 'frontal_arc';
  range?: number;
  radius?: number;
  maxTargets?: number;
};

export type SkillEffectsV3 = {
  buffs?: string[];
  debuffs?: string[];
  crowdControl?: string[];
  movement?: string;
  tags?: string[];
};
export type SkillStunProfileV3 = {
  chance: number[];
  pveDuration: number;
  pvpDuration: number;
  minimumTravelDistance: number;
  targetPolicy: 'NORMAL' | 'REDUCED' | 'IMMUNE';
};

export type SkillMotionMetadataV3 = {
  motionArchetype?: string;
  motionNotes?: string;
  hitStyle?: string;
  movementIntent?: string;
  animationNoGo?: string[];
};

export type SkillPresentationV3 = {
  description?: string;
  icon?: string;
};

export type SkillProfileV3 = {
  damageProfile?: SkillDamageProfileV3;
  statScaling?: SkillStatScalingV3;
  effectChance?: number;
  effectDuration?: number;
  stunDuration?: number;
  debuffStrength?: number;
  buffStrength?: number;
  healing?: number;
  cooldown?: number;
  recovery?: number;
  resourceCost?: SkillResourceCostV3;
};

export type SkillPrerequisiteV3 = {
  skillId: string;
  requiredRank: number;
};

export type JobInvestmentRequirementV3 = {
  jobId: string;
  minimumSP: number;
};

export type SkillDefinitionV3 = {
  id: string;
  name: string;
  jobId: string;
  jobTier: SkillTierV3;
  unlockLevel?: number;
  maxRank: number;
  rankLevelRequirements?: number[];
  spCostPerRank?: number | number[];
  prerequisiteSkills?: SkillPrerequisiteV3[];
  jobRequirement?: string;
  ancestryRequirement?: string[];
  weaponRequirement?: string[];
  skillType: SkillTypeV3;
  targeting?: SkillTargetingV3;
  damageProfile?: SkillDamageProfileV3;
  statScaling?: SkillStatScalingV3;
  resourceCost?: SkillResourceCostV3;
  cooldown?: number;
  effects?: SkillEffectsV3;
  stunProfile?: SkillStunProfileV3;
  defaultProfile?: SkillProfileV3;
  pvpOverride?: SkillProfileV3;
  presentation?: SkillPresentationV3;
  motion?: SkillMotionMetadataV3;
  status?: string;
  jobInvestmentRequirement?: JobInvestmentRequirementV3;
};

export type SkillProgressionV3State = {
  skillArchitectureVersion: 3;
  totalEarnedSP: number;
  skillRanks: Record<string, number>;
  /** Ranks granted by the system; these never consume or refund SP. */
  grantedRanks: Record<string, number>;
  chosenCoreJob: string | null;
  chosenSpecialization: string | null;
  chosenAdvancedJob: string | null;
};

export type SkillJobNodeV3 = {
  id: string;
  tier: SkillTierV3;
  parent: string | null;
};

export type SkillPurchaseReasonV3 =
  | 'OK'
  | 'REQUIRES_LEVEL'
  | 'INSUFFICIENT_SP'
  | 'REQUIRES_SKILL'
  | 'WRONG_JOB'
  | 'WRONG_SPECIALIZATION'
  | 'WRONG_ANCESTRY'
  | 'MAX_RANK'
  | 'REQUIRES_JOB_INVESTMENT'
  | 'INVALID_SKILL';

export type SkillPurchaseResultV3 = {
  ok: boolean;
  reason: SkillPurchaseReasonV3;
  requiredLevel?: number;
  requiredSP?: number;
  requiredSkillId?: string;
  requiredRank?: number;
  requiredJobId?: string;
};

export type SkillProgressionContextV3 = {
  level: number;
  state: SkillProgressionV3State;
  jobs: Record<string, SkillJobNodeV3>;
  skills: Record<string, SkillDefinitionV3>;
};

export const createSkillProgressionV3 = (
  totalEarnedSP = 0,
  chosenCoreJob: string | null = null,
): SkillProgressionV3State => ({
  skillArchitectureVersion: 3,
  totalEarnedSP: Math.max(0, Math.floor(totalEarnedSP)),
  skillRanks: {},
  grantedRanks: {},
  chosenCoreJob,
  chosenSpecialization: null,
  chosenAdvancedJob: null,
});

export function normalizeSkillProgressionV3(
  value: unknown,
): SkillProgressionV3State {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawRanks = source.skillRanks && typeof source.skillRanks === 'object'
    ? source.skillRanks as Record<string, unknown>
    : {};
  const skillRanks: Record<string, number> = {};
  for (const [id, rank] of Object.entries(rawRanks)) {
    if (typeof rank === 'number' && Number.isFinite(rank) && rank > 0)
      skillRanks[id] = Math.floor(rank);
  }
  const rawGranted = source.grantedRanks && typeof source.grantedRanks === 'object'
    ? source.grantedRanks as Record<string, unknown>
    : {};
  const grantedRanks: Record<string, number> = {};
  for (const [id, rank] of Object.entries(rawGranted)) {
    if (typeof rank === 'number' && Number.isFinite(rank) && rank > 0)
      grantedRanks[id] = Math.floor(rank);
  }
  return {
    skillArchitectureVersion: 3,
    totalEarnedSP: typeof source.totalEarnedSP === 'number' && Number.isFinite(source.totalEarnedSP)
      ? Math.max(0, Math.floor(source.totalEarnedSP))
      : 0,
    skillRanks,
    grantedRanks,
    chosenCoreJob: typeof source.chosenCoreJob === 'string' ? source.chosenCoreJob : null,
    chosenSpecialization: typeof source.chosenSpecialization === 'string' ? source.chosenSpecialization : null,
    chosenAdvancedJob: typeof source.chosenAdvancedJob === 'string' ? source.chosenAdvancedJob : null,
  };
}

function costAtRank(skill: SkillDefinitionV3, rank: number): number {
  if (Array.isArray(skill.spCostPerRank))
    return Math.max(0, skill.spCostPerRank[rank - 1] ?? skill.spCostPerRank.at(-1) ?? 0);
  return Math.max(0, skill.spCostPerRank ?? 0);
}

export function skillCostThroughRank(skill: SkillDefinitionV3, rank: number): number {
  let total = 0;
  for (let i = 1; i <= Math.max(0, rank); i++) total += costAtRank(skill, i);
  return total;
}

export function spentSkillPointsV3(
  state: SkillProgressionV3State,
  skills: Record<string, SkillDefinitionV3>,
): number {
  return Object.entries(state.skillRanks).reduce(
    (total, [id, rank]) => {
      const skill = skills[id];
      if (!skill) return total;
      const granted = Math.min(rank, state.grantedRanks?.[id] ?? 0);
      return total + skillCostThroughRank(skill, rank) - skillCostThroughRank(skill, granted);
    },
    0,
  );
}

export function availableSkillPointsV3(
  state: SkillProgressionV3State,
  skills: Record<string, SkillDefinitionV3>,
): number {
  return Math.max(0, state.totalEarnedSP - spentSkillPointsV3(state, skills));
}

export function accessibleJobIdsV3(
  state: SkillProgressionV3State,
): Set<string> {
  const ids = new Set(['adventurer']);
  if (state.chosenCoreJob) ids.add(state.chosenCoreJob);
  if (state.chosenSpecialization) ids.add(state.chosenSpecialization);
  if (state.chosenAdvancedJob) ids.add(state.chosenAdvancedJob);
  return ids;
}

function rankLevel(skill: SkillDefinitionV3, nextRank: number): number {
  return skill.rankLevelRequirements?.[nextRank - 1] ?? skill.unlockLevel ?? 1;
}

function skillIsAccessible(skill: SkillDefinitionV3, state: SkillProgressionV3State): boolean {
  const accessible = accessibleJobIdsV3(state);
  if (!accessible.has(skill.jobId)) return false;
  if (skill.jobRequirement && !accessible.has(skill.jobRequirement)) return false;
  if (skill.ancestryRequirement?.some((jobId) => !accessible.has(jobId))) return false;
  return true;
}

function jobInvestment(
  state: SkillProgressionV3State,
  skills: Record<string, SkillDefinitionV3>,
  jobId: string,
): number {
  return Object.entries(state.skillRanks).reduce((total, [id, rank]) => {
    const skill = skills[id];
    return total + (skill?.jobId === jobId ? skillCostThroughRank(skill, rank) : 0);
  }, 0);
}

export function canPurchaseSkillRank(
  context: SkillProgressionContextV3,
  skillId: string,
): SkillPurchaseResultV3 {
  const skill = context.skills[skillId];
  if (!skill) return { ok: false, reason: 'INVALID_SKILL' };
  if (!skillIsAccessible(skill, context.state)) {
    return {
      ok: false,
      reason: skill.jobTier === 'specialization' ? 'WRONG_SPECIALIZATION' : 'WRONG_JOB',
      requiredJobId: skill.jobId,
    };
  }
  const currentRank = context.state.skillRanks[skillId] ?? 0;
  const nextRank = currentRank + 1;
  if (nextRank > skill.maxRank) return { ok: false, reason: 'MAX_RANK' };
  const requiredLevel = rankLevel(skill, nextRank);
  if (context.level < requiredLevel)
    return { ok: false, reason: 'REQUIRES_LEVEL', requiredLevel };
  for (const prerequisite of skill.prerequisiteSkills ?? []) {
    const actual = context.state.skillRanks[prerequisite.skillId] ?? 0;
    if (actual < prerequisite.requiredRank) {
      return {
        ok: false,
        reason: 'REQUIRES_SKILL',
        requiredSkillId: prerequisite.skillId,
        requiredRank: prerequisite.requiredRank,
      };
    }
  }
  const investment = skill.jobInvestmentRequirement;
  if (investment && jobInvestment(context.state, context.skills, investment.jobId) < investment.minimumSP) {
    return {
      ok: false,
      reason: 'REQUIRES_JOB_INVESTMENT',
      requiredSP: investment.minimumSP,
      requiredJobId: investment.jobId,
    };
  }
  const cost = costAtRank(skill, nextRank);
  const available = availableSkillPointsV3(context.state, context.skills);
  if (available < cost)
    return { ok: false, reason: 'INSUFFICIENT_SP', requiredSP: cost };
  return { ok: true, reason: 'OK' };
}

export function purchaseSkillRankV3(
  context: SkillProgressionContextV3,
  skillId: string,
): SkillPurchaseResultV3 {
  const result = canPurchaseSkillRank(context, skillId);
  if (!result.ok) return result;
  context.state.skillRanks[skillId] = (context.state.skillRanks[skillId] ?? 0) + 1;
  return result;
}

export function refundAllSkillPointsForJobChange(
  state: SkillProgressionV3State,
): SkillProgressionV3State {
  return {
    ...state,
    skillRanks: { ...(state.grantedRanks ?? {}) },
  };
}

export function transitionSkillJobV3(
  state: SkillProgressionV3State,
  tier: Exclude<SkillTierV3, 'adventurer'>,
  jobId: string,
): SkillProgressionV3State {
  const reset = refundAllSkillPointsForJobChange(state);
  if (tier === 'core') return { ...reset, chosenCoreJob: jobId, chosenSpecialization: null, chosenAdvancedJob: null };
  if (tier === 'specialization') return { ...reset, chosenSpecialization: jobId, chosenAdvancedJob: null };
  return { ...reset, chosenAdvancedJob: jobId };
}

function mergeProfile(
  base: SkillProfileV3 | undefined,
  override: SkillProfileV3 | undefined,
): SkillProfileV3 {
  if (!base && !override) return {};
  const merged = { ...(base ?? {}), ...(override ?? {}) } as SkillProfileV3;
  if (base?.damageProfile || override?.damageProfile)
    merged.damageProfile = { ...(base?.damageProfile ?? {}), ...(override?.damageProfile ?? {}) };
  if (base?.statScaling || override?.statScaling)
    merged.statScaling = { ...(base?.statScaling ?? {}), ...(override?.statScaling ?? {}) };
  if (base?.resourceCost || override?.resourceCost)
    merged.resourceCost = { ...(base?.resourceCost ?? {}), ...(override?.resourceCost ?? {}) };
  return merged;
}

export function resolveSkillProfileV3(
  skill: SkillDefinitionV3,
  mode: 'pve' | 'pvp' = 'pve',
): SkillProfileV3 {
  return mergeProfile(skill.defaultProfile, mode === 'pvp' ? skill.pvpOverride : undefined);
}

/** Motion is deliberately not included: it cannot affect combat calculations. */
export function resolveSkillCombatProfileV3(
  skill: SkillDefinitionV3,
  mode: 'pve' | 'pvp' = 'pve',
) {
  const profile = resolveSkillProfileV3(skill, mode);
  return {
    damageProfile: profile.damageProfile ?? skill.damageProfile ?? {},
    statScaling: profile.statScaling ?? skill.statScaling ?? {},
    resourceCost: profile.resourceCost ?? skill.resourceCost ?? {},
    cooldown: profile.cooldown ?? skill.cooldown,
    effects: skill.effects ?? {},
  };
}

export function skillLineageJobsV3(
  state: SkillProgressionV3State,
  jobs: Record<string, SkillJobNodeV3>,
): SkillJobNodeV3[] {
  const ids = ['adventurer', state.chosenCoreJob, state.chosenSpecialization, state.chosenAdvancedJob].filter(Boolean) as string[];
  return ids.map((id) => jobs[id]).filter((job): job is SkillJobNodeV3 => Boolean(job));
}
