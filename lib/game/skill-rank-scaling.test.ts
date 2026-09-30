import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSkillAction, type SkillResolveContext } from './skill-action.ts';
import { derivedStats, freshHero } from './rules.ts';
import { THIEF_V2_ACTIVE } from './thief-v2.ts';
import { BERSERKER_V3_RUNTIME_MAP } from './berserker-v3.ts';

const context: SkillResolveContext = {
  stats: { ...derivedStats(freshHero()), skillDamage: 0 },
  rank: 3, masteryPower: 1, masteryCooldown: 1, equipmentDamage: 0,
  weaponAllowed: true, weaponStyle: 'dagger', rng: () => 0,
};

await test('explicit V2 rank values have no undeclared rank multiplier', () => {
  const action = resolveSkillAction(THIEF_V2_ACTIVE[0], { ...context, v2: true });
  assert.equal(action.damageMultiplier, 1);
  assert(action.hitSequence.every(hit => hit.damageMultiplier === 1));
});

await test('legacy scaling applies its existing 12% per additional rank exactly once', () => {
  const legacy = { ...THIEF_V2_ACTIVE[0], progressionMode: undefined, rankValues: undefined };
  assert.equal(resolveSkillAction(legacy, context).damageMultiplier, 1.24);
});

await test('V3 keeps its explicitly declared rank multiplier', () => {
  const skill = BERSERKER_V3_RUNTIME_MAP['v3-berserker-raging-cleave'];
  const action = resolveSkillAction(skill, { ...context, weaponStyle: 'two_hand_sword' });
  assert.equal(action.damageMultiplier, 1.1);
  assert(action.hitSequence.every(hit => hit.damageMultiplier === 1.1));
});
