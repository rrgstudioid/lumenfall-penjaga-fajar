/** Adapter over existing Hero timers and Enemy fields; no second status store. */
export type StatusTarget = {
  statusEffects?: Record<string, number>;
  /** Runtime-only source-owned applications. Never serialize into character saves. */
  sourceOwnedStatuses?: Record<string, SourceOwnedStatus[]>;
  stun?: number;
  slow?: number;
  root?: number;
  poison?: number;
  defenseDown?: number;
  marked?: boolean;
  weakPoint?: boolean;
};
export type SourceOwnedStatus = {
  sourceActorId: string;
  sourceSkillId: string;
  strength: number;
  appliedAt: number;
  expiresAt: number;
};
const aliases: Record<string, string> = {
  armor_break: 'defenseDown',
  mark: 'marked',
  weak_point: 'weakPoint',
};
const legacyFields = new Set([
  'stun',
  'slow',
  'root',
  'poison',
  'defenseDown',
  'marked',
  'weakPoint',
]);
export const canonicalStatus = (id: string) => aliases[id] ?? id;
export function getStatus(
  target: StatusTarget,
  id: string,
): number | boolean | undefined {
  const key = canonicalStatus(id);
  // Legacy permanent marks coexist with opt-in timed marks. Never reinterpret
  // existing legacy offensive mark behavior, which still sets the boolean directly.
  if(key==='marked'||key==='weakPoint')return target[key] || target.statusEffects?.[key];
  if (legacyFields.has(key) && key in target)
    return (target as Record<string, number | boolean>)[key];
  return target.statusEffects?.[key];
}
export function hasStatus(target: StatusTarget, id: string) {
  return Number(getStatus(target, id) ?? 0) > 0;
}

function activeSourceStatuses(target: StatusTarget, id: string, now = 0) {
  const key = canonicalStatus(id);
  return (target.sourceOwnedStatuses?.[key] ?? []).filter(entry =>
    Number.isFinite(entry.expiresAt) && entry.expiresAt > now,
  );
}

/** Returns all active applications without collapsing ownership. */
export function getActiveStatusApplications(target: StatusTarget, id: string, now = 0) {
  return activeSourceStatuses(target, id, now).map(entry => ({ ...entry }));
}

export function hasActiveStatusFromSource(target: StatusTarget, id: string, sourceActorId: string, now = 0) {
  return activeSourceStatuses(target, id, now).some(entry => entry.sourceActorId === sourceActorId);
}

/** Strongest value wins; ties prefer the later expiry and then newer application. */
export function strongestActiveStatus(target: StatusTarget, id: string, now = 0) {
  return activeSourceStatuses(target, id, now).sort((a, b) =>
    b.strength - a.strength || b.expiresAt - a.expiresAt || b.appliedAt - a.appliedAt,
  )[0];
}

/** Armor Break keeps its historic 20% fallback for legacy applications. */
export function effectiveArmorBreakStrength(target: StatusTarget, now = 0) {
  const key = canonicalStatus('armor_break');
  if (target.sourceOwnedStatuses !== undefined) return strongestActiveStatus(target, key, now)?.strength ?? 0;
  return hasStatus(target, key) ? 20 : 0;
}

export function applySourceOwnedStatus(
  target: StatusTarget,
  id: string,
  application: Omit<SourceOwnedStatus, 'expiresAt'> & { duration: number },
) {
  if (!Number.isFinite(application.duration) || application.duration <= 0) return;
  const key = canonicalStatus(id);
  const expiresAt = application.appliedAt + application.duration;
  const existing = (target.sourceOwnedStatuses?.[key] ?? []).find(entry => entry.sourceActorId === application.sourceActorId);
  const current = (target.sourceOwnedStatuses?.[key] ?? []).filter(entry =>
    entry.sourceActorId !== application.sourceActorId,
  );
  target.sourceOwnedStatuses ??= {};
  target.sourceOwnedStatuses[key] = [...current, { ...application, strength: Math.max(existing?.strength ?? 0, application.strength), expiresAt }];
  // Keep the established compatibility timer in sync for existing mitigation/UI.
  applyStatus(target, key, application.duration);
}

export function clearExpiredSourceStatuses(target: StatusTarget, now: number) {
  if (!target.sourceOwnedStatuses) return;
  for (const key of Object.keys(target.sourceOwnedStatuses)) {
    const active = target.sourceOwnedStatuses[key].filter(entry => entry.expiresAt > now);
    if (active.length) target.sourceOwnedStatuses[key] = active;
    else delete target.sourceOwnedStatuses[key];
  }
}
export function applyStatus(
  target: StatusTarget,
  id: string,
  duration: number | { duration: number },
) {
  const key = canonicalStatus(id),
    value = typeof duration === 'number' ? duration : duration.duration;
  if (!Number.isFinite(value) || value <= 0) return;
  if (legacyFields.has(key) && key in target && key!=='marked' && key!=='weakPoint') {
    const fields = target as Record<string, number | boolean>;
    fields[key] = Math.max(Number(fields[key] ?? 0), value);
  } else {
    target.statusEffects ??= {};
    target.statusEffects[key] = Math.max(target.statusEffects[key] ?? 0, value);
  }
}
export function removeStatus(target: StatusTarget, id: string) {
  const key = canonicalStatus(id);
  if (legacyFields.has(key) && key in target)
    (target as Record<string, number | boolean>)[key] =
      key === 'marked' || key === 'weakPoint' ? false : 0;
  if (target.statusEffects) delete target.statusEffects[key];
}

export type DefenseResult = 'none' | 'hit' | 'blocked' | 'parried';
export type DefenseEvent = {
  result: DefenseResult;
  timestamp: number;
  sourceId?: string;
  consumed: boolean;
};
export const DEFENSE_EVENT_MAX_AGE_MS = 5000;
/** Ephemeral world state, milliseconds of active simulation time, never saved. */
export class DefenseEvents {
  lastDefenseEvent: DefenseEvent | undefined;
  snapshot(accepted:readonly ('blocked'|'parried')[],windowMs:number,now:number):Readonly<{result:'none'|'blocked'|'parried';timestamp?:number;sourceId?:string}> {
    const event=this.lastDefenseEvent;
    if(!event||!accepted.some(result=>result===event.result)||!this.recent(event.result,windowMs,now))return Object.freeze({result:'none'});
    return Object.freeze({result:event.result as 'blocked'|'parried',timestamp:event.timestamp,sourceId:event.sourceId});
  }
  record(
    target: StatusTarget,
    blocked: boolean,
    now: number,
    sourceId?: string,
  ): DefenseResult {
    const result = hasStatus(target, 'parry')
      ? 'parried'
      : blocked
        ? 'blocked'
        : 'hit';
    this.lastDefenseEvent = {
      result,
      timestamp: now,
      sourceId,
      consumed: false,
    };
    return result;
  }
  recent(result: DefenseResult, windowMs: number, now: number) {
    const event = this.lastDefenseEvent;
    return (
      Number.isFinite(windowMs) &&
      !!event &&
      !event.consumed &&
      event.result === result &&
      now >= event.timestamp &&
      now - event.timestamp <=
        Math.min(DEFENSE_EVENT_MAX_AGE_MS, Math.max(0, windowMs))
    );
  }
  consume(result: DefenseResult, windowMs: number, now: number) {
    if (!this.recent(result, windowMs, now)) return false;
    this.lastDefenseEvent!.consumed = true;
    return true;
  }
  clear() {
    this.lastDefenseEvent = undefined;
  }
}
