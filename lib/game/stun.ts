export type StunTargetPolicy = 'NORMAL' | 'REDUCED' | 'IMMUNE';

export type StunState = {
  sourceActorId: string;
  sourceSkillId: string;
  chance: number;
  pveDuration: number;
  pvpDuration: number;
  appliedAt: number;
  expiresAt: number;
  targetPolicy: StunTargetPolicy;
};

export type StunTarget = {
  stunState?: StunState;
  stunImmune?: boolean;
  /** Future boss/elite/PvP policy hook; no reduction values are activated here. */
  stunPolicy?: (requested: StunApplication) => StunTargetPolicy;
};

export type StunApplication = Omit<StunState, 'appliedAt' | 'expiresAt'> & {
  now: number;
  pvp?: boolean;
};

export const chargeStunEligible = (travelDistance: number, minimumTravelDistance: number) =>
  Number.isFinite(travelDistance) && travelDistance >= minimumTravelDistance;

export const stunChanceForRank = (chanceByRank: readonly number[], rank: number) =>
  Math.max(0, chanceByRank[Math.max(1, Math.floor(rank)) - 1] ?? 0);

export function isStunned(target: StunTarget, now: number): boolean {
  return Boolean(target.stunState && target.stunState.expiresAt > now);
}

export function remainingStun(target: StunTarget, now: number): number {
  return Math.max(0, (target.stunState?.expiresAt ?? 0) - now);
}

export function clearExpiredStun<T extends StunTarget>(target: T, now: number): T {
  if (target.stunState && target.stunState.expiresAt <= now) delete target.stunState;
  return target;
}

export function applyStun<T extends StunTarget>(target: T, application: StunApplication): boolean {
  const targetPolicy = target.stunPolicy?.(application) ?? application.targetPolicy;
  if (target.stunImmune || targetPolicy === 'IMMUNE') return false;
  const duration = Math.max(0, application.pvp ? application.pvpDuration : application.pveDuration);
  if (!duration) return false;
  const expiresAt = application.now + duration;
  // Reapplication is refresh/replace only: never add remaining durations.
  if (target.stunState && target.stunState.expiresAt >= expiresAt) return false;
  target.stunState = {
    sourceActorId: application.sourceActorId,
    sourceSkillId: application.sourceSkillId,
    chance: application.chance,
    pveDuration: application.pveDuration,
    pvpDuration: application.pvpDuration,
    appliedAt: application.now,
    expiresAt,
    targetPolicy,
  };
  return true;
}
