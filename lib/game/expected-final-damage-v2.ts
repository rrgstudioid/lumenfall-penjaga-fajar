import { expectedRawAttackExecution, type AttackExecutionSnapshot, type FoundationResult } from './attack-range-v2.ts';
import { criticalChance } from './combat-mechanics.ts';
import { canDamageCrit, resolveCombatDamage, resolveCombatHit, resolveCriticalDamage } from './combat-resolver.ts';

/** Isolated mathematical model, not an actor receipt, HP consumer or CP score. */
export const EXPECTED_FINAL_METHOD = Object.freeze({
  version: 'EXPECTED_FINAL_AFFINE_ROUND_V1',
  maxUnroundedDamage: 2 ** 40,
  maxTargets: 64,
  meaning: 'EXACT_ANALYTIC_MODEL_EXPECTATION_NOT_IEEE_BIT_PERFECT',
});
export type Provenance = Readonly<{ source: string; version: string; label: string }>;
export type MathematicalAttack = Readonly<{
  kind: 'MATHEMATICAL_INPUT_NOT_ACTOR_AUTHORITY'; provenance: Provenance;
  attackMin: number; attackMax: number; coefficient: number; scaling: number;
}>;
export type ExpectedFinalInput = Readonly<{
  scope: 'PHYSICAL_DIRECT_SINGLE_MAIN_FIXED_DEFENSE';
  attack: AttackExecutionSnapshot | MathematicalAttack;
  attacker: Readonly<{ provenance: Provenance; level: number; accuracy: number;
    canCrit: boolean; criticalRate: number; criticalDamage: number; physicalPenetration: number }>;
  targets: readonly Readonly<{ provenance: Provenance; variant: string; weight: number;
    physicalDefense: number; evasion: number; targetBonusPercent: number }>[];
}>;
export type ExpectedFinalValue = Readonly<{
  method: typeof EXPECTED_FINAL_METHOD.version; authority: string;
  expectedRaw: Readonly<{ kind: 'EXPECTED_RAW_UNIFORM_LINEAR'; value: number }>;
  rawRange: Readonly<{ min: number; max: number }>;
  attacker: ExpectedFinalInput['attacker'];
  targets: readonly Readonly<{ provenance: Provenance; variant: string; weight: number;
    hitChance: number; critChance: number; normalPerHit: number; critPerHit: number;
    conditionalHitMean: number; expectedInflictedDamage: number }>[];
  weightedExpectedInflictedDamage: number; assumptions: readonly string[];
}>;
class ModelFailure extends Error {
  constructor(readonly code: string, readonly path: string, reason: string) { super(reason); }
}
function fail(code: string, path: string, reason: string): never { throw new ModelFailure(code, path, reason); }
function checked<T>(fn: () => T): FoundationResult<T> {
  try { return Object.freeze({ ok: true, value: fn() }); }
  catch (e) {
    if (!(e instanceof ModelFailure)) throw e;
    return Object.freeze({ ok: false, code: e.code, path: e.path, reason: e.message });
  }
}
function data(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INPUT_MISSING', path, 'Explicit data object required');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(k => typeof k !== 'string' || !keys.includes(k)))
    fail('UNSUPPORTED_INPUT', path, 'Unknown fields/effects are not silently ignored');
  for (const key of keys) {
    if (!Object.hasOwn(descriptors, key)) fail('INPUT_MISSING', `${path}.${key}`, 'Explicit input required');
    if (!Object.hasOwn(descriptors[key], 'value')) fail('ACCESSOR_INPUT', `${path}.${key}`, 'Getter is not a mathematical input');
  }
  return Object.fromEntries(keys.map(k => [k, descriptors[k].value]));
}
function num(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    fail('INVALID_NUMBER', path, 'Finite nonnegative number required');
  return value;
}
function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) fail('INPUT_MISSING', path, 'Nonempty provenance/variant required');
  return value;
}
function provenance(value: unknown, path: string): Provenance {
  const p = data(value, ['source', 'version', 'label'], path);
  return Object.freeze({ source: text(p.source, path), version: text(p.version, path), label: text(p.label, path) });
}

/** Constant work, even for a range spanning billions of thresholds. For x>=0,
 * round(x)=floor(x+.5). First/last partial bins and interior integer bins have
 * uniform measures; interior mean is their arithmetic-series mean. No epsilon
 * is added to damage. Numerical limits are evaluator support, not game budgets. */
export function expectedRoundedUniform(min: number, max: number): FoundationResult<number> {
  return checked(() => {
    num(min, 'rounded.min'); num(max, 'rounded.max');
    if (min > max) fail('INVALID_RANGE', 'rounded', 'min exceeds max');
    if (max > EXPECTED_FINAL_METHOD.maxUnroundedDamage) fail('NUMERICAL_LIMIT', 'rounded', 'Unrounded endpoint exceeds supported half-integer precision envelope');
    if (min === max) return Math.round(min);
    const width = max - min;
    if (width < 16 * Number.EPSILON * Math.max(1, max))
      fail('NUMERICAL_LIMIT', 'rounded', 'Nondegenerate width is too small relative to magnitude');
    const first = Math.floor(min + .5), last = Math.floor(max + .5);
    if (first === last) return first;
    const firstMass = (first + .5 - min) / width;
    const lastMass = (max - (last - .5)) / width;
    const interiorMass = (last - first - 1) / width;
    const mean = first * firstMass + last * lastMass + (first + last) / 2 * interiorMass;
    if (!Number.isFinite(mean) || mean < 0) fail('ARITHMETIC_OVERFLOW', 'rounded', 'Invalid integrated mean');
    return mean;
  });
}

export function evaluateExpectedFinal(input: ExpectedFinalInput): FoundationResult<ExpectedFinalValue> {
  return checked(() => {
    const root = data(input, ['scope', 'attack', 'attacker', 'targets'], 'input');
    if (root.scope !== 'PHYSICAL_DIRECT_SINGLE_MAIN_FIXED_DEFENSE')
      fail('UNSUPPORTED_SCOPE', 'scope', 'No magic/DoT/multi-hit/Block/barrier/conditional fallback');
    let min: number, max: number, expectedRaw: number, authority: string;
    const attack = root.attack as AttackExecutionSnapshot | MathematicalAttack;
    // Genuine construction identity is checked by the existing foundation API.
    const foundation = expectedRawAttackExecution(attack as AttackExecutionSnapshot);
    if (foundation.ok) {
      const snapshot = attack as AttackExecutionSnapshot;
      if (snapshot.damageType !== 'physical' || snapshot.mode !== 'SINGLE_MAIN' || snapshot.hits.length !== 1 || snapshot.hits[0].hand !== 'MAIN')
        fail('UNSUPPORTED_SCOPE', 'attack', 'Only physical single MAIN impact is supported');
      const hit = snapshot.hits[0];
      min = hit.attack.min * hit.coefficient + hit.scaling;
      max = hit.attack.max * hit.coefficient + hit.scaling;
      expectedRaw = foundation.value.totalRaw;
      authority = 'FOUNDATION_PREPARED_SNAPSHOT_NOT_RUNTIME_ENROLLMENT';
    } else {
      const a = data(attack, ['kind', 'provenance', 'attackMin', 'attackMax', 'coefficient', 'scaling'], 'attack');
      if (a.kind !== 'MATHEMATICAL_INPUT_NOT_ACTOR_AUTHORITY') fail('INVALID_SNAPSHOT', 'attack', 'Use genuine snapshot or explicit mathematical DTO');
      const p = provenance(a.provenance, 'attack.provenance');
      const lo = num(a.attackMin, 'attack.min'), hi = num(a.attackMax, 'attack.max');
      if (lo > hi) fail('INVALID_RANGE', 'attack', 'min exceeds max');
      const c = num(a.coefficient, 'attack.coefficient'), s = num(a.scaling, 'attack.scaling');
      min = lo * c + s; max = hi * c + s;
      expectedRaw = min + (max - min) / 2;
      authority = `${a.kind}:${p.source}:${p.version}:${p.label}`;
    }
    num(min, 'raw.min'); num(max, 'raw.max'); num(expectedRaw, 'raw.mean');
    if (max > EXPECTED_FINAL_METHOD.maxUnroundedDamage) fail('NUMERICAL_LIMIT', 'raw', 'Supported magnitude exceeded');
    const a = data(root.attacker, ['provenance', 'level', 'accuracy', 'canCrit', 'criticalRate', 'criticalDamage', 'physicalPenetration'], 'attacker');
    const level = num(a.level, 'attacker.level');
    if (!Number.isSafeInteger(level) || level < 1 || level > 100) fail('UNSUPPORTED_SCOPE', 'attacker.level', 'Technical level range1-100 required');
    if (typeof a.canCrit !== 'boolean') fail('INPUT_MISSING', 'attacker.canCrit', 'Explicit Crit permission required');
    const attacker = Object.freeze({ provenance: provenance(a.provenance, 'attacker.provenance'), level,
      accuracy: num(a.accuracy, 'attacker.accuracy'), canCrit: a.canCrit,
      criticalRate: num(a.criticalRate, 'attacker.criticalRate'), criticalDamage: num(a.criticalDamage, 'attacker.criticalDamage'),
      physicalPenetration: num(a.physicalPenetration, 'attacker.physicalPenetration') });
    const policy = { damageType: 'physical' as const, damageKind: 'direct' as const, ...attacker };
    const critChance = canDamageCrit(policy) ? Math.max(0, criticalChance(attacker.criticalRate)) : 0;
    if (!Array.isArray(root.targets) || !root.targets.length) fail('INPUT_MISSING', 'targets', 'Explicit target bank required');
    if (root.targets.length > EXPECTED_FINAL_METHOD.maxTargets) fail('SUPPORTED_LIMIT', 'targets', 'Too many target variants');
    const targets = root.targets.map((entry: unknown, i: number) => {
      const path = `targets[${i}]`, t = data(entry, ['provenance', 'variant', 'weight', 'physicalDefense', 'evasion', 'targetBonusPercent'], path);
      const defense = num(t.physicalDefense, `${path}.defense`), evasion = num(t.evasion, `${path}.evasion`);
      const bonus = num(t.targetBonusPercent, `${path}.targetBonusPercent`);
      const unitMitigation = resolveCombatDamage({ rawDamage: 1, damageType: 'physical', attackerLevel: level,
        physicalDefense: defense, magicDefense: 0, physicalPenetration: attacker.physicalPenetration,
        targetBonusPercent: 0, defenseMultiplier: 1 });
      if (!Number.isFinite(unitMitigation) || unitMitigation <= 0)
        fail('NUMERICAL_LIMIT', path, 'Mitigation factor lost positive precision; not successful synthetic zero');
      const hitChance = resolveCombatHit(policy, evasion, () => 0).hitChance;
      const branch = (crit: boolean) => {
        // Conditional Crit branch only: positive shared chance + arithmetic probe0
        // reaches the shared Crit multiplier even when actual probability is0.
        // Actual Critical Rate remains unchanged in the probability weighting.
        const mitigated = (raw: number) => resolveCombatDamage({ rawDamage: crit ? resolveCriticalDamage(raw, { ...policy, criticalRate: 100 }, () => 0) : raw,
          damageType: 'physical', attackerLevel: level, physicalDefense: defense, magicDefense: 0,
          physicalPenetration: attacker.physicalPenetration, targetBonusPercent: bonus, defenseMultiplier: 1 });
        const result = expectedRoundedUniform(mitigated(min), mitigated(max));
        if (!result.ok) fail(result.code, path, result.reason);
        return result.value;
      };
      const normalPerHit = branch(false), critPerHit = branch(true);
      const conditionalHitMean = (1 - critChance) * normalPerHit + critChance * critPerHit;
      return Object.freeze({ provenance: provenance(t.provenance, `${path}.provenance`), variant: text(t.variant, `${path}.variant`),
        weight: num(t.weight, `${path}.weight`), hitChance, critChance, normalPerHit, critPerHit, conditionalHitMean,
        expectedInflictedDamage: hitChance * conditionalHitMean });
    });
    const weightSum = targets.reduce((sum, t) => sum + t.weight, 0);
    if (!Number.isFinite(weightSum) || Math.abs(weightSum - 1) > Number.EPSILON * targets.length * 4)
      fail('INVALID_WEIGHTS', 'targets.weight', 'Weights must sum1; no normalization');
    const weighted = targets.reduce((sum, t) => sum + t.weight * t.expectedInflictedDamage, 0);
    num(weighted, 'weighted');
    return Object.freeze({ method: EXPECTED_FINAL_METHOD.version, authority,
      expectedRaw: Object.freeze({ kind: 'EXPECTED_RAW_UNIFORM_LINEAR' as const, value: expectedRaw }),
      rawRange: Object.freeze({ min, max }), attacker, targets: Object.freeze(targets), weightedExpectedInflictedDamage: weighted,
      assumptions: Object.freeze(['Continuous uniform attack parameter; independent ModelB hit and permitted physical Crit',
        'Fixed explicit defense/penetration/variant bonus; final round once',
        'Inflicted damage not HP-clamped loss, kill rate, sustain or CP score',
        'Ordinary mathematical data only; provenance labels are not runtime identity receipts']) });
  });
}
