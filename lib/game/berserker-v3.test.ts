import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeSkills, chooseV3Berserker, chooseV3Warrior, createV3AdventurerHero, learnSkill, parseSave } from './rules.ts';
import { BERSERKER_V3_SKILLS, BERSERKER_V3_RUNTIME_SKILLS, EARTH_SPLITTER_STUN_CHANCE, FURY_HARVEST_RECOVERY_PERCENT } from './berserker-v3.ts';
import { canPurchaseSkillRank, createSkillProgressionV3, purchaseSkillRankV3, spentSkillPointsV3 } from './skill-progression-v3.ts';
import { BerserkerV3RuntimeFixture } from './berserker-v3-fixture.ts';

const setup = (level = 80) => {
  const hero = createV3AdventurerHero('berserker-test', 'Berserker V3 Test');
  hero.level = level;
  hero.skillProgressionV3!.totalEarnedSP = 300;
  assert.equal(chooseV3Warrior(hero), true);
  if (level >= 60) assert.equal(chooseV3Berserker(hero), true);
  return hero;
};

test('Berserker V3 exposes exactly nine canonical skills and no sibling content', () => {
  assert.deepEqual(BERSERKER_V3_SKILLS.map((skill) => skill.id), [
    'v3-berserker-two-hand-mastery', 'v3-berserker-raging-cleave', 'v3-berserker-crushing-blow',
    'v3-berserker-iron-blood', 'v3-berserker-breaker-entry', 'v3-berserker-earth-splitter',
    'v3-berserker-ruinous-arc', 'v3-berserker-fury-harvest', 'v3-berserker-trance',
  ]);
  assert.equal(BERSERKER_V3_RUNTIME_SKILLS.length, 9);
  assert.equal(BERSERKER_V3_RUNTIME_SKILLS.find((skill) => skill.id === 'v3-berserker-two-hand-mastery')?.usableFromHotbar, false);
  assert.equal(BERSERKER_V3_RUNTIME_SKILLS.filter((skill) => skill.usableFromHotbar).length, 8);
});

test('Berserker Damage V4 data and Earth Splitter hit weights are canonical', () => {
  const raging = BERSERKER_V3_SKILLS.find((skill) => skill.id === 'v3-berserker-raging-cleave');
  const earth = BERSERKER_V3_SKILLS.find((skill) => skill.id === 'v3-berserker-earth-splitter');
  assert.deepEqual(raging?.baseDamageMinByRank, [120, 126, 132, 138, 145, 152, 160, 168]);
  assert.deepEqual(raging?.baseDamageMaxByRank, [170, 178, 186, 194, 203, 212, 222, 232]);
  assert.equal(raging?.skillPowerFactor, 8);
  assert.deepEqual(raging?.rankPowerFactorByRank, [1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35]);
  assert.deepEqual(earth?.baseDamageMinByRank, [180, 195, 210, 230, 250]);
  assert.deepEqual(earth?.baseDamageMaxByRank, [240, 260, 280, 305, 330]);
  assert.equal(earth?.skillPowerFactor, 8);
  assert.deepEqual(earth?.rankPowerFactorByRank, [1, 1.05, 1.1, 1.15, 1.2]);
  const runtimeEarth = BERSERKER_V3_RUNTIME_SKILLS.find((skill) => skill.id === 'v3-berserker-earth-splitter');
  assert.ok(runtimeEarth?.rankEffects?.some((entry) => (entry.hitSequence ?? []).length === 4));
  const weights = runtimeEarth!.rankEffects![0].hitSequence!.map((hit) => hit.sharedContributionWeight ?? 1);
  assert.deepEqual(weights, [0.2, 0.22, 0.25, 0.33]);
});

test('Lv59 cannot transition or purchase Berserker; Lv60 transition refunds skills and blocks Blade Master', () => {
  const low = createV3AdventurerHero();
  low.level = 59;
  assert.equal(chooseV3Warrior(low), true);
  assert.equal(chooseV3Berserker(low), false);
  const hero = setup(60);
  assert.equal(hero.coreJob, 'warrior');
  assert.equal(hero.specialization, 'berserker');
  assert.equal(Object.values(hero.skillProgressionV3!.skillRanks).some((rank) => rank > 0 && rank !== 1), false);
  assert.equal(activeSkills(hero).filter((skill) => skill.id.startsWith('v3-berserker-')).length, 9);
  assert.equal(activeSkills(hero).some((skill) => skill.id.includes('blade-master')), false);
});

test('Berserker prerequisites and rank gates follow the strict contract', () => {
  const hero = setup(80);
  assert.equal(learnSkill(hero, 'v3-berserker-raging-cleave'), false);
  assert.equal(learnSkill(hero, 'v3-warrior-strike'), true);
  assert.equal(learnSkill(hero, 'v3-warrior-strike'), true);
  assert.equal(learnSkill(hero, 'v3-warrior-sweeping-slash'), true);
  assert.equal(learnSkill(hero, 'v3-warrior-sweeping-slash'), true);
  assert.equal(learnSkill(hero, 'v3-warrior-sweeping-slash'), true);
  assert.equal(learnSkill(hero, 'v3-warrior-sweeping-slash'), true);
  assert.equal(learnSkill(hero, 'v3-berserker-raging-cleave'), true);
  assert.equal(learnSkill(hero, 'v3-berserker-earth-splitter'), false);
  assert.equal(learnSkill(hero, 'v3-berserker-breaker-entry'), false);
  assert.equal(learnSkill(hero, 'v3-warrior-iron-charge'), true);
  assert.equal(learnSkill(hero, 'v3-warrior-iron-charge'), true);
  assert.equal(learnSkill(hero, 'v3-warrior-iron-charge'), true);
  assert.equal(learnSkill(hero, 'v3-berserker-breaker-entry'), true);
});

test('Berserker cost model and Earth Splitter Stun data are explicit and finite', () => {
  assert.equal(BERSERKER_V3_SKILLS.find((skill) => skill.id === 'v3-berserker-two-hand-mastery')?.spCostPerRank, 4);
  assert.equal(BERSERKER_V3_SKILLS.find((skill) => skill.id === 'v3-berserker-trance')?.spCostPerRank, 5);
  assert.deepEqual([...EARTH_SPLITTER_STUN_CHANCE], [.08, .10, .12, .15, .18]);
  assert.deepEqual([...FURY_HARVEST_RECOVERY_PERCENT], [.6, .7, .8, .9, 1]);
  const state = createSkillProgressionV3(149, 'warrior');
  state.chosenSpecialization = 'berserker';
  const definitions = Object.fromEntries(BERSERKER_V3_SKILLS.map((skill) => [skill.id, skill]));
  for (const skill of BERSERKER_V3_SKILLS) state.skillRanks[skill.id] = skill.maxRank;
  assert.equal(spentSkillPointsV3(state, definitions), 149);
});

test('Berserker save reload keeps lineage and ranks but not transient state fields', () => {
  const hero = setup(80);
  hero.skillProgressionV3!.skillRanks['v3-berserker-two-hand-mastery'] = 3;
  hero.skillLevels['v3-berserker-two-hand-mastery'] = 3;
  hero.activeBuffs['v3-berserker-trance'] = 12;
  const loaded = parseSave(JSON.stringify(hero));
  assert(loaded);
  assert.equal(loaded!.specialization, 'berserker');
  assert.equal(loaded!.skillProgressionV3!.skillRanks['v3-berserker-two-hand-mastery'], 3);
  assert.equal(loaded!.activeBuffs['v3-berserker-trance'], undefined);
});

test('clean Berserker runtime fixture validates window, AoE, recovery, Trance and per-target Stun', () => {
  const fixture = new BerserkerV3RuntimeFixture();
  fixture.setTargets(5);
  assert.equal(fixture.ironChargeImpact().breakerEntryActive, true);
  assert.equal(fixture.breakerEntry(1).accepted, true);
  fixture.setTargets(8);
  const earth = fixture.earthSplitter(1, 0);
  assert.equal(earth.actualTargetsHit, 5);
  assert.equal(earth.results.filter((entry) => entry.stunned).length, 5);
  fixture.setTargets(7);
  const harvest = fixture.furyHarvest(5);
  assert.equal(harvest.actualTargetsHit, 7);
  assert.equal(harvest.heal, 50);
  fixture.setTargets(7);
  const trance = fixture.trance(3);
  assert.equal(trance.finalDamageBonus, .10);
  assert.equal(trance.targetCap, 8);
  assert.equal(trance.actualTargetsHit, 7);
  assert.equal(trance.frenzyGuard?.reductionPercent, 6);
  fixture.advance(2.1);
  assert.equal(fixture.transient.frenzyGuard, null);
});
