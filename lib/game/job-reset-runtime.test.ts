import test from 'node:test';
import assert from 'node:assert/strict';

import { freshHero, gainXP, resetJobToAdventurer } from './rules.ts';

test('job reset runtime preserves earned level progression and clears job selection', () => {
  const hero = freshHero();
  gainXP(hero, 90000);
  hero.gold = 1500;
  hero.allocatedStats = { str: 7, vit: 5, dex: 3, int: 2 };
  hero.statPoints = 12;
  hero.skillPoints = 5;
  hero.coreJob = 'warrior';
  hero.job = 'warrior';
  hero.jobTier = 'core';
  hero.specialization = 'berserker';
  hero.skillProgressionV3 = {
    skillArchitectureVersion: 3,
    totalEarnedSP: 18,
    skillRanks: {
      'v3-adventurer-quick-slash': 1,
      'v3-adventurer-power-strike': 1,
      'v3-warrior-strike': 2,
      'v3-warrior-guard-stance': 1,
    },
    grantedRanks: {
      'v3-adventurer-quick-slash': 1,
      'v3-adventurer-power-strike': 1,
    },
    chosenCoreJob: 'warrior',
    chosenSpecialization: 'berserker',
    chosenAdvancedJob: null,
  };

  const result = resetJobToAdventurer(hero);
  assert.equal(result.ok, true);
  assert.equal(result.hero.job, 'adventurer');
  assert.equal(result.hero.coreJob, null);
  assert.equal(result.hero.specialization, null);
  assert.equal(result.hero.jobTier, 'adventurer');
  assert.equal(result.hero.gold, 1000);
  assert.equal(result.hero.skillProgressionV3?.totalEarnedSP, 18);
  assert.equal(result.hero.skillProgressionV3?.chosenCoreJob, null);
  assert.equal(result.hero.skillProgressionV3?.chosenSpecialization, null);
});
