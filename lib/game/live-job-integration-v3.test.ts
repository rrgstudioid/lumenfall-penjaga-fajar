import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseCoreJob,
  chooseSpecialization,
  createNewCharacter,
  createV3JobDevelopmentHero,
  learnSkill,
  parseSave,
  characterLabel,
} from './rules.ts';
import { getJobProgression, getJobSkillNodes } from './character-view.ts';
import { getVisibleJobArchitecture } from './job-presentation.ts';
import { bladeMasterDualWieldActive } from './blade-master-v3.ts';
import { getPrimaryHotbarEntries } from './hotbar.ts';
import { CITIES, getNpcDescription, getNpcServiceLabel } from './regions.ts';

function warrior(level: number) {
  const hero = createNewCharacter(`live-warrior-${level}`, `Live Warrior ${level}`, {}, 'v3_adventurer');
  hero.level = level;
  hero.skillProgressionV3!.totalEarnedSP = 500;
  assert.equal(chooseCoreJob(hero, 'warrior'), true);
  return hero;
}

test('live V3 trainer view exposes both specialization siblings with Level 60 gating', () => {
  const low = warrior(59);
  const lowView = getVisibleJobArchitecture(low);
  assert.deepEqual(lowView.v3SpecializationChoices.map((choice) => choice.id), ['berserker', 'blade_master']);
  assert(lowView.v3SpecializationChoices.every((choice) => !choice.available && choice.status.includes('Requires Level 60')));
  assert.equal(chooseSpecialization(low, 'berserker'), false);
  assert.equal(chooseSpecialization(low, 'blade_master'), false);

  const ready = warrior(60);
  const readyView = getVisibleJobArchitecture(ready);
  assert(readyView.v3SpecializationChoices.every((choice) => choice.available));
  assert.deepEqual(getJobProgression(ready).map((stage) => stage.name), ['Adventurer', 'Warrior', 'Berserker / Blade Master']);
});

test('live Berserker transition uses canonical refund and locks Blade Master sibling', () => {
  const hero = warrior(60);
  assert.equal(learnSkill(hero, 'v3-warrior-strike'), true);
  const total = hero.skillProgressionV3!.totalEarnedSP;
  assert.equal(chooseSpecialization(hero, 'berserker'), true);
  assert.equal(hero.skillProgressionV3!.totalEarnedSP, total);
  assert.equal(hero.skillProgressionV3!.skillRanks['v3-warrior-strike'], undefined);
  assert.equal(hero.specialization, 'berserker');
  assert.equal(hero.skillProgressionV3!.chosenSpecialization, 'berserker');
  assert.equal(chooseSpecialization(hero, 'blade_master'), false);
  assert.equal(getJobSkillNodes(hero, 'specialization').active.length, 9);
  assert(getJobSkillNodes(hero, 'specialization').active.every((skill) => skill.specialization === 'berserker'));
  assert.equal(getVisibleJobArchitecture(hero).currentName, 'Berserker');
});

test('live Blade Master transition exposes Twin Blade Mastery without granting Dual Wield', () => {
  const hero = warrior(60);
  assert.equal(chooseSpecialization(hero, 'blade_master'), true);
  assert.equal(hero.specialization, 'blade_master');
  assert.equal(hero.skillProgressionV3!.chosenSpecialization, 'blade_master');
  assert.equal(chooseSpecialization(hero, 'berserker'), false);
  const nodes = getJobSkillNodes(hero, 'specialization').active;
  assert.equal(nodes.length, 9);
  assert(nodes.every((skill) => skill.specialization === 'blade_master'));
  assert(nodes.some((skill) => skill.id === 'v3-blade-master-twin-blade-mastery'));
  assert.equal(bladeMasterDualWieldActive(hero), false);
  assert.equal(learnSkill(hero, 'v3-blade-master-twin-blade-mastery'), true);
  assert.equal(bladeMasterDualWieldActive(hero), true);
  assert.equal(learnSkill(hero, 'v3-blade-master-twin-assault'), true);
  assert(getPrimaryHotbarEntries(hero).some((entry) => entry.id === 'v3-blade-master-twin-assault'));
  assert.equal(getVisibleJobArchitecture(hero).currentName, 'Blade Master');
});

test('V3 specialization identity survives save/load and legacy characters remain separate', () => {
  for (const specialization of ['berserker', 'blade_master'] as const) {
    const hero = warrior(60);
    assert.equal(chooseSpecialization(hero, specialization), true);
    const restored = parseSave(JSON.stringify(hero))!;
    assert.equal(restored.skillArchitectureVersion, 3);
    assert.equal(restored.coreJob, 'warrior');
    assert.equal(restored.specialization, specialization);
    assert.equal(restored.skillProgressionV3!.chosenSpecialization, specialization);
    assert.equal(characterLabel(restored), specialization === 'berserker' ? 'Berserker' : 'Blade Master');
    assert.equal(getJobProgression(restored)[2].status, 'Current');
    assert.equal(getVisibleJobArchitecture(restored).v3SpecializationChoices.filter((choice) => choice.available).length, 0);
  }
  const legacy = createNewCharacter('legacy-live', 'Legacy Live');
  const restoredLegacy = parseSave(JSON.stringify(legacy))!;
  assert.equal(restoredLegacy.skillArchitectureVersion, undefined);
  assert.equal(restoredLegacy.progressionArchitecture, 'v2_test');
  assert.equal(restoredLegacy.specialization, null);
});

test('V3 NPC copy and development fixtures follow the live progression contract', () => {
  const hero = warrior(60);
  const coreNpc = CITIES.arunika.npcList.find((npc) => npc.service === 'core')!;
  const specializationNpc = CITIES.jayantara.npcList.find((npc) => npc.service === 'special')!;
  assert.match(getNpcServiceLabel(coreNpc, hero), /Core Job Trainer · V3/);
  assert.match(getNpcDescription(coreNpc, hero), /Level 15/);
  assert.match(getNpcServiceLabel(specializationNpc, hero), /Specialization Trainer · V3/);
  assert.match(getNpcDescription(specializationNpc, hero), /Berserker or Blade Master|Berserker atau Blade Master/);

  assert.equal(createV3JobDevelopmentHero('warrior-15').coreJob, 'warrior');
  assert.equal(createV3JobDevelopmentHero('warrior-60').specialization, null);
  assert.equal(createV3JobDevelopmentHero('berserker-60').specialization, 'berserker');
  assert.equal(createV3JobDevelopmentHero('blade-master-60').specialization, 'blade_master');
});
