import { composeAttackCore, composeBonusScaling, prepareRawAttackExecution, expectedRawAttackExecution,
  type AttackExecutionSnapshot, type AttackSource, type FoundationResult } from './attack-range-v2.ts';
import { BASIC_REFERENCE_B } from './basic-attack-reference-v2.ts';
import { adventurerReferenceSkillMetadata, ADVENTURER_RANKS_REFERENCE } from './adventurer-ranks-reference-v2.ts';
import { basePhysicalAttackForLevel } from './rules.ts';
import type { Provenance } from './expected-final-damage-v2.ts';
import { IRON_SWORD_RANGE_V2, ironSwordAuthoredRange } from './iron-sword-range-v2.ts';
import type { ItemData } from './items.ts';

/** Mathematical cohort description. No host/Hero enrollment or runtime receipts.
 * Allocations/ledgers below are validated arithmetic, not proof of legal purchases. */
export type AdventurerDiagnosticInput = Readonly<{
  kind: 'MATHEMATICAL_COHORT_NOT_RUNTIME_AUTHORITY'; provenance: Provenance;
  job: 'adventurer'; level: number;
  allocation: Readonly<{ STR: number; VIT: number; DEX: number; INT: number }>;
  unspentPoints: number; ranks: Readonly<{ quick: number; power: number; heal: number }>;
  ledger: Readonly<{ earned: number; spent: number; available: number; quickGranted: number; powerGranted: number; healGranted: number }>;
  weapon: Readonly<{ templateId: string; instanceLabel: string; hand: 'MAIN'; enhancement: number; otherSources: 'NONE'; authored?: Partial<ItemData> }>;
  maxHP: number;
}>;
type Action = Readonly<{ id: string; rank: number; event: number | null; channel: 'physical' | 'heal';
  mana: number | null; cooldown: number | null; snapshot: AttackExecutionSnapshot | null;
  expectedRaw: number | null; healCapacity: number | null }>;
class DiagnosticFailure extends Error {
  constructor(readonly code: string, readonly path: string, reason: string) { super(reason); }
}
function fail(code: string, path: string, reason: string): never { throw new DiagnosticFailure(code, path, reason); }
function checked<T>(work: () => T): FoundationResult<T> {
  try { return Object.freeze({ ok: true, value: work() }); }
  catch (e) {
    if (!(e instanceof DiagnosticFailure)) throw e;
    return Object.freeze({ ok: false, code: e.code, path: e.path, reason: e.message });
  }
}
function read(object: unknown, key: string): unknown {
  if (!object || typeof object !== 'object' || Array.isArray(object)) fail('INPUT_MISSING', key, 'Explicit data required');
  const d = Object.getOwnPropertyDescriptor(object, key);
  if (!d) fail('INPUT_MISSING', key, 'Explicit own input required');
  if (!Object.hasOwn(d, 'value')) fail('ACCESSOR_INPUT', key, 'No getter input');
  return d.value;
}
function shape(value: unknown, keys: readonly string[], path: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INPUT_MISSING', path, 'Data object required');
  if (Reflect.ownKeys(value).some(k => typeof k !== 'string' || !keys.includes(k)))
    fail('UNSUPPORTED_SOURCE', path, 'Unknown sources/fields are not ignored');
  for (const key of keys) read(value, key);
}
function n(value: unknown, path: string, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || integer && !Number.isSafeInteger(value))
    fail('INVALID_NUMBER', path, 'Finite nonnegative number with required integrality');
  return value;
}
function p(value: unknown): Provenance {
  const fields = ['source', 'version', 'label'] as const;
  shape(value, fields, 'provenance');
  const pairs = fields.map(key => {
    const v = read(value, key);
    if (typeof v !== 'string' || !v.trim()) fail('INPUT_MISSING', `provenance.${key}`, 'Source/assumption labels required');
    return [key, v];
  });
  return Object.freeze(Object.fromEntries(pairs)) as Provenance;
}
function unwrap<T>(value: FoundationResult<T>): T {
  if (!value.ok) fail(value.code, value.path, value.reason);
  return value.value;
}

export function healCapacity(maxHP: number, percent: number, missingHP?: number) {
  return checked(() => {
    n(maxHP, 'maxHP'); n(percent, 'percent');
    if (percent > 100) fail('INVALID_NUMBER', 'percent', 'Percent exceeds supported healing capacity');
    const capacity = Math.round(maxHP * percent / 100);
    if (!Number.isSafeInteger(capacity)) fail('NUMERICAL_LIMIT', 'heal', 'Capacity outside safe integer arithmetic');
    if (missingHP !== undefined && n(missingHP, 'missingHP') > maxHP) fail('INVALID_NUMBER', 'missingHP', 'Missing HP exceeds maximum');
    return Object.freeze({ channel: 'HEAL_CAPACITY_NOT_USABLE_SUSTAIN' as const, capacity,
      clamped: missingHP === undefined ? null : Math.min(capacity, missingHP), missingHP: missingHP ?? null });
  });
}

export function buildAdventurerDiagnosticProfile(input: AdventurerDiagnosticInput) {
  return checked(() => {
    shape(input, ['kind','provenance','job','level','allocation','unspentPoints','ranks','ledger','weapon','maxHP'], 'input');
    if (read(input, 'kind') !== 'MATHEMATICAL_COHORT_NOT_RUNTIME_AUTHORITY' || read(input, 'job') !== 'adventurer')
      fail('UNSUPPORTED_SCOPE', 'input', 'Explicit mathematical Adventurer cohort required');
    const provenance = p(read(input, 'provenance')), level = n(read(input, 'level'), 'level', true);
    if (level < 1 || level > 14) fail('UNSUPPORTED_SCOPE', 'level', 'Bounded Lv1-14 only');
    const allocation = read(input, 'allocation');
    const keys = ['STR', 'VIT', 'DEX', 'INT'] as const;
    shape(allocation, keys, 'allocation');
    const effective = Object.fromEntries(keys.map(k => [k, 15 + n(read(allocation, k), `allocation.${k}`, true)])) as Record<typeof keys[number], number>;
    const unspent = n(read(input, 'unspentPoints'), 'unspentPoints', true);
    if (unspent + keys.reduce((sum, k) => sum + effective[k] - 15, 0) !== 2 * (level - 1))
      fail('INVALID_PRIMARY_BUDGET', 'allocation', 'Allocation plus unspent must equal earned budget');
    const ranks = read(input, 'ranks'), q = n(read(ranks, 'quick'), 'quick', true),
      power = n(read(ranks, 'power'), 'power', true), heal = n(read(ranks, 'heal'), 'heal', true);
    shape(ranks, ['quick','power','heal'], 'ranks');
    if (q < 1 || q > 5 || power > 5 || heal > 3) fail('INVALID_RANK', 'ranks', 'Unsupported rank');
    const ledger = read(input, 'ledger'), spent = q - 1 + power + heal;
    shape(ledger, ['earned','spent','available','quickGranted','powerGranted','healGranted'], 'ledger');
    if (n(read(ledger, 'earned'), 'earned', true) !== level - 1 || n(read(ledger, 'spent'), 'spent', true) !== spent ||
        n(read(ledger, 'available'), 'available', true) !== level - 1 - spent ||
        read(ledger, 'quickGranted') !== 1 || read(ledger, 'powerGranted') !== 0 || read(ledger, 'healGranted') !== 0)
      fail('INVALID_LEDGER', 'ledger', 'Paid/granted ledger does not reconcile');
    const weapon = read(input, 'weapon'), instanceLabel = read(weapon, 'instanceLabel');
    const iron = read(weapon, 'templateId') === IRON_SWORD_RANGE_V2.templateId;
    if (!iron && Object.hasOwn(weapon!, 'authored')) fail('UNSUPPORTED_SOURCE', 'weapon.authored', 'Training uses its existing shared source, not caller authoring override');
    shape(weapon, ['templateId','instanceLabel','hand','enhancement','otherSources', ...(Object.hasOwn(weapon!, 'authored') ? ['authored'] : [])], 'weapon');
    if (!iron && read(weapon, 'templateId') !== BASIC_REFERENCE_B.templateId || read(weapon, 'hand') !== 'MAIN' ||
        read(weapon, 'enhancement') !== 0 || read(weapon, 'otherSources') !== 'NONE' || typeof instanceLabel !== 'string' || !instanceLabel.trim())
      fail('UNSUPPORTED_SOURCE', 'weapon', 'Only explicit Training/new Iron+0 MAIN/no other sources supported');
    let weaponRange: Readonly<{ min: number; max: number }> = BASIC_REFERENCE_B.baseRange;
    if (iron) {
      const authored = read(weapon, 'authored');
      const keys = ['templateId','authoredAttackVersion','levelRequirement','name','category','equipmentType','handedness','attackType','equipSlot','mainHand','offHand','twoHanded','rarity','enhancementLevel','baseStats'];
      shape(authored, keys, 'weapon.authored');
      const copy = Object.fromEntries(keys.map(key => [key, read(authored,key)]));
      shape(copy.baseStats, ['attack'], 'weapon.authored.baseStats');
      copy.baseStats = Object.freeze({ attack: read(copy.baseStats, 'attack') });
      const range = ironSwordAuthoredRange(copy as Partial<ItemData>);
      if (!range || level < 10) fail('UNSUPPORTED_SOURCE', 'weapon.authored', 'Exact mapped new Iron Lv10-14 required; old scalar is unavailable');
      weaponRange = range;
    }
    const maxHP = n(read(input, 'maxHP'), 'maxHP');
    // Source labels correlate the mathematical composition only, never actual ownership.
    const owner = Object.freeze({ actorId: provenance.label, epoch: 0 });
    const source = (category: AttackSource['category'], id: string): AttackSource => Object.freeze({ category, sourceId: id, owner });
    const core = unwrap(composeAttackCore({ damageType: 'physical', owner,
      base: { value: basePhysicalAttackForLevel(level), source: source('BASE', 'approved-base') },
      primary: { effective: effective.STR, stat: 'STR', source: source('PRIMARY_STAT', 'bonus-str') }, globalFlat: [] }));
    const identity = Object.freeze({ instanceId: instanceLabel, kind: 'weapon' as const, owner });
    const physical = (id: string, rank: number, c: number, str: number, mana: number | null, cooldown: number | null, event: number | null): Action => {
      const scaling = unwrap(composeBonusScaling(effective, { STR: str }));
      const snapshot = unwrap(prepareRawAttackExecution({ context: { validation: 'VALIDATED_EXECUTION_CONTEXT',
        executionId: `MATHEMATICAL:${id}:${rank}:${event}`, owner, mode: 'SINGLE_MAIN', dualWeaponAuthorized: false,
        thrownAuthorized: false, magicSourceHands: [], instances: { MAIN: identity } }, core,
        layers: { MAIN: { hand: 'MAIN', identity, damageType: 'physical', source: source('RAW_WEAPON', instanceLabel),
          composition: { stage: 'BASE', range: weaponRange, enhancementMultiplier: 1, contributionMultiplier: 1 } } },
        attackModifier: { scope: 'ATTACK_RANGE', damageType: 'physical', multiplier: 1, sources: [] },
        rankBudget: { coefficient: c, scaling, source: source('SKILL_RANK', `${id}:${rank}`) }, hits: [{ hand: 'MAIN', weight: 1 }] }));
      return Object.freeze({ id, rank, event, channel: 'physical', mana, cooldown, snapshot,
        expectedRaw: unwrap(expectedRawAttackExecution(snapshot)).totalRaw, healCapacity: null });
    };
    // Each Basic is an independent one-hit action; time/resource availability is not invented.
    const actions: Action[] = [1, 2, 3].map(event => physical('basic', 0, 1, 0, null, null, event));
    for (const [id, rank] of [[ADVENTURER_RANKS_REFERENCE.skills[0], q], [ADVENTURER_RANKS_REFERENCE.skills[1], power], ['v3-adventurer-minor-heal', heal]] as const) {
      if (rank === 0) continue;
      const m = adventurerReferenceSkillMetadata(id, rank);
      if (!m || level < m.gate) fail('INVALID_RANK_GATE', id, 'Current rank gate unmet');
      if (m.healPercent !== null) actions.push(Object.freeze({ id, rank, event: null, channel: 'heal', mana: m.mana,
        cooldown: m.cooldown, snapshot: null, expectedRaw: null, healCapacity: unwrap(healCapacity(maxHP, m.healPercent)).capacity }));
      else actions.push(physical(id, rank, m.coefficient!, m.bonusSTRCoefficient!, m.mana, m.cooldown, null));
    }
    return Object.freeze({ version: 'ADVENTURER_CP_DIAGNOSTIC_FOUNDATION_V2', authority: 'MATHEMATICAL_ONLY_NO_ENROLLMENT',
      sourceVersion: ADVENTURER_RANKS_REFERENCE.version, provenance, level, effective: Object.freeze(effective),
      core: core.value, base: basePhysicalAttackForLevel(level), bonusSTR: core.bonusPrimary,
      weaponRange, actions: Object.freeze(actions) });
  });
}

export type ExplicitSchedule = Readonly<{
  provenance: Provenance; model: 'CONTINUOUS_CAPPED_MANA_EXCLUSIVE_OCCUPANCY_START_CD';
  horizon: number; initialMana: number; maxMana: number; recoveryPerSecond: number;
  actions: readonly Readonly<{ id: string; provenance: Provenance; mana: number; cooldown: number; occupancy: number; initialReadyAt: number }>[];
  casts: readonly Readonly<{ id: string; at: number }>[];
}>;
/** Evaluates only the declared schedule. Not a rotation, rate or sustain policy. */
export function evaluateDiagnosticSchedule(input: ExplicitSchedule) {
  return checked(() => {
    shape(input, ['provenance','model','horizon','initialMana','maxMana','recoveryPerSecond','actions','casts'], 'schedule');
    p(read(input, 'provenance'));
    if (read(input, 'model') !== 'CONTINUOUS_CAPPED_MANA_EXCLUSIVE_OCCUPANCY_START_CD')
      fail('UNSUPPORTED_SCHEDULE', 'model', 'Explicit supported recovery/occupancy/CD model required');
    const horizon = n(read(input, 'horizon'), 'horizon'), max = n(read(input, 'maxMana'), 'maxMana');
    let mana = n(read(input, 'initialMana'), 'initialMana');
    if (mana > max) fail('INVALID_NUMBER', 'initialMana', 'Exceeds MaxMana');
    const rate = n(read(input, 'recoveryPerSecond'), 'recoveryPerSecond');
    if (!Number.isFinite(rate * horizon)) fail('ARITHMETIC_OVERFLOW', 'recovery', 'Recovery overflow');
    const rawActions = read(input, 'actions'), casts = read(input, 'casts');
    if (!Array.isArray(rawActions) || !Array.isArray(casts)) fail('INPUT_MISSING', 'actions/casts', 'Explicit arrays required');
    if (rawActions.length > 64 || casts.length > 4096) fail('SUPPORTED_LIMIT', 'schedule', 'Bounded diagnostic schedule exceeded');
    const actions = new Map<string, { mana: number; cooldown: number; occupancy: number; ready: number }>();
    for (const a of rawActions) {
      shape(a, ['id','provenance','mana','cooldown','occupancy','initialReadyAt'], 'actions');
      const id = read(a, 'id'); p(read(a, 'provenance'));
      if (typeof id !== 'string' || !id.trim() || actions.has(id)) fail('INVALID_ACTION', 'actions.id', 'Unique action ID required');
      actions.set(id, { mana: n(read(a, 'mana'), 'mana'), cooldown: n(read(a, 'cooldown'), 'cooldown'),
        occupancy: n(read(a, 'occupancy'), 'occupancy'), ready: n(read(a, 'initialReadyAt'), 'initialReadyAt') });
    }
    let time = 0, busyUntil = 0, occupied = 0, paid = 0, recovered = 0;
    const evidence = [];
    const recover = (dt: number) => {
      const addition = Math.min(max - mana, rate * dt);
      if (addition > 0 && mana + addition === mana) fail('NUMERICAL_LIMIT', 'recovery', 'Positive recovery lost at current magnitude');
      mana += addition; recovered += addition;
    };
    for (const cast of casts) {
      shape(cast, ['id','at'], 'cast');
      const at = n(read(cast, 'at'), 'cast.at'), id = read(cast, 'id');
      const action = typeof id === 'string' && actions.get(id);
      if (!action) fail('INVALID_ACTION', 'cast.id', 'No declared action');
      if (action.cooldown > 0 && at + action.cooldown === at || action.occupancy > 0 && at + action.occupancy === at)
        fail('NUMERICAL_LIMIT', 'cast.at', 'Positive CD/occupancy lost at current time magnitude');
      if (at < time || at < busyUntil || at + action.occupancy > horizon) fail('TIME_CONSERVATION', 'cast.at', 'Order/occupancy/horizon violation');
      if (at < action.ready) fail('COOLDOWN_CONSTRAINT', 'cast.at', 'Action not ready');
      recover(at - time); time = at;
      if (mana < action.mana) fail('MANA_CONSERVATION', 'cast.mana', 'Cannot spend unavailable Mana');
      if (action.mana > 0 && mana - action.mana === mana) fail('NUMERICAL_LIMIT', 'cast.mana', 'Positive payment lost at current magnitude');
      mana -= action.mana; paid += action.mana; occupied += action.occupancy;
      busyUntil = at + action.occupancy; action.ready = at + action.cooldown;
      if (![paid, occupied, action.ready].every(Number.isFinite)) fail('ARITHMETIC_OVERFLOW', 'schedule', 'Resolved arithmetic overflow');
      evidence.push(Object.freeze({ id, at, manaAfter: mana, readyAt: action.ready, occupiedUntil: busyUntil }));
    }
    recover(horizon - time);
    return Object.freeze({ kind: 'DECLARED_SCHEDULE_CAPACITY_NOT_OPTIMAL_ROTATION', horizon, paidMana: paid,
      effectiveRecoveredMana: recovered, finalMana: mana, occupiedTime: occupied, unusedTime: horizon - occupied,
      casts: Object.freeze(evidence), score: null });
  });
}
