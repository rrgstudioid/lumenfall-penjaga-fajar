import { COMBAT_MECHANICS, blockChance } from './combat-mechanics.ts';
export type SharedEffectKind = 'block' | 'guard' | 'threat' | 'taunt' | 'challenge' | 'damage_transfer' | 'controlled_entity';
export type SharedEffect = { id: string; kind: SharedEffectKind; enabled: boolean;
  magnitude: number | null; duration: number | null; priority: number | null };
/** No consumer may infer stacking or durations from null. */
export const SHARED_EFFECTS: readonly SharedEffect[] = [
  { id: 'physical-block', kind: 'block', enabled: true, magnitude: COMBAT_MECHANICS.blockDamageReduction, duration: 0, priority: 0 },
  { id: 'manual-guard', kind: 'guard', enabled: true, magnitude: 1 - COMBAT_MECHANICS.manualGuardMultiplier, duration: 0, priority: 0 },
  ...(['threat','taunt','challenge','damage_transfer','controlled_entity'] as const).map(kind =>
    ({ id: kind, kind, enabled: false, magnitude: null, duration: null, priority: null })),
];
export function validateSharedEffect(effect: SharedEffect) {
  return !effect.enabled || [effect.magnitude, effect.duration, effect.priority].every(n => n !== null && Number.isFinite(n) && n >= 0);
}
/** Existing multiplicative Block/Guard contract, used by runtime and CP. */
export function resolveDefenseMultiplier({ damageReduction = 0, blocked = false, guarding = false,
  expectedBlockRate }: { damageReduction?: number; blocked?: boolean; guarding?: boolean; expectedBlockRate?: number }) {
  const block = expectedBlockRate === undefined ? Number(blocked) : blockChance(expectedBlockRate);
  return (1 - Math.min(100, Math.max(0, damageReduction)) / 100) *
    (1 - block * SHARED_EFFECTS[0].magnitude!) * (guarding ? 1 - SHARED_EFFECTS[1].magnitude! : 1);
}
export type ThreatPolicy = { damageMultiplier: number; tauntThreat: number;
  challengeThreat: number; forcedTargetPriority: 'taunt' | 'challenge'; tie: 'existing' | 'actor_id' };
/** Requires a complete encounter policy; there is intentionally no live default. */
export function resolveThreat(current: Readonly<Record<string, number>>, event: {
  actorId: string; kind: 'damage' | 'taunt' | 'challenge'; amount: number;
}, policy: ThreatPolicy | null): Record<string, number> {
  if (!policy) return { ...current };
  if (![policy.damageMultiplier, policy.tauntThreat, policy.challengeThreat, event.amount].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Invalid threat policy');
  const amount = event.kind === 'damage' ? event.amount * policy.damageMultiplier : event.kind === 'taunt' ? policy.tauntThreat : policy.challengeThreat;
  return { ...current, [event.actorId]: (current[event.actorId] ?? 0) + amount };
}
export function resolveThreatTarget(threat: Readonly<Record<string, number>>, previous: string | null,
  forced: readonly { actorId: string; kind: 'taunt' | 'challenge'; expiresAt: number }[],
  now: number, policy: ThreatPolicy | null): string | null {
  if (!policy) return previous;
  const active = forced.filter(effect => effect.expiresAt > now);
  const preferred = active.filter(effect => effect.kind === policy.forcedTargetPriority);
  const forcedIds = (preferred.length ? preferred : active).map(effect => effect.actorId);
  const best = Math.max(0, ...Object.values(threat));
  const ids = forcedIds.length ? forcedIds : Object.keys(threat).filter(id => threat[id] === best);
  if (policy.tie === 'existing' && previous && ids.includes(previous)) return previous;
  return [...ids].sort()[0] ?? null;
}
export function resolveDamageTransfer(damage: number, sourceId: string, recipientId: string,
  policy: { fraction: number; allowSelf: false; chaining: false } | null) {
  if (!Number.isFinite(damage) || damage < 0) throw new Error('Invalid damage');
  if (!policy || sourceId === recipientId) return { retained: damage, transferred: 0 };
  if (!Number.isFinite(policy.fraction) || policy.fraction < 0 || policy.fraction > 1) throw new Error('Invalid transfer fraction');
  const transferred = damage * policy.fraction;
  return { retained: damage - transferred, transferred };
}
export type ControlledEntity = { id: string; ownerId: string; enabled: boolean; skillIds: readonly string[] };
export function controlledEntityCanAct(entity: ControlledEntity, ownerId: string, skillId: string) {
  return entity.enabled && entity.ownerId === ownerId && entity.skillIds.includes(skillId);
}
