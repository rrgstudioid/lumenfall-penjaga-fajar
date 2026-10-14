import type { WeaponContributionMode, WeaponHand } from './dual-wield.ts';

/** Isolated Q2/Q4 arithmetic foundation. No actor, catalog, avoidance, Crit,
 * mitigation, HP, procs, resources, timing or live routing is implemented here. */
export type AttackDamageType = 'physical' | 'magic';
export type AttackHand = WeaponHand | 'BOTH';
export type AttackRange = Readonly<{ min: number; max: number }>;
export type AttackOwner = Readonly<{ actorId: string; epoch: number }>;
export type AttackSource = Readonly<{
  sourceId: string;
  owner: AttackOwner;
  category: 'BASE' | 'PRIMARY_STAT' | 'GLOBAL_FLAT' | 'RAW_WEAPON' | 'SUPPORT_ATTACK' | 'ATTACK_MODIFIER' | 'SKILL_RANK';
}>;
export type FoundationFailure = Readonly<{ ok: false; code: string; path: string; reason: string }>;
export type FoundationResult<T> = Readonly<{ ok: true; value: T }> | FoundationFailure;

export type CoreAttackInput = Readonly<{
  damageType: AttackDamageType;
  owner: AttackOwner;
  base: Readonly<{ value: number; source: AttackSource }>;
  primary: Readonly<{ effective: number; stat: 'STR' | 'INT'; source: AttackSource }>;
  globalFlat: readonly Readonly<{ value: number; source: AttackSource }>[];
}>;
const coreBrand = Symbol('Q2_Q4_RESOLVED_CORE');
export type ResolvedAttackCore = Readonly<{
  [coreBrand]: true;
  damageType: AttackDamageType;
  owner: AttackOwner;
  value: number;
  bonusPrimary: number;
  sources: readonly AttackSource[];
}>;
const preparedCores = new WeakSet<ResolvedAttackCore>();
export type WeaponInstanceIdentity = Readonly<{
  instanceId: string;
  kind: 'weapon' | 'support';
  owner: AttackOwner;
}>;
/** Supplied by a future authorized execution consumer, NOT inferred from mode.
 * This DTO validates arithmetic admission and identity correlation; it does not
 * prove actor equipment, weapon-family eligibility or rank authorization. */
export type ValidatedExecutionContext = Readonly<{
  validation: 'VALIDATED_EXECUTION_CONTEXT';
  executionId: string;
  owner: AttackOwner;
  mode: WeaponContributionMode;
  dualWeaponAuthorized: boolean;
  thrownAuthorized: boolean;
  magicSourceHands: readonly WeaponHand[];
  instances: Readonly<Partial<Record<WeaponHand, WeaponInstanceIdentity>>>;
}>;
export type WeaponRangeLayer = Readonly<{
  hand: WeaponHand;
  identity: WeaponInstanceIdentity;
  damageType: AttackDamageType;
  source: AttackSource;
  composition:
    | Readonly<{ stage: 'BASE'; range: AttackRange; enhancementMultiplier: number;
        contributionMultiplier: number; offHandEfficiency?: number }>
    | Readonly<{ stage: 'EFFECTIVE'; range: AttackRange;
        offHandEfficiencyApplied: boolean }>;
}>;
export type ResolvedAttackModifier = Readonly<{
  scope: 'ATTACK_RANGE';
  damageType: AttackDamageType;
  multiplier: number;
  sources: readonly AttackSource[];
}>;
/** Deliberately excluded from composer inputs; applied by a future impact resolver. */
export type ImpactDamageModifier = Readonly<{
  scope: 'PHYSICAL_DAMAGE' | 'MAGIC_DAMAGE' | 'FINAL_DAMAGE';
  multiplier: number;
  source: AttackSource;
}>;
export type RawAttackInput = Readonly<{
  context: ValidatedExecutionContext;
  core: ResolvedAttackCore;
  layers: Readonly<Partial<Record<WeaponHand, WeaponRangeLayer>>>;
  attackModifier: ResolvedAttackModifier;
  rankBudget: Readonly<{ coefficient: number; scaling: number; source: AttackSource }>;
  hits: readonly Readonly<{ hand: AttackHand; weight: number }>[];
}>;
const snapshotBrand = Symbol('Q2_Q4_ATTACK_EXECUTION');
export type AttackExecutionSnapshot = Readonly<{
  [snapshotBrand]: true;
  schema: 'ATTACK_RANGE_V2_CHECKPOINT_A';
  executionId: string;
  owner: AttackOwner;
  mode: WeaponContributionMode;
  damageType: AttackDamageType;
  sources: readonly AttackSource[];
  instances: Readonly<Partial<Record<WeaponHand, WeaponInstanceIdentity>>>;
  weaponRanges: Readonly<Partial<Record<WeaponHand, AttackRange>>>;
  hits: readonly Readonly<{ hand: AttackHand; weight: number; coefficient: number;
    scaling: number; attack: AttackRange }>[];
  coefficientBudget: number;
  scalingBudget: number;
  weightSum: number;
}>;
const preparedSnapshots = new WeakSet<AttackExecutionSnapshot>();
export type RawHit = Readonly<{
  hand: AttackHand; weight: number; coefficient: number; scaling: number;
  attack: number; raw: number;
}>;
export type SampledRawExecution = Readonly<{
  kind: 'SAMPLED_RAW'; u: number | null; hits: readonly RawHit[]; totalRaw: number;
}>;
export type ExpectedRawExecution = Readonly<{
  kind: 'EXPECTED_RAW_UNIFORM_LINEAR'; hits: readonly RawHit[]; totalRaw: number;
}>;

class InputFailure extends Error {
  constructor(readonly code: string, readonly path: string, reason: string) { super(reason); }
}
function reject(code: string, path: string, reason: string): never { throw new InputFailure(code, path, reason); }
function checked<T>(work: () => T): FoundationResult<T> {
  try { return Object.freeze({ ok: true, value: work() }); }
  catch (error) {
    if (!(error instanceof InputFailure)) throw error;
    return Object.freeze({ ok: false, code: error.code, path: error.path, reason: error.message });
  }
}
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject('INVALID_INPUT', path, 'Expected data object');
  return value as Record<string, unknown>;
}
function read(value: unknown, key: string, path: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object(value, path), key);
  if (!descriptor) return undefined;
  if (!Object.hasOwn(descriptor, 'value')) reject('INVALID_INPUT', `${path}.${key}`, 'Accessor is not an arithmetic input');
  return descriptor.value;
}
function number(value: unknown, path: string, nonnegative = true): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (nonnegative && value < 0))
    reject('INVALID_NUMBER', path, 'Expected finite numeric input with permitted sign');
  return value;
}
function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) reject('INVALID_INPUT', path, 'Expected nonempty identity');
  return value;
}
function list(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) reject('INVALID_INPUT', path, 'Expected explicit array');
  return value;
}
function owner(value: unknown, path: string): AttackOwner {
  const epoch = number(read(value, 'epoch', path), `${path}.epoch`);
  if (!Number.isSafeInteger(epoch)) reject('SOURCE_IDENTITY', path, 'Epoch must be a nonnegative safe integer');
  return Object.freeze({ actorId: text(read(value, 'actorId', path), `${path}.actorId`), epoch });
}
function sameOwner(value: unknown, expected: AttackOwner, path: string): AttackOwner {
  const actual = owner(value, path);
  if (actual.actorId !== expected.actorId || actual.epoch !== expected.epoch)
    reject('SOURCE_IDENTITY', path, 'Owner or lifecycle epoch mismatch');
  return actual;
}
function source(value: unknown, expected: AttackOwner, category: AttackSource['category'], path: string): AttackSource {
  if (read(value, 'category', path) !== category) reject('SOURCE_SCOPE', path, `Expected ${category} source`);
  return Object.freeze({ sourceId: text(read(value, 'sourceId', path), `${path}.sourceId`),
    owner: sameOwner(read(value, 'owner', path), expected, `${path}.owner`), category });
}
function uniqueSources(sources: readonly AttackSource[]) {
  const seen = new Set<string>();
  for (const entry of sources) {
    if (seen.has(entry.sourceId)) reject('DUPLICATE_SOURCE', entry.sourceId, 'Contribution already accounted for');
    seen.add(entry.sourceId);
  }
}
function range(value: unknown, path: string): AttackRange {
  const min = number(read(value, 'min', path), `${path}.min`);
  const max = number(read(value, 'max', path), `${path}.max`);
  if (min > max) reject('INVALID_RANGE', path, 'min exceeds max');
  return Object.freeze({ min, max });
}
function finiteArithmetic(value: number, path: string): number {
  if (!Number.isFinite(value) || value < 0) reject('ARITHMETIC_OVERFLOW', path, 'Resolved result must be finite and nonnegative');
  return value;
}
function damageType(value: unknown): AttackDamageType {
  if (value !== 'physical' && value !== 'magic') reject('WRONG_DAMAGE_TYPE', 'damageType', 'Physical or magic input required');
  return value;
}
export function bonusStat(effective: number): FoundationResult<number> {
  return checked(() => Math.max(0, number(effective, 'effectiveStat') - 15));
}
/** kSTR=1 and kINT=2 only here; no live stat/growth config is modified. */
export function composeAttackCore(input: CoreAttackInput): FoundationResult<ResolvedAttackCore> {
  return checked(() => {
    const type = damageType(read(input, 'damageType', 'core'));
    const identity = owner(read(input, 'owner', 'core'), 'core.owner');
    const base = read(input, 'base', 'core'), primary = read(input, 'primary', 'core');
    const primaryStat = type === 'physical' ? 'STR' : 'INT';
    if (read(primary, 'stat', 'core.primary') !== primaryStat) reject('SOURCE_SCOPE', 'core.primary', 'Wrong primary channel');
    const bonus = Math.max(0, number(read(primary, 'effective', 'core.primary'), 'core.primary.effective') - 15);
    let value = number(read(base, 'value', 'core.base'), 'core.base.value') + bonus * (type === 'physical' ? 1 : 2);
    const sources = [source(read(base, 'source', 'core.base'), identity, 'BASE', 'core.base.source'),
      source(read(primary, 'source', 'core.primary'), identity, 'PRIMARY_STAT', 'core.primary.source')];
    for (const [index, entry] of list(read(input, 'globalFlat', 'core'), 'core.globalFlat').entries()) {
      const path = `core.globalFlat[${index}]`;
      value += number(read(entry, 'value', path), `${path}.value`, false);
      sources.push(source(read(entry, 'source', path), identity, 'GLOBAL_FLAT', `${path}.source`));
    }
    uniqueSources(sources);
    const result = Object.freeze({ [coreBrand]: true as const, damageType: type, owner: identity,
      value: finiteArithmetic(value, 'core.value'), bonusPrimary: bonus, sources: Object.freeze(sources) });
    // Construction identity only; no actor enrollment or gameplay authority.
    preparedCores.add(result);
    return result;
  });
}
export type PrimaryStat = 'STR' | 'VIT' | 'DEX' | 'INT';
/** Explicit BonusStat scaling. Undeclared coefficients are zero, never class defaults. */
export function composeBonusScaling(effective: Readonly<Record<PrimaryStat, number>>,
  coefficients: Readonly<Partial<Record<PrimaryStat, number>>>): FoundationResult<number> {
  return checked(() => {
    const keys: readonly PrimaryStat[] = ['STR', 'VIT', 'DEX', 'INT'];
    if (Object.keys(object(coefficients, 'coefficients')).some(key => !keys.includes(key as PrimaryStat)))
      reject('INVALID_BUDGET', 'coefficients', 'Unsupported stat coefficient');
    let total = 0;
    for (const key of keys) {
      const coefficient = read(coefficients, key, 'coefficients');
      total += Math.max(0, number(read(effective, key, 'effective'), `effective.${key}`) - 15) *
        (coefficient === undefined && !Object.hasOwn(coefficients, key) ? 0 : number(coefficient, `coefficients.${key}`));
    }
    return finiteArithmetic(total, 'scaling');
  });
}
function instance(value: unknown, expected: AttackOwner, path: string): WeaponInstanceIdentity {
  const kind = read(value, 'kind', path);
  if (kind !== 'weapon' && kind !== 'support') reject('SOURCE_IDENTITY', path, 'Explicit weapon/support kind required');
  return Object.freeze({ instanceId: text(read(value, 'instanceId', path), `${path}.instanceId`),
    kind, owner: sameOwner(read(value, 'owner', path), expected, `${path}.owner`) });
}

/** Validation and immutable commitment snapshot happen before any RNG call.
 * Ordinary primary/equipment bonuses arrive once in core/scaling. Raw weapon
 * attack is accepted only in hand layers with distinct source provenance. */
export function prepareRawAttackExecution(input: RawAttackInput): FoundationResult<AttackExecutionSnapshot> {
  return checked(() => {
    const context = read(input, 'context', 'input');
    if (read(context, 'validation', 'context') !== 'VALIDATED_EXECUTION_CONTEXT')
      reject('INVALID_CONTEXT', 'context', 'Validated execution context is required');
    const identity = owner(read(context, 'owner', 'context'), 'context.owner');
    const executionId = text(read(context, 'executionId', 'context'), 'context.executionId');
    const mode = read(context, 'mode', 'context') as WeaponContributionMode;
    const modes: readonly WeaponContributionMode[] = ['SINGLE_MAIN', 'SINGLE_OFF', 'DUAL_COMBINED', 'DUAL_SEQUENCE',
      'THROWN_MAIN', 'THROWN_OFF', 'THROWN_SEQUENCE'];
    if (!modes.includes(mode)) reject('INVALID_MODE', 'context.mode', 'Unknown contribution mode');
    const dual = read(context, 'dualWeaponAuthorized', 'context');
    const thrown = read(context, 'thrownAuthorized', 'context');
    if (typeof dual !== 'boolean' || typeof thrown !== 'boolean') reject('INVALID_CONTEXT', 'context', 'Capabilities must be explicit');
    if (mode.startsWith('DUAL_') && !dual) reject('INVALID_CONTEXT', 'context.dualWeaponAuthorized', 'Mode cannot authorize dual weapons');
    if (mode.startsWith('THROWN_') && !thrown) reject('INVALID_CONTEXT', 'context.thrownAuthorized', 'Thrown execution is not authorized');
    const core = read(input, 'core', 'input') as ResolvedAttackCore;
    if (!core || typeof core !== 'object' || !preparedCores.has(core))
      reject('INVALID_CONTEXT', 'core', 'Core must come from composer');
    sameOwner(core.owner, identity, 'core.owner');
    const type = core.damageType;
    const modifier = read(input, 'attackModifier', 'input');
    if (read(modifier, 'scope', 'attackModifier') !== 'ATTACK_RANGE' || read(modifier, 'damageType', 'attackModifier') !== type)
      reject('SOURCE_SCOPE', 'attackModifier', 'Damage/final modifiers cannot enter an attack range');
    const multiplier = number(read(modifier, 'multiplier', 'attackModifier'), 'attackModifier.multiplier');
    const sources = [...core.sources, ...list(read(modifier, 'sources', 'attackModifier'), 'attackModifier.sources')
      .map((entry, index) => source(entry, identity, 'ATTACK_MODIFIER', `attackModifier.sources[${index}]`))];
    const budget = read(input, 'rankBudget', 'input');
    const coefficient = number(read(budget, 'coefficient', 'rankBudget'), 'rankBudget.coefficient');
    const scaling = number(read(budget, 'scaling', 'rankBudget'), 'rankBudget.scaling');
    sources.push(source(read(budget, 'source', 'rankBudget'), identity, 'SKILL_RANK', 'rankBudget.source'));
    const hitInputs = list(read(input, 'hits', 'input'), 'hits');
    if (!hitInputs.length || (mode === 'DUAL_COMBINED' && hitInputs.length !== 1))
      reject('INVALID_BUDGET', 'hits', 'Combined mode has exactly one impact; other modes require explicit hits');
    const declarations = hitInputs.map((entry, index) => {
      const path = `hits[${index}]`, hand = read(entry, 'hand', path) as AttackHand;
      const permitted: readonly AttackHand[] = mode === 'DUAL_SEQUENCE' ? ['MAIN', 'OFF', 'BOTH']
        : mode === 'THROWN_SEQUENCE' ? ['MAIN', 'OFF'] : mode === 'DUAL_COMBINED' ? ['BOTH']
          : mode === 'SINGLE_OFF' || mode === 'THROWN_OFF' ? ['OFF'] : ['MAIN'];
      if (!permitted.includes(hand)) reject('INVALID_HAND', path, 'Hit hand conflicts with mode');
      return { hand, weight: number(read(entry, 'weight', path), `${path}.weight`) };
    });
    const weightSum = declarations.reduce((sum, hit) => sum + hit.weight, 0);
    // Floating summation error allowance only, not a balance/parity tolerance.
    if (Math.abs(weightSum - 1) > Number.EPSILON * Math.max(1, declarations.length) * 4)
      reject('INVALID_BUDGET', 'hits', 'Weights must sum to one; no normalization is performed');
    const used = new Set<WeaponHand>();
    for (const hit of declarations) {
      if (hit.hand !== 'OFF') used.add('MAIN');
      if (hit.hand !== 'MAIN') used.add('OFF');
    }
    if (used.size === 2 && !dual) reject('INVALID_CONTEXT', 'context.dualWeaponAuthorized', 'Two weapon execution requires admission');
    const instanceInputs = read(context, 'instances', 'context');
    const required = new Set(used);
    // When an OFF penalty is admitted, prove both weapon identities even in SINGLE_OFF.
    if (dual) { required.add('MAIN'); required.add('OFF'); }
    const instances: Partial<Record<WeaponHand, WeaponInstanceIdentity>> = {};
    for (const hand of required) {
      const value = read(instanceInputs, hand, 'context.instances');
      if (value === undefined) reject('MISSING_LAYER', `context.instances.${hand}`, 'Required source identity is missing');
      instances[hand] = instance(value, identity, `context.instances.${hand}`);
      if ((dual || type === 'physical' || mode.startsWith('THROWN_')) && instances[hand]!.kind !== 'weapon')
        reject('SOURCE_IDENTITY', `context.instances.${hand}`, 'Support is not a dual/physical/thrown weapon');
    }
    if (instances.MAIN && instances.OFF && instances.MAIN.instanceId === instances.OFF.instanceId)
      reject('SOURCE_IDENTITY', 'context.instances', 'MAIN and OFF must be distinct item instances');
    const magicHands = list(read(context, 'magicSourceHands', 'context'), 'context.magicSourceHands');
    if (magicHands.some(hand => hand !== 'MAIN' && hand !== 'OFF') || new Set(magicHands).size !== magicHands.length)
      reject('INVALID_CONTEXT', 'context.magicSourceHands', 'Explicit distinct magic sources required');
    if (type === 'magic' && [...used].some(hand => !magicHands.includes(hand)))
      reject('SOURCE_SCOPE', 'context.magicSourceHands', 'Used magic source is not configured');
    const layerInputs = read(input, 'layers', 'input');
    const weaponRanges: Partial<Record<WeaponHand, AttackRange>> = {};
    for (const hand of used) {
      const path = `layers.${hand}`, layer = read(layerInputs, hand, 'layers');
      if (layer === undefined) reject('MISSING_LAYER', path, 'Used attack layer is missing');
      if (read(layer, 'hand', path) !== hand) reject('SOURCE_IDENTITY', path, 'Layer path/hand mismatch');
      const layerIdentity = instance(read(layer, 'identity', path), identity, `${path}.identity`);
      const admitted = instances[hand]!;
      if (layerIdentity.instanceId !== admitted.instanceId || layerIdentity.kind !== admitted.kind)
        reject('SOURCE_IDENTITY', path, 'Layer instance differs from admitted source');
      if (read(layer, 'damageType', path) !== type) reject('WRONG_DAMAGE_TYPE', path, 'No implicit physical/magic conversion');
      sources.push(source(read(layer, 'source', path), identity,
        layerIdentity.kind === 'weapon' ? 'RAW_WEAPON' : 'SUPPORT_ATTACK', `${path}.source`));
      const composition = read(layer, 'composition', path), stage = read(composition, 'stage', `${path}.composition`);
      const baseRange = range(read(composition, 'range', path), `${path}.range`);
      const penaltyApplies = hand === 'OFF' && dual;
      let factor = 1;
      if (stage === 'BASE') {
        if (Object.hasOwn(object(composition, path), 'offHandEfficiencyApplied')) reject('INVALID_EFFICIENCY', path, 'Mixed base/effective stages');
        factor = number(read(composition, 'enhancementMultiplier', path), `${path}.enhancementMultiplier`) *
          number(read(composition, 'contributionMultiplier', path), `${path}.contributionMultiplier`);
        if (penaltyApplies) factor *= number(read(composition, 'offHandEfficiency', path), `${path}.offHandEfficiency`);
        else if (Object.hasOwn(object(composition, path), 'offHandEfficiency'))
          reject('INVALID_EFFICIENCY', path, 'Off efficiency is only a dual raw OFF factor');
      } else if (stage === 'EFFECTIVE') {
        if (['enhancementMultiplier', 'contributionMultiplier', 'offHandEfficiency'].some(key => Object.hasOwn(object(composition, path), key)))
          reject('INVALID_EFFICIENCY', path, 'Effective layer must not receive factors again');
        if (read(composition, 'offHandEfficiencyApplied', path) !== penaltyApplies)
          reject('INVALID_EFFICIENCY', path, 'Effective efficiency ownership does not match context');
      } else reject('INVALID_INPUT', path, 'Explicit BASE or EFFECTIVE stage required');
      weaponRanges[hand] = Object.freeze({ min: finiteArithmetic(baseRange.min * factor, path),
        max: finiteArithmetic(baseRange.max * factor, path) });
    }
    uniqueSources(sources);
    const hits = declarations.map(hit => {
      const hands: readonly WeaponHand[] = hit.hand === 'BOTH' ? ['MAIN', 'OFF'] : [hit.hand];
      const attack = Object.freeze({
        min: finiteArithmetic((core.value + hands.reduce((sum, hand) => sum + weaponRanges[hand]!.min, 0)) * multiplier, 'attack.min'),
        max: finiteArithmetic((core.value + hands.reduce((sum, hand) => sum + weaponRanges[hand]!.max, 0)) * multiplier, 'attack.max'),
      });
      const hitCoefficient = coefficient * hit.weight, hitScaling = scaling * hit.weight;
      finiteArithmetic(attack.max * hitCoefficient + hitScaling, 'hit.raw.max');
      return Object.freeze({ ...hit, coefficient: hitCoefficient, scaling: hitScaling, attack });
    });
    finiteArithmetic(hits.reduce((sum, hit) => sum + hit.attack.max * hit.coefficient + hit.scaling, 0), 'totalRaw.max');
    const result = Object.freeze({ [snapshotBrand]: true as const, schema: 'ATTACK_RANGE_V2_CHECKPOINT_A' as const,
      executionId, owner: identity, mode, damageType: type, sources: Object.freeze(sources),
      instances: Object.freeze(instances), weaponRanges: Object.freeze(weaponRanges), hits: Object.freeze(hits),
      coefficientBudget: coefficient, scalingBudget: scaling, weightSum });
    preparedSnapshots.add(result);
    return result;
  });
}
function assertSnapshot(snapshot: AttackExecutionSnapshot) {
  if (!snapshot || !preparedSnapshots.has(snapshot))
    reject('INVALID_SNAPSHOT', 'snapshot', 'Use an immutable prepared execution snapshot');
}
function evaluate(snapshot: AttackExecutionSnapshot, u: number): Readonly<{ hits: readonly RawHit[]; totalRaw: number }> {
  const hits = snapshot.hits.map(hit => {
    const attack = hit.attack.min + (hit.attack.max - hit.attack.min) * u;
    return Object.freeze({ hand: hit.hand, weight: hit.weight, coefficient: hit.coefficient,
      scaling: hit.scaling, attack, raw: attack * hit.coefficient + hit.scaling });
  });
  return Object.freeze({ hits: Object.freeze(hits), totalRaw: hits.reduce((sum, hit) => sum + hit.raw, 0) });
}
/** No Math.random fallback. RNG exceptions propagate unchanged; invalid draws
 * return a structured failure and never yield a successful damage-zero cast. */
export function sampleRawAttackExecution(snapshot: AttackExecutionSnapshot, rng?: () => number): FoundationResult<SampledRawExecution> {
  return checked(() => {
    assertSnapshot(snapshot);
    const variable = snapshot.hits.some(hit => hit.attack.min !== hit.attack.max);
    let u: number | null = null;
    if (variable) {
      if (typeof rng !== 'function') reject('RNG_REQUIRED', 'rng', 'An authoritative sampler is required');
      u = rng();
      if (typeof u !== 'number' || !Number.isFinite(u) || u < 0 || u >= 1)
        reject('RNG_INVALID', 'rng()', 'Expected finite uniform parameter in [0,1)');
    }
    return Object.freeze({ kind: 'SAMPLED_RAW' as const, u, ...evaluate(snapshot, u ?? 0) });
  });
}
export function executeRawAttack(input: RawAttackInput, rng?: () => number): FoundationResult<SampledRawExecution> {
  const prepared = prepareRawAttackExecution(input);
  return prepared.ok ? sampleRawAttackExecution(prepared.value, rng) : prepared;
}
/** Exact expectation only for this uniform linear RAW kernel. Not final damage,
 * CP, rounded HP, conditional effects, mitigation or a DoT duration evaluator. */
export function expectedRawAttackExecution(snapshot: AttackExecutionSnapshot): FoundationResult<ExpectedRawExecution> {
  return checked(() => {
    assertSnapshot(snapshot);
    return Object.freeze({ kind: 'EXPECTED_RAW_UNIFORM_LINEAR' as const, ...evaluate(snapshot, 0.5) });
  });
}
