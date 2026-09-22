import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNewCharacter,
  createV2TestHero,
  chooseV2CoreJob,
  isCompatibleCharacterSave,
  parseSave,
} from './rules.ts';
import { ITEM_CATALOG } from './items.ts';
import { getVisibleJobArchitecture } from './job-presentation.ts';
import { getJobSkillNodes } from './character-view.ts';

test('clean break rejects pre-break saves without deleting their parsed data', () => {
  const old = parseSave(JSON.stringify({
    version: 3,
    slotId: 'slot-1',
    characterName: 'Legacy Dev',
    level: 40,
    gold: 123,
    job: 'warrior',
  }));
  assert.ok(old);
  assert.equal(isCompatibleCharacterSave(old), false);
  assert.equal(old?.gold, 123);
});

test('new character creation is V2 Adventurer and does not auto-promote', () => {
  const hero = createNewCharacter('slot-1', 'Astra');
  assert.equal(isCompatibleCharacterSave(hero), true);
  assert.equal(hero.progressionArchitecture, 'v2_test');
  assert.equal(hero.job, 'adventurer');
  assert.equal(hero.coreJob, null);
  assert.equal(hero.specialization, null);
  assert.equal(getVisibleJobArchitecture(hero).legacyProgression, false);
});

test('level 15 V2 exposes only Warrior as an available core job', () => {
  const hero = createNewCharacter('slot-1', 'Astra');
  hero.level = 15;
  const choices = getVisibleJobArchitecture(hero).v2CoreChoices;
  assert.equal(choices.find(choice => choice.id === 'warrior')?.available, true);
  assert(choices.filter(choice => choice.id !== 'warrior').every(choice => !choice.available));
  assert.equal(chooseV2CoreJob(hero, 'warrior'), true);
  assert.equal(hero.coreJob, 'warrior');
  assert.equal(getJobSkillNodes(hero, 'core').active.length, 16);
  assert.equal(getJobSkillNodes(hero, 'core').passive.length, 14);
});

test('clean break preserves the item template catalog', () => {
  const templateIds = Object.keys(ITEM_CATALOG);
  const hero = createV2TestHero();
  assert.ok(hero.inventory.length > 0);
  assert.deepEqual(Object.keys(ITEM_CATALOG), templateIds);
});
