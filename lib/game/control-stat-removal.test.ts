import test from 'node:test';
import assert from 'node:assert/strict';
import { createV2TestHero, authorizeV2Warrior, derivedStats, resolveHeroSkill } from './rules.ts';
import { WARRIOR_V2_ACTIVE, WARRIOR_V2_PASSIVES } from './warrior-v2.ts';

await test('removed poise/stat systems leave clean V2 actions and stats', () => {
  const hero = createV2TestHero();
  hero.level = 59;
  assert.equal(authorizeV2Warrior(hero), true);
  assert.equal(WARRIOR_V2_ACTIVE.length, 16);
  assert.equal(WARRIOR_V2_PASSIVES.length, 14);
  const stats = derivedStats(hero) as Record<string, unknown>;
  assert.equal('tenacity' in stats, false);
  for (const skill of WARRIOR_V2_ACTIVE) {
    const action = resolveHeroSkill(hero, skill, 1, derivedStats(hero)) as Record<string, unknown>;
    assert.equal('knockbackStrength' in action, true, skill.id);
    assert.equal('tenacity' in action, false, skill.id);
  }
});

await test('redesign-only Warrior nodes remain inert until owner review', () => {
  for (const id of ['firm-footing', 'heavy-impact', 'indomitable-will']) {
    const passive = WARRIOR_V2_PASSIVES.find((entry) => entry.id === `v2-warrior-${id}`);
    assert.ok(passive);
    assert.match(passive.description, /REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT/);
    assert.equal(passive.modifiers?.length ?? 0, 0);
    assert.equal(passive.combatSupport, undefined);
    assert.equal(passive.rankCombatSupport, undefined);
  }
});
