import type { ProgressionArchitecture } from './progression.ts';

/** Player gameplay policy, independent of progression/job/save architecture. */
export const usesHardTargeting = (_hero: {
  progressionArchitecture?: ProgressionArchitecture;
}) => true;

export type TargetIdentity = Readonly<{
  id: number;
  instanceId: string;
  generation: number;
  regionToken: number;
}>;
export type TargetFailure =
  | 'NO_TARGET'
  | 'TARGET_INVALID'
  | 'TARGET_OUT_OF_RANGE';
export type Targetable = {
  id: number;
  hp: number;
  spawnGeneration?: number;
  group: { uuid: string; visible: boolean; parent: unknown };
};
export function targetIdentity(
  entity: Targetable,
  regionToken: number,
): TargetIdentity {
  return Object.freeze({
    id: entity.id,
    instanceId: entity.group.uuid,
    generation: entity.spawnGeneration ?? 0,
    regionToken,
  });
}
/** Constant-time identity/region/spawn validation using the world's existing entity index. */
export function validTarget<T extends Targetable>(
  identity: TargetIdentity | null | undefined,
  lookup: (id: number) => T | undefined,
  regionToken: number,
  scene: unknown,
): T | undefined {
  if (!identity || identity.regionToken !== regionToken) return;
  const entity = lookup(identity.id);
  if (
    entity &&
    entity.hp > 0 &&
    entity.group.visible &&
    entity.group.parent === scene &&
    entity.group.uuid === identity.instanceId &&
    (entity.spawnGeneration ?? 0) === identity.generation
  )
    return entity;
}
export function targetRequirement(skill: {
  targetType: string;
  effect: string;
  progressionMode?: string;
  id?: string;
}) {
  if (skill.targetType === 'self') return 'self';
  if (skill.targetType === 'frontal_arc') return 'frontal_arc';
  if (skill.targetType === 'area') return 'area';
  // Legacy factories defaulted EVERY effect to `single`. Preserve the actual
  // self/around-caster effect routes rather than requiring a target for a heal.
  // Explicit rank-values definitions retain their declared targeting semantics.
  if (skill.progressionMode !== 'rank_values') {
    if (['heal', 'buff', 'barrier', 'parry', 'stealth'].includes(skill.effect))
      return 'self';
    if (['aoe_damage', 'ultimate'].includes(skill.effect)) return 'area';
  }
  return skill.effect === 'dash_damage'
    ? 'dash_to_current_target'
    : 'current_target';
}
export const needsSelectedTarget = (skill: {
  targetType: string;
  effect: string;
  progressionMode?: string;
}) =>
  ['current_target', 'dash_to_current_target'].includes(
    targetRequirement(skill),
  );
export function targetDistance(
  a: { x: number; z: number },
  b: { x: number; z: number },
) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Optional gameplay timing, independent of animation/cooldowns. Simulation clock in seconds. */
export class ActionLock {
  until = 0;
  movementAllowed = true;
  active(now: number) {
    return now < this.until;
  }
  start(now: number, duration: number, movementAllowed = true) {
    if (Number.isFinite(duration) && duration > 0) {
      this.until = now + duration;
      this.movementAllowed = movementAllowed;
    }
  }
  clear() {
    this.until = 0;
    this.movementAllowed = true;
  }
}
