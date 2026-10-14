import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExpectedFinal, expectedRoundedUniform, type ExpectedFinalInput, type MathematicalAttack } from './expected-final-damage-v2.ts';
import { composeAttackCore, prepareRawAttackExecution, type FoundationResult } from './attack-range-v2.ts';

const p = { source: 'MECHANICAL FIXTURE', version: 'TEST_V1', label: 'Not canonical enemy/CP balance' };
const value = <T>(r: FoundationResult<T>): T => { assert(r.ok, JSON.stringify(r)); return r.value; };
const bad = (r: FoundationResult<unknown>, code?: string) => { assert(!r.ok); if (code) assert.equal(r.code, code); };
// Absolute/relative numerical allowance, not balance tolerance or CP acceptance policy.
const near = (a: number, b: number) => assert(Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function fixture(min = .2, max = .6): ExpectedFinalInput {
  return { scope: 'PHYSICAL_DIRECT_SINGLE_MAIN_FIXED_DEFENSE',
    attack: { kind: 'MATHEMATICAL_INPUT_NOT_ACTOR_AUTHORITY', provenance: p, attackMin: min, attackMax: max, coefficient: 1, scaling: 0 },
    attacker: { provenance: p, level: 1, accuracy: 90, canCrit: false, criticalRate: 0, criticalDamage: 150, physicalPenetration: 0 },
    targets: [{ provenance: p, variant: 'mechanical-neutral', weight: 1, physicalDefense: 0, evasion: 0, targetBonusPercent: 0 }] };
}
await test('threshold measure: E(round uniform .2-.6)=.25, not round(Eraw)=0', () => {
  const r = value(evaluateExpectedFinal(fixture())); near(r.expectedRaw.value, .4); near(r.weightedExpectedInflictedDamage, .25);
  assert.notEqual(r.weightedExpectedInflictedDamage, Math.round(r.expectedRaw.value));
});
await test('partial bins plus full bins independent analytic oracle', () => {
  // [.2,.5):0, [.5,1.5):1, [1.5,2.5):2, [2.5,2.7):3.
  near(value(expectedRoundedUniform(.2, 2.7)), (1 + 2 + .2 * 3) / 2.5);
});
await test('threshold endpoints measure zero; degenerate ties use actual Math.round', () => {
  assert.equal(value(expectedRoundedUniform(.49, .5)), 0);
  assert.equal(value(expectedRoundedUniform(.5, .5)), 1);
  assert.equal(value(expectedRoundedUniform(0, .5)), 0);
  assert.equal(value(expectedRoundedUniform(1.5, 1.5)), 2);
});
await test('huge supported range uses constant-work analytic arithmetic', () => {
  near(value(expectedRoundedUniform(0, 1e9)), 5e8);
  near(value(expectedRoundedUniform(1e9 + .1, 1e9 + .9)), 1e9 + .5);
});
await test('numerical envelope and sub-resolution widths reject visibly', () => {
  bad(expectedRoundedUniform(0, 2 ** 41), 'NUMERICAL_LIMIT');
  bad(expectedRoundedUniform(1e9, 1e9 + Number.EPSILON * 1e9), 'NUMERICAL_LIMIT');
  bad(expectedRoundedUniform(2, 1), 'INVALID_RANGE');
});
await test('Crit branches weighted separately:1.4->1 or2;50% gives1.5 not round average2', () => {
  const f = fixture(1.4, 1.4); const r = value(evaluateExpectedFinal({ ...f, attacker: { ...f.attacker, canCrit: true, criticalRate: 50 } }));
  assert.equal(r.targets[0].normalPerHit, 1); assert.equal(r.targets[0].critPerHit, 2);
  assert.equal(r.weightedExpectedInflictedDamage, 1.5);
});
await test('shared physical Crit cap and explicit non-Crit policy', () => {
  const f = fixture(1.4, 1.4);
  const yes = value(evaluateExpectedFinal({ ...f, attacker: { ...f.attacker, canCrit: true, criticalRate: 100 } }));
  near(yes.weightedExpectedInflictedDamage, 1.8); assert.equal(yes.targets[0].critChance, .8);
  const no = value(evaluateExpectedFinal({ ...f, attacker: { ...f.attacker, criticalRate: 100 } }));
  assert.equal(no.weightedExpectedInflictedDamage, 1); assert.equal(no.targets[0].critChance, 0);
});
await test('zero actual Crit probability still has explicit conditional branch; no mean Crit multiplier', () => {
  const f = fixture(10, 10);
  const r = value(evaluateExpectedFinal({ ...f, attacker: { ...f.attacker, canCrit: true } }));
  assert.equal(r.targets[0].critChance, 0); assert.equal(r.targets[0].critPerHit, 15);
  assert.equal(r.weightedExpectedInflictedDamage, 10);
});
await test('ModelB Accuracy pressure, Evasion cap and guaranteed hit endpoint', () => {
  const f = fixture(10, 10);
  const run = (accuracy: number, evasion: number) => value(evaluateExpectedFinal({ ...f,
    attacker: { ...f.attacker, accuracy }, targets: [{ ...f.targets[0], evasion }] })).targets[0];
  near(run(90, 20).hitChance, .8); near(run(100, 20).hitChance, .81);
  assert.equal(run(0, 999).hitChance, .5); assert.equal(run(290, 20).hitChance, 1);
});
await test('final mitigation before rounding differs from old raw-round alternative', () => {
  const f = fixture(.6, 1.4); const r = value(evaluateExpectedFinal({ ...f, targets: [{ ...f.targets[0], physicalDefense: 510 }] }));
  near(r.weightedExpectedInflictedDamage, .5); // uniform [.3,.7], half >=.5
  assert.equal(Math.round(Math.round(1) / 2), 1);
});
await test('attacker level and penetration use actual shared mitigation curve', () => {
  const f = fixture(10, 10);
  const r = value(evaluateExpectedFinal({ ...f, attacker: { ...f.attacker, level: 2, physicalPenetration: 50 },
    targets: [{ ...f.targets[0], physicalDefense: 1040 }] }));
  assert.equal(r.weightedExpectedInflictedDamage, 5); // effectiveDEF520, denominator1040
});
await test('explicit variant bonus applied once and bank weighted without normalization', () => {
  const f = fixture(10, 10);
  const r = value(evaluateExpectedFinal({ ...f, targets: [ { ...f.targets[0], weight: .25 },
    { ...f.targets[0], variant: 'mechanical-bonus', targetBonusPercent: 100, evasion: 50, weight: .75 } ] }));
  assert.equal(r.weightedExpectedInflictedDamage, 10);
  bad(evaluateExpectedFinal({ ...f, targets: [{ ...f.targets[0], weight: .9 }] }), 'INVALID_WEIGHTS');
});
await test('zero coefficient and zero budget remain valid explicit mathematical zero', () => {
  const f = fixture(10, 20), attack = f.attack as MathematicalAttack;
  const r = value(evaluateExpectedFinal({ ...f, attack: { ...attack, coefficient: 0, scaling: 0 } }));
  assert.equal(r.expectedRaw.value, 0); assert.equal(r.weightedExpectedInflictedDamage, 0);
});
await test('genuine foundation prepared snapshot accepted, forged clone rejected', () => {
  const owner = { actorId: 'MECHANICAL', epoch: 0 }, identity = { owner, kind: 'weapon' as const, instanceId: 'mechanical' };
  const source = (category: 'BASE' | 'PRIMARY_STAT' | 'RAW_WEAPON' | 'SKILL_RANK') => ({ owner, sourceId: category, category });
  const core = value(composeAttackCore({ damageType: 'physical', owner, base: { value: 8, source: source('BASE') },
    primary: { effective: 15, stat: 'STR', source: source('PRIMARY_STAT') }, globalFlat: [] }));
  const snapshot = value(prepareRawAttackExecution({ context: { validation: 'VALIDATED_EXECUTION_CONTEXT', executionId: 'math', owner,
    mode: 'SINGLE_MAIN', dualWeaponAuthorized: false, thrownAuthorized: false, magicSourceHands: [], instances: { MAIN: identity } },
    core, layers: { MAIN: { hand: 'MAIN', identity, damageType: 'physical', source: source('RAW_WEAPON'),
      composition: { stage: 'BASE', range: { min: 9, max: 11 }, enhancementMultiplier: 1, contributionMultiplier: 1 } } },
    attackModifier: { scope: 'ATTACK_RANGE', damageType: 'physical', multiplier: 1, sources: [] },
    rankBudget: { coefficient: 1.05, scaling: 0, source: source('SKILL_RANK') }, hits: [{ hand: 'MAIN', weight: 1 }] }));
  const r = value(evaluateExpectedFinal({ ...fixture(), attack: snapshot }));
  near(r.expectedRaw.value, 18.9); assert.equal(r.authority, 'FOUNDATION_PREPARED_SNAPSHOT_NOT_RUNTIME_ENROLLMENT');
  bad(evaluateExpectedFinal({ ...fixture(), attack: { ...snapshot } }));
});
await test('unsupported scope and conditional/Block/barrier fields never fall back', () => {
  const f = fixture();
  for (const scope of ['magic', 'dot', 'AOE', 'MULTI_HIT', 'Block']) bad(evaluateExpectedFinal({ ...f, scope } as unknown as ExpectedFinalInput), 'UNSUPPORTED_SCOPE');
  for (const key of ['barrier', 'blockChance', 'armorBreak', 'hpConditional'])
    bad(evaluateExpectedFinal({ ...f, targets: [{ ...f.targets[0], [key]: 0 }] } as ExpectedFinalInput), 'UNSUPPORTED_INPUT');
});
await test('malformed/missing/provenance/NaN/Infinity/negative/overflow rejected', () => {
  for (const v of [NaN, Infinity, -1, undefined, null]) {
    const f = fixture(); bad(evaluateExpectedFinal({ ...f, attacker: { ...f.attacker, accuracy: v } } as unknown as ExpectedFinalInput));
  }
  bad(evaluateExpectedFinal({ ...fixture(), targets: [] }), 'INPUT_MISSING');
  bad(evaluateExpectedFinal({ ...fixture(), targets: Array.from({ length: 65 }, () => fixture().targets[0]) }), 'SUPPORTED_LIMIT');
  const f = fixture(); bad(evaluateExpectedFinal({ ...f, attack: { ...f.attack, attackMax: Number.MAX_VALUE, coefficient: 2 } } as ExpectedFinalInput));
  bad(evaluateExpectedFinal({ ...f, attacker: { ...f.attacker, provenance: { ...p, source: '' } } }), 'INPUT_MISSING');
  bad(evaluateExpectedFinal({ ...f, targets: [{ ...f.targets[0], physicalDefense: Number.MAX_VALUE }] }), 'NUMERICAL_LIMIT');
});
await test('deterministic immutable copies, no input mutation, getter or runtime RNG', () => {
  const f = fixture(), before = JSON.stringify(f), original = Math.random;
  let calls = 0; Math.random = () => { calls++; throw Error('Forbidden runtime RNG'); };
  try {
    const first = value(evaluateExpectedFinal(f)), second = value(evaluateExpectedFinal(f)); assert.deepEqual(first, second);
    assert.equal(JSON.stringify(f), before); assert.equal(calls, 0); assert(Object.isFrozen(first.targets[0].provenance));
    assert.throws(() => { (first.targets[0] as { weight: number }).weight = .3; }, TypeError);
    const attacker = { ...f.attacker }; Object.defineProperty(attacker, 'accuracy', { get() { calls++; return 90; } });
    bad(evaluateExpectedFinal({ ...f, attacker }), 'ACCESSOR_INPUT'); assert.equal(calls, 0);
  } finally { Math.random = original; }
});
