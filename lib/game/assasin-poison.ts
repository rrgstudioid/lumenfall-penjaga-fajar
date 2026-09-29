import { thiefJobCapabilities } from './thief-job-capabilities.ts';

/** Normal Assasin Poison only. Separate namespace from legacy Poison and future
 * special DoTs (e.g. Venom Eclipse); never serialize this world-owned store. */
export const POISON_MAX_STACKS = 5;
export const POISON_DURATION = 6;
export const POISON_TICK_INTERVAL = 1;
export const POISON_STACK_MULTIPLIERS = [1, 1.3, 1.6, 1.9, 2.2] as const;
export const POISON_SLOW = { pve: [10, 12, 14, 16, 18], pvp: [6, 8, 10, 12, 14] } as const;
export const POISON_SLOW_CAP = { pve: 25, pvp: 18 } as const;
export type PoisonContext = 'pve' | 'pvp';
export type PoisonActor = {
  characterId?: string; slotId: string; hp: number; skillArchitectureVersion?: number;
  coreJob?: string | null; specialization?: string | null;
  skillProgressionV3?: { chosenCoreJob: string | null; chosenSpecialization: string | null; chosenAdvancedJob?: string | null };
};
export type PoisonTarget = { hp: number };
/** Skill data supplies every potency value and chooses roll policy explicitly.
 * Stats/profile are snapshotted on application and replaced on a valid refresh.
 * There are no fallback potency coefficients. */
export type AssasinPoisonProfile = {
  id: string; baseDamageMin: number; baseDamageMax: number;
  patkCoefficient: number; dexCoefficient: number; rank: number; skillPowerFactor: 8;
  baseRollPolicy: 'PER_TICK' | 'APPLICATION_SNAPSHOT';
};
export type PoisonSnapshot = {
  physicalAttack: number; effectiveDex: number; level: number;
  physicalPenetration: number; bossDamage: number; eliteDamage: number;
};
export type AssasinPoisonConfig = {
  profilesByRank: readonly AssasinPoisonProfile[];
  maxPoisonStacksGrantedPerExecution: number;
};
type Crippling = { sourceSkillId: string; pveBonusPP: number; pvpBonusPP: number; expiresAt: number };
export type NormalPoisonRecord = {
  casterActorId: string; targetActorId: string; sourceSkillId: string;
  stackCount: number; appliedAt: number; expiresAt: number; nextTickAt: number;
  profile: AssasinPoisonProfile; snapshot: PoisonSnapshot;
  baseRoll?: number; crippling?: Crippling;
};
export type PoisonTick = {
  kind: 'assasin_normal_poison'; damageKind: 'dot'; damageType: 'physical'; canCrit: false;
  casterActorId: string; targetActorId: string; sourceSkillId: string;
  at: number; stacks: number; baseRoll: number; rawDamage: number; snapshot: PoisonSnapshot;
};
const actorId = (actor: PoisonActor) => actor.characterId ?? actor.slotId;
export function canApplyAssasinPoison(actor: PoisonActor): boolean {
  return actor.hp > 0 && thiefJobCapabilities(actor).canApplyAssasinPoison;
}
const finiteNonnegative = (value: number) => Number.isFinite(value) && value >= 0;
export function validPoisonProfile(profile: AssasinPoisonProfile | undefined): profile is AssasinPoisonProfile {
  return !!profile && !!profile.id && profile.skillPowerFactor === 8 &&
    Number.isInteger(profile.rank) && profile.rank >= 1 &&
    [profile.baseDamageMin, profile.baseDamageMax, profile.patkCoefficient, profile.dexCoefficient].every(finiteNonnegative) &&
    profile.baseDamageMax >= profile.baseDamageMin &&
    (profile.baseRollPolicy === 'PER_TICK' || profile.baseRollPolicy === 'APPLICATION_SNAPSHOT');
}
const validSnapshot = (s: PoisonSnapshot) => !!s &&
  [s.physicalAttack, s.effectiveDex, s.level, s.physicalPenetration, s.bossDamage, s.eliteDamage].every(finiteNonnegative) && s.level >= 1;
const stackIndex = (stacks: number) => Math.max(0, Math.min(4, Math.floor(stacks) - 1));
/** V4 raw only: no avoidance/crit roll and no defense bypass. The runtime sink
 * must use its ordinary mitigation + HP/death path, not subtract raw directly. */
export function poisonTickRaw(profile: AssasinPoisonProfile, snapshot: PoisonSnapshot, stacks: number, baseRoll: number) {
  if (!validPoisonProfile(profile) || !validSnapshot(snapshot) || !Number.isInteger(stacks) || stacks < 1 || stacks > POISON_MAX_STACKS || !Number.isFinite(baseRoll)) return 0;
  const roll = Math.max(profile.baseDamageMin, Math.min(profile.baseDamageMax, baseRoll));
  return (roll * 8 + snapshot.physicalAttack * profile.patkCoefficient +
    Math.max(0, snapshot.effectiveDex - 15) * profile.dexCoefficient) *
    (1 + .05 * (profile.rank - 1)) * POISON_STACK_MULTIPLIERS[stackIndex(stacks)];
}

export class AssasinPoisonState<T extends PoisonTarget = PoisonTarget> {
  // Target objects are runtime instances, not item IDs or persisted spawn IDs.
  private targets = new WeakMap<T, Map<string, NormalPoisonRecord>>();
  constructor(private readonly dealTick: (target: T, tick: PoisonTick) => void, private readonly rng: () => number = Math.random) {}
  clear() { this.targets = new WeakMap(); }
  clearTarget(target: T) { this.targets.delete(target); }
  private roll(profile: AssasinPoisonProfile) {
    const value = this.rng();
    if (!Number.isFinite(value)) throw new Error('Poison RNG must return a finite value.');
    return profile.baseDamageMin + (profile.baseDamageMax - profile.baseDamageMin) * Math.max(0, Math.min(1, value));
  }
  private active(casterId: string, target: T, now: number) {
    if (target.hp <= 0) { this.clearTarget(target); return undefined; }
    const record = this.targets.get(target)?.get(casterId);
    return Number.isFinite(now) && record && record.expiresAt > now ? record : undefined;
  }
  getPoisonStacks(casterId: string, target: T, now: number) { return this.active(casterId, target, now)?.stackCount ?? 0; }
  getRecord(casterId: string, target: T, now: number) {
    const record = this.active(casterId, target, now);
    return record ? structuredClone(record) : null;
  }
  hasPending(target: T) { return (this.targets.get(target)?.size ?? 0) > 0; }
  /** Settle chronologically BEFORE refreshing/consuming, so a late frame cannot
   * retroactively give old due ticks the newly increased stack/profile. Includes
   * the tick at expiresAt, then expires all stacks together. Queries are read-only. */
  advanceTarget(target: T, now: number) {
    if (!Number.isFinite(now)) return;
    if (target.hp <= 0) { this.clearTarget(target); return; }
    const records = this.targets.get(target);
    if (!records) return;
    for (;;) {
      const due = [...records.values()].filter(r => r.nextTickAt <= now && r.nextTickAt <= r.expiresAt)
        .sort((a, b) => a.nextTickAt - b.nextTickAt || a.casterActorId.localeCompare(b.casterActorId))[0];
      if (!due) break;
      const at = due.nextTickAt;
      due.nextTickAt += POISON_TICK_INTERVAL; // Advance before callback: no duplicate/reentrant tick.
      const roll = due.baseRoll ?? this.roll(due.profile);
      this.dealTick(target, { kind: 'assasin_normal_poison', damageKind: 'dot', damageType: 'physical', canCrit: false,
        casterActorId: due.casterActorId, targetActorId: due.targetActorId, sourceSkillId: due.sourceSkillId,
        at, stacks: due.stackCount, baseRoll: roll, rawDamage: poisonTickRaw(due.profile, due.snapshot, due.stackCount, roll), snapshot: { ...due.snapshot } });
      if (target.hp <= 0) { this.clearTarget(target); return; }
      if (this.targets.get(target) !== records) return;
    }
    for (const [id, record] of records) {
      if (record.expiresAt <= now) records.delete(id);
      else if (record.crippling && record.crippling.expiresAt <= now) delete record.crippling;
    }
    if (!records.size) this.clearTarget(target);
  }
  applyPoisonStack(actor: PoisonActor, target: T, source: {
    targetActorId: string; sourceSkillId: string; profile: AssasinPoisonProfile;
    snapshot: PoisonSnapshot; successfulDamage: number;
  }, now: number): boolean {
    if (!canApplyAssasinPoison(actor) || !Number.isFinite(now) || !source.targetActorId || !source.sourceSkillId ||
      !Number.isFinite(source.successfulDamage) || source.successfulDamage <= 0 ||
      !validPoisonProfile(source.profile) || !validSnapshot(source.snapshot)) return false;
    this.advanceTarget(target, now);
    if (target.hp <= 0) return false;
    const casterActorId = actorId(actor);
    let records = this.targets.get(target);
    if (!records) { records = new Map(); this.targets.set(target, records); }
    const previous = records.get(casterActorId);
    const existing = previous?.targetActorId === source.targetActorId ? previous : undefined;
    records.set(casterActorId, {
      casterActorId, targetActorId: source.targetActorId, sourceSkillId: source.sourceSkillId,
      stackCount: Math.min(POISON_MAX_STACKS, (existing?.stackCount ?? 0) + 1),
      appliedAt: existing?.appliedAt ?? now, expiresAt: now + POISON_DURATION,
      nextTickAt: existing?.nextTickAt ?? now + POISON_TICK_INTERVAL,
      profile: structuredClone(source.profile), snapshot: { ...source.snapshot },
      ...(source.profile.baseRollPolicy === 'APPLICATION_SNAPSHOT' ? { baseRoll: this.roll(source.profile) } : {}),
      ...(existing?.crippling ? { crippling: { ...existing.crippling } } : {}),
    });
    return true;
  }
  /** Explicit future refresh effect, never called by the scheduler itself. */
  refreshPoison(actor: PoisonActor, target: T, now: number, update?: { duration?: number; profile?: AssasinPoisonProfile; snapshot?: PoisonSnapshot }) {
    if (!canApplyAssasinPoison(actor) || !Number.isFinite(now)) return false;
    if (update?.duration !== undefined && (!Number.isFinite(update.duration) || update.duration <= 0)) return false;
    if (update?.profile && !validPoisonProfile(update.profile) || update?.snapshot && !validSnapshot(update.snapshot)) return false;
    this.advanceTarget(target, now);
    const record = this.active(actorId(actor), target, now);
    if (!record) return false;
    record.expiresAt = now + (update?.duration ?? POISON_DURATION);
    if (update?.profile) {
      record.profile = structuredClone(update.profile);
      record.baseRoll = update.profile.baseRollPolicy === 'APPLICATION_SNAPSHOT' ? this.roll(update.profile) : undefined;
    }
    if (update?.snapshot) record.snapshot = { ...update.snapshot };
    return true;
  }
  consumePoisonStacks(casterId: string, target: T, amount: number | 'all', now: number): number {
    if (amount !== 'all' && (!Number.isInteger(amount) || amount <= 0)) return 0;
    this.advanceTarget(target, now);
    const record = this.active(casterId, target, now);
    if (!record) return 0;
    const consumed = amount === 'all' ? record.stackCount : Math.min(record.stackCount, amount);
    record.stackCount -= consumed;
    if (!record.stackCount) this.targets.get(target)?.delete(casterId);
    if (!this.targets.get(target)?.size) this.clearTarget(target);
    return consumed;
  }
  /** Hook only, no Crippling skill/data. One modifier per source, replace/refresh. */
  setCripplingSlow(actor: PoisonActor, target: T, effect: Omit<Crippling, 'expiresAt'> & { duration: number }, now: number) {
    if (!canApplyAssasinPoison(actor) || !Number.isFinite(now) || !effect.sourceSkillId ||
      ![effect.pveBonusPP, effect.pvpBonusPP, effect.duration].every(finiteNonnegative) || effect.duration <= 0) return false;
    this.advanceTarget(target, now);
    const record = this.active(actorId(actor), target, now);
    if (!record) return false;
    record.crippling = { ...effect, expiresAt: now + effect.duration };
    return true;
  }
  getPoisonSlow(casterId: string, target: T, now: number, context: PoisonContext = 'pve') {
    const record = this.active(casterId, target, now);
    if (!record) return 0;
    const extra = record.crippling && record.crippling.expiresAt > now
      ? context === 'pve' ? record.crippling.pveBonusPP : record.crippling.pvpBonusPP : 0;
    return Math.min(POISON_SLOW_CAP[context], POISON_SLOW[context][stackIndex(record.stackCount)] + extra);
  }
  getStrongestTargetPoisonSlow(target: T, now: number, context: PoisonContext = 'pve') {
    return Math.max(0, ...[...(this.targets.get(target)?.keys() ?? [])].map(id => this.getPoisonSlow(id, target, now, context)));
  }
  presentation(target: T, viewerId: string, now: number, context: PoisonContext = 'pve') {
    const active = [...(this.targets.get(target)?.values() ?? [])].filter(r => target.hp > 0 && r.expiresAt > now);
    if (!active.length) return null;
    const own = active.find(r => r.casterActorId === viewerId);
    return { label: 'Poison', stacks: own?.stackCount ?? Math.max(...active.map(r => r.stackCount)), ownStacks: own?.stackCount ?? 0,
      sources: active.length, slowPercent: this.getStrongestTargetPoisonSlow(target, now, context) };
  }
  /** One guard per actual execution, not per projectile callback. Each unique
   * target/impact may grant once; misses never spend its configured grant cap. */
  beginExecution(actor: PoisonActor, sourceSkillId: string, config: AssasinPoisonConfig, rank: number, snapshot: PoisonSnapshot) {
    const owner = actorId(actor), profile = config.profilesByRank[rank - 1];
    if (!sourceSkillId || !canApplyAssasinPoison(actor) || !validPoisonProfile(profile) || !validSnapshot(snapshot) ||
      !Number.isInteger(config.maxPoisonStacksGrantedPerExecution) || config.maxPoisonStacksGrantedPerExecution <= 0) return null;
    const frozenProfile = structuredClone(profile), frozenSnapshot = { ...snapshot };
    const grantLimit = config.maxPoisonStacksGrantedPerExecution;
    const seen = new Set<string>();
    let grants = 0;
    return { commitDamage: (currentActor: PoisonActor, target: T, targetActorId: string, impactId: number, damage: number, now: number) => {
      if (actorId(currentActor) !== owner || !Number.isInteger(impactId) || impactId < 0 || !(damage > 0)) return false;
      const key = JSON.stringify([targetActorId, impactId]);
      if (seen.has(key) || grants >= grantLimit) return false;
      if (!this.applyPoisonStack(currentActor, target, { targetActorId, sourceSkillId, profile: frozenProfile, snapshot: frozenSnapshot, successfulDamage: damage }, now)) return false;
      seen.add(key); grants++;
      return true;
    } };
  }
}
