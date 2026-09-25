import assert from 'node:assert/strict';
import test from 'node:test';
import { createV3AdventurerHero, chooseV3Warrior, chooseV3Berserker, chooseV3BladeMaster } from './rules.ts';
import { WARRIOR_V3_SKILL_MAP, WARRIOR_V3_RUNTIME_MAP } from './warrior-v3.ts';
import { BERSERKER_V3_SKILL_MAP, BERSERKER_V3_RUNTIME_MAP } from './berserker-v3.ts';
import { BLADE_MASTER_V3_SKILL_MAP, BLADE_MASTER_V3_RUNTIME_MAP } from './blade-master-v3.ts';
import type { Hero } from './rules.ts';
import { resolveSkillPresentation } from './skill-presentation-v3.ts';

await test('presentation derives Warrior Strike scaling and next rank from runtime values', () => {
  const hero = jobHero('warrior');
  hero.skillProgressionV3!.skillRanks['v3-warrior-strike'] = 1;
  const model = resolveSkillPresentation(hero, WARRIOR_V3_SKILL_MAP['v3-warrior-strike'], WARRIOR_V3_RUNTIME_MAP['v3-warrior-strike']);
  assert.deepEqual(model.damage.map((row) => row.label), ['Damage Type', 'Hits', 'Physical Attack', 'Bonus STR']);
  assert.equal(model.damage.find((row) => row.label === 'Physical Attack')?.value, '×1.00');
  assert.equal(model.nextRank.find((row) => row.label === 'Physical Attack')?.value, '×1.00 → ×1.02');
});

await test('presentation exposes multi-hit and dual-wield player language', () => {
  const hero = jobHero('blade_master');
  hero.skillProgressionV3!.skillRanks['v3-blade-master-twin-assault'] = 1;
  const model = resolveSkillPresentation(hero, BLADE_MASTER_V3_SKILL_MAP['v3-blade-master-twin-assault'], BLADE_MASTER_V3_RUNTIME_MAP['v3-blade-master-twin-assault']);
  assert.equal(model.damage.find((row) => row.label === 'Hits')?.value, '2');
  assert.equal(model.specialMechanics.find((row) => row.label === 'Sequence')?.value, 'Main Hand → Off Hand');
});

await test('presentation reads stun, recovery and buff metadata without raw engine tokens', () => {
  const hero = jobHero('berserker');
  const earth = resolveSkillPresentation(hero, BERSERKER_V3_SKILL_MAP['v3-berserker-earth-splitter'], BERSERKER_V3_RUNTIME_MAP['v3-berserker-earth-splitter']);
  assert.match(earth.specialMechanics.find((row) => row.label === 'Stun Chance')?.value ?? '', /%/);
  assert.equal(earth.area.find((row) => row.label === 'Max Targets')?.value, '5');
  assert.doesNotMatch(JSON.stringify(earth), /dual_sword|DUAL_COMBINED|sharedContributionWeight/);
});

await test('presentation exposes canonical Warrior mechanics and buff wording', () => {
  const hero = jobHero('warrior');
  const armor = resolveSkillPresentation(hero, WARRIOR_V3_SKILL_MAP['v3-warrior-armor-breaker'], WARRIOR_V3_RUNTIME_MAP['v3-warrior-armor-breaker']);
  const cry = resolveSkillPresentation(hero, WARRIOR_V3_SKILL_MAP['v3-warrior-battle-cry'], WARRIOR_V3_RUNTIME_MAP['v3-warrior-battle-cry']);
  assert.equal(armor.specialMechanics.find((row) => row.label === 'Defense Reduction')?.value, '6%');
  assert.equal(cry.specialMechanics.find((row) => row.label === 'Physical Damage')?.value, '+3%');
  assert.equal(cry.damage.length, 0);
});

await test('presentation exposes recovery cap, full Blade Tempest sequence, and max rank state', () => {
  const berserker = jobHero('berserker');
  const harvest = resolveSkillPresentation(berserker, BERSERKER_V3_SKILL_MAP['v3-berserker-fury-harvest'], BERSERKER_V3_RUNTIME_MAP['v3-berserker-fury-harvest']);
  assert.equal(harvest.specialMechanics.find((row) => row.label === 'Recovery Target Cap')?.value, '5');
  const blade = jobHero('blade_master');
  blade.skillProgressionV3!.skillRanks['v3-blade-master-blade-tempest'] = 3;
  const tempest = resolveSkillPresentation(blade, BLADE_MASTER_V3_SKILL_MAP['v3-blade-master-blade-tempest'], BLADE_MASTER_V3_RUNTIME_MAP['v3-blade-master-blade-tempest']);
  assert.equal(tempest.damage.find((row) => row.label === 'Hits')?.value, '5');
  assert.equal(tempest.specialMechanics.find((row) => row.label === 'Sequence')?.value, 'Main Hand → Off Hand → Main Hand → Off Hand → Both Swords');
  assert.equal(tempest.nextRank.length, 0);
});

await test('mastery presentation uses rank-one gate, player job label, and no cast resource rows', () => {
  const hero = jobHero('blade_master');
  const model = resolveSkillPresentation(hero, BLADE_MASTER_V3_SKILL_MAP['v3-blade-master-twin-blade-mastery'], BLADE_MASTER_V3_RUNTIME_MAP['v3-blade-master-twin-blade-mastery']);
  assert.equal(model.requirements.find((row) => row.label === 'Character Requirement')?.value, 'Lv. 60');
  assert.equal(model.requirements.find((row) => row.label === 'Job Requirement')?.value, 'Blade Master');
  assert.equal(model.resource.length, 0);
  assert.equal('preview' in model, false);
  assert.doesNotMatch(JSON.stringify(model), /blade_master|dual_wield/);
});

await test('mastery presentation exposes canonical Accuracy and Mana reduction by rank', () => {
  const hero = jobHero('blade_master');
  const definition = BLADE_MASTER_V3_SKILL_MAP['v3-blade-master-twin-blade-mastery'];
  const runtime = BLADE_MASTER_V3_RUNTIME_MAP['v3-blade-master-twin-blade-mastery'];
  for (const [rank, accuracy, reduction] of [[1, 2, 0], [2, 4, 2], [3, 6, 4], [4, 8, 6], [5, 10, 8]] as const) {
    hero.skillProgressionV3!.skillRanks[definition.id] = rank;
    const model = resolveSkillPresentation(hero, definition, runtime);
    assert.equal(model.effects.find((row) => row.label === 'Accuracy')?.value, `+${accuracy}`);
    assert.equal(model.effects.find((row) => row.label === 'Mana Reduction')?.value, `${reduction}%`);
    assert.match(model.effects.find((row) => row.label === 'Affected Skills')?.value ?? '', /Twin Assault/);
  }
});
function jobHero(job: 'warrior' | 'blade_master' | 'berserker'): Hero {
  const hero = createV3AdventurerHero();
  hero.level = 60;
  assert(chooseV3Warrior(hero));
  if (job === 'blade_master') assert(chooseV3BladeMaster(hero));
  if (job === 'berserker') assert(chooseV3Berserker(hero));
  return hero;
}
