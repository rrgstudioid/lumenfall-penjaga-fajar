import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdventurerDiagnosticProfile, healCapacity, evaluateDiagnosticSchedule,
  type AdventurerDiagnosticInput, type ExplicitSchedule } from './adventurer-cp-foundation-v2.ts';
import { expectedRawAttackExecution, type FoundationResult } from './attack-range-v2.ts';
import { evaluateExpectedFinal } from './expected-final-damage-v2.ts';
const p = { source: 'MECHANICAL FIXTURE', version: 'TEST_V1', label: 'Not actual actor authorization' };
const value = <T>(r: FoundationResult<T>): T => { assert(r.ok, JSON.stringify(r)); return r.value; };
const bad = (r: FoundationResult<unknown>, code?: string) => { assert(!r.ok); if (code) assert.equal(r.code, code); };
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-10, `${a} != ${b}`); // numerical, not CP/balance tolerance
function cohort(level = 14, quick = 5, power = 5, heal = 3, STR = 0, VIT = 0, DEX = 0, INT = 0): AdventurerDiagnosticInput {
  const spent = quick - 1 + power + heal;
  return { kind: 'MATHEMATICAL_COHORT_NOT_RUNTIME_AUTHORITY', provenance: p, job: 'adventurer', level,
    allocation: { STR, VIT, DEX, INT }, unspentPoints: 2 * (level - 1) - STR - VIT - DEX - INT,
    ranks: { quick, power, heal }, ledger: { earned: level - 1, spent, available: level - 1 - spent, quickGranted: 1, powerGranted: 0, healGranted: 0 },
    weapon: { templateId: 'field-verdant-plains-sword', instanceLabel: 'mechanical-label-not-receipt', hand: 'MAIN', enhancement: 0, otherSources: 'NONE' }, maxHP: 1000 };
}
// Independent literals are an oracle for already ACC values, not a second production table.
const cases = [
  ['quick',1,1,1.05,.02,3,3.2],['quick',2,3,1.08,.03,3,3.1],['quick',3,6,1.12,.04,4,3],['quick',4,9,1.16,.05,4,2.9],['quick',5,13,1.2,.06,5,2.8],
  ['power',1,2,1.2,.04,5,6],['power',2,7,1.26,.05,5,5.75],['power',3,10,1.32,.06,6,5.5],['power',4,12,1.38,.07,6,5.25],['power',5,14,1.45,.08,7,5],
] as const;
for (const [skill, rank, level, c, str, mana, cd] of cases) await test(`${skill} R${rank}: neutral/STR/mixed profile uses shared metadata and genuine foundation`, () => {
  for (const allocation of [0, Math.min(3, 2 * (level - 1))]) {
    const mixedVIT = allocation > 0 && level > 3 ? 1 : 0;
    const input = cohort(level, skill === 'quick' ? rank : 1, skill === 'power' ? rank : 0, 0, allocation, mixedVIT);
    const profile = value(buildAdventurerDiagnosticProfile(input));
    const action = profile.actions.find(a => a.id.endsWith(skill === 'quick' ? 'quick-slash' : 'power-strike'))!;
    near(action.expectedRaw!, (7 + Math.floor(level * 1.1) + allocation + 10) * c + allocation * str);
    near(action.expectedRaw!, value(expectedRawAttackExecution(action.snapshot!)).totalRaw);
    assert.equal(action.mana, mana); assert.equal(action.cooldown, cd);
    const final = value(evaluateExpectedFinal({ scope: 'PHYSICAL_DIRECT_SINGLE_MAIN_FIXED_DEFENSE', attack: action.snapshot!,
      attacker: { provenance: p, level, accuracy: 90, canCrit: true, criticalRate: 0, criticalDamage: 150, physicalPenetration: 0 },
      targets: [{ provenance: p, variant: 'mechanical', physicalDefense: 0, evasion: 0, targetBonusPercent: 0, weight: 1 }] }));
    near(final.expectedRaw.value, action.expectedRaw!);
  }
});
for (const [rank, level, percent, mana, cd] of [[1,2,6,8,30],[2,8,8,10,28],[3,14,10,12,26]]) await test(`Heal R${rank}: capacity, clamp, no attack channel`, () => {
  const input = cohort(level, 1, 0, rank), profile = value(buildAdventurerDiagnosticProfile(input));
  const h = profile.actions.find(a => a.channel === 'heal')!;
  assert.equal(h.healCapacity, Math.round(input.maxHP * percent / 100)); assert.equal(h.snapshot, null);
  assert.equal(h.mana, mana); assert.equal(h.cooldown, cd);
  assert.equal(value(healCapacity(431, percent, 5)).clamped, 5);
  assert.equal(value(healCapacity(431, percent)).clamped, null);
});
await test('Basic independent event budgets1/1/1 and Lv1/14 STR range once', () => {
  for (const input of [cohort(1,1,0,0), cohort(), cohort(14,5,5,3,23,1,1,1)]) {
    const profile = value(buildAdventurerDiagnosticProfile(input)); const basics = profile.actions.filter(a => a.id === 'basic');
    assert.equal(basics.length, 3); assert.deepEqual(basics.map(a => a.event), [1,2,3]);
    for (const a of basics) { assert.equal(a.snapshot!.coefficientBudget, 1); assert.equal(a.snapshot!.scalingBudget, 0);
      assert.equal(a.expectedRaw, 7 + Math.floor(input.level * 1.1) + input.allocation.STR + 10); }
    assert.equal(basics[0].mana, null); assert.equal(basics[0].cooldown, null); // no invented timing
  }
});
await test('DEX/VIT/INT do not add physical raw; MaxHP supplied explicitly for Heal', () => {
  const neutral = value(buildAdventurerDiagnosticProfile(cohort()));
  for (const input of [cohort(14,5,5,3,0,26),cohort(14,5,5,3,0,0,26),cohort(14,5,5,3,0,0,0,26)]) {
    assert.deepEqual(value(buildAdventurerDiagnosticProfile(input)).actions.map(a => a.expectedRaw), neutral.actions.map(a => a.expectedRaw));
  }
  assert.equal(value(buildAdventurerDiagnosticProfile({ ...cohort(), maxHP: 2000 })).actions.find(a => a.channel === 'heal')!.healCapacity, 200);
});
await test('invalid ledger/grants/gates/primary/unsupported sources are not admitted', () => {
  const f = cohort();
  for (const change of [{ earned: 99 },{ spent: 0 },{ available: 99 },{ powerGranted: 1 },{ quickGranted: 0 }])
    bad(buildAdventurerDiagnosticProfile({ ...f, ledger: { ...f.ledger, ...change } }));
  bad(buildAdventurerDiagnosticProfile(cohort(12,5,0,0)), 'INVALID_RANK_GATE');
  bad(buildAdventurerDiagnosticProfile({ ...f, unspentPoints: 25 }), 'INVALID_PRIMARY_BUDGET');
  bad(buildAdventurerDiagnosticProfile({ ...f, allocation: { ...f.allocation, STR: -1 } }));
  bad(buildAdventurerDiagnosticProfile({ ...f, weapon: { ...f.weapon, enhancement: 1 } }), 'UNSUPPORTED_SOURCE');
  bad(buildAdventurerDiagnosticProfile({ ...f, buff: 0 } as AdventurerDiagnosticInput), 'UNSUPPORTED_SOURCE');
  bad(buildAdventurerDiagnosticProfile({ ...f, level: 15 }), 'UNSUPPORTED_SCOPE');
});
await test('profile pure, deterministic, immutable; no RNG/save/global lifecycle operations', () => {
  const f = cohort(), before = JSON.stringify(f), random = Math.random; let calls = 0;
  Math.random = () => { calls++; throw Error('Forbidden RNG'); };
  try {
    const a = value(buildAdventurerDiagnosticProfile(f)), b = value(buildAdventurerDiagnosticProfile(f));
    assert.deepEqual(a,b); assert.equal(JSON.stringify(f),before); assert.equal(calls,0);
    assert(Object.isFrozen(a.actions[0].snapshot!.hits[0].attack));
    assert.throws(() => { (a.effective as { STR: number }).STR = 999; }, TypeError);
    Object.defineProperty(f.allocation, 'STR', { get() { calls++; return 0; } });
    bad(buildAdventurerDiagnosticProfile(f),'ACCESSOR_INPUT'); assert.equal(calls,0);
  } finally { Math.random = random; }
});
function schedule(): ExplicitSchedule {
  return { provenance: p, model: 'CONTINUOUS_CAPPED_MANA_EXCLUSIVE_OCCUPANCY_START_CD', horizon: 10,
    initialMana: 10, maxMana: 10, recoveryPerSecond: 1,
    actions: [{ id: 'mechanical', provenance: p, mana: 4, cooldown: 3, occupancy: 1, initialReadyAt: 0 }],
    casts: [{ id: 'mechanical', at: 0 }, { id: 'mechanical', at: 3 }, { id: 'mechanical', at: 6 }] };
}
await test('explicit schedule conserves shared time/Mana and CD, no optimizer/free basic fill', () => {
  const f = schedule(), before = JSON.stringify(f), r = value(evaluateDiagnosticSchedule(f));
  assert.equal(r.paidMana,12); assert.equal(r.effectiveRecoveredMana,10); assert.equal(r.finalMana,8);
  assert.equal(r.occupiedTime,3); assert.equal(r.unusedTime,7); assert.equal(r.score,null);
  assert.equal(JSON.stringify(f),before); assert.deepEqual(r,value(evaluateDiagnosticSchedule(f)));
});
await test('schedule overlap/order/CD/Mana/horizon cannot silently inflate capacity', () => {
  const f = schedule();
  bad(evaluateDiagnosticSchedule({ ...f, casts: [{ id: 'mechanical', at: 0 }, { id: 'mechanical', at: .5 }] }), 'TIME_CONSERVATION');
  bad(evaluateDiagnosticSchedule({ ...f, casts: [{ id: 'mechanical', at: 0 }, { id: 'mechanical', at: 2 }] }), 'COOLDOWN_CONSTRAINT');
  bad(evaluateDiagnosticSchedule({ ...f, initialMana: 3 }), 'MANA_CONSERVATION');
  bad(evaluateDiagnosticSchedule({ ...f, casts: [{ id: 'mechanical', at: 10 }] }), 'TIME_CONSERVATION');
  bad(evaluateDiagnosticSchedule({ ...f, actions: [{ ...f.actions[0], initialReadyAt: 1 }] }), 'COOLDOWN_CONSTRAINT');
});
await test('incomplete semantics, unsupported model and numeric overflow fail visibly', () => {
  const f = schedule(); const incomplete: { -readonly [K in keyof ExplicitSchedule]?: ExplicitSchedule[K] } = { ...f }; delete incomplete.model;
  bad(evaluateDiagnosticSchedule(incomplete as ExplicitSchedule), 'INPUT_MISSING');
  bad(evaluateDiagnosticSchedule({ ...f, model: 'greedy' } as unknown as ExplicitSchedule), 'UNSUPPORTED_SCHEDULE');
  bad(evaluateDiagnosticSchedule({ ...f, recoveryPerSecond: Number.MAX_VALUE }), 'ARITHMETIC_OVERFLOW');
  bad(evaluateDiagnosticSchedule({ ...f, casts: Array.from({length:4097},()=>f.casts[0]) }), 'SUPPORTED_LIMIT');
  bad(healCapacity(Infinity,6)); bad(healCapacity(Number.MAX_VALUE,6),'NUMERICAL_LIMIT'); bad(healCapacity(100,6,101));
});
await test('schedule cannot turn unrepresentable positive CD or cost into free capacity', () => {
  const f = schedule();
  bad(evaluateDiagnosticSchedule({ ...f, horizon: 1e20, recoveryPerSecond: 0,
    actions: [{ ...f.actions[0], occupancy: 0, cooldown: 1 }], casts: [{ id: 'mechanical', at: 1e20 }] }), 'NUMERICAL_LIMIT');
  bad(evaluateDiagnosticSchedule({ ...f, initialMana: 1e20, maxMana: 1e20 }), 'NUMERICAL_LIMIT');
});
