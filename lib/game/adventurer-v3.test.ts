import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeSkills,
  canCastSkill,
  createV3AdventurerHero,
  gainXP,
  learnSkill,
  maxHP,
  parseSave,
  skillHealingPreview,
} from './rules.ts';
import { ADVENTURER_V3_SKILLS } from './adventurer-v3.ts';
import { transitionSkillJobV3 } from './skill-progression-v3.ts';
import { assignPrimaryHotbarSlot } from './hotbar.ts';

await test('V3 development Adventurer exposes exactly the three canonical skills', () => {
  const hero = createV3AdventurerHero();
  assert.equal(hero.skillArchitectureVersion, 3);
  assert.deepEqual(activeSkills(hero).map((skill) => skill.id), [
    'v3-adventurer-quick-slash',
    'v3-adventurer-power-strike',
    'v3-adventurer-minor-heal',
  ]);
  assert.equal(hero.skillProgressionV3?.skillRanks['v3-adventurer-quick-slash'], 1);
  assert.equal(hero.skillProgressionV3?.totalEarnedSP, 0);
});

await test('Adventurer V3 mana costs match the larger base mana pool', () => {
  const hero = createV3AdventurerHero();
  const quick = activeSkills(hero).find((skill) => skill.id === 'v3-adventurer-quick-slash')!;
  const power = activeSkills(hero).find((skill) => skill.id === 'v3-adventurer-power-strike')!;
  const heal = activeSkills(hero).find((skill) => skill.id === 'v3-adventurer-minor-heal')!;

  assert.equal(quick.manaCost, 12);
  assert.equal(power.manaCost, 18);
  assert.equal(heal.manaCost, 26);
});

await test('rank gates and SP purchase match Lv1, Lv2, Lv3, Lv4, Lv8, Lv13 and Lv14 matrix', () => {
  const hero = createV3AdventurerHero();
  hero.skillProgressionV3!.totalEarnedSP = 20;
  assert.equal(learnSkill(hero, 'v3-adventurer-minor-heal'), false);
  hero.level = 2;
  assert.equal(learnSkill(hero, 'v3-adventurer-minor-heal'), true);
  hero.level = 3;
  assert.equal(learnSkill(hero, 'v3-adventurer-quick-slash'), true);
  hero.level = 4;
  assert.equal(learnSkill(hero, 'v3-adventurer-power-strike'), true);
  hero.level = 8;
  assert.equal(learnSkill(hero, 'v3-adventurer-minor-heal'), true);
  hero.level = 13;
  for (let i = 0; i < 3; i++) assert.equal(learnSkill(hero, 'v3-adventurer-quick-slash'), true);
  hero.level = 14;
  for (let i = 0; i < 4; i++) assert.equal(learnSkill(hero, 'v3-adventurer-power-strike'), true);
  assert.equal(hero.skillProgressionV3!.skillRanks['v3-adventurer-quick-slash'], 5);
  assert.equal(hero.skillProgressionV3!.skillRanks['v3-adventurer-power-strike'], 5);
  assert.equal(hero.skillProgressionV3!.skillRanks['v3-adventurer-minor-heal'], 2);
});

await test('Quick Slash R1 is granted without SP and insufficient SP blocks purchases', () => {
  const hero = createV3AdventurerHero();
  hero.level = 3;
  assert.equal(hero.skillProgressionV3!.totalEarnedSP, 0);
  assert.equal(learnSkill(hero, 'v3-adventurer-quick-slash'), false);
  hero.skillProgressionV3!.totalEarnedSP = 1;
  assert.equal(learnSkill(hero, 'v3-adventurer-quick-slash'), true);
});

await test('Minor Heal is self-only and uses the declared Max HP percentages', () => {
  const hero = createV3AdventurerHero();
  hero.level = 14;
  hero.skillProgressionV3!.totalEarnedSP = 3;
  assert.equal(learnSkill(hero, 'v3-adventurer-minor-heal'), true);
  assert.equal(learnSkill(hero, 'v3-adventurer-minor-heal'), true);
  const heal = activeSkills(hero).find((skill) => skill.id === 'v3-adventurer-minor-heal')!;
  assert.equal(heal.targetType, 'self');
  assert.equal(skillHealingPreview(hero, heal, 3), Math.round(maxHP(hero) * .1));
  assert.equal(ADVENTURER_V3_SKILLS.find((skill) => skill.id === heal.id)?.motion?.movementIntent, 'NONE');
});

await test('V3 skills cast through the existing runtime checks and preserve Mana/cooldown', () => {
  const hero = createV3AdventurerHero();
  hero.level = 4;
  hero.skillProgressionV3!.totalEarnedSP = 2;
  assert.equal(learnSkill(hero, 'v3-adventurer-power-strike'), true);
  assert.equal(canCastSkill(hero, 'v3-adventurer-quick-slash').ok, true);
  assert.equal(canCastSkill(hero, 'v3-adventurer-power-strike').ok, true);
  assert.equal(canCastSkill(hero, 'v3-adventurer-minor-heal').ok, false);
  const assigned = assignPrimaryHotbarSlot(hero, 0, 'v3-adventurer-quick-slash');
  assert.equal(assigned.ok, true);
  assert.equal(assigned.hero.primaryHotbar[0], 'v3-adventurer-quick-slash');
});

await test('Core transition refunds V3 purchased ranks while retaining clean V3 state for later lineage migration', () => {
  const hero = createV3AdventurerHero();
  hero.level = 15;
  hero.skillProgressionV3!.totalEarnedSP = 12;
  assert.equal(learnSkill(hero, 'v3-adventurer-power-strike'), true);
  assert.equal(hero.skillProgressionV3!.skillRanks['v3-adventurer-power-strike'], 1);
  const refunded = transitionSkillJobV3(hero.skillProgressionV3!, 'core', 'warrior');
  assert.equal(refunded.totalEarnedSP, 12);
  assert.equal(refunded.skillRanks['v3-adventurer-power-strike'], undefined);
  assert.equal(refunded.skillRanks['v3-adventurer-quick-slash'], 1);
  assert.equal(refunded.chosenCoreJob, 'warrior');
});

await test('V3 development save reload preserves ranks, total SP and lineage; V2 path remains separate', () => {
  const hero = createV3AdventurerHero();
  hero.level = 8;
  hero.skillProgressionV3!.totalEarnedSP = 5;
  learnSkill(hero, 'v3-adventurer-power-strike');
  hero.skillProgressionV3!.chosenCoreJob = 'warrior';
  const loaded = parseSave(JSON.stringify(hero));
  assert(loaded);
  assert.equal(loaded!.skillArchitectureVersion, 3);
  assert.equal(loaded!.skillProgressionV3!.totalEarnedSP, 5);
  assert.equal(loaded!.skillProgressionV3!.skillRanks['v3-adventurer-power-strike'], 1);
  assert.equal(loaded!.skillProgressionV3!.chosenCoreJob, 'warrior');
});

await test('all canonical Adventurer V3 motion metadata is present and is presentation-only', () => {
  for (const skill of ADVENTURER_V3_SKILLS) {
    assert.ok(skill.presentation?.description);
    assert.ok(skill.motion?.motionArchetype);
    assert.ok(skill.motion?.motionNotes);
    assert.ok((skill.motion?.animationNoGo?.length ?? 0) > 0);
  }
});
