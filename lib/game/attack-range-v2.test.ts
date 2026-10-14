import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bonusStat, composeAttackCore, composeBonusScaling, prepareRawAttackExecution,
  sampleRawAttackExecution, executeRawAttack, expectedRawAttackExecution,
  type AttackDamageType, type AttackSource, type CoreAttackInput, type FoundationResult,
  type RawAttackInput, type WeaponRangeLayer,
} from './attack-range-v2.ts';
import type { WeaponContributionMode, WeaponHand } from './dual-wield.ts';

// MECHANICAL FIXTURE only. No canonical actor, weapon, rank or Crosscut balance data.
const owner = { actorId: 'mechanical-fixture-actor', epoch: 7 };
const source = (id: string, category: AttackSource['category']): AttackSource =>
  ({ sourceId: `mechanical-fixture:${id}`, owner: { ...owner }, category });
function value<T>(result: FoundationResult<T>): T {
  assert(result.ok, JSON.stringify(result));
  return result.value;
}
function failure<T>(result: FoundationResult<T>, code?: string) {
  assert(!result.ok, 'Expected structured failure, not successful zero damage');
  if (code) assert.equal(result.code, code);
  assert(result.path.length > 0);
  assert(result.reason.length > 0);
}
const near = (actual: number, expected: number) => assert(Math.abs(actual - expected) <= 1e-12,
  `MECHANICAL FIXTURE float tolerance 1e-12: ${actual} != ${expected}`);
function coreInput(type: AttackDamageType = 'physical'): CoreAttackInput {
  return { damageType: type, owner: { ...owner },
    base: { value: 30, source: source('base', 'BASE') },
    primary: { effective: 20, stat: type === 'physical' ? 'STR' : 'INT', source: source('primary', 'PRIMARY_STAT') },
    globalFlat: [{ value: 5, source: source('normal-equipment-flat', 'GLOBAL_FLAT') }] };
}
function fixture(mode: WeaponContributionMode = 'DUAL_SEQUENCE', type: AttackDamageType = 'physical'): RawAttackInput {
  const main = { instanceId: 'mechanical-main-instance', kind: 'weapon' as const, owner: { ...owner } };
  const off = { instanceId: 'mechanical-off-instance', kind: 'weapon' as const, owner: { ...owner } };
  const dual = mode === 'DUAL_COMBINED' || mode === 'DUAL_SEQUENCE' || mode === 'THROWN_SEQUENCE';
  const hits: RawAttackInput['hits'] = mode === 'DUAL_COMBINED' ? [{ hand: 'BOTH', weight: 1 }]
    : mode === 'DUAL_SEQUENCE' || mode === 'THROWN_SEQUENCE' ? [{ hand: 'MAIN', weight: .45 }, { hand: 'OFF', weight: .55 }]
      : [{ hand: mode === 'SINGLE_OFF' || mode === 'THROWN_OFF' ? 'OFF' : 'MAIN', weight: 1 }];
  return {
    context: { validation: 'VALIDATED_EXECUTION_CONTEXT', executionId: 'mechanical-execution',
      owner: { ...owner }, mode, dualWeaponAuthorized: dual, thrownAuthorized: mode.startsWith('THROWN_'),
      magicSourceHands: type === 'magic' ? ['MAIN', 'OFF'] : [], instances: { MAIN: main, OFF: off } },
    core: value(composeAttackCore(coreInput(type))),
    layers: {
      MAIN: { hand: 'MAIN', identity: main, damageType: type, source: source('main-raw', 'RAW_WEAPON'),
        composition: { stage: 'EFFECTIVE', range: { min: 10, max: 20 }, offHandEfficiencyApplied: false } },
      OFF: { hand: 'OFF', identity: off, damageType: type, source: source('off-raw', 'RAW_WEAPON'),
        composition: { stage: 'EFFECTIVE', range: { min: 4, max: 8 }, offHandEfficiencyApplied: dual } },
    },
    attackModifier: { scope: 'ATTACK_RANGE', damageType: type, multiplier: 1,
      sources: [source('resolved-attack-modifier', 'ATTACK_MODIFIER')] },
    rankBudget: { coefficient: 2, scaling: 6, source: source('explicit-rank', 'SKILL_RANK') }, hits,
  };
}
function withLayer(input: RawAttackInput, hand: WeaponHand, changes: Partial<WeaponRangeLayer>): RawAttackInput {
  return { ...input, layers: { ...input.layers, [hand]: { ...input.layers[hand]!, ...changes } } };
}
function withRange(input: RawAttackInput, hand: WeaponHand, min: number, max: number): RawAttackInput {
  return withLayer(input, hand, { composition: { ...input.layers[hand]!.composition, range: { min, max } } });
}
const malformed = (input: unknown) => input as RawAttackInput;

await test('A01 BonusStat excludes base15 and core aggregates resolved normal bonuses once', () => {
  assert.equal(value(bonusStat(15)), 0);
  assert.equal(value(bonusStat(12)), 0);
  assert.equal(value(bonusStat(20)), 5);
  assert.equal(value(composeAttackCore(coreInput())).value, 40);
  assert.equal(value(composeAttackCore(coreInput('magic'))).value, 45); // kINT=2.
  const input = coreInput();
  const base15 = value(composeAttackCore({ ...input, primary: { ...input.primary, effective: 15 } }));
  assert.equal(base15.value, 35); // 30+0+5, not 30+15+5.
});
await test('A02 explicit scaling uses BonusStats without generic class or rank defaults', () => {
  const effective = { STR: 20, VIT: 15, DEX: 21, INT: 15 };
  assert.equal(value(composeBonusScaling(effective, { STR: 2, DEX: 1 })), 16);
  assert.equal(value(composeBonusScaling(effective, {})), 0);
  assert.equal(value(composeBonusScaling({ STR: 15, VIT: 15, DEX: 15, INT: 15 }, { STR: 100, INT: 200 })), 0);
  failure(composeBonusScaling(effective, { STR: -1 }));
  failure(composeBonusScaling(effective, { STR: undefined }));
  failure(composeBonusScaling(effective, { CHA: 1 } as never), 'INVALID_BUDGET');
});
await test('A03 proposal example preserves coefficient/scaling budgets and exact raw ownership', () => {
  let draws = 0;
  const snapshot = value(prepareRawAttackExecution(fixture()));
  const result = value(sampleRawAttackExecution(snapshot, () => { draws++; return .5; }));
  assert.equal(draws, 1);
  assert.equal(result.u, .5);
  near(result.hits[0].raw, 52.2); near(result.hits[1].raw, 53.9); near(result.totalRaw, 106.1);
  near(result.hits.reduce((sum, hit) => sum + hit.coefficient, 0), 2);
  near(result.hits.reduce((sum, hit) => sum + hit.scaling, 0), 6);
  assert.deepEqual(result.hits.map(hit => hit.attack), [55, 46]);
});
await test('A04 invalid finite ranges reject before any RNG draw', () => {
  for (const [min, max] of [[-1, 2], [20, 10], [NaN, 10], [0, Infinity], [0, -Infinity]]) {
    let draws = 0;
    failure(executeRawAttack(withRange(fixture(), 'MAIN', min, max), () => { draws++; return .5; }));
    assert.equal(draws, 0);
  }
  const input = fixture();
  failure(executeRawAttack(withLayer(input, 'MAIN', { composition: { stage: 'EFFECTIVE', range: { min: '10', max: 20 }, offHandEfficiencyApplied: false } as never })));
});
await test('A05 malformed or missing budget is a structured rejection before sampling', () => {
  const input = fixture();
  for (const candidate of [undefined, null, {}, { ...input, core: null }, { ...input, rankBudget: undefined },
    { ...input, rankBudget: { ...input.rankBudget, coefficient: undefined } },
    { ...input, rankBudget: { ...input.rankBudget, scaling: undefined } },
    { ...input, hits: [] }]) {
    let draws = 0;
    failure(executeRawAttack(malformed(candidate), () => { draws++; return .5; }));
    assert.equal(draws, 0);
  }
});
await test('A06 snapshot is deep immutable and input/source changes cannot alter a sequence', () => {
  const input = fixture(), before = JSON.stringify(input);
  const snapshot = value(prepareRawAttackExecution(input));
  const first = value(sampleRawAttackExecution(snapshot, () => .5));
  assert.equal(JSON.stringify(input), before);
  assert(Object.isFrozen(snapshot)); assert(Object.isFrozen(snapshot.hits));
  assert(Object.isFrozen(snapshot.hits[0].attack)); assert(Object.isFrozen(snapshot.sources[0].owner));
  assert(Object.isFrozen(snapshot.instances.MAIN)); assert(Object.isFrozen(snapshot.weaponRanges.OFF));
  const layer = input.layers.MAIN!;
  Object.assign(layer.composition.range, { min: 999, max: 999 });
  Object.assign(input.rankBudget, { coefficient: 999, scaling: 999 });
  Object.assign(input.context.owner, { epoch: 999 });
  assert.deepEqual(value(sampleRawAttackExecution(snapshot, () => .5)), first);
  assert.throws(() => Object.assign(snapshot.hits[0].attack, { min: 999 }), TypeError);
});
await test('A07 provenance prevents raw weapon entering core or contribution counted twice', () => {
  const input = coreInput();
  failure(composeAttackCore({ ...input, globalFlat: [{ value: 100, source: source('main-raw', 'RAW_WEAPON') }] }), 'SOURCE_SCOPE');
  failure(composeAttackCore({ ...input, globalFlat: [...input.globalFlat, ...input.globalFlat] }), 'DUPLICATE_SOURCE');
  const execution = fixture();
  failure(prepareRawAttackExecution(withLayer(execution, 'MAIN', { source: source('normal-equipment-flat', 'RAW_WEAPON') })), 'DUPLICATE_SOURCE');
});
await test('A08 MAIN/OFF/BOTH identity correlation and dual capability are mandatory', () => {
  const input = fixture();
  failure(prepareRawAttackExecution({ ...input, context: { ...input.context, dualWeaponAuthorized: false } }), 'INVALID_CONTEXT');
  failure(prepareRawAttackExecution({ ...input, context: { ...input.context, instances: { MAIN: input.context.instances.MAIN } } }), 'MISSING_LAYER');
  failure(prepareRawAttackExecution({ ...input, context: { ...input.context, instances: { MAIN: input.context.instances.MAIN, OFF: input.context.instances.MAIN } } }), 'SOURCE_IDENTITY');
  failure(prepareRawAttackExecution(withLayer(input, 'OFF', { identity: { ...input.layers.OFF!.identity, instanceId: 'wrong-instance' } })), 'SOURCE_IDENTITY');
  failure(prepareRawAttackExecution(withLayer(input, 'MAIN', { hand: 'OFF' })), 'SOURCE_IDENTITY');
});
await test('A09 actor/epoch/source ownership mismatch cannot be inferred from matching IDs', () => {
  const input = fixture();
  for (const badOwner of [{ actorId: 'other-actor', epoch: 7 }, { actorId: owner.actorId, epoch: 8 }]) {
    failure(prepareRawAttackExecution(withLayer(input, 'MAIN', { identity: { ...input.layers.MAIN!.identity, owner: badOwner } })), 'SOURCE_IDENTITY');
    failure(prepareRawAttackExecution(withLayer(input, 'OFF', { source: { ...input.layers.OFF!.source, owner: badOwner } })), 'SOURCE_IDENTITY');
  }
  failure(prepareRawAttackExecution({ ...input, context: { ...input.context, owner: { ...owner, epoch: 8 } } }), 'SOURCE_IDENTITY');
});
await test('A10 raw OFF +100 cannot change SINGLE_MAIN damage or draw count', () => {
  const input = fixture('SINGLE_MAIN');
  let drawsA = 0, drawsB = 0;
  const first = value(executeRawAttack(input, () => { drawsA++; return .25; }));
  const second = value(executeRawAttack(withRange(input, 'OFF', 104, 108), () => { drawsB++; return .25; }));
  assert.deepEqual(second, first); assert.equal(drawsA, 1); assert.equal(drawsB, 1);
  const fixedMain = withRange(input, 'MAIN', 10, 10);
  let unusedDraws = 0;
  const fixed = value(executeRawAttack(withRange(fixedMain, 'OFF', 4, 1000), () => { unusedDraws++; return .9; }));
  assert.equal(unusedDraws, 0); assert.equal(fixed.u, null); assert.equal(fixed.totalRaw, 106);
});
await test('A11 dual OFF efficiency affects only raw weapon, never core or scaling', () => {
  const input = fixture('DUAL_SEQUENCE');
  const base = withLayer(input, 'OFF', { composition: { stage: 'BASE', range: { min: 8, max: 16 },
    enhancementMultiplier: 1, contributionMultiplier: 1, offHandEfficiency: .5 } });
  const result = value(executeRawAttack(base, () => .5));
  near(result.totalRaw, 106.1); assert.equal(result.hits[1].attack, 46);
  near(result.hits[1].scaling, 3.3); // Not halved.
  const noPenalty = withLayer(base, 'OFF', { composition: { stage: 'BASE', range: { min: 8, max: 16 },
    enhancementMultiplier: 1, contributionMultiplier: 1, offHandEfficiency: 1 } });
  near(value(executeRawAttack(noPenalty, () => .5)).hits[1].raw - result.hits[1].raw, 6.6);
});
await test('A12 SINGLE_OFF has no inferred penalty; enhancement stays in raw weapon layer', () => {
  const input = fixture('SINGLE_OFF');
  const base = withLayer(input, 'OFF', { composition: { stage: 'BASE', range: { min: 8, max: 16 },
    enhancementMultiplier: 2, contributionMultiplier: .5 } });
  const result = value(executeRawAttack(base, () => .5));
  assert.equal(result.hits[0].attack, 52); assert.equal(result.totalRaw, 110);
  failure(prepareRawAttackExecution(withLayer(input, 'OFF', { composition: { stage: 'BASE', range: { min: 8, max: 16 },
    enhancementMultiplier: 1, contributionMultiplier: 1, offHandEfficiency: .5 } })), 'INVALID_EFFICIENCY');
});
await test('A13 effective OFF cannot be penalized twice or used with a different efficiency context', () => {
  const input = fixture();
  failure(prepareRawAttackExecution(withLayer(input, 'OFF', { composition: { ...input.layers.OFF!.composition, offHandEfficiency: .5 } as never })), 'INVALID_EFFICIENCY');
  failure(prepareRawAttackExecution(withLayer(input, 'OFF', { composition: { stage: 'EFFECTIVE', range: { min: 4, max: 8 }, offHandEfficiencyApplied: false } })), 'INVALID_EFFICIENCY');
  failure(prepareRawAttackExecution(withLayer(input, 'OFF', { composition: { stage: 'BASE', range: { min: 8, max: 16 }, enhancementMultiplier: 1, contributionMultiplier: 1 } })));
});
await test('A14 BOTH combined is one impact and core is added once', () => {
  const input = fixture('DUAL_COMBINED');
  const result = value(executeRawAttack(input, () => .5));
  assert.equal(result.hits.length, 1); assert.equal(result.hits[0].hand, 'BOTH');
  assert.equal(result.hits[0].attack, 61); assert.equal(result.totalRaw, 128);
  failure(prepareRawAttackExecution({ ...input, hits: [{ hand: 'BOTH', weight: .5 }, { hand: 'BOTH', weight: .5 }] }), 'INVALID_BUDGET');
});
await test('A15 sequence supports explicit MAIN/OFF/BOTH while conserving budgets', () => {
  const input = { ...fixture(), hits: [{ hand: 'MAIN', weight: .2 }, { hand: 'OFF', weight: .3 }, { hand: 'BOTH', weight: .5 }] } as RawAttackInput;
  let draws = 0;
  const result = value(executeRawAttack(input, () => { draws++; return .25; }));
  assert.equal(draws, 1); assert.deepEqual(result.hits.map(hit => hit.attack), [52.5, 45, 57.5]);
  near(result.hits.reduce((sum, hit) => sum + hit.coefficient, 0), 2);
  near(result.hits.reduce((sum, hit) => sum + hit.scaling, 0), 6);
});
await test('A16 all thrown modes preserve identity/item inputs without extra effects', () => {
  for (const mode of ['THROWN_MAIN', 'THROWN_OFF', 'THROWN_SEQUENCE'] as const) {
    const input = fixture(mode), before = JSON.stringify(input);
    const snapshot = value(prepareRawAttackExecution(input));
    const result = value(sampleRawAttackExecution(snapshot, () => .5));
    assert.equal(JSON.stringify(input), before);
    assert.equal(result.hits.length, mode === 'THROWN_SEQUENCE' ? 2 : 1);
    assert.equal(snapshot.instances[result.hits[0].hand as WeaponHand]?.instanceId,
      input.context.instances[result.hits[0].hand as WeaponHand]?.instanceId);
    failure(prepareRawAttackExecution({ ...input, context: { ...input.context, thrownAuthorized: false } }), 'INVALID_CONTEXT');
  }
  failure(prepareRawAttackExecution({ ...fixture('THROWN_SEQUENCE'), hits: [{ hand: 'BOTH', weight: 1 }] }), 'INVALID_HAND');
});
await test('A17 mode/hand mismatches cannot gain capability from a mode string', () => {
  failure(prepareRawAttackExecution({ ...fixture('SINGLE_MAIN'), hits: [{ hand: 'OFF', weight: 1 }] }), 'INVALID_HAND');
  failure(prepareRawAttackExecution({ ...fixture('SINGLE_OFF'), hits: [{ hand: 'MAIN', weight: 1 }] }), 'INVALID_HAND');
  const input = fixture();
  failure(prepareRawAttackExecution(malformed({ ...input, context: { ...input.context, mode: 'AUTO_DUAL' } })), 'INVALID_MODE');
  failure(prepareRawAttackExecution(malformed({ ...input, context: { ...input.context, validation: undefined } })), 'INVALID_CONTEXT');
});
await test('A18 physical support is not a raw dual weapon or second physical hit', () => {
  const input = fixture();
  failure(prepareRawAttackExecution({ ...input, context: { ...input.context,
    instances: { ...input.context.instances, OFF: { ...input.context.instances.OFF!, kind: 'support' } } } }), 'SOURCE_IDENTITY');
  const singleOff = fixture('SINGLE_OFF');
  failure(prepareRawAttackExecution({ ...singleOff, context: { ...singleOff.context,
    instances: { OFF: { ...singleOff.context.instances.OFF!, kind: 'support' } } } }), 'SOURCE_IDENTITY');
});
await test('A19 magic support requires an explicit magic source and never converts PATK', () => {
  const input = fixture('SINGLE_OFF', 'magic');
  const identity = { ...input.context.instances.OFF!, kind: 'support' as const };
  const support = withLayer({ ...input, context: { ...input.context, instances: { OFF: identity }, magicSourceHands: ['OFF'] } },
    'OFF', { identity, source: source('explicit-magic-support', 'SUPPORT_ATTACK') });
  const result = value(executeRawAttack(support, () => .5));
  assert.equal(result.hits[0].attack, 51); // Magic core45 + explicit magic raw6.
  failure(prepareRawAttackExecution(withLayer(support, 'OFF', { damageType: 'physical' })), 'WRONG_DAMAGE_TYPE');
  failure(prepareRawAttackExecution({ ...support, context: { ...support.context, magicSourceHands: [] } }), 'SOURCE_SCOPE');
});
await test('A20 all used degenerate ranges skip attack RNG and retain a valid zero budget', () => {
  const input = withRange(withRange(fixture(), 'MAIN', 10, 10), 'OFF', 4, 4);
  let draws = 0;
  assert.equal(value(executeRawAttack(input, () => { draws++; throw Error('Must not draw'); })).u, null);
  assert.equal(draws, 0);
  const zero = { ...input, rankBudget: { ...input.rankBudget, coefficient: 0, scaling: 0 } };
  assert.equal(value(executeRawAttack(zero)).totalRaw, 0); // Explicit valid budget, not missing-data fallback.
});
await test('A21 authoritative RNG invalid values reject explicitly after exactly one draw', () => {
  for (const u of [NaN, Infinity, -Infinity, -.1, 1, 1.1, undefined, '0.5']) {
    let draws = 0;
    failure(executeRawAttack(fixture(), () => { draws++; return u as number; }), 'RNG_INVALID');
    assert.equal(draws, 1);
  }
  failure(executeRawAttack(fixture()), 'RNG_REQUIRED');
  const original = new Error('authoritative RNG failure');
  assert.throws(() => executeRawAttack(fixture(), () => { throw original; }), error => error === original);
});
await test('A22 sampling is continuous at full precision, with one shared parameter', () => {
  const input = fixture(), u = .123456789012345;
  let draws = 0;
  const result = value(executeRawAttack(input, () => { draws++; return u; }));
  assert.equal(draws, 1); assert.equal(result.u, u);
  near(result.hits[0].attack, 50 + 10 * u); near(result.hits[1].attack, 44 + 4 * u);
  assert.notEqual(result.hits[0].raw, Math.round(result.hits[0].raw));
  assert.equal(value(executeRawAttack(input, () => 0)).hits[0].attack, 50);
  assert(value(executeRawAttack(input, () => 1 - Number.EPSILON)).hits[0].attack <= 60);
});
await test('A23 malformed weights/coefficient/scaling are not normalized or silently replaced', () => {
  const input = fixture();
  for (const bad of [-1, NaN, Infinity]) {
    let draws = 0;
    failure(executeRawAttack({ ...input, rankBudget: { ...input.rankBudget, coefficient: bad } }, () => { draws++; return .5; }));
    failure(executeRawAttack({ ...input, rankBudget: { ...input.rankBudget, scaling: bad } }, () => { draws++; return .5; }));
    failure(executeRawAttack({ ...input, hits: [{ hand: 'MAIN', weight: bad }, { hand: 'OFF', weight: 1 }] }, () => { draws++; return .5; }));
    assert.equal(draws, 0);
  }
  failure(prepareRawAttackExecution({ ...input, hits: [{ hand: 'MAIN', weight: .4 }, { hand: 'OFF', weight: .4 }] }), 'INVALID_BUDGET');
  failure(prepareRawAttackExecution({ ...input, hits: [{ hand: 'MAIN', weight: 1 }, { hand: 'OFF', weight: 1 }] }), 'INVALID_BUDGET');
});
await test('A24 no hidden skill base roll, tier factor or second rank multiplier', () => {
  const input = fixture('SINGLE_MAIN');
  const result = value(executeRawAttack({ ...input, rankBudget: { ...input.rankBudget, coefficient: 1, scaling: 0 } }, () => .5));
  assert.equal(result.totalRaw, 55);
  const doubled = value(executeRawAttack({ ...input, rankBudget: { ...input.rankBudget, coefficient: 2, scaling: 0 } }, () => .5));
  assert.equal(doubled.totalRaw, 110);
});
await test('A25 attack modifiers cannot consume physical/magic/final damage percent', () => {
  const input = fixture('SINGLE_MAIN');
  const amplified = value(executeRawAttack({ ...input, attackModifier: { ...input.attackModifier, multiplier: 1.5 } }, () => .5));
  assert.equal(amplified.totalRaw, 171); // 55*1.5*2 + 6; scaling not attack-amplified.
  for (const scope of ['PHYSICAL_DAMAGE', 'MAGIC_DAMAGE', 'FINAL_DAMAGE'])
    failure(prepareRawAttackExecution(malformed({ ...input, attackModifier: { ...input.attackModifier, scope } })), 'SOURCE_SCOPE');
  failure(prepareRawAttackExecution({ ...input, attackModifier: { ...input.attackModifier, damageType: 'magic' } }), 'SOURCE_SCOPE');
});
await test('A26 expected RAW evaluator is deterministic, linear and has no RNG/CP claim', () => {
  const snapshot = value(prepareRawAttackExecution(fixture()));
  const first = value(expectedRawAttackExecution(snapshot));
  assert.deepEqual(value(expectedRawAttackExecution(snapshot)), first);
  assert.equal(first.kind, 'EXPECTED_RAW_UNIFORM_LINEAR');
  near(first.totalRaw, 106.1);
  const low = value(sampleRawAttackExecution(snapshot, () => .2));
  const high = value(sampleRawAttackExecution(snapshot, () => .8));
  near((low.totalRaw + high.totalRaw) / 2, first.totalRaw);
  assert.equal(Object.hasOwn(first, 'u'), false);
  assert.equal(Object.hasOwn(first, 'finalDamage'), false);
  assert.equal(Object.hasOwn(first, 'combatPower'), false);
});
await test('A27 all arithmetic overflow is rejected before RNG', () => {
  const input = fixture('SINGLE_MAIN');
  let draws = 0;
  failure(executeRawAttack({ ...input, rankBudget: { ...input.rankBudget, coefficient: Number.MAX_VALUE } }, () => { draws++; return .5; }), 'ARITHMETIC_OVERFLOW');
  failure(executeRawAttack(withLayer(input, 'MAIN', { composition: { stage: 'BASE', range: { min: 0, max: Number.MAX_VALUE },
    enhancementMultiplier: 2, contributionMultiplier: 1 } }), () => { draws++; return .5; }), 'ARITHMETIC_OVERFLOW');
  assert.equal(draws, 0);
});
await test('A28 source admission does not invoke arithmetic getters and fake snapshots reject', () => {
  let getters = 0;
  const input = fixture();
  const budget = { ...input.rankBudget };
  Object.defineProperty(budget, 'coefficient', { get() { getters++; return 2; } });
  failure(prepareRawAttackExecution({ ...input, rankBudget: budget }), 'INVALID_INPUT');
  assert.equal(getters, 0);
  failure(sampleRawAttackExecution({} as never, () => .5), 'INVALID_SNAPSHOT');
});
await test('A29 caller input may be recursively frozen without mutation by composer/sampler', () => {
  const freeze = <T extends object>(input: T): Readonly<T> => {
    for (const entry of Object.values(input)) if (entry && typeof entry === 'object' && !Object.isFrozen(entry)) freeze(entry);
    return Object.freeze(input);
  };
  const input = freeze(fixture());
  const before = JSON.stringify(input);
  near(value(executeRawAttack(input, () => .5)).totalRaw, 106.1);
  assert.equal(JSON.stringify(input), before);
});
await test('A30 unused OFF data never enters SINGLE_MAIN snapshot or expectation', () => {
  const input = fixture('SINGLE_MAIN');
  const snapshot = value(prepareRawAttackExecution(input));
  assert.equal(Object.hasOwn(snapshot.weaponRanges, 'OFF'), false);
  assert(snapshot.sources.every(entry => entry.sourceId !== input.layers.OFF!.source.sourceId));
  near(value(expectedRawAttackExecution(snapshot)).totalRaw, 116);
});

await test('A31 SINGLE_MAIN in admitted dual context still ignores variable OFF', () => {
  const input = fixture('SINGLE_MAIN');
  const dual = { ...input, context: { ...input.context, dualWeaponAuthorized: true } };
  const fixed = withRange(dual, 'MAIN', 10, 10);
  let draws = 0;
  const first = value(executeRawAttack(fixed, () => { draws++; return .9; }));
  const second = value(executeRawAttack(withRange(fixed, 'OFF', 104, 108), () => { draws++; return .9; }));
  assert.deepEqual(first, second); assert.equal(draws, 0);
  assert.equal(first.totalRaw, 106);
});
await test('A32 forged copies do not inherit composer or snapshot construction identity', () => {
  const input = fixture();
  const forgedCore = Object.freeze({ ...input.core, value: 999 });
  let draws = 0;
  failure(executeRawAttack({ ...input, core: forgedCore }, () => { draws++; return .5; }), 'INVALID_CONTEXT');
  const snapshot = value(prepareRawAttackExecution(input));
  const forged = Object.freeze({ ...snapshot, hits: [] });
  failure(sampleRawAttackExecution(forged, () => { draws++; return .5; }), 'INVALID_SNAPSHOT');
  failure(expectedRawAttackExecution(forged), 'INVALID_SNAPSHOT');
  assert.equal(draws, 0);
});
await test('A33 invalid core/stat/modifier/factor inputs do not reach sampling', () => {
  const input = coreInput();
  for (const invalid of [NaN, Infinity, -Infinity, -1]) {
    failure(bonusStat(invalid));
    failure(composeAttackCore({ ...input, primary: { ...input.primary, effective: invalid } }));
    failure(composeAttackCore({ ...input, base: { ...input.base, value: invalid } }));
    let draws = 0;
    const execution = fixture();
    failure(executeRawAttack({ ...execution, attackModifier: { ...execution.attackModifier, multiplier: invalid } }, () => { draws++; return .5; }));
    failure(executeRawAttack(withLayer(execution, 'OFF', { composition: { stage: 'BASE',
      range: { min: 4, max: 8 }, enhancementMultiplier: 1, contributionMultiplier: 1,
      offHandEfficiency: invalid } }), () => { draws++; return .5; }));
    assert.equal(draws, 0);
  }
  failure(composeAttackCore({ ...input, primary: { ...input.primary, stat: 'INT' } }), 'SOURCE_SCOPE');
});
await test('A34 damage budget and identity snapshots contain no live gameplay input', () => {
  const snapshot = value(prepareRawAttackExecution(fixture('DUAL_COMBINED')));
  assert.equal(snapshot.schema, 'ATTACK_RANGE_V2_CHECKPOINT_A');
  assert.equal(snapshot.executionId, 'mechanical-execution');
  assert.deepEqual(snapshot.owner, owner);
  assert.equal(snapshot.coefficientBudget, 2); assert.equal(snapshot.scalingBudget, 6);
  for (const field of ['accuracy', 'criticalRate', 'defense', 'hp', 'mana', 'cooldown', 'rankPowerFactor', 'baseRoll'])
    assert.equal(Object.hasOwn(snapshot, field), false);
});
