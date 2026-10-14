import { legalJobResetFixture } from './gameplay-test-fixtures.ts';
import test from 'node:test';
import assert from 'node:assert/strict';

import { resetJobToAdventurer } from './rules.ts';

await test('job reset runtime preserves earned level progression and clears job selection', () => {
  const hero = legalJobResetFixture();
  const result = resetJobToAdventurer(hero);
  assert.equal(result.ok, true);
  assert.equal(result.hero.job, 'adventurer');
  assert.equal(result.hero.coreJob, null);
  assert.equal(result.hero.specialization, null);
  assert.equal(result.hero.jobTier, 'adventurer');
  assert.equal(result.hero.gold, 1000);
  assert.equal(result.hero.skillProgressionV3?.totalEarnedSP, 119);
  assert.equal(result.hero.skillProgressionV3?.chosenCoreJob, null);
  assert.equal(result.hero.skillProgressionV3?.chosenSpecialization, null);
});
