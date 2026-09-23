import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  availableSkillPointsV3,
  canPurchaseSkillRank,
  createSkillProgressionV3,
  purchaseSkillRankV3,
  refundAllSkillPointsForJobChange,
  resolveSkillCombatProfileV3,
  resolveSkillProfileV3,
  skillLineageJobsV3,
  spentSkillPointsV3,
  transitionSkillJobV3,
  type SkillDefinitionV3,
  type SkillJobNodeV3,
} from './skill-progression-v3.ts';

const jobs: Record<string, SkillJobNodeV3> = {
  adventurer: { id: 'adventurer', tier: 'adventurer', parent: null },
  warrior: { id: 'warrior', tier: 'core', parent: 'adventurer' },
  berserker: { id: 'berserker', tier: 'specialization', parent: 'warrior' },
  blade_master: { id: 'blade_master', tier: 'specialization', parent: 'warrior' },
};

const skill = (patch: Partial<SkillDefinitionV3>): SkillDefinitionV3 => ({
  id: 'base', name: 'Base', jobId: 'adventurer', jobTier: 'adventurer',
  maxRank: 1, spCostPerRank: 1, skillType: 'ACTIVE_DAMAGE', ...patch,
});

const fixture = () => ({
  jobs,
  skills: Object.fromEntries([
    skill({ id: 'native', name: 'Native' }),
    skill({ id: 'chain', name: 'Chain', prerequisiteSkills: [{ skillId: 'native', requiredRank: 1 }] }),
    skill({ id: 'warrior-core', name: 'Warrior Core', jobId: 'warrior', jobTier: 'core', unlockLevel: 15, maxRank: 3, spCostPerRank: 2 }),
    skill({ id: 'blade-rush', name: 'Blade Rush', jobId: 'blade_master', jobTier: 'specialization', unlockLevel: 60, ancestryRequirement: ['warrior'], prerequisiteSkills: [{ skillId: 'warrior-core', requiredRank: 2 }] }),
    skill({ id: 'berserker-only', name: 'Berserker Only', jobId: 'berserker', jobTier: 'specialization', unlockLevel: 60 }),
    skill({ id: 'investment', name: 'Investment', jobId: 'blade_master', jobTier: 'specialization', unlockLevel: 60, maxRank: 3, spCostPerRank: 2, jobInvestmentRequirement: { jobId: 'blade_master', minimumSP: 4 } }),
    skill({ id: 'ultimate', name: 'Ultimate', jobId: 'blade_master', jobTier: 'specialization', maxRank: 1, rankLevelRequirements: [75], spCostPerRank: 5, jobInvestmentRequirement: { jobId: 'blade_master', minimumSP: 4 } }),
    skill({ id: 'variable', name: 'Variable', maxRank: 3, spCostPerRank: [1, 2, 4], rankLevelRequirements: [1, 2, 3] }),
  ].map((entry) => [entry.id, entry] as const)),
});

await test('native purchase, finite SP, variable rank and variable cost work', () => {
  const f = fixture();
  const state = createSkillProgressionV3(4);
  const context = { ...f, state, level: 10 };
  assert.equal(purchaseSkillRankV3(context, 'native').reason, 'OK');
  assert.equal(purchaseSkillRankV3(context, 'variable').reason, 'OK');
  assert.equal(purchaseSkillRankV3(context, 'variable').reason, 'OK');
  assert.equal(state.skillRanks.variable, 2);
  assert.equal(spentSkillPointsV3(state, f.skills), 4);
  assert.equal(availableSkillPointsV3(state, f.skills), 0);
  assert.equal(canPurchaseSkillRank(context, 'variable').reason, 'INSUFFICIENT_SP');
});

await test('unlock level is required only for the first rank', () => {
  const f = fixture();
  const state = createSkillProgressionV3(7);
  const context = { ...f, state, level: 1 };
  assert.equal(purchaseSkillRankV3(context, 'variable').reason, 'OK');
  assert.equal(purchaseSkillRankV3(context, 'variable').reason, 'OK');
  assert.equal(state.skillRanks.variable, 2);
  context.level = 1;
  assert.equal(purchaseSkillRankV3(context, 'variable').reason, 'OK');
  assert.equal(state.skillRanks.variable, 3);
});

await test('level, prerequisite and sibling specialization gates return structured reasons', () => {
  const f = fixture();
  const state = transitionSkillJobV3(transitionSkillJobV3(createSkillProgressionV3(20), 'core', 'warrior'), 'specialization', 'blade_master');
  const context = { ...f, state, level: 60 };
  assert.equal(canPurchaseSkillRank(context, 'ultimate').reason, 'REQUIRES_LEVEL');
  assert.equal(canPurchaseSkillRank(context, 'blade-rush').reason, 'REQUIRES_SKILL');
  assert.equal(canPurchaseSkillRank(context, 'berserker-only').reason, 'WRONG_SPECIALIZATION');
  state.skillRanks['warrior-core'] = 2;
  assert.equal(canPurchaseSkillRank(context, 'blade-rush').reason, 'OK');
});

await test('cross-tier prerequisite and job investment are calculated per declared job', () => {
  const f = fixture();
  const state = transitionSkillJobV3(transitionSkillJobV3(createSkillProgressionV3(20), 'core', 'warrior'), 'specialization', 'blade_master');
  const context = { ...f, state, level: 80 };
  state.skillRanks['warrior-core'] = 2;
  assert.equal(canPurchaseSkillRank(context, 'investment').reason, 'REQUIRES_JOB_INVESTMENT');
  state.skillRanks['investment'] = 2;
  assert.equal(canPurchaseSkillRank(context, 'ultimate').reason, 'OK');
});

await test('job change refunds all skill ranks but preserves chosen lineage', () => {
  const f = fixture();
  const before = transitionSkillJobV3(createSkillProgressionV3(25), 'core', 'warrior');
  before.skillRanks.native = 1;
  before.skillRanks['warrior-core'] = 2;
  const changed = transitionSkillJobV3(before, 'specialization', 'blade_master');
  assert.equal(changed.totalEarnedSP, 25);
  assert.deepEqual(changed.skillRanks, {});
  assert.equal(changed.chosenCoreJob, 'warrior');
  assert.equal(changed.chosenSpecialization, 'blade_master');
  assert.equal(availableSkillPointsV3(changed, f.skills), 25);
  assert.deepEqual(skillLineageJobsV3(changed, f.jobs).map((job) => job.id), ['adventurer', 'warrior', 'blade_master']);
});

await test('explicit refund is skill-only and does not erase job identity', () => {
  const state = transitionSkillJobV3(createSkillProgressionV3(10), 'core', 'warrior');
  state.skillRanks.native = 1;
  const refunded = refundAllSkillPointsForJobChange(state);
  assert.equal(refunded.chosenCoreJob, 'warrior');
  assert.equal(refunded.totalEarnedSP, 10);
  assert.deepEqual(refunded.skillRanks, {});
});

await test('PvP override falls back to default fields and motion metadata is not combat data', () => {
  const s = skill({
    id: 'profile',
    defaultProfile: { damageProfile: { physicalCoefficient: 1.2, flatPower: 10 }, cooldown: 3 },
    pvpOverride: { damageProfile: { physicalCoefficient: 0.8 } },
    motion: { motionArchetype: 'HORIZONTAL_SWEEP', animationNoGo: ['full spin'] },
  });
  assert.equal(resolveSkillProfileV3(s, 'pve').damageProfile?.physicalCoefficient, 1.2);
  assert.equal(resolveSkillProfileV3(s, 'pvp').damageProfile?.physicalCoefficient, 0.8);
  assert.equal(resolveSkillProfileV3(s, 'pvp').damageProfile?.flatPower, 10);
  assert.equal(resolveSkillCombatProfileV3(s, 'pvp').damageProfile.physicalCoefficient, 0.8);
  assert.equal('motion' in resolveSkillCombatProfileV3(s), false);
});

await test('ultimate unlocks at its declared level once all conditions pass', () => {
  const f = fixture();
  const state = transitionSkillJobV3(transitionSkillJobV3(createSkillProgressionV3(30), 'core', 'warrior'), 'specialization', 'blade_master');
  state.skillRanks['warrior-core'] = 2;
  state.skillRanks.investment = 2;
  const context = { ...f, state, level: 74 };
  assert.equal(canPurchaseSkillRank(context, 'ultimate').reason, 'REQUIRES_LEVEL');
  context.level = 75;
  assert.equal(canPurchaseSkillRank(context, 'ultimate').reason, 'OK');
});
