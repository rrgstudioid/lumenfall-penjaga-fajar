import {
  skillCombatScaling,
  type SkillDefinition,
  type SkillHit,
  type SkillRankValues,
  type SkillStatusApplication,
  type WeaponType,
} from './skills.ts';
import type { DerivedStats } from './rules.ts';
import type { TargetIdentity } from './targeting.ts';
import type { DamageType } from './combat-mechanics.ts';
import {
  applyActionModifiers,
  NO_COUNTER,
  type CombatModifier,
  type CounterContext,
  type ModifierContext,
  type ScopedHitComposition,
} from './combat-modifiers.ts';

export type ResolvedSkillHit = Required<Omit<SkillHit, 'statusEffect'>> & {
  /** Per-hand CFV3 physical foundation, composed once by the V3 weapon resolver. */
  composedPhysicalPower?: number;
  scopedComposition?: ScopedHitComposition;
  damageType: DamageType;
  damageMultiplier: number;
  canCrit: boolean;
  criticalRate: number;
  criticalDamage: number;
  /** Retained for a future real hit-chance mechanic; current combat has no accuracy roll. */
  accuracy: number;
  statuses: SkillStatusApplication[];
};
export type ResolvedSkillAction = Omit<SkillDefinition, 'hitSequence'> & {
  targetIdentity?: TargetIdentity;
  targetModifiers: CombatModifier[];
  counterContext: CounterContext;
  skillId: string;
  rank: number;
  damageType: DamageType;
  physicalCoefficient: number;
  magicCoefficient: number;
  skillPowerCoefficient: number;
  radius: number;
  knockbackStrength: number;
  tags: string[];
  statuses: SkillStatusApplication[];
  hitSequence: ResolvedSkillHit[];
  damageMultiplier: number;
  weaponAllowed: boolean;
  resolvedWeaponStyle: WeaponType;
  timing: { castStart: number; impact: number; castEnd: number };
};
export type SkillResolveContext = {
  v2?: boolean;
  modifiers?: CombatModifier[];
  combat?: ModifierContext;
  stats: DerivedStats;
  rank: number;
  masteryPower: number;
  masteryCooldown: number;
  equipmentDamage: number;
  weaponAllowed: boolean;
  weaponStyle: WeaponType;
  primaryStats?: { str: number; vit: number; dex: number; int: number };
};
const safe = (value: number | undefined, fallback = 0) =>
  Number.isFinite(value) ? Math.max(0, value!) : fallback;
const valueKeys = [
  'baseDamage',
  'physicalCoefficient',
  'magicCoefficient',
  'skillPowerCoefficient',
  'manaCost',
  'cooldown',
  'castingTime',
  'range',
  'radius',
  'maxTargets',
  'duration',
  'knockbackStrength',
  'movementDistance',
] as const;

/** Pure, fresh per cast/preview. No writes to the registry or save. */
export function resolveSkillAction(
  definition: SkillDefinition,
  context: SkillResolveContext,
): ResolvedSkillAction {
  const skill = structuredClone(definition);
  // Preview and live execution share accepted counter semantics. A Block cannot
  // empower a parry-only action through Counter Training or a caller's context.
  if (
    skill.counterPolicy &&
    context.combat?.counter?.result &&
    (context.combat.counter.result === 'none' ||
      !skill.counterPolicy.accepted.includes(context.combat.counter.result))
  )
    context = {
      ...context,
      combat: { ...context.combat, counter: NO_COUNTER },
    };
  const explicit = skill.progressionMode === 'rank_values';
  // Legacy previews intentionally include rank zero (before learning a skill).
  const rank = Math.min(
    Math.max(explicit ? 1 : 0, Math.floor(safe(context.rank, 1))),
    Math.max(1, skill.maxLevel),
  );
  const legacy = skillCombatScaling(skill);
  const values: Required<SkillRankValues> = {
    baseDamage: skill.baseDamage,
    physicalCoefficient: explicit
      ? (skill.physicalCoefficient ?? 0)
      : legacy.physical * skill.damageCoefficient,
    magicCoefficient: explicit
      ? (skill.magicCoefficient ?? 0)
      : legacy.magic * skill.damageCoefficient,
    skillPowerCoefficient: explicit
      ? (skill.skillPowerCoefficient ?? 0)
      : legacy.skillPower * skill.damageCoefficient,
    manaCost: skill.manaCost,
    cooldown: skill.cooldown,
    castingTime: skill.castingTime,
    range: skill.range,
    radius: skill.areaRadius,
    duration: skill.duration,
    knockbackStrength:
      skill.knockbackStrength ??
      (skill.effect === 'stun' || skill.effect === 'ultimate' ? 1.4 : 0.45),
    movementDistance: skill.movementDistance ?? 0,
  };
  let statScaling = skill.statScaling ?? {};
  for (const key of valueKeys) values[key] = safe(values[key]);
  const applyValues = (patch?: SkillRankValues) => {
    for (const key of valueKeys)
      if (patch?.[key] !== undefined && Number.isFinite(patch[key]))
        values[key] = safe(patch[key]);
    if (patch?.statScaling) statScaling = { ...statScaling, ...patch.statScaling };
  };
  if (explicit)
    for (const entry of (skill.rankValues ?? []).slice(0, rank))
      applyValues(entry);
  const rankEffect = explicit ? skill.rankEffects?.[rank - 1] : undefined;
  if (rankEffect) {
    if (rankEffect.modifiers)
      skill.modifiers = structuredClone(rankEffect.modifiers);
    if (rankEffect.temporaryBuffs)
      skill.temporaryBuffs = structuredClone(rankEffect.temporaryBuffs);
    if (rankEffect.statuses)
      skill.statuses = structuredClone(rankEffect.statuses);
    if (rankEffect.hitSequence)
      skill.hitSequence = structuredClone(rankEffect.hitSequence);
    const counter = context.combat?.counter?.result;
  }
  const statuses = [...(skill.statuses ?? [])];
  const tags = [...(skill.tags ?? [])];
  let sequence = skill.hitSequence;
  if (explicit)
    for (let threshold = 1; threshold <= rank; threshold++) {
      const mechanic = skill.rankMechanics?.[threshold];
      applyValues(mechanic?.values);
      statuses.push(...(mechanic?.addStatuses ?? []));
      tags.push(...(mechanic?.addTags ?? []));
      if (mechanic?.hitSequence) sequence = mechanic.hitSequence;
    }
  const damageType =
    skill.damageType ?? (explicit ? 'physical' : legacy.damageType);
  const damageMultiplier =
    (explicit ? 1 : 1 + (rank - 1) * 0.12) *
    context.masteryPower *
    (1 + context.equipmentDamage) *
    (1 + safe(context.stats.skillDamage) / 100);
  // A structured hit owns its coefficients: omitted fields are zero, never the full cast damage.
  const hits = sequence?.length ? sequence : [{ delay: 0, ...values }];
  const hitSequence: ResolvedSkillHit[] = hits
    .map((hit) => ({
      delay: safe(hit.delay),
      // Explicit V3 stat scaling is resolved exactly once into the hit's flat
      // portion. This keeps it separate from CFV3 physical weapon attack.
      baseDamage: safe(hit.baseDamage) +
        ((statScaling.str ?? 0) * (context.primaryStats?.str ?? 0) +
        (statScaling.vit ?? 0) * (context.primaryStats?.vit ?? 0) +
        (statScaling.dex ?? 0) * (context.primaryStats?.dex ?? 0) +
        (statScaling.int ?? 0) * (context.primaryStats?.int ?? 0)) * (hit.sharedContributionWeight ?? 1),
      physicalCoefficient: safe(hit.physicalCoefficient),
      magicCoefficient: safe(hit.magicCoefficient),
      skillPowerCoefficient: safe(hit.skillPowerCoefficient),
      knockbackStrength:
        safe(hit.knockbackStrength, values.knockbackStrength),
      damageType,
      damageMultiplier,
      canCrit: skill.canCrit ?? false,
      criticalRate: context.stats.criticalRate,
      criticalDamage: context.stats.criticalDamage,
      accuracy: context.stats.accuracy,
      statuses: [...statuses, ...(hit.statusEffect ? [hit.statusEffect] : [])],
      weaponHand: hit.weaponHand,
      sharedContributionWeight: hit.sharedContributionWeight,
      weaponContributionCoefficient: hit.weaponContributionCoefficient,
    }))
    .sort((a, b) => a.delay - b.delay);
  const result: ResolvedSkillAction = {
    ...skill,
    modifierComposition: context.v2
      ? 'scoped_additive'
      : (skill.modifierComposition ?? 'legacy'),
    actionLockDuration: safe(skill.actionLockDuration),
    movementAllowedDuringLock: skill.movementAllowedDuringLock ?? true,
    targetModifiers: [],
    counterContext: context.combat?.counter ?? NO_COUNTER,
    ...values,
    areaRadius: values.radius,
    skillId: skill.id,
    rank,
    damageType,
    manaCost: Math.max(
      0,
      Math.ceil(values.manaCost * (1 - context.stats.manaCostReduction / 100)),
    ),
    cooldown:
      values.cooldown *
      context.masteryCooldown *
      (1 - Math.min(0.3, context.stats.cooldownReduction / 100)),
    tags: [...new Set(tags)],
    statuses,
    damageMultiplier,
    hitSequence,
    angle: safe(skill.angle, 90),
    maxTargets:
      values.maxTargets !== undefined
        ? Math.floor(safe(values.maxTargets))
        : skill.maxTargets === undefined
        ? undefined
        : Math.floor(safe(skill.maxTargets)),
    weaponAllowed: context.weaponAllowed,
    resolvedWeaponStyle: context.weaponStyle,
    // Legacy casts impact immediately. Explicit sequences are anchored to cast start too.
    timing: {
      castStart: 0,
      impact: hitSequence[0].delay,
      castEnd: Math.max(values.castingTime, hitSequence.at(-1)!.delay),
    },
  };
  const modified=applyActionModifiers(
    result,
    [...(context.modifiers ?? []), ...(skill.modifiers ?? [])],
    context.combat ?? {
      weaponStyle: context.weaponStyle,
      hp: context.stats.maxHP,
      maxHP: context.stats.maxHP,
    },
  );
  // Presentation uses the same modified application durations as execution.
  modified.statuses=modified.hitSequence[0].statuses;
  return modified;
}
export function skillHitDamage(
  hit: ResolvedSkillHit,
  stats: Pick<DerivedStats, 'physicalAttack' | 'magicAttack' | 'skillPower'>,
) {
  return (
    (hit.baseDamage +
      (hit.composedPhysicalPower ?? hit.physicalCoefficient * stats.physicalAttack) +
      hit.magicCoefficient * stats.magicAttack +
      hit.skillPowerCoefficient * stats.skillPower) *
    hit.damageMultiplier
  );
}
/** Compatibility coefficient summary. Execution and CP retain the individual hits. */
export function resolvedDamageParts(action: ResolvedSkillAction) {
  const sum = (
    key:
      | 'physicalCoefficient'
      | 'magicCoefficient'
      | 'skillPowerCoefficient'
      | 'baseDamage',
  ) =>
    action.hitSequence.reduce(
      (total, hit) => total + hit[key] * hit.damageMultiplier,
      0,
    );
  return {
    physicalCoefficient: sum('physicalCoefficient'),
    magicCoefficient: sum('magicCoefficient'),
    skillPowerCoefficient: sum('skillPowerCoefficient'),
    flat: sum('baseDamage'),
    damageType: action.damageType,
  };
}

export function inFrontalArc(
  origin: { x: number; z: number },
  forward: { x: number; z: number },
  target: { x: number; z: number },
  range: number,
  angle: number,
) {
  const x = target.x - origin.x,
    z = target.z - origin.z,
    distance = Math.hypot(x, z),
    length = Math.hypot(forward.x, forward.z);
  if (distance > range || range < 0 || !Number.isFinite(distance)) return false;
  if (distance === 0) return true;
  return (
    length > 0 &&
    (x * forward.x + z * forward.z) / (distance * length) >=
      Math.cos((Math.min(360, Math.max(0, angle)) * Math.PI) / 360) - 1e-10
  );
}

/** World-owned, simulation-time queue. No setTimeout and no detached callbacks. */
export class SkillHitQueue {
  private time = 0;
  private generation = 0;
  private pending: { at: number; valid: () => boolean; run: () => void }[] = [];
  schedule(
    hits: readonly ResolvedSkillHit[],
    valid: () => boolean,
    run: (hit: ResolvedSkillHit) => void,
  ) {
    const generation = this.generation;
    for (const hit of hits) {
      const entry = {
        at: this.time + hit.delay,
        valid: () => generation === this.generation && valid(),
        run: () => run(hit),
      };
      if (hit.delay === 0) {
        if (entry.valid()) entry.run();
      } else if (entry.valid()) this.pending.push(entry);
    }
    this.pending.sort((a, b) => a.at - b.at);
  }
  update(dt: number) {
    this.time += Math.max(0, dt);
    const ready = this.pending.filter((entry) => entry.at <= this.time);
    this.pending = this.pending.filter(
      (entry) => entry.at > this.time && entry.valid(),
    );
    for (const entry of ready) if (entry.valid()) entry.run();
  }
  clear() {
    this.generation++;
    this.pending = [];
  }
  get size() {
    return this.pending.length;
  }
}
