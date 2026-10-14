import { BALANCE_TARGETS } from './canonical-config.ts';
export type PvPConfig = NonNullable<typeof BALANCE_TARGETS.pvp>;
export function validatePvPConfig(config: PvPConfig | null): config is PvPConfig {
  return !!config && Object.values(config).every(n => Number.isFinite(n) && n >= 0) &&
    config.maxSingleHitHPFraction > 0 && config.maxSingleHitHPFraction < 1 &&
    config.maxContinuousCCSeconds > 0 && config.ccImmunitySeconds > 0;
}
/** Called after the shared damage resolver. Null tuning fails closed. */
export function resolvePvPDamage(damage: number, targetMaxHP: number, config: PvPConfig | null = BALANCE_TARGETS.pvp) {
  if (!validatePvPConfig(config)) return { enabled: false, damage: 0, reason: 'PVP_TUNING_REQUIRED' };
  if (!Number.isFinite(damage) || damage < 0 || !Number.isFinite(targetMaxHP) || targetMaxHP <= 0) throw new Error('Invalid PvP damage');
  return { enabled: true, damage: Math.min(damage * config.damageMultiplier, targetMaxHP * config.maxSingleHitHPFraction), reason: 'OK' };
}
export type PvPCCState = { chainStart: number; endsAt: number; immuneUntil: number };
/** One cast shares its damage safety budget across ALL hits on one target. */
export class PvPCastBudget {
  private damageByTarget = new Map<string, number>();
  constructor(private config: PvPConfig | null = BALANCE_TARGETS.pvp) {}
  resolveHit(targetId: string, raw: number, maxHP: number) {
    const hit = resolvePvPDamage(raw, maxHP, this.config);
    if (!hit.enabled || !this.config) return hit;
    const spent = this.damageByTarget.get(targetId) ?? 0;
    const damage = Math.max(0, Math.min(hit.damage, maxHP * this.config.maxSingleHitHPFraction - spent));
    this.damageByTarget.set(targetId, spent + damage);
    return { ...hit, damage };
  }
}
export function resolvePvPCC(state: PvPCCState | null, now: number, duration: number, config: PvPConfig | null = BALANCE_TARGETS.pvp) {
  if (!validatePvPConfig(config) || !Number.isFinite(now) || !Number.isFinite(duration) || duration <= 0 || now < (state?.immuneUntil ?? -Infinity)) return state;
  const chainStart = state && now <= state.endsAt ? state.chainStart : now;
  const limit = chainStart + config.maxContinuousCCSeconds;
  const endsAt = Math.min(limit, Math.max(state?.endsAt ?? now, now + duration * config.ccDurationMultiplier));
  return { chainStart, endsAt, immuneUntil: endsAt >= limit ? endsAt + config.ccImmunitySeconds : 0 };
}
