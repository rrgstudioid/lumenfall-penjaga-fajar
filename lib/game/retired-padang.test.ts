import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, FIELDS, FIELD_NPCS, getQuestRegistry, startingFieldIds, travel } from './regions.ts';
import { freshHero, parseSave } from './rules.ts';
import { PLAINS_ID, PLAINS_ENTRY } from './verdant-plains-layout.ts';

for (const retiredId of ['verdant-plains','sands-location']) {
await test(retiredId + ': Verdant Plains replaces the retired destination in travel, menu order and city links', () => {
  assert.equal(Object.keys(FIELDS)[0], PLAINS_ID);
  assert.equal(FIELDS[retiredId], undefined);
  assert.equal(FIELD_NPCS[retiredId], undefined);
  assert(!startingFieldIds().includes(retiredId));
  assert(startingFieldIds().includes(PLAINS_ID));
  for (const city of Object.values(CITIES)) assert(!city.connectedFields.includes(retiredId));
  assert.equal(CITIES.arunika.connectedFields[0], PLAINS_ID);
  assert(getQuestRegistry().every(q => q.targetMapId !== retiredId && q.giverMapId !== retiredId));
  const hero = freshHero();
  const before = JSON.stringify(hero);
  assert.equal(travel(hero, retiredId).ok, false);
  assert.equal(JSON.stringify(hero), before);
  assert.equal(travel(hero, PLAINS_ID).ok, true);
  assert.deepEqual({x:hero.x,z:hero.z}, PLAINS_ENTRY);
});

await test(retiredId + ': retired field saves arrive at camp without losing progress or changing city saves', () => {
  for (const inCity of [false, true]) {
    const hero = freshHero();
    Object.assign(hero, {currentField:retiredId,currentCity:'arunika',inCity,x:28,z:39,gold:4321});
    hero.unlockedFields = [retiredId,'ironveil-mines'];
    hero.completedQuests = [`field-${retiredId}-easy`];
    hero.fieldProgress =  {[retiredId]:23};
    const loaded = parseSave(JSON.stringify(hero))!;
    assert.equal(loaded.currentField, PLAINS_ID);
    assert.equal(loaded.currentCity, inCity ? 'arunika' : 'averion');
    assert.deepEqual({x:loaded.x,z:loaded.z}, inCity ? {x:28,z:39} : PLAINS_ENTRY);
    assert.equal(loaded.gold, hero.gold);
    assert.equal(loaded.level, hero.level);
    assert.deepEqual(loaded.equipment, hero.equipment);
    assert.deepEqual(loaded.completedQuests, hero.completedQuests);
    assert.deepEqual(loaded.fieldProgress, hero.fieldProgress);
    assert(loaded.unlockedFields.includes(PLAINS_ID));
    assert(!loaded.unlockedFields.includes(retiredId));
    const reloaded = parseSave(JSON.stringify(loaded))!;
    assert.deepEqual({x:reloaded.x,z:reloaded.z}, {x:loaded.x,z:loaded.z});
  }
});

}
