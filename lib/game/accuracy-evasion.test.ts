import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveHitAgainstEvasion } from './combat-mechanics.ts';
import { runAccuracyEvasionFixture } from './accuracy-evasion-fixture.ts';

test('Model B resolves Accuracy against Evasion with one roll', () => {
  const cases = [
    [105, 1.5, 1.5, 0, 1],
    [105, 5.5, 1.5, 4, .96],
    [145, 5.5, 5.5, 0, 1],
    [90, 50, 0, 50, .5],
    [80, 10, -1, 11, .89],
  ] as const;
  for (const [accuracy, evasion, pressure, effective, chance] of cases) {
    const result = resolveHitAgainstEvasion({ attackerAccuracy: accuracy, targetEvasion: evasion, rng: () => 0 });
    assert.equal(result.accuracyPressure, pressure);
    assert.equal(result.effectiveEvasion, effective);
    assert.equal(result.hitChance, chance);
    assert.equal(result.result, 'HIT');
  }
});

test('Model B clamps effective Evasion without adding an Accuracy cap', () => {
  assert.equal(resolveHitAgainstEvasion({ attackerAccuracy: 1000, targetEvasion: 50, rng: () => .999 }).effectiveEvasion, 0);
  assert.equal(resolveHitAgainstEvasion({ attackerAccuracy: 0, targetEvasion: 0, rng: () => .89 }).effectiveEvasion, 9);
  assert.equal(resolveHitAgainstEvasion({ attackerAccuracy: 90, targetEvasion: 999, rng: () => .499 }).effectiveEvasion, 50);
});

test('clean Accuracy/Evasion fixture uses actual V3 skill, impact, status, Stun and Flow/Tempo paths', () => {
  const result = runAccuracyEvasionFixture();
  assert.equal(result.status, 'PASS');
  assert.equal(result.worldImported, false);
  assert.equal(result.mapLoaded, false);

  assert.equal(result.basic.targetEvasion0.result, 'HIT');
  assert.equal(result.basic.targetEvasion50.result, 'EVADED');

  assert.equal(result.twinOneLands.hits.filter((hit: any) => hit.result === 'HIT').length, 1);
  assert.equal(result.twinOneLands.tempoAfter, 1);
  assert.equal(result.twinOneLands.flowActiveAfter, false);
  assert.equal(result.twinBothEvade.hits.filter((hit: any) => hit.result === 'HIT').length, 0);
  assert.equal(result.twinBothEvade.tempoAfter, 0);
  assert.equal(result.twinBothEvade.flowActiveAfter, true);

  assert.equal(result.piercingNoOwner.hits.filter((hit: any) => hit.result === 'HIT').length, 0);
  assert.equal(result.piercingOtherOwner.hits.filter((hit: any) => hit.result === 'HIT').length, 0);
  assert.equal(result.piercingOwnOwner.hits.filter((hit: any) => hit.result === 'HIT').length, 3);

  assert.equal(result.tempest.hits.filter((hit: any) => hit.result === 'HIT').length, 3);
  assert.equal(result.tempest.flowActiveAfter, false);
  assert.equal(result.tempest.tempoAfter, 0);
  assert.equal(result.earth.successfulTargets, 1);
  assert.equal(result.earth.results[0].stunned, true);
  assert.equal(result.earth.results[1].result, 'EVADED');
  assert.equal(result.earth.results[1].stunned, false);
  assert.equal(result.fury.successfulTargets, 2);
});
