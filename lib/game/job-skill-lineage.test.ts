import test from 'node:test';
import assert from 'node:assert/strict';
import { createV3AdventurerHero, chooseCoreJob, chooseV3Thief, chooseSpecialization, learnSkill, type Hero } from './rules.ts';
import { getJobProgression, getJobSkillNodes } from './character-view.ts';
import { skillFamilyOverview } from './skill-family-presentation.ts';
import { resolvePrimaryHotbarEntry } from './hotbar.ts';
import { heroFamilyHotbarBinding } from './skill-family-runtime.ts';

function core(job: 'thief' | 'warrior', level = 30): Hero {
  const hero = createV3AdventurerHero('lineage-ui-test', 'Lineage UI');
  hero.level = level;
  hero.skillProgressionV3!.totalEarnedSP = 90;
  // Current trainer requires unequipped gear; isolate fixture inventory only.
  for (const slot of Object.keys(hero.equipment) as Array<keyof typeof hero.equipment>) hero.equipment[slot] = null;
  hero.inventory.forEach(item => { item.isEquipped = false; });
  assert(job === 'thief' ? chooseV3Thief(hero) : chooseCoreJob(hero, job));
  return hero;
}

void test('Adventurer exposes no unchosen lineage, even at specialization level', () => {
  const hero = createV3AdventurerHero('new-ui', 'New');
  for (const level of [1, 15, 60]) {
    hero.level = level;
    assert.deepEqual(getJobProgression(hero).map(s => [s.name, s.status]), [['Adventurer', 'Current']]);
    assert.equal(getJobSkillNodes(hero, 'adventurer').active.length, 3);
    assert.equal(getJobSkillNodes(hero, 'core').active.length, 0);
    assert.equal(getJobSkillNodes(hero, 'specialization').active.length, 0);
  }
});
for (const job of ['warrior', 'thief'] as const) {
  void test(`${job} sidebar shows only its ancestry and contextual specialization`, () => {
    const hero = core(job);
    const names = job === 'thief' ? ['Adventurer', 'Thief', 'Rogue / Assasin'] : ['Adventurer', 'Warrior', 'Berserker / Blade Master'];
    assert.deepEqual(getJobProgression(hero).map(s => s.name), names);
    assert.deepEqual(getJobProgression(hero).map(s => s.status), ['Completed', 'Current', 'Locked']);
    hero.level = 60;
    assert.equal(getJobProgression(hero)[2].status, 'Available');
    assert.equal(getJobSkillNodes(hero, 'specialization').active.length, 0);
    const tree = getJobSkillNodes(hero, 'core').active;
    assert.equal(tree.length, job === 'thief' ? 36 : 11);
    assert(tree.every(skill => skill.job === job && !skill.specialization));
  });
}
for (const specialization of ['berserker', 'blade_master', 'rogue', 'assasin'] as const) {
  void test(`${specialization} selected stage binds its own nine-skill registry`, () => {
    const hero = core(specialization === 'rogue' || specialization === 'assasin' ? 'thief' : 'warrior', 60);
    assert(chooseSpecialization(hero, specialization));
    assert.deepEqual(getJobProgression(hero).map(s => s.status), ['Completed', 'Completed', 'Current']);
    const nodes = getJobSkillNodes(hero, 'specialization').active;
    assert.equal(nodes.length, 9);
    assert(nodes.every(skill => skill.specialization === specialization));
    assert.equal(getJobSkillNodes(hero, 'adventurer').active.length, 3);
  });
}
void test('Thief tree contains all nine families; learned family resolves in loadout without mutation', () => {
  const hero = core('thief');
  assert(learnSkill(hero, 'v3-thief-quick-stab'));
  const before = JSON.stringify(hero);
  const tree = getJobSkillNodes(hero, 'core').active;
  const families = skillFamilyOverview(hero, tree);
  assert.equal(families.length, 9);
  assert.equal(families.find(f => f.id === 'quick_stab')?.active?.id, 'v3-thief-quick-stab');
  assert.equal(resolvePrimaryHotbarEntry(hero, heroFamilyHotbarBinding(hero, 'v3-thief-quick-stab'))?.id, 'v3-thief-quick-stab');
  assert.equal(JSON.stringify(hero), before);
});
void test('UI registry follows saved progression rather than defaulting stale mirrors to Warrior', () => {
  const hero = core('thief');
  hero.coreJob = 'warrior'; // Read-only presentation must not change/repair the actor.
  assert.equal(getJobProgression(hero)[1].name, 'Thief');
  assert(getJobSkillNodes(hero, 'core').active.every(skill => skill.job === 'thief'));
  hero.skillProgressionV3!.chosenCoreJob = null;
  assert.deepEqual(getJobProgression(hero).map(s => s.name), ['Adventurer']);
});
