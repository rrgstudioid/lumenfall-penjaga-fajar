import test from 'node:test';
import assert from 'node:assert/strict';
import { WILDS_ID, WILDS_ENTRY } from './whispering-wilds-layout.ts';
import { migrateWildsSave } from './whispering-wilds-save-migration.ts';
import { freshHero, parseSave } from './rules.ts';
import {
  FIELDS,
  CITIES,
  fieldContent,
  travel,
  getQuestRegistry,
} from './regions.ts';

await test('retired forest saves relocate once and preserve ownership, progress and current-map timers', () => {
  const hero = freshHero();
  Object.assign(hero, {
    level: 24,
    currentField: 'whispering-wilds',
    inCity: false,
    x: 12,
    z: -30,
  });
  hero.unlockedFields = ['whispering-wilds', WILDS_ID];
  hero.fieldProgress = { 'whispering-wilds': 21, [WILDS_ID]: 4 };
  hero.defeatedFieldBosses = ['whispering-wilds'];
  hero.defeatedBossTimestamp = { 'whispering-wilds': 12345 };
  hero.completedQuests = ['field-whispering-wilds-easy'];
  hero.acceptedQuests = hero.activeQuests = ['field-whispering-wilds-veteran'];
  const currentKey = `${WILDS_ID}:whispering-wilds-5:spawn:100`;
  hero.monsterRespawnState = {
    'whispering-wilds-5:spawn:100': 555,
    [currentKey]: 999,
    'ironveil-mines-0:spawn:0': 123,
  };
  const raw = JSON.stringify(hero),
    migrated = migrateWildsSave({ ...hero });
  assert.deepEqual(migrateWildsSave(migrated), migrated);
  const loaded = parseSave(raw)!;
  assert.equal(JSON.stringify(hero), raw);
  assert.equal(loaded.currentField, WILDS_ID);
  assert.deepEqual({ x: loaded.x, z: loaded.z }, WILDS_ENTRY);
  assert.deepEqual(loaded.lastSafePosition, WILDS_ENTRY);
  assert.deepEqual(migrated.inventory, hero.inventory);
  const normalizedInventory = parseSave(
    JSON.stringify({
      ...hero,
      inCity: true,
      currentField: 'verdant-plains-v2',
    }),
  )!.inventory;
  assert.deepEqual(loaded.inventory, normalizedInventory);
  assert.deepEqual(loaded.equipment, hero.equipment);
  assert.equal(loaded.gold, hero.gold);
  assert.deepEqual(loaded.fieldProgress, { [WILDS_ID]: 21 });
  assert.deepEqual(loaded.defeatedFieldBosses, [WILDS_ID]);
  assert.deepEqual(loaded.defeatedBossTimestamp, { [WILDS_ID]: 12345 });
  assert.deepEqual(loaded.completedQuests, hero.completedQuests);
  assert.deepEqual(loaded.acceptedQuests, []);
  assert.deepEqual(loaded.monsterRespawnState, {
    [currentKey]: 999,
    'ironveil-mines-0:spawn:0': 123,
  });
  assert.equal(loaded.unlockedFields.filter((id) => id === WILDS_ID).length, 1);
  loaded.x = -190;
  loaded.z = 280;
  const again = parseSave(JSON.stringify(loaded))!;
  assert.equal(again.x, loaded.x);
  assert.equal(again.z, loaded.z);
});
await test('sub-level-16 preview saves return safely to town and cannot bypass entry gate', () => {
  for (const id of ['whispering-wilds', WILDS_ID]) {
    const hero = freshHero();
    Object.assign(hero, { level: 15, currentField: id, inCity: false });
    hero.unlockedFields = [id];
    const loaded = parseSave(JSON.stringify(hero))!;
    assert(loaded.inCity);
    assert.equal(loaded.currentCity, 'arunika');
    assert.equal(loaded.x, 0);
    assert.equal(loaded.z, 8);
    assert(!loaded.unlockedFields.includes(WILDS_ID));
    assert(!travel(loaded, WILDS_ID).ok);
    loaded.level = 16;
    assert(travel(loaded, WILDS_ID).ok);
  }
});
await test('one permanent forest occupies the old M-menu order and links with adjacent fields', () => {
  const ids = Object.keys(FIELDS);
  assert(!ids.includes('whispering-wilds'));
  assert.equal(ids.filter((id) => id.startsWith('whispering-wilds')).length, 1);
  assert.equal(ids.indexOf(WILDS_ID), ids.indexOf('ironveil-mines') + 1);
  assert.equal(ids.indexOf('frostfire-highlands'), ids.indexOf(WILDS_ID) + 1);
  assert.equal(FIELDS['ironveil-mines'].nextMap, WILDS_ID);
  assert.equal(FIELDS['frostfire-highlands'].previousField, WILDS_ID);
  for (const c of Object.values(CITIES))
    assert(!c.connectedFields.includes('whispering-wilds'));
  assert.equal(fieldContent(WILDS_ID).id, 'whispering-wilds');
  const hero = freshHero();
  hero.level = 50;
  assert(!travel(hero, 'whispering-wilds').ok);
  assert(travel(hero, WILDS_ID).ok);
  assert(!getQuestRegistry().some((q) => q.targetMapId === 'whispering-wilds'));
});
